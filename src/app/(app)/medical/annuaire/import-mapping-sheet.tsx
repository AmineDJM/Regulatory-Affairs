"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, Check, Loader2, Upload } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validateMapping, type HeaderProposal, type TargetColumn } from "@/lib/medical/directory-mapping";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA CORRESPONDANCE DES COLONNES, À L'ÉCRAN — la dernière chance de dire non.
 *
 * ── CE QUE CET ÉCRAN REMPLACE ────────────────────────────────────────────────────────────
 *
 * Auparavant : on choisissait un fichier, il partait, et le message de fin annonçait
 * « colonne non reconnue : Colonne 3 ». Trop tard, et pour rien : le contenu était déjà perdu.
 *
 * Maintenant l'import se fait en deux temps. On LIT d'abord — sans rien écrire —, on montre ce
 * qu'on a compris colonne par colonne AVEC UN ÉCHANTILLON DE VALEURS, et on n'écrit qu'une fois
 * la correspondance acceptée.
 *
 * ── POURQUOI L'ORIGINE DE CHAQUE PROPOSITION EST AFFICHÉE ────────────────────────────────
 *
 * « Exact » et « deviné » ne se relisent pas avec la même attention. Présenter les deux du même
 * air ferait valider les secondes aussi vite que les premières — c'est-à-dire sans les lire. La
 * pastille dirige le regard là où il sert.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const ORIGINE: Record<string, { texte: string; classe: string }> = {
  exact: { texte: "exact", classe: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  alias: { texte: "reconnu", classe: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  approche: { texte: "approché", classe: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  aucune: { texte: "à décider", classe: "bg-muted text-muted-foreground" },
};

export function ImportMappingSheet({
  fileName, directoryName, rowCount, proposals, targets, busy, onCancel, onConfirm,
}: {
  fileName: string;
  directoryName: string;
  rowCount: number;
  proposals: HeaderProposal[];
  targets: TargetColumn[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (mapping: (string | null)[]) => void;
}) {
  const [choix, setChoix] = React.useState<(string | null)[]>(() => proposals.map((p) => p.target));

  const problemes = React.useMemo(() => validateMapping(choix), [choix]);
  const retenues = choix.filter(Boolean).length;
  const ecartees = choix.length - retenues;

  // Une cible déjà prise ailleurs ne s'offre plus : c'est plus clair qu'un message d'erreur
  // après coup, et cela rend le conflit à peu près impossible à créer.
  const prises = new Set(choix.filter((c): c is string => Boolean(c)));

  return (
    <Sheet
      open onClose={onCancel} width="lg"
      title="Correspondance des colonnes"
      description={`${fileName} — ${rowCount} ligne(s) vers ${directoryName}. Rien n'est encore importé.`}
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-input bg-muted/40 p-2.5 text-xs text-muted-foreground">
          Chaque colonne du fichier va vers une colonne de l&apos;annuaire. Ce qui est laissé sur
          <strong className="text-foreground"> « Ne pas importer » </strong> est ignoré — sans perte pour le fichier d&apos;origine.
        </div>

        <div className="overflow-x-auto rounded-xl border border-input">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-2.5 py-2 text-left font-medium">Colonne du fichier</th>
                <th className="px-2.5 py-2 text-left font-medium">Exemples</th>
                <th className="w-8" />
                <th className="px-2.5 py-2 text-left font-medium">Colonne de l&apos;annuaire</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p, i) => {
                const o = ORIGINE[p.origin] ?? ORIGINE.aucune;
                return (
                  <tr key={p.index} className="border-t border-input/60 align-top">
                    <td className="px-2.5 py-2">
                      <div className="font-medium">{p.header || <span className="text-muted-foreground">(sans titre)</span>}</div>
                      <span className={cn("mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium", o.classe)}>
                        {o.texte}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-xs text-muted-foreground">
                      {p.sample.length ? p.sample.map((s, k) => <div key={k}>{s}</div>) : <span>—</span>}
                    </td>
                    <td className="px-1 py-2 text-muted-foreground"><ArrowRight className="h-3.5 w-3.5" /></td>
                    <td className="px-2.5 py-2">
                      <select
                        value={choix[i] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value || null;
                          setChoix((prev) => prev.map((c, k) => (k === i ? v : c)));
                        }}
                        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                      >
                        <option value="">Ne pas importer</option>
                        {targets.map((t) => (
                          <option key={t.id} value={t.id} disabled={prises.has(t.id) && choix[i] !== t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {problemes.length > 0 && (
          <div className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
            {problemes.map((pb, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {pb.message}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-input pt-3">
          <span className="text-xs text-muted-foreground">
            {retenues} colonne(s) importée(s){ecartees > 0 ? ` · ${ecartees} écartée(s)` : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>Annuler</Button>
            <Button
              size="sm"
              disabled={busy || problemes.length > 0}
              onClick={() => onConfirm(choix)}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Importer {rowCount} ligne(s)
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/** Une pastille de confirmation réutilisable — l'import réussi mérite mieux qu'un texte gris. */
export function ImportDone({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
      <Check className="h-3.5 w-3.5" /> {text}
    </span>
  );
}
