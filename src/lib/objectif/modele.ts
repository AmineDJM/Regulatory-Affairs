/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'OBJECTIF DURABLE (mandat 6 §47) — pur, et ce n'est PAS une mission.
 *
 * ── LA DISTINCTION QUI FONDE TOUT LE MODULE ─────────────────────────────────────────────
 *
 * Une mission a une fin : ses étapes tournent, le juge se prononce, elle se ferme. Un OBJECTIF
 * n'a pas de fin tant qu'il n'est pas atteint — et il survit à toutes les missions qu'on lance
 * pour lui. « Je veux qu'on soit prêts pour l'AO 2027 » n'est pas une mission : c'est ce qui
 * rend une mission utile, et ce qui doit continuer à être surveillé le jour où la mission se
 * termine « avec succès » sans que l'objectif ait avancé d'un pouce.
 *
 * C'est exactement ce que le mandat vise : un système qui confondrait les deux déclarerait
 * victoire à chaque mission close, et laisserait l'objectif dériver en silence.
 *
 * ── CE QUE CE MODULE NE FAIT PAS ────────────────────────────────────────────────────────
 *
 * Il ne devine aucun critère. « Prêts pour l'AO 2027 » ne se décompose pas tout seul en jalons :
 * c'est une conversation avec une personne, et les critères qu'elle donne font foi. Le module
 * TIENT l'objectif, calcule son état à partir de faits CONSTATÉS, et dit ce qu'il ignore.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const ETATS_CRITERE = ["ATTEINT", "EN_COURS", "NON_ATTEINT", "INCONNU"] as const;
export type EtatCritere = (typeof ETATS_CRITERE)[number];

export const ETATS_JALON = ["FAIT", "EN_COURS", "EN_RETARD", "PAS_COMMENCE", "ABANDONNE"] as const;
export type EtatJalon = (typeof ETATS_JALON)[number];

export const ETATS_OBJECTIF = ["ACTIF", "ATTEINT", "COMPROMIS", "ABANDONNE"] as const;
export type EtatObjectif = (typeof ETATS_OBJECTIF)[number];

export interface Critere {
  id: string;
  /** Le critère tel que la personne l'a énoncé — c'est lui qui fait foi, pas sa reformulation. */
  enonce: string;
  /** Est-il mesurable ? Un critère non mesurable ne peut pas passer de EN_COURS à ATTEINT seul. */
  mesurable: boolean;
  etat: EtatCritere;
  /** Ce qui permet d'affirmer cet état. Vide ⇒ l'état est une opinion, et le code le dit. */
  preuve?: string | null;
  constateLe?: Date | null;
}

export interface Jalon {
  id: string;
  libelle: string;
  echeance: Date | null;
  etat: EtatJalon;
  /** Les jalons qui doivent être faits avant celui-ci. */
  dependDe: string[];
  /** La mission qui le porte, quand il y en a une. */
  missionId?: string | null;
  proprietaire?: string | null;
}

export interface Risque {
  id: string;
  quoi: string;
  /** 0 à 1 — la probabilité qu'il se réalise, telle qu'une personne l'estime. */
  vraisemblance: number;
  /** 0 à 1 — ce qu'il coûterait à l'objectif s'il se réalisait. */
  impact: number;
  parade?: string | null;
}

export interface Objectif {
  id: string;
  /** L'objectif MOT POUR MOT. La reformulation est utile, l'original fait foi. */
  enonce: string;
  reformulation?: string | null;
  proprietaire: string;
  echeance: Date | null;
  etat: EtatObjectif;
  criteres: Critere[];
  jalons: Jalon[];
  risques: Risque[];
  /** Les missions lancées POUR cet objectif — elles s'ajoutent, elles ne le remplacent pas. */
  missions: string[];
  creeLe: Date;
}

/** Un jalon est-il en retard ? Question simple, et c'est la moitié du diagnostic. */
export function enRetard(j: Jalon, maintenant: Date): boolean {
  return Boolean(j.echeance && j.echeance.getTime() < maintenant.getTime() && j.etat !== "FAIT" && j.etat !== "ABANDONNE");
}

/**
 * LES JALONS BLOQUÉS — ceux qui attendent un jalon non fait.
 *
 * Un jalon en retard coûte ses propres jours ; un jalon qui en bloque quatre coûte les leurs
 * aussi. Sans cette lecture, un plan « à 80 % » peut être arrêté net par un seul retard, et le
 * pourcentage ne le dit pas.
 */
export function bloques(jalons: readonly Jalon[]): { jalon: Jalon; par: Jalon[] }[] {
  const parId = new Map(jalons.map((j) => [j.id, j]));
  const out: { jalon: Jalon; par: Jalon[] }[] = [];
  for (const j of jalons) {
    if (j.etat === "FAIT" || j.etat === "ABANDONNE") continue;
    const par = j.dependDe.map((d) => parId.get(d)).filter((x): x is Jalon => Boolean(x) && x!.etat !== "FAIT" && x!.etat !== "ABANDONNE");
    if (par.length) out.push({ jalon: j, par });
  }
  return out;
}

/** Combien de jalons dépendent, directement ou non, de celui-ci — le VRAI poids d'un retard. */
export function porteeDuRetard(jalons: readonly Jalon[], id: string): string[] {
  const enfants = new Map<string, string[]>();
  for (const j of jalons) for (const d of j.dependDe) enfants.set(d, [...(enfants.get(d) ?? []), j.id]);
  const vus = new Set<string>();
  const pile = [id];
  while (pile.length) {
    const courant = pile.pop()!;
    for (const e of enfants.get(courant) ?? []) {
      if (vus.has(e)) continue;
      vus.add(e);
      pile.push(e);
    }
  }
  return [...vus];
}

export interface Avancement {
  /** La part des critères ATTEINTS — la seule mesure d'avancement qui compte vraiment. */
  criteresAtteints: number;
  criteresTotal: number;
  /** Les critères dont l'état est INCONNU : ils ne comptent NI en réussite NI en échec. */
  criteresInconnus: number;
  jalonsFaits: number;
  jalonsTotal: number;
  jalonsEnRetard: Jalon[];
  jalonsBloques: { jalon: Jalon; par: Jalon[] }[];
  /** Les critères déclarés ATTEINTS sans aucune preuve — une réussite sur parole. */
  sansPreuve: Critere[];
  joursRestants: number | null;
}

export function avancement(o: Objectif, maintenant: Date): Avancement {
  const retard = o.jalons.filter((j) => enRetard(j, maintenant));
  return {
    criteresAtteints: o.criteres.filter((c) => c.etat === "ATTEINT").length,
    criteresTotal: o.criteres.length,
    criteresInconnus: o.criteres.filter((c) => c.etat === "INCONNU").length,
    jalonsFaits: o.jalons.filter((j) => j.etat === "FAIT").length,
    jalonsTotal: o.jalons.length,
    jalonsEnRetard: retard,
    jalonsBloques: bloques(o.jalons),
    // UNE RÉUSSITE SUR PAROLE. Un critère « atteint » sans preuve est le point où un objectif
    // commence à mentir : personne ne vérifie, et le tableau passe au vert.
    sansPreuve: o.criteres.filter((c) => c.etat === "ATTEINT" && !c.preuve),
    joursRestants: o.echeance ? Math.round((o.echeance.getTime() - maintenant.getTime()) / 86_400_000) : null,
  };
}
