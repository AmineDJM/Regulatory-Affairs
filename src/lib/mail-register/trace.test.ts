import { describe, it, expect } from "vitest";
import {
  MAIL_TRACKED_FIELDS,
  traceValue,
  diffMailEntry,
  diffMailAssignments,
  describeMailChanges,
  renderTraceValue,
} from "./trace";

describe("traceValue — la forme canonique d'une valeur de courrier", () => {
  it("un objet Date et sa chaîne ISO sont LA MÊME valeur", () => {
    // C'est tout l'enjeu : la base rend un `Date`, le formulaire rend une chaîne. Si les deux ne
    // se rejoignent pas, chaque enregistrement inventerait une modification de date.
    const d = new Date("2026-08-17T13:30:00.000Z");
    expect(traceValue(d)).toBe(traceValue("2026-08-17T13:30:00.000Z"));
  });

  it("vide, nul et non défini se valent — effacer un champ déjà vide n'est pas un changement", () => {
    expect(traceValue(null)).toBe("");
    expect(traceValue(undefined)).toBe("");
    expect(traceValue("")).toBe("");
    expect(traceValue("   ")).toBe("");
  });

  it("ne transforme PAS en date ce qui n'en est pas une — « 2026 » est un n° de chrono", () => {
    expect(traceValue("2026")).toBe("2026");
    expect(traceValue("CNAS-2026-014")).toBe("CNAS-2026-014");
  });

  it("une date invalide vaut vide plutôt que de propager « Invalid Date »", () => {
    expect(traceValue(new Date("n'importe quoi"))).toBe("");
  });
});

describe("diffMailEntry — ce qui a VRAIMENT changé", () => {
  it("ne retient que les champs modifiés, dans l'ordre de la fiche", () => {
    const changes = diffMailEntry(
      { title: "Relance CNAS", sender: "Adventum", receivedAt: null, acknowledgedAt: null },
      { title: "Relance CNAS", sender: "Adventum Pharma", receivedAt: "2026-08-17", acknowledgedAt: null },
    );
    expect(changes.map((c) => c.field)).toEqual(["sender", "receivedAt"]);
    expect(changes[0]).toMatchObject({ label: "Expéditeur", before: "Adventum", after: "Adventum Pharma" });
  });

  it("un aller-retour par le formulaire ne fabrique AUCUNE modification", () => {
    const stored = {
      title: "Relance CNAS",
      direction: "OUTGOING",
      sentAt: new Date("2026-08-17T13:30:00.000Z"),
      receivedAt: new Date("2026-08-20T00:00:00.000Z"),
      notes: null,
    };
    const resubmitted = {
      title: "Relance CNAS",
      direction: "OUTGOING",
      sentAt: "2026-08-17T13:30:00.000Z",
      receivedAt: "2026-08-20T00:00:00.000Z",
      notes: "",
    };
    expect(diffMailEntry(stored, resubmitted)).toEqual([]);
  });

  it("un champ ABSENT de la nouvelle version n'est pas effacé par omission", () => {
    // Une mise à jour partielle (poser une seule date depuis le tableau) ne parle pas des autres
    // champs : les compter comme vidés inscrirait au journal des suppressions imaginaires.
    expect(diffMailEntry({ title: "Relance", carrier: "Coursier" }, { receivedAt: "2026-08-17" }))
      .toMatchObject([{ field: "receivedAt" }]);
  });

  it("ne trace QUE les champs déclarés — une colonne sans libellé n'entre pas au journal en douce", () => {
    const before = { title: "Relance" } as Record<string, unknown>;
    const after = { title: "Relance", companyId: "autre-entite" } as Record<string, unknown>;
    expect(diffMailEntry(before, after)).toEqual([]);
    expect(Object.keys(MAIL_TRACKED_FIELDS)).not.toContain("companyId");
  });
});

describe("diffMailAssignments — à qui le pli s'adresse, journalisé EN CLAIR", () => {
  it("compare des noms, jamais des identifiants", () => {
    const moved = diffMailAssignments(
      { department: "Direction Commerciale", person: "" },
      { department: "Finances", person: "Karim Benali" },
    );
    expect(moved).toEqual([
      { label: "Direction concernée", before: "Direction Commerciale", after: "Finances" },
      { label: "Personne concernée", before: "", after: "Karim Benali" },
    ]);
  });

  it("un rattachement ABSENT de la nouvelle version n'est pas retiré par omission", () => {
    // Corriger la seule personne concernée ne doit pas débrancher le pli de sa direction — et
    // surtout pas inscrire au journal un retrait qui n'a pas eu lieu.
    expect(diffMailAssignments(
      { department: "Finances", person: "Karim Benali" },
      { person: "Sofiane Meziane" },
    )).toEqual([{ label: "Personne concernée", before: "Karim Benali", after: "Sofiane Meziane" }]);
  });

  it("retirer un rattachement EST une modification, et elle se voit", () => {
    expect(diffMailAssignments({ department: "Finances" }, { department: "" }))
      .toEqual([{ label: "Direction concernée", before: "Finances", after: "" }]);
  });

  it("vide, nul et espaces se valent — reposer le même rattachement ne change rien", () => {
    expect(diffMailAssignments({ department: null, person: "Karim Benali" }, { department: "", person: " Karim Benali " }))
      .toEqual([]);
  });
});

describe("describeMailChanges — le résumé que l'on relit six mois plus tard", () => {
  it("nomme les champs touchés, au pluriel quand il y en a plusieurs", () => {
    const changes = diffMailEntry(
      { receivedAt: null, acknowledgedAt: null },
      { receivedAt: "2026-08-17", acknowledgedAt: "2026-08-20" },
    );
    expect(describeMailChanges("Relance CNAS", changes))
      .toBe("Courrier « Relance CNAS » — Arrivée, Accusé de réception modifiés");
  });

  it("reste au singulier pour un seul champ", () => {
    const changes = diffMailEntry({ carrier: null }, { carrier: "Coursier" });
    expect(describeMailChanges("Relance CNAS", changes)).toBe("Courrier « Relance CNAS » — Porteur modifié");
  });
});

describe("renderTraceValue — relire une correction sans décodeur", () => {
  it("un sens de courrier retrouve son libellé français", () => {
    expect(renderTraceValue("OUTGOING")).toBe("Sortant");
    expect(renderTraceValue("INCOMING")).toBe("Entrant");
  });

  it("le vide se dit, il ne disparaît pas", () => {
    expect(renderTraceValue("")).toBe("(vide)");
    expect(renderTraceValue(null)).toBe("(vide)");
  });

  it("un instant ISO devient une date lisible — jamais l'ISO brut", () => {
    const out = renderTraceValue("2026-08-17T13:30:00.000Z");
    expect(out).not.toContain("T");
    expect(out).toMatch(/2026/);
  });

  it("laisse le texte libre intact", () => {
    expect(renderTraceValue("CNAS-2026-014")).toBe("CNAS-2026-014");
  });
});
