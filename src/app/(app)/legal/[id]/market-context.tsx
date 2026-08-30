import Link from "next/link";
import { ExternalLink, Gavel } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * LE CONTEXTE MARCHÉ D'UN ENGAGEMENT (§16, §64) — le contrat est UN SEUL objet, deux vues :
 * Legal instruit la pièce (dates, revue, lecteurs), PCH lit l'exécution. Cette carte est la
 * passerelle : le marché d'origine, la valeur COURANTE (initial + deltas des avenants
 * effectifs — jamais un montant réécrit), et les avenants. Un avenant montre le contrat qu'il
 * modifie. Les montants viennent du MÊME module de calcul que la fiche marché.
 */
export interface MarketContextProps {
  kind: string;
  tender: { id: string; reference: string; title: string | null } | null;
  amends: { id: string; title: string } | null;
  /** Avenants du contrat, avec leur poids — déjà triés du plus ancien au plus récent. */
  amendments: { id: string; title: string; amountDelta: number | null; effectiveAt: Date | null; signedAt: Date | null; status: string }[];
  montantInitial: number | null;
  valeurCourante: number | null;
  amountDelta: number | null;
  effectiveAt: Date | null;
}

export function MarketContext({ ctx }: { ctx: MarketContextProps }) {
  const estAvenant = ctx.kind === "AMENDMENT";
  if (!ctx.tender && !estAvenant && ctx.amendments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Gavel className="h-4 w-4" aria-hidden /> Contexte marché</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {ctx.tender && (
          <div>
            <p className="text-xs text-muted-foreground">Marché d&apos;origine</p>
            <Link href={`/pch/${ctx.tender.id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {ctx.tender.reference}{ctx.tender.title ? ` — ${ctx.tender.title}` : ""} <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}

        {estAvenant && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Avenant du contrat</p>
              {ctx.amends ? (
                <Link href={`/legal/${ctx.amends.id}`} className="font-medium text-primary hover:underline">{ctx.amends.title}</Link>
              ) : (
                <p className="font-medium text-muted-foreground">contrat d&apos;origine supprimé — le fil est cassé, la pièce demeure</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Impact sur la valeur</p>
              <p className="font-medium tabular-nums">
                {ctx.amountDelta !== null ? `${ctx.amountDelta >= 0 ? "+" : ""}${formatCurrency(ctx.amountDelta)}` : "aucun"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prise d&apos;effet</p>
              <p className="font-medium">
                {ctx.effectiveAt
                  ? formatDate(ctx.effectiveAt)
                  : <span className="text-warning">pas encore effectif — ses deltas ne comptent pas</span>}
              </p>
            </div>
          </div>
        )}

        {!estAvenant && ctx.amendments.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Montant initial (jamais réécrit)</p>
                <p className="font-medium tabular-nums">{ctx.montantInitial !== null ? formatCurrency(ctx.montantInitial) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valeur courante (initial + avenants effectifs)</p>
                <p className="font-semibold tabular-nums">{ctx.valeurCourante !== null ? formatCurrency(ctx.valeurCourante) : "—"}</p>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">Avenants ({ctx.amendments.length})</p>
              <ul className="space-y-1.5">
                {ctx.amendments.map((a) => {
                  const effectif = a.status !== "CANCELLED" && a.effectiveAt !== null && a.effectiveAt <= new Date();
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-2">
                      <Link href={`/legal/${a.id}`} className="min-w-0 truncate font-medium hover:underline">{a.title}</Link>
                      {a.amountDelta !== null && (
                        <span className={`tabular-nums text-xs ${a.amountDelta >= 0 ? "text-success" : "text-destructive"}`}>
                          {a.amountDelta >= 0 ? "+" : ""}{formatCurrency(a.amountDelta)}
                        </span>
                      )}
                      {a.status === "CANCELLED" ? (
                        <Badge tone="danger" dot={false}>Annulé</Badge>
                      ) : effectif ? (
                        <Badge tone="success" dot={false}>Effectif{a.effectiveAt ? ` au ${formatDate(a.effectiveAt)}` : ""}</Badge>
                      ) : (
                        <Badge tone="warning" dot={false}>{a.signedAt ? "Signé, pas encore effectif" : "En préparation"}</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
