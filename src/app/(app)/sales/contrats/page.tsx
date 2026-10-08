import Link from "next/link";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { formatNumber } from "@/lib/utils";
import { chainesContratsPch } from "@/lib/ventes-pch/requetes";
import { InfoBulle } from "@/components/ui/info-bulle";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EnteteVentesPch } from "../entete";
import { FiltresVentesPch } from "../filtres";
import { contexteVentesPch, type ParamsVentesPch } from "../contexte";

export const dynamic = "force-dynamic";

/** La barre d'un contrat : commandé (plein) et livré (foncé) sur l'attribué ; au-delà, le dépassement en orange. */
function Barre({ attribue, commande, livre }: { attribue: number; commande: number; livre: number }) {
  const echelle = Math.max(attribue, commande, 1);
  const pc = (v: number) => `${Math.min(100, (v / echelle) * 100)}%`;
  return (
    <div className="relative h-2.5 w-40 overflow-hidden rounded-full bg-secondary" aria-hidden>
      <div className="absolute inset-y-0 left-0 bg-primary/35" style={{ width: pc(Math.min(commande, attribue)) }} />
      {commande > attribue && <div className="absolute inset-y-0 bg-warning" style={{ left: pc(attribue), width: pc(commande - attribue) }} />}
      <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: pc(livre) }} />
      {attribue > 0 && commande > attribue && <div className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: pc(attribue) }} />}
    </div>
  );
}

/**
 * VENTES PCH — LA CHAÎNE DE CHAQUE CONTRAT (Direction, 08/10 : « on nous attribue un volume global lors de l'appel
 * d'offres, puis on signe un contrat, puis la PCH envoie des bons de commande… si ça dépasse l'AO, on passe à des
 * avenants »). Attribué → BC cumulés → livré → reste ; au-delà de l'attribué, le dépassement est un avenant.
 */
export default async function ContratsVentesPchPage({ searchParams }: { searchParams: ParamsVentesPch }) {
  const user = await requireModule("PCH_VENTES");
  const ctx = await contexteVentesPch(searchParams);
  const lignes = await chainesContratsPch(ctx.buId);
  const voitPch = userCan(user, "PCH", "VIEW");

  return (
    <div className="space-y-4">
      <EnteteVentesPch user={user} />
      <FiltresVentesPch bus={ctx.bus} buId={ctx.buId} type={ctx.type} refMois={ctx.ref} moisDisponibles={ctx.moisDisponibles} sansPeriode />
      <div className="flex items-center gap-2 text-sm font-medium">
        Contrats en cours · unités du marché
        <InfoBulle>
          Attribué : les lignes du contrat (avenants compris), à défaut la quantité gagnée à l&apos;appel d&apos;offres. BC cumulés : les bons de
          commande de la PCH (hors annulés). Livré : les bons de livraison datés. Barre : clair = commandé, foncé = livré, orange = au-delà de
          l&apos;attribué (avenant). Les chiffres viennent de Marchés PCH.
        </InfoBulle>
      </div>
      {lignes.length === 0 ? (
        <p className="surface p-4 text-sm text-muted-foreground">Aucun marché gagné ni contrat rattaché à nos produits.</p>
      ) : (
        <div className="surface overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-card">Produit</TableHead>
                <TableHead>Marché · contrat</TableHead>
                <TableHead>Avancement</TableHead>
                <TableHead className="text-right">Attribué</TableHead>
                <TableHead className="text-right">BC cumulés</TableHead>
                <TableHead className="text-right">Livré</TableHead>
                <TableHead className="text-right">Reste sur l&apos;AO</TableHead>
                <TableHead className="text-right">Dépassement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l) => (
                <TableRow key={l.cle}>
                  <TableCell className="sticky left-0 z-10 min-w-[180px] bg-card">
                    <Link href={`/produits/${l.productId}`} className="font-medium text-primary hover:underline">{l.nom}</Link>
                    {l.bus.length > 0 && <p className="text-xs text-muted-foreground">{l.bus.map((b) => b.nom).join(", ")}</p>}
                  </TableCell>
                  <TableCell className="min-w-[200px] [overflow-wrap:anywhere]">
                    {l.marche ? (voitPch ? <Link href={`/pch/${l.marche.id}`} className="text-primary hover:underline">{l.marche.reference}</Link> : l.marche.reference) : "—"}
                    {l.contrat && <p className="text-xs text-muted-foreground">{l.contrat.reference ? `${l.contrat.reference} · ` : ""}{l.contrat.titre}</p>}
                    {!l.contrat && <p className="text-xs text-muted-foreground">sans contrat enregistré</p>}
                  </TableCell>
                  <TableCell>
                    <Barre attribue={l.chaine.attribue} commande={l.chaine.commande} livre={l.chaine.livre} />
                    <p className="mt-1 text-xs text-muted-foreground">{l.chaine.pctCommande !== null ? `${l.chaine.pctCommande.toLocaleString("fr-FR")} % commandé` : "attribué inconnu"} · {l.bcs} BC</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(l.chaine.attribue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(l.chaine.commande)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(l.chaine.livre)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(l.chaine.reste)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.chaine.depassement > 0 ? <span className="font-medium text-warning">{formatNumber(l.chaine.depassement)}</span> : "—"}
                    {l.chaine.avenant && <Badge tone="warning" className="ml-1.5">avenant{l.bcAvenants ? ` · ${l.bcAvenants} BC` : ""}</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
