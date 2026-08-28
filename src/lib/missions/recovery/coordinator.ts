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
  prochaineStrategie, estFinPossible, STRATEGIES, type ErrorKind, type Strategy,
} from "@/lib/missions/recovery/strategy";
import {
  prochaineSource, compteRendu, CIBLES, type Cible, type Source,
} from "@/lib/missions/recovery/sources";
import type { ActionRecours } from "@/lib/missions/recovery/action";

/** L'historique de recours d'UNE étape. Compact à dessein : des noms, jamais des documents (§76). */
export interface HistoriqueRecours {
  tentees: Strategy[];
  sources: Source[];
  /** Une ligne par tentative — de quoi expliquer, pas de quoi rejouer. */
  journal: { strategie: Strategy; source: Source | null; kind: ErrorKind; quand: string }[];
}

export const HISTORIQUE_VIDE: HistoriqueRecours = { tentees: [], sources: [], journal: [] };

/**
 * CE QUE LE MOTEUR DOIT FAIRE DE L'ÉTAPE, MAINTENANT.
 *
 * ── CHAQUE DÉCISION EST EXÉCUTABLE, SAUTÉE, OU BLOQUANTE — jamais abstraite ──────────────
 *
 * `REESSAYER` porte désormais une ACTION CONCRÈTE qui dit ce qu'elle change : une autre
 * capacité, une requête transformée, un vrai rejeu technique. C'est la correction du défaut
 * central : le coordinateur rendait « essaie la source LEGAL », le moteur écrivait
 * `source: "LEGAL"` dans l'entrée, et AUCUNE capacité ne lisait ce champ. La capacité repartait
 * donc à l'identique — un rejeu portant un nom de stratégie.
 *
 * `sautes` liste les barreaux écartés faute d'action possible ICI. Ils ne consomment aucune
 * tentative et ne sont jamais journalisés : les compter reviendrait à rapprocher l'étape de sa
 * mort pour des recours qui n'ont pas eu lieu.
 */
export type Recours =
  /** Rejouer l'étape ici même, avec une action qui change RÉELLEMENT l'appel. */
  | { geste: "REESSAYER"; strategie: Strategy; source: Source | null; action: ActionRecours; pourquoi: string; sautes: Strategy[] }
  /** Relire le résultat DÉJÀ acquis et l'interpréter — zéro appel, zéro recherche. */
  | { geste: "ADAPTER"; strategie: Strategy; pourquoi: string; sautes: Strategy[] }
  /** Demander à un humain — l'étape passe en attente, ce n'est pas un échec (§23). */
  | { geste: "DEMANDER_HUMAIN"; strategie: Strategy; question: string; sautes: Strategy[] }
  /** Remonter au propriétaire : plus rien d'autorisé à tenter ici. */
  | { geste: "ESCALADER"; strategie: Strategy; pourquoi: string; sautes: Strategy[] }
  /** Récrire LA PARTIE fautive du plan, en gardant les étapes abouties et leurs preuves. */
  | { geste: "REPLAN_LOCAL"; strategie: Strategy; pourquoi: string; sautes: Strategy[] }
  /** La structure entière de la mission n'est plus valide : on régénère le DAG (§13). */
  | { geste: "REPLANIFIER"; strategie: Strategy; pourquoi: string; sautes: Strategy[] }
  /** L'échelle est épuisée. On s'arrête, en DISANT ce qui a été tenté (§24). */
  | { geste: "BLOQUER"; pourquoi: string; sautes: Strategy[] };

/**
 * LES RÉSOLVEURS — ce que l'appelant sait et que le coordinateur ne peut pas savoir.
 *
 * Ce fichier ne connaît ni catalogue, ni droits, ni schémas d'outils. Il reçoit donc des
 * FONCTIONS : « peux-tu me donner un appel concret vers ce grenier ? », « peux-tu élargir cette
 * requête ? ». Chacune rend `null` quand c'est impossible, et le barreau correspondant est
 * alors sauté au lieu d'être proposé à vide.
 */
export interface ResolveursRecours {
  /** Un appel réel vers un AUTRE grenier, ou `null` si aucune capacité ne l'interroge. */
  autreSource?(source: Source): ActionRecours | null;
  /** Une requête objectivement plus large, ou `null` si rien n'est élargissable. */
  elargir?(): ActionRecours | null;
  /** Le résultat déjà acquis est-il réparable sans ambiguïté ? */
  adaptable?(): boolean;
}

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
  inapplicables: readonly Strategy[] = [],
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
  /**
   * ── UN BARREAU QUI NE PEUT RIEN CHANGER N'EST PAS UN BARREAU (mesuré) ─────────────────
   *
   * `inapplicables` est la généralisation de `DECOUPER` : l'appelant y met les stratégies que
   * CETTE étape est structurellement incapable de consommer. Le coordinateur ne devine pas
   * lesquelles — il ne connaît pas les types de nœuds — mais il les honore.
   *
   * Un run réel a chiffré ce que coûte l'absence de cette notion. `AUTRE_SOURCE` et `ELARGIR`
   * agissent en écrivant `source` et `elargir` dans l'ENTRÉE de l'étape ; un éventail, lui, se
   * déploie avant tout appel de capacité et ne lit jamais son entrée. L'échelle a donc parcouru
   * six greniers — Drive, Legal, Courriers, Regulatory, pièces jointes, journal métier — en
   * deux cents millisecondes, en écrivant six lignes `STEP_RECOVERY` au journal, sans qu'une
   * seule ligne de code lise ce qu'elles avaient changé. Vingt-quatre au total sur la mission.
   *
   * Ce n'est pas seulement du gaspillage : c'est un faux recours. Le journal affirmait une
   * persévérance qui n'avait pas eu lieu, et l'échelle s'épuisait sur une cause qu'elle
   * n'attaquait pas — laissant le vrai barreau (`REPLANIFIER`) inatteignable.
   */
  const inertes: Strategy[] = ["DECOUPER", ...inapplicables];
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
  /** Les stratégies que cette étape ne peut PAS consommer — voir `barreauxEpuises`. */
  inapplicables?: readonly Strategy[];
}): boolean {
  const cible: Cible = estCible(opts.cible) ? opts.cible : "DOCUMENT";
  // Le budget est une limite OPÉRATIONNELLE, pas doctrinale : au-delà, on s'arrête même s'il
  // restait un barreau, parce qu'insister sans progrès n'est plus de la persévérance (§15).
  if (opts.historique.journal.length >= RECOURS_MAX) return true;
  return estFinPossible({
    objectifAtteint: false,
    kind: opts.kind,
    dejaTentees: barreauxEpuises(opts.historique, cible, opts.rejouable !== false, opts.inapplicables),
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
  /**
   * LES STRATÉGIES QUE CETTE ÉTAPE NE PEUT PAS CONSOMMER.
   *
   * L'appelant les connaît, le coordinateur non — et c'est le bon partage : ce fichier décide
   * QUOI tenter, il n'a pas à savoir comment un nœud d'éventail se déploie. Ce qu'il garantit,
   * c'est qu'une stratégie déclarée inapplicable ne sera jamais proposée ni comptée comme
   * tentée : l'échelle passe au barreau suivant qui, lui, agit réellement.
   */
  inapplicables?: readonly Strategy[];
  /** Ce que l'appelant sait faire réellement — voir `ResolveursRecours`. */
  resolveurs?: ResolveursRecours;
}): Recours {
  const { kind, historique } = opts;
  const cible: Cible = estCible(opts.cible) ? opts.cible : "DOCUMENT";
  const objectif = opts.objectif?.trim() || "cette étape";
  const r = opts.resolveurs ?? {};
  const sautes: Strategy[] = [];

  // Budget : la persévérance est bornée, sinon c'est une boucle avec une bonne intention.
  if (historique.journal.length >= RECOURS_MAX) {
    return {
      geste: "BLOQUER",
      sautes,
      pourquoi: `${historique.journal.length} recours ont été tentés pour ${objectif} sans progrès. `
        + compteRendu(cible, historique.sources),
    };
  }

  /**
   * ── LA BOUCLE QUI DESCEND L'ÉCHELLE JUSQU'AU PREMIER BARREAU EXÉCUTABLE ──────────────
   *
   * Un barreau proposé n'est pas encore un barreau tenable : il faut qu'une action concrète en
   * découle ICI, avec CE catalogue, sur CETTE entrée. Quand ce n'est pas le cas, il rejoint
   * `sautes` — sans consommer de tentative, sans ligne au journal — et l'on redemande le
   * suivant. La borne est la longueur de l'échelle : chaque tour en retire au moins un.
   */
  const ecartes: Strategy[] = [];
  for (let garde = 0; garde <= STRATEGIES.length; garde++) {
    const epuisees = [
      ...barreauxEpuises(historique, cible, opts.rejouable !== false, opts.inapplicables),
      ...ecartes,
    ];
    const strategie = prochaineStrategie(kind, epuisees);

    // §76 — le refus de conclure. Si l'échelle n'est pas épuisée, BLOQUER n'est pas une option.
    if (strategie === null) {
      const fin = estFinPossible({ objectifAtteint: false, kind, dejaTentees: epuisees });
      return {
        geste: "BLOQUER",
        sautes,
        pourquoi: fin
          ? `Toutes les voies prévues pour ${objectif} ont été essayées. ${compteRendu(cible, historique.sources)}`
            + (sautes.length > 0 ? ` (${sautes.join(", ")} ne s'appliquaient pas ici.)` : "")
          : `Aucune stratégie restante pour ${objectif}, mais l'échelle n'est pas épuisée — état incohérent.`,
      };
    }

    switch (strategie) {
      case "RETRY":
      case "RETRY_BACKOFF":
        return {
          geste: "REESSAYER", strategie, source: null, sautes,
          action: { type: "REJEU", ceQuiChange: "rien — incident technique, le même appel peut réussir" },
          pourquoi: "incident probablement passager.",
        };

      /**
       * AUTRE_SOURCE — on descend les greniers jusqu'à en trouver un RÉELLEMENT interrogeable.
       *
       * Un grenier sans capacité pour l'interroger n'est pas une piste : c'est un nom. On le
       * passe, silencieusement, et l'on essaie le suivant. Si aucun ne répond, le barreau
       * entier est sauté — c'est là que se trouvait le défaut mesuré : le moteur écrivait
       * `source: "LEGAL"` dans l'entrée d'une étape et rejouait à l'identique.
       */
      case "AUTRE_SOURCE": {
        const vues = [...historique.sources];
        for (;;) {
          const source = prochaineSource(cible, vues);
          if (!source) break;
          const action = r.autreSource?.(source) ?? null;
          if (action) {
            return {
              geste: "REESSAYER", strategie, source, action, sautes,
              pourquoi: `${compteRendu(cible, historique.sources)} ${action.ceQuiChange}`,
            };
          }
          vues.push(source);
        }
        sautes.push(strategie);
        ecartes.push(strategie);
        continue;
      }

      case "ELARGIR": {
        // Élargir DOIT changer quelque chose. Sans transformation possible — pas de requête,
        // pas de fenêtre, pas de borne — le barreau ne s'applique pas, et le prétendre
        // produirait le rejeu déguisé que ce lot supprime.
        const action = r.elargir?.() ?? null;
        if (action) {
          return { geste: "REESSAYER", strategie, source: null, action, sautes, pourquoi: action.ceQuiChange };
        }
        sautes.push(strategie);
        ecartes.push(strategie);
        continue;
      }

      case "ADAPTER": {
        // Le moins cher de tous : relire le résultat DÉJÀ acquis. Aucun appel, aucune recherche.
        if (r.adaptable?.() === true) {
          return {
            geste: "ADAPTER", strategie, sautes,
            pourquoi: "le résultat amont est interprétable sans ambiguïté ; rien à rechercher.",
          };
        }
        sautes.push(strategie);
        ecartes.push(strategie);
        continue;
      }

      case "DECOUPER":
        // Écarté par `barreauxEpuises` — inatteignable, mais l'exhaustivité du switch le veut.
        sautes.push(strategie);
        ecartes.push(strategie);
        continue;

      case "DEMANDER_HUMAIN":
        return {
          geste: "DEMANDER_HUMAIN", strategie, sautes,
          // La question NOMME ce qui manque. « Je n'ai pas trouvé, que faire ? » ne s'appelle pas
          // demander de l'aide (§22) : cela renvoie le problème sans l'avoir instruit.
          question: `Pour ${objectif} : ${compteRendu(cible, historique.sources)} `
            + "Savez-vous où cette pièce se trouve, ou pouvez-vous me l'envoyer ?",
        };

      case "REPLAN_LOCAL":
        return {
          geste: "REPLAN_LOCAL", strategie, sautes,
          pourquoi: `la partie du plan qui portait ${objectif} doit être récrite ; le reste tient.`,
        };

      case "REPLANIFIER":
        return { geste: "REPLANIFIER", strategie, sautes, pourquoi: "la méthode prévue ne peut pas aboutir." };

      case "ESCALADER":
        return { geste: "ESCALADER", strategie, sautes, pourquoi: `${objectif} ne peut pas aboutir sans arbitrage.` };

      case "DECLARER_INCONNU":
        return {
          geste: "BLOQUER", sautes,
          pourquoi: `${compteRendu(cible, historique.sources)} `
            + `Je n'ai pas de quoi établir ${objectif} avec certitude.`,
        };
    }
  }

  // INATTEIGNABLE : chaque tour écarte au moins un barreau, et la borne est la taille de
  // l'échelle. On le dit plutôt que de boucler en silence.
  return { geste: "BLOQUER", sautes, pourquoi: `L'échelle de recours pour ${objectif} n'a pas convergé.` };
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
