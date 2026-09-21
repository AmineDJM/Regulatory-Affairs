import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * `/medical/etablissements` N'EST PLUS UN ÉCRAN — c'est une REDIRECTION.
 *
 * Décision de la Direction (09/2026) : « Dans Promotion médicale, enlève l'onglet des
 * établissements, vu qu'on les crée et qu'on les gère depuis les Annuaires. » L'onglet a donc
 * quitté `MEDICAL_TABS` et le référentiel ne vit plus qu'à UN endroit — Administration ›
 * Annuaires › Établissements, où il est édité, coloré et rattaché aux secteurs.
 *
 * ── POURQUOI LA ROUTE SURVIT ────────────────────────────────────────────────────────────
 *
 * Elle vit dans des favoris, dans des notifications déjà envoyées et dans des liens collés en
 * conversation — c'est exactement la raison pour laquelle `/medical` est déjà un aiguillage et
 * pas une page. Un lien écrit il y a six mois reste valide, sans qu'on ait rien à réécrire.
 *
 * ── ET POURQUOI CE N'EST PAS UNE PERTE D'ACCÈS ──────────────────────────────────────────
 *
 * Mesuré avant de rediriger : le module `DIRECTORIES` est accordé IMPLICITEMENT à tout le monde
 * (`rbac.ts` : « Annuaires est une porte, pas un droit »), et l'onglet Établissements du
 * concentrateur est gardé par `MEDICAL:VIEW` — exactement la porte qui gardait celui-ci.
 * Personne ne perd donc rien ; sans cette mesure, la redirection aurait pu fermer l'écran à qui
 * l'utilisait (§118.27).
 *
 * La garde reste posée ICI, avant la redirection : renvoyer sans vérifier ferait de cette route
 * un contournement de la porte qu'elle remplace.
 */
export default async function EtablissementsRedirectPage() {
  await requireModule("MEDICAL");
  redirect("/annuaires/etablissements");
}
