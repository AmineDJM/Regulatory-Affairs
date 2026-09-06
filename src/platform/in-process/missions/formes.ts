import { prisma } from "@/lib/prisma";
import { formeDe, FORME_INCONNUE, OBSERVATIONS_MAX, type Forme } from "@/lib/missions/registry/formes";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PONT DES FORMES DE SORTIE — la matière vient du journal qui existe déjà.
 *
 * `MissionStep` garde le `result` de chaque étape aboutie. C'est la table où le registre (§44)
 * lit déjà la fiabilité d'une capacité ; on y lit maintenant aussi sa FORME. Pas de seconde
 * table (§17), pas de colonne ajoutée, pas d'entretien : une capacité dont la sortie change
 * réapprend sa forme dès que quelques missions ont tourné.
 *
 * ── POURQUOI UN CACHE PRÉCHARGÉ, ET PAS UNE LECTURE À LA DEMANDE ────────────────────────
 *
 * `catalogueDe(user)` et son `brief()` sont SYNCHRONES — ils sont appelés au montage du moteur,
 * là où une requête ne peut pas s'insérer. Le patron retenu est celui du cache des skills :
 * `prechargerFormes()` remplit une fois, `formeConnue()` lit sans attendre.
 *
 * ── ET SI LE PRÉCHARGEMENT N'A PAS EU LIEU ──────────────────────────────────────────────
 *
 * `formeConnue()` rend une forme à ZÉRO observation, et tout ce qui la consomme doit alors dire
 * « forme inconnue » plutôt que « ne rend rien ». C'est la leçon payée deux fois sur la sûreté
 * des permissions : un cache froid ne doit pas se lire comme une affirmation. Le compilateur,
 * en particulier, ne refuse JAMAIS une référence sur une forme inconnue.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type { Forme } from "@/lib/missions/registry/formes";
export { direForme, cheminPlausible, FORME_INCONNUE } from "@/lib/missions/registry/formes";

/** La fenêtre relue : trois mois. Au-delà, la forme d'un outil qui a changé ne veut plus rien dire. */
export const FENETRE_FORMES_JOURS = 90;
/** Le plafond de lignes lues d'un coup. Une mesure bornée qui dit sa borne vaut mieux qu'un scan. */
export const ETAPES_LUES_MAX = 4_000;

const cache = new Map<string, Forme>();
let charge = false;
let chargeA = 0;

/**
 * LA FRAÎCHEUR DU CACHE — dix minutes.
 *
 * Assez court pour qu'une capacité qui vient de tourner pour la première fois soit connue à la
 * mission suivante ; assez long pour qu'une rafale de missions ne relise pas la table à chaque
 * fois. La forme d'un outil ne change pas à la minute : c'est le rythme du DÉPLOIEMENT, pas
 * celui du trafic.
 */
export const FRAICHEUR_FORMES_MS = 10 * 60_000;

/**
 * RÉCOLTE LES FORMES depuis les étapes réellement abouties.
 *
 * On ne prend que `DONE` : une étape en échec ne dit rien de ce que la capacité produit quand
 * elle marche, et compter ses sorties partielles ferait apprendre des formes tronquées.
 */
export async function recolterFormes(opts: { depuis?: Date; limite?: number } = {}): Promise<Map<string, Forme>> {
  const depuis = opts.depuis ?? new Date(Date.now() - FENETRE_FORMES_JOURS * 86_400_000);
  const plafond = Math.min(Math.max(1, opts.limite ?? ETAPES_LUES_MAX), ETAPES_LUES_MAX);

  // La fenêtre PAR CAPACITÉ, et non un « les N plus récentes » global : sans la partition, une
  // seule capacité très appelée (`read_document` tourne dans presque toutes les missions)
  // consommerait le plafond et toutes les autres resteraient sans forme. Le défaut serait
  // silencieux — on apprendrait quelque chose, donc rien n'aurait l'air cassé.
  const lignes = await prisma.$queryRaw<{ capability: string; result: unknown }[]>`
    SELECT capability, result FROM (
      SELECT s."capability" AS capability, s."result" AS result,
             ROW_NUMBER() OVER (
               PARTITION BY s."capability"
               ORDER BY COALESCE(s."completedAt", s."startedAt", s."createdAt") DESC
             ) AS rang
      FROM "MissionStep" s
      WHERE s."capability" IS NOT NULL
        AND s."status" = 'DONE'
        AND s."result" IS NOT NULL
        -- L'ÉTAPE PARENTE D'UN ÉVENTAIL N'APPELLE PAS LA CAPACITÉ : elle rend l'enveloppe du
        -- moteur ({ expanded, keys, done, failed }). L'apprendre polluait la forme de l'outil et,
        -- pire, faisait passer ses VRAIS champs pour occasionnels : « read_document » annonçait
        -- « texte? » alors qu'il rend toujours un texte.
        AND s."forEach" IS NULL
        AND COALESCE(s."completedAt", s."startedAt", s."createdAt") >= ${depuis}
    ) t
    WHERE t.rang <= ${OBSERVATIONS_MAX}
    LIMIT ${plafond}
  `;

  const parCapacite = new Map<string, unknown[]>();
  for (const l of lignes) {
    if (!l.capability) continue;
    const acc = parCapacite.get(l.capability) ?? [];
    acc.push(l.result);
    parCapacite.set(l.capability, acc);
  }

  const out = new Map<string, Forme>();
  for (const [cap, sorties] of parCapacite) {
    const f = formeDe(sorties);
    // Une capacité dont TOUTES les sorties observées sont nulles n'a rien appris : la ranger
    // dans le cache la ferait passer pour connue-et-vide, exactement la lecture qu'on interdit.
    if (f.observations > 0) out.set(cap, f);
  }
  return out;
}

/** Remplit le cache. Rend le nombre de capacités dont la forme est désormais connue. */
export async function prechargerFormes(opts: { depuis?: Date; limite?: number } = {}): Promise<number> {
  const formes = await recolterFormes(opts);
  cache.clear();
  for (const [k, v] of formes) cache.set(k, v);
  charge = true;
  chargeA = Date.now();
  return cache.size;
}

/**
 * LE POINT D'ENTRÉE DE PRODUCTION — appelé là où les skills dynamiques sont préchargés.
 *
 * Sans appelant réel, apprendre les formes ne serait qu'un test qui passe (§14). Il est ici,
 * à côté de `prechargerCapacitesDynamiques`, parce que c'est le seul endroit qui s'exécute
 * AVANT que `catalogueDe(user)` ne soit construit — donc avant que `brief()` n'ait besoin des
 * formes, et avant que le compilateur ne juge une référence.
 *
 * Il ne jette jamais : une base indisponible laisse le cache tel quel, et un cache vide se lit
 * « je ne sais pas », jamais « la capacité ne rend rien ».
 */
export async function assurerFormes(): Promise<number> {
  if (charge && Date.now() - chargeA < FRAICHEUR_FORMES_MS) return cache.size;
  try {
    return await prechargerFormes();
  } catch {
    return cache.size;
  }
}

/**
 * LA FORME CONNUE D'UNE CAPACITÉ — jamais une affirmation quand on ne sait pas.
 *
 * Rend une forme à zéro observation tant que le cache est froid ou que la capacité n'a jamais
 * tourné. Les deux cas se lisent pareil, et c'est voulu : dans les deux, on ignore.
 */
export function formeConnue(capacite: string): Forme {
  return cache.get(capacite) ?? FORME_INCONNUE;
}

/** L'état du cache — pour qu'un banc puisse DIRE qu'il a mesuré à froid. */
export function etatFormes(): { charge: boolean; capacites: number } {
  return { charge, capacites: cache.size };
}

/** Vide le cache. Réservé aux tests et aux bancs qui veulent mesurer un départ à froid. */
export function oublierFormes(): void {
  cache.clear();
  charge = false;
  chargeA = 0;
}
