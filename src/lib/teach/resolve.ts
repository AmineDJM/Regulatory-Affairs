/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA RÉSOLUTION DES RÈGLES — lesquelles s'appliquent à cette personne, maintenant, et laquelle
 * l'emporte quand deux se contredisent.
 *
 * ── LA PRÉCÉDENCE EST ÉCRITE, PAS DEVINÉE ───────────────────────────────────────────────
 *
 *   1. Une EXCEPTION l'emporte sur la règle qu'elle vise (`params.exceptionDe` = id ou clé).
 *   2. Une nature CONTRAIGNANTE au périmètre large l'emporte sur une nature souple au périmètre
 *      étroit : « toute facture > 500 000 passe par le PDG » (société) n'est pas écartée par
 *      « je préfère envoyer directement » (personnel).
 *   3. Sinon, le périmètre le plus ÉTROIT l'emporte : la personne précise la société.
 *   4. À périmètre égal, la PRIORITÉ la plus haute ; puis la plus RÉCENTE (date d'effet).
 *
 * Deux règles ne « se contredisent » que si elles portent la MÊME CLÉ — `params.cle`, ou à
 * défaut l'intitulé normalisé. On ne devine pas une contradiction dans deux phrases libres :
 * un faux conflit bloquerait un enseignement légitime, et c'est le modèle (ou la personne)
 * qui pose la clé quand il veut que la nouvelle règle remplace l'ancienne.
 *
 * Module PUR — testé sur des règles construites à la main, mesuré sur mille.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { KINDS_CONTRAIGNANTS, RANG_SCOPE, type Regle, type Sujet } from "@/lib/teach/model";

const plier = (s: string): string => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** LA CLÉ D'UNE RÈGLE — ce qui permet de dire « c'est de la même chose qu'on parle ». */
export function cleDe(r: Pick<Regle, "params" | "title" | "kind" | "domain">): string {
  const p = r.params;
  if (p && typeof p.cle === "string" && p.cle.trim()) return `${r.domain}:${plier(p.cle)}`;
  if (p && typeof p.de === "string" && p.de.trim()) return `${r.domain}:de:${plier(p.de)}`;
  return `${r.domain}:${r.kind.toLowerCase()}:${plier(r.title)}`;
}

/** La règle s'applique-t-elle à ce sujet, à cet instant ? (statut, dates, périmètre) */
export function estApplicable(r: Regle, s: Sujet): boolean {
  if (r.status !== "ACTIVE") return false;
  const t = (s.maintenant ?? new Date()).getTime();
  if (r.effectiveFrom.getTime() > t) return false;
  if (r.effectiveTo && r.effectiveTo.getTime() <= t) return false;
  if (r.scope === "PERSON") return r.subjectUserId === s.userId;
  if (r.scope === "COMPANY") return r.companyId === null || s.companyIds.includes(r.companyId);
  return r.departmentId !== null && s.departmentIds.includes(r.departmentId);
}

export interface Ecartee<R extends Regle = Regle> {
  regle: R;
  par: R;
  raison: string;
}

export interface Conflit<R extends Regle = Regle> {
  cle: string;
  regles: R[];
  /** Vrai quand la précédence ne sait pas départager (même périmètre, même priorité, natures non ordonnées). */
  indecidable: boolean;
}

export interface Resolution<R extends Regle = Regle> {
  enVigueur: R[];
  ecartees: Ecartee<R>[];
  conflits: Conflit<R>[];
}

/** L'exception vise-t-elle cette règle ? Par identifiant, ou par clé. */
function viseCette(exception: Regle, cible: Regle): boolean {
  const p = exception.params;
  const de = p && typeof p.exceptionDe === "string" ? p.exceptionDe.trim() : "";
  if (!de) return false;
  return de === cible.id || plier(de) === plier(cleDe(cible)) || `${cible.domain}:${plier(de)}` === cleDe(cible);
}

/** Compare deux règles de MÊME clé : négatif = `a` l'emporte. Rend `0` quand rien ne les départage. */
export function comparerPrecedence(a: Regle, b: Regle): number {
  const aExc = a.kind === "EXCEPTION" && viseCette(a, b);
  const bExc = b.kind === "EXCEPTION" && viseCette(b, a);
  if (aExc !== bExc) return aExc ? -1 : 1;
  const aC = KINDS_CONTRAIGNANTS.has(a.kind);
  const bC = KINDS_CONTRAIGNANTS.has(b.kind);
  const ra = RANG_SCOPE[a.scope];
  const rb = RANG_SCOPE[b.scope];
  // Une contrainte large contre une souplesse étroite : la contrainte gagne.
  if (aC && !bC && ra > rb) return -1;
  if (bC && !aC && rb > ra) return 1;
  if (ra !== rb) return ra - rb; // le plus étroit d'abord
  if (a.priority !== b.priority) return b.priority - a.priority;
  const da = a.effectiveFrom.getTime();
  const db = b.effectiveFrom.getTime();
  if (da !== db) return db - da; // la plus récente d'abord
  return 0;
}

/**
 * RÉSOUT : filtre les applicables, groupe par clé, ne garde qu'une règle par clé (la
 * gagnante), et rend les écartées avec leur raison et les conflits que la précédence ne sait
 * pas trancher — ceux-là, on les DIT au lieu de choisir en silence.
 */
export function resoudre<R extends Regle>(regles: readonly R[], sujet: Sujet): Resolution<R> {
  const applicables = regles.filter((r) => estApplicable(r, sujet));
  const parCle = new Map<string, R[]>();
  for (const r of applicables) {
    const k = cleDe(r);
    parCle.set(k, [...(parCle.get(k) ?? []), r]);
  }
  // Les exceptions rejoignent la clé de la règle qu'elles visent, si elle est présente.
  for (const r of applicables) {
    if (r.kind !== "EXCEPTION") continue;
    for (const [k, groupe] of parCle) {
      if (k === cleDe(r)) continue;
      if (groupe.some((g) => viseCette(r, g))) {
        parCle.set(k, [...groupe, r]);
        const propre = parCle.get(cleDe(r))?.filter((x) => x !== r) ?? [];
        if (propre.length === 0) parCle.delete(cleDe(r)); else parCle.set(cleDe(r), propre);
        break;
      }
    }
  }
  const enVigueur: R[] = [];
  const ecartees: Ecartee<R>[] = [];
  const conflits: Conflit<R>[] = [];
  for (const [cle, groupe] of parCle) {
    if (groupe.length === 1) { enVigueur.push(groupe[0]); continue; }
    const tri = [...groupe].sort(comparerPrecedence);
    const gagnante = tri[0];
    const indecidable = comparerPrecedence(tri[0], tri[1]) === 0 && plier(tri[0].statement) !== plier(tri[1].statement);
    enVigueur.push(gagnante);
    for (const perdante of tri.slice(1)) {
      ecartees.push({ regle: perdante, par: gagnante, raison: raisonDePrecedence(gagnante, perdante) });
    }
    if (indecidable) conflits.push({ cle, regles: tri.filter((r) => comparerPrecedence(tri[0], r) === 0), indecidable: true });
  }
  enVigueur.sort((a, b) => {
    // Pour la lecture : les contraintes de société d'abord, puis du plus large au plus étroit, puis par priorité.
    const ca = KINDS_CONTRAIGNANTS.has(a.kind) ? 0 : 1;
    const cb = KINDS_CONTRAIGNANTS.has(b.kind) ? 0 : 1;
    if (ca !== cb) return ca - cb;
    if (RANG_SCOPE[a.scope] !== RANG_SCOPE[b.scope]) return RANG_SCOPE[b.scope] - RANG_SCOPE[a.scope];
    return b.priority - a.priority;
  });
  return { enVigueur, ecartees, conflits };
}

function raisonDePrecedence(gagnante: Regle, perdante: Regle): string {
  if (gagnante.kind === "EXCEPTION" && viseCette(gagnante, perdante)) return "une exception la vise";
  const gC = KINDS_CONTRAIGNANTS.has(gagnante.kind);
  const pC = KINDS_CONTRAIGNANTS.has(perdante.kind);
  if (gC && !pC && RANG_SCOPE[gagnante.scope] > RANG_SCOPE[perdante.scope]) return "une règle contraignante de périmètre plus large l'emporte";
  if (RANG_SCOPE[gagnante.scope] !== RANG_SCOPE[perdante.scope]) return "un périmètre plus étroit la précise";
  if (gagnante.priority !== perdante.priority) return "une priorité plus haute";
  return "une règle plus récente sur la même clé";
}

/**
 * LES CONFLITS QU'UN NOUVEL ENSEIGNEMENT CRÉERAIT — à montrer AVANT d'écrire. Un conflit ici
 * n'est pas une contradiction devinée : c'est une règle ACTIVE de même clé, au même périmètre et
 * pour le même sujet, dont le texte diffère. La personne choisit : remplacer, ou garder les deux
 * avec une priorité.
 */
export function conflitsAvecExistantes<R extends Regle>(nouvelle: Omit<Regle, "id" | "createdAt" | "version" | "supersedesId" | "status">, existantes: readonly R[]): R[] {
  const cle = cleDe(nouvelle);
  return existantes.filter((r) =>
    r.status === "ACTIVE"
    && cleDe(r) === cle
    && r.scope === nouvelle.scope
    && (nouvelle.scope !== "PERSON" || r.subjectUserId === nouvelle.subjectUserId)
    && (nouvelle.scope !== "COMPANY" || r.companyId === nouvelle.companyId)
    && (nouvelle.scope !== "GROUP" || r.departmentId === nouvelle.departmentId)
    && plier(r.statement) !== plier(nouvelle.statement),
  );
}
