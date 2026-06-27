"use client";

import * as React from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/types";
import { cn } from "@/lib/utils";

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
  | { type: "checkbox"; name: string; label: string; full?: boolean };

interface CreateRecordButtonProps {
  label: string;
  title: string;
  description?: string;
  fields: FieldDef[];
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  /** Optional base path; on success navigates to `${redirectBase}/${id}`. */
  redirectBase?: string;
  width?: "md" | "lg";
}

export function CreateRecordButton({
  label,
  title,
  description,
  fields,
  action,
  redirectBase,
  width = "lg",
}: CreateRecordButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [state, formAction] = useFormState<ActionResult | undefined, FormData>(action, undefined);

  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setSubmitting(false);
      router.refresh();
      if (redirectBase && state.id) router.push(`${redirectBase}/${state.id}`);
    } else if (state?.error) {
      setSubmitting(false);
    }
  }, [state, router, redirectBase]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {label}
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title={title} description={description} width={width}>
        <form
          action={(fd) => {
            setSubmitting(true);
            formAction(fd);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                {field.type === "textarea" ? (
                  <Textarea id={field.name} name={field.name} required={field.required} placeholder={field.placeholder} />
                ) : field.type === "select" ? (
                  <Select id={field.name} name={field.name} required={field.required} defaultValue={field.defaultValue}>
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
                    defaultValue={field.defaultValue}
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
