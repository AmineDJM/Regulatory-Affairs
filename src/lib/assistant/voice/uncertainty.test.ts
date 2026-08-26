import { describe, it, expect } from "vitest";
import { classifyRisk, gateAction, RISK_RANK, type UncertaintySignal } from "./uncertainty";

/**
 * LE BANC DE LA PRUDENCE ASYMÉTRIQUE.
 *
 * Il ne mesure pas une performance : il vérifie qu'une phrase mal entendue ne peut PAS devenir un
 * geste irréversible. C'est la seule famille de tests de cette mission où un échec n'est pas une
 * dégradation d'expérience — c'est un dossier supprimé ou un paiement parti.
 *
 * L'exigence de la mission est nommément : « Never transform uncertain audio into: delete /
 * payment / salary change / permission change / irreversible mutation. Reads can be much more
 * tolerant. » Les deux moitiés comptent : la seconde interdit de rendre l'assistant timide.
 */

const sig = (over: Partial<UncertaintySignal> = {}): UncertaintySignal => ({
  transcript: "supprime le dossier raltegravir",
  confidence: 0.95, inputPeak: 0.4, clipped: false,
  ...over,
});

describe("classement du risque", () => {
  it("nomme explicitement l'irréversible", () => {
    expect(classifyRisk("delete_record")).toBe("IRREVERSIBLE");
    expect(classifyRisk("send_prepared_mail")).toBe("IRREVERSIBLE");
    expect(classifyRisk("execute_payment")).toBe("IRREVERSIBLE");
  });

  it("nomme le sensible : argent, droits, rémunération", () => {
    expect(classifyRisk("update_salary")).toBe("SENSITIVE");
    expect(classifyRisk("set_user_role")).toBe("SENSITIVE");
    expect(classifyRisk("revoke_access")).toBe("SENSITIVE");
  });

  it("reconnaît les lectures", () => {
    for (const t of ["read_calendar", "gmail_search", "inspect_record", "list_pending_decisions", "search_everything", "directory_lookup"]) {
      expect(classifyRisk(t)).toBe("READ");
    }
  });

  it("un outil INCONNU est traité comme une écriture, jamais comme une lecture", () => {
    // Se tromper vers la prudence coûte une question ; se tromper vers la permissivité coûte une
    // action non voulue. Le défaut de classement doit donc pencher du côté sûr.
    expect(classifyRisk("frobnicate_widget")).toBe("WRITE");
    expect(classifyRisk("delete_something_new")).toBe("IRREVERSIBLE");
  });

  it("pas d'outil du tout = on parle, simplement", () => {
    expect(classifyRisk(null)).toBe("READ");
    expect(classifyRisk("")).toBe("READ");
  });

  it("l'échelle de gravité est ordonnée", () => {
    expect(RISK_RANK.READ).toBeLessThan(RISK_RANK.WRITE);
    expect(RISK_RANK.WRITE).toBeLessThan(RISK_RANK.SENSITIVE);
    expect(RISK_RANK.SENSITIVE).toBeLessThan(RISK_RANK.IRREVERSIBLE);
  });
});

describe("les lectures restent LARGEMENT tolérantes", () => {
  it("un signal médiocre ne bloque pas une consultation", () => {
    const d = gateAction("gmail_search", sig({ transcript: "des mails", confidence: 0.22, clipped: true, noisy: true }));
    expect(d.decision).toBe("PROCEED");
  });

  it("même sans confiance annoncée", () => {
    expect(gateAction("read_calendar", { transcript: "mon prochain rendez-vous" }).decision).toBe("PROCEED");
  });

  it("mais une transcription VIDE ne se lit pas non plus", () => {
    const d = gateAction("gmail_search", { transcript: "   " });
    expect(d.decision).toBe("CLARIFY");
  });
});

describe("l'irréversible exige un signal franc", () => {
  it("passe quand tout est net", () => {
    expect(gateAction("delete_record", sig()).decision).toBe("PROCEED");
  });

  it("demande confirmation sur une confiance basse", () => {
    const d = gateAction("delete_record", sig({ confidence: 0.55 }));
    expect(d.decision).toBe("CLARIFY");
    if (d.decision === "CLARIFY") expect(d.reason).toMatch(/confiance/);
  });

  it("demande confirmation sur un micro saturé, MÊME avec une confiance annoncée haute", () => {
    // Le fournisseur ne sait pas que le signal a écrêté : il annonce 0,95 sur des mots faux.
    // C'est précisément le cas où faire confiance à la confiance est dangereux.
    const d = gateAction("delete_record", sig({ confidence: 0.97, clipped: true }));
    expect(d.decision).toBe("CLARIFY");
    if (d.decision === "CLARIFY") expect(d.reason).toMatch(/saturé/);
  });

  it("demande confirmation quand les hypothèses divergent", () => {
    const d = gateAction("delete_record", sig({ alternatives: ["envoie le dossier raltegravir"] }));
    expect(d.decision).toBe("CLARIFY");
    if (d.decision === "CLARIFY") expect(d.reason).toMatch(/divergentes/);
  });

  it("ne compte pas une simple variante d'écriture comme un désaccord", () => {
    const d = gateAction("delete_record", sig({
      transcript: "Supprime-le, Raltegravir.",
      alternatives: ["supprime le raltegravir"],
    }));
    expect(d.decision).toBe("PROCEED");
  });

  it("demande confirmation sur fond sonore", () => {
    expect(gateAction("send_prepared_mail", sig({ noisy: true })).decision).toBe("CLARIFY");
  });

  it("la question REFORMULE le geste au lieu de quémander un oui", () => {
    const d = gateAction("delete_record", sig({ confidence: 0.4 }), { subject: "le dossier Raltegravir" });
    expect(d.decision).toBe("CLARIFY");
    if (d.decision === "CLARIFY") {
      // « Vous confirmez ? » ne vérifie rien : le PDG confirmerait ce qu'il croit avoir dit.
      expect(d.question).toContain("Raltegravir");
      expect(d.question).toMatch(/définitif/);
      expect(d.question.length).toBeLessThan(140); // §11 : courte, sinon elle devient le défaut.
    }
  });
});

describe("le sensible est exigeant, l'écriture ordinaire l'est moins", () => {
  it("un salaire exige plus qu'un brouillon", () => {
    const doux = sig({ confidence: 0.6 });
    expect(gateAction("update_salary", doux).decision).toBe("CLARIFY");
    expect(gateAction("create_task", doux).decision).toBe("PROCEED");
  });

  it("une écriture ordinaire sur un signal franchement mauvais demande quand même", () => {
    expect(gateAction("create_task", sig({ confidence: 0.2 })).decision).toBe("CLARIFY");
  });

  it("une confiance non fournie n'est pas une confiance nulle", () => {
    // Beaucoup de fournisseurs ne rendent pas de score. Traiter l'absence comme un zéro
    // rendrait tout irréversible impossible — un assistant qui ne fait jamais rien.
    expect(gateAction("delete_record", { transcript: "supprime le dossier raltegravir" }).decision).toBe("PROCEED");
  });
});

describe("le niveau de risque peut être imposé directement", () => {
  it("pour les gestes que le nom d'outil ne décrit pas", () => {
    expect(gateAction("IRREVERSIBLE", sig({ confidence: 0.5 })).decision).toBe("CLARIFY");
    expect(gateAction("READ", sig({ confidence: 0.05 })).decision).toBe("PROCEED");
  });
});
