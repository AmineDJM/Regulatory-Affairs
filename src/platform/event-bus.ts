import type { DomainEvent, EventHandler, Unsubscribe } from "./contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BUS D'ÉVÉNEMENTS — comment Adam apprend qu'une chose a changé, sans demander sans cesse.
 *
 * ── POURQUOI IL N'Y EN AVAIT PAS, ET POURQUOI IL EN FAUT UN ──────────────────────────────
 *
 * Jusqu'ici Adam relisait la base à chaque question. C'est correct et c'est lent : la fraîcheur
 * était payée à CHAQUE lecture, par tout le monde, y compris quand rien n'avait bougé. Un bus
 * inverse la charge — on paie une fois, au moment du changement, et les lectures deviennent
 * gratuites.
 *
 * ── LA RÈGLE QUI PROTÈGE L'ERP ───────────────────────────────────────────────────────────
 *
 * **PUBLIER NE DOIT JAMAIS FAIRE ÉCHOUER UNE ÉCRITURE MÉTIER.** Un abonné qui lève une
 * exception, qui est lent, ou qui n'existe pas encore, ne doit avoir aucun effet sur la
 * validation d'un paiement. Chaque abonné est donc isolé : son erreur est journalisée et
 * avalée. Le jour où l'on voudra des livraisons garanties, ce sera une file persistante — pas
 * une exception qui remonte dans une transaction Finance.
 *
 * Corollaire d'ordonnancement : on publie APRÈS que l'écriture soit acquise. Publier avant
 * ferait exister un événement décrivant un fait qui pourrait encore être annulé.
 *
 * ── CE QUE CE BUS EST, HONNÊTEMENT ───────────────────────────────────────────────────────
 *
 * En-processus, en mémoire, non persistant. Cela suffit exactement au modèle visé — Adam vit
 * dans le même processus que l'ERP — et cela a une limite qu'il faut dire plutôt que découvrir :
 * avec plusieurs instances de serveur, chaque instance ne voit QUE ses propres événements.
 * Les projections d'Adam sont donc conçues pour tolérer d'être en retard (cf. `projection.ts`) :
 * elles accélèrent, elles ne font jamais autorité. Le jour où l'on passe à plusieurs instances
 * pour de bon, on remplace l'intérieur de ce fichier par un transport partagé — l'interface
 * publique, elle, ne bouge pas. C'est précisément à cela que sert une frontière.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce que l'appelant fournit ; le bus complète l'horodatage et le numéro de séquence. */
export type EventInput = Omit<DomainEvent, "at" | "seq">;

/**
 * LA MÉMOIRE COURTE DU BUS. Un abonné qui démarre en retard (premier tour après un
 * redémarrage, chargement paresseux d'un module) peut rattraper ce qu'il a manqué. Bornée :
 * un journal illimité en mémoire est une fuite qui finit par tuer le processus.
 */
const REPLAY_CAPACITY = 500;

const handlers = new Set<EventHandler>();
let recent: DomainEvent[] = [];
let sequence = 0;

/** Compteurs d'observabilité — lus par `busStats()`, jamais par la logique. */
let publishedCount = 0;
let handlerFailures = 0;

/**
 * PUBLIE un fait. À appeler APRÈS que l'écriture métier soit acquise.
 *
 * Rend l'événement complété (horodaté, numéroté) : l'appelant peut le journaliser sans avoir à
 * reconstruire ce que le bus a décidé.
 */
export function publish(input: EventInput): DomainEvent {
  sequence += 1;
  const event: DomainEvent = { ...input, at: new Date().toISOString(), seq: sequence };

  recent.push(event);
  if (recent.length > REPLAY_CAPACITY) recent = recent.slice(-REPLAY_CAPACITY);
  publishedCount += 1;

  for (const handler of handlers) {
    try {
      handler(event);
    } catch (err) {
      // ISOLÉ, ET C'EST TOUT L'INTÉRÊT : un abonné qui casse ne casse que lui-même.
      handlerFailures += 1;
      console.error("[adam-bus] abonné en échec", event.type, err);
    }
  }
  return event;
}

export interface SubscribeOptions {
  /**
   * Rejouer les faits déjà publiés depuis ce numéro de séquence (exclu). `0` rejoue tout ce que
   * la mémoire courte détient encore. Omis : on ne reçoit que la suite.
   */
  replayFrom?: number;
}

export function subscribe(handler: EventHandler, opts: SubscribeOptions = {}): Unsubscribe {
  if (opts.replayFrom !== undefined) {
    for (const past of recent.filter((e) => e.seq > (opts.replayFrom as number))) {
      try {
        handler(past);
      } catch (err) {
        handlerFailures += 1;
        console.error("[adam-bus] rejeu en échec", past.type, err);
      }
    }
  }
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}

export interface BusStats {
  published: number;
  subscribers: number;
  handlerFailures: number;
  lastSeq: number;
  buffered: number;
}

export const busStats = (): BusStats => ({
  published: publishedCount,
  subscribers: handlers.size,
  handlerFailures,
  lastSeq: sequence,
  buffered: recent.length,
});

/** Remise à zéro — réservée aux tests. Le bus d'un processus vivant ne se vide pas. */
export function resetBus(): void {
  handlers.clear();
  recent = [];
  sequence = 0;
  publishedCount = 0;
  handlerFailures = 0;
}
