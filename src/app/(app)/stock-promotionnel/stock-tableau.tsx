"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";
import { GENRE_ALERTE_LABEL, STATUT_REFONTE_LABEL, peutDeciderRefonte, type GenreAlerte } from "@/lib/promo/comptages";
import { FAMILLE_LABEL } from "@/lib/promo/catalogue";
import type { RefonteVue } from "@/lib/queries/promo-stock";
import { Chiffre, Section, Vide, date, nombre, nomDe } from "./stock-commun";
import type { Ctx } from "./stock-vues";

/**
 * LE TABLEAU DE BORD DU STOCK (§118.168) — la valeur, ce qui sort, ce qui dort, ce qui alerte, et
 * les supports durables qu'on propose de refaire.
 *
 * Il répond à des questions de PILOTAGE (« combien vaut ce qu'on a ? », « qu'est-ce qui ne sert
 * plus ? ») ; les vues Magasin et Générale répondent à « où est chaque unité ? ». Les alertes sont
 * celles que le battement envoie — le même chargeur, la même règle —, au périmètre que la personne
 * voit. Une valeur qui tairait les unités sans coût se lirait comme la valeur du stock entier :
 * elles sont comptées à part, et le chiffre le dit.
 */

const TON_GENRE: Record<GenreAlerte, "danger" | "warning" | "info"> = {
  RUPTURE: "danger",
  PERIME: "danger",
  COMPTAGE: "warning",
  SEUIL: "warning",
  PEREMPTION: "warning",
  EN_ROUTE: "info",
  SUPPORT: "info",
};

const ORDRE_GENRE: GenreAlerte[] = ["RUPTURE", "PERIME", "SEUIL", "PEREMPTION", "COMPTAGE", "EN_ROUTE", "SUPPORT"];
const TON_REFONTE = { OUVERTE: "info", RETENUE: "success", ECARTEE: "neutral" } as const;

export function VueTableau({ ctx }: { ctx: Ctx }) {
  const { page } = ctx;
  const t = page.tableau;
  if (!t) return <Vide>Le tableau de bord est réservé à la Direction Marketing, à la vue globale du stock et au Super Admin.</Vide>;
  const enRetard = page.comptages.filter((c) => c.enRetard).length;
  const enAttente = page.comptages.filter((c) => c.statut === "DEMANDE").length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Chiffre
          label="Valeur du stock" ton="info" valeur={formatCurrency(t.valeur.valeur)}
          aide="Les soldes en main (magasin et personnes que vous voyez), au coût de leur lot."
        />
        <Chiffre
          label="Unités sans coût connu" valeur={nombre(t.valeur.unitesSansCout)} ton={t.valeur.unitesSansCout > 0 ? "alerte" : "neutre"}
          aide="Elles ne sont pas comptées dans la valeur — renseignez le coût de leur lot depuis sa fiche."
        />
        <Chiffre label={`Remis aux médecins (${t.fenetreJours} j)`} valeur={nombre(t.consommation.remisMedecins)} aide="Net des remises corrigées." />
        <Chiffre label={`Remis en événements (${t.fenetreJours} j)`} valeur={nombre(t.consommation.remisEvenements)} aide="Confirmé après l'événement : remis, abîmé ou perdu." />
        <Chiffre label={`Pertes et casse (${t.fenetreJours} j)`} valeur={nombre(t.consommation.pertes)} ton={t.consommation.pertes > 0 ? "alerte" : "neutre"} />
        <Chiffre
          label={`Écarts de comptage (${t.fenetreJours} j)`} valeur={`${t.consommation.ecartsComptage > 0 ? "+" : ""}${nombre(t.consommation.ecartsComptage)}`}
          ton={t.consommation.ecartsComptage < 0 ? "danger" : "neutre"} aide="Ce que les comptages ont corrigé au registre : négatif = manquant."
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {t.parFamille.map((p) => (
          <div key={p.famille} className="surface flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-3 text-sm">
            <span className="font-medium text-foreground">{FAMILLE_LABEL[p.famille]}s</span>
            <span className="min-w-0 text-right tabular-nums text-muted-foreground">
              {nombre(p.unites)} unité(s) · <span className="font-semibold text-foreground">{formatCurrency(p.valeur)}</span>
            </span>
          </div>
        ))}
      </div>

      <Section
        titre="Alertes en vigueur" compte={t.alertes.length}
        aide="Chacune est notifiée une fois, à son apparition, à la personne concernée — et disparaît d'elle-même quand l'état cesse."
      >
        {t.alertes.length === 0 ? <Vide>Aucune alerte : pas de rupture, rien sous le seuil, rien qui expire dans 30 jours, aucun envoi ni comptage en souffrance.</Vide> : (
          <ul className="space-y-1.5">
            {[...t.alertes]
              .sort((a, b) => ORDRE_GENRE.indexOf(a.genre) - ORDRE_GENRE.indexOf(b.genre))
              .map((a) => (
                <li key={a.cle} className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex min-w-0 items-start gap-2">
                    <Badge tone={TON_GENRE[a.genre]} className="shrink-0">{GENRE_ALERTE_LABEL[a.genre]}</Badge>
                    <span className="min-w-0 break-words">{a.texte}</span>
                  </span>
                  <a href={a.lien} className="inline-flex min-h-9 shrink-0 items-center gap-1 self-start text-xs font-medium text-primary hover:underline sm:min-h-0 sm:self-auto">
                    Ouvrir <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </li>
              ))}
          </ul>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section titre={`Les plus distribués (${t.fenetreJours} jours)`} aide="Remis aux médecins et en événements, net des corrections.">
          {t.topConsommes.length === 0 ? <Vide>Rien n'est sorti sur la période.</Vide> : (
            <TableArticles lignes={t.topConsommes.map((x) => ({ id: x.itemId, libelle: x.libelle, colonnes: [`${nombre(x.quantite)} ${x.unite}`] }))} entetes={["Distribué"]} />
          )}
        </Section>

        <Section
          titre="Articles dormants" compte={t.dormantsTotal}
          aide={`Du stock en main, et aucune remise, aucun envoi, aucune réservation depuis ${t.fenetreJours} jours (un arrivage récent n'est jamais compté dormant).`}
        >
          {t.dormants.length === 0 ? <Vide>Aucun article dormant.</Vide> : (
            <>
              <TableArticles
                entetes={["En main", "Dernière sortie", "Valeur"]}
                lignes={t.dormants.map((d) => ({
                  id: d.itemId, libelle: d.libelle,
                  colonnes: [`${nombre(d.quantite)} ${d.unite}`, d.derniereSortie ? date(d.derniereSortie) : "jamais", d.valeur == null ? "coût inconnu" : formatCurrency(d.valeur)],
                }))}
              />
              {t.dormantsTotal > t.dormants.length && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Les {t.dormants.length} plus gros sont affichés, sur {nombre(t.dormantsTotal)} articles dormants.
                </p>
              )}
            </>
          )}
        </Section>
      </div>

      <Section
        titre="Comptages"
        compte={enAttente}
        aide="Le détail est dans l'onglet « Comptages »."
      >
        <p className="text-sm text-muted-foreground">
          {enAttente === 0 ? "Aucun comptage en attente." : `${enAttente} comptage(s) en attente de saisie${enRetard > 0 ? `, dont ${enRetard} en retard` : ""}.`}
        </p>
      </Section>

      <BlocRefontes refontes={page.refontes} ctx={ctx} />
    </div>
  );
}

function TableArticles({ lignes, entetes }: { lignes: { id: string; libelle: string; colonnes: string[] }[]; entetes: string[] }) {
  return (
    <Table mobileCards className="sm:min-w-[420px]">
      <TableHeader>
        <TableRow>
          <TableHead>Article</TableHead>
          {entetes.map((e) => <TableHead key={e} className="text-right">{e}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((l) => (
          <TableRow key={l.id}>
            <TableCell data-sans-etiquette className="font-medium sm:py-1.5 sm:font-normal"><span className="w-full">{l.libelle}</span></TableCell>
            {l.colonnes.map((c, i) => <TableCell key={i} className="whitespace-nowrap text-right tabular-nums sm:py-1.5">{c}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** LES PROPOSITIONS DE REFONTE — la Direction Marketing (ou le Super Admin) les retient ou les écarte. */
export function BlocRefontes({ refontes, ctx }: { refontes: RefonteVue[]; ctx: Ctx }) {
  const { page, f } = ctx;
  const decide = peutDeciderRefonte(f);
  const ouvertes = refontes.filter((r) => r.statut === "OUVERTE");
  const tranchees = refontes.filter((r) => r.statut !== "OUVERTE");
  return (
    <Section
      titre="Refontes proposées"
      compte={ouvertes.length}
      aide="Un support durable usé ou dépassé, signalé par qui l'utilise. Retenir ne commande rien : la commande passe ensuite par le circuit d'achat."
    >
      {refontes.length === 0 ? <Vide>Aucune proposition de refonte.</Vide> : (
        <ul className="space-y-2">
          {[...ouvertes, ...tranchees].map((r) => (
            <li key={r.id} className={cn("flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between", r.statut !== "OUVERTE" && "opacity-80")}>
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-foreground">
                  {r.libelle}
                  <Badge tone={TON_REFONTE[r.statut]} className="ml-2 align-middle">{STATUT_REFONTE_LABEL[r.statut]}</Badge>
                </p>
                <p className="break-words text-xs text-muted-foreground">
                  « {r.motif} » · {nomDe(page, r.auteurId)}, le {date(r.createdAt)}
                  {r.statut !== "OUVERTE" && r.decideParId ? ` · ${STATUT_REFONTE_LABEL[r.statut].toLowerCase()} par ${nomDe(page, r.decideParId)}` : ""}
                  {r.noteDecision ? ` : « ${r.noteDecision} »` : ""}
                </p>
              </div>
              {decide && r.statut === "OUVERTE" && (
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="success" onClick={() => ctx.ouvrir({ type: "deciderRefonte", refonte: r, decision: "RETENUE" })}>Retenir</Button>
                  <Button size="sm" variant="ghost" onClick={() => ctx.ouvrir({ type: "deciderRefonte", refonte: r, decision: "ECARTEE" })}>Écarter</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
