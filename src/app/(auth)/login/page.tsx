import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion — AMD Internal OS",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-accent text-lg font-bold text-sidebar">
            A
          </div>
          <div>
            <p className="text-base font-semibold">AMD Internal OS</p>
            <p className="text-xs text-sidebar-muted">Adventum Pharma</p>
          </div>
        </div>

        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            Le système d&apos;exploitation interne d&apos;Adventum.
          </h1>
          <p className="text-sm leading-relaxed text-sidebar-muted">
            Regulatory, Sponsoring, Budgets, Congrès, Ventes, Logistique PCH,
            Promotion médicale et Business Development — centralisés, sécurisés
            et pilotés en temps réel.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs text-sidebar-muted">
          <div className="rounded-lg border border-white/10 p-3">
            <p className="text-lg font-semibold text-white">8</p>
            pôles métiers
          </div>
          <div className="rounded-lg border border-white/10 p-3">
            <p className="text-lg font-semibold text-white">RBAC</p>
            accès par ligne
          </div>
          <div className="rounded-lg border border-white/10 p-3">
            <p className="text-lg font-semibold text-white">100%</p>
            traçabilité
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1.5 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                A
              </div>
              <span className="font-semibold">AMD Internal OS</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">Connexion</h2>
            <p className="text-sm text-muted-foreground">
              Accédez à votre espace de travail Adventum.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
