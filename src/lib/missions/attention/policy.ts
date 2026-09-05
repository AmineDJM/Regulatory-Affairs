import type { NiveauSignal, SignalAttention } from "@/lib/missions/ports";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA POLITIQUE D'ATTENTION — quand parler au dirigeant, à quel niveau, et comment le dire.
 *
 * ── LES CINQ NIVEAUX, ET CE QUI LES SÉPARE ───────────────────────────────────────────────
 *
 *   SILENCE    — rien : l'information est au journal de la mission, personne n'est dérangé.
 *   JOURNAL    — une ligne dans le centre de notifications, sans push : utile, pas urgent.
 *   INFO       — notification + push discret : « mission terminée », le résultat en trois lignes.
 *   ATTENTION  — notification + push insistant + e-mail : un blocage réel après recours, une
 *                attente qui a épuisé ses relances, une planification impossible.
 *   ARBITRAGE  — les mêmes canaux, et la formulation d'une DÉCISION : un accord sur un périmètre
 *                sensible, une question que ni les données ni le responsable ne peuvent régler.
 *
 * ── POURQUOI UNE TABLE ET PAS UN JUGEMENT DE MODÈLE ────────────────────────────────────────
 *
 * Parce que la personne doit pouvoir dire pourquoi Adam l'a dérangée cette fois et pas la
 * précédente. Un modèle interrogé à chaque occasion répondrait selon son contexte du moment ;
 * ici le niveau se lit dans une table, la cadence dans une constante, et un test le tient.
 *
 * ── LA COMPRESSION EXÉCUTIVE ──────────────────────────────────────────────────────────────
 *
 * Le dirigeant ne reçoit jamais la télémétrie des 73 étapes. Un message dit : le problème, le
 * contexte indispensable, la recommandation, la décision demandée — ou, pour une mission finie :
 * le résultat, ce qui a été fait, les conséquences, ce qui reste à surveiller. Le tout sous
 * 700 caractères, composé par le CODE depuis le journal : rien d'inventé, rien de long.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const NIVEAUX: readonly NiveauSignal[] = ["SILENCE", "JOURNAL", "INFO", "ATTENTION", "ARBITRAGE"];

/** Le niveau d'un signal — la table. */
export function classer(s: SignalAttention): NiveauSignal {
  switch (s.kind) {
    case "MISSION_COMPLETED":
      // Une mission sans aucun effet ni livrable (une lecture qui s'est faite toute seule) ne
      // vaut pas une interruption : la ligne au centre de notifications suffit.
      return (s.bilan?.effets?.length ?? 0) + (s.bilan?.livrables?.length ?? 0) > 0 || (s.bilan?.total ?? 0) >= 3 ? "INFO" : "JOURNAL";
    case "MISSION_PARTIAL": return "INFO";
    case "MISSION_BLOCKED": return "ATTENTION";
    case "MISSION_FAILED": return "ATTENTION";
    case "PLANNING_FAILED": return "ATTENTION";
    case "BUDGET_HOLD": return "ATTENTION";
    case "APPROVAL_REQUIRED":
      return s.niveauApprobation === "NORMAL" ? "ATTENTION" : "ARBITRAGE";
    case "PLAN_CHANGED": return "ARBITRAGE";
    // Une QUESTION est un arbitrage — sauf quand l'émetteur dit lui-même que c'est une simple
    // information (une réponse arrivée après la relance : à lire, pas à trancher séance tenante).
    case "QUESTION": return s.niveauSuggere === "INFO" ? "INFO" : "ARBITRAGE";
    case "WAIT_OVERDUE":
      // Tant qu'Adam relance lui-même, le dirigeant n'a rien à faire : JOURNAL. Quand l'échelle
      // de relances est épuisée (trois), c'est à lui de trancher.
      return (s.attente?.relances ?? 0) >= 3 ? "ATTENTION" : "JOURNAL";
    // ── LA SURVEILLANCE : « préviens-moi seulement s'il y a un problème » ────────────────
    // L'émetteur connaît la gravité (un statut qui change est une information, une échéance
    // dépassée une attention) ; sans indication, un problème vaut ATTENTION. Un problème
    // résolu ne dérange personne (journal) ; une cible terminée s'annonce une fois (info).
    case "WATCH_ALERT": return s.niveauSuggere && s.niveauSuggere !== "JOURNAL" ? s.niveauSuggere : "ATTENTION";
    case "WATCH_RESOLVED": return "JOURNAL";
    case "WATCH_ENDED": return "INFO";
  }
}

/** Les canaux d'un niveau. L'e-mail ne part qu'à partir d'ATTENTION : il est le canal le plus cher à lire. */
export function canauxPour(niveau: NiveauSignal): { notification: boolean; push: boolean; insistant: boolean; email: boolean } {
  switch (niveau) {
    case "SILENCE": return { notification: false, push: false, insistant: false, email: false };
    case "JOURNAL": return { notification: true, push: false, insistant: false, email: false };
    case "INFO": return { notification: true, push: true, insistant: false, email: false };
    // ATTENTION pousse et écrit, mais n'INSISTE pas : une notification qui reste sur l'écran
    // jusqu'à un geste est réservée à ce que seule sa décision débloque.
    case "ATTENTION": return { notification: true, push: true, insistant: false, email: true };
    case "ARBITRAGE": return { notification: true, push: true, insistant: true, email: true };
  }
}

/** LA CLÉ DE DÉDOUBLONNAGE : le même fait ne se dit qu'une fois par version de plan et par étape. */
export function cleDe(s: SignalAttention): string {
  const v = s.planVersion ?? 0;
  const etape = s.stepKey ?? "-";
  return `${s.kind}:${s.missionId}:v${v}:${etape}`;
}

/** Le temps de silence entre deux signaux de MÊME clé. Une décision ne se répète pas seule ; une info non plus. */
export function cadenceMs(niveau: NiveauSignal): number {
  switch (niveau) {
    case "SILENCE": return 0;
    case "JOURNAL": return 24 * 3600_000;
    case "INFO": return 24 * 3600_000;
    case "ATTENTION": return 6 * 3600_000;
    case "ARBITRAGE": return Number.POSITIVE_INFINITY; // une fois — la décision attend, on ne la redemande pas
  }
}

/** Au-delà de ce nombre de signaux INFO/ATTENTION par 24 h pour une personne, on rétrograde en JOURNAL. */
export const PLAFOND_QUOTIDIEN = 15;

const borne = (t: string, n: number): string => (t.length <= n ? t : `${t.slice(0, n - 1)}…`);
const phrase = (t: string | null | undefined): string => (t ?? "").replace(/\s+/g, " ").trim();

/** LE MESSAGE — composé, pas rédigé : quatre blocs au plus, 700 caractères au plus. */
export function composerMessage(s: SignalAttention): { titre: string; corps: string } {
  const b = s.bilan;
  const faits = b ? `${b.faites}/${b.total} étapes faites${b.echouees ? `, ${b.echouees} en échec` : ""}` : "";
  const effets = b?.effets?.length ? ` Actions : ${b.effets.slice(0, 4).join(" ; ")}.` : "";
  const livrables = b?.livrables?.length ? ` Livrables : ${b.livrables.slice(0, 3).join(", ")}.` : "";
  const surveiller = b?.aSurveiller?.length ? ` À surveiller : ${b.aSurveiller.slice(0, 3).join(" ; ")}.` : "";
  const raison = phrase(s.raison);
  switch (s.kind) {
    case "MISSION_COMPLETED":
      return { titre: `Mission terminée — ${s.titre}`, corps: borne(`Résultat : ${raison || "objectif atteint."}${effets}${livrables}${surveiller}`, 700) };
    case "MISSION_PARTIAL":
      return { titre: `Mission partiellement faite — ${s.titre}`, corps: borne(`Résultat : ${raison || "une partie de l'objectif reste ouverte."} Contexte : ${faits}.${effets}${surveiller}`, 700) };
    case "MISSION_BLOCKED":
      return {
        titre: `Bloqué — ${s.titre}`,
        corps: borne(`Problème : ${raison || "la mission ne peut plus avancer seule."} Contexte : ${faits}.${effets} Recommandation : ${phrase(s.decision) || "préciser la demande ou replanifier depuis l'écran de la mission"}.`, 700),
      };
    case "MISSION_FAILED":
      return { titre: `Échec — ${s.titre}`, corps: borne(`Problème : ${raison || "la mission a échoué."} Contexte : ${faits}. Décision demandée : relancer, reformuler ou abandonner.`, 700) };
    case "PLANNING_FAILED":
      return { titre: `Je n'ai pas pu planifier — ${s.titre}`, corps: borne(`Problème : ${raison || "aucun plan exécutable."} Décision demandée : reformuler la demande ou me donner l'élément manquant.`, 700) };
    case "BUDGET_HOLD":
      return { titre: `Plafond atteint — ${s.titre}`, corps: borne(`Problème : ${raison || "le budget de modèle de la mission est épuisé."} Décision demandée : relever le plafond ou arrêter la mission.`, 700) };
    case "APPROVAL_REQUIRED":
      return { titre: `Votre accord — ${s.titre}`, corps: borne(`Périmètre : ${raison || "des effets qui exigent votre accord."} Décision demandée : approuver ou refuser depuis l'écran de la mission.`, 700) };
    case "PLAN_CHANGED":
      return { titre: `Le plan a changé — ${s.titre}`, corps: borne(`Contexte : ${raison || "de nouvelles étapes ne sont pas couvertes par votre accord."} Décision demandée : approuver la partie modifiée, et elle seule.`, 700) };
    case "QUESTION":
      return s.niveauSuggere === "INFO"
        ? { titre: `Réponse après relance — ${s.titre}`, corps: borne(`${raison || "Une réponse est arrivée après la relance."} ${phrase(s.decision) ? `À décider : ${phrase(s.decision)}` : ""}`.trim(), 700) }
        : { titre: `Une précision — ${s.titre}`, corps: borne(`${raison || "Une information manque."} ${phrase(s.decision) ? `Décision demandée : ${phrase(s.decision)}` : ""}`.trim(), 700) };
    case "WATCH_ALERT":
      return {
        titre: `Surveillance — ${s.titre}`,
        corps: borne(`Problème : ${raison || "un signal de surveillance s'est déclenché."} ${phrase(s.decision) ? `Recommandation : ${phrase(s.decision)}` : ""}`.trim(), 700),
      };
    case "WATCH_RESOLVED":
      return { titre: `Surveillance — ${s.titre}`, corps: borne(`Revenu à la normale : ${raison || "le problème signalé n'est plus observé."}`, 700) };
    case "WATCH_ENDED":
      return { titre: `Surveillance terminée — ${s.titre}`, corps: borne(`Résultat : ${raison || "la cible surveillée est arrivée à son terme."} Je cesse de la surveiller.`, 700) };
    case "WAIT_OVERDUE": {
      const a = s.attente;
      return {
        titre: `Sans réponse — ${s.titre}`,
        corps: borne(`Problème : ${raison || "une attente a dépassé son échéance"}${a ? ` (${a.jours} jour(s), ${a.relances} relance(s) déjà faites)` : ""}. ${phrase(s.decision) ? `Décision demandée : ${phrase(s.decision)}` : "Recommandation : relancer par un autre canal ou escalader."}`, 700),
      };
    }
  }
}

export type { NiveauSignal };
