/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « CET ÉVÉNEMENT EST-IL CELUI QUE J'ATTENDAIS ? » — la question, isolée et pure.
 *
 * ── POURQUOI C'EST UN FICHIER SÉPARÉ ET SANS BASE ────────────────────────────────────────
 *
 * Parce que c'est la décision qui, prise de travers, réveille la mauvaise mission — et qu'une
 * mission réveillée à tort peut envoyer un e-mail. La règle doit donc être lisible d'un bloc et
 * testable au cas près, sans monter une base et un ledger pour vérifier qu'un nom ne correspond
 * pas à un autre.
 *
 * ── LA POSTURE : STRICTE PAR DÉFAUT ──────────────────────────────────────────────────────
 *
 * Une attente qui ne précise rien n'attrape RIEN. C'est l'inverse du réflexe habituel (« pas de
 * filtre = tout passe »), et c'est délibéré : une attente sans condition serait réveillée par le
 * premier fait venu, ce qui est exactement la panne qu'on ne veut pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** L'attente, telle que le plan l'a écrite. */
export interface Attente {
  /** Le type d'événement métier attendu. OBLIGATOIRE : sans lui, rien ne correspond. */
  event?: string;
  /** De qui — identifiant d'acteur, adresse, ou nom présent dans la charge utile. */
  from?: string;
  /** L'entité concernée, en « TYPE:id ». */
  entity?: string;
  withinDays?: number;
}

/** Le fait, tel que le registre l'a inscrit. Une VUE, pas le modèle Prisma. */
export interface FaitObserve {
  type: string;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  relatedRefs?: readonly string[];
  payload?: unknown;
  missionId?: string | null;
}

const norm = (s: string): string => s.trim().toLowerCase();

/** Les champs d'une charge utile susceptibles de porter l'émetteur. Explicites, pas devinés. */
const CHAMPS_EMETTEUR = ["from", "fromAddress", "senderEmail", "sender", "email", "personId", "employeeId", "userId"];

function emetteurs(fait: FaitObserve): string[] {
  const out: string[] = [];
  if (fait.actorId) out.push(fait.actorId);
  const p = fait.payload;
  if (p && typeof p === "object" && !Array.isArray(p)) {
    for (const champ of CHAMPS_EMETTEUR) {
      const v = (p as Record<string, unknown>)[champ];
      if (typeof v === "string" && v.trim() !== "") out.push(v);
    }
  }
  return out.map(norm);
}

function references(fait: FaitObserve): string[] {
  const out: string[] = [...(fait.relatedRefs ?? [])];
  if (fait.entityType && fait.entityId) out.push(`${fait.entityType}:${fait.entityId}`);
  return out.map(norm);
}

/**
 * LA CORRESPONDANCE.
 *
 * ── LE `from` EST LE POINT DÉLICAT ───────────────────────────────────────────────────────
 *
 * Une mission attend « la réponse de Redouane ». Le fait porte peut-être son identifiant ERP,
 * peut-être son adresse, peut-être les deux. On accepte donc l'égalité sur l'un quelconque des
 * émetteurs connus, et l'INCLUSION seulement quand l'attendu est assez long pour ne pas
 * ramasser n'importe qui : « ali » inclus dans « natalie@… » réveillerait une mission sur la
 * réponse de quelqu'un d'autre.
 */
export function correspond(attente: Attente, fait: FaitObserve): boolean {
  // 1. LE TYPE EST OBLIGATOIRE. Une attente sans type n'attrape rien — voir l'en-tête.
  if (!attente.event || norm(attente.event) !== norm(fait.type)) return false;

  // 2. L'ÉMETTEUR, quand il est demandé.
  if (attente.from) {
    const attendu = norm(attente.from);
    const candidats = emetteurs(fait);
    const exact = candidats.includes(attendu);
    const partiel = attendu.length >= 4 && candidats.some((c) => c.includes(attendu));
    if (!exact && !partiel) return false;
  }

  // 3. L'ENTITÉ, quand elle est demandée.
  if (attente.entity) {
    if (!references(fait).includes(norm(attente.entity))) return false;
  }

  return true;
}

/**
 * L'ATTENTE EST-ELLE ÉCHUE ?
 *
 * Une échéance dépassée ne fait PAS échouer la mission : elle rend une relance PERTINENTE
 * (§87). Confondre les deux abandonnerait une mission au premier retard, alors qu'attendre
 * trois jours de plus une réponse est le comportement normal d'un être humain qui relance.
 */
export function echue(attente: Attente, depuis: Date, maintenant: Date): boolean {
  if (!attente.withinDays || attente.withinDays <= 0) return false;
  return maintenant.getTime() - depuis.getTime() > attente.withinDays * 24 * 3600 * 1000;
}

/** Relit une attente venue de la base — retypée, jamais crue sur parole. */
export function lireAttente(v: unknown): Attente | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const s = (k: string): string | undefined =>
    typeof o[k] === "string" && (o[k] as string).trim() !== "" ? (o[k] as string).trim() : undefined;
  const n = typeof o.withinDays === "number" && o.withinDays > 0 ? o.withinDays : undefined;
  const a: Attente = { event: s("event"), from: s("from"), entity: s("entity"), withinDays: n };
  return a.event || a.from || a.entity ? a : null;
}
