"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { redeemInviteAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/** La personne invitée choisit SON mot de passe — vérifié et posé côté serveur (usage unique). */
export function SetPasswordForm({ token }: { token: string }) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const pwd = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");
    if (pwd.length < 8) { setError("Mot de passe trop court (min. 8 caractères)."); return; }
    if (pwd !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setError(null);
    setPending(true);
    try {
      const r = await redeemInviteAction(token, pwd);
      if (r.ok) setDone(true);
      else setError(r.error);
    } catch {
      setError("Impossible de joindre le serveur. Réessayez.");
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Mot de passe enregistré — votre compte est actif.
        </div>
        <Link
          href="/"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors duration-150 hover:bg-primary/90"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirmer</Label>
        <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Activer mon compte
      </Button>
    </form>
  );
}
