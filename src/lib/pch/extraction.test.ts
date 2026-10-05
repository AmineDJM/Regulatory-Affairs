import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  BUDGET_CARACTERES, QUANTITE_MAX, UNITES_PAR_BOITE_MAX,
  decouperPourLecture, phraseCoupe, texteLu, entierLu, lireLignesExtraites, empreinteLigneExtraite,
  raisonDeGarder, planDeRemplacement, retirerDejaPresentes, ligneChangee, phraseDeLExtraction, phraseAucunProduit,
  phraseDocumentIlisible, phraseDeLecture, resumeAuditLecture,
  type BilanLecture, type EtatLigne, type LigneDuMarche, type LigneExtraite,
} from "@/lib/pch/extraction";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LIRE UN APPEL D'OFFRES — les règles pures (audit 360°, lot D1c — F2).
 *
 * La lecture d'avant coupait le texte à 24 000 caractères sans le dire, lisait « 1 200 » comme 0
 * et « 1.200 » comme 1, écrivait « [object Object] », et une seconde lecture doublait le tableau.
 * Chaque règle a son cas, et chaque cas peut tomber.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const ligne = (designation: string, extra: Partial<LigneExtraite> = {}): LigneExtraite => ({
  designation, dci: null, dosage: "500 mg", form: "comprimé", quantityUnits: 1000, unitsPerBox: null, unitLabel: "comprimé", ...extra,
});

const ETAT_VIERGE: EtatLigne = {
  modifieeLe: null, submissionSnapshot: null, status: "PENDING", note: null, unitPriceDzd: null, boxPriceDzd: null,
  boxCostDzd: null, awardedUnitPriceDzd: null, submittedQuantityUnits: null, awardedQuantityUnits: null, liens: 0,
};

let n = 0;
const duMarche = (designation: string, extra: Partial<LigneDuMarche> = {}): LigneDuMarche => ({
  ...ETAT_VIERGE, id: `l${++n}`, updatedAt: new Date(2026, 0, 1, 0, 0, n), extractionId: "x1", empreinteExtraction: null,
  designation, dosage: "500 mg", form: "comprimé", quantityUnits: 1000, ...extra,
});

describe("la coupe : dite, chiffrée, et jamais au milieu d'une ligne quand on peut l'éviter", () => {
  it("sous le budget : tout est lu, rien n'est coupé", () => {
    const t = "Paracétamol 500 mg — 1000\n".repeat(10);
    expect(decouperPourLecture(t)).toEqual({ lu: t, total: t.length, coupe: false });
  });

  it("au-delà : la coupe tombe sur la dernière fin de ligne du dernier cinquième — pas au milieu d'un lot", () => {
    const ligneLot = "Produit X 500 mg — quantité 12000\n"; // 34 caractères
    const t = ligneLot.repeat(100);
    const d = decouperPourLecture(t, 1000);
    expect(d.coupe).toBe(true);
    expect(d.total).toBe(t.length);
    expect(d.lu.length).toBeLessThanOrEqual(1000);
    expect(d.lu.length).toBeGreaterThanOrEqual(800);
    // Le texte lu se termine par un lot ENTIER (la coupe est sur une fin de ligne).
    expect(d.lu.endsWith("quantité 12000")).toBe(true);
  });

  it("sans fin de ligne proche, on coupe au budget — on ne remonte pas à mi-document", () => {
    const t = `${"a".repeat(500)}\n${"b".repeat(2000)}`;
    const d = decouperPourLecture(t, 1000);
    expect(d).toEqual({ lu: t.slice(0, 1000), total: t.length, coupe: true });
  });

  it("le budget par défaut est celui qu'annonce la phrase", () => {
    const d = decouperPourLecture("x".repeat(BUDGET_CARACTERES + 10));
    expect(d.lu.length).toBe(BUDGET_CARACTERES);
  });

  it("la phrase de la coupe : les deux nombres, ce qu'elle coûte, et le geste qui la lève ; rien sans coupe", () => {
    expect(phraseCoupe(1000, 1000)).toBeNull();
    const p = phraseCoupe(60_000, 24_000)!;
    expect(p).toContain((24_000).toLocaleString("fr-FR"));
    expect(p).toContain((60_000).toLocaleString("fr-FR"));
    expect(p).toContain("(40 %)");
    expect(p).toContain("leur absence ici ne prouve rien");
    expect(p).toContain("« complète les lectures précédentes »");
  });
});

describe("la réponse du modèle, LUE — jamais crue sur parole", () => {
  it("un entier : « 1 200 » se lit (espace, insécable, fine insécable) ; « 1.200 », « 1,200 », un décimal, un négatif, un mot, un géant ne se lisent pas", () => {
    expect(entierLu(1200, QUANTITE_MAX)).toBe(1200);
    expect(entierLu("1200", QUANTITE_MAX)).toBe(1200);
    for (const sep of [" ", " ", " "]) expect(entierLu(`1${sep}200`, QUANTITE_MAX)).toBe(1200);
    expect(entierLu("12 000 000", QUANTITE_MAX)).toBe(12_000_000);
    for (const v of ["1.200", "1,200", 1.2, -5, "-5", "12 boîtes", 3e9, "3000000000", { n: 1 }, true]) {
      expect(entierLu(v, QUANTITE_MAX), String(v)).toBe("illisible");
    }
    for (const v of [null, undefined, "", "   "]) expect(entierLu(v, QUANTITE_MAX)).toBeNull();
    expect(entierLu(UNITES_PAR_BOITE_MAX + 1, UNITES_PAR_BOITE_MAX)).toBe("illisible");
  });

  it("un texte : une chaîne ou un nombre — jamais « [object Object] »", () => {
    expect(texteLu("  Amoxicilline ")).toBe("Amoxicilline");
    expect(texteLu(500)).toBe("500");
    expect(texteLu({ nom: "x" })).toBe("");
    expect(texteLu(["a"])).toBe("");
    expect(texteLu(Number.NaN)).toBe("");
  });

  it("`lines` qui n'est pas une liste : rien ne se lit (et rien ne s'écrira)", () => {
    expect(lireLignesExtraites({ lines: "Paracétamol" })).toBeNull();
    expect(lireLignesExtraites({ produits: [] })).toBeNull();
    expect(lireLignesExtraites([{ designation: "x" }])).toBeNull();
    expect(lireLignesExtraites("texte")).toBeNull();
    expect(lireLignesExtraites(null)).toBeNull();
  });

  it("une ligne sans désignation lisible est ÉCARTÉE et comptée ; une quantité illisible reste à 0 et est comptée", () => {
    const lu = lireLignesExtraites({ lines: [
      { designation: "Amoxicilline 1 g", dci: { x: 1 }, dosage: "1 g", form: "injectable", quantityUnits: "1 200", unitsPerBox: 0, unitLabel: "Flacon" },
      { designation: "", quantityUnits: 5 },
      { designation: { nom: "x" }, quantityUnits: 5 },
      "pas un objet",
      { designation: "Ceftriaxone", quantityUnits: "1.200", unitsPerBox: "10" },
      { designation: "Héparine", quantityUnits: -5 },
    ] })!;
    expect(lu.ecartees).toBe(3);
    expect(lu.sansQuantite).toBe(2);
    expect(lu.lignes).toEqual([
      { designation: "Amoxicilline 1 g", dci: null, dosage: "1 g", form: "injectable", quantityUnits: 1200, unitsPerBox: null, unitLabel: "flacon" },
      { designation: "Ceftriaxone", dci: null, dosage: null, form: null, quantityUnits: 0, unitsPerBox: 10, unitLabel: null },
      { designation: "Héparine", dci: null, dosage: null, form: null, quantityUnits: 0, unitsPerBox: null, unitLabel: null },
    ]);
  });
});

describe("l'identité d'un lot, d'une lecture à l'autre", () => {
  it("accents, casse, espaces et ponctuation sont pliés ; la quantité distingue", () => {
    const a = empreinteLigneExtraite({ designation: "Paracétamol  500 mg", dosage: "500 mg", form: "Comprimé", quantityUnits: 1000 });
    const b = empreinteLigneExtraite({ designation: "PARACETAMOL 500MG", dosage: "500mg", form: "comprime", quantityUnits: 1000 });
    const c = empreinteLigneExtraite({ designation: "Paracétamol 500 mg", dosage: "500 mg", form: "Comprimé", quantityUnits: 2000 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("ce qui est déjà au tableau ne se recrée pas — compté en MULTI-ensemble", () => {
    const x = ligne("Produit X");
    const r = retirerDejaPresentes([x, x, ligne("Produit Y")], [empreinteLigneExtraite(x)]);
    expect(r.dejaPresentes).toBe(1);
    expect(r.aCreer.map((l) => l.designation)).toEqual(["Produit X", "Produit Y"]);
  });
});

describe("ce qui soustrait une ligne lue à la lecture suivante", () => {
  it("chaque raison, SEULE, garde la ligne ; aucune → la ligne se remplace", () => {
    expect(raisonDeGarder(ETAT_VIERGE)).toBeNull();
    const cas: [Partial<EtatLigne>, string][] = [
      [{ modifieeLe: new Date() }, "MODIFIEE"],
      [{ submissionSnapshot: { prix: 1 } }, "SOUMISE"],
      [{ unitPriceDzd: new Prisma.Decimal("10.5") }, "CHIFFREE"],
      [{ boxPriceDzd: 0 }, "CHIFFREE"],
      [{ boxCostDzd: 12 }, "CHIFFREE"],
      [{ awardedUnitPriceDzd: 3 }, "CHIFFREE"],
      [{ submittedQuantityUnits: 0 }, "CHIFFREE"],
      [{ awardedQuantityUnits: 10 }, "CHIFFREE"],
      [{ status: "WON" }, "STATUT"],
      [{ note: "à vérifier" }, "NOTEE"],
      [{ liens: 1 }, "LIEE"],
    ];
    for (const [patch, attendu] of cas) expect(raisonDeGarder({ ...ETAT_VIERGE, ...patch }), JSON.stringify(patch)).toBe(attendu);
    // Une note faite d'espaces n'est pas une note.
    expect(raisonDeGarder({ ...ETAT_VIERGE, note: "   " })).toBeNull();
  });
});

describe("le remplacement : seulement ce que personne n'a touché", () => {
  it("remplace les lignes lues intactes, garde les autres raison par raison, et ne touche JAMAIS une ligne saisie à la main", () => {
    const intacte = duMarche("Produit A");
    const corrigee = duMarche("Produit B", { modifieeLe: new Date() });
    const manuelle = duMarche("Produit C", { extractionId: null });
    const plan = planDeRemplacement([intacte, corrigee, manuelle], [ligne("Produit A"), ligne("Produit D")], { complementaire: false });
    expect(plan.aSupprimer).toEqual([{ id: intacte.id, updatedAt: intacte.updatedAt }]);
    expect(plan.gardees).toEqual(["MODIFIEE"]);
    expect(plan.horsExtraction).toBe(1);
    // A est remplacée (supprimée, et recréée par la lecture) ; D est neuve.
    expect(plan.aCreer.map((l) => l.designation)).toEqual(["Produit A", "Produit D"]);
    expect(plan.dejaPresentes).toBe(0);
  });

  it("une ligne CORRIGÉE reconnaît sa relecture par ce que la lecture avait lu — le produit n'est pas recréé à côté", () => {
    const lu = ligne("Produit Q", { quantityUnits: 1200 });
    // La personne a corrigé la quantité (1 200 → 12 000) : la ligne ne ressemble plus à ce que le document dit…
    const corrigee = duMarche("Produit Q", { quantityUnits: 12_000, modifieeLe: new Date(), empreinteExtraction: empreinteLigneExtraite(lu) });
    const plan = planDeRemplacement([corrigee], [lu], { complementaire: false });
    expect(plan.aCreer).toEqual([]);
    expect(plan.dejaPresentes).toBe(1);
    expect(plan.gardees).toEqual(["MODIFIEE"]);
  });

  it("un document COMPLÉMENTAIRE ne remplace rien, et ne recrée pas ce qui est déjà là", () => {
    const a = duMarche("Produit A");
    const plan = planDeRemplacement([a], [ligne("Produit A"), ligne("Produit E")], { complementaire: true });
    expect(plan.aSupprimer).toEqual([]);
    expect(plan.dejaPresentes).toBe(1);
    expect(plan.aCreer.map((l) => l.designation)).toEqual(["Produit E"]);
  });
});

describe("une personne a-t-elle changé quelque chose ?", () => {
  const avant = {
    designation: "Produit A", dci: null, quantityUnits: 1000, haveProduct: false,
    boxPriceDzd: new Prisma.Decimal("1000.00"), unitPriceDzd: new Prisma.Decimal("33.33"), note: null,
  };
  it("repasser sur la ligne sans rien changer n'est pas un changement — Decimal contre nombre, vide contre absent, champ non porté", () => {
    expect(ligneChangee(avant, { designation: "Produit A", dci: null, quantityUnits: 1000, haveProduct: false, boxPriceDzd: 1000, unitPriceDzd: 33.3333, note: null })).toBe(false);
    expect(ligneChangee(avant, { designation: undefined, dci: "", note: "  " })).toBe(false);
  });
  it("une vraie différence en est une — texte, nombre au centime, case", () => {
    expect(ligneChangee(avant, { designation: "Produit A2" })).toBe(true);
    expect(ligneChangee(avant, { quantityUnits: 1200 })).toBe(true);
    expect(ligneChangee(avant, { boxPriceDzd: 1000.01 })).toBe(true);
    expect(ligneChangee(avant, { haveProduct: true })).toBe(true);
    expect(ligneChangee(avant, { dci: "Amoxicilline" })).toBe(true);
  });
});

describe("les phrases disent ce qui a été fait — et ce qui ne l'a pas été", () => {
  const bilan = (extra: Partial<BilanLecture> = {}): BilanLecture => ({
    source: "document", nomFichier: "AO-2026.pdf", methode: "texte", ocrTente: false, ocrEchoue: false, confiance: null,
    aRelire: false, pagesLues: null, pagesTotal: null, caracteres: 10_000, caracteresLus: 10_000, produitsLus: 34,
    ecartees: 0, sansQuantite: 0, complementaire: false, creees: 4, dejaPresentes: 30, remplacees: 12, gardees: [],
    restees: 0, horsExtraction: 0, fichier: "GARDE", enrichies: 0, ...extra,
  });

  it("le résultat, la méthode, le fichier — et rien de ce qui n'a pas eu lieu", () => {
    const p = phraseDeLExtraction(bilan());
    expect(p).toContain("Lecture de « AO-2026.pdf » : 34 produits lus.");
    expect(p).toContain("Texte natif du fichier : aucun OCR.");
    expect(p).toContain("4 ajoutés, 12 lignes de lectures précédentes remplacées et 30 déjà au tableau (non recréés).");
    expect(p).toContain("Le fichier est gardé dans les documents du marché.");
    expect(p).not.toContain("conservée");
    expect(p).not.toContain("saisie");
    expect(p).not.toContain("premiers caractères");
  });

  it("l'OCR partiel, la coupe, les lignes gardées par raison, celles d'avant le suivi, les écartées, les quantités à compléter", () => {
    const p = phraseDeLExtraction(bilan({
      methode: "ocr", ocrTente: true, confiance: 78, aRelire: true, pagesLues: 40, pagesTotal: 63,
      caracteres: 60_000, caracteresLus: 24_000, gardees: ["MODIFIEE", "CHIFFREE", "MODIFIEE"], restees: 1,
      horsExtraction: 2, ecartees: 3, sansQuantite: 5, fichier: "SANS_DROIT",
    }));
    expect(p).toContain("Lu par OCR : 40 pages sur 63, confiance 78 % — des pages sont à relire.");
    expect(p).toContain("Les pages au-delà n'ont pas été lues : leur absence ici ne prouve rien.");
    expect(p).toContain(phraseCoupe(60_000, 24_000)!);
    expect(p).toContain("3 lignes de lectures précédentes conservées : 2 modifiées à la main et 1 chiffrée.");
    expect(p).toContain("1 ligne modifiée pendant la lecture est restée.");
    expect(p).toContain("2 lignes saisies à la main ou d'avant le suivi des lectures restent telles quelles");
    expect(p).toContain("3 lignes rendues sans désignation lisible ont été écartées.");
    expect(p).toContain("5 produits sans quantité lisible : la quantité est restée à 0, à compléter.");
    expect(p).toContain("déposer un document sur le marché demande le droit d'y téléverser");
  });

  it("un complément le dit, et ne parle ni de remplacement ni des lignes d'avant le suivi", () => {
    const p = phraseDeLExtraction(bilan({ complementaire: true, remplacees: 0, horsExtraction: 3, source: "texte", nomFichier: null, fichier: null }));
    expect(p).toContain("Lecture du texte collé");
    expect(p).toContain("rien n'a été remplacé (document complémentaire)");
    expect(p).not.toContain("remplacée");
    expect(p).not.toContain("saisie");
    expect(p).not.toContain("OCR");
  });

  it("l'OCR qui échoue et l'OCR qui ne rend pas plus : deux phrases, deux gestes", () => {
    expect(phraseDeLExtraction(bilan({ ocrTente: true, ocrEchoue: true }))).toContain("L'OCR n'a pas abouti : seul le texte natif du fichier a été lu.");
    expect(phraseDeLExtraction(bilan({ ocrTente: true }))).toContain("L'OCR n'a pas rendu plus de texte que le fichier : le texte natif a été gardé.");
    expect(phraseDocumentIlisible({ ocrTente: true, ocrEchoue: false })).toContain("même par OCR");
    expect(phraseDocumentIlisible({ ocrTente: true, ocrEchoue: true })).toContain("l'OCR n'a pas abouti");
  });

  it("aucun produit : rien n'est écrit, et l'on dit ce qui a été écarté et ce qui n'a pas été lu", () => {
    const p = phraseAucunProduit(2, { lu: "x".repeat(100), total: 500, coupe: true });
    expect(p).toContain("rien n'a été écrit au tableau du marché");
    expect(p).toContain("2 lignes rendues sans désignation lisible ont été écartées.");
    expect(p).toContain("Seuls les 100 premiers caractères sur 500 ont été analysés.");
  });

  it("l'historique et la liste des lectures disent la coupe et ce qu'il en reste", () => {
    expect(resumeAuditLecture(bilan({ caracteres: 60_000, caracteresLus: 24_000 }))).toContain("24000/60000 caractères lus");
    const l = phraseDeLecture({
      quand: "04 oct. 2026", parQui: "Gestion PCH", source: "document", nomFichier: "AO.pdf", fichierGarde: true, methode: "ocr",
      confiance: 80, aRelire: true, pagesLues: 40, pagesTotal: 63, caracteres: 60_000, caracteresLus: 24_000, produits: 34, restantes: 30, complementaire: true,
    });
    expect(l).toContain("fichier « AO.pdf » (gardé dans les documents)");
    expect(l).toContain("OCR 40/63 pages, confiance 80 %");
    expect(l).toContain("34 produits lus, 30 encore au tableau");
    expect(l).toContain("caractères analysés sur");
    expect(l).toContain("complément");
    expect(l).toContain("à relire");
  });
});
