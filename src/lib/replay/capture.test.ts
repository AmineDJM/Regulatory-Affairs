import { describe, it, expect } from "vitest";
import {
  fieldIsRecordable, isSensitiveLabel, cleanLabel, scrubDetail, makeEvent,
  coalesce, describeEvent, stamp, firstErrorIndex, type CapturedEvent,
} from "./capture";

const ev = (over: Partial<CapturedEvent> = {}): CapturedEvent => ({
  kind: "CLICK", at: 0, path: "/finances", label: "Enregistrer", detail: null, ...over,
});

describe("Ce qui n'entre JAMAIS dans un rejeu", () => {
  it("écarte les champs de mot de passe — par leur type ET par leur nom", () => {
    // Savoir qu'une personne a tapé dans « mot de passe » est déjà de trop : la durée de frappe et
    // le nombre de corrections en disent long.
    expect(fieldIsRecordable({ type: "password" })).toBe(false);
    expect(fieldIsRecordable({ label: "Mot de passe" })).toBe(false);
    expect(fieldIsRecordable({ name: "password" })).toBe(false);
    expect(fieldIsRecordable({ label: "Confirmer le mot  de passe" })).toBe(false);
  });

  it("écarte les secrets, jetons et coordonnées bancaires", () => {
    for (const l of ["Secret", "API token", "CVV", "IBAN", "RIB de l'agence", "Numéro de carte"]) {
      expect(fieldIsRecordable({ label: l }), l).toBe(false);
    }
  });

  it("écarte les champs cachés — ils portent souvent des identifiants techniques", () => {
    expect(fieldIsRecordable({ type: "hidden", label: "Objet" })).toBe(false);
  });

  it("laisse passer un champ ordinaire", () => {
    expect(fieldIsRecordable({ label: "Objet du courrier", type: "text" })).toBe(true);
  });

  it("makeEvent REFUSE d'écrire un événement sur un champ interdit", () => {
    // C'est la porte d'entrée unique : rien d'autre n'écrit d'événement.
    expect(makeEvent({ kind: "INPUT", at: 10, path: "/login", label: "Mot de passe" })).toBeNull();
    expect(makeEvent({ kind: "INPUT", at: 10, path: "/login", type: "password" })).toBeNull();
  });
});

describe("Les libellés sensibles — on garde le nom, jamais la valeur", () => {
  it("reconnaît un montant, un salaire, un numéro de compte", () => {
    for (const l of ["Montant (DZD)", "Salaire brut", "Prix unitaire", "Compte bancaire", "NIF", "Numéro de dossier"]) {
      expect(isSensitiveLabel(l), l).toBe(true);
    }
  });

  it("ne classe pas sensible un libellé ordinaire", () => {
    expect(isSensitiveLabel("Objet")).toBe(false);
    expect(isSensitiveLabel(null)).toBe(false);
  });
});

describe("Le nettoyage des libellés", () => {
  it("met sur une ligne et coupe court — un libellé long est un contenu déguisé", () => {
    expect(cleanLabel("  Enregistrer\n  les  corrections ")).toBe("Enregistrer les corrections");
    expect(cleanLabel("x".repeat(200))!.length).toBeLessThanOrEqual(60);
  });

  it("rend null sur du vide", () => {
    expect(cleanLabel("   ")).toBeNull();
    expect(cleanLabel(null)).toBeNull();
  });
});

describe("Le filet de sécurité sur les messages d'erreur", () => {
  it("retire les adresses e-mail — une erreur recopie volontiers la requête", () => {
    expect(scrubDetail("Échec pour amine.djouamai@adventumdz.com")).toBe("Échec pour [adresse]");
  });

  it("retire les numéros longs (RIB, téléphone, NIF)", () => {
    expect(scrubDetail("RIB 0021 0000 1234 5678 90 refusé")).toContain("[numéro]");
    expect(scrubDetail("RIB 0021 0000 1234 5678 90 refusé")).not.toContain("1234");
  });

  it("retire les jetons", () => {
    expect(scrubDetail("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6")).toContain("[jeton]");
  });

  it("tronque et garde une seule ligne", () => {
    expect(scrubDetail("a".repeat(500))!.length).toBeLessThanOrEqual(200);
    expect(scrubDetail("ligne\nsuivante")).toBe("ligne suivante");
  });

  it("makeEvent applique le nettoyage au détail, sans y penser", () => {
    const e = makeEvent({ kind: "ERROR", at: 5, path: "/x", detail: "500 sur contact@x.dz" });
    expect(e!.detail).toBe("500 sur [adresse]");
  });
});

describe("Fondre les saisies répétées", () => {
  it("garde le premier événement d'un champ, jette les frappes suivantes", () => {
    // Vingt touches produisent vingt événements : illisible, et inutile — ce qui compte est
    // qu'elle a rempli ce champ.
    const keys = [0, 100, 250, 400, 900].map((at) => ev({ kind: "INPUT", at, label: "Objet" }));
    const out = coalesce(keys);
    expect(out).toHaveLength(1);
    expect(out[0].at).toBe(0);
  });

  it("garde une saisie reprise APRÈS la fenêtre — c'est un nouveau geste", () => {
    const out = coalesce([ev({ kind: "INPUT", at: 0, label: "Objet" }), ev({ kind: "INPUT", at: 5000, label: "Objet" })]);
    expect(out).toHaveLength(2);
  });

  it("ne fond pas deux champs différents, ni deux natures différentes", () => {
    expect(coalesce([ev({ kind: "INPUT", at: 0, label: "Objet" }), ev({ kind: "INPUT", at: 50, label: "Notes" })])).toHaveLength(2);
    expect(coalesce([ev({ kind: "INPUT", at: 0, label: "Objet" }), ev({ kind: "CLICK", at: 50, label: "Objet" })])).toHaveLength(2);
  });
});

describe("Ce que le technicien lit", () => {
  it("compose une phrase complète", () => {
    expect(describeEvent(ev())).toBe("Clic « Enregistrer »");
    expect(describeEvent(ev({ kind: "ERROR", label: null, detail: "500" }))).toBe("Erreur — 500");
  });

  it("affiche un horodatage lisible, pas des millisecondes", () => {
    expect(stamp(5000)).toBe("5 s");
    expect(stamp(72_000)).toBe("1 min 12 s");
  });

  it("place le curseur sur la PREMIÈRE erreur — c'est ce qu'on vient chercher", () => {
    const list = [ev(), ev({ kind: "INPUT" }), ev({ kind: "ERROR", at: 9 }), ev({ kind: "ERROR", at: 12 })];
    expect(firstErrorIndex(list)).toBe(2);
    expect(firstErrorIndex([ev(), ev()])).toBe(-1);
  });
});
