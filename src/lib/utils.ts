import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as a currency amount (default DZD, the local pharma market). */
export function formatCurrency(
  value: number | string | null | undefined,
  currency = "DZD",
  locale = "fr-FR",
) {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(num);
}

/** Compact number formatting, e.g. 12 500 → 12,5 k. */
export function formatCompact(value: number | null | undefined, locale = "fr-FR") {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, locale = "fr-FR") {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(locale).format(value);
}

/** Format a date in the French locale. */
export function formatDate(
  value: Date | string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" },
) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", opts).format(date);
}

export function formatDateTime(value: Date | string | null | undefined) {
  return formatDate(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Relative day delta: negative = overdue, positive = upcoming. */
export function daysUntil(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Initials for avatar chips. */
export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Safely convert Prisma Decimal | number | string to a JS number. */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const n = Number(value.toString());
  return Number.isNaN(n) ? 0 : n;
}

/** Percentage with clamping, used by progress bars. */
export function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}
