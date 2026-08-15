"use client";

import * as React from "react";
import { Loader2, PlugZap, Check, X, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SelfTestReport } from "@/lib/storage/self-test";

/**
 * STOCKAGE OBJET — état et test de connexion (Super Admin).
 *
 * « Les variables sont renseignées » ne prouve rien : un bucket mal nommé, une clé périmée ou une
 * région fausse donnent la même page verte. Le bouton écrit donc réellement un petit objet dans le
 * bucket, le relit, compare son contenu, et le supprime — c'est le seul test qui répond à
 * « est-ce que ça marche ? ».
 *
 * Rien de sensible ne transite : le rapport ne contient que l'hôte, le bucket et la région.
 */
export function StoragePanel({ initial }: { initial: SelfTestReport["config"] }) {
  const [busy, setBusy] = React.useState(false);
  const [report, setReport] = React.useState<SelfTestReport | null>(null);
  const cfg = report?.config ?? initial;

  const run = () => {
    setBusy(true);
    void fetch("/api/admin/storage/self-test", { method: "POST" })
      .then((r) => r.json() as Promise<SelfTestReport>)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        <HardDrive className="h-4 w-4 text-muted-foreground" />
        {cfg.disabled ? (
          <Badge tone="warning" dot={false}>Désactivé (S3_DISABLED)</Badge>
        ) : cfg.configured ? (
          <Badge tone="success" dot={false}>{cfg.provider}</Badge>
        ) : (
          <Badge tone="neutral" dot={false}>Non configuré — stockage en base</Badge>
        )}
        {cfg.configured && (
          <span className="text-xs text-muted-foreground">
            {cfg.endpointHost} · bucket <strong className="text-foreground">{cfg.bucket}</strong> · région {cfg.region}
            {cfg.pathStyle ? " · chemin" : " · sous-domaine"}
            {cfg.variableSource === "REG_S3" && " · variables REG_S3_* (anciennes)"}
          </span>
        )}
        {!cfg.configured && !cfg.disabled && cfg.missing.length > 0 && (
          <span className="text-xs text-muted-foreground">Manque : {cfg.missing.join(", ")}</span>
        )}
        <Button size="sm" variant="outline" className="ml-auto" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} Tester la connexion
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Le test écrit un objet dans un préfixe dédié (<code>_selftest/</code>), le relit, compare son
        contenu et le supprime. Les fichiers déjà stockés en base restent lisibles quoi qu&apos;il
        arrive — le stockage objet ne concerne que les nouveaux enregistrements.
      </p>

      {report && (
        <ul className="surface divide-y divide-border text-sm">
          {report.steps.map((s) => (
            <li key={s.step} className="flex flex-wrap items-center gap-3 px-3 py-2">
              {s.ok
                ? <Check className="h-4 w-4 shrink-0 text-success" />
                : <X className="h-4 w-4 shrink-0 text-destructive" />}
              <span className="font-medium">{s.label}</span>
              <span className="text-xs text-muted-foreground">{s.ms} ms</span>
              {s.detail && <span className="min-w-0 flex-1 text-xs text-muted-foreground">{s.detail}</span>}
            </li>
          ))}
          <li className="px-3 py-2 text-xs text-muted-foreground">
            {report.ok
              ? "Le stockage objet répond : écriture, lecture, vérification et suppression ont abouti."
              : "Le stockage objet n'est pas utilisable en l'état — l'application continue d'écrire en base."}
            {report.cleaned ? " L'objet de test a été supprimé." : ""}
          </li>
        </ul>
      )}
    </div>
  );
}
