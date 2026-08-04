"use client";

import * as React from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertCircle, Wand2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/types";
import { cn } from "@/lib/utils";

/** Pré-remplissage IA optionnel : un fichier est analysé (OCR + IA) → valeurs de champs. */
export interface AnalyzePrefill {
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string; values?: Record<string, string> }>;
  buttonLabel: string; // ex. « Analyser un contrat (IA) »
  title: string; // titre du bloc
  hint: string; // explication
  accept?: string; // types de fichiers acceptés
  disabled?: boolean; // IA indisponible
  disabledHint?: string; // message si désactivé
}

export type FieldDef =
  | {
      type: "text" | "number" | "date";
      name: string;
      label: string;
      required?: boolean;
      placeholder?: string;
      defaultValue?: string | number;
      full?: boolean;
    }
  | {
      type: "textarea";
      name: string;
      label: string;
      required?: boolean;
      placeholder?: string;
      full?: boolean;
    }
  | {
      type: "select";
      name: string;
      label: string;
      options: { value: string; label: string }[];
      required?: boolean;
      defaultValue?: string;
      placeholder?: string;
      full?: boolean;
    }
  | { type: "checkbox"; name: string; label: string; full?: boolean }
  | { type: "file"; name: string; label: string; multiple?: boolean; hint?: string; defaultValue?: string | number; full?: boolean };

interface CreateRecordButtonProps {
  label: string;
  title: string;
  description?: string;
  fields: FieldDef[];
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  /** Optional base path; on success navigates to `${redirectBase}/${id}`. */
  redirectBase?: string;
  width?: "md" | "lg";
  /** Optional AI prefill: analyse a file, prefill the fields (editable). */
  analyze?: AnalyzePrefill;
}

export function CreateRecordButton({
  label,
  title,
  description,
  fields,
  action,
  redirectBase,
  width = "lg",
  analyze,
}: CreateRecordButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [state, formAction] = useFormState<ActionResult | undefined, FormData>(action, undefined);
  // Verrou SYNCHRONE anti double-création : un double-clic (ou double Entrée) déclenche un 2ᵉ
  // envoi AVANT que `submitting` n'ait désactivé le bouton — le verrou bloque ce 2ᵉ envoi.
  const lock = React.useRef(false);

  // Pré-remplissage IA : valeurs extraites + compteur pour re-monter (reset) les champs.
  const [prefill, setPrefill] = React.useState<Record<string, string>>({});
  const [prefillVersion, setPrefillVersion] = React.useState(0);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzeMsg, setAnalyzeMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) { setPrefill({}); setAnalyzeMsg(null); }
  }, [open]);

  async function runAnalyze() {
    if (!analyze) return;
    const f = fileRef.current?.files?.[0];
    if (!f) { setAnalyzeMsg({ ok: false, text: "Choisissez d'abord un fichier." }); return; }
    setAnalyzing(true); setAnalyzeMsg(null);
    const fd = new FormData(); fd.set("file", f);
    const r = await analyze.action(fd);
    setAnalyzing(false);
    if (!r.ok) { setAnalyzeMsg({ ok: false, text: r.error ?? "Analyse impossible." }); return; }
    setPrefill(r.values ?? {});
    setPrefillVersion((v) => v + 1);
    setAnalyzeMsg({ ok: true, text: `${Object.keys(r.values ?? {}).length} champ(s) préremplis — vérifiez et complétez.` });
  }

  /** Valeur par défaut d'un champ : priorité au pré-remplissage IA. */
  const dv = (field: FieldDef): string | number | undefined => {
    const p = prefill[field.name];
    if (p !== undefined) return p;
    return "defaultValue" in field ? field.defaultValue : undefined;
  };

  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setSubmitting(false);
      router.refresh();
      if (redirectBase && state.id) router.push(`${redirectBase}/${state.id}`);
    } else if (state?.error) {
      setSubmitting(false);
      lock.current = false; // échec → nouvelle tentative autorisée
    }
  }, [state, router, redirectBase]);

  return (
    <>
      <Button onClick={() => { lock.current = false; setOpen(true); }}>
        <Plus className="h-4 w-4" />
        {label}
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title={title} description={description} width={width}>
        {analyze && (
          <div className="mb-4 space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-primary"><Wand2 className="h-4 w-4" /> {analyze.title}</p>
            <p className="text-xs text-muted-foreground">{analyze.hint}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept={analyze.accept} disabled={analyze.disabled || analyzing}
                className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium" />
              <Button type="button" size="sm" onClick={runAnalyze} disabled={analyze.disabled || analyzing}
                title={analyze.disabled ? analyze.disabledHint : undefined}>
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {analyze.buttonLabel}
              </Button>
            </div>
            {analyze.disabled && analyze.disabledHint && <p className="text-xs text-amber-700">{analyze.disabledHint}</p>}
            {analyzeMsg && <p className={cn("text-xs", analyzeMsg.ok ? "text-success" : "text-destructive")}>{analyzeMsg.text}</p>}
          </div>
        )}
        <form
          action={(fd) => {
            if (lock.current) return;
            lock.current = true;
            setSubmitting(true);
            formAction(fd);
          }}
          className="space-y-4"
        >
          <div key={prefillVersion} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div
                key={field.name}
                className={cn("space-y-1.5", (field.full || field.type === "textarea") && "sm:col-span-2")}
              >
                {field.type !== "checkbox" && (
                  <Label htmlFor={field.name}>
                    {field.label}
                    {"required" in field && field.required && (
                      <span className="ml-0.5 text-destructive">*</span>
                    )}
                  </Label>
                )}
                {field.type === "file" ? (
                  <>
                    <input
                      id={field.name}
                      type="file"
                      name={field.name}
                      multiple={field.multiple}
                      className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
                    />
                    {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                  </>
                ) : field.type === "textarea" ? (
                  <Textarea id={field.name} name={field.name} required={field.required} placeholder={field.placeholder} />
                ) : field.type === "select" ? (
                  <Select id={field.name} name={field.name} required={field.required} defaultValue={dv(field) as string | undefined}>
                    {field.placeholder && <option value="">{field.placeholder}</option>}
                    {field.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : field.type === "checkbox" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={field.name} className="h-4 w-4 rounded border-input" />
                    {field.label}
                  </label>
                ) : (
                  <Input
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    required={field.required}
                    placeholder={field.placeholder}
                    defaultValue={dv(field)}
                    step={field.type === "number" ? "any" : undefined}
                  />
                )}
              </div>
            ))}
          </div>

          {state?.error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {state.error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
