"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { authenticate } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const DEMO_ACCOUNTS = [
  { label: "Direction", email: "direction@adventum.dz" },
  { label: "Resp. Regulatory", email: "regulatory@adventum.dz" },
  { label: "Assistante Reg.", email: "assistante1@adventum.dz" },
  { label: "Logistique", email: "logistique@adventum.dz" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Se connecter
    </Button>
  );
}

export function LoginForm() {
  const [errorMessage, formAction] = useFormState(authenticate, undefined);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email professionnel</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="prenom@adventum.dz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        <SubmitButton />
      </form>

      <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Comptes de démonstration (mot de passe&nbsp;: <code>password123</code>)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => {
                setEmail(acc.email);
                setPassword("password123");
              }}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              {acc.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
