import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { visibleStockScopes, canRequestStockState, keepVisibleSnapshots } from "@/lib/stocks/scopes";
import { prisma } from "@/lib/prisma";
import { getProductOptions } from "@/lib/queries/stock";
import { platformScope } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { StocksView, type SnapshotDTO } from "./stocks-view";

export default async function StocksPage() {
  const user = await requireModule("STOCKS");
  const canRecord = userCan(user, "STOCKS", "CREATE") || userCan(user, "STOCKS", "UPDATE");
  const canDelete = userCan(user, "STOCKS", "DELETE");
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  // ── QUI VOIT QUEL STOCK ───────────────────────────────────────────────────────────────────
  //
  // PCH et ses ANNEXES sont la chaîne d'approvisionnement ; les HÔPITAUX sont le relevé de
  // terrain. Un délégué médical relève les hôpitaux qu'il visite — il n'a rien à faire dans la
  // position de la centrale d'achat, ni dans celle de ses annexes. La règle est portée par
  // `lib/stocks/scopes.ts` : elle ne nomme aucun rôle, elle lit l'accès à la chaîne.
  const viewer = { canSeeSupplyChain: userCan(user, "PCH", "VIEW"), hasGlobalView: hasGlobalView(user.role), isSuperAdmin };
  const scopes = visibleStockScopes(viewer);
  // Demander un état de stock est une RÉQUISITION adressée à quelqu'un : elle appartient à qui
  // tient la chaîne, jamais à qui y contribue. Le droit de suppression ne l'ouvre plus.
  const canRequest = canRequestStockState(viewer);

  const [products, locations, snapshots, users] = await Promise.all([
    getProductOptions(user),
    prisma.stockAnnex.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } }),
    // Portée VALIDÉE contre les droits, comme Finances et Ad & Pro : le cookie d'entité est une
    // demande, pas une autorisation. Et elle laisse passer les relevés NON RATTACHÉS — un état
    // de stock saisi sans entité doit rester visible (et corrigeable), pas disparaître du
    // graphique dès qu'on sélectionne une société.
    prisma.stockSnapshot.findMany({ where: await platformScope(user.id), orderBy: { date: "asc" }, take: 5000 }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  // Deux listes de lieux nommés (mêmes règles) : hôpitaux et annexes PCH.
  const hospitals = locations.filter((l) => l.kind !== "ANNEX").map((l) => ({ id: l.id, name: l.name }));
  const annexes = locations.filter((l) => l.kind === "ANNEX").map((l) => ({ id: l.id, name: l.name }));

  // LE FILTRE PORTE SUR LES DONNÉES, pas seulement sur les onglets : un relevé PCH qui part dans
  // la charge utile de la page se lit, même sans onglet pour l'afficher.
  const snaps: SnapshotDTO[] = keepVisibleSnapshots(viewer, snapshots).map((s) => ({
    id: s.id, scope: s.scope, annexId: s.annexId, productId: s.productId,
    date: s.date.toISOString(), quantity: s.quantity, mine: s.createdById === user.id,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stocks"
        description="États de stock datés, par produit : PCH (centrale), hôpitaux et annexes PCH. On enregistre simplement « à cette date, il reste X » — la courbe se construit au fil des relevés."
      />
      <StocksView
        products={products.map((p) => ({ id: p.id, label: p.label }))}
        hospitals={hospitals}
        annexes={annexes}
        snapshots={snaps}
        users={users.map((u) => ({ id: u.id, label: u.name }))}
        canRecord={canRecord}
        canDelete={canDelete}
        isSuperAdmin={isSuperAdmin}
        canRequest={canRequest}
        scopes={scopes}
      />
    </div>
  );
}
