import { redirect } from "next/navigation";

/**
 * ANCIENNE ADRESSE — les factures sont CENTRALISÉES DANS LEGAL.
 *
 * Elles vivaient sous les Finances, à côté de la trésorerie et du livre comptable. C'était un
 * second registre : Legal tient déjà les engagements de la société — contrats, devis, bons de
 * commande — et une facture est le dernier maillon de cette même chaîne. Deux registres pour un
 * même objet finissent toujours par diverger, et la question « quelles factures de ce
 * fournisseur ? » n'a alors plus de réponse unique.
 *
 * La route reste et redirige : des liens internes, des notifications et des favoris pointent ici.
 * Un lien mort coûte plus cher qu'une redirection.
 */
export default function LegacyFinanceInvoicesPage() {
  redirect("/legal/factures");
}
