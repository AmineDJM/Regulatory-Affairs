import { estPanneTemporaire } from "./panne";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA BOÎTE MORTE, REGROUPÉE PAR CAUSE — module PUR (il n'importe que `panne.ts`, pur lui aussi).
 *
 * ── POURQUOI ─────────────────────────────────────────────────────────────────────────────
 *
 * L'écran disait « 441 — travaux abandonnés après plusieurs essais », et rien d'autre. Un nombre
 * sans cause ne se répare pas : on ne sait ni s'il faut relancer, ni s'il faut corriger un format,
 * ni si les 441 sont une seule panne vue 441 fois. Regroupés, ils le disent — et un défaut
 * répété se voit comme UNE ligne, pas comme un mur.
 *
 * ── LA CLÉ D'UN GROUPE ───────────────────────────────────────────────────────────────────
 *
 * (étape, motif normalisé, type de fichier). Le motif est normalisé pour que le même défaut sur
 * deux documents donne la même ligne : identifiants, nombres et citations retirés. La clé est
 * recalculée par l'ACTION de relance depuis la base — l'écran ne lui transmet qu'un libellé de
 * groupe, jamais une liste d'identifiants qu'une requête forgée pourrait gonfler.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface TravailMort {
  id: string;
  kind: string;
  lastError: string | null;
  itemId: string | null;
  /** Le nom du fichier (ou le titre de l'élément), quand on le connaît. */
  nom: string | null;
  sourceType: string | null;
  sourceId: string | null;
}

export interface ExempleMort {
  label: string;
  /** Lien vers l'objet, quand il en a un — `null` pour une source sans écran. */
  href: string | null;
}

export interface GroupeMort {
  cle: string;
  kind: string;
  cause: string;
  extension: string;
  /** La cause est-elle une panne de l'environnement ? Alors relancer suffit. */
  temporaire: boolean;
  count: number;
  ids: string[];
  exemples: ExempleMort[];
}

/** Un motif absent est un motif — le cacher ferait croire qu'il n'y a rien à lire. */
export const MOTIF_ABSENT = "(aucun motif enregistré)";

/**
 * LE MOTIF NORMALISÉ. Ce qui varie d'un document à l'autre (identifiants, nombres, noms cités)
 * est retiré ; ce qui dit la NATURE du défaut reste. Le statut HTTP est gardé : un 429 et un 400
 * ne sont pas la même panne.
 */
export function causeNormalisee(msg: string | null | undefined): string {
  const brut = (msg ?? "").trim();
  if (!brut) return MOTIF_ABSENT;
  return brut
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "…")
    .replace(/\bc[a-z0-9]{20,}\b/g, "…") // identifiants cuid
    .replace(/«[^»]*»|"[^"]*"|'[^']{3,}'/g, "«…»")
    // Un nombre qui ne suit ni « HTTP » ni un autre chiffre — le statut HTTP reste entier.
    .replace(/(?<!HTTP )(?<![\d.,])\d+([.,]\d+)?/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

/** L'extension du fichier, en minuscules — `—` quand elle ne se lit pas à coup sûr. */
export function extensionDe(nom: string | null | undefined): string {
  const n = (nom ?? "").trim();
  const point = n.lastIndexOf(".");
  if (point <= 0 || point === n.length - 1) return "—";
  const ext = n.slice(point + 1).toLowerCase();
  return /^[a-z0-9]{1,6}$/.test(ext) ? ext : "—";
}

export function cleDeGroupe(t: Pick<TravailMort, "kind" | "lastError" | "nom">): string {
  return `${t.kind}|${causeNormalisee(t.lastError)}|${extensionDe(t.nom)}`;
}

/** Le lien d'un exemple : un fichier du Drive s'ouvre, le reste n'a pas d'écran à désigner. */
function hrefDe(t: TravailMort): string | null {
  if ((t.sourceType === "drive_file" || t.sourceType === "attachment") && t.sourceId) {
    // Une version close porte `#vN` : le nœud, lui, est le même.
    return `/drive/${encodeURIComponent(t.sourceId.split("#")[0])}`;
  }
  return null;
}

/** Combien d'exemples par groupe — assez pour vérifier, pas assez pour noyer. */
export const EXEMPLES_PAR_GROUPE = 3;

/** REGROUPE. Les groupes les plus nombreux d'abord : c'est par eux qu'on gagne le plus. */
export function regrouperEchecs(travaux: readonly TravailMort[]): GroupeMort[] {
  const groupes = new Map<string, GroupeMort>();
  for (const t of travaux) {
    const cle = cleDeGroupe(t);
    let g = groupes.get(cle);
    if (!g) {
      g = {
        cle,
        kind: t.kind,
        cause: causeNormalisee(t.lastError),
        extension: extensionDe(t.nom),
        temporaire: estPanneTemporaire(t.lastError ?? ""),
        count: 0,
        ids: [],
        exemples: [],
      };
      groupes.set(cle, g);
    }
    g.count += 1;
    g.ids.push(t.id);
    if (g.exemples.length < EXEMPLES_PAR_GROUPE) {
      g.exemples.push({ label: t.nom ?? t.sourceId ?? t.itemId ?? t.id, href: hrefDe(t) });
    }
  }
  return [...groupes.values()].sort((a, b) => b.count - a.count || a.cle.localeCompare(b.cle));
}
