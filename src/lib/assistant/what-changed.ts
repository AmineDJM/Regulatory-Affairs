import type { PowerTool } from "@/lib/assistant/power-tools";
import type { CurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { resolveRecord } from "@/lib/assistant/time-travel";
import { REGULATORY_STEP_TYPE } from "@/lib/labels";

/**
 * WHAT CHANGED / CATCH ME UP — « qu'est-ce qui a changé sur Pembro depuis lundi ? »,
 * « remets-moi à niveau sur ce dossier ».
 *
 * Le diff se lit dans les données TRACÉES : journal d'audit depuis la date de référence,
 * étapes réglementaires franchies, validations rendues — puis l'ÉTAT ACTUEL en face (ce que
 * l'exécutif veut : ce qui a bougé, où on en est, qui a agi). Seuls les changements
 * SIGNIFICATIFS remontent (un mouvement sans résumé ni champ tracé est du bruit technique).
 * Rien n'est inventé : « aucun changement tracé » est une réponse honnête et complète.
 */

const EXEC = (u: CurrentUser): boolean => u.role === "SUPER_ADMIN" || u.role === "DIRECTION";

const str = (input: Record<string, unknown>, key: string): string =>
  typeof input[key] === "string" ? (input[key] as string).trim() : "";

function fr(d: Date): string {
  const alg = new Date(d.getTime() + 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(alg.getUTCDate())}/${p(alg.getUTCMonth() + 1)}/${alg.getUTCFullYear()} ${p(alg.getUTCHours())}:${p(alg.getUTCMinutes())}`;
}

/** La date de référence : AAAA-MM-JJ (début de journée Alger) ou « il y a N jours ». */
export function parseSince(raw: string, now = new Date()): Date | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00+01:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const days = Number.parseInt(s, 10);
  if (Number.isFinite(days) && days > 0 && days <= 365 && /^\d{1,3}$/.test(s)) {
    return new Date(now.getTime() - days * 86_400_000);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const WHAT_CHANGED_TOOLS: PowerTool[] = [
  {
    def: {
      name: "what_changed",
      description:
        "CE QUI A CHANGÉ sur un dossier depuis une date — « qu'est-ce qui a changé sur Pembro depuis lundi ? », " +
        "« remets-moi à niveau », « qu'est-ce qui s'est passé depuis notre dernière discussion ? » (donner la date de cette " +
        "discussion). Renvoie : les CHANGEMENTS SIGNIFICATIFS tracés depuis la date (qui a fait quoi, champ avant → après), " +
        "les étapes réglementaires franchies (dossier Regulatory), QUI a agi sur la période, et l'ÉTAT ACTUEL en face. " +
        "Couvre demandes de paiement, règlements, documents Legal, dossiers Regulatory, tâches. Lecture seule ; " +
        "« aucun changement tracé » est une réponse honnête, pas un échec.",
      input_schema: {
        type: "object",
        properties: {
          reference: { type: "string", description: "Référence (PAY-…, REG-…) ou fragment de titre du dossier." },
          since: { type: "string", description: "La date de référence : AAAA-MM-JJ, ou un nombre de jours en arrière (ex. « 7 »)." },
        },
        required: ["reference", "since"],
      },
    },
    allowed: EXEC,
    label: "Changements depuis la date",
    run: async (input, user) => {
      void user;
      const ref = str(input, "reference");
      const rawSince = str(input, "since");
      if (ref.length < 2) return "Donnez une référence ou un fragment de titre.";
      const since = parseSince(rawSince);
      if (!since) return `Date de référence illisible : « ${rawSince} ». Donnez AAAA-MM-JJ ou un nombre de jours (ex. « 7 »).`;

      const record = await resolveRecord(ref);
      if (!record) {
        return `Aucun dossier ne porte « ${ref} » — ni demande de paiement, ni règlement, ni document Legal, ni dossier Regulatory, ni tâche. Vérifier la référence (search_everything).`;
      }

      // Le journal DEPUIS la date + les étapes réglementaires franchies — en parallèle.
      const [audits, stepsDone] = await Promise.all([
        prisma.auditLog.findMany({
          where: { entityType: record.entityType as never, entityId: record.id, createdAt: { gt: since } },
          select: { createdAt: true, action: true, summary: true, field: true, oldValue: true, newValue: true, actor: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
          take: 120,
        }),
        record.entityType === "REGULATORY_PRODUCT"
          ? prisma.regulatoryStep.findMany({
              where: { productId: record.id, actualDate: { gt: since } },
              select: { type: true, actualDate: true, responsible: true },
              orderBy: { actualDate: "asc" },
            })
          : Promise.resolve([]),
      ]);

      // ÉVÉNEMENT SIGNIFICATIF vs bruit technique : un résumé lisible ou un champ tracé.
      const meaningful = audits.filter((a) => Boolean(a.summary) || Boolean(a.field));

      // QUI a agi sur la période — l'ébauche de « qui a travaillé dessus ».
      const byActor = new Map<string, number>();
      for (const a of meaningful) {
        const name = a.actor?.name ?? "système";
        byActor.set(name, (byActor.get(name) ?? 0) + 1);
      }
      const acteurs = [...byActor.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([nom, actions]) => ({ nom, actions }));

      const changements = meaningful.slice(-25).map((a) => ({
        le: fr(a.createdAt),
        quoi: a.summary ?? a.action,
        ...(a.field ? { champ: a.field, de: a.oldValue, a: a.newValue } : {}),
        ...(a.actor?.name ? { par: a.actor.name } : {}),
      }));

      const etapesFranchies = stepsDone.map((s) => ({
        etape: REGULATORY_STEP_TYPE[s.type] ?? s.type,
        faiteLe: s.actualDate ? fr(s.actualDate) : null,
        ...(s.responsible ? { par: s.responsible } : {}),
      }));

      if (meaningful.length === 0 && etapesFranchies.length === 0) {
        return JSON.stringify({
          type: record.type, reference: record.reference, titre: record.titre,
          depuis: fr(since),
          reponse: "Aucun changement SIGNIFICATIF tracé sur ce dossier depuis cette date — ni au journal, ni sur les étapes.",
          etatActuel: record.etatActuel,
          lien: record.lien,
          rappel: "Le journal ne capture que ce qui a été tracé dans l'ERP — un échange hors système n'y figure pas.",
        });
      }

      return JSON.stringify({
        type: record.type, reference: record.reference, titre: record.titre,
        depuis: fr(since),
        changements: {
          total: audits.length >= 120 ? "120+ (bornés)" : meaningful.length,
          significatifs: changements,
        },
        ...(etapesFranchies.length > 0 ? { etapesFranchies } : {}),
        quiAAgi: acteurs,
        etatActuel: record.etatActuel,
        lien: record.lien,
        rappel: "Changements TRACÉS uniquement — décrire n'est pas expliquer : vérifier la cause (inspect_record) avant d'en tirer une décision.",
      });
    },
  },
];
