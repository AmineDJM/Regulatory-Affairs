"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Icon } from "@/components/ui/icon";
import type { KindSpec } from "@/lib/ad-pro/unified";

/**
 * « NOUVELLE DEMANDE » — une seule porte.
 *
 * On ne demande pas « quel module ? » mais « qu'est-ce que vous voulez faire ? », et chaque
 * réponse est écrite dans les mots du demandeur : « envoyer un praticien à un congrès à
 * l'étranger », pas « prise en charge internationale ». La différence n'est pas cosmétique — la
 * première phrase se reconnaît, la seconde se traduit.
 *
 * Le choix fait, on emmène vers le formulaire de la nature : il porte les champs propres
 * (billets, visa, devis d'agence…) qu'aucun formulaire commun ne saurait couvrir sans devenir
 * illisible.
 */
export function NewRequestPicker({ kinds }: { kinds: KindSpec[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  if (kinds.length === 0) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nouvelle demande</Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Nouvelle demande Ad & Pro"
        description="Que souhaitez-vous faire ? Le formulaire adapté s'ouvrira ensuite."
      >
        <ul className="space-y-2">
          {kinds.map((k) => (
            <li key={k.kind}>
              <button
                type="button"
                onClick={() => { setOpen(false); router.push(k.createHref); }}
                className="flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <Icon name={k.icon} className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{k.label}</span>
                  <span className="block text-xs text-muted-foreground">{k.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
