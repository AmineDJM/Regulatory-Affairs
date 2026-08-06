import Link from "next/link";
import { Package, AlertTriangle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gammesLabel, positionLabel, type Portfolio } from "@/lib/sales-portfolio";

/**
 * MA GAMME ET MES PRODUITS — ce que je porte réellement ce cycle.
 *
 * L'affectation existait déjà dans « Prévisions & Force de vente », mais personne ne la voyait :
 * un délégué ne savait pas, depuis son espace, quels produits lui étaient attribués ni avec
 * quelle priorité.
 *
 * Deux choses que la carte dit explicitement plutôt que de les taire :
 *   • **le report de cycle** — quand la Direction n'a pas encore arrêté le cycle en cours, on
 *     montre le dernier connu ET on le signale, sinon on laisserait croire à une reconduction ;
 *   • **la provenance** — un produit qui vient de l'équipe n'est pas porté en direct par un
 *     superviseur, et confondre les deux fausserait sa lecture de sa propre charge.
 *
 * Composant SERVEUR : aucun JS envoyé au navigateur.
 */
export function MyPortfolioCard({ portfolio }: { portfolio: Portfolio }) {
  const { products, cycleLabel, fromPreviousCycle, hasTeam } = portfolio;

  // Rien à porter et aucune équipe : la carte n'apprendrait rien, on ne l'affiche pas.
  if (products.length === 0 && !hasTeam) return null;

  const own = products.filter((p) => !p.viaTeam);
  const team = products.filter((p) => p.viaTeam);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4 text-primary" /> Ma gamme et mes produits
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info" dot={false}>{gammesLabel(products)}</Badge>
          {cycleLabel && <span className="text-xs text-muted-foreground">Cycle {cycleLabel}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun produit ne vous est attribué pour l&apos;instant. Les affectations se font dans
            <Link href="/planning/affectations" className="ml-1 font-medium text-primary hover:underline">Prévisions &amp; Force de vente</Link>.
          </p>
        ) : (
          <>
            {fromPreviousCycle && (
              <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-2.5 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  Le cycle en cours n&apos;a pas encore été arrêté : voici votre portefeuille du
                  <strong> cycle {cycleLabel}</strong>. Il peut changer.
                </span>
              </p>
            )}

            <ProductList products={own} />

            {team.length > 0 && (
              <div className="border-t border-border pt-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Portés par mon équipe
                </p>
                <ProductList products={team} muted />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProductList({ products, muted }: { products: Portfolio["products"]; muted?: boolean }) {
  if (products.length === 0) return null;
  return (
    <ul className="divide-y divide-border">
      {products.map((p) => (
        <li key={p.productId} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
          <Badge tone={p.position === 1 ? "success" : p.position === 2 ? "info" : "neutral"} dot={false}>
            {positionLabel(p.position)}
          </Badge>
          <span className={`min-w-0 flex-1 ${muted ? "text-muted-foreground" : ""}`}>{p.name}</span>
          <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
            {p.channel === "RETAIL" ? "Ville" : p.channel === "HOSPITAL" ? "Hôpital" : "Ville · Hôpital"}
            {p.plannedVisits > 0 ? ` · ${p.plannedVisits} visite${p.plannedVisits > 1 ? "s" : ""}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
