import Link from "next/link";
import { requireModule } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { InfoBulle } from "@/components/ui/info-bulle";
import { chargerCockpitOperations, type CockpitOperations, type LigneBuCockpit } from "@/lib/queries/cockpit-operations";
import { moisCourt } from "@/lib/ventes-pch/calculs";
import { SEUIL_RUPTURE_MOIS, SEUIL_VIGILANCE_MOIS, niveauCouverture } from "@/lib/stocks/pch-central";
import { CHEMIN_STOCKS_CHAINE } from "@/lib/chemins/stocks";
import type { ATraiter, CumulLivre } from "@/lib/cockpit-operations/calculs";
import { cn, formatCompact, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cockpit Opérations — AMD Internal OS" };

/**
 * COCKPIT OPÉRATIONS (Direction, 08/10 — maquette v2 validée) : un seul client, la PCH. Cinq tuiles, la table « Par
 * BU », « À traiter ». Lecture seule — chaque ligne mène à l'écran où le geste se fait. Une donnée absente s'affiche
 * « — » avec sa raison (ⓘ) et le lien pour la fournir, jamais comme un zéro.
 */

const MOIS_LONGS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const moisLong = (m: string) => `${MOIS_LONGS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const TON = { ok: "text-success", w: "text-warning", ko: "text-destructive" } as const;

const montant = (c: CumulLivre) => (c.valorise ? `${formatCompact(c.valeur)} DZD` : `${formatNumber(c.boites)} bt`);
const signe = (v: number) => `${v > 0 ? "+" : ""}${v.toLocaleString("fr-FR")} %`;

export default async function CockpitOperationsPage({ searchParams }: { searchParams?: { bu?: string } }) {
  const user = await requireModule("COCKPIT_OPERATIONS");
  const c = await chargerCockpitOperations(user, searchParams?.bu ?? null);
  const lienBu = (id: string | null) => (id ? `/operations?bu=${encodeURIComponent(id)}` : "/operations");

  return (
    <div className="space-y-4">
      <PageHeader title="Cockpit Opérations" description={moisLong(c.moisCourant)}>
        <InfoBulle label="À propos du cockpit">
          Un seul client : la PCH. Les ventes se lisent dans les fichiers de la PCH (Ventes PCH), les marchés dans Marchés PCH,
          les stocks dans la chaîne (Adventum + PCH central + hôpitaux), la couverture terrain dans la Force de vente.
        </InfoBulle>
      </PageHeader>

      {c.bus.length > 1 && (
        <nav className="-mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Business units">
          <Puce href={lienBu(null)} actif={!c.buId}>Toutes les BU</Puce>
          {c.bus.map((b) => <Puce key={b.id} href={lienBu(b.id)} actif={c.buId === b.id}>{b.nom}</Puce>)}
        </nav>
      )}

      <Tuiles c={c} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ParBu c={c} />
        <ListeATraiter items={c.aTraiter} />
      </div>
    </div>
  );
}

// ─────────────────────────── Tuiles ───────────────────────────

function Tuiles({ c }: { c: CockpitOperations }) {
  const lienImport = c.acces.ventes ? { href: "/sales/importer", label: c.acces.importer ? "Importer" : "Voir les imports" } : undefined;
  const { livre, execution, nonServi, ruptures, fdv } = c;

  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
      {!livre.mois ? (
        <Tuile titre="Livré à la PCH (mois)" raison="Aucun fichier de réceptions de la PCH centrale n'a été importé." lien={lienImport} />
      ) : !livre.cumul.lisible ? (
        <Tuile titre="Livré à la PCH (mois)" raison="Aucun de nos produits n'a de fournisseur « à nous » réglé : nos réceptions ne se distinguent pas encore." lien={c.acces.ventes ? { href: "/sales/importer#fournisseurs", label: "Régler" } : undefined} />
      ) : (
        <Tuile titre={`Livré à la PCH · ${moisCourt(livre.mois)}`}
          info="Nos réceptions à la PCH centrale (FO de nos fournisseurs) sur le dernier mois reçu, valorisées au coût d'achat de la PCH ; comparées au même mois de l'année précédente."
          valeur={montant(livre.cumul)}
          pied={livre.evol !== null ? `${signe(livre.evol)} vs ${moisCourt(livre.moisN1!)}` : livre.n1Present ? `rien livré en ${moisCourt(livre.moisN1!)}` : `${moisCourt(livre.moisN1!)} non importé`}
          ton={livre.evol === null ? undefined : livre.evol >= 0 ? "ok" : "ko"} />
      )}

      {execution.pct === null ? (
        <Tuile titre="Exécution des marchés" raison={`Aucun marché ${execution.annee} avec une quantité attribuée.`} lien={c.acces.ventes ? { href: "/sales/contrats", label: "Voir les contrats" } : undefined} />
      ) : (
        <Tuile titre="Exécution des marchés"
          info={`Livré ÷ attribué (avenants compris) sur les marchés en cours en ${execution.annee}, en unités du marché.`}
          valeur={`${execution.pct} %`}
          pied={`${formatNumber(execution.livre)} / ${formatNumber(execution.attribue)} · ${execution.marches} marché${execution.marches > 1 ? "s" : ""}`}
          valeurTon={execution.pct < 50 ? "w" : undefined} />
      )}

      {!nonServi.mois ? (
        <Tuile titre="Demande non servie" raison="Aucun fichier des directions régionales n'a été importé." lien={lienImport} />
      ) : (
        <Tuile titre={`Demande non servie · ${moisCourt(nonServi.mois)}`}
          info="Nos produits commandés par les hôpitaux et livrés à 0 par les directions régionales, sur le dernier mois reçu."
          valeur={formatNumber(nonServi.quantite)} valeurTon={nonServi.quantite > 0 ? "w" : undefined}
          pied={nonServi.quantite > 0 ? `boîtes · ${nonServi.etablissements} établissement${nonServi.etablissements > 1 ? "s" : ""}` : "aucune"} />
      )}

      {ruptures.mesurables === 0 ? (
        <Tuile titre="Ruptures à 60 jours"
          raison={ruptures.produits === 0 ? "Aucun produit de BU avec son dossier." : "Aucune couverture ne se calcule : il manque les stocks de la chaîne ou la consommation (fichiers des DR)."}
          lien={c.acces.chaine ? { href: CHEMIN_STOCKS_CHAINE, label: "Stocks de la chaîne" } : undefined} />
      ) : (
        <Tuile titre="Ruptures à 60 jours"
          info={`Produits dont la couverture de la chaîne (Adventum + PCH central + hôpitaux ÷ consommation mensuelle) est sous ${SEUIL_RUPTURE_MOIS} mois.`}
          valeur={String(ruptures.enRupture)} valeurTon={ruptures.enRupture > 0 ? "ko" : undefined}
          pied={ruptures.mesurables < ruptures.produits ? `sur ${ruptures.mesurables} produits mesurés / ${ruptures.produits}` : "chaîne complète"} />
      )}

      {!fdv.ouvert ? (
        <Tuile titre="Cibles H·A·B vues à fréquence" raison="La Force de vente ne vous est pas ouverte." />
      ) : fdv.horsPerimetre ? (
        <Tuile titre="Cibles H·A·B vues à fréquence" raison="Cette BU n'est pas dans votre périmètre de Force de vente." lien={{ href: "/planning", label: "Force de vente" }} />
      ) : fdv.pct === null ? (
        <Tuile titre="Cibles H·A·B vues à fréquence" raison="Aucune cible H, A ou B dans les panels du périmètre." lien={{ href: "/planning", label: "Force de vente" }} />
      ) : (
        <Tuile titre="Cibles H·A·B vues à fréquence"
          info="Part des praticiens classés H, A ou B dans les panels qui ont reçu leur nombre de visites requis ce cycle (Force de vente)."
          valeur={`${fdv.pct} %`}
          pied={fdv.delta === null ? `${fdv.vues} / ${fdv.cibles} cibles` : `${fdv.delta >= 0 ? "+" : ""}${fdv.delta} pts vs cycle précédent`}
          ton={fdv.delta === null ? undefined : fdv.delta >= 0 ? "ok" : "ko"} />
      )}
    </div>
  );
}

function Tuile({ titre, info, valeur, pied, ton, valeurTon, raison, lien }: {
  titre: string; info?: string; valeur?: string; pied?: string; ton?: keyof typeof TON; valeurTon?: keyof typeof TON;
  raison?: string; lien?: { href: string; label: string };
}) {
  return (
    <div className="surface flex min-w-0 flex-col gap-0.5 rounded-xl px-3.5 py-3">
      <span className="flex items-start justify-between gap-1 text-xs text-muted-foreground">
        {titre}
        {(raison ?? info) && <InfoBulle label={`À propos : ${titre}`}>{raison ?? info}</InfoBulle>}
      </span>
      <strong className={cn("text-[22px] font-semibold tabular-nums", raison ? "text-muted-foreground" : valeurTon && TON[valeurTon])}>{raison ? "—" : valeur}</strong>
      {raison ? (
        lien ? <Link href={lien.href} className="text-xs text-primary hover:underline">{lien.label}</Link> : <span className="text-xs text-muted-foreground">donnée absente</span>
      ) : (
        <span className={cn("text-xs", ton ? TON[ton] : "text-muted-foreground")}>{pied}</span>
      )}
    </div>
  );
}

// ─────────────────────────── Par BU ───────────────────────────

function ParBu({ c }: { c: CockpitOperations }) {
  return (
    <section className="surface min-w-0 rounded-xl">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
          Par BU
          <InfoBulle label="À propos : Par BU">
            Livré : nos réceptions à la PCH sur les 12 derniers mois reçus, face aux 12 mois d&apos;avant. Exécution : livré ÷
            attribué des marchés en cours. Non servi : 12 mois, en boîtes. Couverture : la plus courte d&apos;un produit de la
            BU — rouge sous {SEUIL_RUPTURE_MOIS} mois, orange sous {SEUIL_VIGILANCE_MOIS}.
          </InfoBulle>
        </h2>
      </header>
      {c.parBu.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Aucune Business Unit active.</p>
      ) : (
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">BU</th>
                <th className="px-3 py-2 text-right font-medium">Livré (12 mois)</th>
                <th className="px-3 py-2 text-right font-medium">vs N-1</th>
                <th className="px-3 py-2 font-medium">Exécution marchés</th>
                <th className="px-3 py-2 text-right font-medium">Non servi</th>
                <th className="px-3 py-2 text-right font-medium">Couverture chaîne</th>
              </tr>
            </thead>
            <tbody>
              {c.parBu.map((b) => <LigneBu key={b.id} b={b} />)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LigneBu({ b }: { b: LigneBuCockpit }) {
  const niveau = niveauCouverture(b.couverture?.couverture ?? null);
  const pct = b.execution.pct;
  return (
    <tr className="border-b border-border last:border-0">
      <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">{b.nom}</td>
      <td className="px-3 py-2 text-right tabular-nums">{b.livre12.lisible ? montant(b.livre12) : <span className="text-muted-foreground">—</span>}</td>
      <td className={cn("px-3 py-2 text-right tabular-nums", b.evol12 === null ? "text-muted-foreground" : b.evol12 >= 0 ? "text-success" : "text-destructive")}>{b.evol12 === null ? "—" : signe(b.evol12)}</td>
      <td className="px-3 py-2">
        {pct === null ? <span className="text-muted-foreground">—</span> : (
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary" aria-hidden>
              <span className={cn("block h-full rounded-full", pct < 50 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, pct)}%` }} />
            </span>
            <span className="text-xs tabular-nums">{pct} %</span>
          </span>
        )}
      </td>
      <td className={cn("px-3 py-2 text-right tabular-nums", b.nonServi12 ? "font-medium text-warning" : b.nonServi12 === null ? "text-muted-foreground" : "")}>{b.nonServi12 === null ? "—" : formatNumber(b.nonServi12)}</td>
      <td className={cn("px-3 py-2 text-right tabular-nums", niveau === "rupture" ? "font-semibold text-destructive" : niveau === "vigilance" ? "font-medium text-warning" : niveau ? "" : "text-muted-foreground")}
        title={b.couverture ? b.couverture.label : undefined}>
        {b.couverture?.couverture == null ? "—" : `${b.couverture.couverture.toLocaleString("fr-FR")} mois`}
      </td>
    </tr>
  );
}

// ─────────────────────────── À traiter ───────────────────────────

const POINT: Record<ATraiter["ton"], string> = { ko: "bg-destructive", w: "bg-warning", i: "bg-primary" };

function ListeATraiter({ items }: { items: ATraiter[] }) {
  return (
    <section className="surface min-w-0 rounded-xl">
      <header className="flex items-center gap-1.5 border-b border-border px-4 py-3">
        <h2 className="text-[15px] font-semibold">À traiter</h2>
        <InfoBulle label="À propos : À traiter">
          Calculé sur les données : risque de rupture de la chaîne, BC PCH en retard sur la date prévue, hôpitaux non servis
          alors que la PCH centrale a du stock, avenant à prévoir, fichiers ou relevés manquants, risques d&apos;Adventum Brain
          de votre périmètre. Les plus graves d&apos;abord.
        </InfoBulle>
      </header>
      {items.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Rien à traiter.</p>
      ) : (
        <ul>
          {items.map((x) => (
            <li key={x.cle} className="flex items-start gap-3 border-b border-border px-4 py-2.5 last:border-0">
              <i className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", POINT[x.ton])} aria-hidden />
              <div className="min-w-0 flex-1">
                <b className="block text-sm font-medium [overflow-wrap:anywhere]">{x.titre}</b>
                {x.detail && <small className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{x.detail}</small>}
              </div>
              <Link href={x.href} className="inline-flex h-7 shrink-0 items-center rounded-[var(--radius)] border border-border px-2.5 text-xs font-medium hover:bg-secondary">
                {x.action}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Puce({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={actif ? "page" : undefined}
      className={cn("shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium", actif ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
      {children}
    </Link>
  );
}
