import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";

/**
 * `/medical` N'EST PAS UN ÉCRAN — c'est un aiguillage, et il dépend de qui pousse la porte.
 *
 * L'ancien « Visites & segmentation » a été retiré ; la route survit parce qu'elle vit dans des
 * favoris, des notifications et des liens collés en conversation. Elle mène désormais :
 *   • le TERRAIN (qui peut saisir une visite) vers « Ma journée » — sa tournée et sa saisie ;
 *   • tous les autres vers l'ANNUAIRE, qui est ce qu'ils venaient chercher.
 *
 * Un délégué qui tombait sur l'annuaire devait comprendre seul où noter sa visite. C'est ce
 * détour-là — trois écrans pour un geste quotidien — qui faisait ressortir le carnet papier.
 *
 * ⚠ AUCUNE DONNÉE N'A JAMAIS ÉTÉ SUPPRIMÉE : les visites (`MedicalVisit`) et l'historique sont
 * intacts, et « Ma journée » les relit.
 */
export default async function MedicalEntryPage() {
  const user = await requireModule("MEDICAL");
  redirect(userCan(user, "MEDICAL", "CREATE") ? "/medical/ma-journee" : "/medical/annuaire");
}
