import { redirect } from "next/navigation";

/** Ancienne adresse d'un dossier de paiement — conservée pour les liens déjà envoyés. */
export default function LegacyFinancePaymentPage({ params }: { params: { id: string } }) {
  redirect(`/validations/paiements/${params.id}`);
}
