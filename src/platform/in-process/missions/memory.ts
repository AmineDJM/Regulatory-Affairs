import { messagesApres, type IdentifiedMessage } from "@/lib/assistant-memory";
import type { Reasoner } from "@/lib/missions/ports";
import { CompacteurReel } from "@/lib/missions/memory/compactor";
import { compacter, type Episode, type Fidelite } from "@/lib/missions/memory/compact";
import { estimerJetons } from "@/lib/missions/memory/budget";
import {
  aCompacter, appliquerFidelite, assemblerContexte, dernierePosition,
  enregistrerEpisode, personnesACompacter,
} from "@/lib/missions/memory/store";
import { raisonneur } from "@/platform/in-process/missions/reasoner";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA MÉMOIRE ÉPISODIQUE, BRANCHÉE — le compacteur cesse d'être une pièce détachée.
 *
 * ── CE QUE CE FICHIER CHANGE, DIT SANS DÉTOUR ───────────────────────────────────────────
 *
 * Le compacteur, les épisodes, la compression progressive et l'assemblage sous budget
 * existaient, étaient testés, et n'étaient appelés PAR PERSONNE. Une capacité qu'aucun chemin
 * d'utilisateur n'atteint n'est pas une capacité : c'est du code qui compile. Ce fichier est le
 * chaînon manquant, et il est court exprès — il ne fait qu'assembler ce qui existe déjà.
 *
 * ── LES TROIS MOMENTS, ET POURQUOI ILS SONT SÉPARÉS ─────────────────────────────────────
 *
 *   DÉCOUPER   après un échange, quand assez de tours se sont accumulés. C'est le moment où la
 *              matière est là, et où la personne n'attend plus rien : le travail se fait après
 *              que la réponse est partie.
 *
 *   VIEILLIR   au battement, parce que c'est le CALENDRIER qui fait vieillir un souvenir, pas la
 *              conversation. Un compte inactif six mois doit voir sa mémoire se réduire quand
 *              même — sinon la compression ne se déclenche que pour ceux qui parlent, c'est-à-dire
 *              exactement ceux dont la mémoire est déjà fraîche.
 *
 *   RELIRE     à chaque tour, dans le contexte personnel. C'est la seule des trois qui rende un
 *              service visible ; les deux autres n'existent que pour la rendre possible.
 *
 * ── CE QU'IL SE PASSE SANS FOURNISSEUR DE MODÈLE ────────────────────────────────────────
 *
 * Rien. Aucun épisode n'est enregistré, aucune fidélité ne descend, et la relecture ne trouve
 * que ce qui est déjà en base. C'est le comportement voulu : un résumé est un JUGEMENT sur ce
 * qui compte, et il n'existe pas de repli déterministe honnête — tronquer les tours produirait un
 * souvenir faux, ce que `compact.ts` refuse déjà par ailleurs.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LE COMPACTEUR, ET LE SEUL POINT SUBSTITUABLE.
 *
 * En production, `cerveau` est absent et c'est le raisonneur réel qui travaille. Un banc peut en
 * fournir un autre — et il ne remplace alors QUE le saut réseau : le découpage, le contrôle de
 * perte, l'écriture en base, le vieillissement et l'assemblage sont le code de production, sur
 * de vraies lignes. C'est la seule substitution acceptable, et elle est nommée ici pour qu'on ne
 * puisse pas en glisser une seconde sans la voir.
 */
const compacteurPour = (cerveau?: Reasoner) => new CompacteurReel(cerveau ?? raisonneur);

/**
 * COMBIEN DE MESSAGES AVANT DE COUPER UNE TRANCHE.
 *
 * Douze, comme la distillation de la mémoire durable — non par symétrie décorative, mais parce
 * que les deux mesurent la même chose : « assez de matière pour qu'un résumé apprenne quelque
 * chose ». Couper toutes les deux réponses paierait un appel de modèle pour résumer un échange
 * qui tenait déjà en deux lignes.
 */
const TOURS_PAR_EPISODE = 12;

/** Au-delà, on coupe quand même : un fil qu'on a laissé filer ne doit pas produire un pavé. */
const TOURS_MAX_PAR_EPISODE = 60;

const EPISODE_VIDE: Episode = {
  summary: "", entities: [], decisions: [], commitments: [], openQuestions: [], corrections: [],
};

export interface DecoupageEpisode {
  /** `null` quand il n'y avait rien à faire — ce qui est le cas le plus fréquent. */
  episodeId: string | null;
  tours: number;
  jetonsAvant: number;
  jetonsApres: number;
  /** Pourquoi ça ne s'est pas fait, quand ça ne s'est pas fait. Jamais silencieux. */
  raison: string;
}

/** La transcription telle que le compacteur la lit. Les rôles sont nommés, pas codés. */
function transcrire(messages: readonly IdentifiedMessage[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "Personne" : "Adam"} : ${m.content.slice(0, 4000)}`)
    .join("\n");
}

/**
 * DÉCOUPE UNE TRANCHE DE CONVERSATION EN ÉPISODE.
 *
 * Ne lève jamais : la mémoire est un confort, et une panne de compression ne doit pas faire
 * échouer le tour qui vient de réussir. L'échec est RENDU, pas tu — l'appelant le journalise.
 */
export async function noterEpisode(
  userId: string, threadId: string, opts: { reasoner?: Reasoner } = {},
): Promise<DecoupageEpisode> {
  const rien = (raison: string): DecoupageEpisode =>
    ({ episodeId: null, tours: 0, jetonsAvant: 0, jetonsApres: 0, raison });
  const cerveau = opts.reasoner ?? raisonneur;

  try {
    if (!cerveau.configured()) return rien("aucun fournisseur de modèle configuré");

    const depuis = await dernierePosition(userId, threadId);
    const messages = await messagesApres(userId, threadId, depuis, TOURS_MAX_PAR_EPISODE);
    if (messages.length < TOURS_PAR_EPISODE) {
      return rien(`${messages.length} message(s) depuis le dernier épisode — seuil ${TOURS_PAR_EPISODE}`);
    }

    const texte = transcrire(messages);
    const jetonsAvant = estimerJetons(texte);

    // LE MÊME COMPACTEUR QUE POUR LE VIEILLISSEMENT, à fidélité RICHE et sans rien à préserver
    // en entrée : un épisode neuf n'a pas de passé. Le contrôle de `compacter` s'applique quand
    // même — un résumé qui aurait perdu un montant présent dans les tours est REFUSÉ, et l'on
    // n'enregistre alors aucun épisode plutôt qu'un souvenir amputé.
    const r = await compacter(compacteurPour(opts.reasoner), EPISODE_VIDE, texte, "RICH");
    if (!r.applique) return rien(`compression refusée — ${r.verdict.raison}`);

    const episodeId = await enregistrerEpisode(userId, r.episode, {
      threadId,
      fromMessageId: messages[0].id,
      toMessageId: messages[messages.length - 1].id,
      turns: messages.length,
      startedAt: messages[0].createdAt,
      endedAt: messages[messages.length - 1].createdAt,
      tokensBefore: jetonsAvant,
    }, "RICH");

    return {
      episodeId,
      tours: messages.length,
      jetonsAvant,
      jetonsApres: estimerJetons(r.episode.summary),
      raison: "épisode enregistré",
    };
  } catch (e) {
    return rien(`découpage impossible — ${e instanceof Error ? e.message : "erreur"}`);
  }
}

export interface VieillissementMemoire {
  personnes: number;
  examines: number;
  compresses: number;
  refuses: number;
  jetonsEconomises: number;
}

/**
 * FAIT VIEILLIR LA MÉMOIRE DE TOUT LE MONDE — un cran à la fois.
 *
 * ── POURQUOI UN CRAN ET NON LA CIBLE DIRECTE ────────────────────────────────────────────
 *
 * `fideliteVisee` rend déjà la cible finale ; on l'applique telle quelle. Ce qui est borné, ce
 * n'est pas la distance parcourue mais le NOMBRE d'épisodes traités par passage : un compte qui
 * revient après un an d'absence a peut-être cent épisodes à réduire, et les faire tous dans un
 * battement bloquerait l'analyse réglementaire et l'ingestion, qui partagent ce battement.
 */
export async function vieillirMemoire(
  maintenant = new Date(),
  opts: { personnes?: number; parPersonne?: number; reasoner?: Reasoner; userId?: string } = {},
): Promise<VieillissementMemoire> {
  const out: VieillissementMemoire = {
    personnes: 0, examines: 0, compresses: 0, refuses: 0, jetonsEconomises: 0,
  };
  const cerveau = opts.reasoner ?? raisonneur;
  const compacteur = compacteurPour(opts.reasoner);
  if (!cerveau.configured()) return out;

  // UNE SEULE PERSONNE, OU LA FILE. Le cas nommé ne coûte AUCUNE requête de file : quand
  // l'appelant sait déjà de qui il parle — parce qu'il vient de lui écrire un épisode —
  // demander à la base « qui a vieilli ? » pour s'entendre répondre « lui » est du travail nul.
  let ids: string[] = [];
  if (opts.userId) {
    ids = [opts.userId];
  } else {
    try {
      ids = await personnesACompacter(maintenant, opts.personnes ?? 10);
    } catch (e) {
      console.error("[memoire] file de compression illisible", e);
      return out;
    }
  }

  for (const userId of ids) {
    out.personnes += 1;
    try {
      const file = await aCompacter(userId, maintenant, opts.parPersonne ?? 5);
      for (const item of file) {
        out.examines += 1;
        // LE TEXTE D'ORIGINE EST LE RÉSUMÉ ACTUEL, et c'est le point : on compresse un souvenir
        // déjà compressé. Les tours bruts ne sont pas relus — ils sont peut-être effacés, et les
        // relire annulerait tout le bénéfice. La chaîne RICHE → STRUCTURÉ → FAITS est donc une
        // suite de compressions successives, chacune contrôlée contre la précédente.
        const r = await compacter(
          compacteur, item.episode, item.episode.summary, item.visee as Fidelite);
        if (!r.applique) {
          out.refuses += 1;
          continue;
        }
        const avant = estimerJetons(item.episode.summary);
        await appliquerFidelite(item.id, r.episode, item.visee);
        out.compresses += 1;
        out.jetonsEconomises += Math.max(0, avant - estimerJetons(r.episode.summary));
      }
    } catch (e) {
      console.error(`[memoire] vieillissement impossible pour ${userId}`, e);
    }
  }
  return out;
}

/**
 * LE BLOC DE MÉMOIRE RELU À CHAQUE TOUR — composé sous budget, jamais accumulé.
 *
 * Rend une chaîne vide quand il n'y a rien : un en-tête « SOUVENIRS » suivi de rien ferait
 * croire au modèle qu'on a cherché et qu'il n'y a rien à savoir, ce qui est différent de « on
 * n'a pas encore de souvenirs ».
 */
export async function contexteMemoire(
  userId: string,
  opts: { identiteActive?: string; contrainteCourante?: string } = {},
): Promise<string> {
  try {
    const a = await assemblerContexte(userId, {
      identiteActive: opts.identiteActive,
      contrainteCourante: opts.contrainteCourante,
      maxEpisodes: 12,
    });
    if (!a.texte.trim()) return "";
    return `\nMÉMOIRE COMPOSÉE (${a.metriques.episodeCount} épisode(s), `
      + `${a.metriques.contextTokens} jetons estimés) :\n${a.texte}`;
  } catch (e) {
    console.error("[memoire] assemblage du contexte impossible (non bloquant)", e);
    return "";
  }
}
