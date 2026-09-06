/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PONT DE LA VÉRITÉ (mandat 6 §46) — un passage, pas une couche.
 *
 * Le moteur de contradictions et la lignée sont PURS : ils ne lisent ni la base, ni les droits,
 * ni le catalogue. Ils n'ont donc besoin d'aucune capacité, et ce pont n'en fournit aucune.
 *
 * Il existe pour une seule raison, et elle est structurelle : Adam ne doit pas importer
 * `@/lib/verite/` directement. La frontière Adam ↔ ERP se COMPTE (`boundary.test.ts`), et un
 * import de plus la fait monter — y compris un import de type. Le pont est le passage prévu ;
 * il réexporte, et c'est tout.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export {
  AUTORITE_CLAUSE, AUTORITE_DEFAUT, NATURES_SOURCE, direVerdict, reconcilier,
} from "@/lib/verite/contradiction";
export type { Candidat, Ecartee, NatureSource, Options, Source, Verdict } from "@/lib/verite/contradiction";

export { NATURES_ETAPE, construire, detailler, raconter, verifier } from "@/lib/verite/lignee";
export type { Anomalie, Etape, Lignee, NatureEtape } from "@/lib/verite/lignee";

import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";

/**
 * LES QUESTIONS OUVERTES ET LES HYPOTHÈSES À REJUGER — une LECTURE du registre des décisions.
 *
 * Aucune table nouvelle : une décision `PROPOSED` EST une question ouverte, et une décision qui
 * porte un résultat attendu et une date de relecture EST une hypothèse. La lecture vit ici, dans
 * le pont, parce que c'est le pont qui a le droit de connaître l'ERP — l'outil, lui, ne fait que
 * mettre en forme.
 *
 * Le cloisonnement est celui du registre : `ownerId`. Chacun ne voit que SES décisions, y compris
 * un Super Admin — c'est déjà la règle de `list_decisions`, et deux règles divergeraient.
 */
export async function questionsEtHypotheses(user: CurrentUser, limite = 20): Promise<{
  questions: { id: string; titre: string; probleme: string | null; options: unknown[]; recommandation: string | null; ouverteDepuis: Date; entites: unknown[] }[];
  hypotheses: { id: string; decision: string; attendu: string | null; aRevoirLe: Date | null; decideeLe: Date | null; echue: boolean }[];
}> {
  const n = Math.min(50, Math.max(1, limite));
  const maintenant = new Date();
  const [questions, hypotheses] = await Promise.all([
    prisma.executiveDecision.findMany({
      where: { ownerId: user.id, status: "PROPOSED" },
      select: { id: true, title: true, problem: true, options: true, recommendation: true, createdAt: true, entities: true },
      orderBy: { createdAt: "asc" }, take: n,
    }),
    prisma.executiveDecision.findMany({
      where: { ownerId: user.id, expectedOutcome: { not: null }, actualOutcome: null, reviewDate: { not: null } },
      select: { id: true, title: true, expectedOutcome: true, reviewDate: true, decidedAt: true },
      orderBy: { reviewDate: "asc" }, take: n,
    }),
  ]);
  return {
    questions: questions.map((q) => ({
      id: q.id, titre: q.title, probleme: q.problem,
      options: Array.isArray(q.options) ? q.options : [],
      recommandation: q.recommendation, ouverteDepuis: q.createdAt,
      entites: Array.isArray(q.entities) ? q.entities : [],
    })),
    hypotheses: hypotheses.map((h) => ({
      id: h.id, decision: h.title, attendu: h.expectedOutcome,
      aRevoirLe: h.reviewDate, decideeLe: h.decidedAt,
      echue: Boolean(h.reviewDate && h.reviewDate < maintenant),
    })),
  };
}
