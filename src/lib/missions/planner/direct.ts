import type { CapabilityBrief } from "@/lib/missions/ports";
import { jetons, jetonsEtendus } from "@/lib/missions/registry/resolve";
import { capabilityMeta } from "@/lib/missions/registry/capability-meta";
import type { Triage } from "@/lib/missions/planner/triage";
import type { MissionPlan, PlannedStep } from "@/lib/missions/planner/contract";

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
/**
 * Une lecture NUE n'attend aucune cible : on peut l'appeler sans rien deviner. Le préfixe ne
 * suffit pas à le dire — `read_document` commence par `read_` et EXIGE un nœud Drive : la
 * servir en lecture nue produirait un appel sans entrée, découvert à l'exécution. Le registre
 * porte la vérité : un contrat `CONTENU` désigne « le contenu d'UNE cible », donc jamais nu.
 */
const estLectureNue = (id: string): boolean =>
  (id.startsWith("list_") || id.startsWith("read_") || id.endsWith("_overview"))
  && capabilityMeta(id).contrat !== "CONTENU";

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
  /** Le plafond d'effet du catalogue (lecture seule = ANALYZE). `null` = pas de plafond. */
  plafondEffet?: string | null;
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

  // Les FORMES CONNUES se tentent à chaque renoncement : elles ne se recouvrent pas (la
  // lecture nue refuse toute requête, la RECHERCHE exige un terme cité ET plusieurs familles,
  // la FICHE exige un terme cité ET peu de familles ciblées), et l'ordre ne crée donc pas
  // d'ambiguïté — il crée des secondes chances déterministes.
  const formesConnues = (refus: string): Verdict => {
    const recherche = cheminDirectRecherche(demande, ctx);
    if (recherche.plan) return recherche;
    const fiche = cheminDirectFiche(demande, ctx);
    if (fiche.plan) return fiche;
    return renonce(`${refus} ; multi-sources : ${recherche.refus} ; fiche : ${fiche.refus}`, candidats);
  };

  // ── VERROU 1 — le triage ────────────────────────────────────────────────────────────
  if (triage.profil !== "DIRECT") {
    // La lecture nue exige le profil DIRECT ; les formes RECHERCHE et FICHE, elles, ont leurs
    // propres verrous (terme cité, lecture seule prouvée) et un profil composé ne les exclut
    // pas : « vérifie X dans quatre sources » est composé ET entièrement connu du logiciel.
    return formesConnues(`profil ${triage.profil} : ${triage.raisons[0] ?? "signaux composés"}`);
  }

  const renonceOuRecherche = formesConnues;

  const tete = notes[0];
  if (!tete) return renonceOuRecherche("aucune capacité ouverte à cet acteur");

  // ── VERROU 2 — la dominance ─────────────────────────────────────────────────────────
  //
  // Les deux conditions disent deux choses différentes et il faut les deux : le plancher dit
  // « cette capacité concerne vraiment la demande », le rapport dit « et aucune autre ne la
  // concerne autant ». Une demande qui marque 12 et 11 est une demande AMBIGUË, même si elle
  // marque haut.
  const second = notes[1]?.score ?? 0;
  if (tete.score < PLANCHER_DOMINANCE) {
    return renonceOuRecherche(`aucune capacité ne domine (meilleur score ${tete.score.toFixed(2)} < ${PLANCHER_DOMINANCE})`);
  }
  if (tete.score < second * RAPPORT_DOMINANCE) {
    return renonceOuRecherche(`cible ambiguë : ${tete.b.id} (${tete.score.toFixed(2)}) contre ${notes[1].b.id} (${second.toFixed(2)})`);
  }

  // ── VERROU 3 — une lecture NUE, qui n'attend aucune requête ──────────────────────────
  if (!estLectureNue(tete.b.id)) {
    return renonceOuRecherche(`${tete.b.id} n'est pas une lecture nue : elle attend des paramètres qu'il faudrait deviner`);
  }
  // LE CONTRAT D'ENTRÉE, quand le catalogue le connaît, prime sur la liste de noms : une
  // capacité qui EXIGE un champ ne tourne pas « sur ses valeurs par défaut », et le compilateur
  // refuserait de toute façon l'entrée vide (INVALID_INPUT). Autant renoncer ici, avant de payer.
  const exiges = (tete.b.entrees?.champs ?? []).filter((c) => c.requis).map((c) => c.nom);
  if (exiges.length > 0) {
    return renonceOuRecherche(`${tete.b.id} exige ${exiges.map((n) => `« ${n} »`).join(", ")} : le chemin direct ne fabrique pas d'entrée`);
  }

  // ── VERROU 4 — l'effet et le droit, relus au moment de décider ───────────────────────
  if (tete.b.effect !== "READ" && tete.b.effect !== "ANALYZE") {
    return renonceOuRecherche(`${tete.b.id} porte l'effet ${tete.b.effect} : hors du chemin direct`);
  }
  if (!ctx.autorisee(tete.b.id)) {
    return renonceOuRecherche(`${tete.b.id} n'est pas ouverte à cet acteur`);
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

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA VÉRIFICATION MULTI-SOURCES — la deuxième forme du chemin direct (chantier latence).
 *
 * ── CE QUI A CHANGÉ DEPUIS L'EXCLUSION DE `search_` ──────────────────────────────────────
 *
 * Le verrou 3 excluait les recherches : « fabriquer une requête à partir d'une phrase
 * française, c'est deviner ». C'était vrai, et ça le reste. Ce qui a changé : quand la demande
 * CITE son terme — « vérifie si nous avons quoi que ce soit sur « X » » — la requête n'est
 * plus fabriquée, elle est LUE, verbatim. L'Information Fabric a rendu le reste connu du
 * logiciel : les sources sont des capacités `search_*` du catalogue (convention `query`,
 * la même que `list_`/`read_` pour la lecture nue), le plafond d'effet est porté par le
 * catalogue, la sortie attendue est une conclusion structurée.
 *
 * Un run réel a payé 22,0 s de planification + 7,9 s de replanification pour produire
 * EXACTEMENT ce plan : quatre recherches parallèles, une jonction, une conclusion. Le modèle
 * décidait un QUOI que le logiciel connaissait déjà (§5 : models decide WHAT, code does HOW —
 * ici, le QUOI même était connu).
 *
 * ── LES VERROUS — tous nécessaires, aucun négociable ─────────────────────────────────────
 *
 *   R1. UN terme cité, exactement — deux termes ou zéro, c'est une ambiguïté : on renonce.
 *   R2. Une INTENTION de recherche/vérification explicite (vérifie, cherche, trouve…).
 *   R3. LECTURE SEULE PROUVÉE : le plafond du catalogue est ≤ ANALYZE, ou la demande le dit
 *       (« ne modifie rien », « lecture seule ») — ET, une fois les négations retirées,
 *       aucun verbe d'effet ne survit dans la demande. Le doute renonce.
 *   R4. La demande vise PLUSIEURS familles de sources (ou « quoi que ce soit ») — une
 *       recherche qui nomme UNE source ou impose un ORDRE (« commence par… ») garde son
 *       planificateur : la stratégie lui appartient.
 *   R5. Au moins DEUX capacités de recherche ouvertes à cet acteur, effet ≤ ANALYZE.
 *
 * Le plan produit passe par le MÊME compilateur, la même politique, le même contrôle qualité
 * que n'importe quel plan de modèle — le chemin direct PROPOSE, il ne contourne rien. Ses
 * critères d'acceptation sont des RÈGLES (`[REGLE:…]`) vérifiables sur les reçus structurés :
 * c'est ce qui permet, en aval, de conclure sans appel de juge — sans jamais affaiblir la
 * vérification, puisque les reçus prouvent ce qu'une prose ne pouvait qu'affirmer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Le terme CITÉ — un seul, sinon rien. Guillemets français ou droits. */
export function termeCite(demande: string): { terme: string | null; nombre: number } {
  const francais = [...demande.matchAll(/«\s*([^«»]{2,120}?)\s*»/g)].map((m) => m[1].trim());
  const droits = [...demande.matchAll(/"([^"]{2,120})"/g)].map((m) => m[1].trim());
  const uniques = [...new Set([...francais, ...droits].filter(Boolean))];
  return { terme: uniques.length === 1 ? uniques[0] : null, nombre: uniques.length };
}

const INTENTION_RECHERCHE = /\b(v[ée]rifie[rz]?|recherche[rz]?|cherche[rz]?|trouve[rz]?|retrouve[rz]?|inventorie[rz]?|avons[- ]nous|a[- ]t[- ]on|existe[- ]t[- ]il)\b/i;

const PHRASE_LECTURE_SEULE = /ne\s+(?:modifie|change)\s+rien|n['’][ée]cris\s+rien|lecture\s+seule|sans\s+rien\s+(?:modifier|[ée]crire)/i;

/**
 * RETIRE les clauses de négation avant de chercher des verbes d'effet : « ne contacte
 * personne », « ne modifie rien », « ne produis aucun fichier » sont des CONTRAINTES de
 * lecture seule, pas des demandes d'action — les scanner telles quelles ferait renoncer
 * exactement les demandes que cette forme doit servir.
 */
export function sansClausesNegatives(demande: string): string {
  return demande
    .replace(/\bne\s+\p{L}+\s+(?:rien|personne|aucune?\s+\p{L}+)\b/giu, " ")
    .replace(/\bn['’]\p{L}+\s+(?:rien|personne|aucune?\s+\p{L}+)\b/giu, " ")
    .replace(/\baucune?\s+\p{L}+\b/giu, " ");
}

/**
 * Les verbes qui trahissent une demande d'EFFET. Après retrait des négations, un seul suffit à
 * renoncer. Les formes qui sont AUSSI des noms courants (« produit », « envoi », « la paie »)
 * sont volontairement ABSENTES : « vérifie le produit » n'est pas une demande de production,
 * et les attraper ferait renoncer exactement les demandes que cette forme doit servir. Les
 * impératifs sans homonyme (« produis », « envoie ») suffisent — et le doute renonce toujours.
 */
const VERBES_EFFET = /\b(envoie[rz]?|envoyer|[ée]cris|r[ée]dige[rz]?|cr[ée]{2}[rz]?|modifie[rz]?|supprime[rz]?|ajoute[rz]?|planifie[rz]?|programme[rz]?|contacte[rz]?|g[ée]n[èe]re[rz]?|produis|t[ée]l[ée]verse[rz]?|payer|valide[rz]?|approuve[rz]?|assigne[rz]?|transf[èe]re[rz]?)\b/iu;

/**
 * Les FAMILLES de sources qu'une demande peut nommer. Servent uniquement au verrou R4
 * (« la demande vise-t-elle PLUSIEURS greniers ? ») — jamais à choisir les capacités,
 * qui viennent du catalogue réel.
 */
const FAMILLES_SOURCES: readonly (readonly string[])[] = [
  ["produit", "produits", "dci", "portefeuille"],
  ["dossier", "dossiers", "r[ée]glementaire", "regulatory"],
  ["march[ée]", "march[ée]s", "pch", "affaire", "affaires"],
  ["document", "documents", "drive", "fichier", "fichiers"],
  ["corpus", "connaissance"],
  ["courrier", "courriers", "mail", "e-mail"],
  ["contrat", "contrats", "legal"],
  ["t[âa]che", "t[âa]ches"],
  // Étendues après le Deep Smoke du 2026-08-29 : les fiches Finances et RH citaient leurs
  // familles et aucune forme ne les reconnaissait. Servent aux verrous R4/F3 — jamais à
  // choisir les capacités, qui viennent toujours du catalogue réel.
  ["facture", "factures", "r[èe]glement", "r[èe]glements", "paiement", "paiements"],
  ["employ[ée]", "employ[ée]s", "salari[ée]", "salari[ée]s", "cong[ée]", "cong[ée]s"],
];

/** Les familles que la demande NOMME — la liste, pour que la forme FICHE cible ses recherches. */
export function famillesVisees(demande: string): (readonly string[])[] {
  return FAMILLES_SOURCES.filter((famille) =>
    famille.some((mot) => new RegExp(`\\b${mot}\\b`, "iu").test(demande)));
}

export function famillesNommees(demande: string): number {
  return famillesVisees(demande).length;
}

const BALAYAGE_GENERAL = /quoi\s+que\s+ce\s+soit|tout\s+ce\s+que|toutes\s+les\s+sources|o[uù]\s+que\s+ce\s+soit|partout/i;
const ORDRE_IMPOSE = /commence[rz]?\s+par|d['’]abord|ensuite|puis\s+(?:seulement|va|cherche)/i;

/** L'ordre de préférence des recherches — les fédérées d'abord, puis alphabétique. Déterministe. */
const PREFERENCE_RECHERCHE = ["search_everything", "search_products", "search_drive", "find_documents"];

function capacitesDeRecherche(ctx: ContexteDirect): CapabilityBrief[] {
  const eligibles = ctx.capacites.filter((b) =>
    (b.id.startsWith("search_") || b.id === "find_documents")
    && (b.effect === "READ" || b.effect === "ANALYZE")
    && ctx.autorisee(b.id));
  const rang = (id: string): number => {
    const i = PREFERENCE_RECHERCHE.indexOf(id);
    return i === -1 ? PREFERENCE_RECHERCHE.length : i;
  };
  return [...eligibles]
    .sort((a, b) => rang(a.id) - rang(b.id) || a.id.localeCompare(b.id))
    .slice(0, 6);
}

/** DÉCIDE s'il y a une vérification multi-sources directe, et la construit. Pure, comme l'autre forme. */
export function cheminDirectRecherche(demande: string, ctx: ContexteDirect): Verdict {
  const aucun = (refus: string): Verdict => ({ plan: null, capacite: null, refus, candidats: [] });

  // ── R1 — le terme, cité et unique ─────────────────────────────────────────────────────
  const { terme, nombre } = termeCite(demande);
  if (!terme) {
    return aucun(nombre === 0
      ? "aucun terme cité entre guillemets : la requête serait devinée"
      : `${nombre} termes cités : ambiguïté, le planificateur tranche`);
  }

  // ── R2 — l'intention de recherche ─────────────────────────────────────────────────────
  if (!INTENTION_RECHERCHE.test(demande)) {
    return aucun("aucune intention de recherche explicite");
  }

  // ── R3 — la lecture seule, PROUVÉE ────────────────────────────────────────────────────
  const plafondLecture = ctx.plafondEffet === "READ" || ctx.plafondEffet === "ANALYZE";
  if (!plafondLecture && !PHRASE_LECTURE_SEULE.test(demande)) {
    return aucun("lecture seule non prouvée (ni plafond du catalogue, ni phrase explicite)");
  }
  const residuel = sansClausesNegatives(demande).match(VERBES_EFFET);
  if (residuel) {
    return aucun(`verbe d'effet dans la demande (« ${residuel[0]} ») : hors du chemin direct`);
  }

  // ── R4 — plusieurs familles visées, aucune stratégie imposée ──────────────────────────
  if (ORDRE_IMPOSE.test(demande)) {
    return aucun("la demande impose un ordre de sources : la stratégie appartient au planificateur");
  }
  // UNE famille nommée = une recherche CIBLÉE, même accompagnée de « quoi que ce soit » : le
  // balayage général ne sauve que le cas où AUCUNE famille ne borne la portée.
  const familles = famillesNommees(demande);
  if (familles === 1) {
    return aucun("une seule famille de sources visée : recherche ciblée, pas une vérification multi-sources");
  }
  if (familles === 0 && !BALAYAGE_GENERAL.test(demande)) {
    return aucun("aucune famille de sources visée ni balayage général demandé");
  }

  // ── R5 — les capacités, relues sur le catalogue réel ──────────────────────────────────
  const caps = capacitesDeRecherche(ctx);
  if (caps.length < 2) {
    return aucun(`${caps.length} capacité(s) de recherche ouverte(s) : pas de quoi couvrir plusieurs sources`);
  }

  return {
    plan: planDeRecherche(demande, terme, caps),
    capacite: `recherche-multi-sources (${caps.length} sources)`,
    refus: null,
    candidats: caps.slice(0, 2).map((c) => ({ id: c.id, score: 0 })),
  };
}

/**
 * LE PLAN D'UNE VÉRIFICATION MULTI-SOURCES — recherches PARALLÈLES, jonction, UNE conclusion.
 *
 * Les critères d'acceptation sont des RÈGLES : chacune se vérifie sur les reçus structurés
 * des étapes (requête exacte partie, aucun effet au-delà d'ANALYZE, sortie structurée de la
 * conclusion). Le texte humain qui les suit reste lisible par un juge LLM — si la
 * vérification déterministe n'existe pas encore en aval, le critère se juge comme avant :
 * la règle est un GAIN quand elle est branchée, jamais une dépendance.
 */
function planDeRecherche(demande: string, terme: string, caps: readonly CapabilityBrief[]): MissionPlan {
  const recherches = caps.map((c) => ({
    key: `recherche-${c.id.replace(/_/g, "-")}`,
    title: `Rechercher « ${terme} » via ${c.id}`,
    nodeType: "CAPABILITY" as const,
    capability: c.id,
    // La requête est le terme CITÉ, verbatim — c'est le verrou R1 rendu littéral. La
    // convention `query` est celle de toutes les capacités `search_*` du catalogue.
    input: { query: terme },
    dependsOn: [] as string[],
    completionCondition: `${c.id} a rendu son résultat pour « ${terme} ».`,
    approvalRequirement: "NONE" as const,
  }));

  const clesRecherches = recherches.map((r) => r.key);

  return {
    objective: demande.trim(),
    acceptance: [
      `[REGLE:RECHERCHES_AVEC_REQUETE:${clesRecherches.join(",")}] Chaque étape citée a interrogé sa source `
      + `avec « ${terme} » exactement — preuve : la requête portée par le reçu de chaque étape.`,
      "[REGLE:AUCUNE_ECRITURE] Aucun reçu d'étape ne porte d'effet au-delà d'ANALYZE : la mission "
      + "n'a rien écrit, rien envoyé, rien produit.",
      "[REGLE:SORTIE_STRUCTUREE:conclure:trouve,conclusion,sources] L'étape « conclure » a rendu une "
      + "sortie structurée qui tranche (trouve OUI/NON), énonce la conclusion et cite ses sources.",
    ],
    // La difficulté reste « B » : le plan est évident, la SYNTHÈSE ne l'est pas — c'est elle
    // qui reçoit le raisonnement. L'échelle S : moins de dix étapes.
    complexity: "B",
    scale: "S",
    steps: [
      ...recherches,
      {
        key: "jonction",
        title: "Réunir les résultats de toutes les recherches",
        nodeType: "JOIN",
        dependsOn: clesRecherches,
        completionCondition: "Toutes les recherches sont terminées.",
        approvalRequirement: "NONE",
      },
      {
        key: "conclure",
        title: `Conclure sur « ${terme} » à partir des résultats réunis`,
        nodeType: "WORKER",
        dependsOn: ["jonction"],
        completionCondition: "La conclusion structurée est rendue, sources citées.",
        reasoningRequirement: "HEAVY",
        approvalRequirement: "NONE",
        expectedOutputSchema: {
          type: "object",
          properties: {
            trouve: { type: "boolean", description: `Vrai si au moins une source contient quelque chose sur « ${terme} ».` },
            conclusion: { type: "string", description: "La conclusion, en français, fondée uniquement sur les résultats réunis — présence détaillée, ou absence documentée." },
            sources: { type: "array", items: { type: "string" }, description: "Les sources interrogées, nommées une à une." },
          },
          required: ["trouve", "conclusion", "sources"],
          additionalProperties: false,
        },
      },
    ],
    completionCriteria: `Chaque source a été interrogée avec « ${terme} » et la conclusion structurée en découle.`,
    gaps: [],
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA FICHE — la troisième forme du chemin direct (Deep Smoke 2026-08-29).
 *
 * ── LA MESURE QUI L'A IMPOSÉE ────────────────────────────────────────────────────────────
 *
 * Le Deep Smoke a joué 54 missions réelles : les 12 passées par le chemin direct ont conclu
 * en 2-4 s ; les fiches ciblées — « où en est la tâche « X » ? », « fais le point sur la
 * facture « X » », « retrouve le document « X » » — ont payé 20 à 104 s de planification et
 * de jugement pour un plan que le logiciel connaissait : chercher le terme cité dans la
 * famille nommée, puis répondre depuis les reçus. L'une d'elles (TACHES) n'a même reçu AUCUN
 * plan exploitable du modèle. C'est une FORME de problème connue (§1 du mandat performance) :
 * on la compile, on ne la fait pas raisonner.
 *
 * ── EN QUOI ELLE DIFFÈRE DES DEUX AUTRES, ET POURQUOI ELLES NE SE RECOUVRENT PAS ─────────
 *
 * La lecture nue refuse toute requête. La RECHERCHE exige un terme cité ET une portée
 * multi-sources (≥ 2 familles ou balayage), et sa question — « en avons-nous ? » — se juge
 * ENTIÈREMENT sur les reçus : critères tout-règles, zéro juge. La FICHE exige un terme cité
 * ET une portée CIBLÉE (≥ 1 famille nommée), et sa question — « où en est X ? » — demande une
 * SYNTHÈSE dont la fidélité ne se vérifie pas à l'arithmétique : son dernier critère reste
 * SÉMANTIQUE, et le juge LLM le garde. Un appel de juge est le prix de la qualité (la règle
 * ultime) ; il reste ~5× moins cher que le chemin planifié qu'il remplace.
 *
 * ── LES VERROUS — le doute renonce, toujours ─────────────────────────────────────────────
 *
 *   F1. UN terme cité, exactement (le même verrou que R1).
 *   F2. Une intention de CONSULTATION ou de recherche explicite.
 *   F3. Lecture seule PROUVÉE + aucun verbe d'effet résiduel (le même verrou que R3).
 *   F4. Au moins UNE famille nommée, aucun ordre imposé.
 *   F5. Aucune demande de PROFONDEUR (« historique », « qui a fait », « quelles étapes
 *       restent », comparaisons) : ces questions exigent des lectures qu'une recherche ne
 *       fournit pas — répondre plus vite mais moins bien serait la triche que §35 interdit.
 *   F6. Au moins UNE capacité de recherche couvrant la famille (fédérées comprises).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const INTENTION_CONSULTATION = /\b(o[uù]\s+en\s+(?:est|sont)|fai(?:s|tes)\s+le\s+point|montre[rz]?|r[ée]sume[rz]?|donne[- ](?:moi|nous)|que\s+savons[- ]nous|dis[- ]moi)\b/iu;

/**
 * Les demandes de PROFONDEUR qu'une recherche ne sait pas servir. La liste est courte et
 * SÛRE — en attraper trop enverrait au planificateur des fiches qu'on sait compiler, en
 * attraper trop peu ferait répondre une synthèse pauvre à une question riche. Chaque mot est
 * un signal certain d'un besoin de lectures profondes (journal, étapes, comparaison).
 */
const PROFONDEUR_ANALYSE = /\bhistorique\b|qui\s+a\s+fait|depuis\s+sa\s+cr[ée]ation|compare[rz]?\b|comparaison|pourquoi\b|[ée]tapes\s+(?:restent|franchies|suivantes)|que\s+faut[- ]il\s+faire|raconte[rz]?\b|\baudit\b/iu;

/** Les recherches qui COUVRENT les familles visées : les fédérées toujours, les autres si leur fiche catalogue croise les mots de la famille. */
function capacitesPourFamilles(ctx: ContexteDirect, familles: readonly (readonly string[])[]): CapabilityBrief[] {
  const FEDEREES = new Set(["search_everything", "find_documents"]);
  const couvre = (b: CapabilityBrief): boolean => {
    if (FEDEREES.has(b.id)) return true;
    const fiche = `${b.id.replace(/_/g, " ")} ${b.domain} ${b.summary}`;
    return familles.some((famille) => famille.some((mot) => new RegExp(`\\b${mot}`, "iu").test(fiche)));
  };
  return capacitesDeRecherche(ctx).filter(couvre).slice(0, 4);
}

/** DÉCIDE s'il y a une fiche directe, et la construit. Pure, comme les deux autres formes. */
export function cheminDirectFiche(demande: string, ctx: ContexteDirect): Verdict {
  const aucun = (refus: string): Verdict => ({ plan: null, capacite: null, refus, candidats: [] });

  // ── F1 — le terme, cité et unique ─────────────────────────────────────────────────────
  const { terme, nombre } = termeCite(demande);
  if (!terme) {
    return aucun(nombre === 0
      ? "aucun terme cité entre guillemets : la cible serait devinée"
      : `${nombre} termes cités : ambiguïté, le planificateur tranche`);
  }

  // ── F2 — l'intention de consultation ──────────────────────────────────────────────────
  if (!INTENTION_CONSULTATION.test(demande) && !INTENTION_RECHERCHE.test(demande)) {
    return aucun("aucune intention de consultation explicite");
  }

  // ── F3 — la lecture seule, PROUVÉE (le même verrou que la forme RECHERCHE) ────────────
  const plafondLecture = ctx.plafondEffet === "READ" || ctx.plafondEffet === "ANALYZE";
  if (!plafondLecture && !PHRASE_LECTURE_SEULE.test(demande)) {
    return aucun("lecture seule non prouvée (ni plafond du catalogue, ni phrase explicite)");
  }
  const residuel = sansClausesNegatives(demande).match(VERBES_EFFET);
  if (residuel) {
    return aucun(`verbe d'effet dans la demande (« ${residuel[0]} ») : hors du chemin direct`);
  }

  // ── F4 — une portée ciblée, aucune stratégie imposée ──────────────────────────────────
  if (ORDRE_IMPOSE.test(demande)) {
    return aucun("la demande impose un ordre de sources : la stratégie appartient au planificateur");
  }
  const familles = famillesVisees(demande);
  if (familles.length === 0) {
    return aucun("aucune famille de sources nommée : la cible serait devinée");
  }
  if (familles.length > 2) {
    // Une portée MULTI-SOURCES appartient à la forme RECHERCHE (qui exige ≥ 2 capacités pour
    // la couvrir) ou au planificateur : conclure « rien nulle part » depuis une seule
    // recherche serait affirmer une couverture qu'on n'a pas (§10).
    return aucun(`${familles.length} familles visées : portée multi-sources, hors de la fiche ciblée`);
  }

  // ── F5 — pas de demande de profondeur ─────────────────────────────────────────────────
  const profond = demande.match(PROFONDEUR_ANALYSE);
  if (profond) {
    return aucun(`demande de profondeur (« ${profond[0]} ») : les lectures nécessaires dépassent une recherche`);
  }

  // ── F6 — les capacités couvrant la famille, relues sur le catalogue réel ──────────────
  const caps = capacitesPourFamilles(ctx, familles);
  if (caps.length === 0) {
    return aucun("aucune capacité de recherche ne couvre la famille nommée");
  }

  const lecteur = lecteurPourFamilles(ctx, familles);
  return {
    plan: planDeFiche(demande, terme, caps, lecteur),
    capacite: `fiche-ciblee (${caps.length} recherche(s)${lecteur ? ` + lecture ${lecteur.id}` : ""})`,
    refus: null,
    candidats: caps.slice(0, 2).map((c) => ({ id: c.id, score: 0 })),
  };
}

/**
 * LE LECTEUR D'UNE FICHE — la capacité qui HYDRATE les cibles que les recherches ont trouvées.
 *
 * Le Run 3 a mesuré la limite de la fiche sans lecture : POINT_EMPLOYE 0/6, DOCUMENT_DRIVE 1/6,
 * LEGAL 1/5 — le juge déclarait les synthèses « honnêtes mais insuffisantes », parce qu'elles
 * étaient bâties sur les seuls TITRES des résultats de recherche. Le pipeline complet est
 * RECHERCHER → CIBLER → LIRE → RÉPONDRE : la recherche trouve des candidats, la lecture les
 * hydrate, la synthèse s'appuie sur du CONTENU. Le lecteur est choisi sur le catalogue RÉEL :
 * `read_document` quand la famille est documentaire, `inspect_record` (universel) sinon —
 * et s'il n'existe pas ou n'est pas ouvert à l'acteur, la fiche RENONCE à lire et le plan
 * retombe sur sa forme recherche-seule : une synthèse pauvre annoncée vaut mieux qu'un plan
 * qui ne compile pas.
 */
function lecteurPourFamilles(
  ctx: ContexteDirect,
  familles: readonly (readonly string[])[],
): { id: string; entree: (ref: string) => Record<string, unknown> } | null {
  const documentaire = familles.some((f) => f.includes("document"));
  const candidats = documentaire
    ? [
      { id: "read_document", entree: (ref: string) => ({ driveNodeId: ref }) },
      { id: "inspect_record", entree: (ref: string) => ({ reference: ref }) },
    ]
    : [{ id: "inspect_record", entree: (ref: string) => ({ reference: ref }) }];
  for (const c of candidats) {
    if (ctx.capacites.some((b) => b.id === c.id) && ctx.autorisee(c.id)) return c;
  }
  return null;
}

/**
 * LE PLAN D'UNE FICHE — RECHERCHER → CIBLER → LIRE → RÉPONDRE, la synthèse jugée.
 *
 * ── POURQUOI CETTE FORME, ET PLUS L'ANCIENNE (recherches → jonction → synthèse) ─────────
 *
 * Deux découvertes du Run 3, l'une de mesure, l'autre de code :
 *   1. Les synthèses bâties sur les seuls résultats de RECHERCHE étaient jugées « honnêtes
 *      mais insuffisantes » — les recherches rendent des titres, pas des contenus.
 *   2. Pire : le worker de synthèse ne voyait même pas ces résultats-là. `specifier` ne remet
 *      à un worker que les résultats de ses dépendances DIRECTES, et il dépendait d'une
 *      JONCTION — qui ne produit rien. La forme v2 supprime la jonction (dépendre de toutes
 *      les recherches EST la synchronisation) et branche chaque worker sur ce qu'il doit lire.
 *
 * Le pipeline est générique (§18) : chercher produit des CANDIDATS, `cibler` en retient
 * (0 à 3, identifiants RECOPIÉS, jamais inventés), `lire` les HYDRATE en éventail — un reçu
 * par lecture — et `repondre` s'appuie sur du CONTENU. Ce qui n'a pas pu être ciblé ou lu est
 * DIT : une absence dite est une réponse recevable (§28), inventer ne l'est pas.
 *
 * Trois critères sont des RÈGLES vérifiées sur les reçus ; le quatrième est SÉMANTIQUE et
 * c'est un choix, pas un oubli : « la synthèse répond-elle à la question ? » ne se compte
 * pas — la juger est ce qui autorise cette forme à servir des questions ouvertes sans
 * jamais répondre plus vite au prix de répondre moins bien.
 */
function planDeFiche(
  demande: string,
  terme: string,
  caps: readonly CapabilityBrief[],
  lecteur: { id: string; entree: (ref: string) => Record<string, unknown> } | null,
): MissionPlan {
  const recherches = caps.map((c) => ({
    key: `recherche-${c.id.replace(/_/g, "-")}`,
    title: `Rechercher « ${terme} » via ${c.id}`,
    nodeType: "CAPABILITY" as const,
    capability: c.id,
    input: { query: terme },
    dependsOn: [] as string[],
    completionCondition: `${c.id} a rendu son résultat pour « ${terme} ».`,
    approvalRequirement: "NONE" as const,
  }));
  const clesRecherches = recherches.map((r) => r.key);

  const etapesLecture: PlannedStep[] = lecteur === null ? [] : [
    {
      key: "cibler",
      title: `Choisir les cibles à lire pour « ${terme} »`,
      nodeType: "WORKER",
      dependsOn: [...clesRecherches],
      completionCondition: "La liste des cibles (0 à 3) est rendue, chaque identifiant RECOPIÉ "
        + "tel quel d'un résultat de recherche — et ce qui n'a pas pu être ciblé est dit.",
      reasoningRequirement: "LIGHT",
      approvalRequirement: "NONE",
      expectedOutputSchema: {
        type: "object",
        properties: {
          cibles: {
            type: "array",
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "L'identifiant EXACT tel qu'il figure dans un résultat de recherche (id, référence, nœud Drive) — recopié, jamais inventé ni reconstruit." },
                titre: { type: "string", description: "Le titre du résultat, pour l'audit." },
              },
              required: ["id", "titre"],
              additionalProperties: false,
            },
            description: `Les résultats qui correspondent à « ${terme} », les plus pertinents d'abord. VIDE si aucun résultat ne porte d'identifiant exploitable.`,
          },
          manque: { type: "string", description: "Ce qui n'a PAS pu être ciblé et pourquoi (aucun résultat, pas d'identifiant) — chaîne vide sinon." },
        },
        required: ["cibles", "manque"],
        additionalProperties: false,
      },
    },
    {
      key: "lire",
      title: `Lire chaque cible retenue (${lecteur.id})`,
      nodeType: "CAPABILITY",
      capability: lecteur.id,
      input: lecteur.entree("{{cible.id}}"),
      dependsOn: ["cibler"],
      forEach: { from: "cibler", path: "cibles", as: "cible" },
      completionCondition: "Chaque cible retenue a été lue, ou son échec de lecture est dit.",
      approvalRequirement: "NONE",
    },
  ];

  return {
    objective: demande.trim(),
    acceptance: [
      `[REGLE:RECHERCHES_AVEC_REQUETE:${clesRecherches.join(",")}] Chaque étape citée a interrogé sa source `
      + `avec « ${terme} » exactement — preuve : la requête portée par le reçu de chaque étape.`,
      "[REGLE:AUCUNE_ECRITURE] Aucun reçu d'étape ne porte d'effet au-delà d'ANALYZE : la mission "
      + "n'a rien écrit, rien envoyé, rien produit.",
      "[REGLE:SORTIE_STRUCTUREE:repondre:trouve,synthese,sources] L'étape « repondre » a rendu une "
      + "sortie structurée (trouve OUI/NON, synthèse, sources).",
      `La synthèse répond à la question posée sur « ${terme} » : ce qui est établi l'est avec sa `
      + "provenance (recherches et lectures), et ce qui n'a pas été retrouvé — ou n'a pas pu être "
      + "lu — est dit explicitement. Une absence DITE est une réponse recevable ; une invention ne "
      + "l'est jamais.",
    ],
    complexity: "B",
    scale: "S",
    steps: [
      ...recherches,
      ...etapesLecture,
      {
        key: "repondre",
        title: `Répondre sur « ${terme} » à partir des résultats et des lectures`,
        nodeType: "WORKER",
        dependsOn: lecteur === null ? [...clesRecherches] : [...clesRecherches, "lire"],
        completionCondition: "La synthèse structurée est rendue — provenance citée, manques dits.",
        reasoningRequirement: "HEAVY",
        approvalRequirement: "NONE",
        expectedOutputSchema: {
          type: "object",
          properties: {
            trouve: { type: "boolean", description: `Vrai si les recherches ou les lectures ont établi quelque chose sur « ${terme} ».` },
            synthese: { type: "string", description: "La réponse à la question posée, en français, fondée uniquement sur les résultats et lectures reçus — chaque fait avec sa provenance, chaque manque (non trouvé, illisible) dit explicitement." },
            sources: { type: "array", items: { type: "string" }, description: "Les sources interrogées ou lues, nommées une à une." },
          },
          required: ["trouve", "synthese", "sources"],
          additionalProperties: false,
        },
      },
    ],
    completionCriteria: `Les recherches sur « ${terme} » ont abouti, les cibles pertinentes ont été lues (ou leur absence dite), et la synthèse structurée répond à la demande.`,
    gaps: [],
  };
}
