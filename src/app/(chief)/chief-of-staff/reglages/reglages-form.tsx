"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, ShieldAlert, Radio, Unplug, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  setAdamMailPolicy,
  setAdamOutboundPaused,
  setAdamInboundPaused,
  setAdamConnectionPaused,
  disconnectAdamGoogle,
  renewAdamWatch,
} from "@/lib/actions/adam-settings-actions";

/**
 * Les COMMANDES des réglages d'Adam. L'écran ne décide rien : chaque bouton appelle une action
 * serveur qui revérifie le droit et journalise. Ce composant ne gère que l'attente et le retour.
 */

type Policy = "REQUIRE_APPROVAL" | "AUTO_SEND" | "DRAFT_ONLY";

const CHOICES: { value: Policy; label: string; help: string }[] = [
  {
    value: "REQUIRE_APPROVAL",
    label: "Approbation requise",
    help: "Adam prépare tout — lecture, analyse, brouillons, relances — et n'envoie qu'après votre validation du contenu exact.",
  },
  {
    value: "AUTO_SEND",
    label: "Envoi autonome",
    help: "Adam envoie sans demander. À réserver aux échanges déjà cadrés.",
  },
  {
    value: "DRAFT_ONLY",
    label: "Brouillons seulement",
    help: "Adam prépare, mais AUCUN message ne part — même approuvé.",
  },
];

export function ReglagesForm({
  policy,
  outboundPaused,
  inboundPaused,
  connectionPaused,
  connected,
}: {
  policy: Policy;
  outboundPaused: boolean;
  inboundPaused: boolean;
  connectionPaused: boolean;
  connected: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ tone: "ok" | "err"; text: string } | null>(null);
  // La ressaisie n'apparaît QUE lorsqu'on vise l'envoi autonome — une friction affichée en
  // permanence finit par se cliquer sans lire.
  const [confirmFor, setConfirmFor] = React.useState<Policy | null>(null);
  const [confirmText, setConfirmText] = React.useState("");

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) => {
    setBusy(key);
    setMessage(null);
    try {
      const r = await fn();
      if (r.ok) {
        setMessage({ tone: "ok", text: okText });
        setConfirmFor(null);
        setConfirmText("");
        router.refresh();
      } else {
        setMessage({ tone: "err", text: r.error ?? "Échec." });
      }
    } catch {
      setMessage({ tone: "err", text: "Le serveur n'a pas répondu." });
    } finally {
      setBusy(null);
    }
  };

  const choosePolicy = (next: Policy) => {
    if (next === policy) return;
    if (next === "AUTO_SEND" && confirmFor !== "AUTO_SEND") {
      setConfirmFor("AUTO_SEND");
      setMessage(null);
      return;
    }
    void run(
      `policy-${next}`,
      () => setAdamMailPolicy(next as never, next === "AUTO_SEND" ? confirmText : undefined),
      "Politique d'envoi enregistrée.",
    );
  };

  return (
    <div className="space-y-6">
      {message && (
        <p
          role="status"
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.tone === "ok"
              ? "border-success/20 bg-success/10 text-success"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </p>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Envoi de courriel</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {CHOICES.map((c) => {
            const active = c.value === policy;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => choosePolicy(c.value)}
                disabled={busy !== null}
                aria-pressed={active}
                className={`rounded-lg border p-3 text-left transition ${
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-secondary"
                } disabled:opacity-60`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {c.value === "AUTO_SEND" ? (
                    <ShieldAlert className="h-4 w-4 text-warning" aria-hidden />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
                  )}
                  {c.label}
                  {active && <span className="ml-auto text-[11px] uppercase text-primary">actif</span>}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{c.help}</span>
              </button>
            );
          })}
        </div>

        {confirmFor === "AUTO_SEND" && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
            <p className="text-sm">
              L&apos;envoi autonome retire le dernier contrôle entre un brouillon et un vrai
              destinataire. Pour l&apos;armer, saisissez <strong>ENVOI AUTONOME</strong>.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ENVOI AUTONOME"
                aria-label="Confirmation de l'envoi autonome"
                className="max-w-xs"
              />
              <Button
                variant="destructive"
                onClick={() => choosePolicy("AUTO_SEND")}
                disabled={busy !== null || confirmText.trim().toUpperCase() !== "ENVOI AUTONOME"}
              >
                {busy === "policy-AUTO_SEND" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Armer l&apos;envoi autonome
              </Button>
              <Button variant="ghost" onClick={() => { setConfirmFor(null); setConfirmText(""); }}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Coupe-circuits</h3>
        <p className="text-xs text-muted-foreground">
          La suspension de l&apos;envoi prime sur TOUT, y compris l&apos;envoi autonome.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={outboundPaused ? "success" : "outline"}
            onClick={() =>
              run("outbound", () => setAdamOutboundPaused(!outboundPaused),
                outboundPaused ? "Envoi rétabli." : "Envoi suspendu.")
            }
            disabled={busy !== null}
          >
            {busy === "outbound" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {outboundPaused ? "Rétablir l'envoi" : "Suspendre l'envoi"}
          </Button>
          <Button
            variant={inboundPaused ? "success" : "outline"}
            onClick={() =>
              run("inbound", () => setAdamInboundPaused(!inboundPaused),
                inboundPaused ? "Lecture rétablie." : "Lecture suspendue.")
            }
            disabled={busy !== null}
          >
            {busy === "inbound" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {inboundPaused ? "Reprendre la lecture" : "Suspendre la lecture"}
          </Button>
        </div>
      </section>

      {connected && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Connexion Google</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => run("watch", () => renewAdamWatch(), "Veille Gmail réarmée.")}
              disabled={busy !== null}
            >
              {busy === "watch" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Radio className="h-4 w-4" aria-hidden />
              )}
              Réarmer la veille Gmail
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                run("conn", () => setAdamConnectionPaused(!connectionPaused),
                  connectionPaused ? "Connexion réactivée." : "Connexion mise en pause.")
              }
              disabled={busy !== null}
            >
              {busy === "conn" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              {connectionPaused ? "Réactiver la connexion" : "Mettre la connexion en pause"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => run("disconnect", () => disconnectAdamGoogle(), "Compte Google déconnecté et consentement révoqué.")}
              disabled={busy !== null}
            >
              {busy === "disconnect" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Unplug className="h-4 w-4" aria-hidden />
              )}
              Déconnecter
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
