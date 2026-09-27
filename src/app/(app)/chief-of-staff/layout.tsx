import { exigerAdamVisible } from "@/platform/in-process/visibilite-adam";

/**
 * LE BUREAU D'ADAM N'EXISTE QUE POUR LE SUPER ADMIN (§118.153).
 *
 * Décision de la Direction : Adam n'est visible de personne d'autre, et le chief of staff est en
 * pause de développement. La porte vit au niveau du SEGMENT, pas page par page : la boîte de
 * décision, les réglages et toute page ajoutée demain sous `/chief-of-staff` passent par ici — une
 * garde recopiée dans chaque page serait oubliée dans la suivante (§118.71). La réponse est la
 * même page qu'une adresse inconnue : dire « réservé » annoncerait un produit qu'on ne montre pas.
 * La règle arrive par le PONT (`platform/in-process/visibilite-adam`) : lue ici en direct, elle
 * ajoutait deux franchissements de frontière (§118.114).
 */
export default async function ChiefOfStaffLayout({ children }: { children: React.ReactNode }) {
  await exigerAdamVisible();
  return <>{children}</>;
}
