import * as fs from "node:fs";
import * as path from "node:path";
import { handle } from "@/lib/api/http";
import { errors } from "@/lib/api/errors";
import { userCan, ACTIONS } from "@/lib/rbac";
import { getEntity } from "@/lib/api/registry/entities";

/**
 * SCHÉMA D'UN OBJET — champs, types, énumérations, relations.
 *
 * Lu dans le schéma Prisma au moment de la demande : une description recopiée à la main
 * divergerait de la base dès la première migration, et l'agent construirait des filtres sur
 * des champs qui n'existent plus.
 */

let cache: string | null = null;
const schema = (): string => (cache ??= fs.readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8"));

const SCALARS = new Set(["String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime", "Json", "Bytes"]);

function blockOf(kind: "model" | "enum", name: string): string | null {
  const m = new RegExp(`^${kind}\\s+${name}\\s*\\{([\\s\\S]*?)^\\}`, "m").exec(schema());
  return m ? m[1] : null;
}

export const GET = handle<{ entity: string }>(
  { operationId: "get_entity_schema", scopes: ["erp.read"] },
  async ({ ctx, params }) => {
    const def = getEntity(params.entity);
    if (!def) throw errors.notFound("Objet");
    const body = blockOf("model", def.model);
    if (!body) throw errors.notFound("Schéma de l'objet");

    const fields = [];
    const enums: Record<string, string[]> = {};
    for (const line of body.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("//") || t.startsWith("///") || t.startsWith("@@")) continue;
      const f = /^(\w+)\s+(\w+)(\[\])?(\??)(.*)$/.exec(t);
      if (!f) continue;
      const [, name, type, list, optional, rest] = f;
      const isEnum = !SCALARS.has(type) && Boolean(blockOf("enum", type));
      const isRelation = !SCALARS.has(type) && !isEnum;
      if (isEnum && !enums[type]) {
        enums[type] = (blockOf("enum", type) ?? "").split("\n")
          .map((l) => /^\s*(\w+)/.exec(l)?.[1]).filter((v): v is string => Boolean(v));
      }
      const doc = /\/\/\s*(.+)$/.exec(rest);
      fields.push({
        name, type, isList: Boolean(list), optional: optional === "?",
        kind: isRelation ? "relation" : isEnum ? "enum" : "scalar",
        relationTo: isRelation ? type : null,
        enumName: isEnum ? type : null,
        isId: /@id\b/.test(rest), isUnique: /@unique\b/.test(rest),
        description: doc ? doc[1].trim() : null,
        filterable: !isRelation && !list,
        inList: def.listFields.includes(name),
        searchable: def.searchFields.includes(name),
      });
    }

    return {
      entity: def.name,
      label: def.label,
      description: def.description,
      module: def.module,
      model: def.model,
      permissions: {
        allowed: ACTIONS.filter((a) => userCan(ctx.user, def.module, a)),
        rowScoped: Boolean(def.scope),
        note: def.scope
          ? "Filtré ligne à ligne par la portée de l'ERP : la liste ne contient que ce que cette identité a le droit de voir."
          : "Aucun filtre par ligne : le droit de module suffit à voir tous les objets.",
      },
      referenceField: def.referenceField ?? null,
      statusField: def.statusField ?? null,
      entityType: def.entityType ?? null,
      workflow: def.workflow ?? null,
      related: Object.keys(def.related ?? {}),
      defaultSort: def.orderBy ?? null,
      fields,
      enums,
      operations: [
        { operationId: `list_${def.name}`, method: "GET", path: `/api/v1/entities/${def.name}`, scopes: ["erp.read"] },
        { operationId: `get_${def.name}`, method: "GET", path: `/api/v1/entities/${def.name}/{id}`, scopes: ["erp.read"] },
        { operationId: `get_${def.name}_history`, method: "GET", path: `/api/v1/entities/${def.name}/{id}/history`, scopes: ["erp.read"] },
        { operationId: `list_${def.name}_documents`, method: "GET", path: `/api/v1/entities/${def.name}/{id}/documents`, scopes: ["erp.documents.read"] },
        { operationId: `get_${def.name}_related`, method: "GET", path: `/api/v1/entities/${def.name}/{id}/related`, scopes: ["erp.read"] },
        { operationId: `get_${def.name}_workflow`, method: "GET", path: `/api/v1/entities/${def.name}/{id}/workflow`, scopes: ["erp.read"] },
        { operationId: `get_${def.name}_available_actions`, method: "GET", path: `/api/v1/entities/${def.name}/{id}/available-actions`, scopes: ["erp.read"] },
      ],
    };
  },
);
