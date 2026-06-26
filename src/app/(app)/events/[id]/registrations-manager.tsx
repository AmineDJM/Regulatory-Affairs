"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, QrCode, Check, Search, Copy, Download, Link2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { PARTICIPANT_ROLE, REGISTRATION_STATUS } from "@/lib/labels";
import { addRegistration, setRegistrationStatus, deleteRegistration } from "@/lib/actions/event-actions";
import type { RegistrationDTO } from "@/lib/queries/events";

export function RegistrationsManager({ eventId, registrations, canManage }: { eventId: string; registrations: RegistrationDTO[]; canManage: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [qrToken, setQrToken] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const publicLink = typeof window !== "undefined" ? `${window.location.origin}/inscription/${eventId}` : "";
  const list = registrations.filter((r) =>
    !q || `${r.fullName} ${r.specialty ?? ""} ${r.institution ?? ""} ${r.email ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  const setStatus = (id: string, status: string) => {
    const fd = new FormData(); fd.set("id", id); fd.set("status", status);
    setRegistrationStatus(fd).then(() => router.refresh());
  };
  const copyLink = async () => { try { await navigator.clipboard.writeText(publicLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ } };

  return (
    <div className="space-y-3">
      {/* Lien d'inscription + actions */}
      <div className="surface flex flex-wrap items-center gap-2 p-3">
        <Link2 className="h-4 w-4 text-primary" />
        <code className="min-w-0 flex-1 truncate rounded bg-secondary px-2 py-1 text-xs">{publicLink}</code>
        <Button variant="outline" size="sm" onClick={copyLink}>{copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} Copier le lien</Button>
        <a href={`/inscription/${eventId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Ouvrir le formulaire</a>
        <a href={`/api/events/${eventId}/export`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"><Download className="h-4 w-4" /> Export Excel</a>
        {canManage && <Button size="sm" onClick={() => { setErr(null); setAdding(true); }}><UserPlus className="h-4 w-4" /> Ajouter</Button>}
      </div>

      {/* Recherche + check-in */}
      <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un participant (check-in)…" className="h-9 w-full bg-transparent text-sm focus:outline-none" />
      </div>

      {list.length === 0 ? (
        <p className="surface p-4 text-sm text-muted-foreground">Aucun inscrit. Partagez le lien d'inscription ou ajoutez des participants.</p>
      ) : (
        <div className="surface divide-y divide-border">
          {list.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">{r.fullName} <span className="text-xs font-normal text-muted-foreground">{PARTICIPANT_ROLE[r.role]}</span></p>
                <p className="truncate text-xs text-muted-foreground">{[r.specialty, r.institution, r.city, r.email].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <StatusBadge map={REGISTRATION_STATUS} value={r.status} />
              {canManage && (
                <>
                  {r.status !== "PRESENT" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "PRESENT")}><Check className="h-4 w-4 text-success" /> Présent</Button>}
                  <Select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className="h-8 w-32 text-xs">
                    {Object.entries(REGISTRATION_STATUS).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}
                  </Select>
                  <button onClick={() => setQrToken(r.qrToken)} title="QR code" className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><QrCode className="h-4 w-4" /></button>
                  <button onClick={() => { if (window.confirm("Supprimer cet inscrit ?")) { const fd = new FormData(); fd.set("id", r.id); deleteRegistration(fd).then(() => router.refresh()); } }} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* QR d'un participant */}
      <Sheet open={qrToken !== null} onClose={() => setQrToken(null)} title="Badge QR du participant" description="À scanner à l'entrée pour le check-in." width="md">
        {qrToken && (
          <div className="flex flex-col items-center gap-3 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/events/qr/${qrToken}`} alt="QR code" className="h-60 w-60 rounded-lg border border-border" />
            <a href={`/api/events/qr/${qrToken}`} download className="text-sm text-primary hover:underline">Télécharger le QR</a>
          </div>
        )}
      </Sheet>

      {/* Ajout d'un participant */}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Ajouter un participant" width="md">
        <form action={async (fd) => { fd.set("eventId", eventId); setSaving(true); setErr(null); const r = await addRegistration(fd); setSaving(false); if (r.ok) { setAdding(false); router.refresh(); } else setErr(r.error ?? "Erreur."); }} className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Prénom</Label><Input name="firstName" required /></div>
          <div className="space-y-1.5"><Label>Nom</Label><Input name="lastName" required /></div>
          <div className="space-y-1.5"><Label>Rôle</Label><Select name="role" defaultValue="DOCTOR">{Object.entries(PARTICIPANT_ROLE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Statut</Label><Select name="status" defaultValue="CONFIRMED">{Object.entries(REGISTRATION_STATUS).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}</Select></div>
          <div className="space-y-1.5"><Label>Spécialité</Label><Input name="specialty" /></div>
          <div className="space-y-1.5"><Label>Établissement</Label><Input name="institution" /></div>
          <div className="space-y-1.5"><Label>Ville</Label><Input name="city" /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" /></div>
          <div className="space-y-1.5"><Label>Téléphone</Label><Input name="phone" /></div>
          <div className="col-span-2 space-y-1.5"><Label>Commentaire</Label><Textarea name="comment" rows={2} /></div>
          {err && <p className="col-span-2 text-sm text-destructive">{err}</p>}
          <div className="col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAdding(false)}>Annuler</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Ajouter</Button></div>
        </form>
      </Sheet>
    </div>
  );
}
