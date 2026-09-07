"use client";

import * as React from "react";
import { Mail, Phone, User2, MapPin, ChevronDown } from "lucide-react";
import type { PartyOption } from "@/lib/contacts/parties";
import { cn } from "@/lib/utils";

/**
 * LE NOM D'UNE PARTIE, QUI S'OUVRE.
 *
 * Ce qui s'affiche est le nom seul — une fiche de contrat ou un registre de courriers n'a pas à
 * porter un pavé de coordonnées sur chaque ligne. Mais le jour où il faut joindre l'imprimeur,
 * on ne veut pas partir le chercher : un clic, et le mail, les téléphones et la personne à
 * demander sont là, cliquables.
 *
 * Sans contact rattaché (pièce d'avant l'annuaire), on affiche le texte tel quel, sans faux
 * bouton : promettre une fiche qui n'existe pas est pire que de ne rien promettre.
 */
export function PartyLink({ parties, fallback, className }: {
  parties: PartyOption[];
  /** Le nom tel qu'il a été enregistré, quand aucune partie d'annuaire n'est rattachée. */
  fallback?: string | null;
  className?: string;
}) {
  const [ouvert, setOuvert] = React.useState<string | null>(null);
  if (parties.length === 0) {
    const texte = (fallback ?? "").trim();
    return <span className={cn("text-muted-foreground", className)}>{texte || "—"}</span>;
  }
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 gap-y-1", className)}>
      {parties.map((p, i) => (
        <span key={p.id} className="relative inline-flex items-center">
          <button type="button" onClick={() => setOuvert((o) => (o === p.id ? null : p.id))}
            aria-expanded={ouvert === p.id} title="Voir le mail et le contact"
            className="inline-flex items-center gap-0.5 font-medium text-foreground hover:underline">
            {p.name}
            <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", ouvert === p.id && "rotate-180")} />
          </button>
          {i < parties.length - 1 && <span className="text-muted-foreground">,</span>}
          {ouvert === p.id && <Coordonnees p={p} />}
        </span>
      ))}
    </span>
  );
}

function Coordonnees({ p }: { p: PartyOption }) {
  const lignes: { Icone: typeof Mail; value: string; href?: string }[] = [];
  if (p.contactName) lignes.push({ Icone: User2, value: p.contactName });
  if (p.email) lignes.push({ Icone: Mail, value: p.email, href: `mailto:${p.email}` });
  if (p.phone) lignes.push({ Icone: Phone, value: p.phone, href: `tel:${p.phone.replace(/\s/g, "")}` });
  if (p.phoneAlt) lignes.push({ Icone: Phone, value: p.phoneAlt, href: `tel:${p.phoneAlt.replace(/\s/g, "")}` });
  if (p.city) lignes.push({ Icone: MapPin, value: p.city });
  return (
    <span className="absolute left-0 top-full z-20 mt-1 block w-64 space-y-1 rounded-lg border border-border bg-popover p-2.5 text-xs font-normal shadow-lg">
      <span className="block font-medium text-foreground">{p.name}</span>
      {p.kind && <span className="block text-muted-foreground">{p.kind}</span>}
      {lignes.length === 0 ? (
        <span className="block text-muted-foreground">Aucune coordonnée enregistrée — complétez sa fiche dans l&apos;annuaire.</span>
      ) : lignes.map((l, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <l.Icone className="h-3 w-3 shrink-0 text-muted-foreground" />
          {l.href
            ? <a href={l.href} className="min-w-0 flex-1 truncate text-primary hover:underline">{l.value}</a>
            : <span className="min-w-0 flex-1 truncate">{l.value}</span>}
        </span>
      ))}
    </span>
  );
}
