"use client";

import * as React from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { PARTICIPANT_ROLE } from "@/lib/labels";
import { publicRegister } from "@/lib/actions/event-actions";

export function PublicRegistrationForm({ eventId }: { eventId: string }) {
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [token, setToken] = React.useState<string | null>(null);

  if (token) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="h-14 w-14 text-success" />
        <p className="text-lg font-semibold">Inscription confirmée !</p>
        <p className="text-sm text-muted-foreground">Présentez ce QR code à l'entrée pour le check-in.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/events/qr/${token}`} alt="Votre QR code" className="h-56 w-56 rounded-lg border border-border" />
        <a href={`/api/events/qr/${token}`} download className="text-sm text-primary hover:underline">Télécharger le QR</a>
      </div>
    );
  }

  return (
    <form
      action={async (fd) => {
        fd.set("eventId", eventId);
        setSaving(true); setErr(null);
        const r = await publicRegister(fd);
        setSaving(false);
        if (r.ok && r.id) setToken(r.id);
        else setErr(r.error ?? "Une erreur est survenue.");
      }}
      className="grid grid-cols-2 gap-3"
    >
      <div className="space-y-1.5"><Label>Prénom *</Label><Input name="firstName" required /></div>
      <div className="space-y-1.5"><Label>Nom *</Label><Input name="lastName" required /></div>
      <div className="space-y-1.5"><Label>Rôle</Label><Select name="role" defaultValue="DOCTOR">{Object.entries(PARTICIPANT_ROLE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
      <div className="space-y-1.5"><Label>Spécialité</Label><Input name="specialty" /></div>
      <div className="space-y-1.5"><Label>Établissement</Label><Input name="institution" /></div>
      <div className="space-y-1.5"><Label>Ville</Label><Input name="city" /></div>
      <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" /></div>
      <div className="space-y-1.5"><Label>Téléphone</Label><Input name="phone" /></div>
      <div className="col-span-2 space-y-1.5"><Label>Commentaire</Label><Textarea name="comment" rows={2} /></div>
      {err && <p className="col-span-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
      <div className="col-span-2"><Button type="submit" size="lg" className="w-full" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} M'inscrire</Button></div>
    </form>
  );
}
