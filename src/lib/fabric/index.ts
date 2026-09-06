/**
 * LA FAÇADE DE LA FABRIC — un seul point d'entrée pour les consommateurs.
 *
 * Le cliquet de frontière (`boundary-scan`) compte les imports PAR INSTRUCTION : un fichier
 * d'Adam qui consomme trois briques de la fabric par ce baril paie UN franchissement, déclaré
 * une fois — au lieu de trois lignes qui feraient monter la dette pour le même couplage.
 */
export { chercherContenu, versTsquery, type ResultatContenu, type SourceContenu } from "@/lib/fabric/text-search";
export {
  enregistrerMentions, balayerMentions, documentsLies, resoudreEntitesDe,
  extraireMentions, dictionnaireCanonique, viderCacheDictionnaire, type EntiteDictionnaire,
} from "@/lib/fabric/mentions";
export { SOURCES, fraicheurDe, type DescripteurSource, type Fraicheur } from "@/lib/fabric/registry";
export { lireEtatChaud, rechaufferEtatChaud, invaliderEtatsChauds, type LectureChaude } from "@/lib/fabric/hot-state";
export { creerLoteur, loteurNoeudsDrive, type Loteur, type MesureLoteur } from "@/lib/fabric/bulk";
export {
  extraireFaits, faitsDuTour, faitCalcule, declarerProvenance, expliquerFait, repondreProvenance,
  type FaitSource, type TourProvenance, type NatureSource,
} from "@/lib/fabric/provenance";
export { consignerProvenance, relireProvenance, repondreDouTuTiensCa } from "@/lib/fabric/provenance-store";
export { resoudreEntite, resoudreMentions, contexteEntitesResolues, type ResolutionEntite } from "@/lib/fabric/entites";
export { TYPES_ENTITE, LIBELLE_TYPE, LIBELLE_VERDICT, trancher, scorerNom, type TypeEntite, type Candidat, type Verdict } from "@/lib/fabric/entites-score";
