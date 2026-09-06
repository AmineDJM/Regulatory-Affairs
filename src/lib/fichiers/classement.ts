/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * RANGER PAR LE CONTENU, PAS PAR LE NOM (mandat 5 §41) — pur.
 *
 * « Scan_20260115_003.pdf » ne dit rien. Son CONTENU dit tout : un numéro de facture, un
 * fournisseur, un montant, une date d'échéance. Le classement se fonde donc sur des INDICES
 * relevés dans le texte, chacun nommé, chacun pesé — et la proposition porte sa raison :
 * « Facture, parce que le document contient « FACTURE N° » et un montant TTC ».
 *
 * Trois règles qui tiennent tout :
 *   · Un indice se CITE. Une proposition dont on ne peut pas montrer la preuve dans le document
 *     est une supposition, et elle est marquée comme telle.
 *   · Une confiance basse ne se range pas toute seule. Elle se propose.
 *   · L'ancien emplacement est CONSERVÉ dans la proposition — sans lui, le retour est impossible,
 *     et un classement irréversible est un classement qu'on n'ose plus lancer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { Fichier } from "./doublons";
import type { Geste } from "./lot";

export type Categorie =
  | "FACTURE" | "DEVIS" | "BON_DE_COMMANDE" | "CONTRAT" | "AVENANT" | "COURRIER"
  | "DOSSIER_REGLEMENTAIRE" | "RAPPORT" | "PRESENTATION" | "TABLEUR" | "JUSTIFICATIF"
  | "RH" | "APPEL_OFFRES" | "INCONNU";

export interface Indice { motif: string; ou: "nom" | "contenu"; extrait: string; poids: number }

export interface Proposition {
  fichier: Fichier;
  categorie: Categorie;
  /** Le dossier proposé, en clair. */
  destination: string;
  /** L'emplacement ACTUEL — sans lui, aucun retour n'est possible. */
  origine: string;
  confiance: number;
  /** Les indices RELEVÉS, chacun citable dans le document. */
  indices: Indice[];
  raison: string;
  /** Les entités reconnues (fournisseur, référence, montant, date) — ce qui nomme le dossier. */
  entites: Record<string, string>;
  /** Les autres catégories plausibles, quand le choix n'est pas net. */
  concurrentes: { categorie: Categorie; confiance: number }[];
}

interface Regle { categorie: Categorie; motifs: { re: RegExp; poids: number; ou: "nom" | "contenu" }[]; dossier: (e: Record<string, string>) => string }

/** Les règles — chacune est une liste d'indices pesés, jamais un mot-clé unique. */
const REGLES: Regle[] = [
  {
    categorie: "FACTURE",
    motifs: [
      { re: /\bfacture\s*(n[°o]|num|#)/i, poids: 5, ou: "contenu" },
      { re: /\bfacture\b/i, poids: 2, ou: "nom" },
      { re: /\b(montant\s+)?t\.?t\.?c\.?\b/i, poids: 3, ou: "contenu" },
      { re: /\bt\.?v\.?a\.?\b/i, poids: 2, ou: "contenu" },
      { re: /\b(échéance|echeance|à\s+régler|a\s+regler|net\s+à\s+payer)\b/i, poids: 3, ou: "contenu" },
      { re: /\bFA[-_ ]?\d{3,}/i, poids: 4, ou: "nom" },
    ],
    dossier: (e) => `Finances / Factures${e.annee ? ` / ${e.annee}` : ""}${e.tiers ? ` / ${e.tiers}` : ""}`,
  },
  {
    categorie: "DEVIS",
    motifs: [
      { re: /\bdevis\s*(n[°o]|num|#)/i, poids: 5, ou: "contenu" },
      { re: /\bdevis\b/i, poids: 3, ou: "nom" },
      { re: /\b(valable|validité|validite)\s+(jusqu|\d+\s*jours)/i, poids: 3, ou: "contenu" },
      { re: /\bDEV[-_ ]?\d{3,}/i, poids: 4, ou: "nom" },
      { re: /\bproposition\s+(commerciale|de\s+prix)/i, poids: 3, ou: "contenu" },
    ],
    dossier: (e) => `Commercial / Devis${e.annee ? ` / ${e.annee}` : ""}`,
  },
  {
    categorie: "BON_DE_COMMANDE",
    motifs: [
      { re: /\bbon\s+de\s+commande\b/i, poids: 5, ou: "contenu" },
      { re: /\b(bon\s+de\s+commande|\bbc\b)/i, poids: 3, ou: "nom" },
      { re: /\bBC[-_ ]?\d{3,}/i, poids: 4, ou: "nom" },
      { re: /\bcommande\s*n[°o]/i, poids: 3, ou: "contenu" },
    ],
    dossier: (e) => `Achats / Bons de commande${e.annee ? ` / ${e.annee}` : ""}`,
  },
  {
    categorie: "CONTRAT",
    motifs: [
      { re: /\bentre\s+les\s+soussign/i, poids: 5, ou: "contenu" },
      { re: /\bcontrat\b/i, poids: 3, ou: "nom" },
      { re: /\b(article\s+\d+|clause\s+\d+)/i, poids: 2, ou: "contenu" },
      { re: /\b(durée|duree)\s+du\s+contrat\b/i, poids: 3, ou: "contenu" },
      { re: /\bfait\s+à\s+.{2,30},?\s+le\b/i, poids: 3, ou: "contenu" },
      { re: /\b(résiliation|resiliation|reconduction\s+tacite)\b/i, poids: 3, ou: "contenu" },
    ],
    dossier: (e) => `Legal / Contrats${e.tiers ? ` / ${e.tiers}` : ""}`,
  },
  {
    categorie: "AVENANT",
    motifs: [
      { re: /\bavenant\s*(n[°o]|\d)/i, poids: 6, ou: "contenu" },
      { re: /\bavenant\b/i, poids: 4, ou: "nom" },
      { re: /\bmodifie\s+le\s+contrat\b/i, poids: 4, ou: "contenu" },
    ],
    dossier: (e) => `Legal / Avenants${e.tiers ? ` / ${e.tiers}` : ""}`,
  },
  {
    categorie: "DOSSIER_REGLEMENTAIRE",
    motifs: [
      { re: /\b(anpp|agence\s+nationale\s+des\s+produits\s+pharmaceutiques)\b/i, poids: 5, ou: "contenu" },
      { re: /\b(ctd|module\s+[1-5]\b|dossier\s+d.enregistrement)/i, poids: 4, ou: "contenu" },
      { re: /\b(amm|autorisation\s+de\s+mise\s+sur\s+le\s+march)/i, poids: 4, ou: "contenu" },
      { re: /\b(dci|notice|rcp|résumé\s+des\s+caractéristiques)\b/i, poids: 2, ou: "contenu" },
      { re: /\b(reglementaire|réglementaire|regulatory|anpp)\b/i, poids: 3, ou: "nom" },
    ],
    dossier: (e) => `Regulatory / Dossiers${e.produit ? ` / ${e.produit}` : ""}`,
  },
  {
    categorie: "APPEL_OFFRES",
    motifs: [
      { re: /\b(appel\s+d.offres|cahier\s+des\s+charges|consultation\s+n[°o])/i, poids: 5, ou: "contenu" },
      { re: /\b(pch|appel\s+d.offres|ao\b)/i, poids: 3, ou: "nom" },
      { re: /\b(soumission|offre\s+technique|offre\s+financi)/i, poids: 3, ou: "contenu" },
    ],
    dossier: (e) => `PCH / Appels d'offres${e.annee ? ` / ${e.annee}` : ""}`,
  },
  {
    categorie: "RH",
    motifs: [
      { re: /\b(bulletin\s+de\s+paie|fiche\s+de\s+paie|net\s+à\s+payer|cotisations?\s+sociales)/i, poids: 5, ou: "contenu" },
      { re: /\b(contrat\s+de\s+travail|cdi\b|cdd\b|période\s+d.essai)/i, poids: 4, ou: "contenu" },
      { re: /\b(paie|salaire|conge|congé|rh)\b/i, poids: 3, ou: "nom" },
    ],
    dossier: () => "RH / Personnel",
  },
  {
    categorie: "COURRIER",
    motifs: [
      { re: /\b(objet\s*:|nos\s+r[ée]f|vos\s+r[ée]f)/i, poids: 3, ou: "contenu" },
      { re: /\b(veuillez\s+agréer|salutations\s+distinguées|cordialement)/i, poids: 4, ou: "contenu" },
      { re: /\b(courrier|lettre|ltr)\b/i, poids: 3, ou: "nom" },
    ],
    dossier: (e) => `Courrier${e.annee ? ` / ${e.annee}` : ""}`,
  },
];

/** Les entités qu'un document porte presque toujours — elles NOMMENT le dossier de destination. */
export function extraireEntites(nom: string, contenu: string): Record<string, string> {
  const e: Record<string, string> = {};
  const tout = `${nom}\n${contenu}`;
  const annee = /\b(20\d{2})\b/.exec(tout);
  if (annee) e.annee = annee[1]!;
  const ref = /\b((?:FA|DEV|BC|AO|CTR)[-_ ]?\d{3,}(?:[-_/]\d+)*)\b/i.exec(tout);
  if (ref) e.reference = ref[1]!.toUpperCase();
  const montant = /\b(\d{1,3}(?:[  .]\d{3})+(?:,\d{2})?)\s*(?:DZD|DA|€|EUR)\b/i.exec(tout);
  if (montant) e.montant = montant[1]!;
  // Le TIERS : ce qui suit « fournisseur », « client », « société », ou l'entête d'un courrier.
  // Deux exigences, apprises d'un faux positif : l'insensibilité à la CASSE (un document écrit
  // « Fournisseur : » avec une majuscule est le cas normal) et un SÉPARATEUR OBLIGATOIRE. Sans
  // lui, « Agence nationale des produits pharmaceutiques » livrait « s pharmaceutiques » comme
  // nom de produit — une entité inventée est pire qu'une entité absente.
  const tiers = /\b(?:fournisseur|client|soci[ée]t[ée]|laboratoire|partenaire)\s*[:=]\s*([A-ZÉÈÀÂÎÔÛ][\w'’.\- ]{2,40})/i.exec(contenu);
  if (tiers) e.tiers = tiers[1]!.trim().replace(/[.,;]$/, "");
  const produit = /\b(?:produits?|sp[ée]cialit[ée]|dci)\s*[:=]\s*([A-ZÉÈ][\w'’\- ]{2,30})/i.exec(contenu);
  if (produit) e.produit = produit[1]!.trim().replace(/[.,;]$/, "");
  return e;
}

export const CONFIANCE_MAX_SANS_CONTENU = 0.65;

/**
 * PROPOSE UN CLASSEMENT — jamais un déplacement.
 * Sans contenu lisible, la confiance est PLAFONNÉE : ranger sur la foi d'un nom de fichier est
 * exactement ce qui met une facture dans les contrats.
 */
export function proposerClassement(fichier: Fichier, contenu = ""): Proposition {
  const nom = fichier.nom;
  const texte = contenu.slice(0, 20_000);
  const scores: { regle: Regle; score: number; indices: Indice[] }[] = [];
  for (const regle of REGLES) {
    let score = 0;
    const indices: Indice[] = [];
    for (const m of regle.motifs) {
      const cible = m.ou === "nom" ? nom : texte;
      const trouve = m.re.exec(cible);
      if (!trouve) continue;
      score += m.poids;
      const pos = trouve.index;
      indices.push({
        motif: m.re.source.slice(0, 40),
        ou: m.ou,
        extrait: cible.slice(Math.max(0, pos - 25), pos + trouve[0].length + 25).replace(/\s+/g, " ").trim(),
        poids: m.poids,
      });
    }
    if (score > 0) scores.push({ regle, score, indices });
  }
  const entites = extraireEntites(nom, texte);
  scores.sort((a, b) => b.score - a.score);
  const origine = fichier.chemin ?? "(emplacement inconnu)";
  if (!scores.length) {
    return {
      fichier, categorie: "INCONNU", destination: origine, origine, confiance: 0, indices: [], entites,
      raison: texte ? "aucun indice de catégorie dans le nom ni dans le contenu lu" : "aucun indice dans le nom, et le contenu n'a pas été lu",
      concurrentes: [],
    };
  }
  const meilleur = scores[0]!;
  const second = scores[1];
  // La confiance : le score absolu ET l'écart avec le suivant. Deux catégories à égalité, ce
  // n'est pas « la première », c'est une AMBIGUÏTÉ.
  const brut = Math.min(1, meilleur.score / 10);
  const ecart = second ? Math.min(1, (meilleur.score - second.score) / Math.max(3, meilleur.score)) : 1;
  let confiance = brut * (0.55 + 0.45 * ecart);
  const indicesContenu = meilleur.indices.filter((i) => i.ou === "contenu").length;
  if (!texte || indicesContenu === 0) confiance = Math.min(confiance, CONFIANCE_MAX_SANS_CONTENU);
  return {
    fichier, categorie: meilleur.regle.categorie,
    destination: meilleur.regle.dossier(entites),
    origine,
    confiance: Math.round(confiance * 100) / 100,
    indices: meilleur.indices.sort((a, b) => b.poids - a.poids).slice(0, 5),
    entites,
    raison: `${meilleur.regle.categorie} : ${meilleur.indices.slice(0, 3).map((i) => `« ${i.extrait} » (${i.ou})`).join(", ")}`
      + (indicesContenu === 0 ? " — indices tirés du NOM SEUL, le contenu n'a rien confirmé" : "")
      + (second && second.score >= meilleur.score * 0.8 ? ` ; mais ${second.regle.categorie} est presque aussi plausible` : ""),
    concurrentes: scores.slice(1, 3).map((s) => ({ categorie: s.regle.categorie, confiance: Math.round(Math.min(1, s.score / 10) * 100) / 100 })),
  };
}

/** Transforme des propositions en GESTES de lot — avec l'origine, donc annulables. */
export function gestesDeClassement(propositions: readonly Proposition[]): Geste[] {
  return propositions
    .filter((p) => p.categorie !== "INCONNU" && p.destination !== p.origine)
    .map((p) => ({
      cible: p.fichier.id,
      type: "classer" as const,
      avant: { chemin: p.origine, categorie: null },
      apres: { chemin: p.destination, categorie: p.categorie },
      raison: p.raison,
      confiance: p.confiance,
      libelle: `classer « ${p.fichier.nom} » dans ${p.destination}`,
    }));
}
