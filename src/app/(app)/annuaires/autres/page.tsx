import { redirect } from "next/navigation";

/**
 * « AUTRES ANNUAIRES » N'EXISTE PLUS (Direction, 06/10) : les fournisseurs Regulatory sont un annuaire à part entière,
 * les spécialités vivent dans Marketing cockpit, les partenaires du courrier et les lieux de stock dans leurs modules.
 * L'ancienne adresse mène à l'annuaire des fournisseurs.
 */
export default function AutresAnnuairesPage() {
  redirect("/annuaires/fournisseurs");
}
