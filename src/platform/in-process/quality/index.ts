/**
 * LA QUALITÉ DES DONNÉES, côté plateforme — la porte par laquelle Adam, la boîte de décision et
 * l'écran d'administration lisent et décident. Le pont peut connaître l'ERP ; `lib/assistant/`
 * et `components/chief/` n'ajoutent pas d'import direct vers `lib/quality/`.
 */
export { balayerQualite, balayageQualiteSiDu, derniersBalayages, type RapportBalayage, type RapportRegle } from "@/lib/quality/engine";
export { lireConstats, compterConstats, modulesVisibles, type ConstatLu } from "@/lib/quality/read";
export { corrigerConstat, ignorerConstat, rouvrirConstat, type IssueDecision } from "@/lib/quality/decide";
export { REGLES, regleDe, LIMITE_PAR_REGLE } from "@/lib/quality/rules";
export {
  FAMILLES, CRITICITES, LIBELLE_FAMILLE, LIBELLE_CRITICITE, RANG_CRITICITE, SEUIL_AUTO,
  type Constat, type Correction, type Criticite, type FamilleQualite, type Resolution, type StatutConstat, type DefinitionRegle,
} from "@/lib/quality/model";
