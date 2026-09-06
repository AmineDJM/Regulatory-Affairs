/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PONT DE LA PLANCHE (mandat 7) — et il ne fait presque rien, ce qui est le point.
 *
 * `lib/planche/` est un moteur PUR : pas de Prisma, pas de RBAC, pas d'appel de modèle. Il n'a
 * donc besoin d'aucune capacité, et ce pont ne lui en donne aucune.
 *
 * Alors pourquoi existe-t-il ? Pour la même raison que les ponts de `calcul/`, `graphe/` et
 * `geo/` : la frontière Adam ↔ ERP est mesurée par CHEMIN, pas par pureté. Un outil d'assistant
 * qui importerait `@/lib/planche/…` en direct compterait deux franchissements de plus au
 * cliquet — non parce qu'il ferait quelque chose de dangereux, mais parce que la mesure ne sait
 * pas distinguer un moteur pur d'un module métier, et qu'un cliquet qui accepte des exceptions
 * au cas par cas cesse de mesurer quoi que ce soit.
 *
 * On paie donc un fichier de réexportation, et la frontière reste une ligne nette.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export {
  compiler, raconter, repli,
  CONTENANTS, REFUS, PROFONDEUR_MAX, NOEUDS_MAX, ENFANTS_MAX,
} from "@/lib/planche/grammaire";
export type { Contenant, MotifRefus, Noeud, Planche, Probleme, Verdict } from "@/lib/planche/grammaire";

export { anglesUtiles, regarder, ANGLES } from "@/lib/planche/angle";
export type { Angle, Demande, Groupe, Ligne, Vue } from "@/lib/planche/angle";
