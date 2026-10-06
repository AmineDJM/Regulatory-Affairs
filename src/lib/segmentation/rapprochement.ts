import { cleDEtablissement } from "@/lib/annuaires/rattachement";
import type { LigneClasseur } from "./lecture-classeur";

/**
 * RAPPROCHER LES LIGNES D'UN CLASSEUR DES PRATICIENS DE L'ANNUAIRE — sans jamais dupliquer, sans jamais deviner.
 *
 * Une ligne désigne un praticien DÉJÀ présent quand son nom et son prénom (casse, accents, « Ep »/« épouse »,
 * ordre nom-prénom mis de côté) sont ceux d'UNE fiche active. Plusieurs fiches de ce nom : celle du même
 * établissement l'emporte ; sinon la ligne est AMBIGUË et laissée à trancher (rien n'est écrit pour elle).
 * Aucune fiche : la ligne CRÉE le praticien. Deux lignes du fichier qui désignent la même personne : la
 * seconde est un DOUBLON, signalé, jamais additionné.
 *
 * Module PUR — testé sans base.
 */

export function clePersonne(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(dr|pr|prof|docteur|professeur)\b\.?/g, " ")
    .replace(/\b(ep|epouse|nee)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
}

export interface PraticienConnu {
  id: string;
  name: string;
  lastName: string | null;
  firstName: string | null;
  institutionId: string | null;
}

export type Rapprochement =
  | { statut: "existant"; doctorId: string; autreEtablissement: boolean }
  | { statut: "nouveau" }
  | { statut: "ambigu"; candidats: string[] }
  | { statut: "doublon"; ligneOrigine: number };

/** Les clés sous lesquelles une fiche peut être retrouvée : nom + prénom séparés, et le libellé affiché. */
function clesDe(p: PraticienConnu): string[] {
  const cles = new Set<string>();
  if (p.lastName || p.firstName) cles.add(clePersonne(p.lastName, p.firstName));
  if (p.name) cles.add(clePersonne(p.name));
  cles.delete("");
  return [...cles];
}

export function rapprocher(
  lignes: readonly LigneClasseur[],
  connus: readonly PraticienConnu[],
  etablissementDe: (nom: string | null) => string | null,
): Map<number, Rapprochement> {
  const index = new Map<string, PraticienConnu[]>();
  for (const p of connus) for (const k of clesDe(p)) { const l = index.get(k) ?? []; if (!l.some((x) => x.id === p.id)) l.push(p); index.set(k, l); }
  const out = new Map<number, Rapprochement>();
  /** Personne déjà désignée par une ligne précédente (fiche existante, ou nom + établissement pour une création). */
  const dejaVu = new Map<string, number>();
  for (const l of lignes) {
    const cle = clePersonne(l.nom, l.prenom);
    const etab = etablissementDe(l.etablissement);
    const cands = index.get(cle) ?? [];
    let r: Rapprochement;
    if (cands.length === 1) r = { statut: "existant", doctorId: cands[0].id, autreEtablissement: !!etab && !!cands[0].institutionId && cands[0].institutionId !== etab };
    else if (cands.length > 1) {
      const meme = etab ? cands.filter((c) => c.institutionId === etab) : [];
      r = meme.length === 1 ? { statut: "existant", doctorId: meme[0].id, autreEtablissement: false } : { statut: "ambigu", candidats: cands.map((c) => c.id) };
    } else r = { statut: "nouveau" };
    const identite = r.statut === "existant" ? `id:${r.doctorId}` : r.statut === "nouveau" ? `new:${cle}|${cleDEtablissement(l.etablissement ?? "")}` : null;
    if (identite) {
      const avant = dejaVu.get(identite);
      if (avant !== undefined) r = { statut: "doublon", ligneOrigine: avant };
      else dejaVu.set(identite, l.ligne);
    }
    out.set(l.ligne, r);
  }
  return out;
}

/** Le type d'établissement qu'un nom annonce (CHU, EHS, EPH…) — pour une fiche créée depuis le fichier. */
export function typeDEtablissement(nom: string): "CHU" | "EPH" | "EHS" | "AUTRE" {
  const n = cleDEtablissement(nom);
  if (/^chu\b/.test(n)) return "CHU";
  if (/^ehs\b/.test(n)) return "EHS";
  if (/^eph\b/.test(n)) return "EPH";
  return "AUTRE";
}
