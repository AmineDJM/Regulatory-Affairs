/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RECOURS LOCAL — entre « retenter à l'identique » et « refaire tout le plan ».
 *
 * ── CE QUI MANQUAIT ──────────────────────────────────────────────────────────────────────
 *
 * Le moteur ne savait que deux gestes : retenter la MÊME étape jusqu'à `maxAttempts`, puis
 * laisser la mission replanifier ENTIÈREMENT. Entre les deux, rien. Or « le Drive n'a pas le
 * contrat » n'appelle ni l'un ni l'autre : il appelle « regarde dans Legal ». Essayer une
 * autre source n'est pas un nouveau plan — l'objectif n'a pas bougé, seul le chemin change.
 *
 * ── CE FICHIER NE CHERCHE RIEN LUI-MÊME ──────────────────────────────────────────────────
 *
 * Il DÉCIDE, il n'exécute pas. Il ne sait pas interroger le Drive, ni Legal, ni Gmail : il
 * nomme la source suivante et laisse la capacité faire son travail (§82). Réimplémenter une
 * recherche ici créerait une seconde vérité, moins testée que la première.
 *
 * ── ET IL N'ÉLARGIT AUCUN DROIT ──────────────────────────────────────────────────────────
 *
 * « Essayer ailleurs » ne veut jamais dire « essayer avec plus de permissions ». Les sources
 * candidates arrivent déjà filtrées par les droits de l'acteur (§20) ; un manque de droit
 * (`MISSING_PERMISSION`) n'a d'ailleurs qu'un seul barreau dans l'échelle : escalader.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import {
  prochaineStrategie, estFinPossible, type ErrorKind, type Strategy,
} from "@/lib/missions/recovery/strategy";
import {
  prochaineSource, compteRendu, CIBLES, type Cible, type Source,
} from "@/lib/missions/recovery/sources";

/** L'historique de recours d'UNE étape. Compact à dessein : des noms, jamais des documents (§76). */
export interface HistoriqueRecours {
  tentees: Strategy[];
  sources: Source[];
  /** Une ligne par tentative — de quoi expliquer, pas de quoi rejouer. */
  journal: { strategie: Strategy; source: Source | null; kind: ErrorKind; quand: string }[];
}

export const HISTORIQUE_VIDE: HistoriqueRecours = { tentees: [], sources: [], journal: [] };

/** Ce que le moteur doit faire de l'étape, maintenant. */
export type Recours =
  /** Rejouer l'étape ici même, avec éventuellement une source différente. */
  | { geste: "REESSAYER"; strategie: Strategy; source: Source | null; pourquoi: string }
  /** Demander à un humain — l'étape passe en attente, ce n'est pas un échec (§23). */
  | { geste: "DEMANDER_HUMAIN"; strategie: Strategy; question: string }
  /** Remonter au propriétaire : plus rien d'autorisé à tenter ici. */
  | { geste: "ESCALADER"; strategie: Strategy; pourquoi: string }
  /** Le plan lui-même est en cause : c'est le seul cas qui justifie un replan global (§13). */
  | { geste: "REPLANIFIER"; strategie: Strategy; pourquoi: string }
  /** L'échelle est épuisée. On s'arrête, en DISANT ce qui a été tenté (§24). */
  | { geste: "BLOQUER"; pourquoi: string };

/** Combien de recours locaux une étape a le droit de consommer avant de remonter (§15). */
export const RECOURS_MAX = 6;

const estCible = (v: string | null | undefined): v is Cible =>
  typeof v === "string" && (CIBLES as readonly string[]).includes(v);

/**
 * LES BARREAUX RÉELLEMENT ÉPUISÉS.
 *
 * « AUTRE_SOURCE » ne s'use pas comme les autres : il reste disponible tant qu'il reste un
 * grenier. Les autres stratégies, si — élargir deux fois de suite n'a pas de sens.
 */
function barreauxEpuises(
  historique: HistoriqueRecours,
  cible: Cible,
  rejouable: boolean,
): Strategy[] {
  const base = prochaineSource(cible, historique.sources) === null
    ? [...historique.tentees, "AUTRE_SOURCE" as Strategy]
    : historique.tentees.filter((s) => s !== "AUTRE_SOURCE");

  /**
   * QUAND L'EXÉCUTANT DIT « INUTILE DE RECOMMENCER », ON LE CROIT.
   *
   * Une capacité qui rend `retryable: false` a constaté quelque chose de définitif — un format
   * illisible, un identifiant qui n'existe pas. Rejouer à l'identique redonnerait le même
   * résultat, et un test l'a montré : une étape définitivement en échec tournait quatre fois au
   * lieu de deux. Persévérer, ce n'est pas répéter ; c'est essayer AUTRE CHOSE.
   */
  /**
   * DÉCOUPER N'EST PAS EFFECTUABLE LOCALEMENT — et on ne prétend pas le contraire.
   *
   * « Ce qui échoue en un coup peut réussir en trois » suppose un mécanisme qui scinde une
   * étape en sous-étapes. Le moteur n'en a pas. Le mapper sur un simple rejeu produirait une
   * répétition à l'identique déguisée en stratégie — exactement le genre de faux recours qui
   * fait croire à de la persévérance. Le barreau est donc déclaré épuisé d'emblée, et
   * l'échelle passe au suivant (replanifier, qui lui est réel).
   *
   * Le jour où un découpeur existera, cette ligne disparaît et le barreau redevient vivant.
   */
  const inertes: Strategy[] = ["DECOUPER"];
  const sansRejeu: Strategy[] = rejouable ? base : [...base, "RETRY" as Strategy, "RETRY_BACKOFF" as Strategy];
  return [...sansRejeu, ...inertes];
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §76 — CETTE ÉTAPE A-T-ELLE LE DROIT DE S'ARRÊTER ?
 *
 * C'est LA question de la doctrine, et c'est ici qu'elle devient exécutable. Le moteur ne
 * laisse une étape mourir que si cette fonction dit oui ; tant qu'elle dit non, il DOIT tenter
 * quelque chose. `estFinPossible` n'est donc pas un utilitaire consultatif : c'est l'autorité
 * qui autorise l'arrêt.
 *
 * La conséquence se vérifie par sabotage : la forcer à « oui » fait conclure la mission sur le
 * premier document venu — et `runtime-recovery.test.ts` tombe, parce qu'il part du moteur.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function peutConclureEtape(opts: {
  kind: ErrorKind;
  historique: HistoriqueRecours;
  cible?: string | null;
  /** Ce que l'exécutant a dit du rejeu. `false` retire les barreaux RETRY de l'échelle. */
  rejouable?: boolean;
}): boolean {
  const cible: Cible = estCible(opts.cible) ? opts.cible : "DOCUMENT";
  // Le budget est une limite OPÉRATIONNELLE, pas doctrinale : au-delà, on s'arrête même s'il
  // restait un barreau, parce qu'insister sans progrès n'est plus de la persévérance (§15).
  if (opts.historique.journal.length >= RECOURS_MAX) return true;
  return estFinPossible({
    objectifAtteint: false,
    kind: opts.kind,
    dejaTentees: barreauxEpuises(opts.historique, cible, opts.rejouable !== false),
  });
}

/**
 * DÉCIDE le recours d'une étape en échec.
 *
 * ── L'INVARIANT (§76), TENU ICI ET NULLE PART AILLEURS ───────────────────────────────────
 *
 * `estFinPossible` est consulté AVANT de conclure : tant qu'un barreau reste, `BLOQUER` est
 * interdit. C'est ce que la doctrine appelle « on ne s'arrête jamais à la première difficulté »,
 * et c'est ici que la phrase devient exécutable.
 *
 * ── LA BOUCLE, EMPÊCHÉE PAR CONSTRUCTION (§16) ───────────────────────────────────────────
 *
 * Une stratégie déjà tentée n'est jamais reproposée (`prochaineStrategie` la saute), et une
 * source déjà visitée non plus. « Drive, Drive, Drive, Drive » est donc impossible : il n'y a
 * pas de compteur à faire confiance, il y a une liste qui se vide.
 */
export function deciderRecours(opts: {
  kind: ErrorKind;
  historique: HistoriqueRecours;
  /** Le type de chose cherchée, pour choisir l'ordre des greniers. */
  cible?: string | null;
  /** Ce que l'étape voulait, en une phrase — sert au blocage exact et à la question humaine. */
  objectif?: string;
  /** Ce que l'exécutant a dit du rejeu. `false` retire les barreaux RETRY de l'échelle. */
  rejouable?: boolean;
}): Recours {
  const { kind, historique } = opts;
  const cible: Cible = estCible(opts.cible) ? opts.cible : "DOCUMENT";
  const objectif = opts.objectif?.trim() || "cette étape";

  // Budget : la persévérance est bornée, sinon c'est une boucle avec une bonne intention.
  if (historique.journal.length >= RECOURS_MAX) {
    return {
      geste: "BLOQUER",
      pourquoi: `${historique.journal.length} recours ont été tentés pour ${objectif} sans progrès. `
        + compteRendu(cible, historique.sources),
    };
  }

  const epuisees = barreauxEpuises(historique, cible, opts.rejouable !== false);
  const strategie = prochaineStrategie(kind, epuisees);

  // §76 — le refus de conclure. Si l'échelle n'est pas épuisée, BLOQUER n'est pas une option.
  if (strategie === null) {
    const fin = estFinPossible({ objectifAtteint: false, kind, dejaTentees: epuisees });
    return {
      geste: "BLOQUER",
      pourquoi: fin
        ? `Toutes les voies prévues pour ${objectif} ont été essayées. ${compteRendu(cible, historique.sources)}`
        : `Aucune stratégie restante pour ${objectif}, mais l'échelle n'est pas épuisée — état incohérent.`,
    };
  }

  switch (strategie) {
    case "RETRY":
    case "RETRY_BACKOFF":
      return { geste: "REESSAYER", strategie, source: null, pourquoi: "incident probablement passager." };

    case "AUTRE_SOURCE": {
      // `sourcesEpuisees` a déjà écarté ce barreau s'il n'y avait plus de grenier ; arriver ici
      // avec `null` serait donc incohérent, et on préfère le dire plutôt que de le rattraper.
      const source = prochaineSource(cible, historique.sources);
      if (!source) return { geste: "BLOQUER", pourquoi: compteRendu(cible, historique.sources) };
      return { geste: "REESSAYER", strategie, source, pourquoi: compteRendu(cible, historique.sources) };
    }

    case "ELARGIR":
      // Élargir DOIT changer quelque chose : le moteur pose un drapeau dans l'entrée, que la
      // capacité lit. Rejouer la même requête en appelant cela « élargir » serait un mensonge.
      return { geste: "REESSAYER", strategie, source: null, pourquoi: "recherche élargie : moins de filtres, plus de synonymes." };

    case "DECOUPER":
      // Écarté par `barreauxEpuises` — inatteignable, mais l'exhaustivité du switch le veut.
      return { geste: "REPLANIFIER", strategie, pourquoi: "le découpage d'étape n'existe pas encore." };

    case "DEMANDER_HUMAIN":
      return {
        geste: "DEMANDER_HUMAIN", strategie,
        // La question NOMME ce qui manque. « Je n'ai pas trouvé, que faire ? » ne s'appelle pas
        // demander de l'aide (§22) : cela renvoie le problème sans l'avoir instruit.
        question: `Pour ${objectif} : ${compteRendu(cible, historique.sources)} `
          + "Savez-vous où cette pièce se trouve, ou pouvez-vous me l'envoyer ?",
      };

    case "REPLANIFIER":
      return { geste: "REPLANIFIER", strategie, pourquoi: "la méthode prévue ne peut pas aboutir." };

    case "ESCALADER":
      return { geste: "ESCALADER", strategie, pourquoi: `${objectif} ne peut pas aboutir sans arbitrage.` };

    case "DECLARER_INCONNU":
      return {
        geste: "BLOQUER",
        pourquoi: `${compteRendu(cible, historique.sources)} `
          + `Je n'ai pas de quoi établir ${objectif} avec certitude.`,
      };
  }
}

/** Enregistre une tentative. Rend un NOUVEL historique — l'ancien reste lisible. */
export function noter(
  historique: HistoriqueRecours,
  r: { strategie: Strategy; source: Source | null; kind: ErrorKind },
  quand: Date,
): HistoriqueRecours {
  return {
    tentees: historique.tentees.includes(r.strategie)
      ? historique.tentees
      : [...historique.tentees, r.strategie],
    sources: r.source && !historique.sources.includes(r.source)
      ? [...historique.sources, r.source]
      : historique.sources,
    journal: [...historique.journal, {
      strategie: r.strategie, source: r.source, kind: r.kind, quand: quand.toISOString(),
    }],
  };
}

/** Relit l'historique persisté sans faire confiance à sa forme. */
export function historiqueDe(v: unknown): HistoriqueRecours {
  if (!v || typeof v !== "object") return HISTORIQUE_VIDE;
  const o = v as Record<string, unknown>;
  return {
    tentees: Array.isArray(o.tentees) ? (o.tentees as Strategy[]) : [],
    sources: Array.isArray(o.sources) ? (o.sources as Source[]) : [],
    journal: Array.isArray(o.journal) ? (o.journal as HistoriqueRecours["journal"]) : [],
  };
}
