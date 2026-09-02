"use client";

import * as React from "react";
import { useAutoOpen } from "./use-auto-open";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertCircle, Wand2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { DrivePickerField } from "@/components/drive/drive-picker";
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
      /** Ce que le champ attend quand le libellé ne suffit pas — ou POURQUOI il est libre ici
       *  alors qu'il se choisit ailleurs (référentiel vide). */
      hint?: string;
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
      /** Ce que le choix ENTRAÎNE, quand ce n'est pas évident (ex. « assignée à quelqu'un
       *  d'autre » ouvre un circuit de demande). Une liste déroulante ne le dit pas d'elle-même. */
      hint?: string;
      full?: boolean;
    }
  // Valeur portée par le formulaire sans être saisie : le RATTACHEMENT à l'objet d'où l'on
  // crée la pièce (« cette facture vient de CETTE demande »). Ce n'est pas un secret — le
  // serveur revérifie ce qu'il en fait — c'est un contexte que l'utilisateur n'a pas à ressaisir.
  | { type: "hidden"; name: string; value: string }
  | { type: "checkbox"; name: string; label: string; full?: boolean }
  | { type: "multiselect"; name: string; label: string; options: { value: string; label: string }[]; hint?: string; full?: boolean; defaultValue?: string[]; searchPlaceholder?: string; emptyLabel?: string }
  | { type: "file"; name: string; label: string; multiple?: boolean; hint?: string; defaultValue?: string | number; full?: boolean; /** Formats proposés par le sélecteur (`.pdf,.png`…) — le serveur revérifie TOUJOURS. */ accept?: string }
  // L'EXPLORATEUR DU DRIVE, ouvert par-dessus le formulaire : on désigne un dossier ou un
  // fichier qui existe déjà plutôt que d'en téléverser une copie. Le champ ne transporte qu'un
  // identifiant de nœud — le fichier, lui, ne bouge pas.
  | { type: "drivepicker"; name: string; label: string; hint?: string; full?: boolean };

/**
 * Les champs QUI S'AFFICHENT — tous sauf le champ caché.
 *
 * Certains écrans dessinent eux-mêmes leur formulaire à partir d'une liste de `FieldDef` (les
 * champs propres à un type de demande administrative, par exemple) et lisent `label` sur chacun.
 * Un champ caché n'a pas de libellé : les typer avec celui-ci évite de leur faire traiter un cas
 * qui ne se présentera jamais chez eux.
 */
export type VisibleFieldDef = Exclude<FieldDef, { type: "hidden" }>;

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
/**
 * CHOISIR PLUSIEURS ENTRÉES DANS UNE LISTE QUI PEUT ÊTRE LONGUE.
 *
 * ── POURQUOI UNE BARRE DE RECHERCHE ─────────────────────────────────────────────────────────
 *
 * Le champ affichait toutes les options dans une boîte à défilement. Cela tient pour douze
 * collaborateurs ; l'annuaire des médecins en compte des centaines, et le référentiel des wilayas
 * cinquante-huit. Faire défiler pour trouver « Dr Zerrouki » n'est pas un inconfort : c'est ce qui
 * fait renoncer, et écrire le nom dans la description où plus rien ne le compte.
 *
 * ── CE QUI RESTE VISIBLE MÊME QUAND ON FILTRE ───────────────────────────────────────────────
 *
 * Les entrées DÉJÀ COCHÉES restent dans la liste quoi qu'on tape. Sans cela, chercher un second
 * nom ferait disparaître le premier de l'écran — et l'on décoche par réflexe ce qu'on croit avoir
 * perdu. Le compteur dit combien sont retenues, y compris hors filtre.
 *
 * Les cases sont de VRAIES cases nommées : le formulaire les envoie sans JavaScript de notre
 * part, et le serveur lit `formData.getAll(name)` comme avant.
 */
function MultiSelectField({ field }: {
  field: Extract<FieldDef, { type: "multiselect" }>;
}) {
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>(() => field.defaultValue ?? []);

  const q = query.trim().toLowerCase();
  const visible = React.useMemo(
    () => (q ? field.options.filter((o) => o.label.toLowerCase().includes(q) || picked.includes(o.value)) : field.options),
    [field.options, q, picked],
  );
  // La recherche n'apparaît que là où elle sert : sous une dizaine d'entrées, elle prend de la
  // place et un temps de lecture pour rien.
  const searchable = field.options.length > 8;

  if (field.options.length === 0) {
    return <p className="text-xs text-muted-foreground">{field.emptyLabel ?? "Aucune option disponible."}</p>;
  }

  return (
    <>
      {searchable && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={field.searchPlaceholder ?? "Rechercher…"}
            aria-label={`Rechercher dans ${field.label}`}
            className="h-8 flex-1"
          />
          <span className="text-xs text-muted-foreground">
            {picked.length > 0 ? `${picked.length} sélectionné(s)` : `${field.options.length} au choix`}
          </span>
        </div>
      )}
      <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-input p-2">
        {visible.length === 0 ? (
          <p className="px-1.5 py-1 text-xs text-muted-foreground">Aucun résultat pour « {query} ».</p>
        ) : visible.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary">
            <input
              type="checkbox" name={field.name} value={o.value}
              checked={picked.includes(o.value)}
              onChange={(e) => setPicked((prev) => (e.target.checked ? [...prev, o.value] : prev.filter((v) => v !== o.value)))}
              className="h-4 w-4 rounded border-input"
            />
            {o.label}
          </label>
        ))}
      </div>
      {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
    </>
  );
}

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
  // Verrou SYNCHRONE anti double-création : un double-clic (ou double Entrée) déclenche un 2ᵉ
  // envoi AVANT que `submitting` n'ait désactivé le bouton — le verrou bloque ce 2ᵉ envoi.
  const lock = React.useRef(false);

  /**
   * LE BOUTON NE PEUT PLUS TOURNER INDÉFINIMENT.
   *
   * ── LE DÉFAUT QU'ON CORRIGE ───────────────────────────────────────────────────────────────
   *
   * `useFormState` ne met l'état à jour QUE si l'action RETOURNE. Si elle LÈVE — erreur Prisma,
   * stockage injoignable, déploiement en cours, connexion coupée — aucun état n'arrive : l'effet
   * de succès comme celui d'erreur restent muets, `submitting` reste vrai, et le bouton tourne
   * pour toujours SANS AUCUN MESSAGE. C'est exactement le symptôme rapporté (« ça tourne tourne
   * tourne »), et la raison pour laquelle on croyait que rien ne s'enregistrait.
   *
   * Le piège est plus vicieux qu'un simple bouton bloqué : plusieurs de ces actions
   * ENREGISTRENT D'ABORD puis font le lent (pièces jointes, journal, notifications). Le courrier
   * était donc souvent bien créé — mais l'écran ne le disait jamais, la personne recommençait, et
   * l'on obtenait des doublons. D'où l'interdiction, dans le message, de « réessayer » à
   * l'aveugle : on demande de VÉRIFIER LA LISTE d'abord.
   *
   * Deux garde-fous, et le second est indispensable : attraper la levée ne suffit pas si le
   * serveur ne répond JAMAIS (requête suspendue). Le chronomètre tranche ce cas-là.
   */
  const actionRef = React.useRef(action);
  actionRef.current = action;
  const guarded = React.useCallback(
    async (prev: ActionResult | undefined, fd: FormData): Promise<ActionResult> => {
      try {
        return await actionRef.current(prev, fd);
      } catch (err) {
        console.error("[form] l'action serveur a levé", err);
        return {
          ok: false,
          error: "L'enregistrement n'a pas abouti (connexion ou serveur). VÉRIFIEZ D'ABORD LA LISTE : l'enregistrement a pu se faire malgré tout — recommencer à l'aveugle créerait un doublon.",
        };
      }
    },
    [],
  );
  const [state, formAction] = useFormState<ActionResult | undefined, FormData>(guarded, undefined);

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

  /**
   * Valeur par défaut d'un champ : priorité au pré-remplissage IA.
   *
   * Le multi-sélecteur porte sa propre valeur par défaut (un TABLEAU, géré dans son composant) :
   * la rendre ici la ferait passer pour la valeur d'un `<input>` simple, et React afficherait
   * « a,b,c » dans une case de texte.
   */
  const dv = (field: FieldDef): string | number | undefined => {
    const p = prefill[field.name];
    if (p !== undefined) return p;
    if (field.type === "multiselect") return undefined;
    return "defaultValue" in field ? field.defaultValue : undefined;
  };

  /**
   * LE CHRONOMÈTRE — pour la requête qui ne revient jamais.
   *
   * Une action qui LÈVE est attrapée juste au-dessus. Une action qui SE SUSPEND (stockage
   * injoignable, conteneur redémarré au milieu) ne lève ni ne retourne : rien ne la réveillera.
   * Au bout de 45 secondes on rend la main à la personne, en lui disant quoi faire — et
   * SURTOUT ce qu'il ne faut pas faire, c'est-à-dire recommencer sans regarder.
   */
  const [timedOut, setTimedOut] = React.useState(false);
  React.useEffect(() => {
    if (!submitting) return;
    const t = setTimeout(() => {
      setSubmitting(false);
      lock.current = false;
      setTimedOut(true);
    }, 45_000);
    return () => clearTimeout(t);
  }, [submitting]);

  React.useEffect(() => {
    if (state?.ok || state?.error) setTimedOut(false);
    if (state?.ok) {
      setSubmitting(false);
      done.current();
      // ON NE RAFRAÎCHIT PAS L'ÉCRAN QU'ON QUITTE. Quand la création ouvre la fiche du nouvel
      // objet, un `refresh()` suivi d'un `push()` faisait rendre DEUX pages au serveur — la
      // liste qu'on abandonne, puis la fiche — et le bouton tournait pendant les deux.
      // L'action a déjà invalidé le cache de la liste : elle sera à jour au retour.
      if (redirectBase && state.id) router.push(`${redirectBase}/${state.id}`);
      else router.refresh();
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
          setTimedOut(false);
          setSubmitting(true);
          formAction(fd);
        }}
        className="space-y-4"
      >
        <div key={prefillVersion} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((field) => (field.type === "hidden" ? (
            <input key={field.name} type="hidden" name={field.name} value={field.value} />
          ) : (
            <div
              key={field.name}
              className={cn("space-y-1.5", (field.full || field.type === "textarea") && "sm:col-span-2")}
            >
              {field.type !== "checkbox" && field.type !== "drivepicker" && (
                <Label htmlFor={field.name}>
                  {field.label}
                  {"required" in field && field.required && (
                    <span className="ml-0.5 text-destructive">*</span>
                  )}
                </Label>
              )}
              {field.type === "drivepicker" ? (
                <DrivePickerField name={field.name} label={field.label} hint={field.hint} />
              ) : field.type === "file" ? (
                <>
                  <input
                    id={field.name}
                    type="file"
                    name={field.name}
                    multiple={field.multiple}
                    accept={field.accept}
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
                  />
                  {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                </>
              ) : field.type === "textarea" ? (
                <Textarea id={field.name} name={field.name} required={field.required} placeholder={field.placeholder} defaultValue={dv(field) as string | undefined} />
              ) : field.type === "select" ? (
                <>
                  <Select id={field.name} name={field.name} required={field.required} defaultValue={dv(field) as string | undefined}>
                    {field.placeholder && <option value="">{field.placeholder}</option>}
                    {field.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                  {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                </>
              ) : field.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={field.name} className="h-4 w-4 rounded border-input" />
                  {field.label}
                </label>
              ) : field.type === "multiselect" ? (
                <MultiSelectField field={field} />
              ) : (
                <>
                  <Input
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    required={field.required}
                    placeholder={field.placeholder}
                    defaultValue={dv(field)}
                    step={field.type === "number" ? "any" : undefined}
                  />
                  {"hint" in field && field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                </>
              )}
            </div>
          )))}
        </div>

        {state?.error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {state.error}
          </div>
        )}

        {timedOut && !state?.error && (
          <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              Le serveur n&apos;a pas répondu. <strong>Fermez et regardez la liste avant de
              recommencer</strong> : l&apos;enregistrement a pu aboutir, et un second envoi
              créerait un doublon.
            </span>
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
