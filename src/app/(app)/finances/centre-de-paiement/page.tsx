import { redirect } from "next/navigation";

/**
 * Le centre de paiement a quitté les Finances : c'est un MODULE À PART (`/centre-de-paiement`).
 * Celui qui autorise l'argent ne doit pas être dans l'écran de celui qui le décaisse. L'ancienne
 * adresse reste valable — un lien copié dans un e-mail il y a un mois doit encore mener au bon
 * endroit.
 */
export default function LegacyCentrePage() {
  redirect("/centre-de-paiement");
}
