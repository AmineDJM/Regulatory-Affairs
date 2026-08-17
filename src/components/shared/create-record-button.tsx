"use client";

import * as React from "react";
import { useAutoOpen } from "./use-auto-open";
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
      // `datetime-local` pour les champs qui portent une HEURE (départ d'un courrier) : taper
      // « 2026-08-17T14:30 » à la main dans un champ texte, personne ne le fait juste.
      type: "text" | "number" | "date" | "datetime-local";
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
      // Le même formulaire sert à CRÉER et à MODIFIER : sans valeur initiale, rouvrir une fiche
      // pour corriger une date effacerait les notes déjà saisies.
      defaultValue?: string;
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
  | { type: "multiselect"; name: string; label: string; options: { value: string; label: string }[]; hint?: string; full?: boolean }
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
  /** Nom du paramètre d'URL qui ouvre le formulaire à l'arrivée (ex. « new »). */
  autoOpenParam?: string;
}

interface RecordFormProps {
  fields: FieldDef[];
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  /** Optional base path; on success navigates to `${redirectBase}/${id}`. */
  redirectBase?: string;
  /** Optional AI prefill: analyse a file, prefill the fields (editable). */
  analyze?: AnalyzePrefill;
  /** Création réussie — l'appelant referme le panneau qui porte ce formulaire. */
  onDone: () => void;
  /** Bouton secondaire : fermer ici, revenir au choix de la nature depuis Ad & Pro. */
  onCancel: () => void;
  cancelLabel?: string;
  submitLabel?: string;
}

/**
 * LE FORMULAIRE SEUL, sans son bouton ni son panneau.
 *
 * Il existe séparément parce qu'il a désormais deux points de montage : l'écran du module (via
 * `CreateRecordButton`, qui lui ajoute bouton + panneau) et le panneau commun d'Ad & Pro, où l'on
 * a déjà choisi la nature de sa demande — et où ouvrir un second panneau par-dessus le premier
 * n'aurait aucun sens.
 */
export function RecordForm({
  fields,
  action,
  redirectBase,
  analyze,
  onDone,
  onCancel,
  cancelLabel = "Annuler",
  submitLabel = "Enregistrer",
}: RecordFormProps) {
  const router = useRouter();
  // L'appelant passe le plus souvent une lambda : on garde la dernière version dans une référence
  // pour que l'effet de succès ne se redéclenche pas au gré des rendus du parent.
  const done = React.useRef(onDone);
  done.current = onDone;
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
      setSubmitting(false);
      done.current();
      router.refresh();
      if (redirectBase && state.id) router.push(`${redirectBase}/${state.id}`);
    } else if (state?.error) {
      setSubmitting(false);
      lock.current = false; // échec → nouvelle tentative autorisée
    }
  }, [state, router, redirectBase]);

  return (
    <>
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
                <Textarea id={field.name} name={field.name} required={field.required} placeholder={field.placeholder} defaultValue={dv(field) as string | undefined} />
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
              ) : field.type === "multiselect" ? (
                <>
                  {field.options.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucune personne disponible.</p>
                  ) : (
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-input p-2">
                      {field.options.map((o) => (
                        <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary">
                          <input type="checkbox" name={field.name} value={o.value} className="h-4 w-4 rounded border-input" />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  )}
                  {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                </>
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
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </>
  );
}

/**
 * Le bouton « Nouveau… » d'un écran de module : il n'est plus qu'un déclencheur et un panneau
 * autour de `RecordForm`. Le formulaire se remonte à chaque ouverture — une erreur affichée la
 * fois précédente ne revient donc pas accueillir la suivante.
 */
export function CreateRecordButton({
  label,
  title,
  description,
  fields,
  action,
  redirectBase,
  width = "lg",
  analyze,
  autoOpenParam,
}: CreateRecordButtonProps) {
  const [open, setOpen] = React.useState(false);

  // Ouverture depuis un lien direct (`?new=1`) — voir `useAutoOpen`.
  useAutoOpen(autoOpenParam, () => setOpen(true));

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {label}
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title={title} description={description} width={width}>
        <RecordForm
          fields={fields}
          action={action}
          redirectBase={redirectBase}
          analyze={analyze}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}
