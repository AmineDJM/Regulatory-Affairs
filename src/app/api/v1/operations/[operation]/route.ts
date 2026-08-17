import { handle } from "@/lib/api/http";
import { errors } from "@/lib/api/errors";
import { userCan } from "@/lib/rbac";
import { getOperation, validateParams } from "@/lib/api/registry/operations";

/**
 * EXÉCUTER UNE OPÉRATION MÉTIER — la seule porte d'écriture des agents.
 *
 * Quatre barrières, dans cet ordre, et aucune n'est facultative :
 *   1. l'opération doit EXISTER dans le registre (rien de générique) ;
 *   2. le client d'API doit avoir la PORTÉE qu'elle exige ;
 *   3. l'utilisateur au nom de qui l'on agit doit avoir le DROIT sur le module ;
 *   4. le cœur métier — le même que celui de l'écran — refait ses propres contrôles de ligne.
 *
 * La quatrième est la vraie serrure : les trois premières sont des portes, et l'on ne fait jamais
 * confiance à une porte seule.
 *
 * `handle({ write: true })` ajoute l'idempotence : un agent rejoue dès qu'il perd la réponse, et
 * sans elle un incident réseau créerait deux courriers.
 */
export const POST = handle<{ operation: string }>(
  { operationId: "run_operation", scopes: [], write: true },
  async ({ req, ctx, params, mark }) => {
    const def = getOperation(params.operation);
    if (!def) throw errors.notFound("Opération");
    mark({ operationId: def.name, entityType: def.entityType });

    // La portée exigée est celle de l'OPÉRATION : on ne peut pas la déclarer dans `handle`, qui
    // ne connaît pas encore laquelle a été demandée.
    if (!ctx.client.scopes.includes(def.scope)) {
      throw errors.missingScope([def.scope], ctx.client.scopes);
    }
    // Le droit de la PERSONNE au nom de qui l'agent agit. Le client d'API ne peut que restreindre
    // ce qu'elle peut faire, jamais l'élargir.
    if (!userCan(ctx.user, def.module, "UPDATE") && !userCan(ctx.user, def.module, "CREATE")) {
      throw errors.forbidden(`Le module ${def.module} n'est pas modifiable par cette identité.`);
    }

    let body: unknown = null;
    try { body = await req.json(); } catch { body = {}; }
    const parsed = validateParams(def, body ?? {});
    if (!parsed.ok) throw errors.validation(parsed.error);

    const result = await def.run(ctx.user, parsed.values);
    // Un refus métier n'est pas une panne : on le rend tel quel, avec sa raison, pour que l'agent
    // sache s'il doit corriger son appel ou renoncer.
    if (!result.ok) throw errors.validation(result.error ?? "Opération refusée.");

    mark({ entityId: result.id, after: { id: result.id ?? null, message: result.message ?? null } });
    return { ok: true, operation: def.name, id: result.id ?? null, message: result.message ?? null };
  },
);
