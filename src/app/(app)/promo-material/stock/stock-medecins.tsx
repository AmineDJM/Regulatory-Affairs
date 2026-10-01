"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PageStock } from "@/lib/queries/promo-stock";
import { date, nombre, nomDe, Section, Vide } from "./stock-commun";

/**
 * « REMIS AUX MÉDECINS » (§118.166) — l'historique par médecin, au bout de la chaîne « du devis au
 * cadeau ». Une ligne par médecin : ce qu'il a reçu, NET des corrections (une remise reprise dans
 * la fenêtre des 48 h ne compte plus), qui l'a remis, et quand.
 *
 * Le périmètre est celui du journal : chacun ne voit que les remises des détenteurs qu'il a le droit
 * de voir — le chargeur ne lui a envoyé que celles-là. La liste est bornée et le DIT : une coupe
 * silencieuse se lirait comme un historique complet (§118.60).
 */
export function VueMedecins({ page }: { page: PageStock }) {
  const [q, setQ] = React.useState("");
  const plie = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const liste = q.trim()
    ? page.remisesAuxMedecins.filter((m) => plie(`${m.medecin} ${m.institution ?? ""}`).includes(plie(q.trim())))
    : page.remisesAuxMedecins;

  return (
    <Section
      titre="Remis aux médecins"
      aide="Ce que chaque praticien a reçu lors des visites, net des corrections. Un article se remet depuis le rapport de visite ; il se corrige depuis ce même rapport, dans les 48 h."
      compte={page.remisesAuxMedecins.length}
    >
      {page.remisesAuxMedecins.length === 0 ? (
        <Vide>Aucune remise à un médecin dans votre périmètre. Elles s&apos;enregistrent dans le rapport de visite, bloc « Matériel remis ».</Vide>
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Médecin ou établissement…" className="pl-8" aria-label="Chercher un médecin" />
          </div>
          {liste.length === 0 ? (
            <Vide>Aucun médecin ne correspond à « {q.trim()} ».</Vide>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {liste.map((m) => (
                <li key={m.doctorId} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-foreground">{m.medecin}</p>
                    {m.institution && <p className="text-xs text-muted-foreground">{m.institution}</p>}
                    <p className="mt-0.5 break-words text-sm text-foreground">
                      {m.articles.map((a) => `${nombre(a.quantite)} ${a.libelle}`).join(" · ")}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground sm:text-right">
                    {m.delegues.length > 0 && <>par {m.delegues.map((d) => nomDe(page, d)).join(", ")}<br /></>}
                    dernier mouvement le {date(m.dernier)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {page.remisesNonAffichees > 0 && (
            <p className="text-xs text-muted-foreground">
              {nombre(page.remisesNonAffichees)} autre(s) médecin(s), plus ancien(s), ne sont pas affichés ici : la liste montre les {nombre(page.remisesAuxMedecins.length)} plus récents.
            </p>
          )}
        </>
      )}
    </Section>
  );
}
