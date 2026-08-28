/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * RÉUSSITE TECHNIQUE ≠ RÉUSSITE SÉMANTIQUE.
 *
 * ── LE DÉFAUT QUE CE FICHIER FERME ───────────────────────────────────────────────────────
 *
 * Une recherche Drive qui rend HTTP 200 avec « Convention speaker — consultante médicale »
 * a techniquement réussi. Elle n'a pas trouvé le contrat de consulting demandé. Sans cette
 * distinction, l'étape passe en DONE, le juge d'objectif reçoit une preuve qui n'en est pas
 * une, et la mission conclut sur un document que personne n'a vérifié.
 *
 * C'est le défaut le plus coûteux du système : il a l'air d'un succès.
 *
 * ── DÉTERMINISTE D'ABORD, ET SOUVENT DÉTERMINISTE TOUT COURT ─────────────────────────────
 *
 * On ne paie PAS un appel de modèle pour constater qu'une liste attendue à cinq éléments en
 * contient quatre, ni qu'un document de type `SPEAKER_CONVENTION` n'est pas un `CONTRAT`.
 * Ces vérifications sont arithmétiques ou typées ; les confier à un modèle coûterait un aller-
 * retour pour une réponse connue d'avance, et introduirait le risque qu'il en donne une autre.
 *
 * Ce module ne fait donc AUCUN appel de modèle. Quand il ne sait pas trancher, il le dit
 * (`null`) et laisse le résultat passer — se taire est plus sûr que deviner : un faux
 * INCOMPATIBLE_RESULT bloquerait une mission parfaitement valide.
 *
 * ── OÙ SONT LES CRITÈRES ─────────────────────────────────────────────────────────────────
 *
 * Dans `MissionStep.spec.attendu`, dont le schéma dit déjà « ce que l'étape attend ». On ne
 * crée pas de colonne : elle existait, elle n'était pas lue.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { ErrorKind } from "@/lib/missions/recovery/strategy";
import type { Certitude } from "@/lib/missions/recovery/strategy";

/** Ce que l'étape attend, tel que le plan compilé l'a posé dans `spec.attendu`. */
export interface Attendu {
  /** Le type métier exigé : « CONTRAT », « FACTURE »… Comparé au type du résultat. */
  type?: string | null;
  /** Le nombre d'éléments exigés. « Récupère les 5 contrats » → 5. */
  nombre?: number | null;
  /** Le type de cible, pour choisir l'ordre des sources en cas de recours. */
  cible?: string | null;
}

export interface Verdict {
  /** `null` = rien à redire : le résultat est accepté tel quel. */
  kind: ErrorKind | null;
  /** Le niveau de certitude du résultat, qui décidera s'il autorise à AGIR (§107). */
  certitude: Certitude;
  /** Pourquoi, en français, pour le blocage exact et pour ce qu'Adam dira. */
  raison: string;
}

const OK: Verdict = { kind: null, certitude: "TROUVE", raison: "" };

/** Les noms sous lesquels une capacité rend une collection. Fermé, donc prévisible. */
const CHAMPS_LISTE = ["items", "resultats", "results", "documents", "rows", "elements", "candidats"];

/** Les noms sous lesquels un résultat déclare son type métier. */
const CHAMPS_TYPE = ["type", "kind", "documentType", "docType", "nature"];

function listeDe(v: unknown): unknown[] | null {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  for (const c of CHAMPS_LISTE) if (Array.isArray(o[c])) return o[c] as unknown[];
  return null;
}

function typeDe(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  for (const c of CHAMPS_TYPE) {
    const x = o[c];
    if (typeof x === "string" && x.trim() !== "") return x.trim().toUpperCase();
  }
  return null;
}

/** Deux types métier désignent-ils la même chose ? Comparaison stricte, volontairement. */
function memeType(attendu: string, obtenu: string): boolean {
  const n = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");
  return n(attendu) === n(obtenu);
}

/**
 * ÉVALUE un résultat techniquement réussi.
 *
 * L'ordre des contrôles suit leur coût de vérité : d'abord « il n'y a rien », puis « ce n'est
 * pas la bonne chose », puis « il n'y en a pas assez », puis « il y en a plusieurs et je ne
 * sais pas laquelle ». Chacun rend une cause de l'échelle §75, pas un booléen — c'est la cause
 * qui choisit le recours.
 */
export function evaluerResultat(attendu: Attendu | null, resultat: unknown): Verdict {
  // Sans critère d'acceptation, il n'y a rien à contrôler. On ne fabrique pas d'exigence.
  if (!attendu) return OK;

  const liste = listeDe(resultat);

  // ── RIEN ────────────────────────────────────────────────────────────────────────────
  if (resultat === null || resultat === undefined) {
    return { kind: "NOT_FOUND", certitude: "INCONNU", raison: "la recherche n'a rien rendu." };
  }
  if (liste !== null && liste.length === 0) {
    return { kind: "NOT_FOUND", certitude: "INCONNU", raison: "aucun élément trouvé à cet endroit." };
  }

  // ── PAS LA BONNE CHOSE ──────────────────────────────────────────────────────────────
  //
  // Le cas de la convention speaker. On compare des TYPES DÉCLARÉS, jamais une ressemblance
  // de libellé : « Convention speaker — consultante médicale » ressemble beaucoup à ce qu'on
  // cherche, et c'est précisément pour cela qu'un critère lexical se tromperait.
  if (attendu.type) {
    const candidats = liste ?? [resultat];
    const types = candidats.map(typeDe).filter((t): t is string => t !== null);
    if (types.length > 0 && !types.some((t) => memeType(attendu.type as string, t))) {
      return {
        /**
         * ── LA CAUSE EST « ABSENT », PAS « MAL FORMÉ » — et la nuance choisit le recours ───
         *
         * Ce cas rendait `INCOMPATIBLE_RESULT`, ce qui se défendait à la lecture : le résultat
         * ne correspond pas à ce qu'on attendait. Mais l'échelle, elle, ne lit pas des mots :
         * elle branche une conduite. Or ce qui s'est passé ici n'est pas un problème de FORME —
         * le document est parfaitement bien formé. C'est que LE CONTRAT N'EST PAS DANS CE
         * GRENIER. La conduite juste est donc d'aller voir ailleurs.
         *
         * Réserver `INCOMPATIBLE_RESULT` aux vrais désaccords de structure — un éventail qui
         * attend une liste et reçoit une phrase — permet à chacune des deux causes d'avoir
         * l'échelle qui lui convient : chercher ailleurs d'un côté, réparer ou récrire
         * localement le plan de l'autre. Les confondre a coûté, sur un run réel, quatre
         * planifications et 191 secondes pour un problème que zéro appel pouvait régler.
         */
        kind: "NOT_FOUND",
        // CANDIDAT et non INCONNU : ce document existe et ressemble ; il peut guider la
        // recherche suivante. Il ne peut simplement pas satisfaire l'objectif (§107-109).
        certitude: "CANDIDAT",
        raison: `le document trouvé est de type ${types[0]}, or l'objectif demande ${attendu.type} `
          + `— la pièce cherchée n'est pas dans ce grenier.`,
      };
    }
  }

  // ── PAS ASSEZ ───────────────────────────────────────────────────────────────────────
  if (typeof attendu.nombre === "number" && attendu.nombre > 0) {
    const n = liste?.length ?? 1;
    if (n < attendu.nombre) {
      return {
        kind: "INSUFFICIENT_DATA",
        certitude: "DEDUIT",
        raison: `${n} élément(s) trouvé(s) sur les ${attendu.nombre} attendus.`,
      };
    }
  }

  // ── PLUSIEURS, ET RIEN NE LES DÉPARTAGE ─────────────────────────────────────────────
  //
  // N'est une ambiguïté que si l'objectif visait UNE chose. Cinq contrats demandés, cinq
  // rendus, ce n'est pas ambigu — c'est exactement la commande.
  if (liste !== null && liste.length > 1 && (attendu.nombre ?? 1) === 1) {
    return {
      kind: "AMBIGUOUS_ENTITY",
      certitude: "CANDIDAT",
      raison: `${liste.length} candidats correspondent — aucun ne se distingue.`,
    };
  }

  return OK;
}

/** Lit `spec.attendu` sans faire confiance à sa forme — il vient d'un plan, donc d'un modèle. */
export function attenduDe(spec: unknown): Attendu | null {
  if (!spec || typeof spec !== "object") return null;
  const a = (spec as Record<string, unknown>).attendu;
  if (!a || typeof a !== "object") return null;
  const o = a as Record<string, unknown>;
  const type = typeof o.type === "string" ? o.type : null;
  const nombre = typeof o.nombre === "number" && Number.isFinite(o.nombre) ? o.nombre : null;
  const cible = typeof o.cible === "string" ? o.cible : null;
  if (type === null && nombre === null && cible === null) return null;
  return { type, nombre, cible };
}
