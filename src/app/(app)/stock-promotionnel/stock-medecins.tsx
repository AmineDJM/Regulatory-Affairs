"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PageStock } from "@/lib/queries/promo-stock";
import { date, nombre, nomDe, Section, Vide } from "./stock-commun";

/**
 * « REMIS AUX MÉDECINS » (§118.166, §118.173) — au bout de la chaîne « du devis au cadeau ».
 *
 * Le matériel arrive chez un médecin par DEUX portes, et deux seulement (décision de la Direction,
 * 01/10) : les tournées des KAM — le rapport de visite, la visite imprévue, la saisie rapide de
 * « Ma journée » — et les postes « Matériel du stock » des opérations Ad & Pro (sponsoring,
 * événement, prise en charge), confirmés après l'événement. Cet écran les MONTRE toutes deux et
 * n'en ouvre aucune troisième : une remise se dit là où elle a eu lieu, jamais ici. Un banc tient
 * cette règle sur la source (`remises-sources.test.ts`).
 *
 * Le périmètre est celui du journal : chacun ne voit que les remises des détenteurs qu'il a le droit
 * de voir — le chargeur ne lui a envoyé que celles-là. Les remises d'une opération sortent du
 * MAGASIN : elles ne sont envoyées qu'à qui le voit. Chaque liste est bornée et le DIT : une coupe
 * silencieuse se lirait comme un historique complet (§118.60).
 */
export function VueMedecins({ page }: { page: PageStock }) {
  const [q, setQ] = React.useState("");
  const plie = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const liste = q.trim()
    ? page.remisesAuxMedecins.filter((m) => plie(`${m.medecin} ${m.institution ?? ""}`).includes(plie(q.trim())))
    : page.remisesAuxMedecins;

  return (
    <div className="space-y-4">
      <Section
        titre="Lors des visites"
        aide="Ce que chaque praticien a reçu pendant les tournées, net des corrections. Une remise se dit dans le rapport de visite (ou la visite imprévue, ou « Ma journée ») et s'y corrige, dans les 48 h."
        compte={page.remisesAuxMedecins.length}
      >
        {page.remisesAuxMedecins.length === 0 ? (
          <Vide>Aucune remise à un médecin dans votre périmètre. Elles s&apos;enregistrent dans le rapport de visite, bloc « Matériel remis ».</Vide>
        ) : (
          <>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
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
                      {m.institution && <p className="break-words text-xs text-muted-foreground">{m.institution}</p>}
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

      {page.remisesOperations !== null && (
        <Section
          titre="Lors des opérations Ad & Pro"
          aide="Le matériel d'un sponsoring, d'un événement ou d'une prise en charge : réservé à l'accord du poste « Matériel du stock », confirmé après l'événement depuis la fiche de la demande — ce qui a été remis y est dit, et le reste revient au magasin."
          compte={page.remisesOperations.length}
        >
          {page.remisesOperations.length === 0 ? (
            <Vide>Aucun matériel remis lors d&apos;une opération Ad &amp; Pro. Il se confirme depuis le poste « Matériel du stock » de la demande, après l&apos;événement.</Vide>
          ) : (
            <>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {page.remisesOperations.map((o) => (
                  <li key={o.ligneId} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <Link href={o.lien} className="break-words font-medium text-primary hover:underline">{o.demande}</Link>
                      <p className="mt-0.5 break-words text-sm text-foreground">{nombre(o.quantite)} {o.libelle}</p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground sm:text-right">
                      {o.confirmeeParId && <>confirmé par {nomDe(page, o.confirmeeParId)}<br /></>}
                      {o.confirmeeLe ? <>le {date(o.confirmeeLe)}</> : null}
                    </p>
                  </li>
                ))}
              </ul>
              {page.remisesOperationsNonAffichees > 0 && (
                <p className="text-xs text-muted-foreground">
                  {nombre(page.remisesOperationsNonAffichees)} autre(s) remise(s), plus ancienne(s), ne sont pas affichées ici : la liste montre les {nombre(page.remisesOperations.length)} plus récentes.
                </p>
              )}
            </>
          )}
        </Section>
      )}
    </div>
  );
}
