"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, FileUp } from "lucide-react";
import type { EntityType } from "@prisma/client";
import { uploadDocument, type ActionResult } from "@/lib/actions/document-actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { DOCUMENT_CATEGORY, CONFIDENTIALITY } from "@/lib/labels";
import { cn } from "@/lib/utils";

interface DocumentUploadProps {
  entityType: EntityType;
  entityId: string;
  categories?: string[]; // restrict category choices for the module
  stepKey?: string; // rattache le document à une étape (Regulatory)
  compact?: boolean; // version condensée (par étape) : pas de zone de glisser-déposer
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || disabled}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
      Téléverser
    </Button>
  );
}

export function DocumentUpload({ entityType, entityId, categories, stepKey, compact }: DocumentUploadProps) {
  const pathname = usePathname();
  const [state, formAction] = useFormState<ActionResult | undefined, FormData>(
    uploadDocument,
    undefined,
  );
  const [dragOver, setDragOver] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.ok) {
      setFileName(null);
      formRef.current?.reset();
    }
  }, [state]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputRef.current.files = dt.files;
      setFileName(file.name);
    }
  }

  const categoryEntries = categories
    ? categories.map((c) => [c, DOCUMENT_CATEGORY[c] ?? c] as const)
    : Object.entries(DOCUMENT_CATEGORY);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="path" value={pathname} />
      {stepKey && <input type="hidden" name="stepKey" value={stepKey} />}

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-center transition-colors",
          compact ? "px-3 py-2.5" : "flex-col px-4 py-6",
          fileName
            ? "border-primary/60 bg-primary/5"
            : dragOver
              ? "border-primary bg-accent/50"
              : "border-border bg-muted/30 hover:bg-muted/50",
        )}
      >
        {fileName ? (
          <>
            <FileUp className={cn("shrink-0 text-primary", compact ? "h-4 w-4" : "h-6 w-6")} />
            {/* Nom du fichier sélectionné : contraste fort + retour à la ligne pour
                rester lisible même quand le nom est long. */}
            <span className={cn("min-w-0 break-words font-semibold text-foreground", compact ? "text-xs" : "max-w-full text-sm")}>
              {fileName}
            </span>
            {!compact && <span className="text-xs text-muted-foreground">Cliquez pour changer de fichier</span>}
          </>
        ) : (
          <>
            <UploadCloud className={cn("text-muted-foreground", compact ? "h-4 w-4" : "h-6 w-6")} />
            <span className={cn("font-medium text-foreground", compact ? "text-xs" : "text-sm")}>
              {compact ? "Joindre un document" : "Glissez un fichier ici ou cliquez pour parcourir"}
            </span>
            {!compact && <span className="text-xs text-muted-foreground">PDF, Word, Excel, images</span>}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          name="file"
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>

      {compact ? (
        <>
          <input type="hidden" name="category" value={categoryEntries[0]?.[0] ?? "OTHER"} />
          <input type="hidden" name="confidentiality" value="INTERNAL" />
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Select name="category" defaultValue={categoryEntries[0]?.[0]} className="text-sm">
            {categoryEntries.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select name="confidentiality" defaultValue="INTERNAL" className="text-sm">
            {Object.entries(CONFIDENTIALITY).map(([value, v]) => (
              <option key={value} value={value}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm">
          {state?.ok && (
            <span className="flex items-center gap-1.5 text-success">
              <CheckCircle2 className="h-4 w-4" /> Document ajouté
            </span>
          )}
          {state?.error && (
            <span className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="h-4 w-4" /> {state.error}
            </span>
          )}
        </div>
        <SubmitButton disabled={!fileName} />
      </div>
    </form>
  );
}
