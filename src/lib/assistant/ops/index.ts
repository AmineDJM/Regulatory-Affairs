import type { Module } from "@/lib/rbac";
import type { ClaudeToolDef } from "@/lib/ai";
import { OPS_BY_TOOL, type OpMeta } from "./catalog";
import type { OpImpl } from "./types";
import { DRIVE_OPS_IMPL } from "./impl-drive";
import { TASK_OPS_IMPL } from "./impl-task";

/**
 * ASSEMBLAGE des outils de domaine : le CATALOGUE (métadonnées pures) est zippé avec les
 * IMPLÉMENTATIONS (résolution + exécution) — une op déclarée sans implémentation fait
 * échouer le chargement (donc les tests) : le catalogue ne peut pas promettre dans le vide.
 *
 * Les DÉFINITIONS d'outils Claude sont GÉNÉRÉES d'ici : ajouter une op au catalogue met à
 * jour l'énumération `op` et la description de l'outil sans toucher l'orchestrateur.
 */

export interface DomainToolSpec {
  /** Module RBAC affiché sur la carte de confirmation. */
  module: Module;
  ops: Record<string, { meta: OpMeta; impl: OpImpl }>;
  def: ClaudeToolDef;
}

function zipOps(tool: string, impls: Record<string, OpImpl>): Record<string, { meta: OpMeta; impl: OpImpl }> {
  const metas = OPS_BY_TOOL[tool] ?? {};
  const out: Record<string, { meta: OpMeta; impl: OpImpl }> = {};
  for (const [op, meta] of Object.entries(metas)) {
    const impl = impls[op];
    if (!impl) throw new Error(`Op « ${tool}/${op} » déclarée au catalogue sans implémentation.`);
    out[op] = { meta, impl };
  }
  for (const op of Object.keys(impls)) {
    if (!metas[op]) throw new Error(`Implémentation « ${tool}/${op} » absente du catalogue (découverte/classification cassées).`);
  }
  return out;
}

function opsSummary(tool: string): string {
  return Object.values(OPS_BY_TOOL[tool] ?? {})
    .map((o) => `${o.op} = ${o.uiLabel}${o.risk === "CRITICAL" ? " [CRITIQUE]" : ""}`)
    .join(" ; ");
}

const opEnum = (tool: string): string[] => Object.keys(OPS_BY_TOOL[tool] ?? {});

export const DOMAIN_TOOLS: Record<string, DomainToolSpec> = {
  drive_operation: {
    module: "DRIVE",
    ops: zipOps("drive_operation", DRIVE_OPS_IMPL),
    def: {
      name: "drive_operation",
      description:
        "ÉCRITURES DRIVE — les gestes de l'écran Drive, par leurs actions canoniques (ACL réelle par élément, cascades, notifications, audit). "
        + `Champ « op » : ${opsSummary("drive_operation")}. `
        + "La cible se donne par NOM (« name ») — la résolution confirme l'élément exact avant toute proposition. "
        + "Les pièces jointes déposées dans ce chat SONT des fichiers Drive : « range ce fichier… » passe par ici.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("drive_operation"), description: "Le geste à faire." },
          name: { type: "string", description: "Nom de l'élément visé — ou nom du nouveau dossier/document pour create_folder/create_office." },
          folder: { type: "string", description: "Dossier parent ou de destination, par nom (« racine » = Drive personnel ; un nom de catégorie vise sa racine)." },
          newName: { type: "string", description: "rename : le nouveau nom." },
          people: { type: "string", description: "share/unshare : noms des personnes, séparés par des virgules." },
          access: { type: "string", description: "share : « lecture » (défaut) ou « modification »." },
          kind: { type: "string", description: "create_office : word, excel ou powerpoint." },
        },
        required: ["op", "name"],
      },
    },
  },
  task_operation: {
    module: "WORKSPACE",
    ops: zipOps("task_operation", TASK_OPS_IMPL),
    def: {
      name: "task_operation",
      description:
        "MES TÂCHES — répondre à une demande de tâche et faire avancer les siennes, par les actions canoniques de l'écran (notifications au demandeur, audit). "
        + `Champ « op » : ${opsSummary("task_operation")}. `
        + "La tâche se donne par INTITULÉ (« title ») — seules les tâches où le geste est réellement possible sont proposées. "
        + "Pour CRÉER ou demander une tâche : create_task.",
      input_schema: {
        type: "object",
        properties: {
          op: { type: "string", enum: opEnum("task_operation"), description: "Le geste à faire." },
          title: { type: "string", description: "Intitulé (ou morceau d'intitulé) de la tâche visée." },
          reason: { type: "string", description: "refuse : motif du refus (facultatif)." },
          note: { type: "string", description: "submit_work : compte rendu du travail (facultatif)." },
          comment: { type: "string", description: "comment : le message à poster dans le fil." },
        },
        required: ["op", "title"],
      },
    },
  },
};

export const DOMAIN_TOOL_DEFS: ClaudeToolDef[] = Object.values(DOMAIN_TOOLS).map((t) => t.def);
