/** Shared result type returned by all server actions. */
export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

/** Helpers for parsing FormData values inside server actions. */
export function fdStr(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  const s = v ? String(v).trim() : "";
  return s.length ? s : null;
}

export function fdNum(formData: FormData, key: string): number | null {
  const s = fdStr(formData, key);
  if (s === null) return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export function fdDate(formData: FormData, key: string): Date | null {
  const s = fdStr(formData, key);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fdBool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}
