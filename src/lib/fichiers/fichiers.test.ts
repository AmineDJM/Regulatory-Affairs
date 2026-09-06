import { describe, expect, it, vi } from "vitest";
import { type Fichier, distanceNoms, orphelins, radical, radicalSansVersion, trouverDoublons } from "./doublons";
import { type Geste, estPassager, estReversible, executerLot, inverser, preparerLot } from "./lot";
import { extraireEntites, gestesDeClassement, proposerClassement } from "./classement";

const F = (id: string, nom: string, taille: number, extra: Partial<Fichier> = {}): Fichier => ({ id, nom, taille, chemin: "Drive", ...extra });

describe("fichiers — les doublons, et ce qu'on n'en fait pas", () => {
  it("IDENTIQUE : même empreinte, et le code dit que supprimer ne libère RIEN", () => {
    const r = trouverDoublons([
      F("1", "Contrat Sofradis.pdf", 100_000, { empreinte: "aaa", references: 2, modifieLe: "2026-01-01" }),
      F("2", "Contrat Sofradis - copie.pdf", 100_000, { empreinte: "aaa", modifieLe: "2026-03-01" }),
      F("3", "Autre.pdf", 50_000, { empreinte: "bbb" }),
    ]);
    expect("erreur" in r).toBe(false);
    if ("erreur" in r) return;
    expect(r.identiques).toBe(1);
    const g = r.groupes[0]!;
    expect(g.nature).toBe("IDENTIQUE");
    expect(g.confiance).toBe(1);
    // Le maître est le plus RÉFÉRENCÉ, même s'il est plus ancien.
    expect(g.garder.id).toBe("1");
    expect(g.octetsLiberables).toBe(0);
    expect(r.octetsDejaPartages).toBe(100_000);
    expect(g.precautions.some((p) => /ne libère AUCUN octet/.test(p))).toBe(true);
    expect(r.limites.some((l) => /PROPOSE, une personne décide/.test(l))).toBe(true);
  });

  it("VERSION : « v2 », « FINAL », « (1) » se rejoignent — un historique, pas un doublon", () => {
    const r = trouverDoublons([
      F("1", "Budget 2027.xlsx", 20_000, { modifieLe: "2026-01-01" }),
      F("2", "Budget 2027 v2.xlsx", 21_000, { modifieLe: "2026-02-01" }),
      F("3", "Budget 2027 FINAL.xlsx", 22_000, { modifieLe: "2026-03-01" }),
    ]);
    if ("erreur" in r) throw new Error(r.erreur);
    expect(r.versions).toBe(1);
    const g = r.groupes.find((x) => x.nature === "VERSION")!;
    expect(g.autres.length).toBe(2);
    expect(g.garder.nom).toBe("Budget 2027 FINAL.xlsx"); // le plus récent
    expect(g.octetsLiberables).toBe(41_000);
    expect(g.precautions.some((p) => /historique mal rangé/.test(p))).toBe(true);
    expect(g.precautions.some((p) => /« FINAL » n'est pas une preuve/.test(p))).toBe(true);
  });

  it("RESSEMBLANT : deux devis presque homonymes ne sont qu'un SOUPÇON", () => {
    const r = trouverDoublons([
      F("1", "Devis Kwality 2026.pdf", 30_000, { empreinte: "x1" }),
      F("2", "Devis Kwelity 2026.pdf", 30_500, { empreinte: "x2" }),
    ]);
    if ("erreur" in r) throw new Error(r.erreur);
    expect(r.ressemblants).toBe(1);
    const g = r.groupes.find((x) => x.nature === "RESSEMBLANT")!;
    expect(g.confiance).toBeLessThan(0.5);
    expect(g.octetsLiberables).toBe(0);
    expect(g.precautions.some((p) => /SOUPÇON, pas doublon/.test(p))).toBe(true);
    expect(g.precautions.some((p) => /deux clients différents/.test(p))).toBe(true);
  });

  it("des fichiers réellement distincts ne sont pas groupés", () => {
    const r = trouverDoublons([
      F("1", "Contrat Sofradis.pdf", 100_000, { empreinte: "a" }),
      F("2", "Facture ANPP janvier.pdf", 12_000, { empreinte: "b" }),
      F("3", "Présentation comité.pptx", 4_000_000, { empreinte: "c" }),
    ]);
    if ("erreur" in r) throw new Error(r.erreur);
    expect(r.groupes.length).toBe(0);
  });

  it("l'absence d'empreinte est DITE : un « identique » ne peut plus être prouvé", () => {
    const r = trouverDoublons([F("1", "a.pdf", 100), F("2", "b.pdf", 100)]);
    if ("erreur" in r) throw new Error(r.erreur);
    expect(r.limites.some((l) => /sans empreinte de contenu/.test(l))).toBe(true);
  });

  it("les outils de nom : radical, radical sans version, distance bornée", () => {
    expect(radical("Contrat Sofradis (2).PDF")).toBe("contrat sofradis 2");
    // L'ANNÉE RESTE : « Budget 2026 » et « Budget 2027 » sont deux documents, pas deux versions.
    // Seules les marques de VERSION tombent — c'est ce qui fait se rejoindre « v2 » et « FINAL ».
    expect(radicalSansVersion("Budget 2027 v2.xlsx")).toBe("budget 2027");
    expect(radicalSansVersion("Budget 2027 FINAL.xlsx")).toBe("budget 2027");
    expect(radicalSansVersion("Budget 2026 v2.xlsx")).not.toBe(radicalSansVersion("Budget 2027 v2.xlsx"));
    expect(distanceNoms("kwality", "kwelity")).toBe(1);
    expect(distanceNoms("abc", "xyz")).toBe(3);
    expect(distanceNoms("court", "un nom beaucoup beaucoup plus long", 5)).toBe(6); // borné
  });

  it("les orphelins sont candidats à l'ARCHIVAGE, jamais à la suppression", () => {
    const maintenant = new Date("2026-09-06");
    const o = orphelins([
      F("1", "vieux.pdf", 1000, { references: 0, modifieLe: "2024-01-01" }),
      F("2", "récent.pdf", 1000, { references: 0, modifieLe: "2026-08-01" }),
      F("3", "vieux mais lié.pdf", 1000, { references: 3, modifieLe: "2023-01-01" }),
    ], 365, maintenant);
    expect(o.length).toBe(1);
    expect(o[0]!.fichier.id).toBe("1");
    expect(o[0]!.raison).toMatch(/ARCHIVAGE, pas à la suppression/);
  });
});

describe("fichiers — un lot massif et ce qu'il promet", () => {
  const geste = (id: string, confiance = 1): Geste => ({
    cible: id, type: "deplacer", avant: { chemin: "Inbox" }, apres: { chemin: "Contrats" },
    raison: "test", confiance, libelle: `déplacer ${id}`,
  });

  it("l'aperçu est produit AVANT, avec son plan de retour", () => {
    const a = preparerLot([geste("1"), geste("2")]);
    expect("erreur" in a).toBe(false);
    if ("erreur" in a) return;
    expect(a.gestes.length).toBe(2);
    expect(a.reversible).toBe(true);
    expect(a.planDeRetour.length).toBe(2);
    // Le retour ramène à l'origine, et il est en ordre INVERSE.
    expect(a.planDeRetour[0]!.cible).toBe("2");
    expect(a.planDeRetour[0]!.apres.chemin).toBe("Inbox");
    expect(a.parType.deplacer).toBe(2);
    expect(a.resume).toMatch(/2 geste\(s\) prêt\(s\)/);
  });

  it("une SUPPRESSION n'entre jamais dans un lot automatique", () => {
    const a = preparerLot([{ ...geste("1"), type: "supprimer", apres: {} }]);
    if ("erreur" in a) throw new Error(a.erreur);
    expect(a.gestes.length).toBe(0);
    expect(a.refuses[0]!.raison).toMatch(/décision, elle se demande une par une/);
  });

  it("une confiance basse va « à confirmer », pas à la poubelle ni à l'exécution", () => {
    const a = preparerLot([geste("1", 0.95), geste("2", 0.4)]);
    if ("erreur" in a) throw new Error(a.erreur);
    expect(a.gestes.map((g) => g.cible)).toEqual(["1"]);
    expect(a.aConfirmer.map((g) => g.cible)).toEqual(["2"]);
    expect(a.resume).toMatch(/1 à confirmer/);
  });

  it("un geste non annulable est refusé plutôt qu'exécuté", () => {
    const sansAvant: Geste = { cible: "x", type: "renommer", avant: {}, apres: { nom: "neuf.pdf" }, raison: "", confiance: 1, libelle: "renommer" };
    expect(estReversible(sansAvant)).toBe(false);
    const a = preparerLot([sansAvant]);
    if ("erreur" in a) throw new Error(a.erreur);
    expect(a.gestes.length).toBe(0);
    expect(a.refuses[0]!.raison).toMatch(/ne pourrait pas être annulé/);
    // Copier s'annule par une suppression de la copie.
    const copie: Geste = { cible: "y", type: "copier", avant: { chemin: "A" }, apres: { chemin: "B" }, raison: "", confiance: 1, libelle: "copier" };
    expect(inverser(copie).type).toBe("supprimer");
  });

  it("un échec PASSAGER est réessayé, un refus de droit ne l'est pas", () => {
    expect(estPassager("fichier verrouillé par un autre processus")).toBe(true);
    expect(estPassager("ETIMEDOUT")).toBe(true);
    expect(estPassager("droit refusé sur ce dossier")).toBe(false);
    expect(estPassager("fichier introuvable")).toBe(false);
  });

  it("le lot CONTINUE après un échec, et le compte final est arithmétique", async () => {
    const gestes = ["1", "2", "3", "4"].map((id) => geste(id));
    let appels = 0;
    const r = await executerLot(gestes, async (g) => {
      appels += 1;
      if (g.cible === "2") return { ok: false, erreur: "droit refusé" };
      return { ok: true, detail: "déplacé" };
    });
    expect(r.demandes).toBe(4);
    expect(r.faits).toBe(3);
    expect(r.echecs).toBe(1);
    expect(r.compteJuste).toBe(true);
    expect(r.faits + r.ignores + r.echecs).toBe(r.demandes);
    // Un refus de droit n'est PAS réessayé : un seul appel pour lui.
    expect(appels).toBe(4);
    expect(r.recus.find((x) => x.cible === "2")!.tentatives).toBe(1);
    expect(r.planDeRetour.length).toBe(3); // seulement ce qui a RÉUSSI
    expect(r.resume).toMatch(/3 fait\(s\).*1 échec/);
  });

  it("un échec passager est réessayé jusqu'à réussir", async () => {
    let essais = 0;
    const r = await executerLot([geste("1")], async () => {
      essais += 1;
      return essais < 3 ? { ok: false, erreur: "fichier verrouillé" } : { ok: true };
    }, { tentatives: 4 });
    expect(r.faits).toBe(1);
    expect(r.recus[0]!.tentatives).toBe(3);
  });

  it("LA REPRISE : un geste déjà fait n'est pas refait", async () => {
    const gestes = ["1", "2", "3"].map((id) => geste(id));
    const faire = vi.fn(async () => ({ ok: true as const }));
    const r = await executerLot(gestes, faire, { dejaFait: async (g) => g.cible === "1" || g.cible === "2" });
    expect(r.ignores).toBe(2);
    expect(r.faits).toBe(1);
    expect(faire).toHaveBeenCalledTimes(1);
    expect(r.recus[0]!.detail).toMatch(/déjà fait/);
    expect(r.compteJuste).toBe(true);
  });

  it("un budget de temps arrête le lot PROPREMENT, en disant où il en est", async () => {
    const gestes = Array.from({ length: 50 }, (_, i) => geste(String(i)));
    const r = await executerLot(gestes, async () => { await new Promise((res) => setTimeout(res, 12)); return { ok: true }; }, { msMax: 60 });
    expect(r.interrompu).toBe(true);
    expect(r.faits).toBeLessThan(50);
    expect(r.faits).toBeGreaterThan(0);
    expect(r.compteJuste).toBe(true);
    expect(r.resume).toMatch(/LOT INTERROMPU/);
    expect(r.resume).toMatch(/reprendra où il s'est arrêté/);
  });

  it("tient l'échelle : 12 000 gestes préparés et exécutés", async () => {
    const gestes = Array.from({ length: 12_000 }, (_, i) => geste(`f${i}`));
    const a = preparerLot(gestes);
    if ("erreur" in a) throw new Error(a.erreur);
    expect(a.gestes.length).toBe(12_000);
    expect(a.planDeRetour.length).toBe(12_000);
    const t0 = Date.now();
    const r = await executerLot(a.gestes, async () => ({ ok: true }));
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(r.faits).toBe(12_000);
    expect(r.compteJuste).toBe(true);
  });
});

describe("fichiers — ranger par le contenu, pas par le nom", () => {
  it("un scan sans nom parlant est classé par son CONTENU, avec l'indice citable", () => {
    const p = proposerClassement(
      F("1", "Scan_20260115_003.pdf", 200_000, { chemin: "Drive / Boîte de dépôt" }),
      "SARL KWALITY PHARMA\nFACTURE N° FA-2026-0142\nDate : 15/01/2026\nMontant TTC : 1 250 000,00 DZD\nTVA 19 %\nÉchéance : 15/02/2026",
    );
    expect(p.categorie).toBe("FACTURE");
    expect(p.confiance).toBeGreaterThan(0.85);
    expect(p.destination).toMatch(/Finances \/ Factures/);
    expect(p.destination).toContain("2026");
    expect(p.origine).toBe("Drive / Boîte de dépôt");
    expect(p.entites.reference).toBe("FA-2026-0142");
    expect(p.entites.montant).toBe("1 250 000,00");
    expect(p.indices.some((i) => /FACTURE N/.test(i.extrait))).toBe(true);
    expect(p.raison).toMatch(/FACTURE/);
  });

  it("SANS contenu lu, la confiance est PLAFONNÉE : ranger sur un nom met la facture dans les contrats", () => {
    const p = proposerClassement(F("1", "Contrat Sofradis 2026.pdf", 100, { chemin: "Inbox" }));
    expect(p.categorie).toBe("CONTRAT");
    expect(p.confiance).toBeLessThanOrEqual(0.65);
    expect(p.raison).toMatch(/NOM SEUL/);
    // Et donc le lot le met « à confirmer », pas en exécution.
    const a = preparerLot(gestesDeClassement([p]));
    if ("erreur" in a) throw new Error(a.erreur);
    expect(a.gestes.length).toBe(0);
    expect(a.aConfirmer.length).toBe(1);
  });

  it("une AMBIGUÏTÉ entre deux catégories baisse la confiance et nomme la concurrente", () => {
    const p = proposerClassement(
      F("1", "document.pdf", 100),
      "AVENANT N° 2 au contrat de prestation\nEntre les soussignés\nArticle 1 : durée du contrat\nFait à Alger, le 10/02/2026",
    );
    expect(["AVENANT", "CONTRAT"]).toContain(p.categorie);
    expect(p.concurrentes.length).toBeGreaterThan(0);
    expect(p.concurrentes.map((c) => c.categorie)).toContain(p.categorie === "AVENANT" ? "CONTRAT" : "AVENANT");
  });

  it("un document sans indice reste INCONNU et n'est pas rangé au hasard", () => {
    const p = proposerClassement(F("1", "notes.txt", 100), "quelques notes personnelles sans rien de particulier");
    expect(p.categorie).toBe("INCONNU");
    expect(p.confiance).toBe(0);
    expect(p.destination).toBe(p.origine);
    expect(gestesDeClassement([p])).toEqual([]);
  });

  it("les entités nomment le dossier, et un dossier réglementaire va au bon endroit", () => {
    const e = extraireEntites("dossier.pdf", "Produit : Trastuzex\nFournisseur : Sofradis International\nMontant 2 450 000 DZD\nAnnée 2026");
    expect(e.produit).toContain("Trastuzex");
    expect(e.tiers).toContain("Sofradis");
    expect(e.annee).toBe("2026");
    const p = proposerClassement(
      F("1", "envoi.pdf", 100),
      "Dossier d'enregistrement CTD Module 3\nAgence nationale des produits pharmaceutiques\nDemande d'AMM\nProduit : Trastuzex",
    );
    expect(p.categorie).toBe("DOSSIER_REGLEMENTAIRE");
    expect(p.destination).toMatch(/Regulatory \/ Dossiers/);
    expect(p.destination).toContain("Trastuzex");
    expect(p.confiance).toBeGreaterThan(0.8);
  });

  it("les gestes de classement portent l'ORIGINE, donc s'annulent", () => {
    const p = proposerClassement(F("7", "Scan.pdf", 100, { chemin: "Inbox" }), "FACTURE N° FA-2026-1\nMontant TTC 500 DZD\nÉchéance 01/03/2026\nTVA");
    const [g] = gestesDeClassement([p]);
    expect(g).toBeTruthy();
    expect(g!.cible).toBe("7");
    expect(g!.avant.chemin).toBe("Inbox");
    expect(estReversible(g!)).toBe(true);
    expect(inverser(g!).apres.chemin).toBe("Inbox");
  });
});
