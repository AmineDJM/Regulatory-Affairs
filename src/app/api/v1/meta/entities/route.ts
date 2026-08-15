import { handle } from "@/lib/api/http";
import { userCan } from "@/lib/rbac";
import { ENTITIES } from "@/lib/api/registry/entities";

/** Catalogue des objets métier exposés, avec le droit de lecture réel de l'identité courante. */
export const GET = handle({ operationId: "list_entities", scopes: ["erp.read"] }, async ({ ctx }) => ({
  entities: ENTITIES.map((e) => ({
    entity: e.name,
    label: e.label,
    description: e.description,
    module: e.module,
    model: e.model,
    readable: userCan(ctx.user, e.module, "VIEW"),
    hasWorkflow: Boolean(e.workflow),
    rowScoped: Boolean(e.scope),
    listFields: e.listFields,
    searchFields: e.searchFields,
    related: Object.keys(e.related ?? {}),
  })),
}));
