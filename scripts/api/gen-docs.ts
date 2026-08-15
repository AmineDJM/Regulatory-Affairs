/**
 * GÉNÈRE les livrables de l'API : openapi.yaml et la matrice de couverture.
 *
 *   npx tsx scripts/api/gen-docs.ts
 *
 * La spécification est SÉRIALISÉE depuis le même constructeur que celui servi par
 * l'application : le fichier committé ne peut donc pas décrire autre chose que les routes qui
 * tournent. La couverture, elle, est calculée en confrontant le registre à la carte de l'ERP —
 * c'est une mesure, pas une déclaration.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { buildOpenApi } from "../../src/lib/api/openapi";
import { ENTITIES } from "../../src/lib/api/registry/entities";

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "docs", "api");

/** Sérialiseur YAML minimal — suffisant pour un document JSON-compatible, sans dépendance. */
function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (value.includes("\n")) {
      return `|-\n${value.split("\n").map((l) => `${pad}  ${l}`).join("\n")}`;
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `\n${value.map((v) => `${pad}- ${toYaml(v, indent + 1).replace(/^\n/, "")}`).join("\n")}`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return `\n${entries.map(([k, v]) => `${pad}${JSON.stringify(k)}: ${toYaml(v, indent + 1).replace(/^\n/, "\n")}`).join("\n")}`;
}

const spec = buildOpenApi();
const ops: { id: string; method: string; path: string; tags: string[]; scopes: string[] }[] = [];
for (const [p, methods] of Object.entries(spec.paths as Record<string, Record<string, Record<string, unknown>>>)) {
  for (const [m, op] of Object.entries(methods)) {
    ops.push({
      id: String(op.operationId), method: m.toUpperCase(), path: p,
      tags: (op.tags as string[]) ?? [],
      scopes: Object.values(((op.security as Record<string, string[]>[]) ?? [{}])[0] ?? {}).flat(),
    });
  }
}

const dupes = ops.map((o) => o.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dupes.length) { console.error(`operationId en double : ${dupes.join(", ")}`); process.exit(1); }

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "openapi.yaml"),
  `# Généré par npx tsx scripts/api/gen-docs.ts — ne pas modifier à la main.\n${toYaml(spec).trimStart()}\n`, "utf8");
fs.writeFileSync(path.join(OUT, "openapi.json"), `${JSON.stringify(spec, null, 2)}\n`, "utf8");

const map = JSON.parse(fs.readFileSync(path.join(OUT, "erp-map.json"), "utf8")) as {
  counts: Record<string, number>;
  actions: { name: string; file: string; modules: string[]; summary: string | null; writes: boolean }[];
  models: { name: string }[];
};

const covered = new Set(ENTITIES.map((e) => e.model));
const L: string[] = [];
L.push("# API_COVERAGE — ce que l'API couvre, et ce qu'elle ne couvre pas encore");
L.push("");
L.push("> **Généré** par `npx tsx scripts/api/gen-docs.ts`. Une matrice de couverture écrite à la");
L.push("> main affirme ; celle-ci **mesure**, en confrontant le registre de l'API à la carte de");
L.push("> l'ERP (`ERP_AUDIT.md`). Les manques ci-dessous sont donc réels, et se réduisent en");
L.push("> ajoutant des entrées au registre — pas en corrigeant ce document.");
L.push("");
L.push("## 1. Volumétrie");
L.push("");
L.push("| Élément | ERP | Couvert par l'API | Reste |");
L.push("|---|---:|---:|---:|");
L.push(`| Objets métier (modèles Prisma) | ${map.counts.models} | ${covered.size} | ${map.counts.models - covered.size} |`);
L.push(`| Actions serveur (écriture métier) | ${map.counts.serverActions} | 0 | ${map.counts.serverActions} |`);
L.push(`| Opérations d'API exposées | — | ${ops.length} | — |`);
L.push("");
L.push("## 2. Opérations exposées");
L.push("");
L.push("| operationId | Méthode | Chemin | Portées |");
L.push("|---|---|---|---|");
for (const o of ops.sort((a, b) => a.id.localeCompare(b.id))) {
  L.push(`| \`${o.id}\` | ${o.method} | \`${o.path}\` | ${o.scopes.map((s) => `\`${s}\``).join(", ") || "—"} |`);
}
L.push("");
L.push("## 3. Objets couverts");
L.push("");
L.push("Chaque objet expose : liste + filtres, fiche, historique, commentaires, pièces jointes,");
L.push("objets liés, circuit et actions disponibles — soit **8 opérations** par objet.");
L.push("");
L.push("| Objet d'API | Modèle | Module | Portée par ligne |");
L.push("|---|---|---|:-:|");
for (const e of ENTITIES) L.push(`| \`${e.name}\` | \`${e.model}\` | ${e.module} | ${e.scope ? "✔" : "—"} |`);
L.push("");
L.push("## 4. GAPS — ce qui n'est PAS encore accessible par API");
L.push("");
L.push("### 4.1 Écriture métier");
L.push("");
L.push(`Les **${map.counts.serverActions} actions serveur** de l'ERP ne sont pas encore exposées. La couche`);
L.push("d'authentification, de portées, d'idempotence et de journalisation qui les recevra est en");
L.push("place et testée ; il reste à **déclarer** chaque action dans un registre d'opérations qui");
L.push("appellera la fonction existante — jamais une copie. Les actions les plus attendues :");
L.push("");
L.push("| Action serveur | Fichier | Effet |");
L.push("|---|---|---|");
for (const a of map.actions.filter((x) => x.writes).slice(0, 40)) {
  L.push(`| \`${a.name}\` | \`${a.file.replace("src/lib/actions/", "")}\` | ${(a.summary ?? "—").replace(/\|/g, "\\|")} |`);
}
L.push("");
L.push("### 4.2 Objets non encore déclarés");
L.push("");
L.push(`${map.counts.models - covered.size} modèles ne sont pas exposés. La plupart sont des tables techniques`);
L.push("(sessions, caches, vecteurs, pièces de téléversement) qui n'ont pas de sens pour un agent ;");
L.push("les objets métier restants s'ajoutent au registre une ligne à la fois.");
L.push("");
L.push("### 4.3 Non couvert par choix");
L.push("");
L.push("| Sujet | Raison |");
L.push("|---|---|");
L.push("| Webhooks (émission) | Les tables sont en place ; l'émetteur et les signatures restent à brancher. |");
L.push("| Téléversement de pièces | Nécessite `erp.documents.write` et un contrôle antivirus : lot suivant. |");
L.push("| Circuits Ad & Pro / congés détaillés | Rendus en mode générique (statut + actions) tant que leurs étapes ne sont pas modélisées. |");
L.push("| Administration (comptes, droits) | Volontairement hors de portée par défaut : exige `erp.admin`. |");
L.push("");
fs.writeFileSync(path.join(OUT, "API_COVERAGE.md"), L.join("\n"), "utf8");

console.log(`openapi.yaml + openapi.json + API_COVERAGE.md écrits (${ops.length} opérations, ${ENTITIES.length} objets).`);
