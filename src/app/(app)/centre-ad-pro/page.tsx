import { notFound } from "next/navigation";
import { requireModule } from "@/lib/session";
import { getAppSettings } from "@/lib/settings";
import { siegeAuCentreAdPro, trierCentre, compteursCentre } from "@/lib/ad-pro/centre";
import { demandesAuCentreAdPro } from "@/lib/queries/ad-pro-centre";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { CentreAdProBoard } from "./centre-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Centre de validation Ad & Pro — AMD Internal OS" };

/**
 * LE CENTRE DE VALIDATION AD & PRO — décision de la Direction (09/2026).
 *
 * « Crée un centre de validation Ad&Pro pour le PDG et super admin. On gère depuis là le seuil à
 * partir duquel il faut une validation qui passe par ce centre. Toute demande parmi les demandes
 * Ad&Pro dont le budget total est au-dessus du seuil nécessite de passer par là, comme les autres
 * centres de validations. »
 *
 * Le module s'ouvre par le RBAC, mais le SIÈGE est une règle d'organisation : un administrateur
 * qui s'octroierait le module ne devient pas pour autant l'arbitre des dépenses de promotion.
 * La règle pure a le dernier mot — comme au centre de paiement et au centre de validations.
 */
export default async function CentreAdProPage() {
  const user = await requireModule("AD_PRO_CENTRE");
  if (!siegeAuCentreAdPro(user)) notFound();

  const [lignes, settings] = await Promise.all([demandesAuCentreAdPro(), getAppSettings()]);
  const rows = trierCentre(lignes);
  const c = compteursCentre(rows, new Date());

  return (
    <div className="space-y-5">
      <PageHeader
        title="Centre de validation Ad & Pro"
        description="Toute demande de promotion dont le budget total dépasse le seuil s'arrête ici, quelle que soit sa nature — sponsoring, prises en charge, événements, matériel promotionnel, consulting, autres demandes. La plus ancienne en tête : c'est elle qui bloque quelqu'un. Le seuil se règle sur cet écran."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="En attente d'arbitrage" value={String(c.enAttente)} icon="Scale" tone={c.enAttente > 0 ? "warning" : "default"} />
        <KpiCard label="Dormantes (≥ 7 jours)" value={String(c.dormantes)} icon="Clock" tone={c.dormantes > 0 ? "danger" : "default"} hint="Un dossier qui dort bloque quelqu'un." />
        <KpiCard
          label="Engagement en attente"
          value={`${c.montantTotal.toLocaleString("fr-FR")} DZD`}
          icon="Coins"
          /* Le nombre de lignes SANS montant voyage avec le total : sans lui, la somme se lirait
             comme exhaustive alors qu'elle ne porte que les montants connus (§118.60). */
          hint={c.sansMontant > 0 ? `${c.sansMontant} demande(s) sans montant renseigné — non comptée(s) dans ce total.` : undefined}
        />
        <KpiCard
          label="Seuil en vigueur"
          value={settings.adProDgThreshold > 0 ? `${settings.adProDgThreshold.toLocaleString("fr-FR")} DZD` : "Aucun"}
          icon="SlidersHorizontal"
          hint={settings.adProDgThreshold > 0 ? "Strictement au-dessus de ce montant." : "Aucune demande ne passe par le centre."}
        />
      </div>

      <CentreAdProBoard rows={rows} seuil={settings.adProDgThreshold} />
    </div>
  );
}
