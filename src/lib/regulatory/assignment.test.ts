import { describe, it, expect } from "vitest";
import { carrierAccess, assignmentNotice, assignmentWarning, CARRIER_ACTIONS } from "./assignment";

describe("carrierAccess — porter un dossier ouvre le module", () => {
  it("accorde l'accès à qui porte un dossier sans avoir le module", () => {
    const grant = carrierAccess({ carries: true, blocked: false, hasModule: false });
    expect(grant).not.toBeNull();
    expect(grant?.scope).toBe("ASSIGNED");
  });

  it("n'accorde rien à qui ne porte aucun dossier", () => {
    expect(carrierAccess({ carries: false, blocked: false, hasModule: false })).toBeNull();
  });

  it("n'écrase pas un accès existant — le rôle donne peut-être davantage", () => {
    expect(carrierAccess({ carries: true, blocked: false, hasModule: true })).toBeNull();
  });

  it("un BLOCAGE explicite de l'administrateur gagne toujours", () => {
    expect(carrierAccess({ carries: true, blocked: true, hasModule: false })).toBeNull();
  });

  it("porte les gestes du PORTEUR : voir, avancer, déposer, exporter", () => {
    expect([...CARRIER_ACTIONS].sort()).toEqual(["EXPORT", "UPDATE", "UPLOAD", "VIEW"]);
  });

  it("ne donne ni création, ni suppression, ni validation — ce ne sont pas des gestes de porteur", () => {
    const actions = [...CARRIER_ACTIONS] as string[];
    expect(actions).not.toContain("CREATE");
    expect(actions).not.toContain("DELETE");
    expect(actions).not.toContain("VALIDATE");
  });

  it("la portée reste ASSIGNED : porter trois dossiers n'ouvre pas le portefeuille", () => {
    expect(carrierAccess({ carries: true, blocked: false, hasModule: false })?.scope).toBe("ASSIGNED");
  });
});

describe("assignmentNotice — ce qu'on écrit à la personne", () => {
  const base = { reference: "REG-2026-014", dci: "Amoxicilline" };

  it("annonce simplement un dossier ouvert", () => {
    const n = assignmentNotice({ ...base, locked: false, seesLocked: false });
    expect(n.title).toBe("Vous êtes chargé(e) de ce dossier");
    expect(n.body).toBe("REG-2026-014 — Amoxicilline");
  });

  it("PRÉVIENT quand le dossier est verrouillé et que la personne ne le verra pas", () => {
    const n = assignmentNotice({ ...base, locked: true, seesLocked: false });
    expect(n.title).toContain("pipeline");
    expect(n.body).toContain("verrouillé");
    expect(n.body).toContain("cadenas");
  });

  it("ne prévient de rien si la personne a accès au pipeline — elle le verra", () => {
    const n = assignmentNotice({ ...base, locked: true, seesLocked: true });
    expect(n.title).toBe("Vous êtes chargé(e) de ce dossier");
  });

  it("porte toujours la référence ET la DCI : une référence seule ne se reconnaît pas", () => {
    for (const locked of [true, false]) {
      const n = assignmentNotice({ ...base, locked, seesLocked: false });
      expect(n.body).toContain("REG-2026-014");
      expect(n.body).toContain("Amoxicilline");
    }
  });
});

describe("assignmentWarning — ce que l'écran répond à qui vient de confier", () => {
  it("se tait quand tout est normal", () => {
    expect(assignmentWarning({ locked: false, seesLocked: false })).toBeNull();
    expect(assignmentWarning({ locked: true, seesLocked: true })).toBeNull();
  });

  it("dit la réserve quand le dossier est verrouillé pour la personne", () => {
    const w = assignmentWarning({ locked: true, seesLocked: false });
    expect(w).toContain("VERROUILLÉ");
    expect(w).toContain("cadenas");
  });
});
