/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LIRE UN APPEL D'OFFRES — les règles PURES de la lecture (audit 360°, lot D1c — F2).
 *
 * Module PUR, zéro import : l'action, l'écrivain de la lecture (`lecture-ao.ts`), le chargeur de l'écran
 * (`queries/pch.ts`) et les bancs lisent la même règle — deux copies de « qu'est-ce qu'une ligne que
 * personne n'a touchée ? » finiraient par répondre différemment, et le symptôme serait une ligne corrigée
 * à la main effacée par une relecture (§118.5).
 *
 * ── CE QUE LA LECTURE D'AVANT FAISAIT, MESURÉ ────────────────────────────────────────────
 *
 *  • elle océrisait même un PDF qui porte son texte — et Mistral, pour un PDF, lit (et facture) TOUTES
 *    les pages, quel que soit le plafond demandé ;
 *  • elle coupait le texte à 24 000 caractères SANS LE DIRE, au milieu d'une ligne : un bordereau de
 *    60 000 caractères sortait « analysé » avec ses deux tiers ignorés, et l'absence d'un lot se lisait
 *    comme son absence du marché (§118.60) ;
 *  • une seconde lecture AJOUTAIT ses lignes aux précédentes : chaque relecture doublait le tableau ;
 *  • « 1 200 » devenait 0, « 1.200 » devenait 1, un objet devenait « [object Object] », une quantité
 *    trop grande pour la colonne faisait tout perdre, une désignation vide disparaissait sans un mot.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce que le modèle reçoit au plus, en caractères — une limite OPÉRATIONNELLE (le coût d'un appel), DITE quand elle coupe. */
export const BUDGET_CARACTERES = 24_000;
/** Une quantité au-delà ne tient pas dans la colonne (entier 32 bits) : elle est illisible, pas tronquée. */
export const QUANTITE_MAX = 2_000_000_000;
/** Un conditionnement au-delà n'est pas une boîte : illisible. */
export const UNITES_PAR_BOITE_MAX = 100_000;

export interface DecoupeLecture {
  /** Le texte que le modèle LIT. */
  lu: string;
  /** La longueur du texte entier. */
  total: number;
  coupe: boolean;
}

/**
 * LE TEXTE QUE LE MODÈLE LIRA. Au-delà du budget, on coupe sur une FIN DE LIGNE quand il y en a une dans le
 * dernier cinquième : un lot coupé au milieu (« Paracétamol 500 mg — 12 ») ferait extraire une quantité
 * fausse, avec l'assurance d'une ligne complète. Sans fin de ligne proche, on coupe au budget.
 */
export function decouperPourLecture(texte: string, budget = BUDGET_CARACTERES): DecoupeLecture {
  if (texte.length <= budget) return { lu: texte, total: texte.length, coupe: false };
  const brut = texte.slice(0, budget);
  const fin = brut.lastIndexOf("\n");
  return { lu: fin >= Math.floor(budget * 0.8) ? brut.slice(0, fin) : brut, total: texte.length, coupe: true };
}

const nombre = (n: number): string => n.toLocaleString("fr-FR");
const s = (n: number): string => (n > 1 ? "s" : "");
const majuscule = (t: string): string => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const listeFr = (mots: string[]): string =>
  mots.length <= 1 ? (mots[0] ?? "") : `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;

/** La coupe, DITE — ce qu'elle coûte, et le geste qui la lève (§118.60, §118.30). `null` sans coupe. */
export function phraseCoupe(caracteres: number, caracteresLus: number): string | null {
  if (caracteresLus >= caracteres) return null;
  const pct = Math.max(1, Math.floor((caracteresLus / caracteres) * 100));
  return `Seuls les ${nombre(caracteresLus)} premiers caractères sur ${nombre(caracteres)} (${pct} %) ont été analysés : les produits listés au-delà n'ont pas été extraits — leur absence ici ne prouve rien. Collez la suite du texte en cochant « complète les lectures précédentes ».`;
}

/** Un texte de la réponse du modèle : une chaîne ou un nombre — jamais « [object Object] ». */
export function texteLu(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/**
 * UN ENTIER POSITIF de la réponse : `null` quand rien n'est dit, « illisible » quand ce qui est dit ne se lit
 * pas À COUP SÛR. « 1 200 » (espace ordinaire, insécable ou fine insécable) se lit ; « 1.200 » et « 1,200 » ne se
 * tranchent pas — mille deux cents ici, un virgule deux ailleurs : on ne choisit pas la lecture à la place d'un
 * humain (§118.34). Un nombre décimal, négatif, ou trop grand pour la colonne est illisible.
 */
export function entierLu(v: unknown, max: number): number | null | "illisible" {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 && v <= max ? v : "illisible";
  if (typeof v !== "string") return "illisible";
  const brut = v.trim();
  if (brut === "") return null;
  if (!/^\d+$/.test(brut) && !/^\d{1,3}(?:[   ]\d{3})+$/.test(brut)) return "illisible";
  const n = Number(brut.replace(/[   ]/g, ""));
  return n <= max ? n : "illisible";
}

export interface LigneExtraite {
  designation: string;
  dci: string | null;
  dosage: string | null;
  form: string | null;
  quantityUnits: number;
  unitsPerBox: number | null;
  unitLabel: string | null;
}

export interface LignesLues {
  lignes: LigneExtraite[];
  /** Les lignes rendues sans désignation lisible — ÉCARTÉES, et comptées. */
  ecartees: number;
  /** Les produits gardés dont la quantité est inconnue (0 : rien de dit, ou illisible). */
  sansQuantite: number;
}

/**
 * LA RÉPONSE DU MODÈLE, LUE. `null` quand `lines` n'est pas une liste : rien ne s'écrit. Une ligne sans
 * désignation lisible est ÉCARTÉE et COMPTÉE ; une quantité illisible reste à 0 (« inconnue », le défaut que le
 * prompt demande au modèle) et est COMPTÉE — la phrase le dit, la personne complète.
 */
export function lireLignesExtraites(brut: unknown): LignesLues | null {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const lines = (brut as { lines?: unknown }).lines;
  if (!Array.isArray(lines)) return null;
  const lignes: LigneExtraite[] = [];
  let ecartees = 0;
  let sansQuantite = 0;
  for (const l of lines) {
    if (!l || typeof l !== "object" || Array.isArray(l)) { ecartees++; continue; }
    const x = l as Record<string, unknown>;
    const designation = texteLu(x.designation);
    if (!designation) { ecartees++; continue; }
    const q = entierLu(x.quantityUnits, QUANTITE_MAX);
    const quantityUnits = typeof q === "number" ? q : 0;
    if (quantityUnits === 0) sansQuantite++;
    const u = entierLu(x.unitsPerBox, UNITES_PAR_BOITE_MAX);
    lignes.push({
      designation,
      dci: texteLu(x.dci) || null,
      dosage: texteLu(x.dosage) || null,
      form: texteLu(x.form) || null,
      quantityUnits,
      unitsPerBox: typeof u === "number" && u > 0 ? u : null,
      unitLabel: texteLu(x.unitLabel).toLowerCase() || null,
    });
  }
  return { lignes, ecartees, sansQuantite };
}

const plier = (t: string | null): string =>
  (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * L'IDENTITÉ D'UN LOT, pour reconnaître le même produit d'une lecture à l'autre : désignation, dosage, forme et
 * quantité — ce que l'enrichissement n'écrit JAMAIS (il complète la DCI et le conditionnement : les compter ferait
 * d'un lot enrichi un lot « différent »). Accents, casse, espaces et ponctuation pliés : « 500mg » est « 500 mg ».
 */
export function empreinteLigneExtraite(l: { designation: string; dosage: string | null; form: string | null; quantityUnits: number }): string {
  return [plier(l.designation), plier(l.dosage), plier(l.form), String(l.quantityUnits)].join("|");
}

export type RaisonDeGarder = "MODIFIEE" | "SOUMISE" | "CHIFFREE" | "STATUT" | "NOTEE" | "LIEE";

/** Le mot de chaque raison, au singulier et au pluriel — l'ordre est celui de la phrase. */
export const LIBELLE_RAISON: Record<RaisonDeGarder, [string, string]> = {
  MODIFIEE: ["modifiée à la main", "modifiées à la main"],
  SOUMISE: ["figée par une soumission", "figées par une soumission"],
  CHIFFREE: ["chiffrée", "chiffrées"],
  STATUT: ["au statut tranché", "au statut tranché"],
  NOTEE: ["annotée", "annotées"],
  LIEE: ["rattachée (BU, contrat, bon, vente)", "rattachées (BU, contrat, bon, vente)"],
};
const ORDRE_RAISONS: RaisonDeGarder[] = ["MODIFIEE", "SOUMISE", "CHIFFREE", "STATUT", "NOTEE", "LIEE"];

/** Ce que la lecture regarde d'une ligne pour savoir si quelqu'un y a mis du sien. */
export interface EtatLigne {
  modifieeLe: Date | null;
  submissionSnapshot: unknown;
  status: string;
  note: string | null;
  unitPriceDzd: unknown;
  boxPriceDzd: unknown;
  boxCostDzd: unknown;
  awardedUnitPriceDzd: unknown;
  submittedQuantityUnits: number | null;
  awardedQuantityUnits: number | null;
  /** Affectations à une BU, lignes de contrat, lignes de bon, ventes, affectations Ad & Pro, bons hérités. */
  liens: number;
}

/**
 * CE QUI SOUSTRAIT UNE LIGNE LUE À LA LECTURE SUIVANTE : une main posée dessus (`modifieeLe`), une soumission
 * figée, un chiffre, un statut tranché, une note, un lien vers ce qui en découle. Seuls les champs qu'une
 * PERSONNE écrit comptent — le prix de référence, la nomenclature, « nous l'avons », les fournisseurs sont aussi
 * écrits par l'enrichissement : les compter soustrairait chaque ligne enrichie à toute relecture. Une main qui
 * les touche pose `modifieeLe`. L'ordre ne décide que du MOT de la phrase.
 */
export function raisonDeGarder(l: EtatLigne): RaisonDeGarder | null {
  if (l.modifieeLe) return "MODIFIEE";
  if (l.submissionSnapshot !== null && l.submissionSnapshot !== undefined) return "SOUMISE";
  if ([l.unitPriceDzd, l.boxPriceDzd, l.boxCostDzd, l.awardedUnitPriceDzd, l.submittedQuantityUnits, l.awardedQuantityUnits].some((v) => v !== null && v !== undefined)) return "CHIFFREE";
  if (l.status !== "PENDING") return "STATUT";
  if ((l.note ?? "").trim()) return "NOTEE";
  if (l.liens > 0) return "LIEE";
  return null;
}

export interface LigneDuMarche extends EtatLigne {
  id: string;
  updatedAt: Date;
  extractionId: string | null;
  empreinteExtraction: string | null;
  designation: string;
  dosage: string | null;
  form: string | null;
  quantityUnits: number;
}

export interface PlanRemplacement {
  /** Les lignes de lectures précédentes que personne n'a touchées — supprimées SI leur `updatedAt` n'a pas bougé. */
  aSupprimer: { id: string; updatedAt: Date }[];
  /** Les lignes de lectures précédentes conservées, par raison. */
  gardees: RaisonDeGarder[];
  aCreer: LigneExtraite[];
  /** Les produits lus déjà présents au tableau — non recréés. */
  dejaPresentes: number;
  /** Les lignes saisies à la main ou nées avant le suivi des lectures — jamais remplacées. */
  horsExtraction: number;
}

/** L'empreinte qui RECONNAÎT une ligne : ce que la lecture avait lu, pas ce qu'une personne a corrigé depuis. */
const empreinteDe = (l: LigneDuMarche): string => l.empreinteExtraction ?? empreinteLigneExtraite(l);

/**
 * CE QUI EST DÉJÀ AU TABLEAU NE SE RECRÉE PAS — compté en MULTI-ENSEMBLE : deux lots identiques au document et un
 * seul au tableau, un seul est ajouté.
 */
export function retirerDejaPresentes(nouvelles: readonly LigneExtraite[], empreintes: readonly string[]): { aCreer: LigneExtraite[]; dejaPresentes: number } {
  const reste = new Map<string, number>();
  for (const e of empreintes) reste.set(e, (reste.get(e) ?? 0) + 1);
  const aCreer: LigneExtraite[] = [];
  let dejaPresentes = 0;
  for (const n of nouvelles) {
    const e = empreinteLigneExtraite(n);
    const k = reste.get(e) ?? 0;
    if (k > 0) { reste.set(e, k - 1); dejaPresentes++; } else aCreer.push(n);
  }
  return { aCreer, dejaPresentes };
}

/**
 * LE REMPLACEMENT. Une lecture remplace les lignes des lectures précédentes que PERSONNE n'a touchées — et
 * seulement elles. Une ligne saisie à la main, ou née avant que les lectures soient tracées, n'est JAMAIS
 * remplacée : rien ne dit que personne ne l'a touchée. Un document « complémentaire » ne remplace rien.
 */
export function planDeRemplacement(
  existantes: readonly LigneDuMarche[],
  nouvelles: readonly LigneExtraite[],
  opts: { complementaire: boolean },
): PlanRemplacement {
  const aSupprimer: PlanRemplacement["aSupprimer"] = [];
  const gardees: RaisonDeGarder[] = [];
  const restent: string[] = [];
  let horsExtraction = 0;
  for (const l of existantes) {
    if (l.extractionId === null) { horsExtraction++; restent.push(empreinteDe(l)); continue; }
    if (opts.complementaire) { restent.push(empreinteDe(l)); continue; }
    const raison = raisonDeGarder(l);
    if (raison) { gardees.push(raison); restent.push(empreinteDe(l)); continue; }
    aSupprimer.push({ id: l.id, updatedAt: l.updatedAt });
  }
  return { aSupprimer, gardees, horsExtraction, ...retirerDejaPresentes(nouvelles, restent) };
}

/** La valeur d'un champ, ramenée à ce qui se compare : un Decimal de Prisma est un nombre, un texte vide une absence. */
function valeurComparee(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean" || typeof v === "number") return v;
  if (typeof v === "string") return v.trim() === "" ? null : v.trim();
  const n = Number(String(v));
  return Number.isFinite(n) ? n : String(v);
}

/**
 * UNE PERSONNE A-T-ELLE CHANGÉ QUELQUE CHOSE ? L'écran d'une ligne enregistre à chaque sortie de champ, même sans
 * rien changer : seule une VRAIE différence compte. Un champ que la demande ne porte pas (`undefined`) n'en est pas
 * une ; un montant se compare au centime.
 */
export function ligneChangee(avant: Record<string, unknown>, apres: Record<string, unknown>): boolean {
  return Object.entries(apres).some(([cle, v]) => {
    if (v === undefined) return false;
    const a = valeurComparee(avant[cle]);
    const b = valeurComparee(v);
    return typeof a === "number" && typeof b === "number" ? Math.abs(a - b) >= 0.005 : a !== b;
  });
}

// ─────────────────────────────── Les phrases ───────────────────────────────

export const REPONSE_INEXPLOITABLE =
  "Réponse de l'IA non exploitable : rien n'a été écrit au tableau du marché. Relancez la lecture, ou collez le texte par parties.";

export const LECTURE_NON_ECRITE =
  "Les lignes n'ont pas pu être écrites : rien n'a changé au tableau du marché. Relancez la lecture.";

/** Aucun produit rendu : rien ne s'écrit — et l'on dit ce qui a été écarté, et ce qui n'a pas été lu. */
export function phraseAucunProduit(ecartees: number, coupe: DecoupeLecture): string {
  return [
    "Aucun produit détecté dans le document : rien n'a été écrit au tableau du marché.",
    ...(ecartees > 0 ? [`${ecartees} ligne${s(ecartees)} rendue${s(ecartees)} sans désignation lisible ${ecartees > 1 ? "ont été écartées" : "a été écartée"}.`] : []),
    ...(coupe.coupe ? [`Seuls les ${nombre(coupe.lu.length)} premiers caractères sur ${nombre(coupe.total)} ont été analysés.`] : []),
  ].join(" ");
}

/** Le document ne porte pas de texte : on dit si l'OCR a échoué ou n'a rien trouvé — deux gestes différents. */
export function phraseDocumentIlisible(l: { ocrTente: boolean; ocrEchoue: boolean }): string {
  if (l.ocrTente && !l.ocrEchoue) {
    return "Le document ne porte pas de texte lisible, même par OCR : vérifiez qu'il s'agit bien de l'appel d'offres, ou collez son texte.";
  }
  return "Le document ne porte pas de texte lisible, et l'OCR n'a pas abouti : réessayez, ou collez le texte de l'appel d'offres.";
}

/** Tout ce qu'une lecture a fait — et ce qu'elle n'a pas fait. */
export interface BilanLecture {
  source: "document" | "texte";
  nomFichier: string | null;
  methode: "texte" | "ocr";
  /** L'OCR a été lancé (forcé, ou faute de texte natif). */
  ocrTente: boolean;
  /** Lancé, et il n'a rien rendu (moteur indisponible). */
  ocrEchoue: boolean;
  confiance: number | null;
  aRelire: boolean;
  pagesLues: number | null;
  pagesTotal: number | null;
  caracteres: number;
  caracteresLus: number;
  produitsLus: number;
  ecartees: number;
  sansQuantite: number;
  complementaire: boolean;
  creees: number;
  dejaPresentes: number;
  remplacees: number;
  gardees: RaisonDeGarder[];
  /** Prévues au remplacement, mais modifiées pendant la lecture : elles restent. */
  restees: number;
  horsExtraction: number;
  /** `null` pour un texte collé. */
  fichier: "GARDE" | "SANS_DROIT" | { echec: string } | null;
  enrichies: number;
}

function phraseMethode(b: BilanLecture): string {
  if (b.methode === "ocr") {
    const pages = b.pagesLues !== null && b.pagesTotal !== null ? ` : ${b.pagesLues} page${s(b.pagesLues)} sur ${b.pagesTotal}` : "";
    const confiance = b.confiance !== null ? `, confiance ${b.confiance} %` : "";
    const relire = b.aRelire ? " — des pages sont à relire" : "";
    const manque = b.pagesLues !== null && b.pagesTotal !== null && b.pagesLues < b.pagesTotal
      ? " Les pages au-delà n'ont pas été lues : leur absence ici ne prouve rien."
      : "";
    return `Lu par OCR${pages}${confiance}${relire}.${manque}`;
  }
  if (b.ocrTente && b.ocrEchoue) return "L'OCR n'a pas abouti : seul le texte natif du fichier a été lu.";
  if (b.ocrTente) return "L'OCR n'a pas rendu plus de texte que le fichier : le texte natif a été gardé.";
  return "Texte natif du fichier : aucun OCR.";
}

/** CE QUE LA LECTURE A FAIT — la phrase que la personne lit, et que l'audit et Adam reprennent. */
export function phraseDeLExtraction(b: BilanLecture): string {
  const p: string[] = [];
  p.push(`Lecture ${b.source === "document" ? `de « ${b.nomFichier ?? "document"} »` : "du texte collé"} : ${b.produitsLus} produit${s(b.produitsLus)} lu${s(b.produitsLus)}.`);
  if (b.source === "document") p.push(phraseMethode(b));
  const coupe = phraseCoupe(b.caracteres, b.caracteresLus);
  if (coupe) p.push(coupe);

  const resultat = [b.creees === 0 ? "aucun produit ajouté" : `${b.creees} ajouté${s(b.creees)}`];
  if (!b.complementaire && b.remplacees > 0) resultat.push(`${b.remplacees} ligne${s(b.remplacees)} de lectures précédentes remplacée${s(b.remplacees)}`);
  if (b.dejaPresentes > 0) resultat.push(`${b.dejaPresentes} déjà au tableau (non recréé${s(b.dejaPresentes)})`);
  p.push(`${majuscule(listeFr(resultat))}${b.complementaire ? " ; rien n'a été remplacé (document complémentaire)" : ""}.`);

  if (b.gardees.length > 0) {
    const parRaison = ORDRE_RAISONS
      .map((r) => [r, b.gardees.filter((g) => g === r).length] as const)
      .filter(([, n]) => n > 0)
      .map(([r, n]) => `${n} ${LIBELLE_RAISON[r][n > 1 ? 1 : 0]}`);
    p.push(`${b.gardees.length} ligne${s(b.gardees.length)} de lectures précédentes conservée${s(b.gardees.length)} : ${listeFr(parRaison)}.`);
  }
  if (b.restees > 0) p.push(`${b.restees} ligne${s(b.restees)} modifiée${s(b.restees)} pendant la lecture ${b.restees > 1 ? "sont restées" : "est restée"}.`);
  if (!b.complementaire && b.horsExtraction > 0) {
    p.push(`${b.horsExtraction} ligne${s(b.horsExtraction)} saisie${s(b.horsExtraction)} à la main ou d'avant le suivi des lectures ${b.horsExtraction > 1 ? "restent telles quelles" : "reste telle quelle"} : une lecture ne les remplace jamais.`);
  }
  if (b.ecartees > 0) p.push(`${b.ecartees} ligne${s(b.ecartees)} rendue${s(b.ecartees)} sans désignation lisible ${b.ecartees > 1 ? "ont été écartées" : "a été écartée"}.`);
  if (b.sansQuantite > 0) p.push(`${b.sansQuantite} produit${s(b.sansQuantite)} sans quantité lisible : la quantité est restée à 0, à compléter.`);
  if (b.fichier === "GARDE") p.push("Le fichier est gardé dans les documents du marché.");
  else if (b.fichier === "SANS_DROIT") p.push("Le fichier n'a pas été gardé : déposer un document sur le marché demande le droit d'y téléverser.");
  else if (b.fichier) p.push(`Le fichier n'a pas été gardé : ${b.fichier.echec}`);
  if (b.enrichies > 0) p.push(`${b.enrichies} ligne${s(b.enrichies)} enrichie${s(b.enrichies)} par l'intelligence marché.`);
  return p.join(" ");
}

/** Une ligne, pour l'historique du marché. */
export function resumeAuditLecture(b: BilanLecture): string {
  const origine = b.source === "document" ? `« ${b.nomFichier ?? "document"} », ${b.methode === "ocr" ? "OCR" : "texte natif"}` : "texte collé";
  return `Lecture IA de l'appel d'offres (${origine}) — ${b.produitsLus} produit(s) lu(s) : ${b.creees} ajouté(s), ${b.remplacees} remplacé(s), ${b.gardees.length} conservé(s)`
    + (b.dejaPresentes > 0 ? `, ${b.dejaPresentes} déjà présent(s)` : "")
    + (b.caracteresLus < b.caracteres ? `, ${b.caracteresLus}/${b.caracteres} caractères lus` : "")
    + (b.complementaire ? ", document complémentaire" : "");
}

/** Une lecture passée, pour l'écran : quand, qui, quoi, comment, ce qu'il en reste, et ce qui n'a pas été lu. */
export function phraseDeLecture(l: {
  quand: string; parQui: string | null; source: "document" | "texte"; nomFichier: string | null; fichierGarde: boolean;
  methode: "texte" | "ocr"; confiance: number | null; aRelire: boolean; pagesLues: number | null; pagesTotal: number | null;
  caracteres: number; caracteresLus: number; produits: number; restantes: number; complementaire: boolean;
}): string {
  const parts: string[] = [l.quand];
  if (l.parQui) parts.push(l.parQui);
  parts.push(l.source === "document" ? `fichier « ${l.nomFichier ?? "document"} »${l.fichierGarde ? " (gardé dans les documents)" : ""}` : "texte collé");
  if (l.source === "document") {
    parts.push(l.methode === "ocr"
      ? `OCR${l.pagesLues !== null && l.pagesTotal !== null ? ` ${l.pagesLues}/${l.pagesTotal} pages` : ""}${l.confiance !== null ? `, confiance ${l.confiance} %` : ""}`
      : "texte natif");
  }
  parts.push(`${l.produits} produit${s(l.produits)} lu${s(l.produits)}, ${l.restantes} encore au tableau`);
  if (l.caracteresLus < l.caracteres) parts.push(`${nombre(l.caracteresLus)} caractères analysés sur ${nombre(l.caracteres)}`);
  if (l.complementaire) parts.push("complément");
  if (l.aRelire) parts.push("à relire");
  return parts.join(" · ");
}
