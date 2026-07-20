"use client";

import * as React from "react";
import { Loader2, Check, Megaphone, Search } from "lucide-react";
import { saveAppSettings, setRegEnrollmentEnabled, setRegulatorySupervisorRoles, setRegRequestCreatorRoles, setDriveSpaceCreatorRoles, setFieldReportsOverviewRoles } from "@/lib/actions/settings-actions";
import { setRegIntelligenceEnabled } from "@/lib/regulatory/intelligence/actions";
import { sendBroadcast } from "@/lib/actions/notification-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { AppSettings } from "@/lib/settings";

interface Opt { value: string; label: string }
interface UserLite { id: string; name: string; role: string }

export function AdminLimitsForm({ settings }: { settings: AppSettings }) {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <form
      action={async (fd) => {
        setSaving(true); setError(null);
        const r = await saveAppSettings(fd);
        setSaving(false);
        if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
        else setError(r.error ?? "Échec.");
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="maxUploadMb">Documents / pièces jointes — taille max (Mo)</Label>
          <Input id="maxUploadMb" name="maxUploadMb" type="number" min="1" max="256" defaultValue={settings.maxUploadMb} />
          <p className="text-xs text-muted-foreground">S'applique à TOUS les documents (Regulatory, Congrès, Projets, RH, médical…). Jusqu'à 256 Mo ; au-delà, passez par le Drive.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="maxDriveUploadMb">Drive — taille max (Mo)</Label>
          <Input id="maxDriveUploadMb" name="maxDriveUploadMb" type="number" min="1" max="2048" defaultValue={settings.maxDriveUploadMb} />
          <p className="text-xs text-muted-foreground">Fichiers du Drive (gros transferts en flux), jusqu'à 2 048 Mo.</p>
        </div>
      </div>
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-success" /> : null}
          {saved ? "Enregistré" : "Enregistrer les limites"}
        </Button>
      </div>
    </form>
  );
}

/** Débloque / masque l'onglet Regulatory « Enregistrement » (analyseur CTD). */
export function RegEnrollmentToggle({ enabled: initial }: { enabled: boolean }) {
  const [enabled, setEnabled] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function toggle(next: boolean) {
    setBusy(true); setError(null);
    const r = await setRegEnrollmentEnabled(next);
    setBusy(false);
    if (r.ok) setEnabled(next);
    else setError(r.error ?? "Échec.");
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">Onglet « Enregistrement » (analyseur de dossier CTD)</p>
          <p className="text-xs text-muted-foreground">
            {enabled ? "Visible pour les utilisateurs ayant accès à Regulatory." : "Masqué. Activez pour rendre l'onglet visible dans Regulatory."}
          </p>
        </div>
        <button
          type="button" role="switch" aria-checked={enabled} disabled={busy}
          onClick={() => toggle(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${enabled ? "bg-primary" : "bg-input"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>
      {busy && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Mise à jour…</p>}
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

interface CompanyFlag { id: string; name: string; enabled: boolean }

/** Déblocage du Regulatory Intelligence OS **par organisation** (un interrupteur par entité). */
export function RegIntelligenceToggles({ companies }: { companies: CompanyFlag[] }) {
  const [state, setState] = React.useState<Record<string, boolean>>(
    Object.fromEntries(companies.map((c) => [c.id, c.enabled])),
  );
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function toggle(companyId: string, next: boolean) {
    setBusyId(companyId); setError(null);
    const r = await setRegIntelligenceEnabled(companyId, next);
    setBusyId(null);
    if (r.ok) setState((s) => ({ ...s, [companyId]: next }));
    else setError(r.error ?? "Échec.");
  }

  if (companies.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune organisation active. Créez une entité dans Administration → Entités.</p>;
  }

  return (
    <div className="space-y-2">
      {companies.map((c) => {
        const enabled = state[c.id];
        return (
          <div key={c.id} className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {enabled ? "Analyse CTD activée — workspace visible pour les rôles réglementaires." : "Verrouillé. Activez pour ouvrir l'analyse intelligente des dossiers CTD."}
              </p>
            </div>
            <button
              type="button" role="switch" aria-checked={enabled} disabled={busyId === c.id}
              onClick={() => toggle(c.id, !enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${enabled ? "bg-primary" : "bg-input"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        );
      })}
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function BroadcastComposer({ roles, users }: { roles: Opt[]; users: UserLite[] }) {
  const [audience, setAudience] = React.useState<"ALL" | "ROLE" | "USERS">("ALL");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);

  const filtered = search.trim()
    ? users.filter((u) => u.name.toLowerCase().includes(search.trim().toLowerCase()))
    : users;
  function toggle(id: string) {
    setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <form
      action={async (fd) => {
        setSending(true); setResult(null);
        fd.set("audience", audience);
        picked.forEach((id) => fd.append("userIds", id));
        const r = await sendBroadcast(fd);
        setSending(false);
        setResult({ ok: r.ok, text: r.ok ? (r.message ?? "Envoyée.") : (r.error ?? "Échec.") });
        if (r.ok) { setPicked(new Set()); (document.getElementById("bc-form") as HTMLFormElement | null)?.reset(); }
      }}
      id="bc-form"
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="title">Titre</Label>
          <Input id="title" name="title" required placeholder="ex. Réunion générale demain 10h" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="link">Lien (optionnel)</Label>
          <Input id="link" name="link" placeholder="/messages ou https://…" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="body">Message</Label>
        <Textarea id="body" name="body" className="min-h-[64px]" placeholder="Détail de la notification…" />
      </div>

      <div className="space-y-2">
        <Label>Destinataires</Label>
        <div className="flex flex-wrap gap-1.5">
          {([["ALL", "Tout le monde"], ["ROLE", "Un rôle"], ["USERS", "Personnes choisies"]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setAudience(v)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${audience === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
              {l}
            </button>
          ))}
        </div>

        {audience === "ROLE" && (
          <Select name="role" defaultValue="">
            <option value="">— Choisir un rôle —</option>
            {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        )}

        {audience === "USERS" && (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une personne…" className="pl-8" />
            </div>
            <div className="max-h-60 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
              {filtered.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/50">
                  <input type="checkbox" checked={picked.has(u.id)} onChange={() => toggle(u.id)} className="h-4 w-4 rounded border-input" />
                  <span className="truncate">{u.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{picked.size} sélectionné·s</p>
          </div>
        )}
      </div>

      <label className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/30 p-3">
        <input type="checkbox" name="popup" className="mt-0.5 h-4 w-4 rounded border-input" />
        <span className="text-sm">
          <span className="font-medium">Afficher en pop-up plein écran</span>
          <span className="block text-xs text-muted-foreground">Une grande fenêtre s'affiche au milieu de l'écran du destinataire (façon alerte importante), en plus de la cloche. Elle reste jusqu'à ce que la personne clique sur « J'ai compris ».</span>
        </span>
      </label>

      {result && <p className={`rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{result.text}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />} Diffuser
        </Button>
      </div>
    </form>
  );
}

interface Mailbox { userId: string; email: string; name: string }
interface DiagResult { ok: boolean; category: string; label: string; raw: string; host: string; email: string }

const DIAG_TONE: Record<string, string> = {
  OK: "border-success/40 bg-success/10 text-success",
  TOO_MANY_CONNECTIONS: "border-warning/40 bg-warning/10 text-warning",
  COMMAND_FAILED: "border-warning/40 bg-warning/10 text-warning",
  AUTH_FAILED: "border-destructive/40 bg-destructive/10 text-destructive",
  IP_BLOCKED: "border-destructive/40 bg-destructive/10 text-destructive",
  TIMEOUT: "border-border bg-secondary/40 text-foreground",
  OTHER: "border-border bg-secondary/40 text-foreground",
};

/** Teste une connexion IMAP réelle et affiche l'erreur brute + la cause probable. */
export function MailDiagnosticPanel({ mailboxes }: { mailboxes: Mailbox[] }) {
  const [userId, setUserId] = React.useState(mailboxes[0]?.userId ?? "");
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState<DiagResult | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  if (mailboxes.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune boîte mail connectée pour le moment. Demandez à un utilisateur de connecter sa boîte dans « Courrier », puis revenez tester ici.</p>;
  }

  async function run() {
    setBusy(true); setErr(null); setRes(null);
    try {
      const r = await fetch("/api/admin/mail-diagnostic", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data?.error ?? "Diagnostic impossible."); return; }
      setRes(data as DiagResult);
    } catch { setErr("Diagnostic impossible (réseau)."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1 space-y-1">
          <Label htmlFor="diag-mailbox">Boîte à tester</Label>
          <Select id="diag-mailbox" value={userId} onChange={(e) => setUserId(e.target.value)}>
            {mailboxes.map((m) => <option key={m.userId} value={m.userId}>{m.name} — {m.email}</option>)}
          </Select>
        </div>
        <Button type="button" onClick={run} disabled={busy || !userId}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Tester la connexion
        </Button>
      </div>

      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

      {res && (
        <div className={`space-y-2 rounded-lg border px-3 py-3 text-sm ${DIAG_TONE[res.category] ?? DIAG_TONE.OTHER}`}>
          <p className="font-semibold">{res.ok ? "✓ " : "✗ "}{res.category}</p>
          <p>{res.label}</p>
          <p className="text-xs opacity-80">Serveur : {res.host} · {res.email}</p>
          {res.raw && (
            <div>
              <p className="text-xs font-medium opacity-80">Message brut du serveur :</p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background/60 p-2 text-[11px] text-foreground">{res.raw}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Sélection des rôles « superviseurs Regulatory » (Super Admin toujours inclus). */
export function RegulatorySupervisorForm({ roles, selected }: { roles: Opt[]; selected: string[] }) {
  const [picked, setPicked] = React.useState<string[]>(selected);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  return (
    <form
      action={async () => {
        setSaving(true);
        const fd = new FormData();
        picked.forEach((r) => fd.append("roles", r));
        const res = await setRegulatorySupervisorRoles(fd);
        setSaving(false);
        if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap gap-2">
        {roles.filter((r) => r.value !== "SUPER_ADMIN").map((r) => {
          const on = picked.includes(r.value);
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => toggle(r.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-secondary"}`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Le Super Admin est toujours superviseur. Ajoutez ici les rôles qui pourront aussi prioriser, fixer les dates cibles et être notifiés.</p>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
        {saved ? "Enregistré" : "Enregistrer les superviseurs"}
      </Button>
    </form>
  );
}

/** Sélection des rôles autorisés à ÉMETTRE des « Demandes à Regulatory » (PRIM toujours inclus). */
export function RegRequestCreatorForm({ roles, selected }: { roles: Opt[]; selected: string[] }) {
  const [picked, setPicked] = React.useState<string[]>(selected);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  return (
    <form
      action={async () => {
        setSaving(true);
        const fd = new FormData();
        picked.forEach((r) => fd.append("roles", r));
        const res = await setRegRequestCreatorRoles(fd);
        setSaving(false);
        if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap gap-2">
        {roles.filter((r) => r.value !== "SUPER_ADMIN" && r.value !== "MEDICAL_INFO_PHARMACIST").map((r) => {
          const on = picked.includes(r.value);
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => toggle(r.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-secondary"}`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Le PRIM (information médicale) et le Super Admin peuvent toujours émettre une demande. Ajoutez ici d&apos;autres rôles émetteurs. L&apos;équipe Regulatory <strong>répond</strong> aux demandes mais n&apos;en crée pas (sauf si vous l&apos;ajoutez ici).</p>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
        {saved ? "Enregistré" : "Enregistrer les émetteurs"}
      </Button>
    </form>
  );
}

/** Sélection des rôles autorisés à CRÉER des catégories de Drive (Super Admin toujours inclus). */
export function DriveSpaceCreatorForm({ roles, selected }: { roles: Opt[]; selected: string[] }) {
  const [picked, setPicked] = React.useState<string[]>(selected);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  return (
    <form
      action={async () => {
        setSaving(true);
        const fd = new FormData();
        picked.forEach((r) => fd.append("roles", r));
        const res = await setDriveSpaceCreatorRoles(fd);
        setSaving(false);
        if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap gap-2">
        {roles.filter((r) => r.value !== "SUPER_ADMIN").map((r) => {
          const on = picked.includes(r.value);
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => toggle(r.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-secondary"}`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Le Super Admin peut toujours créer des catégories de Drive (espaces partagés type « Promotion Médicale », présentés en onglets). Ajoutez ici les rôles qui pourront aussi en créer et gérer les accès.</p>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
        {saved ? "Enregistré" : "Enregistrer les créateurs"}
      </Button>
    </form>
  );
}

/** Sélection des rôles autorisés à voir l'onglet « Overview » des Rapports terrain (Super Admin toujours inclus). */
export function FieldReportsOverviewForm({ roles, selected }: { roles: Opt[]; selected: string[] }) {
  const [picked, setPicked] = React.useState<string[]>(selected);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  return (
    <form
      action={async () => {
        setSaving(true);
        const fd = new FormData();
        picked.forEach((r) => fd.append("roles", r));
        const res = await setFieldReportsOverviewRoles(fd);
        setSaving(false);
        if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap gap-2">
        {roles.filter((r) => r.value !== "SUPER_ADMIN").map((r) => {
          const on = picked.includes(r.value);
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => toggle(r.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-secondary"}`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Le Super Admin voit toujours l'onglet « Overview » (graphes d'analyse des rapports terrain : visites par médecin, hôpital, délégué…). Ajoutez ici les rôles qui pourront aussi le consulter.</p>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
        {saved ? "Enregistré" : "Enregistrer l'accès Overview"}
      </Button>
    </form>
  );
}
