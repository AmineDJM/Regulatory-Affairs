import { ArrowLeft, Coins, History } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getCompanyScope } from "@/lib/company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/shared/back-link";
import { regulatoryAiSpend } from "@/lib/regulatory/intelligence/cost/ledger";
import { listRegulatoryAudit } from "@/lib/regulatory/intelligence/queries";
import { resolveRegCompanyId } from "@/lib/regulatory/intelligence/access";
import { DossierBudgetRow } from "./budget-row";

/**
 * COÛT DE L'IA & JOURNAL D'AUDIT — vue de GESTION, transverse à tous les dossiers.
 *
 * Ces deux blocs vivaient sur la fiche de chaque dossier CTD. Ils y étaient mal placés : le
 * pharmacien qui analyse un dossier ne décide pas d'un plafond de dépense et ne fait pas de
 * revue de conformité interne — il les lisait à chaque passage sans jamais agir dessus. Et
 * surtout, la question qu'ils servent réellement (« combien nous coûte l'analyse CTD, et qui a
 * fait quoi sur le module ») ne se répond QUE sur l'ensemble des dossiers.
 */
export const metadata = { title: "Coût IA & audit Regulatory — AMD Internal OS" };
export const dynamic = "force-dynamic";

const fmtUsd = (n: number) => `${n.toFixed(2)} $`;
const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("fr-DZ", { dateStyle: "short", timeStyle: "short" }).format(d);

const STEP_LABELS: Record<string, string> = {
  classify: "Classement des pièces",
  review: "Revue de fond",
  facts: "Extraction des données",
  vision: "Lecture des figures",
  "reserve-extract": "Lecture des réserves ANPP",
  "reserve-similar": "Réserves comparables",
  simulate: "Simulateur d'examen",
  chat: "Chat de dossier",
};

export default async function RegulatoryIaAdminPage() {
  const admin = await requireModule("ADMIN", "VIEW");
  const companyId = await resolveRegCompanyId(getCompanyScope());
  const canManage = admin.role === "SUPER_ADMIN";

  const [spend, audit] = await Promise.all([
    regulatoryAiSpend(companyId),
    listRegulatoryAudit({ companyId, take: 200 }),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/admin">
        <ArrowLeft className="h-4 w-4" /> Retour à l&apos;administration
      </BackLink>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coût de l&apos;IA & journal d&apos;audit</h1>
        <p className="text-sm text-muted-foreground">
          Ce que l&apos;analyse CTD a réellement coûté, dossier par dossier, et le journal complet du module.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4 text-primary" /> Dépense IA — tous dossiers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Dépensé au total" value={fmtUsd(spend.totalUsd)} />
            <Stat label="Appels" value={String(spend.calls)} hint={spend.cachedCalls > 0 ? `dont ${spend.cachedCalls} sans recalcul` : undefined} />
            <Stat label="Économisé par réemploi" value={fmtUsd(spend.savedUsd)} hint="fichiers déjà analysés" tone={spend.savedUsd > 0 ? "success" : undefined} />
            <Stat label="Dossiers facturés" value={String(spend.byDossier.length)} />
          </div>

          {spend.calls === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun appel IA facturé pour le moment.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Breakdown title="Par étape" rows={spend.byStep.map((r) => ({ ...r, label: STEP_LABELS[r.key] ?? r.key }))} />
                <Breakdown title="Par modèle" rows={spend.byModel} />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Par dossier — plafond réglable</h3>
                <p className="text-xs text-muted-foreground">
                  Un plafond atteint ARRÊTE les analyses économiques du dossier concerné : les appels sont
                  refusés avant dépense, et l&apos;écran d&apos;analyse le dit.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[42rem] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Dossier</th>
                        <th className="py-2 pr-3 text-right font-medium">Appels</th>
                        <th className="py-2 pr-3 text-right font-medium">Dépensé</th>
                        <th className="py-2 font-medium">Plafond</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spend.byDossier.map((d) => (
                        <DossierBudgetRow key={d.dossierId} row={d} canManage={canManage} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" /> Journal d&apos;audit Regulatory
          </CardTitle>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune entrée pour le moment.</p>
          ) : (
            <div className="space-y-1">
              {audit.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 border-b border-border/50 py-1.5 text-xs last:border-0">
                  <span className="min-w-0">
                    {a.dossier && (
                      <span className="mr-1.5 font-medium text-foreground">{a.dossier.reference}</span>
                    )}
                    <span className="text-muted-foreground">{a.detail}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-muted-foreground/70">{fmtDateTime(a.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" | "danger" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="text-[0.6875rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { key: string; label: string; calls: number; costUsd: number }[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
      <div className="space-y-1">
        {rows.slice(0, 10).map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3 border-b border-border/50 py-1 text-xs last:border-0">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {r.calls} appel(s) · <span className="font-medium text-foreground">{fmtUsd(r.costUsd)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
