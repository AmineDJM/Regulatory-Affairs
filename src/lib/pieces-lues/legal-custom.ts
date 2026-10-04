/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES LIGNES D'UNE PIÈCE LEGAL — émise par la plateforme, ou lue sur la pièce déposée et
 * CONFIRMÉE par une personne. Jamais une simple proposition (lot D2, P9).
 *
 * Une pièce ÉMISE porte ses lignes dans `custom.fabrique.spec` : la fabrique les a composées, le
 * fichier les imprime (§118.194). Une pièce DÉPOSÉE n'en porte aucune — c'est un PDF venu d'un
 * fournisseur. Quand une personne a fait lire cette pièce puis en a CONFIRMÉ les lignes une à une,
 * elles vivent sous `custom.lecture`, au format que ce module définit :
 *
 *   lectureId     la lecture (`LecturePiece`) dont elles viennent ;
 *   jeton         une valeur neuve à chaque confirmation — l'écriture suivante la vérifie : deux
 *                 confirmations croisées ne s'écrasent pas sans le savoir ;
 *   confirmeeLe   ISO, et confirmeePar (l'identifiant de la personne) — sans eux ce n'est pas une
 *                 confirmation, c'est une proposition, et elle n'est PAS rendue ;
 *   noteMethode   d'où viennent les lignes (texte natif ou OCR, confiance) — une lecture de machine
 *                 confirmée reste une lecture de machine, et le dit (§104.15) ;
 *   lignes, taxes, tvaDefaut ;
 *   historique    qui a confirmé quoi, et quand — borné.
 *
 * `lignesDeLaPiece` est la SEULE lecture des lignes d'une pièce Legal, quelle qu'en soit l'origine :
 * le rapprochement facture ↔ BC, le BC prérempli depuis le devis retenu la lisent, et elle dit la
 * PROVENANCE. Elle ne rend JAMAIS une proposition non confirmée : une lecture de machine que personne
 * n'a comparée au papier ne devient pas, par un détour, la référence d'un rapprochement ou d'un BC.
 *
 * Le MONTANT de la pièce (`LegalDocument.amount`) n'est pas ici, et ne s'écrit jamais depuis une
 * lecture : un écart entre les lignes et le montant se MONTRE, il ne se corrige pas en silence.
 *
 * Module PUR.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { pieceEmise } from "@/lib/legal/piece-emise";

/** Une ligne d'une pièce Legal — la forme commune aux pièces émises et aux lectures confirmées. */
export interface LigneLegale {
  designation: string;
  quantite: number;
  unite: string | null;
  /** HORS TAXES. */
  prixUnitaire: number;
  /** En fraction. */
  remise: number | null;
  /** En fraction ; `null` = le taux par défaut de la pièce. */
  tva: number | null;
  reference: string | null;
  /** Un titre de section : hors de tout total. */
  section: boolean;
}

export interface TaxeLegale {
  libelle: string;
  /** En fraction. */
  taux: number;
}

export interface EvenementLecture {
  le: string;
  par: string;
  resume: string;
}

/** Le format de `LegalDocument.custom.lecture`. */
export interface LectureLegale {
  lectureId: string;
  jeton: string;
  confirmeeLe: string;
  confirmeePar: string;
  noteMethode: string;
  lignes: LigneLegale[];
  taxes: TaxeLegale[];
  tvaDefaut: number | null;
  historique: EvenementLecture[];
}

export type ProvenanceLignes = "EMISE" | "LECTURE_CONFIRMEE";

export interface LignesDeLaPiece {
  provenance: ProvenanceLignes;
  lignes: LigneLegale[];
  tvaDefaut: number | null;
  taxes: TaxeLegale[];
  remiseGlobale: number | null;
  /** D'où viennent les lignes, dit à la personne. */
  phrase: string;
}

/** L'historique d'une lecture se garde ; borné, il ne devient pas un second journal. */
export const HISTORIQUE_MAX = 20;

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nombre = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const dateIso = (v: unknown): string | null => {
  const t = texte(v);
  return t && !Number.isNaN(Date.parse(t)) ? t : null;
};

/** Une ligne, relue STRICTEMENT : une désignation, une quantité, un prix — sinon `null` (une section n'a ni l'un ni l'autre). */
function ligne(v: unknown): LigneLegale | null {
  if (!estObjet(v)) return null;
  const designation = texte(v.designation);
  if (!designation) return null;
  const section = v.section === true;
  const quantite = nombre(v.quantite);
  const prixUnitaire = nombre(v.prixUnitaire);
  if (!section && (quantite === null || prixUnitaire === null)) return null;
  return {
    designation,
    quantite: quantite ?? 0,
    unite: texte(v.unite),
    prixUnitaire: prixUnitaire ?? 0,
    remise: nombre(v.remise),
    tva: nombre(v.tva),
    reference: texte(v.reference),
    section,
  };
}

/** Toutes les lignes, ou `null` si UNE ne se relit pas : une liste amputée serait pire qu'aucune (§118.87c). */
function lignes(v: unknown): LigneLegale[] | null {
  if (!Array.isArray(v)) return null;
  const out: LigneLegale[] = [];
  for (const x of v) {
    const l = ligne(x);
    if (!l) return null;
    out.push(l);
  }
  return out;
}

function taxes(v: unknown): TaxeLegale[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((t) => {
    if (!estObjet(t)) return [];
    const libelle = texte(t.libelle);
    const taux = nombre(t.taux);
    return libelle && taux !== null && taux > 0 && taux < 1 ? [{ libelle, taux }] : [];
  });
}

/**
 * LA LECTURE CONFIRMÉE d'une pièce, relue strictement — `null` sans confirmation (ni date ni auteur),
 * sans jeton, ou au format illisible : on ne rend pas une moitié de lecture.
 */
export function lectureConfirmee(custom: unknown): LectureLegale | null {
  if (!estObjet(custom) || !estObjet(custom.lecture)) return null;
  const l = custom.lecture;
  const lectureId = texte(l.lectureId);
  const jeton = texte(l.jeton);
  const confirmeeLe = dateIso(l.confirmeeLe);
  const confirmeePar = texte(l.confirmeePar);
  const ls = lignes(l.lignes);
  if (!lectureId || !jeton || !confirmeeLe || !confirmeePar || !ls) return null;
  const historique = Array.isArray(l.historique)
    ? l.historique.flatMap((h) => {
        if (!estObjet(h)) return [];
        const le = dateIso(h.le);
        const par = texte(h.par);
        const resume = texte(h.resume);
        return le && par && resume ? [{ le, par, resume }] : [];
      })
    : [];
  const tvaDefaut = nombre(l.tvaDefaut);
  return {
    lectureId, jeton, confirmeeLe, confirmeePar,
    noteMethode: texte(l.noteMethode) ?? "",
    lignes: ls,
    taxes: taxes(l.taxes),
    tvaDefaut,
    historique,
  };
}

const dateFr = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { timeZone: "Africa/Algiers" });
};

/**
 * LES LIGNES DE LA PIÈCE, et leur PROVENANCE. Une pièce émise : celles de sa fabrique (son fichier les
 * imprime). Une pièce déposée : celles de sa lecture CONFIRMÉE. Rien d'autre — `null` sinon.
 */
export function lignesDeLaPiece(custom: unknown): LignesDeLaPiece | null {
  const emise = pieceEmise(custom);
  if (emise && estObjet(custom) && estObjet(custom.fabrique) && estObjet(custom.fabrique.spec)) {
    const spec = custom.fabrique.spec;
    const ls = lignes(spec.lignes);
    if (!ls) return null;
    return {
      provenance: "EMISE",
      lignes: ls,
      tvaDefaut: nombre(spec.tvaDefaut),
      taxes: taxes(spec.taxes),
      remiseGlobale: nombre(spec.remiseGlobale),
      phrase: `Lignes de la pièce émise par la plateforme (n° ${emise.numero}, version ${emise.version}).`,
    };
  }
  const lu = lectureConfirmee(custom);
  if (!lu) return null;
  return {
    provenance: "LECTURE_CONFIRMEE",
    lignes: lu.lignes,
    tvaDefaut: lu.tvaDefaut,
    taxes: lu.taxes,
    remiseGlobale: null,
    phrase: `Lignes lues sur la pièce déposée et confirmées une à une le ${dateFr(lu.confirmeeLe)}${lu.noteMethode ? ` — ${lu.noteMethode}` : ""}`,
  };
}

/**
 * COMPOSER LA LECTURE CONFIRMÉE à écrire sous `custom.lecture` — l'historique de la précédente est
 * repris, et l'évènement ajouté (borné). Le jeton est NEUF : l'appelant le tire au hasard.
 */
export function lectureLegaleConfirmee(args: {
  precedente: LectureLegale | null;
  lectureId: string;
  jeton: string;
  le: string;
  par: string;
  noteMethode: string;
  lignes: LigneLegale[];
  taxes: TaxeLegale[];
  tvaDefaut: number | null;
  resume: string;
}): LectureLegale {
  const historique = [...(args.precedente?.historique ?? []), { le: args.le, par: args.par, resume: args.resume }].slice(-HISTORIQUE_MAX);
  return {
    lectureId: args.lectureId,
    jeton: args.jeton,
    confirmeeLe: args.le,
    confirmeePar: args.par,
    noteMethode: args.noteMethode,
    lignes: args.lignes,
    taxes: args.taxes,
    tvaDefaut: args.tvaDefaut,
    historique,
  };
}
