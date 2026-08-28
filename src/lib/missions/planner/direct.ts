import type { CapabilityBrief } from "@/lib/missions/ports";
import { jetons, jetonsEtendus } from "@/lib/missions/registry/resolve";
import type { Triage } from "@/lib/missions/planner/triage";
import type { MissionPlan } from "@/lib/missions/planner/contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CHEMIN DIRECT — quand une demande n'a pas besoin d'un plan, mais d'une lecture.
 *
 * ── LE CONSTAT ───────────────────────────────────────────────────────────────────────────
 *
 * « Fais le point sur les tâches ouvertes. » Cette phrase produit aujourd'hui : un appel de
 * planification (le maillon le plus lent, 79 % du temps mesuré), un plan de deux étapes, une
 * compilation, une exécution, un jugement. Le plan y est prévisible au point d'être écrit
 * d'avance — et le payer à un modèle, c'est payer un architecte pour ouvrir une porte.
 *
 * ── LA RÈGLE QUI GOUVERNE CE FICHIER : NE JAMAIS DEVINER ─────────────────────────────────
 *
 * C'est la doctrine de `commands/nl.ts`, et elle a été écrite après un défaut réel : attraper
 * une phrase qu'on comprend mal est PIRE que ne rien attraper, parce que cela empêche le modèle
 * de bien la traiter, en silence. Ici, la conséquence serait pire encore : répondre avec la
 * mauvaise source EN ANNONÇANT que c'est la bonne.
 *
 * D'où quatre verrous, tous nécessaires, aucun négociable :
 *
 *   1. le TRIAGE dit `DIRECT` — aucune écriture, aucun éventail, aucun enchaînement, aucun
 *      arbitrage, une seule proposition ;
 *   2. une capacité DOMINE — son score dépasse le plancher ET vaut au moins le double de la
 *      suivante. Deux capacités à égalité, c'est une ambiguïté : on rend des candidats au
 *      planificateur, jamais « la première des quatre » ;
 *   3. c'est une LECTURE NUE — `list_`, `read_`, `overview` : une capacité qui se contente de
 *      ses valeurs par défaut. Une `search_` exigerait une requête, et fabriquer une requête à
 *      partir d'une phrase française, c'est deviner ;
 *   4. l'effet ne dépasse pas `ANALYZE`, et le catalogue l'autorise à cet acteur.
 *
 * ── CE QUI REND L'ERREUR NON DANGEREUSE ──────────────────────────────────────────────────
 *
 * Le plan produit ici passe par le MÊME compilateur, la MÊME politique, le MÊME contrôle
 * qualité et le MÊME juge que n'importe quel plan de modèle. Le chemin direct ne contourne rien :
 * il propose. Et si le juge refuse de conclure, la mission repart en planification complète
 * (`runtime.ts`) — ce qui coûte une lecture de trop, jamais une réponse fausse.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * POURQUOI UN SECOND SCORE, ET POURQUOI CE N'EST PAS UNE SECONDE VÉRITÉ
 *
 * ── LA MESURE QUI L'A IMPOSÉ ─────────────────────────────────────────────────────────────
 *
 * Le premier jet réutilisait `scoreCapacite`, celui du résolveur. Sur le catalogue RÉEL, le
 * chemin direct ne s'est alors JAMAIS déclenché — pas une fois sur huit demandes évidentes.
 * La cause, relevée à la trace :
 *
 *     « Liste mes rappels »  →  directory_list = 7   contre   list_reminders = 7   → ambiguë
 *
 * Le verbe de la demande (« liste ») marque le PRÉFIXE du nom d'outil (`list_`), qui vaut 4
 * points. Or ce préfixe est partagé par le tiers du catalogue : il offre quatre points gratuits
 * à des dizaines de capacités sans rapport, et noie précisément le mot qui discrimine —
 * « rappels ». Le chemin direct existait, il était appelé, et il ne pouvait pas aboutir : la
 * définition même d'une brique morte (§14).
 *
 * ── DEUX QUESTIONS DIFFÉRENTES, DEUX SCORES ──────────────────────────────────────────────
 *
 * Le résolveur demande « lesquelles VAUT-IL LA PEINE de montrer ? » : il vise le rappel, il est
 * généreux, et son plancher par domaine existe justement pour repêcher des capacités qui ne
 * marquent rien. Le chemin direct demande « une seule est-elle CERTAINEMENT la réponse ? » : il
 * vise la précision, et une seule erreur y coûte une réponse fausse.
 *
 * Confondre ces deux questions est ce qui a produit le blocage ci-dessus. On garde donc le
 * résolveur intact — le catalogue montré au planificateur ne bouge pas d'un pouce, ce qui rend
 * la mesure avant/après lisible — et l'on pèse ici les jetons par leur RARETÉ.
 *
 * ── LA RARETÉ, ET POURQUOI ELLE N'EST PAS UNE LISTE DE MOTS VIDES ────────────────────────
 *
 * Un jeton présent dans quarante capacités ne dit rien ; présent dans une seule, il dit tout.
 * C'est calculé sur le catalogue VIVANT à chaque appel, pas écrit à la main : une table de mots
 * à ignorer vieillirait en silence, exactement comme la table « grenier → outil » qu'on a refusé
 * d'écrire dans `recovery-registry.ts`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LE PLANCHER ET LE RAPPORT, MESURÉS SUR LE CATALOGUE RÉEL.
 *
 * Relevé sur les 28 capacités ouvertes en lecture seule à une direction, huit demandes
 * ordinaires : celles qui aboutissent marquent 2,00 à 3,43 ; les capacités hors sujet qui les
 * suivent marquent 1,00 à 1,43. Le plancher à 1,2 écarte donc le bruit de fond, mais ce n'est
 * pas lui qui fait le travail — c'est le RAPPORT. Sur « liste mes e-mails récents », `read_email`
 * (5,42) et `list_emails` (5,14) restent trop proches : le chemin direct renonce, et c'est le
 * bon comportement, parce que ces deux-là ne répondent pas à la même question.
 *
 * Quatre demandes sur huit passent. C'est le chiffre honnête, et il est volontairement bas :
 * le taux de déclenchement n'est pas l'objectif, l'absence d'erreur l'est.
 */
export const PLANCHER_DOMINANCE = 1.2;
/** Le rapport minimal entre la première et la deuxième. En dessous, c'est une ambiguïté. */
export const RAPPORT_DOMINANCE = 2;

/**
 * COMBIEN DE CAPACITÉS EMPLOIENT CHAQUE JETON — la fréquence documentaire, calculée sur place.
 *
 * On compte par CAPACITÉ et non par occurrence : un résumé qui répète « rappels » trois fois ne
 * rend pas le mot plus commun dans le catalogue, il rend cette capacité-là plus concernée.
 */
export function frequences(briefs: readonly CapabilityBrief[]): Map<string, number> {
  const f = new Map<string, number>();
  for (const b of briefs) {
    for (const t of new Set(jetons(`${b.id} ${b.domain} ${b.summary}`))) {
      f.set(t, (f.get(t) ?? 0) + 1);
    }
  }
  return f;
}

/**
 * LE SCORE DISCRIMINANT.
 *
 * Même hiérarchie de place que le résolveur — le nom pèse plus que le domaine, qui pèse plus que
 * le résumé — mais chaque point est divisé par le nombre de capacités qui emploient le jeton.
 * Un mot unique garde sa valeur pleine ; un mot partagé par quarante outils tombe à 2,5 % de
 * celle-ci, ce qui est le poids qu'il mérite : celui d'un mot vide.
 */
export function scoreDiscriminant(
  brief: CapabilityBrief,
  demande: ReadonlySet<string>,
  freq: ReadonlyMap<string, number>,
): number {
  const rarete = (t: string) => 1 / Math.max(1, freq.get(t) ?? 1);
  let score = 0;
  for (const t of jetons(brief.id)) if (demande.has(t)) score += 4 * rarete(t);
  for (const t of jetons(brief.domain)) if (demande.has(t)) score += 3 * rarete(t);
  for (const t of jetons(brief.summary)) if (demande.has(t)) score += 1 * rarete(t);
  return score;
}

/**
 * CE QUI FAIT UNE LECTURE NUE.
 *
 * Le préfixe est une convention du catalogue, pas une supposition : `rangDeNom` dans
 * `recovery-registry.ts` s'appuie déjà sur elle pour classer les recours. `search_` en est
 * EXCLU volontairement — c'est une capacité qui attend une requête, et nous n'en avons pas.
 */
const estLectureNue = (id: string): boolean =>
  id.startsWith("list_") || id.startsWith("read_") || id.endsWith("_overview");

export interface Candidat {
  id: string;
  score: number;
}

export interface Verdict {
  /** Le plan, quand les quatre verrous cèdent. `null` sinon — et c'est le cas normal. */
  plan: MissionPlan | null;
  /** La capacité retenue, pour la trace. */
  capacite: string | null;
  /** Pourquoi on a renoncé. Toujours renseigné quand `plan` est nul. */
  refus: string | null;
  /** Les deux meilleures, pour que le journal montre l'écart qui a décidé. */
  candidats: Candidat[];
}

export interface ContexteDirect {
  /** Le catalogue vu par cet acteur, déjà filtré par les droits. */
  capacites: readonly CapabilityBrief[];
  /** Vrai si la capacité est ouverte à l'acteur — relu ici, pas supposé. */
  autorisee: (id: string) => boolean;
}

const renonce = (refus: string, candidats: Candidat[]): Verdict =>
  ({ plan: null, capacite: null, refus, candidats });

/**
 * DÉCIDE S'IL Y A UN CHEMIN DIRECT, ET LE CONSTRUIT.
 *
 * Pure : ni base, ni réseau, ni modèle. C'est ce qui permet d'en éprouver cinquante
 * formulations en une seconde — et c'est ce qui garantit qu'elle ne coûtera jamais ce qu'elle
 * est censée économiser.
 */
export function cheminDirect(demande: string, triage: Triage, ctx: ContexteDirect): Verdict {
  const mots = jetonsEtendus(demande);
  const freq = frequences(ctx.capacites);
  const notes = ctx.capacites
    .map((b) => ({ b, score: scoreDiscriminant(b, mots, freq) }))
    .sort((x, y) => y.score - x.score || x.b.id.localeCompare(y.b.id));
  const candidats: Candidat[] = notes.slice(0, 2)
    .map((n) => ({ id: n.b.id, score: Math.round(n.score * 100) / 100 }));

  // ── VERROU 1 — le triage ────────────────────────────────────────────────────────────
  if (triage.profil !== "DIRECT") {
    return renonce(`profil ${triage.profil} : ${triage.raisons[0] ?? "signaux composés"}`, candidats);
  }

  const tete = notes[0];
  if (!tete) return renonce("aucune capacité ouverte à cet acteur", candidats);

  // ── VERROU 2 — la dominance ─────────────────────────────────────────────────────────
  //
  // Les deux conditions disent deux choses différentes et il faut les deux : le plancher dit
  // « cette capacité concerne vraiment la demande », le rapport dit « et aucune autre ne la
  // concerne autant ». Une demande qui marque 12 et 11 est une demande AMBIGUË, même si elle
  // marque haut.
  const second = notes[1]?.score ?? 0;
  if (tete.score < PLANCHER_DOMINANCE) {
    return renonce(`aucune capacité ne domine (meilleur score ${tete.score.toFixed(2)} < ${PLANCHER_DOMINANCE})`, candidats);
  }
  if (tete.score < second * RAPPORT_DOMINANCE) {
    return renonce(`cible ambiguë : ${tete.b.id} (${tete.score.toFixed(2)}) contre ${notes[1].b.id} (${second.toFixed(2)})`, candidats);
  }

  // ── VERROU 3 — une lecture NUE, qui n'attend aucune requête ──────────────────────────
  if (!estLectureNue(tete.b.id)) {
    return renonce(`${tete.b.id} n'est pas une lecture nue : elle attend des paramètres qu'il faudrait deviner`, candidats);
  }

  // ── VERROU 4 — l'effet et le droit, relus au moment de décider ───────────────────────
  if (tete.b.effect !== "READ" && tete.b.effect !== "ANALYZE") {
    return renonce(`${tete.b.id} porte l'effet ${tete.b.effect} : hors du chemin direct`, candidats);
  }
  if (!ctx.autorisee(tete.b.id)) {
    return renonce(`${tete.b.id} n'est pas ouverte à cet acteur`, candidats);
  }

  return { plan: planDeLecture(demande, tete.b), capacite: tete.b.id, refus: null, candidats };
}

/**
 * LE PLAN D'UNE LECTURE — deux étapes, et pas une de plus.
 *
 * La première LIT ; la seconde RÉPOND. On ne fusionne pas les deux : la lecture est une capacité
 * de l'ERP, la réponse est un travail de modèle, et les confondre ferait d'un nœud de capacité un
 * nœud qui rédige — c'est-à-dire exactement le mélange que le contrat d'étape interdit.
 *
 * Le critère d'acceptation NOMME la source. Sans lui, le juge n'aurait rien à vérifier et
 * conclurait sur « la mission a fini de tourner » (§10) — la faute que tout le runtime évite.
 */
function planDeLecture(demande: string, cap: CapabilityBrief): MissionPlan {
  return {
    objective: demande.trim(),
    acceptance: [
      `La demande est traitée à partir de ${cap.id}, la source du domaine « ${cap.domain} ».`,
      "La réponse énonce ce qui a été lu, et dit explicitement ce qui manque le cas échéant.",
    ],
    // La complexité reste « A » : une lecture unique, sans arbitrage — c'est précisément ce que
    // le triage a vérifié avant d'autoriser ce chemin. L'échelle est déduite du plan, pas devinée.
    complexity: "A",
    scale: "S",
    steps: [
      {
        key: "lecture",
        title: `Lire : ${cap.summary}`,
        nodeType: "CAPABILITY",
        capability: cap.id,
        // AUCUN PARAMÈTRE. C'est le verrou 3 rendu littéral : la capacité tourne sur ses valeurs
        // par défaut, ou elle refuse franchement. Fabriquer une entrée ici serait deviner.
        input: {},
        dependsOn: [],
        completionCondition: `${cap.id} a rendu son résultat.`,
        approvalRequirement: "NONE",
      },
      {
        key: "reponse",
        title: "Répondre à la demande",
        nodeType: "WORKER",
        dependsOn: ["lecture"],
        completionCondition: "La demande a reçu une réponse fondée sur ce qui a été lu.",
        reasoningRequirement: "LIGHT",
        approvalRequirement: "NONE",
      },
    ],
    completionCriteria: `La lecture ${cap.id} a abouti et la réponse en découle.`,
    gaps: [],
  };
}
