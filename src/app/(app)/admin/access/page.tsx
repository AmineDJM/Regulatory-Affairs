import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, defaultScope, MODULES, type Action, type Module } from "@/lib/rbac";
import { MODULE_LABELS, ROLE_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleAccessGrid, type AccessUser, type UserModuleState } from "./module-access-grid";
import { BackLink } from "@/components/shared/back-link";

const ROW_SCOPED: Module[] = ["REGULATORY", "SALES", "MEDICAL", "BUSINESS_DEVELOPMENT"];
const ACTION_FR: Record<string, string> = {
  VIEW: "Voir", CREATE: "Créer", UPDATE: "Modifier", DELETE: "Supprimer",
  VALIDATE: "Valider", EXPORT: "Exporter", UPLOAD: "Upload",
};

export const dynamic = "force-dynamic";

export default async function AccessByModulePage() {
  await requireModule("ADMIN", "UPDATE");

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
        ? def.filter((a) => a !== "VIEW").map((a) => ACTION_FR[a]).join(", ") || "Voir seulement"
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
      byModule[module] = { mode, actions, scope, rowScoped: ROW_SCOPED.includes(module), roleSummary };
    }
    return { id: u.id, name: u.name, role: ROLE_LABELS[u.role] ?? u.role, byModule };
  });

  const modules = MODULES.map((m) => ({ value: m, label: MODULE_LABELS[m] ?? m }));

  return (
    <div className="space-y-5">
      <BackLink href="/admin">
        <ArrowLeft className="h-4 w-4" /> Administration
      </BackLink>
      <PageHeader
        title="Accès par module"
        description="Vue façon Google Drive : choisissez un module, voyez qui peut voir / modifier / supprimer, et ajustez. Complète la fiche d'accès par employé."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Qui peut quoi sur ce module</CardTitle>
        </CardHeader>
        <CardContent>
          <ModuleAccessGrid modules={modules} users={accessUsers} />
        </CardContent>
      </Card>
    </div>
  );
}
