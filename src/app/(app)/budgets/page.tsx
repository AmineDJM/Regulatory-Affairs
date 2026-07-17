import { requireModule } from "@/lib/session";
import { canManageEnvelopes, canManageEnvelope, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getEnvelopes, getBudgetOverview, getEnvelopesGrandTotal } from "@/lib/queries/budget";
import { getAppSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BudgetBoard, CreateEnvelopeButton, EnvelopesGrandTotalPanel } from "./budget-board";

export const dynamic = "force-dynamic";

export default async function BudgetsPage({ searchParams }: { searchParams: { env?: string; from?: string; to?: string } }) {
  const user = await requireModule("BUDGETS");
  // GOUVERNANCE des accès (créer/modifier/supprimer une enveloppe, régler ses listes d'accès et
  // le budget total) : prérogative Super Admin (délégable via BUDGETS:DELETE). C'est le seul
  // niveau autorisé à décider QUI voit ou gère chaque enveloppe.
  const canManageAccess = canManageEnvelopes(user);

  const [envelopes, settings, grandTotal, users] = await Promise.all([
    getEnvelopes(user),
    getAppSettings(),
    getEnvelopesGrandTotal(user),
    // Liste des comptes : seul un gouverneur des accès peut ouvrir la consultation / déléguer la gestion.
    canManageAccess ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([] as { id: string; name: string }[]),
  ]);
  const from = searchParams.from ? new Date(searchParams.from) : null;
  const to = searchParams.to ? new Date(searchParams.to) : null;
  const overview = await getBudgetOverview(user, searchParams.env ?? null, from, to);

  // GESTION du CONTENU de l'enveloppe affichée (catégories, dépenses budgétaires) : gouverneur
  // global OU personne/rôle que l'admin a délégué sur CETTE enveloppe précise.
  const canManageContent = overview ? canManageEnvelope(user, overview.envelope) : canManageAccess;
  // Attribuer / ajouter une dépense : Direction (vue globale) OU gestionnaire de l'enveloppe.
  const canAttribute = hasGlobalView(user.role) || canManageContent;

  // Budget total au-dessus des enveloppes : figé (FIXED) ou somme des enveloppes
  // actives visibles (FLEXIBLE).
  const flexibleTotal = envelopes.filter((e) => e.isActive).reduce((s, e) => s + e.total, 0);
  const budgetTotal = {
    mode: settings.budgetTotalMode,
    value: settings.budgetTotalMode === "FIXED" ? settings.budgetFixedTotal : flexibleTotal,
    fixed: settings.budgetFixedTotal,
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Budgets" description="Budget total réparti en enveloppes (par module) puis en catégories ; la consommation réelle est calculée sur la période choisie.">
        {canManageAccess && <CreateEnvelopeButton users={users} />}
      </PageHeader>

      {/* Vue consolidée : total de TOUTES les enveloppes accessibles (Super Admin +
          personnes/rôles qu'il a autorisés). */}
      {grandTotal.count > 0 && <EnvelopesGrandTotalPanel data={grandTotal} />}

      {!overview ? (
        <EmptyState
          icon="Wallet"
          title="Aucune enveloppe budgétaire"
          description={canManageAccess ? "Créez une enveloppe : un budget total pour une période, que vous répartirez ensuite en catégories." : "Aucune enveloppe ne vous est ouverte pour le moment."}
        />
      ) : (
        <BudgetBoard overview={overview} envelopes={envelopes} canManage={canManageContent} canManageAccess={canManageAccess} canAttribute={canAttribute} budgetTotal={budgetTotal} users={users} />
      )}
    </div>
  );
}
