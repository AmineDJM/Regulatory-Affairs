/**
 * LA PROVENANCE, côté plateforme — la porte par laquelle Adam relit et consigne ses faits.
 *
 * `src/lib/assistant.ts`, les routes d'Adam et ses outils n'ajoutent pas d'import direct vers la
 * fabric (le cliquet de `boundary.test.ts` plafonne cette dette) ; le pont, lui, réexporte les
 * briques de `src/lib/fabric/` — la même règle que `teach/bloc.ts`.
 */
export {
  extraireFaits, faitsDuTour, faitCalcule, declarerProvenance, expliquerFait, resumerFait, LIMITE_FAITS_PAR_TOUR, ancresNumeriques, ancresNominales,
  type FaitSource, type TourProvenance,
} from "@/lib/fabric/provenance";
export { consignerProvenance, relireProvenance, repondreDouTuTiensCa } from "@/lib/fabric/provenance-store";
