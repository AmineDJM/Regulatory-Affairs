"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Check } from "lucide-react";
import { createSalesTeam, updateSalesTeam, deleteSalesTeam, saveRepProfile } from "@/lib/actions/sales-planning-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Opt { id: string; name: string }
interface Team { id: string; name: string; code: string | null; color: string | null; supervisorId: string | null; businessUnitId: string | null; isActive: boolean; memberCount: number }
interface Kam {
  repId: string; name: string; role: string; teamId: string | null; region: string | null;
  capDaysPerMonth: number | null; capVisitsPerDay: number | null; capFieldPct: number | null;
  fteBudget: number; seniority: string | null; isActive: boolean; hasProfile: boolean;
}
interface Cap { daysPerMonth: number; visitsPerDay: number; fieldPct: number }

const inputCls = "h-9 rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none";
const numCls = "h-8 w-16 rounded-md border border-input bg-background px-1.5 text-center text-sm focus:border-primary focus:outline-none";
const numOrNull = (v: string) => { const t = v.trim(); if (t === "") return null; const n = Number(t.replace(",", ".")); return Number.isFinite(n) ? n : null; };

export function TeamsManager({ teams, businessUnits, supervisors, kams, config }: { teams: Team[]; businessUnits: Opt[]; supervisors: Opt[]; kams: Kam[]; config: Cap }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run(action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData, refresh = true) {
    setBusy(true);
    const r = await action(fd);
    setBusy(false);
    if (!r.ok) { window.alert(r.error ?? "Action impossible."); return; }
    if (refresh) router.refresh();
  }

  const teamOpts = teams.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-5">
      {/* ─────────── Équipes ─────────── */}
      <Card>
        <CardHeader><CardTitle>Équipes de KAM (superviseur national)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form className="grid grid-cols-2 gap-2 sm:grid-cols-4" action={(fd) => run(createSalesTeam, fd)}>
            <input name="name" required placeholder="Nom (ex. Équipe Est)" className={`${inputCls} col-span-2`} />
            <select name="supervisorId" className={inputCls} defaultValue=""><option value="">— Superviseur —</option>{supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select name="businessUnitId" className={inputCls} defaultValue=""><option value="">— BU (option) —</option>{businessUnits.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <input name="color" type="color" defaultValue="#0ea5e9" className="h-9 w-16 rounded-lg border border-input bg-background" title="Couleur" />
            <button type="submit" disabled={busy} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 sm:col-span-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
            </button>
          </form>

          <div className="space-y-1.5">
            {teams.length === 0 && <p className="text-sm text-muted-foreground">Aucune équipe.</p>}
            {teams.map((t) => (
              <TeamRow key={t.id} team={t} supervisors={supervisors} businessUnits={businessUnits}
                onSave={(fd) => run(updateSalesTeam, fd, false)}
                onDelete={() => { if (window.confirm(`Supprimer l'équipe « ${t.name} » ?`)) { const fd = new FormData(); fd.set("id", t.id); run(deleteSalesTeam, fd); } }} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─────────── Configuration par KAM ─────────── */}
      <Card>
        <CardHeader><CardTitle>Configuration des KAM</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Capacité individuelle : laissez vide pour utiliser le paramétrage global ({config.daysPerMonth} j × {config.visitsPerDay} visites × {config.fieldPct}%). ETP = temps de travail contractuel (1,0 = temps plein).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="px-2 py-2">KAM</th>
                  <th className="px-2 py-2 w-40">Équipe</th>
                  <th className="px-2 py-2 w-28">Secteur</th>
                  <th className="px-2 py-2 w-16" title="Jours terrain / mois">Jours</th>
                  <th className="px-2 py-2 w-16" title="Visites / jour">Vis./j</th>
                  <th className="px-2 py-2 w-16" title="% temps terrain">% ter.</th>
                  <th className="px-2 py-2 w-16" title="ETP contractuel">ETP</th>
                  <th className="px-2 py-2 w-10">Actif</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {kams.length === 0 && <tr><td colSpan={9} className="px-2 py-3 text-muted-foreground">Aucun KAM (délégué médical / National Sales) actif.</td></tr>}
                {kams.map((k) => <KamRow key={k.repId} kam={k} teamOpts={teamOpts} onSave={(fd) => run(saveRepProfile, fd, false)} />)}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TeamRow({ team, supervisors, businessUnits, onSave, onDelete }: { team: Team; supervisors: Opt[]; businessUnits: Opt[]; onSave: (fd: FormData) => void; onDelete: () => void }) {
  const [s, setS] = React.useState(team);
  function save(next: Team) {
    setS(next);
    const fd = new FormData();
    fd.set("id", next.id); fd.set("name", next.name); fd.set("code", next.code ?? ""); fd.set("color", next.color ?? "");
    fd.set("supervisorId", next.supervisorId ?? ""); fd.set("businessUnitId", next.businessUnitId ?? ""); fd.set("isActive", next.isActive ? "on" : "off");
    onSave(fd);
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border p-1.5">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? "#94a3b8" }} />
      <input className={`${inputCls} min-w-28 flex-1`} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} onBlur={() => save(s)} />
      <select className={inputCls} value={s.supervisorId ?? ""} onChange={(e) => save({ ...s, supervisorId: e.target.value || null })}><option value="">— Superviseur —</option>{supervisors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <select className={inputCls} value={s.businessUnitId ?? ""} onChange={(e) => save({ ...s, businessUnitId: e.target.value || null })}><option value="">— BU —</option>{businessUnits.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{s.memberCount} KAM</span>
      <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={s.isActive} onChange={(e) => save({ ...s, isActive: e.target.checked })} /> Actif</label>
      <button type="button" onClick={onDelete} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function KamRow({ kam, teamOpts, onSave }: { kam: Kam; teamOpts: Opt[]; onSave: (fd: FormData) => void }) {
  const [s, setS] = React.useState(kam);
  const [ok, setOk] = React.useState(false);
  function save(next: Kam) {
    setS(next);
    const fd = new FormData();
    fd.set("repId", next.repId);
    fd.set("teamId", next.teamId ?? "");
    fd.set("region", next.region ?? "");
    if (next.capDaysPerMonth != null) fd.set("capDaysPerMonth", String(next.capDaysPerMonth));
    if (next.capVisitsPerDay != null) fd.set("capVisitsPerDay", String(next.capVisitsPerDay));
    if (next.capFieldPct != null) fd.set("capFieldPct", String(next.capFieldPct));
    fd.set("fteBudget", String(next.fteBudget));
    fd.set("seniority", next.seniority ?? "");
    fd.set("isActive", next.isActive ? "on" : "off");
    onSave(fd);
    setOk(true); setTimeout(() => setOk(false), 1200);
  }
  return (
    <tr className="border-b border-border/60 hover:bg-secondary/30">
      <td className="px-2 py-1.5">
        <span className="font-medium">{s.name}</span>
        {s.role === "NATIONAL_SALES" && <span className="ml-1 rounded bg-primary/10 px-1 text-[0.625rem] text-primary">NS</span>}
      </td>
      <td className="px-2 py-1.5">
        <select className={`${inputCls} h-8 w-full`} value={s.teamId ?? ""} onChange={(e) => save({ ...s, teamId: e.target.value || null })}><option value="">— Aucune —</option>{teamOpts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </td>
      <td className="px-2 py-1.5"><input className={`${numCls} w-24`} value={s.region ?? ""} onChange={(e) => setS({ ...s, region: e.target.value })} onBlur={() => save(s)} placeholder="—" /></td>
      <td className="px-2 py-1.5"><input inputMode="numeric" className={numCls} value={s.capDaysPerMonth ?? ""} onChange={(e) => setS({ ...s, capDaysPerMonth: numOrNull(e.target.value) })} onBlur={() => save(s)} placeholder="—" /></td>
      <td className="px-2 py-1.5"><input inputMode="numeric" className={numCls} value={s.capVisitsPerDay ?? ""} onChange={(e) => setS({ ...s, capVisitsPerDay: numOrNull(e.target.value) })} onBlur={() => save(s)} placeholder="—" /></td>
      <td className="px-2 py-1.5"><input inputMode="numeric" className={numCls} value={s.capFieldPct ?? ""} onChange={(e) => setS({ ...s, capFieldPct: numOrNull(e.target.value) })} onBlur={() => save(s)} placeholder="—" /></td>
      <td className="px-2 py-1.5"><input inputMode="decimal" className={numCls} value={s.fteBudget} onChange={(e) => setS({ ...s, fteBudget: numOrNull(e.target.value) ?? 0 })} onBlur={() => save(s)} /></td>
      <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={s.isActive} onChange={(e) => save({ ...s, isActive: e.target.checked })} /></td>
      <td className="px-2 py-1.5 text-center">{ok ? <Check className="h-4 w-4 text-success" /> : null}</td>
    </tr>
  );
}
