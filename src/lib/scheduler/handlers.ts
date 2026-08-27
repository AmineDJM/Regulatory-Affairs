import { prisma } from "@/lib/prisma";
import { registerWorkflow } from "./registry";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES TRAITEMENTS PLANIFIABLES LIVRÉS AVEC LE PRODUIT.
 *
 * ── CE QU'ILS ONT TOUS EN COMMUN ─────────────────────────────────────────────────────────
 *
 * Ils LISENT. Aucun n'écrit dans une table métier, aucun n'envoie quoi que ce soit à l'extérieur,
 * aucun ne déclenche une action soumise à approbation. Un traitement planifié produit un CONSTAT,
 * qui atterrit dans l'historique de la planification — et c'est là que quelqu'un le lit et décide.
 *
 * C'est la règle centrale, écrite ici parce que c'est ici qu'on serait tenté de l'enfreindre :
 * ajouter « et envoie-le par mail » à un traitement planifié transformerait le planificateur en
 * contournement de la politique d'approbation. Le champ `mutates: false` et son test existent
 * pour que cette tentation coûte une suite rouge.
 *
 * ── POURQUOI L'ENREGISTREMENT EST EXPLICITE ──────────────────────────────────────────────
 *
 * Rien ne s'enregistre à l'import. `registerBuiltinWorkflows()` est appelée une fois par le
 * planificateur horaire. Un enregistrement en effet de bord d'import rendrait le catalogue
 * dépendant de l'ordre des imports — donc différent en test, en développement et en production.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let registered = false;

export function registerBuiltinWorkflows(): void {
  if (registered) return;
  registered = true;

  // ── L'ÉTAT DE LA COUCHE DE CONNAISSANCE ────────────────────────────────────────────────
  //
  // Le seul moyen de voir une dérive AVANT qu'elle ne devienne une panne : la file qui grossit,
  // la boîte morte qui se remplit, la part de `luna` qui monte alors que le code devrait suffire.
  registerWorkflow({
    kind: "knowledge_health",
    label: "État de la couche de connaissance",
    description: "Consigne la taille de la file, les documents par étape et la répartition par moyen d'extraction.",
    mutates: false,
    run: async () => {
      const { knowledgeHealth } = await import("@/lib/knowledge/worker");
      const h = await knowledgeHealth();
      const stages = Object.entries(h.byStage).map(([k, v]) => `${k}: ${v}`).join(", ") || "aucun document";
      const means = Object.entries(h.byExtraction).map(([k, v]) => `${k}: ${v}`).join(", ") || "—";
      return {
        didWork: true,
        summary:
          `${h.total} documents (${stages}). Moyens : ${means}. ` +
          `File : ${h.queue.queued} en attente, ${h.queue.dead} en boîte morte. ` +
          `Entités : ${h.entities.entities} (${h.entities.aliases} graphies, ${h.entities.links} liens). ` +
          `Vecteurs : ${h.chunks.embedded}/${h.chunks.total} morceaux.`,
      };
    },
  });

  // ── LE RATTRAPAGE D'INDEXATION ─────────────────────────────────────────────────────────
  //
  // Le balayage horaire avance par petits paquets, ce qui est le bon régime en journée. Une
  // planification nocturne permet de passer un lot plus large sans jamais gêner personne.
  registerWorkflow({
    kind: "knowledge_catchup",
    label: "Rattrapage d'indexation",
    description: "Met en file les documents jamais vus, repasse ceux restés muets, puis traite un lot élargi.",
    mutates: false,
    run: async () => {
      const { enqueueBacklogs, enqueueStalled, runKnowledgeSweep } = await import("@/lib/knowledge/worker");
      const backlog = await enqueueBacklogs(60);
      const stalled = await enqueueStalled(30);
      const sweep = await runKnowledgeSweep(40);
      const queued = backlog.drive + backlog.email + stalled;
      return {
        // « Rien à faire » est un résultat, pas un échec : tout est à jour, et l'historique le dira.
        didWork: queued > 0 || sweep.processed > 0,
        summary:
          `${queued} documents mis en file (${backlog.drive} Drive, ${backlog.email} messages, ${stalled} repassés). ` +
          `Traités : ${sweep.processed}, sans effet : ${sweep.skipped}, en échec : ${sweep.failed}.`,
      };
    },
  });

  // ── LE POINT REGULATORY ────────────────────────────────────────────────────────────────
  //
  // Le cas d'usage littéral de §9 : « tous les dimanches, fais-moi le point Regulatory ». Il
  // COMPTE et il DIT ; il ne relance personne — relancer est une action, et une action se
  // confirme.
  registerWorkflow({
    kind: "regulatory_digest",
    label: "Point Regulatory",
    description: "Compte les dossiers par statut et signale ceux qui n'ont pas bougé depuis longtemps.",
    mutates: false,
    run: async ({ payload }) => {
      const days = typeof payload.staleDays === "number" ? Math.max(7, Math.min(365, payload.staleDays)) : 30;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [byStatus, stale, total] = await Promise.all([
        prisma.regulatoryProduct.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.regulatoryProduct.count({
          where: { updatedAt: { lt: cutoff }, status: { notIn: ["CLOSED", "DECISION_OBTAINED"] } },
        }),
        prisma.regulatoryProduct.count(),
      ]);

      if (total === 0) {
        // On le DIT au lieu de rendre un rapport vide qui ressemblerait à une panne.
        return { didWork: false, summary: "Aucun dossier Regulatory enregistré — rien à rapporter." };
      }

      const parts = byStatus
        .sort((a, b) => b._count._all - a._count._all)
        .map((r) => `${r.status}: ${r._count._all}`)
        .join(", ");
      return {
        didWork: true,
        summary: `${total} dossiers — ${parts}. ${stale} sans mise à jour depuis plus de ${days} jours.`,
      };
    },
  });
}

/** Remise à zéro — pour les tests, qui doivent pouvoir réenregistrer un registre connu. */
export function resetBuiltinRegistration(): void {
  registered = false;
}
