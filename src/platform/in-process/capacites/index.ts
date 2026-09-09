/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PORT DES CAPACITÉS — ce par quoi Adam atteint N'IMPORTE QUELLE action de l'ERP.
 *
 * ── POURQUOI CE FICHIER EXISTE, ET C'EST LE CLIQUET QUI L'A DIT ──────────────────────────
 *
 * La première version branchait l'op générique directement sur `@/lib/actions/*`.
 * `boundary.test.ts` a compté 433 franchissements pour un plafond de 428 et refusé — le même
 * refus qui avait déjà eu raison sur le catalogue de colonnes Regulatory (§118.72). Relever le
 * plafond aurait été une ligne ; ç'aurait aussi été admettre qu'Adam connaît le dossier
 * `actions/` de l'ERP, alors que TOUT le contrat de plateforme existe pour l'en empêcher.
 *
 * Le remède est celui que le message d'échec nomme : passer par le contrat de plateforme. Ce
 * module est ce contrat pour les capacités — la SEULE porte, et elle est étroite.
 *
 * ── CE QU'IL N'AJOUTE PAS ────────────────────────────────────────────────────────────────
 *
 * Aucune logique. Il RÉEXPORTE, et c'est voulu : y glisser une vérification de droits en ferait
 * une seconde vérité qui prendrait du retard sur l'action (§118.5), et c'est la version en
 * retard qui serait la faille. Les contrôles vivent là où ils doivent vivre — le refus
 * d'auto-escalade dans `generique.ts`, les droits dans l'action elle-même.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type { ContratAction, ChampAction, TypeChamp } from "@/lib/actions/contrat";
export { direContrat } from "@/lib/actions/contrat";
export { CONTRATS_ACTIONS, CONTRAT_PAR_ID } from "@/lib/actions/contrat.genere";
export {
  chercherCapacites, interdictionGenerique, validerEntree,
  type CapaciteTrouvee, type EntreeRefusee,
} from "@/lib/actions/generique";
export { executerAction, type ResultatGenerique } from "@/lib/actions/executer";
// LA RELECTURE APRÈS ÉCRITURE — « c'est fait » n'est pas une preuve (§104.16). Elle relit
// par le MÊME chemin que l'écran (`porteeEntite`), donc sous les droits de la personne.
export { relireApresEcriture, type Relecture } from "@/lib/cibles/relire";
