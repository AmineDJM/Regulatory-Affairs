import { describe, expect, it } from "vitest";
import { classerGeste, natureDe, NATURES_GESTE, REVERSIBILITES } from "@/lib/annulation/reversibilite";
import { composer, conclure, type Changement, type EtatActuel } from "@/lib/annulation/plan";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ANNULATION (mandat 6 §48) — les propriétés, pas les lignes de code.
 *
 * Le test le plus important de ce fichier est celui du CONFLIT : un système d'annulation qui
 * n'écrase pas le travail d'un collègue est utile ; le même sans cette garantie est un piège
 * qui se déclenchera une seule fois, très cher.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const jour = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

const chg = (o: Partial<Changement>): Changement => ({
  id: "c1", auteurId: "adam", auteurNom: "Adam", parAdam: true,
  quand: jour("2026-09-01"), action: "UPDATE", module: "Regulatory",
  entite: "REGULATORY_PRODUCT", entiteId: "prod-1", champ: "status",
  avant: "IN_PREPARATION", apres: "AWAITING_ANPP", resume: "statut du dossier", ...o,
});

const etat = (valeur: string | null, o: Partial<EtatActuel> = {}): EtatActuel => ({
  entite: "REGULATORY_PRODUCT", entiteId: "prod-1", champ: "status", valeur, ...o,
});

describe("la réversibilité — quatre réponses, parce que deux mentent", () => {
  it("chaque nature de geste a un verdict, et aucun verdict n'est vide", () => {
    for (const n of NATURES_GESTE) {
      const v = classerGeste(n);
      expect(REVERSIBILITES).toContain(v.reversibilite);
      expect(v.raison.length, n).toBeGreaterThan(20);
      // Tout ce qui n'est pas réversible DOIT dire ce qu'on peut faire à la place, ou à qui
      // déléguer. Un « non » sans suite est une impasse, pas une réponse.
      if (v.reversibilite !== "REVERSIBLE") {
        expect(Boolean(v.compensation || v.delegueA), `${n} : ni compensation ni délégation`).toBe(true);
      }
    }
  });

  it("un e-mail parti et un paiement exécuté ne se « défont » jamais — ils se compensent", () => {
    expect(classerGeste("MESSAGE_ENVOYE").reversibilite).toBe("IRREVERSIBLE");
    expect(classerGeste("MESSAGE_ENVOYE").compensation).toMatch(/rectificatif/i);
    expect(classerGeste("PAIEMENT_EXECUTE").reversibilite).toBe("IRREVERSIBLE");
    // Et le mot « annulation » est explicitement refusé pour un paiement.
    expect(classerGeste("PAIEMENT_EXECUTE").compensation).toMatch(/n'est PAS une annulation/i);
  });

  it("document et règle enseignée sont DÉLÉGUÉS — on ne réécrit pas un second mécanisme", () => {
    expect(classerGeste("DOCUMENT_MODIFIE").delegueA).toMatch(/Live Office/i);
    expect(classerGeste("REGLE_ENSEIGNEE").delegueA).toMatch(/Teach Adam/i);
  });

  it("une signature textuelle précise l'emporte sur le verbe du journal", () => {
    // Le piège : un paiement exécuté EST un UPDATE de `status`. Le ranger en CHAMP_MODIFIE le
    // rendrait « réversible » — Adam proposerait de dé-payer un fournisseur.
    expect(natureDe({ action: "UPDATE", module: "Finance", resume: "virement émis à Hetero Labs", champ: "status" }))
      .toBe("PAIEMENT_EXECUTE");
    expect(natureDe({ action: "UPDATE", module: "Regulatory", resume: "dépôt ANPP du dossier", champ: "status" }))
      .toBe("DEPOT_AUTORITE");
    expect(natureDe({ action: "UPDATE", module: "Regulatory", resume: "priorité relevée", champ: "priority" }))
      .toBe("CHAMP_MODIFIE");
    expect(natureDe({ action: "CREATE", module: "Tasks", resume: "tâche créée", champ: null }))
      .toBe("ENREGISTREMENT_CREE");
  });
});

describe("le plan — l'invariant du conflit", () => {
  it("un champ inchangé depuis se défait, et le geste dit exactement ce qu'il écrira", () => {
    const p = composer([chg({})], [etat("AWAITING_ANPP")]);
    expect(p.gestes).toHaveLength(1);
    expect(p.ecartes).toHaveLength(0);
    expect(p.complet).toBe(true);
    const g = p.gestes[0]!;
    expect(g.valeurAttendue).toBe("AWAITING_ANPP");
    expect(g.valeurCible).toBe("IN_PREPARATION");
    expect(g.libelle).toContain("AWAITING_ANPP");
    expect(g.libelle).toContain("IN_PREPARATION");
  });

  it("LE TEST QUI COMPTE : un champ que quelqu'un a changé depuis n'est PAS défait, et on dit qui", () => {
    // Adam a mis AWAITING_ANPP le 1er. Yassine a mis BLOCKED le 3. On annule Adam le 5.
    const adam = chg({ id: "a", quand: jour("2026-09-01") });
    const yassine = chg({
      id: "y", auteurId: "u-yassine", auteurNom: "Yassine", parAdam: false,
      quand: jour("2026-09-03"), avant: "AWAITING_ANPP", apres: "BLOCKED",
    });

    const p = composer([adam], [etat("BLOCKED")], [yassine]);
    expect(p.gestes, "le travail de Yassine allait être écrasé").toHaveLength(0);
    expect(p.complet).toBe(false);
    const e = p.ecartes[0]!;
    expect(e.motif).toBe("MODIFIE_DEPUIS");
    expect(e.explication).toContain("Yassine");
    expect(e.explication).toContain("BLOCKED");
    expect(e.explication).toMatch(/effacerait ce travail/i);
  });

  it("une valeur actuelle INCONNUE n'autorise pas à écrire — l'ignorance n'est pas un feu vert", () => {
    const p = composer([chg({})], []); // aucun état lu
    expect(p.gestes).toHaveLength(0);
    expect(p.ecartes[0]!.motif).toBe("ETAT_INCONNU");
    expect(p.ecartes[0]!.explication).toMatch(/serait un pari/i);
  });

  it("les gestes se défont du PLUS RÉCENT au plus ancien", () => {
    const vieux = chg({ id: "vieux", quand: jour("2026-09-01"), champ: "priority", avant: "LOW", apres: "MEDIUM" });
    const recent = chg({ id: "recent", quand: jour("2026-09-04"), champ: "status" });
    const p = composer([vieux, recent], [etat("AWAITING_ANPP"), etat("MEDIUM", { champ: "priority" })]);
    expect(p.gestes.map((g) => g.changementId)).toEqual(["recent", "vieux"]);
  });

  it("un lot mixte ne se résume JAMAIS par « annulé » : le compte est arithmétique", () => {
    const p = composer(
      [
        chg({ id: "ok", champ: "status" }),
        chg({ id: "mail", resume: "e-mail envoyé au partenaire", champ: null, entite: null, entiteId: null }),
        chg({ id: "doc", resume: "document modifié : rapport.docx", champ: null }),
      ],
      [etat("AWAITING_ANPP")],
    );
    expect(p.gestes).toHaveLength(1);
    expect(p.ecartes).toHaveLength(2);
    expect(p.complet).toBe(false);
    expect(p.resume).toContain("1 changement(s) sur 3");
    expect(p.resume).toMatch(/ne le peuvent pas/);
    // L'e-mail sort avec sa compensation, le document avec son délégataire.
    expect(p.ecartes.find((e) => e.changementId === "mail")!.compensation).toMatch(/rectificatif/i);
    expect(p.ecartes.find((e) => e.changementId === "doc")!.delegueA).toMatch(/Live Office/i);
  });

  it("un journal sans cible ne se devine pas", () => {
    const p = composer([chg({ champ: null, entiteId: null, resume: "quelque chose a bougé" })], [etat("X")]);
    expect(p.ecartes[0]!.motif).toBe("JOURNAL_INCOMPLET");
  });

  it("un périmètre vide le dit, au lieu d'annoncer une réussite", () => {
    const p = composer([], []);
    expect(p.complet).toBe(false);
    expect(p.resume).toMatch(/aucun changement/i);
  });
});

describe("le compte rendu — « tout a tourné » n'est pas « tout est défait »", () => {
  it("un échec d'écriture sort du compte des défaits et interdit la phrase complète", () => {
    const p = composer([chg({ id: "a" }), chg({ id: "b", champ: "priority", avant: "LOW", apres: "HIGH" })],
      [etat("AWAITING_ANPP"), etat("HIGH", { champ: "priority" })]);
    expect(p.gestes).toHaveLength(2);

    const cr = conclure(p, [{ changementId: "b", pourquoi: "la valeur avait encore changé" }]);
    expect(cr.defaits).toBe(1);
    expect(cr.resume).toMatch(/PAS une annulation complète/i);
  });

  it("un plan entièrement appliqué peut le dire — et c'est la seule fois", () => {
    const p = composer([chg({})], [etat("AWAITING_ANPP")]);
    const cr = conclure(p, []);
    expect(cr.defaits).toBe(1);
    expect(cr.resume).toMatch(/revenu à son état antérieur/i);
    expect(cr.resume).not.toMatch(/PAS une annulation/i);
  });
});

describe("mesures consignées — §48", () => {
  it("un lot partiellement défaisable ne se conclut jamais par « annulé »", () => {
    const p = composer(
      [chg({ id: "ok" }), chg({ id: "mail", resume: "e-mail envoyé", champ: null, entite: null, entiteId: null })],
      [etat("AWAITING_ANPP")],
    );
    const cr = conclure(p, []);
    const ok = /PAS une annulation complète/i.test(cr.resume) && p.ecartes[0]!.compensation !== null ? 1 : 0;
    consignerMesure("annulation_jamais_totale_a_tort", { n: 1, ok },
      "lib/annulation/annulation.test.ts",
      "compte arithmétique + irréversible nommé avec sa compensation");
  });
});
