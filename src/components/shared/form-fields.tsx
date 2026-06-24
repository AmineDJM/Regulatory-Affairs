import * as React from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children?: React.ReactNode;
}

export function Field({ label, name, required, hint, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TextField(props: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Field label={props.label} name={props.name} required={props.required} hint={props.hint} className={props.className}>
      <Input
        id={props.name}
        name={props.name}
        type={props.type ?? "text"}
        required={props.required}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
      />
    </Field>
  );
}

export function TextAreaField(props: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field label={props.label} name={props.name} required={props.required} className={props.className}>
      <Textarea
        id={props.name}
        name={props.name}
        required={props.required}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
      />
    </Field>
  );
}

export function SelectField(props: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field label={props.label} name={props.name} required={props.required} className={props.className}>
      <Select id={props.name} name={props.name} required={props.required} defaultValue={props.defaultValue}>
        {props.placeholder && <option value="">{props.placeholder}</option>}
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Build select options from a label map ({ KEY: "Label" } or { KEY: { label } }). */
export function optionsFromMap(
  map: Record<string, string | { label: string }>,
): { value: string; label: string }[] {
  return Object.entries(map).map(([value, v]) => ({
    value,
    label: typeof v === "string" ? v : v.label,
  }));
}
