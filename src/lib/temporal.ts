/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE DÉCODEUR TEMPOREL — « demain », « dans 48 h », « chaque vendredi » deviennent des OBJETS.
 *
 * ── POURQUOI DU CODE, PAS UN PROMPT ──────────────────────────────────────────────────────
 *
 * « Souviens-toi de reprendre demain » écrit dans un prompt n'est pas une fonctionnalité :
 * c'est une prière. Une instruction temporelle devient ici une STRUCTURE persistable —
 * échéance, récurrence, horizon — que le battement relit après n'importe quel redémarrage.
 * Jamais un `setTimeout(86400000)` : un minuteur en mémoire meurt avec le processus.
 *
 * ── LA DOCTRINE DU DÉCODEUR (commands/nl.ts) ─────────────────────────────────────────────
 *
 * Rendre `null` sur tout ce qu'on ne reconnaît pas À COUP SÛR. Attraper « mardi en huit » de
 * travers et poser un rappel au mauvais jour est PIRE que de laisser le modèle formuler la
 * date en ISO : une interprétation fausse est silencieuse, un renoncement ne l'est pas.
 *
 * ── LE FUSEAU ────────────────────────────────────────────────────────────────────────────
 *
 * L'entreprise vit à Alger : UTC+1, SANS heure d'été. Même convention que `reminders.ts`
 * (`algiersToUtc`) — la conversion est une soustraction, pas une table de fuseaux.
 *
 * ── MODULE NEUTRE (frontière Adam ↔ ERP) ─────────────────────────────────────────────────
 *
 * ZÉRO import, et ça doit le rester : ce fichier est déclaré NEUTRE dans `boundary-scan.ts`
 * (même cas que `name-match`) — les rappels d'Adam le consomment, les attentes de mission de
 * l'ERP peuvent le consommer. Y ajouter une dépendance (base, RBAC, façade) casserait cette
 * neutralité, et le cliquet de frontière le dirait.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const ALGER_MS = 3_600_000; // UTC+1, fixe

export interface InterpretationTemporelle {
  /** L'instant UTC du (prochain) déclenchement. */
  echeance: Date;
  /** La récurrence STRUCTURÉE — jamais « refais ça demain » recopié dans un prompt. */
  recurrence: "NONE" | "DAILY" | "WEEKLY";
  /** Ce que le décodeur a reconnu, pour l'audit. */
  lu: string;
}

const JOURS: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
};

const MOIS: Record<string, number> = {
  janvier: 0, fevrier: 1, "février": 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6,
  aout: 7, "août": 7, septembre: 8, octobre: 9, novembre: 10, "décembre": 11, decembre: 11,
};

/** L'heure par défaut d'un rendez-vous sans heure : 09 h — le début de journée, pas minuit. */
const HEURE_DEFAUT = 9;

const norm = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Champs d'Alger (année, mois, jour, jour de semaine) d'un instant UTC. */
function alger(ref: Date): { y: number; m: number; d: number; dow: number; h: number; min: number } {
  const a = new Date(ref.getTime() + ALGER_MS);
  return { y: a.getUTCFullYear(), m: a.getUTCMonth(), d: a.getUTCDate(), dow: a.getUTCDay(), h: a.getUTCHours(), min: a.getUTCMinutes() };
}

/** Un moment d'Alger (jour J à HH:MM) rendu en instant UTC. */
function instant(y: number, m: number, d: number, h: number, min: number): Date {
  return new Date(Date.UTC(y, m, d, h, min) - ALGER_MS);
}

/** L'heure dite dans le texte (« à 10h », « à 14:30», « 10 h 45 ») — null si aucune. */
export function heureDite(texte: string): { h: number; min: number } | null {
  const t = norm(texte);
  const m = /(?:\b(?:a|à|vers)\s+)?\b(\d{1,2})\s*(?:h|:)\s*(\d{2})?\b/.exec(t.replace(/\bà\b/g, "a"));
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return null;
  // « 15 septembre » attraperait « 15 » sans cette garde : une heure nue exige h/: ou un « à ».
  const aMarqueur = /(?:\b(?:a|vers)\s+\d{1,2})|(?:\d{1,2}\s*(?:h|:))/.test(t.replace(/\bà\b/g, "a"));
  return aMarqueur ? { h, min } : null;
}

/** La demi-journée dite (« matin » 09 h, « après-midi » 14 h, « soir » 18 h) — null sinon. */
function demiJournee(texte: string): number | null {
  const t = norm(texte);
  if (/\bmatin\b/.test(t)) return 9;
  if (/\bapres[- ]midi\b/.test(t)) return 14;
  if (/\bsoir(ee)?\b/.test(t)) return 18;
  return null;
}

/**
 * INTERPRÈTE une expression temporelle française. `ref` est l'horloge INJECTÉE — jamais lue
 * ici : c'est ce qui rend « demain » testable en millisecondes avec une fausse horloge.
 */
export function interpreterExpressionTemporelle(texte: string, ref: Date): InterpretationTemporelle | null {
  const t = norm(texte);
  const a = alger(ref);
  const heure = heureDite(texte);
  const demi = demiJournee(texte);
  const h = heure?.h ?? demi ?? HEURE_DEFAUT;
  const min = heure?.min ?? 0;

  // ── RÉCURRENCES — « chaque vendredi », « tous les jours », « tous les matins » ────────
  const chaqueJour = /\b(?:chaque\s+jour|tous\s+les\s+jours|tous\s+les\s+(?:matins|soirs)|quotidien(?:nement)?)\b/.test(t);
  const chaqueSemaineJour = /\b(?:chaque|tous\s+les)\s+(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi)s?\b/.exec(t);
  const chaqueSemaine = /\b(?:chaque\s+semaine|toutes\s+les\s+semaines|hebdomadaire)\b/.test(t);
  if (chaqueJour) {
    const hj = /\bmatins\b/.test(t) ? 9 : /\bsoirs\b/.test(t) ? 18 : h;
    let e = instant(a.y, a.m, a.d, hj, min);
    if (e.getTime() <= ref.getTime()) e = new Date(e.getTime() + 24 * ALGER_MS);
    return { echeance: e, recurrence: "DAILY", lu: "chaque jour" };
  }
  if (chaqueSemaineJour) {
    const cible = JOURS[chaqueSemaineJour[1]];
    let delta = (cible - a.dow + 7) % 7;
    let e = instant(a.y, a.m, a.d + delta, h, min);
    if (e.getTime() <= ref.getTime()) { delta += 7; e = instant(a.y, a.m, a.d + delta, h, min); }
    return { echeance: e, recurrence: "WEEKLY", lu: `chaque ${chaqueSemaineJour[1]}` };
  }
  if (chaqueSemaine) {
    let e = instant(a.y, a.m, a.d + 7, h, min);
    if (e.getTime() <= ref.getTime()) e = new Date(e.getTime() + 7 * 24 * ALGER_MS);
    return { echeance: e, recurrence: "WEEKLY", lu: "chaque semaine" };
  }

  // ── « dans N minutes/heures/jours/semaines » ──────────────────────────────────────────
  const dans = /\bdans\s+(\d+|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*(minutes?|min|heures?|h\b|jours?|semaines?)/.exec(t);
  if (dans) {
    const MOTS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };
    const n = MOTS[dans[1]] ?? Number(dans[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    const unite = dans[2].startsWith("min") ? 60_000
      : dans[2].startsWith("h") ? ALGER_MS
      : dans[2].startsWith("jour") ? 24 * ALGER_MS
      : 7 * 24 * ALGER_MS;
    let e = new Date(ref.getTime() + n * unite);
    // « dans trois jours à 10 h » : le jour vient du délai, l'heure vient du texte.
    if (heure && unite >= 24 * ALGER_MS) {
      const j = alger(e);
      e = instant(j.y, j.m, j.d, heure.h, heure.min);
    }
    return { echeance: e, recurrence: "NONE", lu: dans[0] };
  }

  // ── « demain », « après-demain », « ce soir » ────────────────────────────────────────
  if (/\bapres[- ]demain\b/.test(t)) {
    return { echeance: instant(a.y, a.m, a.d + 2, h, min), recurrence: "NONE", lu: "après-demain" };
  }
  if (/\bdemain\b/.test(t)) {
    return { echeance: instant(a.y, a.m, a.d + 1, h, min), recurrence: "NONE", lu: "demain" };
  }
  if (/\bce\s+soir\b/.test(t)) {
    const e = instant(a.y, a.m, a.d, 18, 0);
    return e.getTime() > ref.getTime() ? { echeance: e, recurrence: "NONE", lu: "ce soir" } : null;
  }

  // ── « lundi », « vendredi prochain » — le PROCHAIN jour de ce nom ────────────────────
  const jour = /\b(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi)(?:\s+prochain)?\b/.exec(t);
  if (jour) {
    const cible = JOURS[jour[1]];
    let delta = (cible - a.dow + 7) % 7;
    if (delta === 0) delta = 7; // « lundi », dit un lundi, veut dire le SUIVANT — jamais aujourd'hui.
    return { echeance: instant(a.y, a.m, a.d + delta, h, min), recurrence: "NONE", lu: jour[1] };
  }

  // ── « le 15 septembre (2026) » ────────────────────────────────────────────────────────
  const date = /\ble\s+(\d{1,2})(?:er)?\s+([a-z]+)(?:\s+(\d{4}))?\b/.exec(t);
  if (date) {
    const d = Number(date[1]);
    const m = MOIS[date[2]] ?? MOIS[norm(date[2])];
    if (m === undefined || d < 1 || d > 31) return null;
    let y = date[3] ? Number(date[3]) : a.y;
    let e = instant(y, m, d, h, min);
    // Sans année : « le 15 janvier », dit en décembre, désigne JANVIER PROCHAIN, pas le passé.
    if (!date[3] && e.getTime() <= ref.getTime()) { y += 1; e = instant(y, m, d, h, min); }
    return { echeance: e, recurrence: "NONE", lu: date[0] };
  }

  // ── « dans 48h » collé (sans espace) ─────────────────────────────────────────────────
  const colle = /\bdans\s+(\d+)h\b/.exec(t);
  if (colle) {
    const n = Number(colle[1]);
    if (n > 0) return { echeance: new Date(ref.getTime() + n * ALGER_MS), recurrence: "NONE", lu: colle[0] };
  }

  return null; // le doute renonce — le modèle prendra la main avec une date ISO explicite
}
