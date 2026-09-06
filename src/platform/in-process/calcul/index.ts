/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES MOTEURS DE CALCUL, côté plateforme (mandat 5 §39) — la porte par laquelle Adam CALCULE.
 *
 * `src/lib/calcul/` est PUR : pas de Prisma, pas de RBAC, pas de session, pas d'appel de modèle.
 * Un moteur qui lirait la base pourrait rendre un chiffre qu'une personne n'a pas le droit de
 * voir ; ici il ne reçoit que des nombres. Les DONNÉES arrivent par le bac à sable, qui porte le
 * droit de leur source, et les résultats repartent par les outils, qui portent la provenance.
 *
 * Ce pont ne fait donc qu'une chose : réexporter. C'est voulu — il existe pour que la couche Adam
 * n'importe jamais `lib/calcul/` directement, exactement comme pour le bac à sable et les médias.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export {
  type Loi, LOIS, generateur, normaleStandard, phi, phiInverse, quantile, esperance, validerLoi, cholesky,
  betaIncompleteReguliere, logGamma,
} from "@/lib/calcul/alea";

export {
  type Rigueur, rigueurVide, arrondi, arrondiLisible, moyenne, mediane, ecartType, variance, percentile, percentileTrie,
  pearson, spearman, rangs, matriceDepuisPaires, trie,
} from "@/lib/calcul/rigueur";

export { type Compilee, type ResultatCompilation, compiler, evaluer, compilerSysteme, FONCTIONS_CONNUES } from "@/lib/calcul/expression";

export {
  type ModeleMonteCarlo, type OptionsSimulation, type ResultatSimulation, type ResultatMonteCarlo, type Distribution,
  type Sensibilite, type Probabilite, type Seuil, type Correlation,
  simuler, resumerSimulation, TIRAGES_DEFAUT, TIRAGES_MAX, TIRAGES_MIN, PERCENTILES_DEFAUT, ENTREES_MAX, FORMULES_MAX,
} from "@/lib/calcul/montecarlo";

export {
  type Programme, type Variable, type Contrainte, type Optimum, type ResultatOptimisation, type ContrainteResolue, type Sens, type Comparateur,
  optimiser, resumerOptimum, VARIABLES_MAX, CONTRAINTES_MAX,
} from "@/lib/calcul/simplexe";

export {
  type Projet, type Tache, type TachePlanifiee, type ResultatOrdonnancement, type Ordonnancement,
  ordonnancer, resumerOrdonnancement, TACHES_MAX,
} from "@/lib/calcul/ordonnancement";

export {
  type ProblemeCsp, type VariableCsp, type ContrainteCsp, type SolutionCsp, type EchecCsp, type ResultatCsp, type Valeur,
  resoudreContraintes, VARIABLES_CSP_MAX,
} from "@/lib/calcul/contraintes";

export {
  type Regression, type ResultatRegression, type RegressionLogistique, type ResultatLogistique, type Coefficient,
  type Test, type Description, type Liaison, type OptionsRegression,
  regresser, regresserLogistique, testMoyennes, testApparie, testIndependance, testRangs, decrireColonnes, correlations,
  loiStudent, loiFisher, loiKhiDeux, pValeurStudent, pValeurFisher, pValeurKhiDeux, quantileStudent, gammaIncompleteReguliere,
  OBSERVATIONS_MIN, OBSERVATIONS_MAX, PREDICTEURS_MAX,
} from "@/lib/calcul/stats";

export {
  type Segmentation, type ResultatSegmentation, type Groupe, type Acp, type ResultatAcp, type Composante,
  type Anomalie, type DetectionAnomalies, type ResultatAnomalies, type Matrice,
  segmenter, resumerSegmentation, acp, detecterAnomalies, matriceDe, normaliser, POINTS_MAX, DIMENSIONS_MAX,
} from "@/lib/calcul/ml";

export {
  type Serie, type ResultatSerie, type Point, type Prevision, type Rupture, type OptionsSerie,
  analyserSerie, resumerSerie, detecterPeriode, autocorrelation, POINTS_MIN, HORIZON_MAX,
} from "@/lib/calcul/series";
