"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail, Loader2, KeyRound, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { connectMailbox } from "@/lib/actions/mail-actions";

export function ConnectMailbox({ defaultEmail, defaultName }: { defaultEmail: string; defaultName: string }) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [advanced, setAdvanced] = React.useState(false);

  return (
    <div className="mx-auto max-w-lg">
      <div className="surface overflow-hidden">
        <div className="flex items-center gap-3 bg-gradient-to-br from-primary to-purple-500 px-6 py-5 text-primary-foreground">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><Mail className="h-6 w-6" /></div>
          <div><p className="text-lg font-semibold">Connectez votre boîte Infomaniak</p><p className="text-sm opacity-90">Lisez et envoyez vos e-mails sans quitter la plateforme.</p></div>
        </div>
        <form
          action={async (fd) => {
            setSaving(true); setErr(null);
            const r = await connectMailbox(fd);
            setSaving(false);
            if (r.ok) router.refresh(); else setErr(r.error ?? "Connexion impossible.");
          }}
          className="space-y-4 p-6"
        >
          <div className="space-y-1.5"><Label>Adresse e-mail</Label><Input name="email" type="email" required defaultValue={defaultEmail} placeholder="prenom.nom@adventum.dz" /></div>
          <div className="space-y-1.5"><Label>Nom affiché (à l'envoi)</Label><Input name="displayName" defaultValue={defaultName} /></div>
          <div className="space-y-1.5">
            <Label>Mot de passe d'application</Label>
            <Input name="password" type="password" required placeholder="••••••••••••" />
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Créez-le dans Infomaniak : <span className="font-medium">Ma session → Mots de passe d'application</span> (n'utilisez pas votre mot de passe principal).
            </p>
          </div>

          <button type="button" onClick={() => setAdvanced((v) => !v)} className="text-xs font-medium text-primary hover:underline">
            {advanced ? "Masquer" : "Réglages avancés (serveurs)"}
          </button>
          {advanced && (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/40 p-3">
              <div className="space-y-1"><Label>IMAP serveur</Label><Input name="imapHost" defaultValue="mail.infomaniak.com" /></div>
              <div className="space-y-1"><Label>IMAP port</Label><Input name="imapPort" type="number" defaultValue="993" /></div>
              <div className="space-y-1"><Label>SMTP serveur</Label><Input name="smtpHost" defaultValue="mail.infomaniak.com" /></div>
              <div className="space-y-1"><Label>SMTP port</Label><Input name="smtpPort" type="number" defaultValue="465" /></div>
            </div>
          )}

          {err && <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {err}</div>}
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Identifiants chiffrés, jamais exposés.</p>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Connecter</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
