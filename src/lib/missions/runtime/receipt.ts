import { cheminsDeListes } from "@/lib/missions/runtime/collection";
import type { Effect } from "@/lib/missions/registry/capability-meta";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE REÇU D'EXÉCUTION — ce que le CODE a constaté, pour que le juge n'ait pas à le croire.
 *
 * ── LES TROIS ÉCHECS QUI ONT PRODUIT CE FICHIER ─────────────────────────────────────────
 *
 * Un run Render, trois scénarios, trois refus du juge — et le même défaut derrière les trois :
 *
 *   RECOURS          « Aucun message n'est envoyé et aucune donnée n'est modifiée » :
 *                    critère SANS PREUVE. Or la mission tournait sous plafond ANALYZE et
 *                    n'avait exécuté que des lectures. Le runtime le SAVAIT. Le juge, non.
 *
 *   PREUVE_ABSENCE   le livrable est fabriqué et contrôlé (« XLSX, 10 Ko »), et une étape
 *                    ultérieure rend `artifactFound:false`. Le juge voit deux proses qui se
 *                    contredisent et refuse — à juste titre, faute de fait opposable.
 *
 *   SATISFIABLE      une étape de contrôle en échec « contredit » un critère, parce qu'elle
 *                    apparaît comme `- clé (FAILED)` sans rien qui dise ce qui a été mesuré.
 *
 * Dans les trois cas la mission a ensuite brûlé des replanifications à faire RÉÉCRIRE EN PROSE,
 * par un modèle, un fait que le code détenait déjà. C'est cher, c'est lent, et c'est faillible :
 * une prose peut se tromper, un reçu non.
 *
 * ── LA RÈGLE QUI GOUVERNE TOUT LE FICHIER ────────────────────────────────────────────────
 *
 * `resultCount: null` N'EST PAS `0`.
 *
 * Zéro est une AFFIRMATION — « nous avons cherché et il n'y a rien » — et c'est précisément ce
 * qu'une preuve d'absence doit pouvoir dire. `null` est une ABSENCE DE MESURE — « nous n'avons
 * pas su compter ». Les confondre fabriquerait de la preuve négative à partir d'un résultat
 * qu'on n'a pas su lire, ce qui est pire que de n'en produire aucune : le juge conclurait à
 * l'absence sur la foi d'un défaut de parsing.
 *
 * C'est la même règle que §78 pour les jetons (`null` = non mesuré, jamais zéro), et c'est la
 * même raison : un tableau de bord qui affiche un chiffre inventé fait prendre de vraies
 * décisions sur des faux chiffres.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * L'ISSUE D'UN APPEL, DU POINT DE VUE DU CODE.
 *
 * `VIDE` est distinct de `SUCCES` À DESSEIN : c'est lui qui porte la preuve d'absence, et le
 * juge doit pouvoir le citer sans avoir à interpréter un compte. `INDETERMINE` est l'aveu —
 * l'appel a abouti, et nous n'avons pas su dire combien de choses il a rendues.
 */
export const ISSUES = ["SUCCES", "VIDE", "ECHEC", "INDETERMINE"] as const;
export type Issue = (typeof ISSUES)[number];

export interface ExecutionReceipt {
  /** La capacité appelée. `null` pour un nœud qui n'en appelle pas (worker, jonction). */
  capability: string | null;
  /**
   * L'EFFET RÉELLEMENT PORTÉ, tel que le registre le déclare — pas tel qu'un plan l'annonce.
   *
   * C'est ce champ qui permet d'établir « aucune écriture n'a eu lieu » sans demander à
   * personne de l'affirmer. Une somme d'effets `READ` est une preuve ; une phrase qui dit
   * « je n'ai rien modifié » est une déclaration.
   */
  effect: Effect;
  /** Le domaine interrogé — le « grenier », au sens du recours. */
  source: string | null;
  /** La requête effective, telle qu'elle est partie. Sans elle, « 0 résultat » ne prouve rien. */
  query: string | null;
  startedAt: string;
  completedAt: string;
  issue: Issue;
  /** Le nombre d'éléments rendus. `null` = NON MESURÉ. Voir l'en-tête : ce n'est pas zéro. */
  resultCount: number | null;
  /** Une empreinte du résultat — deux appels identiques se reconnaissent sans le recopier. */
  resultHash: string | null;
  /** Vrai quand l'appel a été SERVI PAR LA CLÉ d'idempotence, sans refaire le travail. */
  deduplicated?: boolean;
}

/** Les champs d'entrée qui portent une requête. Repris de `recovery/action.ts`, même vocabulaire. */
const CHAMPS_REQUETE = [
  "query", "q", "question", "requete", "recherche", "terme", "search", "name", "reference",
];

/** La requête telle qu'elle est PARTIE — pas telle que le plan l'avait écrite. */
export function requeteDe(entree: Record<string, unknown>): string | null {
  for (const c of CHAMPS_REQUETE) {
    const v = entree[c];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

/** FNV-1a, écrite à la main : `crypto` est interdit ici par la garde de bundle client. */
export function empreinte(v: unknown): string {
  const s = JSON.stringify(v ?? null);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, "0")}-${s.length.toString(16)}`;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * COMBIEN DE CHOSES CET APPEL A-T-IL RENDUES ?
 *
 * ── POURQUOI CE N'EST PAS UNE SIMPLE LECTURE DE `.length` ───────────────────────────────
 *
 * Les capacités de ce dépôt ne rendent pas toutes la même forme : certaines rendent un
 * tableau, d'autres `{ items: [...] }`, d'autres `{ resultats: [...], total: 42 }`, d'autres
 * une phrase. Le défaut mesuré — `search_drive` qui répond « Aucun fichier… » en prose — est
 * exactement ce cas : humainement juste, machinalement muet.
 *
 * ── ET SURTOUT : POURQUOI ON NE DEVINE PAS ─────────────────────────────────────────────
 *
 * Deux tableaux dans le même résultat, c'est une AMBIGUÏTÉ. En choisir un donnerait un compte
 * plausible et faux, et ce compte servirait ensuite de preuve. On rend `null`, qui se lit
 * « non mesuré » — et le juge saura qu'il ne peut pas conclure à l'absence sur cette base.
 *
 * `cheminsDeListes` est réutilisé tel quel : c'est déjà lui qui trouve les collections pour
 * l'éventail, et deux façons de trouver une liste dans un résultat divergeraient un jour.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function compterResultats(sortie: unknown): number | null {
  if (sortie === null || sortie === undefined) return null;
  if (Array.isArray(sortie)) return sortie.length;
  if (typeof sortie !== "object") return null;

  const chemins = cheminsDeListes(sortie);
  if (chemins.length === 1) {
    const liste = chemins[0].split(".").reduce<unknown>(
      (acc, c) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[c] : undefined),
      sortie,
    );
    if (Array.isArray(liste)) return liste.length;
  }
  // PLUSIEURS LISTES : ambigu. On ne tranche pas — voir l'en-tête de cette fonction.
  if (chemins.length > 1) return null;

  // Aucune liste, mais un COMPTE explicite : la capacité a répondu à la question elle-même.
  const o = sortie as Record<string, unknown>;
  for (const c of ["count", "total", "nombre", "resultCount"]) {
    if (typeof o[c] === "number" && Number.isFinite(o[c] as number)) return o[c] as number;
  }
  return null;
}

/**
 * L'ISSUE, DÉDUITE DU COMPTE ET DE RIEN D'AUTRE.
 *
 * Une capacité qui échoue rend `ECHEC` quel que soit son contenu. Une capacité qui aboutit avec
 * zéro élément rend `VIDE` — et c'est CE cas qui devient une preuve d'absence citable. Une
 * capacité qui aboutit sans qu'on sache compter rend `INDETERMINE` : elle a marché, elle ne
 * prouve rien sur l'absence.
 */
export function issueDe(ok: boolean, resultCount: number | null): Issue {
  if (!ok) return "ECHEC";
  if (resultCount === null) return "INDETERMINE";
  return resultCount === 0 ? "VIDE" : "SUCCES";
}

export interface EntreesRecu {
  capability: string | null;
  effect: Effect;
  source: string | null;
  input: Record<string, unknown>;
  ok: boolean;
  sortie: unknown;
  debut: Date;
  fin: Date;
  deduplicated?: boolean;
}

/** FABRIQUE LE REÇU. Pure : elle constate, elle n'appelle rien et ne persiste rien. */
export function fabriquerRecu(e: EntreesRecu): ExecutionReceipt {
  const resultCount = e.ok ? compterResultats(e.sortie) : null;
  return {
    capability: e.capability,
    effect: e.effect,
    source: e.source,
    query: requeteDe(e.input),
    startedAt: e.debut.toISOString(),
    completedAt: e.fin.toISOString(),
    issue: issueDe(e.ok, resultCount),
    resultCount,
    resultHash: e.ok ? empreinte(e.sortie) : null,
    ...(e.deduplicated ? { deduplicated: true } : {}),
  };
}

/** Relit un reçu depuis la base — RETYPÉ, jamais cru sur parole (une version antérieure a pu l'écrire). */
export function lireRecu(v: unknown): ExecutionReceipt | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.issue !== "string" || !(ISSUES as readonly string[]).includes(o.issue)) return null;
  if (typeof o.startedAt !== "string" || typeof o.completedAt !== "string") return null;
  return {
    capability: typeof o.capability === "string" ? o.capability : null,
    effect: (typeof o.effect === "string" ? o.effect : "READ") as Effect,
    source: typeof o.source === "string" ? o.source : null,
    query: typeof o.query === "string" ? o.query : null,
    startedAt: o.startedAt,
    completedAt: o.completedAt,
    issue: o.issue as Issue,
    // LE POINT LE PLUS IMPORTANT DE CETTE FONCTION : un `resultCount` absent ou mal typé
    // devient `null`, jamais `0`. Le relire à zéro fabriquerait une preuve d'absence à partir
    // d'une donnée corrompue.
    resultCount: typeof o.resultCount === "number" && Number.isFinite(o.resultCount)
      ? o.resultCount
      : null,
    resultHash: typeof o.resultHash === "string" ? o.resultHash : null,
    ...(o.deduplicated === true ? { deduplicated: true } : {}),
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PREUVE NÉGATIVE, ÉCRITE POUR ÊTRE CITÉE
 *
 * « Nous avons interrogé le Drive avec la requête X à 14:32:05 et obtenu zéro résultat. »
 *
 * Cette phrase est produite par du CODE à partir d'un reçu. Le juge la lit comme un fait, pas
 * comme une déclaration — et c'est la différence entre un critère d'absence démontrable et un
 * critère d'absence qui ne peut jamais l'être, quel que soit le talent du modèle.
 */
export function preuveNegative(cle: string, r: ExecutionReceipt): string | null {
  if (r.issue !== "VIDE") return null;
  const ou = r.source ? ` dans ${r.source}` : "";
  const quoi = r.query ? ` avec la requête « ${r.query} »` : " sans filtre";
  return `- ${cle} : ${r.capability ?? "lecture"}${ou}${quoi} → 0 résultat (${r.completedAt})`;
}

/**
 * L'ATTESTATION D'INNOCUITÉ — ce qui rend « je n'ai rien modifié » DÉMONTRABLE.
 *
 * ── LE CRITÈRE QUI NE POUVAIT PAS ÊTRE SATISFAIT ────────────────────────────────────────
 *
 * « Aucun message n'est envoyé et aucune donnée n'est modifiée. » Le juge a refusé ce critère
 * faute de preuve, et il avait raison : rien dans le compte rendu ne parlait des EFFETS. Il ne
 * pouvait que croire une phrase, or croire une phrase n'est pas juger.
 *
 * Le rang d'effet de chaque capacité appelée est une donnée du registre, connue du code avant
 * l'exécution et vérifiée à l'exécution. La somme de ces rangs est donc un fait opposable — et
 * c'est le seul chemin honnête pour démontrer une négation.
 */
export function attestationEffets(
  recus: readonly ExecutionReceipt[],
  rang: (e: Effect) => number,
  plafond: Effect,
): string {
  if (recus.length === 0) {
    return `EFFETS PRODUITS : aucun appel de capacité n'a été exécuté (plafond ${plafond}).`;
  }
  const max = recus.reduce<Effect>((m, r) => (rang(r.effect) > rang(m) ? r.effect : m), "READ");
  const parEffet = new Map<Effect, number>();
  for (const r of recus) parEffet.set(r.effect, (parEffet.get(r.effect) ?? 0) + 1);
  const detail = [...parEffet.entries()]
    .sort((a, b) => rang(b[0]) - rang(a[0]))
    .map(([e, n]) => `${e} × ${n}`)
    .join(", ");

  const ecritures = recus.filter((r) => rang(r.effect) > rang("ANALYZE")).length;
  const verdict = ecritures === 0
    ? "AUCUNE écriture et AUCUN envoi : toutes les capacités appelées sont des lectures."
    : `${ecritures} appel(s) d'effet supérieur à ANALYZE.`;

  return [
    "EFFETS RÉELLEMENT PRODUITS (relevé par le code depuis le registre de capacités,",
    "pas une déclaration d'un modèle) :",
    `  plafond de la mission : ${plafond} · effet maximal atteint : ${max}`,
    `  répartition : ${detail}`,
    `  ${verdict}`,
  ].join("\n");
}
