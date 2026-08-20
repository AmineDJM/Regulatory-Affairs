import { redirect } from "next/navigation";

/** Ancienne adresse d'un dossier de paiement — conservée pour les liens déjà envoyés. */
export default function LegacyPaymentRequestPage({ params }: { params: { id: string } }) {
  redirect(`/finances/paiements/${params.id}`);
}
