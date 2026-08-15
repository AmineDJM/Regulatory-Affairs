import { handle } from "@/lib/api/http";
import { MODULES, ACTIONS, PERMISSIONS, userCan } from "@/lib/rbac";
import { NAVIGATION } from "@/lib/labels";
import { ENTITIES } from "@/lib/api/registry/entities";
import { SCOPES, SCOPE_DESCRIPTIONS, READ_ONLY_SCOPES } from "@/lib/api/scopes";

/**
 * DÉCOUVERTE — ce que l'ERP contient, et ce que CE client peut en faire.
 *
 * Un agent ne doit pas dépendre d'une documentation écrite à la main pour savoir de quoi
 * l'ERP est fait. La réponse est donc calculée : modules réels, droits RÉELS de l'identité au
 * nom de laquelle l'agent agit, objets exposés. « Je peux » et « je ne peux pas » y sont
 * explicites — c'est ce qui évite à l'agent de tenter une action vouée au refus.
 */
export const GET = handle({ operationId: "list_modules", scopes: ["erp.read"] }, async ({ ctx }) => ({
  actingAs: { userId: ctx.user.id, role: ctx.user.role, secondaryRole: ctx.user.secondaryRole ?? null },
  client: { name: ctx.client.name, scopes: ctx.client.scopes, readOnly: ctx.client.readOnly },
  scopeCatalog: SCOPES.map((s) => ({ scope: s, description: SCOPE_DESCRIPTIONS[s], granted: ctx.client.scopes.includes(s) })),
  readOnlyProfile: READ_ONLY_SCOPES,
  rbacActions: ACTIONS,
  modules: MODULES.map((m) => {
    const nav = NAVIGATION.find((n) => n.module === m);
    return {
      module: m,
      label: nav?.label ?? m,
      group: nav?.group ?? null,
      uiPath: nav?.href ?? null,
      // Ce que l'identité peut faire, action par action : la vérité du RBAC, pas une promesse.
      allowed: ACTIONS.filter((a) => userCan(ctx.user, m, a)),
      rolesWithAccess: Object.entries(PERMISSIONS).filter(([, matrix]) => (matrix as Record<string, unknown>)[m]).map(([r]) => r),
      entities: ENTITIES.filter((e) => e.module === m).map((e) => e.name),
    };
  }),
}));
