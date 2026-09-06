/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA BOÎTE DE DÉCISION — le modèle PUR d'une carte (§21).
 *
 * Une carte est une décision qui attend une personne, ramenée à ce qu'il faut pour trancher en
 * dix secondes : le SUJET, le CONTEXTE minimal, la RAISON pour laquelle elle remonte
 * maintenant, l'ÉCHÉANCE, l'URGENCE, l'IMPACT, une RECOMMANDATION quand une règle du code peut
 * la justifier, et des OPTIONS dont chacune est un GESTE canonique — le même que l'écran du
 * module exécuterait. Aucune carte n'existe sans une ligne réelle derrière elle.
 *
 * Ce module n'importe rien : il se teste seul, et il est chargé par le navigateur.
 *
 * ── CINQ GENRES, ET PAS UN DE PLUS ──────────────────────────────────────────────────────
 *
 *   APPROVE  quelqu'un attend un oui (validation, paiement, accord de mission) ;
 *   REJECT   un refus est le geste attendu (rare : une carte APPROVE porte déjà « Refuser ») ;
 *   CHOOSE   une mission attend une RÉPONSE ou un choix ;
 *   REVIEW   rien à signer, mais à regarder : engagement en retard, décision à revoir, dossier ;
 *   FYI      pour information — un « Vu » suffit.
 *
 * ── L'URGENCE EST CALCULÉE, JAMAIS DÉCLARÉE ─────────────────────────────────────────────
 *
 * Une échéance dépassée est CRITIQUE ; à moins d'un jour, HAUTE ; à trois jours, NORMALE. Un
 * niveau de mission CRITICAL l'est aussi ; un montant qui compte relève l'urgence d'un cran.
 * La règle est écrite et testée : la même carte, le même jour, sort au même rang.
 *
 * ── UNE RECOMMANDATION N'EST PAS UN AVIS ────────────────────────────────────────────────
 *
 * Elle n'existe que lorsqu'une règle du code la justifie et elle DIT pourquoi. Faute de règle,
 * la carte n'en porte pas : mieux vaut aucune recommandation qu'une qui aurait l'air savante.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type GenreCarte = "APPROVE" | "REJECT" | "CHOOSE" | "REVIEW" | "FYI";
export const GENRES: readonly GenreCarte[] = ["APPROVE", "CHOOSE", "REVIEW", "FYI", "REJECT"];
export const LIBELLE_GENRE: Record<GenreCarte, string> = {
  APPROVE: "À approuver", REJECT: "À refuser", CHOOSE: "À trancher", REVIEW: "À revoir", FYI: "Pour information",
};

export type Urgence = "CRITIQUE" | "HAUTE" | "NORMALE" | "BASSE";
export const LIBELLE_URGENCE: Record<Urgence, string> = { CRITIQUE: "Critique", HAUTE: "Haute", NORMALE: "Normale", BASSE: "Basse" };
const RANG_URGENCE: Record<Urgence, number> = { BASSE: 0, NORMALE: 1, HAUTE: 2, CRITIQUE: 3 };
const auMoins = (a: Urgence, plancher: Urgence): Urgence => (RANG_URGENCE[a] >= RANG_URGENCE[plancher] ? a : plancher);

/** Le GESTE qu'une option exécute — toujours une action canonique existante, jamais une écriture à elle. */
export type Geste =
  | { kind: "validation.decide"; stepId: string; decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" }
  | { kind: "paiement.decide"; orderId: string; decision: "APPROVE" | "REFUSE" | "REQUEST_INFO" }
  | { kind: "mission.accord"; approvalId: string; decision: "GRANTED" | "REFUSED" }
  | { kind: "mission.element"; missionId: string; stepKey: string }
  | { kind: "notification.lue"; notificationId: string }
  /** Qualité des données (§23) : appliquer la correction proposée d'un constat, ou l'écarter avec un motif. */
  | { kind: "qualite.corriger"; constatId: string }
  | { kind: "qualite.ignorer"; constatId: string }
  | { kind: "ouvrir"; href: string }
  | { kind: "adam"; phrase: string };

export interface OptionCarte {
  id: string;
  libelle: string;
  ton: "primaire" | "danger" | "neutre";
  /** Ce que l'option FAIT, en une ligne — lisible avant de cliquer. */
  effet: string;
  geste: Geste;
  /** Une saisie à joindre (motif d'un refus, réponse à une mission). */
  saisie?: { libelle: string; obligatoire: boolean } | null;
}

export interface SourceCarte { module: string; libelle: string; href: string }

export interface CarteInbox {
  id: string;
  genre: GenreCarte;
  sujet: string;
  contexte: string;
  /** Pourquoi cette carte remonte MAINTENANT. */
  raison: string;
  /** ISO, ou null. */
  echeance: string | null;
  urgence: Urgence;
  impact: string | null;
  recommandation: { optionId: string; pourquoi: string } | null;
  options: OptionCarte[];
  source: SourceCarte;
  /** ISO : depuis quand la carte attend. */
  depuis: string;
}

export interface FaitsUrgence {
  genre: GenreCarte;
  echeance?: string | null;
  priorite?: string | null;
  montant?: number | null;
  /** Niveau d'une approbation de mission : CRITICAL / SENSITIVE / NORMAL. */
  niveau?: string | null;
  /** Quelqu'un est bloqué tant que ce n'est pas tranché (une validation, une mission). */
  bloqueQuelquun?: boolean;
}

const JOUR = 86_400_000;

/** Jours (fractionnaires) avant l'échéance ; négatif = dépassée ; null sans échéance lisible. */
export function joursAvant(echeance: string | null | undefined, now: Date): number | null {
  if (!echeance) return null;
  const t = new Date(echeance).getTime();
  return Number.isFinite(t) ? (t - now.getTime()) / JOUR : null;
}

export function urgenceDe(f: FaitsUrgence, now: Date): Urgence {
  let u: Urgence = f.genre === "FYI" || f.genre === "REVIEW" ? "BASSE" : "NORMALE";
  const j = joursAvant(f.echeance, now);
  if (j !== null) {
    if (j < 0) u = "CRITIQUE";
    else if (j < 1) u = auMoins(u, "HAUTE");
    else if (j <= 3) u = auMoins(u, "NORMALE");
  }
  if (f.niveau === "CRITICAL") u = "CRITIQUE";
  else if (f.niveau === "SENSITIVE") u = auMoins(u, "HAUTE");
  if (typeof f.montant === "number") {
    if (f.montant >= 10_000_000) u = auMoins(u, "HAUTE");
    else if (f.montant >= 1_000_000) u = auMoins(u, "NORMALE");
  }
  if (f.priorite === "CRITICAL") u = auMoins(u, "HAUTE");
  else if (f.priorite === "HIGH") u = auMoins(u, "NORMALE");
  if (f.bloqueQuelquun) u = auMoins(u, "NORMALE");
  return u;
}

/** « en retard de 3 j », « aujourd'hui », « dans 2 j » — ce que l'œil lit à côté de la date. */
export function delaiHumain(echeance: string | null | undefined, now: Date): string | null {
  const j = joursAvant(echeance, now);
  if (j === null) return null;
  if (j < -1) return `en retard de ${Math.floor(-j)} j`;
  if (j < 0) return "échue aujourd'hui";
  if (j < 1) return "aujourd'hui";
  if (j < 2) return "demain";
  return `dans ${Math.floor(j)} j`;
}

const POIDS_GENRE: Record<GenreCarte, number> = { APPROVE: 300, CHOOSE: 300, REJECT: 200, REVIEW: 200, FYI: 0 };

/** Le score de tri : urgence d'abord, puis ce qui bloque quelqu'un, puis le retard, puis l'ancienneté. */
export function scoreCarte(c: CarteInbox, now: Date): number {
  let s = RANG_URGENCE[c.urgence] * 1000 + POIDS_GENRE[c.genre];
  const j = joursAvant(c.echeance, now);
  if (j !== null && j < 0) s += Math.min(200, Math.floor(-j) * 20);
  const heures = (now.getTime() - new Date(c.depuis).getTime()) / 3_600_000;
  if (Number.isFinite(heures)) s += Math.min(100, Math.max(0, Math.floor(heures)));
  return s;
}

export function ordonner(cartes: readonly CarteInbox[], now: Date): CarteInbox[] {
  return [...cartes].sort((a, b) => scoreCarte(b, now) - scoreCarte(a, now) || a.depuis.localeCompare(b.depuis) || a.id.localeCompare(b.id));
}

/**
 * CE QUI EST « À TRANCHER » : tout ce qui attend un GESTE — approuver, choisir, revoir. Une
 * information (FYI) se lit, elle ne se tranche pas. Le bureau d'Adam et l'en-tête de la boîte
 * lisent le MÊME nombre par cette fonction : deux formules donneraient deux chiffres.
 */
export function aTrancher(compte: Record<GenreCarte, number>): number {
  return (compte.APPROVE ?? 0) + (compte.CHOOSE ?? 0) + (compte.REVIEW ?? 0);
}

export function compterParGenre(cartes: readonly CarteInbox[]): Record<GenreCarte, number> {
  const c: Record<GenreCarte, number> = { APPROVE: 0, REJECT: 0, CHOOSE: 0, REVIEW: 0, FYI: 0 };
  for (const x of cartes) c[x.genre] += 1;
  return c;
}

/** L'accord d'une mission : recommandé quand le niveau est NORMAL — effets internes, réversibles, périmètre résumé. */
export function recommanderAccord(niveau: string | null | undefined, etapes: number): { optionId: string; pourquoi: string } | null {
  if ((niveau ?? "NORMAL") !== "NORMAL") return null;
  return { optionId: "accorder", pourquoi: `Niveau normal : ${etapes} étape(s) à effets internes et réversibles, périmètre résumé ci-dessus.` };
}

/** Un engagement en retard : relancer, tant que la promesse a encore un sens. */
export function recommanderEngagement(joursRetard: number): { optionId: string; pourquoi: string } | null {
  if (!(joursRetard > 0)) return null;
  return { optionId: "relancer", pourquoi: `En retard de ${Math.floor(joursRetard)} jour(s) : une relance nominative coûte moins qu'une promesse oubliée.` };
}

const ID = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

/** Le geste envoyé par le navigateur est une DONNÉE : on vérifie sa forme avant de le dispatcher. */
export function estGesteValide(x: unknown): x is Geste {
  if (!x || typeof x !== "object") return false;
  const g = x as Record<string, unknown>;
  switch (g.kind) {
    case "validation.decide": return ID(g.stepId) && ["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(String(g.decision));
    case "paiement.decide": return ID(g.orderId) && ["APPROVE", "REFUSE", "REQUEST_INFO"].includes(String(g.decision));
    case "mission.accord": return ID(g.approvalId) && ["GRANTED", "REFUSED"].includes(String(g.decision));
    case "mission.element": return ID(g.missionId) && ID(g.stepKey);
    case "notification.lue": return ID(g.notificationId);
    case "qualite.corriger": return ID(g.constatId);
    case "qualite.ignorer": return ID(g.constatId);
    case "ouvrir": return typeof g.href === "string" && g.href.startsWith("/");
    case "adam": return typeof g.phrase === "string" && g.phrase.length > 0 && g.phrase.length <= 500;
    default: return false;
  }
}

export function tronquer(s: string | null | undefined, n: number): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
}
