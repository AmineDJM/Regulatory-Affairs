"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BrainCircuit, Sparkles, Loader2, X, AlertCircle, CheckCircle2, ArrowRight,
  ShieldAlert, Ban, Wand2, Gavel, Activity, Network, Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { runAutopilot, askBrain, generateBriefing, searchRelations } from "@/lib/actions/adventum-actions";
import type { Risk, RiskAction } from "@/lib/adventum/risks";
import type { ProductRelations } from "@/lib/adventum/relations";

interface Kpis { critical: number; blocks: number; proposedActions: number; decisions: number; fieldSignals: number }

const LEVELS: Record<string, { label: string; border: string; chip: string; dot: string }> = {
  critical: { label: "Critique", border: "border-l-destructive", chip: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  high: { label: "Élevé", border: "border-l-warning", chip: "bg-warning/10 text-warning", dot: "bg-warning" },
  medium: { label: "Moyen", border: "border-l-amber-400", chip: "bg-amber-400/10 text-amber-600", dot: "bg-amber-400" },
  low: { label: "Faible", border: "border-l-muted-foreground", chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};
const levelEmoji = (l: string) => (l === "critical" ? "🔴" : l === "high" ? "🟠" : l === "medium" ? "🟡" : "⚪");

const CAT_LABEL: Record<string, string> = {
  all: "Tous", REGULATORY: "Regulatory", PCH: "PCH", BUDGET: "Budget", CONGRESS: "Congrès",
  SPONSORING: "Sponsoring", FINANCE: "Finance", MEDICAL: "Promotion médicale", QUALITY: "PV / Qualité", DIRECTIVES: "Directives",
};

const fmtTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function BrainCockpit({ risks, kpis, feed, suggestions }: { risks: Risk[]; kpis: Kpis; feed: Risk[]; suggestions: string[] }) {
  const [tab, setTab] = React.useState<"war" | "risks" | "relations" | "feed">("war");
  const [selected, setSelected] = React.useState<Risk | null>(null);
  const [confirm, setConfirm] = React.useState<{ action: RiskAction; risk: Risk } | null>(null);
  const [cat, setCat] = React.useState("all");

  // Barre de commande IA + briefing
  const [q, setQ] = React.useState("");
  const [asking, setAsking] = React.useState(false);
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [briefing, setBriefing] = React.useState<string | null>(null);
  const [briefLoading, setBriefLoading] = React.useState(false);

  const ask = async () => {
    if (!q.trim()) return;
    setAsking(true); setAnswer(null);
    const r = await askBrain(q);
    setAsking(false);
    setAnswer(r.ok ? r.reply : r.error ?? "Impossible de répondre.");
  };
  const brief = async () => {
    setBriefLoading(true); setBriefing(null);
    const r = await generateBriefing();
    setBriefLoading(false);
    setBriefing(r.ok ? r.text : r.error ?? "Synthèse impossible.");
  };

  const cats = ["all", ...Array.from(new Set(risks.map((r) => r.category)))];
  const filtered = cat === "all" ? risks : risks.filter((r) => r.category === cat);
  const topRisks = risks.slice(0, 8);

  return (
    <div className="space-y-5">
      {/* En-tête + barre IA */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/90 to-purple-600 p-5 text-primary-foreground shadow-lg">
        <div className="flex items-center gap-2.5">
          <BrainCircuit className="h-7 w-7" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Adventum Brain</h1>
            <p className="text-sm opacity-90">Le cockpit qui voit ce que les autres ne voient pas.</p>
          </div>
          <button onClick={brief} disabled={briefLoading} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25 disabled:opacity-60">
            {briefLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Générer un briefing
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Demander à Adventum Brain… (ex. « Pourquoi les congrès sont bloqués ? »)"
            className="h-10 flex-1 rounded-lg border-0 bg-white/95 px-3.5 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/60"
          />
          <Button onClick={ask} disabled={asking} className="bg-white text-primary hover:bg-white/90">{asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Demander</Button>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] opacity-80">
          {["Quels risques critiques aujourd'hui ?", "Montre-moi les fournisseurs qui ralentissent Regulatory", "Quels médecins KOL ne sont plus suivis ?"].map((s) => (
            <button key={s} onClick={() => setQ(s)} className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20">{s}</button>
          ))}
        </div>
        {(answer || briefing) && (
          <div className="mt-3 space-y-2">
            {briefing && <div className="rounded-lg bg-white/95 p-3 text-sm text-neutral-900"><p className="mb-1 flex items-center gap-1.5 font-semibold text-primary"><Sparkles className="h-4 w-4" /> Briefing de direction</p><p className="whitespace-pre-wrap">{briefing}</p></div>}
            {answer && <div className="rounded-lg bg-white/95 p-3 text-sm text-neutral-900"><p className="whitespace-pre-wrap">{answer}</p></div>}
          </div>
        )}
      </div>

      {/* KPIs War Room */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={ShieldAlert} tone="text-destructive" value={kpis.critical} label="Risques critiques" />
        <Kpi icon={Ban} tone="text-warning" value={kpis.blocks} label="Blocages actifs" />
        <Kpi icon={Wand2} tone="text-primary" value={kpis.proposedActions} label="Actions proposées" />
        <Kpi icon={Gavel} tone="text-purple-500" value={kpis.decisions} label="Décisions à prendre" />
        <Kpi icon={Activity} tone="text-success" value={kpis.fieldSignals} label="Signaux terrain (7 j)" />
      </div>

      {/* Onglets discrets */}
      <div className="flex gap-1 border-b border-border">
        {([["war", "War Room"], ["risks", "Risques"], ["relations", "Relations"], ["feed", "Feed"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("border-b-2 px-3 py-2 text-sm font-medium transition-colors", tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      {tab === "war" && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Aujourd'hui, voici ce qui mérite votre attention</h2>
          {topRisks.length === 0 ? <Empty /> : <div className="grid gap-3 md:grid-cols-2">{topRisks.map((r) => <RiskCard key={r.id} risk={r} onOpen={() => setSelected(r)} onAction={(a) => (a.payload ? setConfirm({ action: a, risk: r }) : undefined)} />)}</div>}
        </section>
      )}

      {tab === "risks" && (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", cat === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary")}>{CAT_LABEL[c] ?? c}</button>)}
          </div>
          {filtered.length === 0 ? <Empty /> : <div className="grid gap-3 md:grid-cols-2">{filtered.map((r) => <RiskCard key={r.id} risk={r} onOpen={() => setSelected(r)} onAction={(a) => (a.payload ? setConfirm({ action: a, risk: r }) : undefined)} />)}</div>}
        </section>
      )}

      {tab === "relations" && <RelationsTab suggestions={suggestions} />}
      {tab === "feed" && <FeedTab feed={feed} onOpen={setSelected} />}

      {selected && <RootCauseDrawer risk={selected} onClose={() => setSelected(null)} onAction={(a) => (a.payload ? setConfirm({ action: a, risk: selected }) : undefined)} />}
      {confirm && <AutopilotConfirm action={confirm.action} risk={confirm.risk} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function Kpi({ icon: I, tone, value, label }: { icon: React.ComponentType<{ className?: string }>; tone: string; value: number; label: string }) {
  return (
    <Card><CardContent className="flex items-center gap-3 py-4">
      <I className={cn("h-7 w-7 shrink-0", tone)} />
      <div><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
    </CardContent></Card>
  );
}

function Empty() {
  return <Card><CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground"><CheckCircle2 className="h-9 w-9 text-success/60" /><p className="text-sm">Aucun risque détecté pour l'instant. Tout est sous contrôle.</p></CardContent></Card>;
}

function RiskCard({ risk, onOpen, onAction }: { risk: Risk; onOpen: () => void; onAction: (a: RiskAction) => void }) {
  const lv = LEVELS[risk.level];
  return (
    <Card className={cn("border-l-4", lv.border)}>
      <CardContent className="space-y-2.5 py-4">
        <button onClick={onOpen} className="block w-full text-left">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-tight">{levelEmoji(risk.level)} {risk.title}</p>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", lv.chip)}>{lv.label}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{risk.module} · {risk.object}</p>
          <p className="mt-1.5 text-sm"><span className="text-muted-foreground">Impact :</span> {risk.impact}</p>
          <p className="text-sm"><span className="text-muted-foreground">Cause probable :</span> {risk.probableCause}</p>
          <p className="mt-1 text-sm font-medium text-primary">→ {risk.recommendation}</p>
        </button>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {risk.actions.map((a, i) => a.href
            ? <Link key={i} href={a.href} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary">{a.icon && <Icon name={a.icon} className="h-3.5 w-3.5" />}{a.label}</Link>
            : <button key={i} onClick={() => onAction(a)} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10">{a.icon && <Icon name={a.icon} className="h-3.5 w-3.5" />}{a.label}</button>)}
          <button onClick={onOpen} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Analyser <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
      </CardContent>
    </Card>
  );
}

function RootCauseDrawer({ risk, onClose, onAction }: { risk: Risk; onClose: () => void; onAction: (a: RiskAction) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-semibold">Analyse du blocage</p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-4 text-sm">
          <div>
            <p className="text-lg font-semibold">{levelEmoji(risk.level)} {risk.title}</p>
            <p className="text-muted-foreground">{risk.module} · {risk.object}</p>
          </div>
          <Row label="Niveau" value={LEVELS[risk.level].label} />
          <Row label="Responsable" value={risk.owner} />
          {risk.ageDays !== null && <Row label="Depuis" value={`${risk.ageDays} j`} />}
          {risk.deadline && <Row label="Échéance" value={new Date(risk.deadline).toLocaleDateString("fr-FR")} />}
          <div><p className="text-muted-foreground">Cause probable</p><p className="font-medium">{risk.probableCause}</p></div>
          <div><p className="text-muted-foreground">Impact</p><p>{risk.impact}</p></div>
          <div>
            <p className="text-muted-foreground">Preuves utilisées</p>
            <ul className="mt-1 space-y-1">{risk.evidence.map((e, i) => <li key={i} className="flex gap-1.5"><span className="text-muted-foreground">•</span><span>{e}</span></li>)}</ul>
          </div>
          <div className="rounded-lg bg-primary/5 p-3"><p className="text-xs font-medium text-primary">Action recommandée</p><p className="mt-0.5">{risk.recommendation}</p></div>
          <div className="flex flex-wrap gap-2 pt-1">
            {risk.actions.map((a, i) => a.href
              ? <Link key={i} href={a.href} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary">{a.icon && <Icon name={a.icon} className="h-4 w-4" />}{a.label}</Link>
              : <Button key={i} size="sm" variant="outline" onClick={() => onAction(a)}>{a.icon && <Icon name={a.icon} className="h-4 w-4" />}{a.label}</Button>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function AutopilotConfirm({ action, risk, onClose }: { action: RiskAction; risk: Risk; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const p = action.payload!;
  const run = async () => {
    setSaving(true); setErr(null);
    const r = await runAutopilot(p);
    setSaving(false);
    if (r.ok) { setDone(true); router.refresh(); } else setErr(r.error ?? "Action impossible.");
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" /><p className="font-semibold">Action proposée</p></div>
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-success"><CheckCircle2 className="h-10 w-10" /><p className="font-medium">Fait.</p><Button size="sm" variant="outline" onClick={onClose}>Fermer</Button></div>
        ) : (
          <>
            <div className="space-y-1.5 rounded-lg bg-secondary/50 p-3 text-sm">
              <p className="text-xs text-muted-foreground">{risk.module} · {risk.object}</p>
              {p.kind === "task" && <p><span className="font-medium">Créer une tâche :</span> {p.title}</p>}
              {p.kind === "notify" && <><p><span className="font-medium">Notifier :</span> {p.title}</p><p className="text-muted-foreground">{p.body}</p></>}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Adventum Brain prépare l'action — vous validez. Rien n'est exécuté sans votre confirmation.</p>
            {err && <div className="mt-2 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Annuler</Button>
              <Button onClick={run} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirmer</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FeedTab({ feed, onOpen }: { feed: Risk[]; onOpen: (r: Risk) => void }) {
  if (feed.length === 0) return <Empty />;
  return (
    <Card><CardContent className="py-2">
      <ul className="divide-y divide-border">
        {feed.map((r) => (
          <li key={r.id} className="flex items-start gap-3 py-3">
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", LEVELS[r.level].dot)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm"><span className="text-muted-foreground">{fmtTime(r.at)} — </span><span className="font-medium">{r.title}</span></p>
              <p className="truncate text-sm text-muted-foreground">{r.module} · {r.object}</p>
            </div>
            <button onClick={() => onOpen(r)} className="shrink-0 text-xs text-primary hover:underline">Analyser</button>
          </li>
        ))}
      </ul>
    </CardContent></Card>
  );
}

function RelationsTab({ suggestions }: { suggestions: string[] }) {
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [res, setRes] = React.useState<ProductRelations | null>(null);
  const search = async (term: string) => {
    const v = term.trim();
    if (!v) return;
    setQ(v); setLoading(true);
    const r = await searchRelations(v);
    setLoading(false);
    setRes(r.ok ? r.relations ?? null : null);
  };
  return (
    <section className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search(q)} placeholder="Une molécule / un produit (ex. Pralatrexate)…" className="pl-9" />
        </div>
        <Button onClick={() => search(q)} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />} Voir relations</Button>
      </div>
      {suggestions.length > 0 && !res && (
        <div className="flex flex-wrap gap-1.5">{suggestions.map((s) => <button key={s} onClick={() => search(s)} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary">{s}</button>)}</div>
      )}
      {res && (res.found ? (
        <div className="space-y-3">
          <Card><CardContent className="py-3"><p className="text-sm text-muted-foreground">Objet central</p><p className="text-lg font-semibold">{res.query}</p>
            {res.strongRelations.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{res.strongRelations.map((s, i) => <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-xs"><span className="text-muted-foreground">{s.label} →</span> {s.value}</span>)}</div>}
          </CardContent></Card>
          <div className="grid gap-3 md:grid-cols-2">
            {res.blocks.map((b, i) => (
              <Card key={i}><CardContent className="py-4">
                <Link href={b.href} className="flex items-center gap-2 font-semibold hover:text-primary"><Icon name={b.icon} className="h-4 w-4 text-primary" /> {b.module}</Link>
                <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">{b.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>
              </CardContent></Card>
            ))}
          </div>
        </div>
      ) : <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Aucune relation trouvée pour « {res.query} ».</CardContent></Card>)}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}
