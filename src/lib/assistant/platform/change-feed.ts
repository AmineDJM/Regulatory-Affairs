import { subscribe } from "@/platform/event-bus";
import type { DomainEvent } from "@/platform/contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PROJECTION « QUOI DE NEUF » — la seule que les mesures justifient.
 *
 * ── POURQUOI CELLE-CI, ET POURQUOI PAS UN CACHE DE DONNÉES ───────────────────────────────
 *
 * La mission demandait « une représentation opérationnelle locale, rapide et synchronisée ».
 * Avant d'en construire une, on a mesuré ce qu'elle ferait gagner. Les lectures canoniques
 * coûtent aujourd'hui **1,8 à 6,6 ms** (p50/p95, `findPeople` et le registre complet), quand un
 * tour d'Adam avec appel au modèle coûte de l'ordre de la **seconde**.
 *
 * Un cache de l'annuaire ferait donc gagner moins d'un demi pour cent du temps d'un tour, en
 * échange d'un risque de péremption sur des adresses et des salaires. C'est précisément la
 * « couche abstraite inutile » que la mission interdit — et on ne l'a pas construite.
 *
 * CE QUI, EN REVANCHE, N'A AUCUN ÉQUIVALENT RAPIDE : « qu'est-ce qui a bougé ? ». Y répondre
 * par lecture demande de balayer une dizaine de tables et de comparer des horodatages ; par
 * événements, c'est une lecture de tableau en mémoire. Le gain n'est pas de quelques
 * millisecondes, il est d'un ordre de grandeur — et il ouvre une capacité (savoir sans avoir
 * demandé) plutôt que d'accélérer une capacité existante.
 *
 * ── CE QUI FAIT AUTORITÉ, ET CE QUI N'EN FAIT PAS ────────────────────────────────────────
 *
 * Cette projection **ne fait jamais foi**. C'est un INDICE : « le dossier X a bougé il y a deux
 * minutes ». Pour dire ce qu'il contient, Adam relit la source canonique. La règle est absolue
 * parce que le bus est en mémoire et par processus : avec plusieurs instances, ce flux est
 * partiel. Un indice partiel reste utile ; une vérité partielle serait un mensonge.
 *
 * D'où le refus assumé d'y stocker le CONTENU des entités : ce serait la « seconde base ERP
 * concurrente » que la mission interdit nommément.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface ChangeEntry {
  type: string;
  subjectType: string;
  subjectId: string;
  at: string;
  seq: number;
  actorId: string | null;
  /** Un libellé court, quand l'événement en portait un. Jamais l'entité complète. */
  label: string | null;
}

/**
 * Bornée, et pour la même raison que la mémoire du bus : un journal illimité en mémoire est une
 * fuite qui finit par tuer le processus. Trois cents changements couvrent très largement la
 * question « quoi de neuf depuis ce matin ? » sur cette entreprise.
 */
const CAPACITY = 300;

let feed: ChangeEntry[] = [];
let started = false;
let stop: (() => void) | null = null;

/** Extrait un libellé lisible de la charge utile, sans jamais supposer sa forme. */
function labelOf(e: DomainEvent): string | null {
  for (const key of ["fullName", "title", "subject", "name", "ownerName"]) {
    const v = e.data[key];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 120);
  }
  return null;
}

/**
 * BRANCHE la projection sur le bus. Idempotent : deux appels ne produisent pas deux abonnements
 * (ce qui doublerait chaque changement dans le flux).
 */
export function startChangeFeed(): void {
  if (started) return;
  started = true;
  // `replayFrom: 0` RATTRAPE ce que le bus a gardé en mémoire. Sans cela, tout fait survenu
  // entre le démarrage du serveur et la première question posée à Adam serait perdu — et le
  // flux mentirait par omission précisément au moment où on le consulte le plus.
  stop = subscribe((e) => {
    feed.push({
      type: e.type,
      subjectType: e.subject.type,
      subjectId: e.subject.id,
      at: e.at,
      seq: e.seq,
      actorId: e.actorId,
      label: labelOf(e),
    });
    if (feed.length > CAPACITY) feed = feed.slice(-CAPACITY);
  }, { replayFrom: 0 });
}

export interface ChangeQuery {
  /** Ne rendre que ces types de sujet (« employee », « regulatory_product »…). */
  subjectTypes?: readonly string[];
  /** Ne rendre que ce qui est postérieur à ce numéro de séquence. */
  sinceSeq?: number;
  limit?: number;
}

/**
 * CE QUI A CHANGÉ — en mémoire, sans base, sans réseau.
 *
 * Le flux est rendu du plus RÉCENT au plus ancien : c'est l'ordre dans lequel la question se
 * pose (« quoi de neuf ? »), et il évite d'avoir à tout parcourir pour trouver la fin.
 */
export function recentChanges(q: ChangeQuery = {}): ChangeEntry[] {
  const wanted = q.subjectTypes ? new Set(q.subjectTypes) : null;
  const out: ChangeEntry[] = [];
  for (let i = feed.length - 1; i >= 0; i -= 1) {
    const e = feed[i];
    if (q.sinceSeq !== undefined && e.seq <= q.sinceSeq) break; // le flux est trié par seq
    if (wanted && !wanted.has(e.subjectType)) continue;
    out.push(e);
    if (out.length >= (q.limit ?? 50)) break;
  }
  return out;
}

export interface FeedHealth {
  entries: number;
  started: boolean;
  lastSeq: number;
  oldest: string | null;
  newest: string | null;
}

/**
 * L'ÉTAT DU FLUX — pour l'observabilité, et pour dire la vérité quand il est vide.
 *
 * `started: false` et `entries: 0` ne veulent pas dire « rien n'a changé » : ils veulent dire
 * « je ne sais pas ». Adam doit pouvoir faire la différence, sinon il annoncera une entreprise
 * au calme plat le jour où le bus n'a pas démarré.
 */
export const feedHealth = (): FeedHealth => ({
  entries: feed.length,
  started,
  lastSeq: feed.length ? feed[feed.length - 1].seq : 0,
  oldest: feed.length ? feed[0].at : null,
  newest: feed.length ? feed[feed.length - 1].at : null,
});

/** Remise à zéro — réservée aux tests. */
export function resetChangeFeed(): void {
  stop?.();
  stop = null;
  started = false;
  feed = [];
}
