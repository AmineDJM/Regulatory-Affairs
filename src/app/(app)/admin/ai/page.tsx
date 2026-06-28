import { BrainCircuit, KeyRound, CheckCircle2, XCircle, Activity, Mic } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { aiConfigured, sttConfigured, aiModel } from "@/lib/ai";
import { getAiSettings } from "@/lib/ai-settings";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { ADMIN_TABS } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatDateTime } from "@/lib/utils";
import { AiSettingsForm } from "./ai-settings-form";

export const metadata = { title: "Centre de contrôle IA — AMD Internal OS" };
export const dynamic = "force-dynamic";

const FEATURE_LABEL: Record<string, string> = {
  assistant: "Assistant IA",
  nudge: "Suggestions proactives",
  brain: "Adventum Brain",
  briefing: "Briefing direction",
  process_intel: "Process Intelligence",
  field_report: "Rapports terrain",
  voice: "Transcription vocale",
};

export default async function AiControlCenterPage() {
  const user = await requireModule("ADMIN", "UPDATE");
  const settings = await getAiSettings();

  const since30 = new Date(Date.now() - 30 * 86400000);
  const since7 = new Date(Date.now() - 7 * 86400000);

  const [total30, ok30, total7, byFeature, okByFeature, recentFailures] = await Promise.all([
    prisma.aiUsageLog.count({ where: { createdAt: { gte: since30 } } }),
    prisma.aiUsageLog.count({ where: { createdAt: { gte: since30 }, ok: true } }),
    prisma.aiUsageLog.count({ where: { createdAt: { gte: since7 } } }),
    prisma.aiUsageLog.groupBy({ by: ["feature"], where: { createdAt: { gte: since30 } }, _count: { _all: true }, _avg: { latencyMs: true } }),
    prisma.aiUsageLog.groupBy({ by: ["feature"], where: { createdAt: { gte: since30 }, ok: true }, _count: { _all: true } }),
    prisma.aiUsageLog.findMany({ where: { ok: false, createdAt: { gte: since30 } }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const okMap = new Map(okByFeature.map((r) => [r.feature, r._count._all]));
  const features = byFeature
    .map((r) => ({
      feature: r.feature,
      label: FEATURE_LABEL[r.feature] ?? r.feature,
      total: r._count._all,
      ok: okMap.get(r.feature) ?? 0,
      avgMs: r._avg.latencyMs ? Math.round(r._avg.latencyMs) : null,
    }))
    .sort((a, b) => b.total - a.total);

  // Noms des utilisateurs pour les derniers échecs.
  const userIds = [...new Set(recentFailures.map((f) => f.userId).filter(Boolean))] as string[];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  const successRate = total30 > 0 ? Math.round((ok30 / total30) * 100) : null;

  return (
    <div className="space-y-5">
      <ModuleTabs tabs={ADMIN_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><BrainCircuit className="h-6 w-6" /></span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Centre de contrôle IA</h1>
          <p className="text-sm text-muted-foreground">Activez ou coupez l'IA par fonction, et suivez son usage. Réservé au Super Admin.</p>
        </div>
      </div>

      {/* État des clés / configuration (lecture seule, posées sur Render). */}
      <Card>
        <CardHeader><CardTitle>Configuration & clés</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <KeyStatus
            icon={<KeyRound className="h-4 w-4" />}
            label="Claude (Anthropic)"
            ok={aiConfigured()}
            detail={aiConfigured() ? `Modèle : ${aiModel()}` : "ANTHROPIC_API_KEY absente"}
          />
          <KeyStatus
            icon={<Mic className="h-4 w-4" />}
            label="Whisper (OpenAI)"
            ok={sttConfigured()}
            detail={sttConfigured() ? `Modèle : ${process.env.STT_MODEL ?? "whisper-1"}` : "OPENAI_API_KEY absente"}
          />
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Les clés sont des secrets serveur (jamais exposés au client) et se définissent dans les variables
            d'environnement Render — pas ici. Cette page contrôle uniquement l'activation des fonctions.
          </p>
        </CardContent>
      </Card>

      {/* Bascules d'activation */}
      <Card>
        <CardHeader><CardTitle>Activation par fonction</CardTitle></CardHeader>
        <CardContent>
          <AiSettingsForm initial={settings} />
        </CardContent>
      </Card>

      {/* Usage */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Appels (30 j)" value={formatNumber(total30)} icon={<Activity className="h-4 w-4" />} />
        <Stat label="Appels (7 j)" value={formatNumber(total7)} icon={<Activity className="h-4 w-4" />} />
        <Stat label="Taux de succès (30 j)" value={successRate === null ? "—" : `${successRate}%`} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader><CardTitle>Usage par fonction (30 jours)</CardTitle></CardHeader>
        <CardContent>
          {features.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun appel IA enregistré sur la période.</p>
          ) : (
            <div className="space-y-2.5">
              {features.map((f) => {
                const rate = f.total > 0 ? Math.round((f.ok / f.total) * 100) : 0;
                return (
                  <div key={f.feature} className="flex items-center justify-between gap-4 text-sm">
                    <span className="w-44 shrink-0 font-medium">{f.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className={rate >= 90 ? "h-full bg-success" : rate >= 60 ? "h-full bg-warning" : "h-full bg-destructive"} style={{ width: `${rate}%` }} />
                    </div>
                    <span className="w-32 shrink-0 text-right text-muted-foreground">
                      {formatNumber(f.total)} appels · {rate}%{f.avgMs ? ` · ${f.avgMs}ms` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Derniers échecs IA</CardTitle></CardHeader>
        <CardContent>
          {recentFailures.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun échec récent. 👌</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {recentFailures.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                    <span className="font-medium">{FEATURE_LABEL[f.feature] ?? f.feature}</span>
                    <span className="text-muted-foreground">{f.errorCode ?? "erreur"}</span>
                    {f.userId && <span className="text-xs text-muted-foreground">· {nameOf.get(f.userId) ?? "—"}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(f.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KeyStatus({ icon, label, ok, detail }: { icon: React.ReactNode; label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="flex items-center gap-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      {ok ? <Badge tone="success" dot={false}>Configurée</Badge> : <Badge tone="danger" dot={false}>Absente</Badge>}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
        <span className="text-muted-foreground">{icon}</span>
      </CardContent>
    </Card>
  );
}
