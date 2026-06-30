"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";

/**
 * Sélecteur qui navigue vers `?<param>=<valeur>` (en conservant les autres
 * paramètres). Utilisé pour les longues listes (classes, laboratoires, DCI) des
 * pages d'intelligence marché — préférable à des dizaines de puces.
 */
export function SelectNav({ param, value, options, placeholder, extra }: {
  param: string;
  value: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  /** Paramètres à conserver/forcer lors de la navigation (ex. { mode: "lab" }). */
  extra?: Record<string, string>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  return (
    <Select
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(sp.toString());
        next.set(param, e.target.value);
        for (const [k, v] of Object.entries(extra ?? {})) next.set(k, v);
        router.push(`?${next.toString()}`);
      }}
      className="max-w-md text-sm"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </Select>
  );
}
