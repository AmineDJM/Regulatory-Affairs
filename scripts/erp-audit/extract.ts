/**
 * EXTRACTION DE LA CARTE DE L'ERP — depuis le code, jamais à la main.
 *
 * Une cartographie écrite à la main est fausse le lendemain. Celle-ci se REGÉNÈRE : chaque
 * fonction lit une source de vérité du dépôt (schéma Prisma, matrice RBAC, arbre des pages,
 * actions serveur, routes API, planificateur, drapeaux) et rend une structure. Le document
 * `ERP_AUDIT.md` et le fichier machine `erp-map.json` n'en sont que des rendus.
 *
 * Les fonctions sont PURES (elles reçoivent le texte des fichiers) — donc testables sans dépôt.
 */

export interface PrismaField {
  name: string;
  type: string;
  optional: boolean;
  isList: boolean;
  /** Nom du modèle lié si c'est une relation, sinon null. */
  relationTo: string | null;
  isId: boolean;
  isUnique: boolean;
  doc: string | null;
}

export interface PrismaModel {
  name: string;
  doc: string | null;
  fields: PrismaField[];
}

export interface PrismaEnum {
  name: string;
  values: string[];
  doc: string | null;
}

const SCALARS = new Set(["String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime", "Json", "Bytes"]);

/** Commentaire `///` accumulé juste au-dessus d'une déclaration — la doc du champ ou du modèle. */
function docAbove(lines: string[], index: number): string | null {
  const out: string[] = [];
  for (let i = index - 1; i >= 0; i -= 1) {
    const t = lines[i].trim();
    if (t.startsWith("///")) out.unshift(t.slice(3).trim());
    else break;
  }
  return out.length ? out.join(" ") : null;
}

/** Les modèles du schéma, avec leurs champs, types, optionalité et relations. */
export function parsePrismaModels(schema: string, enumNames: Set<string>): PrismaModel[] {
  const lines = schema.split("\n");
  const models: PrismaModel[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^model\s+(\w+)\s*\{/.exec(lines[i]);
    if (!m) continue;
    const model: PrismaModel = { name: m[1], doc: docAbove(lines, i), fields: [] };
    for (let j = i + 1; j < lines.length && !/^\}/.test(lines[j]); j += 1) {
      const raw = lines[j];
      const line = raw.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      const f = /^(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/.exec(line);
      if (!f) continue;
      const [, name, type, list, optional, rest] = f;
      const isRelation = !SCALARS.has(type) && !enumNames.has(type);
      // Le commentaire de fin de ligne vaut documentation quand il n'y a pas de `///`.
      const trailing = /\/\/\s*(.+)$/.exec(rest);
      model.fields.push({
        name,
        type,
        optional: Boolean(optional),
        isList: Boolean(list),
        relationTo: isRelation ? type : null,
        isId: /@id\b/.test(rest),
        isUnique: /@unique\b/.test(rest),
        doc: docAbove(lines, j) ?? (trailing ? trailing[1].trim() : null),
      });
    }
    models.push(model);
  }
  return models;
}

export function parsePrismaEnums(schema: string): PrismaEnum[] {
  const lines = schema.split("\n");
  const enums: PrismaEnum[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^enum\s+(\w+)\s*\{/.exec(lines[i]);
    if (!m) continue;
    const values: string[] = [];
    for (let j = i + 1; j < lines.length && !/^\}/.test(lines[j]); j += 1) {
      const v = /^\s*(\w+)/.exec(lines[j]);
      if (v && !lines[j].trim().startsWith("//") && !lines[j].trim().startsWith("///")) values.push(v[1]);
    }
    enums.push({ name: m[1], values, doc: docAbove(lines, i) });
  }
  return enums;
}

export interface ServerAction {
  /** Nom exporté — c'est lui que l'API réutilisera, jamais une copie de la logique. */
  name: string;
  file: string;
  /** Première phrase du commentaire de tête : à quoi sert l'action. */
  summary: string | null;
  /** Modules cités dans ses gardes `userCan(user, "X", …)`. */
  modules: string[];
  /** Actions RBAC exigées (VIEW, CREATE, UPDATE…). */
  rbacActions: string[];
  /** Vérifie-t-elle l'accès ligne à ligne (`canAccessEntity`) ? */
  entityChecked: boolean;
  /** Écrit-elle au journal d'audit ? */
  audited: boolean;
  /** Notifie-t-elle quelqu'un ? (effet de bord observable) */
  notifies: boolean;
  /** Écrit-elle en base ? (create/update/delete/upsert Prisma) */
  writes: boolean;
  /** Manipule-t-elle des fichiers ? */
  files: boolean;
}

/** Première phrase d'un bloc `/** … *\/` posé juste au-dessus. */
function summaryAbove(src: string, at: number): string | null {
  const before = src.slice(0, at);
  const close = before.lastIndexOf("*/");
  if (close === -1) return null;
  const open = before.lastIndexOf("/**", close);
  if (open === -1) return null;
  // Le bloc doit être ADJACENT (rien d'autre qu'un saut de ligne entre lui et la déclaration).
  if (before.slice(close + 2).trim().length > 0) return null;
  const body = before
    .slice(open + 3, close)
    .split("\n")
    .map((l) => l.replace(/^\s*\*ptr?/, "").replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .join(" ");
  const sentence = /^(.+?[.!?])(\s|$)/.exec(body);
  return (sentence ? sentence[1] : body).trim() || null;
}

/** Le corps d'une fonction exportée, approché jusqu'à la prochaine déclaration de tête. */
function bodyAfter(src: string, at: number): string {
  const next = src.slice(at + 1).search(/\nexport (async )?function |\n\/\*\*/);
  return next === -1 ? src.slice(at) : src.slice(at, at + 1 + next);
}

export function parseServerActions(file: string, src: string): ServerAction[] {
  const out: ServerAction[] = [];
  const re = /export\s+async\s+function\s+(\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const body = bodyAfter(src, m.index);
    const modules = Array.from(new Set([...body.matchAll(/userCan\(\s*[\w.() ]+,\s*"(\w+)"/g)].map((x) => x[1])));
    const rbacActions = Array.from(new Set([...body.matchAll(/userCan\(\s*[\w.() ]+,\s*"\w+",\s*"(\w+)"/g)].map((x) => x[1])));
    out.push({
      name: m[1],
      file,
      summary: summaryAbove(src, m.index),
      modules,
      rbacActions,
      entityChecked: /canAccessEntity\(/.test(body),
      audited: /recordAudit\(/.test(body),
      notifies: /notifyUser\(|notifyRoles\(/.test(body),
      writes: /prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/.test(body),
      files: /saveFile\(|deleteFileByKey\(|validateUpload\(/.test(body),
    });
  }
  return out;
}

export interface PageInfo {
  /** Route telle qu'on l'ouvre dans le navigateur. */
  route: string;
  file: string;
  /** Module exigé à l'entrée (`requireModule`), s'il y en a un. */
  guardModule: string | null;
  guardAction: string | null;
  /** Page publique / hors coque applicative (portail fournisseur, connexion…). */
  group: string | null;
}

/** `src/app/(app)/regulatory/[id]/page.tsx` → `/regulatory/{id}`, groupe « (app) ». */
export function routeOfPage(file: string): { route: string; group: string | null } {
  const rel = file.replace(/^src\/app\//, "").replace(/\/page\.tsx$/, "");
  const parts = rel.split("/").filter(Boolean);
  let group: string | null = null;
  const kept: string[] = [];
  for (const p of parts) {
    if (/^\(.+\)$/.test(p)) { group = p; continue; } // groupe de route : invisible dans l'URL
    kept.push(p.replace(/^\[\.\.\.(\w+)\]$/, "{$1}").replace(/^\[(\w+)\]$/, "{$1}"));
  }
  return { route: `/${kept.join("/")}`, group };
}

export function parsePage(file: string, src: string): PageInfo {
  const { route, group } = routeOfPage(file);
  const g = /requireModule\(\s*"(\w+)"(?:\s*,\s*"(\w+)")?/.exec(src);
  return { route, file, guardModule: g?.[1] ?? null, guardAction: g?.[2] ?? null, group };
}

export interface ApiRoute {
  route: string;
  file: string;
  methods: string[];
}

export function parseApiRoute(file: string, src: string): ApiRoute {
  const rel = file.replace(/^src\/app\//, "").replace(/\/route\.ts$/, "");
  const route = `/${rel.split("/").filter((p) => !/^\(.+\)$/.test(p)).map((p) => p.replace(/^\[\.\.\.(\w+)\]$/, "{$1}").replace(/^\[(\w+)\]$/, "{$1}")).join("/")}`;
  const methods = Array.from(new Set([...src.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((m) => m[1])));
  return { route, file, methods };
}

/** Les tâches lancées par le battement du planificateur, dans leur ordre d'exécution. */
export function parseScheduledJobs(src: string): { name: string; note: string | null }[] {
  const block = /export async function runScheduledJobs\(\)[\s\S]*?\n\}/.exec(src);
  if (!block) return [];
  return [...block[0].matchAll(/await\s+(\w+)\([^)]*\)[^\n]*/g)].map((m) => {
    const note = /\/\/\s*(.+)$/.exec(m[0]);
    return { name: m[1], note: note ? note[1].trim() : null };
  });
}

/** Exports d'un module de requêtes — la lecture que l'API doit pouvoir réutiliser. */
export function parseExportedFunctions(src: string): string[] {
  return Array.from(new Set([
    ...[...src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((m) => m[1]),
    ...[...src.matchAll(/export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(/g)].map((m) => m[1]),
  ]));
}
