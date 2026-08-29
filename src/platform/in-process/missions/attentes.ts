/**
 * LE PONT DES ATTENTES — la grammaire « ce fait est-il celui qu'on attend ? », offerte à Adam.
 *
 * `missions/events/match.ts` est la SEULE vérité sur la correspondance fait ↔ attente : les
 * missions s'en servent pour se réveiller, les rappels conditionnels pour s'ÉTEINDRE (« le
 * contrat est arrivé, je me tais »). Deux matchers divergeraient, et celui qui diverge est
 * toujours celui qui garde.
 *
 * Adam n'importe pas la façade missions directement (cliquet de frontière) : il passe par ce
 * pont, dont c'est exactement le travail — comme l'adaptateur et le composeur voisins.
 */
export { correspond, lireAttente, type Attente, type FaitObserve } from "@/lib/missions/events/match";
