/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES PHRASES D'UNE PIÈCE LUE — la méthode, les absences, les écarts, les refus (lot D2).
 *
 * Une lecture de machine n'est jamais un fait vérifié (§104.15) : elle voyage avec sa NOTE DE
 * MÉTHODE — texte natif ou OCR, quelle confiance, combien de pages, ce qui a été coupé, qui a lu
 * les lignes —, et cette note vient de notre code, jamais du document. L'écran, l'audit et le
 * service de lecture la composent ICI, une fois : deux rédactions de la même réserve finiraient
 * par dire deux choses différentes (§118.5).
 *
 * Les causes « IA coupée » et « clé absente » ont DÉJÀ leur phrase canonique (`REFUS_IA_COUPEE`,
 * `phraseIaNonConfiguree`), côté serveur. Ce module, pur, ne les recopie pas : l'appelant les
 * passe en `cause`, et la phrase ajoute la seule chose qui manquait — ce que la personne fait
 * des lignes.
 *
 * Module PUR : il n'importe que les formats de la fabrique (purs).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { formaterDzd, formaterTaux } from "@/lib/artifact/factory/commercial";

// ─────────────────────────────── La méthode ───────────────────────────────

/**
 * Les faits d'une lecture de fichier, tels que le lecteur commun (`lireTexteOuOcr`) et la ligne
 * `LecturePiece` les portent. Tous facultatifs sauf la méthode : un champ absent n'est pas dit.
 */
export interface FaitsDeLecture {
  methode: "texte" | "ocr";
  /** Confiance moyenne de l'OCR, 0-100 ; `null` pour un texte natif. */
  confiance?: number | null;
  /** L'OCR juge lui-même que des pages méritent une relecture. */
  aRelire?: boolean | null;
  ocrTente?: boolean | null;
  ocrEchoue?: boolean | null;
  raisonOcr?: string | null;
  pagesLues?: number | null;
  pagesTotal?: number | null;
  /** Le texte extrait a été coupé (le fichier est plus long que ce qui a été lu). */
  tronque?: boolean | null;
  /** « tesseract », « mistral »… */
  moteur?: string | null;
  caracteres?: number | null;
}

/** Pourquoi une pièce n'a pas de LIGNES lues — une absence de lecteur n'est pas une lecture vide (§104.15). */
export const RAISONS_SANS_LIGNES = ["DESACTIVEE", "IA_COUPEE", "NON_CONFIGUREE", "CONFIDENTIELLE", "OCR_ECHOUE", "TEXTE_ILLISIBLE"] as const;
export type RaisonSansLignes = (typeof RAISONS_SANS_LIGNES)[number];

const SAISIR = "en-tête et totaux repérés : saisissez les lignes depuis le papier";

const nombre = (n: number): string => n.toLocaleString("fr-FR");
const nomMoteur = (m: string): string => {
  const p = m.trim().toLowerCase();
  if (p.startsWith("tess")) return "Tesseract";
  if (p.startsWith("mistral")) return "Mistral";
  return m.trim();
};

/** « OCR 71 % », « OCR », « texte natif » — le badge d'une ligne lue. */
export function methodeCourte(f: Pick<FaitsDeLecture, "methode" | "confiance">): string {
  if (f.methode === "texte") return "texte natif";
  return typeof f.confiance === "number" && Number.isFinite(f.confiance) ? `OCR ${Math.round(f.confiance)} %` : "OCR";
}

/**
 * POURQUOI LES LIGNES N'ONT PAS ÉTÉ LUES. `cause` porte la phrase canonique quand elle existe
 * (`REFUS_IA_COUPEE`, `phraseIaNonConfiguree(...)`) ; sans elle, une phrase sobre la remplace.
 */
export function phraseSansLignes(raison: RaisonSansLignes, cause?: string | null): string {
  const c = cause?.trim().replace(/[.\s]+$/, "");
  switch (raison) {
    case "DESACTIVEE":
      return `Lecture des lignes par l'IA désactivée (Administration › Contrôle de l'IA) — décision de la Direction ; ${SAISIR}.`;
    case "IA_COUPEE":
      return `${c || "L'IA est coupée par l'interrupteur général"} — ${SAISIR}.`;
    case "NON_CONFIGUREE":
      return `${c || "Lecture des lignes par l'IA indisponible : la clé du fournisseur n'est pas configurée"} — ${SAISIR}.`;
    case "CONFIDENTIELLE":
      return `Pièce confidentielle : rien n'est envoyé hors de l'ERP, ni OCR externe ni modèle — lecture locale seulement ; ${SAISIR}.`;
    case "OCR_ECHOUE":
      return `L'OCR n'a pas abouti${c ? ` (${c})` : ""} : aucun texte n'a pu être lu sur ce scan — saisissez la pièce depuis le papier.`;
    case "TEXTE_ILLISIBLE":
      return "Le texte lu est trop court ou trop abîmé pour en tirer des lignes — saisissez-les depuis le papier.";
  }
}

/**
 * LA NOTE DE MÉTHODE d'une lecture : d'où vient le texte, ce qui n'a pas été lu, qui a proposé les
 * lignes. Elle reste HORS de l'enclos du contenu (§104.15) : elle vient de notre code.
 */
export function noteDeMethode(
  f: FaitsDeLecture,
  lignes?: { parModele: boolean; raisonSansLignes?: RaisonSansLignes | null; cause?: string | null } | null,
): string {
  const parts: string[] = [];
  if (f.methode === "ocr") {
    const moteur = f.moteur ? nomMoteur(f.moteur) : null;
    const conf = typeof f.confiance === "number" && Number.isFinite(f.confiance) ? `confiance ${Math.round(f.confiance)} %` : null;
    const precision = [moteur, conf].filter(Boolean).join(", ");
    parts.push(`Lue par OCR${precision ? ` (${precision})` : ""} — une lecture de machine, à vérifier sur le papier.`);
    if (f.aRelire) parts.push("L'OCR signale des pages à relire.");
  } else {
    const car = typeof f.caracteres === "number" && f.caracteres > 0 ? ` (${nombre(f.caracteres)} caractères)` : "";
    parts.push(`Texte natif du fichier${car}, lu sans OCR.`);
    if (f.ocrEchoue) parts.push(`L'OCR a été tenté et n'a pas abouti${f.raisonOcr?.trim() ? ` (${f.raisonOcr.trim().replace(/[.\s]+$/, "")})` : ""} : seul le texte natif a été lu.`);
  }
  if (typeof f.pagesLues === "number" && typeof f.pagesTotal === "number" && f.pagesTotal > f.pagesLues) {
    parts.push(`${f.pagesLues} page(s) lue(s) sur ${f.pagesTotal} — les suivantes ne l'ont pas été.`);
  }
  if (f.tronque) parts.push("Texte coupé : la fin du fichier n'a pas été lue.");
  if (lignes) {
    if (lignes.parModele) parts.push("Lignes proposées par l'IA — à confirmer une à une.");
    else if (lignes.raisonSansLignes) parts.push(phraseSansLignes(lignes.raisonSansLignes, lignes.cause));
  }
  return parts.join(" ");
}

// ─────────────────────────────── Le contrôle arithmétique ───────────────────────────────

/** Le nom d'un total, tel qu'une personne le lit sur la pièce. */
export function nomDuTotal(quoi: string, taux?: number | null, libelle?: string | null): string {
  switch (quoi) {
    case "HT": return "Total HT";
    case "TVA": return typeof taux === "number" ? `TVA ${formaterTaux(taux)}` : "TVA";
    case "TVA_TOTAL": return "Total TVA";
    case "TAXE": return `${libelle?.trim() || "Taxe"}${typeof taux === "number" ? ` ${formaterTaux(taux)}` : ""}`;
    case "TIMBRE": return "Droit de timbre";
    case "TTC": return "Total TTC";
    case "NET": return "Net à payer";
    default: return quoi;
  }
}

/** UN ÉCART : ce que les lignes font, ce que la pièce imprime, de combien ils diffèrent — et, s'il se lit, pourquoi. */
export function phraseEcartTotal(nom: string, calcule: number, imprime: number, ecart: number, cause?: string | null): string {
  const sens = ecart > 0 ? "de plus" : "de moins";
  return `${nom} : les lignes font ${formaterDzd(calcule)}, la pièce imprime ${formaterDzd(imprime)} — ${formaterDzd(Math.abs(ecart))} ${sens}${cause ? ` ; ${cause}` : " ; une ligne est mal lue, manque ou est en trop"}.`;
}

/** La cause qu'on sait reconnaître : une TVA imprimée calculée sur le HT AUGMENTÉ des taxes additionnelles. */
export function causeTvaSurTaxes(baseFautive: number): string {
  return `la TVA imprimée porte sur le HT augmenté des taxes additionnelles (${formaterDzd(baseFautive)}), alors que ces taxes sont hors base de TVA`;
}

/** UN TOTAL ABSENT est nommé — jamais pris pour un accord (§118.16). */
export function phraseTotalAbsent(nom: string): string {
  return `${nom} non repéré sur la pièce : il n'est pas contrôlé — vérifiez-le sur le papier.`;
}

export function phraseTotalIllisible(nom: string, raison: string | null): string {
  return `${nom} repéré mais illisible${raison ? ` (${raison.replace(/[.\s]+$/, "")})` : ""} : il n'est pas contrôlé.`;
}

export function phraseConflit(nom: string, valeurs: readonly string[]): string {
  return `Plusieurs « ${nom} » différents sont imprimés (${valeurs.join(" ; ")}) : aucun n'est retenu — vérifiez sur le papier.`;
}

const lignesNommees = (rangs: readonly number[]): string => `ligne${rangs.length > 1 ? "s" : ""} ${rangs.join(", ")}`;

export const PHRASE_AUCUNE_LIGNE =
  "Aucune ligne chiffrée n'a été lue : les totaux imprimés ne peuvent pas être recalculés — saisissez les lignes depuis le papier.";

/** Une ligne dont la quantité, le prix ou la remise est illisible : la recalculer « sans elle » serait un faux contrôle. */
export function phraseLignesIncompletes(rangs: readonly number[]): string {
  return `Quantité, prix ou remise illisible (${lignesNommees(rangs)}) : les totaux ne sont pas recalculés — corrigez ces lignes depuis le papier.`;
}

export const PHRASE_REMISE_GLOBALE_ILLISIBLE = "Remise globale illisible : les totaux ne sont pas recalculés — saisissez-la depuis le papier.";

/** Un taux de TVA de ligne qu'on ne connaît pas ne se remplace pas par 19 % : la TVA et le TTC ne sont pas contrôlés. */
export function phraseTvaInconnue(rangs: readonly number[]): string {
  return `Taux de TVA inconnu ou illisible (${lignesNommees(rangs)}) : la TVA et le TTC ne sont pas contrôlés — seuls le HT et les taxes le sont.`;
}

export function phraseTaxeNonReperee(nom: string): string {
  return `${nom} lue par l'IA mais non repérée sur la pièce : elle n'est pas contrôlée — vérifiez sur le papier.`;
}

export function phraseDeviseEtrangere(devise: string): string {
  return `Pièce libellée en ${devise} : le contrôle se fait en dinars — aucun écart n'est calculé et aucun montant ne doit être prérempli.`;
}

/** LE DÉSACCORD : deux lectures du même total — le repérage sert au contrôle, celle de l'IA seulement à recouper (P4). */
export function phraseDesaccord(nom: string, repere: number, modele: number): string {
  return `${nom} : le repérage lit ${formaterDzd(repere)}, l'IA ${formaterDzd(modele)} — c'est le repérage qui sert au contrôle ; vérifiez sur le papier.`;
}

export function phraseDesaccordLigne(rang: number, quantite: number, prix: number, calcule: number, imprime: number): string {
  return `Ligne ${rang} : ${nombre(quantite)} × ${formaterDzd(prix)} font ${formaterDzd(calcule)}, la ligne imprime ${formaterDzd(imprime)} — une des valeurs est mal lue.`;
}

// ─────────────────────────────── Le fournisseur ───────────────────────────────

export const PHRASE_FOURNISSEUR_A_CREER =
  "Fournisseur absent de l'annuaire : il n'est jamais créé par une lecture — à créer par une personne (le NIF et le RC lus sont proposés).";

export function phraseFournisseurCertain(nom: string, par: "NIF" | "RC"): string {
  return `Fournisseur reconnu par son ${par} : « ${nom} ».`;
}

export function phraseFournisseurProbable(nom: string): string {
  return `Fournisseur reconnu par son nom seulement : « ${nom} » — vérifiez son NIF avant de le retenir.`;
}

export function phraseFournisseurAmbigu(noms: readonly string[]): string {
  return `Plusieurs fiches de l'annuaire correspondent (${noms.map((n) => `« ${n} »`).join(", ")}) : aucune n'est choisie — à vous de choisir.`;
}

// ─────────────────────────────── L'appariement ───────────────────────────────

export function phraseLigneAmbigue(designation: string, candidats: readonly string[]): string {
  return `« ${designation} » correspond à égalité à ${candidats.length} lignes (${candidats.map((c) => `« ${c} »`).join(", ")}) : rien n'est choisi — à vous de l'apparier.`;
}

export function phraseLigneHors(designation: string): string {
  return `« ${designation} » ne correspond à aucune ligne attendue restante : elle n'est jamais reportée d'office sur une autre.`;
}

// ─────────────────────────────── Les refus de lecture ───────────────────────────────

export function refusFormatDePiece(extension: string, admis: readonly string[]): string {
  const e = extension.replace(/^\./, "").trim().toUpperCase() || "sans extension";
  return `Format « ${e} » non lu : seuls ${admis.map((a) => a.replace(/^\./, "").toUpperCase()).join(", ")} se lisent — saisissez la pièce depuis le papier.`;
}

export function refusTailleDePiece(octets: number, maxOctets: number): string {
  const mo = (n: number) => `${(n / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
  return `Fichier de ${mo(octets)} : au-delà de ${mo(maxOctets)}, une pièce n'est pas lue — saisissez-la depuis le papier.`;
}
