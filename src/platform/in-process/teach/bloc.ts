/**
 * LE BLOC DE RÈGLES, côté plateforme — la porte par laquelle la conversation le relit.
 *
 * `src/lib/assistant.ts` ne doit pas ajouter d'import direct vers les domaines de l'ERP (le
 * cliquet de `boundary.test.ts` plafonne cette dette) ; la plateforme, elle, peut réexporter
 * une fonction pure de `src/lib/teach/`. Rien d'autre ici : pas de Prisma, pas de droits —
 * l'extraction travaille sur un texte déjà composé par `personalContext`, qui a déjà tranché
 * QUELLES règles s'appliquent à la personne.
 */
export { extraireBlocRegles, EN_TETE_BLOC_REGLES } from "@/lib/teach/compose";
// LA GARANTIE D'ENSEIGNEMENT (§119) — même porte, même raison : une fonction pure de `lib/teach/`,
// relue par les deux boucles de conversation sans ajouter d'import direct vers l'ERP.
export {
  gardeEnseignement, OUTILS_ENSEIGNEMENT, RAPPEL_ENSEIGNEMENT, DEMENTI_ENSEIGNEMENT, estEnonceEnseignement, pretendAvoirRetenu,
} from "@/lib/teach/garde";
