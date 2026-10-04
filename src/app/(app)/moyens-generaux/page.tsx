import { notFound } from "next/navigation";
import { Wallet } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { getGeneralMeans, resolveGeneralMeansDepartment, LIST_LIMIT } from "@/lib/queries/general-means";
import { getAppSettings } from "@/lib/settings";
import { generalMeansBudgetTargets } from "@/lib/general-means/budget-targets";
import { normalizeYear, DEPT_BUDGET_LABEL, budgetHealth, consumedPercent } from "@/lib/department-budget";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/utils";
import { CashPanel } from "./cash-panel";
import { ExpensePanel } from "./expense-panel";
import { ServiceSwitch, ChangerDeService } from "./service-switch";
import { SuppliesManager } from "../demandes/supplies-manager";
import { ExpenseTable } from "./expense-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moyens généraux — AMD Internal OS" };

/**
 * MOYENS GÉNÉRAUX — le module qui rassemble ce qui était éparpillé.
 *
 * Le budget vivait dans un tableau, les achats dans les demandes administratives, et l'argent
 * liquide confié à l'assistante nulle part. « Combien a-t-on dépensé ce mois-ci, et me
 * reste-t-il de quoi payer ? » exigeait d'additionner à la main, en espérant n'avoir rien
 * oublié.
 *
 * Un seul écran, une seule notion : LA CAISSE. Elle se lit à deux horizons — la caisse de
 * l'exercice (la dotation de l'année, ce qu'on a le droit de dépenser) et la caisse du mois
 * (l'argent en main aujourd'hui). Ce n'est pas un budget d'un côté et une caisse de l'autre :
 * c'est le même argent, la caisse du mois étant prélevée sur celle de l'exercice. Puis le détail
 * des dépenses avec leurs pièces (où est passé l'argent ?). Chaque dépense porte sa facture ou
 * son bon de paiement — sans pièce, une ligne n'est qu'une affirmation.
 */
export default async function MoyensGenerauxPage({
  searchParams,
}: { searchParams: { year?: string } }) {
  // DEUX VISAGES SUR LE MÊME ÉCRAN, et c'est le sujet de cette page.
  //
  // Demander un achat est un geste de TOUT employé : un délégué qui a besoin de cartouches n'a
  // pas à connaître le circuit ni à écrire à l'assistante. La porte du module s'ouvre donc à
  // tous — mais le BUDGET, lui, reste fermé à qui n'a pas le droit de module. Ce n'est pas de
  // la cachotterie : connaître le reste de l'enveloppe transforme une demande en négociation,
  // et le rôle du demandeur est de dire ce dont il a besoin, pas d'arbitrer une caisse qu'il
  // ne tient pas.
  const user = await requireUser();
  const year = normalizeYear(searchParams.year);
  // PLUS DE PÉRIODE À RÉSOUDRE. La caisse d'avance est CONTINUE : elle ne se ferme pas au
  // changement de mois, et il n'y a donc plus « le mois qu'on regarde » — il y a le fond, fait de
  // toutes les remises non soldées, chacune avec sa date.

  // Le catalogue est proposé à TOUT LE MONDE : c'est lui qui rend la demande possible sans
  // connaître les références internes.
  const articles = await prisma.officeSupplyArticle.findMany({
    where: { active: true },
    select: { id: true, name: true, unit: true, estimatedPrice: true },
    orderBy: { name: "asc" },
  });
  const articleOptions = articles.map((a) => ({
    id: a.id, name: a.name, unit: a.unit, estimatedPrice: a.estimatedPrice ? Number(a.estimatedPrice) : null,
  }));

  // LES DEMANDES D'ACHAT ONT DÉMÉNAGÉ DANS « MON ESPACE » (2026-08).
  //
  // Demander un stylo et tenir la caisse d'un département sont deux métiers. Ce module est
  // celui de ceux qui ACHÈTENT et qui DÉCAISSENT ; demander ce dont on a besoin pour
  // travailler est un geste de tout le monde, au même titre que demander un congé ou une
  // formation. Qui n'a pas la caisse n'a donc plus rien à faire ici — et on le lui dit,
  // avec le chemin, plutôt que de lui laisser une page vide.
  if (!userCan(user, "GENERAL_MEANS", "VIEW")) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Moyens généraux"
          description="Ce module tient la caisse et le budget d'un département. Vos demandes d'achat, elles, se font désormais depuis « Mon espace »."
        />
        <EmptyState
          icon="ShoppingBasket"
          title="Vos demandes d'achat sont dans « Mon espace »"
          description="Demandez ce dont vous avez besoin pour travailler depuis votre espace — le circuit ne change pas : votre responsable valide, et l'achat suit."
        />
      </div>
    );
  }

  // LE SUPER ADMIN DÉSIGNE LE SERVICE — et lui seul (`setGeneralMeansDepartment` le revérifie).
  const pilote = user.role === "SUPER_ADMIN" || user.secondaryRole === "SUPER_ADMIN";
  const serviceCourant = pilote ? (await getAppSettings()).generalMeansDepartmentId : null;
  // La liste des départements ne sert qu'à DÉSIGNER le service (`ChangerDeService`) : elle n'ouvre
  // la caisse d'aucun d'eux. Chargée pour le seul Super Admin.
  const departements = pilote
    ? (await prisma.department.findMany({ select: { id: true, name: true, parent: { select: { name: true } } }, orderBy: { name: "asc" } }))
        .map((d) => ({ id: d.id, libelle: d.parent ? `${d.parent.name} › ${d.name}` : d.name }))
    : [];

  const departmentId = await resolveGeneralMeansDepartment(user);
  if (!departmentId) {
    // UNE ISSUE POUR LE SUPER ADMIN. Sans département à lui et sans service valide (jamais désigné,
    // ou supprimé depuis), il n'avait que « aucun département rattaché » — et le seul geste qui
    // désigne le service vivait sur l'écran d'un département qu'il ne pouvait plus ouvrir.
    if (pilote) {
      return (
        <div className="space-y-5">
          <PageHeader title="Moyens généraux" description="La caisse des moyens généraux de la société — l'exercice et le mois — et ses achats, au même endroit." />
          <EmptyState
            icon="Landmark"
            title={serviceCourant ? "Le service des moyens généraux n'existe plus" : "Aucun service des moyens généraux n'est désigné"}
            description="Choisissez le département qui tient la caisse de la société : c'est elle que tout le monde ouvrira en arrivant ici."
          />
          <ChangerDeService departements={departements} actuel={null} ouvertParDefaut />
        </div>
      );
    }
    return (
      <div className="space-y-5">
        <PageHeader title="Moyens généraux" description="La caisse d'un département — l'exercice et le mois — et ses achats, au même endroit." />
        <EmptyState
          icon="Building2"
          title="Aucun département rattaché à votre compte"
          description="La caisse et le budget se tiennent par département. Demandez aux ressources humaines de rattacher votre fiche employé — vos demandes d'achat, elles, fonctionnent déjà."
        />
      </div>
    );
  }

  const view = await getGeneralMeans(user, departmentId, year);
  if (!view) notFound();

  // UN SEUL SERVICE À L'ÉCRAN, Super Admin compris (décision du 01/10 : « enlève les autres
  // départements, laisse que l'Administration »). Le sélecteur qui lui ouvrait les moyens généraux
  // de chaque département est retiré : pour tout le monde, les moyens généraux sont ceux de la
  // société, et un sélecteur dirait le contraire. Le découpage par département reste la façon dont
  // l'argent est IMPUTÉ — il se lit dans Budgets › par département, lien conservé ci-dessous.
  // Le Super Admin garde ce qui n'appartient qu'à lui : voir QUEL département tient le service,
  // et en désigner un autre (`ChangerDeService`) — sans ouvrir la caisse de cet autre.

  // Les candidats à qui remettre une caisse : seule l'administration a besoin de cette liste.
  const people = view.canAllot
    ? await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  // LE CATALOGUE D'ARTICLES — le même que celui du Bureau du secrétariat, vu d'ici. Deux
  // catalogues auraient produit deux vocabulaires, donc des consommations incomparables.
  // La liste courte alimente les menus déroulants des tickets ; la liste détaillée n'est
  // chargée que pour qui peut la tenir.
  const canManageCatalog = userCan(user, "GENERAL_MEANS", "UPDATE");
  const catalog = canManageCatalog
    ? await prisma.officeSupplyArticle.findMany({
        select: { id: true, name: true, category: true, unit: true, reference: true, estimatedPrice: true, supplierHint: true, active: true, notes: true },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      })
    : [];
  const catalogRows = catalog.map((a) => ({ ...a, estimatedPrice: a.estimatedPrice ? Number(a.estimatedPrice) : null }));

  // LES CASES BUDGÉTAIRES OUVERTES ICI. Liste volontairement pauvre : des destinations, sans
  // montants ni consommation — classer une dépense ne suppose pas d'accéder au module Budget.
  const budgetTargets = view.canSpend ? await generalMeansBudgetTargets() : [];

  const health = budgetHealth(view.allocated, view.consumed);
  const tone = health === "OVER_BUDGET" ? "danger" : health === "AT_RISK" ? "warning" : health === "UNSET" ? "default" : "success";

  return (
    <div className="space-y-5">
      {/* Le département ne figure au titre que pour le Super Admin : c'est lui qui désigne le
          service, il doit voir lequel est en vigueur. Pour les autres, il n'y en a qu'un. */}
      {/* EN-TÊTE : LE CATALOGUE D'ARTICLES, ET LUI SEUL (décision de la Direction, 04/10 : « ne laisser
          dans le header que le catalogue d'articles »). Le reste — la caisse, les dépenses, le choix du
          service — n'a pas été retiré : il vit dans la page, sous l'en-tête. */}
      <PageHeader
        title={pilote ? `Moyens généraux — ${view.department.path}` : "Moyens généraux"}
        description="La caisse à deux horizons — l'exercice (l'année) et le mois — et le détail des dépenses avec leurs justificatifs. Tout achat porte sa facture ou son bon de paiement."
      >
        {canManageCatalog && <SuppliesManager articles={catalogRows} />}
      </PageHeader>

      {/* QUEL DÉPARTEMENT TIENT LES MOYENS GÉNÉRAUX DE LA SOCIÉTÉ — le réglage qui décide où tout le
          monde atterrit. Il n'appartient qu'au Super Admin, et il n'ouvre la caisse d'aucun autre
          département : une seule caisse à l'écran, celle du service désigné (§118.170). */}
      {pilote && (
        <div className="flex flex-wrap items-center gap-2">
          <ServiceSwitch
            departmentId={view.department.id} departmentName={view.department.path}
            current={serviceCourant}
          />
          <ChangerDeService departements={departements} actuel={serviceCourant} />
        </div>
      )}

      {/* TROIS INDICATEURS, PAS QUATRE. « Restant sur l'année » affichait allocation − consommé :
          sans caisse annuelle réglée, cela donnait un « restant » NÉGATIF du montant déjà dépensé
          (« −11 680 DZD »), qui ne veut rien dire pour personne. La consommation de l'année est
          déjà là, avec son pourcentage quand une caisse existe ; le seul reste qui se dépense
          vraiment est celui du mois, juste à côté. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label={`Caisse de l'exercice ${year}`} value={formatCurrency(view.allocated)} icon="Wallet" />
        <KpiCard
          label="Consommé (année)" value={formatCurrency(view.consumed)} icon="Receipt" tone={tone}
          hint={view.allocated > 0 ? `${consumedPercent(view.allocated, view.consumed)} % de la caisse annuelle` : "aucune caisse annuelle réglée"}
        />
        <KpiCard
          label="Reste en caisse d'avance" value={view.cash ? formatCurrency(view.cash.fund.remaining) : "—"} icon="HandCoins"
          tone={view.cash?.fund.overspent ? "danger" : view.cash?.fund.lowOnCash ? "warning" : "info"}
          hint={view.cash
            ? `${view.cash.fund.remittanceCount} remise${view.cash.fund.remittanceCount > 1 ? "s" : ""} en cours`
            : "aucune somme remise"}
        />
      </div>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Caisse d&apos;avance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            La part de la caisse de l&apos;exercice <strong>en main</strong> — pas un budget à côté, le
            <strong> même argent</strong>. Elle est <strong>continue</strong> : chaque remise s&apos;ajoute au fond
            et garde sa date, aucune ne clôt la précédente. La personne qui la détient confirme avoir reçu la
            somme, puis chaque dépense en est déduite, justificatif scanné à l&apos;appui, jusqu&apos;à
            épuisement — moment où elle demande une rallonge.
          </p>
          <CashPanel view={view} people={people} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Toutes les dépenses {year} ({view.expenseCount})</CardTitle>
          {/* La liste MÊLE les natures ; la caisse affichée plus haut, elle, n'en porte
              qu'une. Sans cette phrase, la somme des lignes ne retomberait pas sur le
              « Consommé » et on croirait à une erreur de calcul. */}
          {view.otherConsumed > 0 && (
            <p className="text-xs text-muted-foreground">
              Dont <strong>{formatCurrency(view.otherConsumed)}</strong> imputés à d&apos;autres budgets
              (métier, formation) — non déduits de la caisse des {DEPT_BUDGET_LABEL.OPERATING.toLowerCase()}.
            </p>
          )}
          {view.truncated && (
            <p className="text-xs text-muted-foreground">
              Les {LIST_LIMIT} plus récentes sont affichées ; les totaux ci-dessus portent sur l&apos;année entière.
            </p>
          )}
        </CardHeader>
        {view.canSpend && (
          <CardContent className="pb-0">
            <p className="mb-2 text-xs text-muted-foreground">
              <strong>Un seul endroit pour enregistrer un achat</strong>, qu&apos;il ait été réglé sur la caisse
              du mois ou autrement (virement, carte, facture payée par les Finances). Le moyen de paiement se
              choisit dans le formulaire, et se corrige après coup sur une dépense déjà saisie.
            </p>
            <ExpensePanel
              departmentId={view.department.id} year={year} remaining={view.remaining}
              articles={articleOptions} budgetTargets={budgetTargets}
              cash={view.cash ? {
                // « Reçue » se juge sur le FOND : une remise en attente de confirmation
                // n'empêche pas de dépenser ce qui est déjà en main.
                status: view.cash.fund.received > 0 ? "RECEIVED" : "ALLOTTED",
                remaining: view.cash.fund.remaining,
                // La caisse n'est proposée qu'à qui peut réellement en sortir de l'argent :
                // offrir l'option à quelqu'un d'autre, c'est un refus après la saisie.
                canSpend: view.isHolder || view.canAmendCash,
              } : null}
            />
          </CardContent>
        )}
        <CardContent className="p-0">
          {/* UNE SEULE LISTE, ET ELLE SE FILTRE. Les dépenses payées en liquide s'affichaient
              aussi dans un bloc « Dépenses de la caisse » juste au-dessus : les mêmes achats,
              deux fois, avec deux compteurs. « Caisse d'avance » est devenu un filtre. */}
          <ExpenseTable
            expenses={view.expenses}
            canSpend={view.canSpend}
            canAmendCash={view.canAmendCash}
            articles={articleOptions}
            budgetTargets={budgetTargets}
            cashUsable={Boolean(view.cash && view.cash.fund.received > 0 && (view.isHolder || view.canAmendCash))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
