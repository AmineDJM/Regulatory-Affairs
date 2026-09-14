import { requireModule } from "@/lib/session";
import { FeuillePraticiensHub } from "../feuille-praticiens";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaires — Pharmaciens — AMD Internal OS" };

/**
 * Onglet PHARMACIENS du module « Annuaires » : la même feuille, filtrée sur le grade PHARMACIEN.
 * Une fiche ajoutée depuis cet onglet naît pharmacien — c'est ce qui la fait apparaître ici.
 */
export default async function AnnuairePharmaciensPage({ searchParams }: { searchParams?: { annuaire?: string } }) {
  const user = await requireModule("DIRECTORIES");
  return <FeuillePraticiensHub user={user} grade="pharmaciens" annuaire={searchParams?.annuaire ?? null} />;
}
