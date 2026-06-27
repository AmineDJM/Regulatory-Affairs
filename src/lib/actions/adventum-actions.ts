"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { askClaude, aiConfigured } from "@/lib/ai";
import { runAssistant } from "@/lib/assistant";
import { getRisks, type AutopilotPayload } from "@/lib/adventum/risks";
import { getProductRelations, type ProductRelations } from "@/lib/adventum/relations";
import type { ActionResult } from "@/lib/actions/types";

const DENIED: ActionResult = { ok: false, error: "Réservé au Super Admin." };

/**
 * Autopilot — exécute une action PROPOSÉE après confirmation. Ne crée que des objets
 * existants (Tâche, Notification) : aucun nouveau workflow, aucune bureaucratie.
 * Toujours ré-autorisé (Super Admin) et journalisé.
 */
export async function runAutopilot(payload: AutopilotPayload): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return DENIED;

  if (payload.kind === "task") {
    const title = payload.title?.trim();
    if (!title) return { ok: false, error: "Intitulé de tâche manquant." };
    let assignedToId = user.id;
    if (payload.assigneeId) {
      const u = await prisma.user.findUnique({ where: { id: payload.assigneeId }, select: { id: true, isActive: true } });
      if (u?.isActive) assignedToId = u.id;
    }
    const priority = (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).includes(payload.priority as never) ? payload.priority! : "HIGH";
    const task = await prisma.task.create({
      data: { title, assignedToId, createdById: user.id, priority, module: payload.module ?? "Adventum Brain" },
      select: { id: true },
    });
    if (assignedToId !== user.id) await notifyUser({ userId: assignedToId, type: "ASSIGNMENT", title: "Tâche (Adventum Brain)", body: title, link: "/mon-espace" });
    await recordAudit({ actorId: user.id, action: "CREATE", module: "Adventum Brain", entityType: "TASK", entityId: task.id, summary: `Tâche « ${title} » créée via Autopilot` });
    revalidatePath("/mon-travail");
    return { ok: true };
  }

  if (payload.kind === "notify") {
    const title = payload.title?.trim();
    const body = (payload.body ?? "").trim();
    if (!title) return { ok: false, error: "Titre de notification manquant." };
    let delivered = false;
    if (payload.userId) {
      const u = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, isActive: true } });
      if (u?.isActive) { await notifyUser({ userId: u.id, type: "GENERIC", title, body, link: payload.link }); delivered = true; }
    }
    if (!delivered && payload.role) { await notifyRoles([payload.role], { type: "GENERIC", title, body, link: payload.link }); delivered = true; }
    if (!delivered) return { ok: false, error: "Destinataire introuvable." };
    await recordAudit({ actorId: user.id, action: "UPDATE", module: "Adventum Brain", summary: `Relance via Autopilot : ${title}` });
    return { ok: true };
  }

  return { ok: false, error: "Action inconnue." };
}

/** Barre de commande IA d'Adventum Brain (questions d'analyse, lecture seule). */
export async function askBrain(question: string): Promise<{ ok: boolean; reply: string; trace: string[]; error?: string }> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, reply: "", trace: [], error: "Réservé au Super Admin." };
  const q = (question ?? "").trim();
  if (!q) return { ok: false, reply: "", trace: [], error: "Question vide." };
  const r = await runAssistant(user, [{ role: "user", content: q }]);
  if (!r.configured) return { ok: false, reply: "", trace: [], error: "IA non configurée (ANTHROPIC_API_KEY)." };
  const reply = r.reply || (r.proposal ? "J'ai préparé une action — confirmez-la dans le module Assistant IA." : "Pas de réponse.");
  return { ok: r.ok, reply, trace: r.trace, error: r.error };
}

/** Génère un briefing de direction synthétisant les risques du jour (IA, gracieux sans clé). */
export async function generateBriefing(): Promise<{ ok: boolean; text: string; error?: string }> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, text: "", error: "Réservé au Super Admin." };
  if (!aiConfigured()) return { ok: false, text: "", error: "IA non configurée (ANTHROPIC_API_KEY)." };
  const risks = await getRisks();
  const summary = risks.slice(0, 25).map((r) => `- [${r.level}] ${r.module} — ${r.title} : ${r.object}. Cause: ${r.probableCause} Reco: ${r.recommendation}`).join("\n");
  const prompt = `Tu es l'analyste de direction d'Adventum Pharma (laboratoire pharmaceutique algérien, devise DZD). Voici les risques et blocages détectés aujourd'hui dans l'OS de l'entreprise :\n\n${summary || "(aucun risque détecté)"}\n\nRédige un BRIEFING DE DIRECTION en TEXTE SIMPLE (aucun markdown, pas d'astérisques), 5 à 8 lignes : ce qui est le plus urgent aujourd'hui, les tendances, et les 3 décisions prioritaires à prendre. Sois concret et direct, en français.`;
  const res = await askClaude(prompt);
  if (!res.ok) return { ok: false, text: "", error: res.error ?? "Synthèse impossible." };
  return { ok: true, text: (res.text ?? "").trim() || "Aucune synthèse." };
}

/** Recherche relationnelle (fiche 360) — Super Admin. */
export async function searchRelations(query: string): Promise<{ ok: boolean; relations?: ProductRelations; error?: string }> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  return { ok: true, relations: await getProductRelations(query) };
}
