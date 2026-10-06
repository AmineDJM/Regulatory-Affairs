import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { peutAnnuaire } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { EnTeteAnnuaires } from "../en-tete";
import { FournisseursBoard } from "./fournisseurs-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Annuaires — Fournisseurs Regulatory — AMD Internal OS" };

/**
 * Onglet FOURNISSEURS REGULATORY du module « Annuaires » (Direction, 06/10) — un annuaire comme les autres : les
 * fabricants des dossiers d'enregistrement, avec leurs coordonnées, à ajouter, corriger, retirer. La même fiche que
 * les dossiers et le portail externe ; les COMPTES du portail restent au Super Admin (Administration › Fournisseurs).
 */
export default async function AnnuaireFournisseursPage() {
  const user = await requireModule("DIRECTORIES");
  if (!peutAnnuaire(user, "FOURNISSEURS", "VIEW")) redirect("/annuaires?denied=FOURNISSEURS");
  const fournisseurs = await prisma.supplier.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true, name: true, country: true, contactName: true, contactEmail: true, phone: true, website: true, address: true, city: true, notes: true, active: true,
      _count: { select: { products: true, users: true } },
    },
  });
  return (
    <div className="space-y-5">
      <EnTeteAnnuaires
        user={user}
        description="Les fabricants des dossiers d'enregistrement — leurs coordonnées, le nombre de dossiers qu'ils portent et leurs comptes du portail externe."
      />
      <FournisseursBoard
        fournisseurs={fournisseurs.map(({ _count, ...f }) => ({ ...f, dossiers: _count.products, comptes: _count.users }))}
        canCreate={peutAnnuaire(user, "FOURNISSEURS", "CREATE")}
        canEdit={peutAnnuaire(user, "FOURNISSEURS", "UPDATE")}
        canDelete={peutAnnuaire(user, "FOURNISSEURS", "DELETE")}
      />
    </div>
  );
}
