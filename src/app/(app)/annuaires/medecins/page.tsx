import { requireModule } from "@/lib/session";
import { FeuillePraticiensHub } from "../feuille-praticiens";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaires — Médecins — AMD Internal OS" };

/** Onglet MÉDECINS du module « Annuaires » : la feuille des praticiens, tout grade sauf pharmacien. */
export default async function AnnuaireMedecinsPage({ searchParams }: { searchParams?: { annuaire?: string } }) {
  const user = await requireModule("DIRECTORIES");
  return <FeuillePraticiensHub user={user} grade="medecins" annuaire={searchParams?.annuaire ?? null} />;
}
