import * as React from "react"; // le banc rend ce composant hors de Next (JSX classique) : React doit être en portée
import Link from "next/link";
import { UserCheck } from "lucide-react";
import { MODULE_LABELS } from "@/lib/labels";
import { bandeauInterim } from "@/lib/hr/stand-in";
import type { InterimEnCours } from "@/lib/rbac";

/**
 * LE BANDEAU DE L'INTÉRIMAIRE (§118.196, lot E4 — audit 360°, M13).
 *
 * Un intérim ouvre des modules et fait trancher des décisions au nom d'une personne absente. Sans ce
 * rappel, rien ne distingue un module PRÊTÉ d'un droit propre, ni une décision prise pour quelqu'un
 * d'une décision ordinaire : la phrase qui le disait (`delegationNotice`) existait, et rien ne
 * l'affichait (§118.50).
 *
 * Pourquoi un bandeau de la coque plutôt qu'une mention par écran : il couvre aussi les MODULES prêtés,
 * qu'aucune carte ne peut signaler ; il est écrit une fois au lieu d'être recopié écran par écran
 * (§118.5) ; il ne coûte AUCUNE lecture — `getAccess` calcule déjà les intérims (`access.interims`) ; et
 * il s'éteint de lui-même avec le congé, parce qu'il n'existe que le temps de la délégation (§118.32).
 * Ce qu'on tranche pour l'absent reste enregistré au nom de qui tranche : le bandeau le dit aussi.
 */
export function InterimBanner({ interims }: { interims: readonly InterimEnCours[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 bg-info px-4 py-1.5 text-center text-xs font-medium text-info-foreground">
      <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {interims.map((i) => (
        <span key={i.absentId}>{bandeauInterim(i, MODULE_LABELS)}</span>
      ))}
      <Link href="/mon-espace" className="underline underline-offset-2 hover:opacity-80">
        Décisions en attente, dans Mon espace
      </Link>
    </div>
  );
}
