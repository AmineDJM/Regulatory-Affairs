"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserCog, Loader2, Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select } from "@/components/ui/input";
import { proposeStandIn, decideStandIn } from "@/lib/actions/stand-in-actions";
import { STAND_IN_LABEL, type StandInStatus } from "@/lib/hr/stand-in";

/**
 * DÉSIGNER UN INTÉRIMAIRE, ET LE FAIRE VALIDER.
 *
 * Deux composants pour deux gestes qui n'appartiennent pas aux mêmes personnes : l'ABSENT
 * désigne (il sait qui peut le remplacer sur son métier), les RH VALIDENT (ils vérifient que ce
 * n'est pas un remplaçant de complaisance).
 *
 * L'écran DIT ce qui est délégué et jusqu'à quand. Une délégation qu'on accorde sans voir sa
 * portée, personne ne la relit ensuite — et c'est ainsi qu'un accès « pour cette fois » devient
 * permanent.
 */

export interface StandInPerson { id: string; name: string }
export interface StandInModule { value: string; label: string }

export interface StandInState {
  standInId: string | null;
  standInName: string | null;
  standInStatus: StandInStatus | null;
  standInModules: string[];
  standInNote: string | null;
}

const TONE: Record<StandInStatus, "info" | "success" | "danger"> = {
  PENDING: "info", APPROVED: "success", REJECTED: "danger",
};

/** L'état courant, lisible d'un coup d'œil dans une liste. */
export function StandInBadge({ state, moduleLabels }: { state: StandInState; moduleLabels: Record<string, string> }) {
  if (!state.standInId || !state.standInStatus) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm">{state.standInName ?? "—"}</span>
        <Badge tone={TONE[state.standInStatus]} dot={false}>{STAND_IN_LABEL[state.standInStatus]}</Badge>
      </span>
      {state.standInModules.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {state.standInModules.map((m) => moduleLabels[m] ?? m).join(", ")}
        </span>
      )}
      {state.standInNote && <span className="text-xs text-muted-foreground">« {state.standInNote} »</span>}
    </span>
  );
}

/** Le geste de l'ABSENT : choisir qui le remplace, et sur quoi. */
export function StandInButton({
  leaveId, state, people, modules,
}: {
  leaveId: string;
  state: StandInState;
  people: StandInPerson[];
  modules: StandInModule[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [who, setWho] = React.useState(state.standInId ?? "");
  const [picked, setPicked] = React.useState<string[]>(state.standInModules);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggle = (m: string) =>
    setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));

  async function save(remove = false) {
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("id", leaveId);
    if (!remove && who) {
      fd.set("standInId", who);
      for (const m of picked) fd.append("modules", m);
    }
    const r = await proposeStandIn(fd);
    setBusy(false);
    if (!r.ok) { setError(r.error ?? "Enregistrement impossible."); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserCog className="h-3.5 w-3.5" /> {state.standInId ? "Intérimaire" : "Désigner"}
      </Button>

      <Sheet
        open={open} onClose={() => setOpen(false)} width="md"
        title="Intérimaire pendant votre congé"
        description="La personne que vous désignez pourra, PENDANT VOTRE ABSENCE SEULEMENT, ouvrir les modules choisis et trancher les validations qui vous sont adressées. Les RH valident ce choix ; la délégation s'arrête d'elle-même au dernier jour du congé."
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Qui vous remplace</Label>
            <Select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">— Personne —</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Ce que vous déléguez</Label>
            <p className="text-xs text-muted-foreground">
              Jamais tout votre compte : votre Drive, votre messagerie et votre espace personnel
              restent à vous. Votre intérimaire ne reçoit pas non plus plus de droits que vous
              n&apos;en avez vous-même.
            </p>
            <div className="grid grid-cols-1 gap-1.5 pt-1 sm:grid-cols-2">
              {modules.map((m) => (
                <label key={m.value} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
                  <input
                    type="checkbox" checked={picked.includes(m.value)}
                    onChange={() => toggle(m.value)}
                    className="h-4 w-4 rounded border-input"
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {state.standInId && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => save(true)}>
                <X className="h-4 w-4" /> Retirer
              </Button>
            )}
            <Button size="sm" disabled={busy || !who || picked.length === 0} onClick={() => save(false)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Proposer aux RH
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

/** Le geste des RH : valider, ou refuser en disant pourquoi. */
export function StandInDecision({ leaveId }: { leaveId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(approve ? "ok" : "no"); setError(null);
    const fd = new FormData();
    fd.set("id", leaveId);
    fd.set("decision", approve ? "APPROVED" : "REJECTED");
    if (note.trim()) fd.set("note", note.trim());
    const r = await decideStandIn(fd);
    setBusy(null);
    if (!r.ok) { setError(r.error ?? "Décision impossible."); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Input
        value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Motif (obligatoire pour refuser)" className="h-8 w-56 text-xs"
      />
      <div className="flex gap-1.5">
        <Button size="sm" disabled={busy !== null} onClick={() => decide(true)}>
          {busy === "ok" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Valider
        </Button>
        <Button
          variant="outline" size="sm" disabled={busy !== null || !note.trim()}
          title={note.trim() ? undefined : "Un refus se motive : l'intéressé doit savoir quoi proposer d'autre."}
          onClick={() => decide(false)}
        >
          {busy === "no" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Refuser
        </Button>
      </div>
      {error && <p className="max-w-xs text-right text-xs text-destructive">{error}</p>}
    </div>
  );
}
