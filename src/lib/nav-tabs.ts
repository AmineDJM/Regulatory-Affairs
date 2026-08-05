import { userCan, type SessionUser } from "@/lib/rbac";
import { featureEnabled } from "@/lib/features";
import type { NavTab } from "@/lib/labels";
import type { ModuleTab } from "@/components/shared/module-tabs";

/**
 * Onglets réellement visibles pour une personne : droits RBAC **et** stade de version.
 *
 * Un onglet marqué `feature` appartient à une nouveauté : il n'apparaît qu'aux comptes qui
 * la voient (stade TEST → comptes en mode test ; stade PROD → tout le monde). C'est ce qui
 * permet de livrer un écran sans l'imposer, puis de le valider d'un clic depuis
 * Administration › Versions.
 */
export async function visibleTabs(user: SessionUser, tabs: NavTab[]): Promise<ModuleTab[]> {
  return Promise.all(
    tabs.map(async (t) => ({
      label: t.label,
      href: t.href,
      show: userCan(user, t.module, "VIEW") && (t.feature ? await featureEnabled(t.feature, user.id) : true),
    })),
  );
}
