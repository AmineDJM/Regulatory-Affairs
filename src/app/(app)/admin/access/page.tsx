import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, defaultScope, MODULES, ACTIONS, type Action, type Module } from "@/lib/rbac";
import { buildAccessSheet, type PermissionMatrix } from "@/lib/rbac-sheet";
import { MODULE_LABELS, ROLE_LABELS, ACTION_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleAccessGrid, type AccessUser, type UserModuleState, type PipelineConfig } from "./module-access-grid";
import { getAppSettings } from "@/lib/settings";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

/**
 * ACCÈS PAR MODULE — la feuille se DÉDUIT des droits réels.
 *
 * Ni les colonnes d'actions ni les modules « à lignes » ne sont écrits ici : ils sortent de
 * `PERMISSIONS` et de `defaultScope`, c'est-à-dire des règles qui gouvernent l'application.
 * Une liste recopiée finit toujours par mentir — elle propose une case qui n'ouvre rien, ou
 * oublie un module ajouté la semaine dernière — et cela ne se voit jamais à l'écran.
 */
export default async function AccessByModulePage() {
  const admin = await requireModule("ADMIN", "UPDATE");

  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: { access: true },
    orderBy: { name: "asc" },
  });

  const accessUsers: AccessUser[] = users.map((u) => {
    const overrideMap = new Map(u.access.map((a) => [a.module, a]));
    const byModule: Record<string, UserModuleState> = {};
    for (const module of MODULES) {
      const ov = overrideMap.get(module);
      const def = PERMISSIONS[u.role]?.[module] ?? [];
      const roleSummary = def.length
        ? def.filter((a) => a !== "VIEW").map((a) => ACTION_LABELS[a]).join(", ") || "Voir seulement"
        : "Aucun accès";
      const actions: Record<string, boolean> = {};
      let mode: UserModuleState["mode"] = "DEFAULT";
      let scope: "ALL" | "ASSIGNED" = defaultScope(u.role, module);
      if (ov) {
        mode = ov.canView ? "CUSTOM" : "BLOCKED";
        actions.CREATE = ov.canCreate; actions.UPDATE = ov.canUpdate; actions.DELETE = ov.canDelete;
        actions.VALIDATE = ov.canValidate; actions.EXPORT = ov.canExport; actions.UPLOAD = ov.canUpload;
        scope = ov.scope;
      } else {
        for (const a of def) if (a !== "VIEW") actions[a as Action] = true;
      }
      byModule[module] = { mode, actions, scope, roleSummary };
    }
    return { id: u.id, name: u.name, role: ROLE_LABELS[u.role] ?? u.role, byModule };
  });

  // LA FEUILLE, DÉDUITE. Les rôles porteurs sont ceux de la matrice elle-même : ajouter un rôle
  // à l'application le fait entrer ici sans qu'on y touche.
  // LES MODULES HORS SERVICE entrent dans la feuille : un module masqué prime sur tous les
  // droits, et l'écran qui règle les droits est le seul endroit où l'on a besoin de le savoir.
  const settings = await getAppSettings().catch(() => null);
  const hiddenModules = settings?.hiddenModules ?? [];

  // LES ACCÈS AU PIPELINE, sur la ligne de la personne. Ce n'est pas un droit du module
  // Regulatory — c'est une confidence accordée nommément ou par rôle — mais c'est ICI qu'on la
  // cherche : « les accès » se règlent dans l'écran des accès, pas au fond d'une page de réglages.
  // Ce qui vient d'un RÔLE est affiché verrouillé plutôt que masqué : décocher sans effet est le
  // défaut qui fait conclure que l'écran ne marche pas.
  const roleGrants = (roles: string[], u: (typeof users)[number]) =>
    roles.some((r) => r === u.role || (u.secondaryRole ? r === u.secondaryRole : false));
  const pipeline: PipelineConfig | undefined = settings && admin.role === "SUPER_ADMIN"
    ? {
        canEdit: true,
        viewerRoles: settings.pipelineViewerRoles,
        managerRoles: settings.pipelineManagerRoles,
        byUser: Object.fromEntries(users.map((u) => [u.id, {
          view: settings.pipelineViewerUserIds.includes(u.id),
          manage: settings.pipelineManagerUserIds.includes(u.id),
          viewViaRole: roleGrants(settings.pipelineViewerRoles, u),
          manageViaRole: roleGrants(settings.pipelineManagerRoles, u),
        }])),
      }
    : undefined;
  const sheet = buildAccessSheet(
    MODULES,
    MODULE_LABELS as Record<string, string>,
    PERMISSIONS as unknown as PermissionMatrix,
    ACTIONS,
    Object.keys(PERMISSIONS),
    (role, module) => defaultScope(role as Parameters<typeof defaultScope>[0], module as Module),
    hiddenModules,
  );

  return (
    <div className="space-y-5">
      <BackLink href="/admin">
        <ArrowLeft className="h-4 w-4" /> Administration
      </BackLink>
      <PageHeader
        title="Accès par module"
        description="Choisissez un module, voyez qui peut voir / modifier / supprimer, et ajustez. Les colonnes affichées sont celles que ce module autorise réellement — pas une liste figée."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Qui peut quoi sur ce module</CardTitle>
        </CardHeader>
        <CardContent>
          <ModuleAccessGrid modules={sheet} users={accessUsers} actionLabels={ACTION_LABELS} pipeline={pipeline} />
        </CardContent>
      </Card>
    </div>
  );
}
