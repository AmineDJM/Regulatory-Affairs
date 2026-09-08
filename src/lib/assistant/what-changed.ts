import type { PowerTool } from "@/lib/assistant/power-tools";
import type { CurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { resolveRecord } from "@/lib/assistant/time-travel";
import { REGULATORY_STEP_TYPE } from "@/lib/labels";
import { startChangeFeed, recentChanges, feedHealth } from "./platform/change-feed";

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

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE SEULE FORME, QUOI QU'IL ARRIVE (§118.20) — c'est la VALEUR qui dit l'absence.
 *
 * Cet outil rendait SIX formes selon ce qu'il trouvait, dont trois qui n'étaient même pas du
 * JSON : le flux éteint rendait une phrase, la date illisible une phrase, le dossier inconnu une
 * phrase ; le flux vide rendait `{changements: 0, precision}` et le flux plein
 * `{changements, depuis, portee, faits, suite}` — où `changements` était un NOMBRE ici et un
 * OBJET `{total, significatifs}` là. Le planificateur écrit ses références AVANT de savoir ce
 * que la lecture rendra : il ne pouvait pas gagner. Une référence sur `faits` mourait le jour
 * où le flux était vide, une référence sur `changements.significatifs` le jour où il ne l'était
 * pas — et une étape morte coûte une replanification entière.
 *
 * Les clés sont donc TOUJOURS les mêmes, et c'est la valeur qui parle : une liste VIDE pour
 * « rien trouvé » (le moteur sait déjà l'ignorer : « si la liste amont est vide, l'étape est
 * ignorée »), `null` pour un scalaire absent, et une `precision` qui dit toujours ce que la
 * réponse couvre ET ce qu'elle ne couvre pas. Un « rien n'a changé » qui signifierait en
 * réalité « je viens de démarrer » serait un mensonge tranquille, du genre qui fait rater une
 * validation urgente.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
interface ReponseChangements {
  portee: "flux" | "dossier";
  type: string | null;
  reference: string | null;
  titre: string | null;
  depuis: string | null;
  changements: Record<string, unknown>[];
  etapesFranchies: Record<string, unknown>[];
  quiAAgi: { nom: string; actions: number }[];
  /** L'état du dossier, tel que la fiche le publie. `null` sur le flux — jamais absent. */
  etatActuel: Record<string, unknown> | null;
  lien: string | null;
  /** Renseigné quand la lecture a buté sur sa borne — sinon `null`, jamais absent. */
  borne: string | null;
  /** Ce que la réponse couvre ET ce qu'elle ne couvre pas. Toujours une phrase. */
  precision: string;
}

const VIDE: Omit<ReponseChangements, "portee" | "precision"> = {
  type: null, reference: null, titre: null, depuis: null,
  changements: [], etapesFranchies: [], quiAAgi: [], etatActuel: null, lien: null, borne: null,
};

const repondre = (r: Partial<ReponseChangements> & Pick<ReponseChangements, "portee" | "precision">): string =>
  JSON.stringify({ ...VIDE, ...r });

/**
 * « QUOI DE NEUF ? » SANS RÉFÉRENCE — servi par le flux d'événements de la frontière.
 *
 * ATTENTION À CE QUE CETTE RÉPONSE DIT VRAIMENT. Le flux est en mémoire du processus : il voit
 * ce qui s'est passé depuis le démarrage de CE serveur, pas l'histoire complète.
 */
function liveFeedAnswer(): string {
  startChangeFeed();
  const health = feedHealth();
  const changes = recentChanges({ limit: 30 });

  if (!health.started) {
    return repondre({
      portee: "flux",
      precision: "Le flux de changements n'est pas actif sur ce serveur : je ne peux pas dire ce qui a bougé à l'instant. "
        + "La liste est vide parce que la source est éteinte, PAS parce que rien n'a bougé. Pour un dossier précis, donner sa référence.",
    });
  }
  if (changes.length === 0) {
    return repondre({
      portee: "flux",
      depuis: health.oldest,
      precision: "Aucun changement depuis le démarrage de ce serveur. Ce n'est pas l'histoire complète : pour un dossier précis, donner sa référence.",
    });
  }
  return repondre({
    portee: "flux",
    depuis: health.oldest,
    changements: changes.map((c) => ({
      quoi: c.type,
      sujet: `${c.subjectType}/${c.subjectId}`,
      libelle: c.label,
      quand: c.at,
    })),
    precision: "Faits survenus depuis le démarrage de ce serveur — indice de fraîcheur, pas journal exhaustif. "
      + "Pour le détail d'un de ces sujets, appeler inspect_record ou what_changed avec sa référence.",
  });
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
          reference: { type: "string", description: "Référence (PAY-…, REG-…) ou fragment de titre du dossier. OMETTRE pour « quoi de neuf dans l'entreprise, à l'instant ? »." },
          since: { type: "string", description: "La date de référence : AAAA-MM-JJ, ou un nombre de jours en arrière (ex. « 7 »). Inutile sans référence." },
        },
        required: [],
      },
    },
    allowed: EXEC,
    label: "Changements depuis la date",
    run: async (input, user) => {
      void user;
      const ref = str(input, "reference");
      const rawSince = str(input, "since");

      // SANS RÉFÉRENCE : « quoi de neuf tout court ? ». Cette question-là n'avait aucune réponse
      // rapide — il fallait balayer une dizaine de tables et comparer des horodatages. Le flux
      // d'événements y répond en mémoire, sans base ni réseau.
      if (ref.length < 2) return liveFeedAnswer();
      const since = parseSince(rawSince);
      // Un refus garde la MÊME forme que la réponse : le planificateur a écrit ses références
      // avant de savoir si la date serait lisible, et une forme différente les tue toutes.
      if (!since) {
        return repondre({
          portee: "dossier", reference: ref,
          precision: `Date de référence illisible : « ${rawSince} ». La liste est vide parce que la QUESTION n'a pas pu être posée, `
            + "pas parce que rien n'a changé. Donner AAAA-MM-JJ ou un nombre de jours (ex. « 7 »).",
        });
      }

      const record = await resolveRecord(ref);
      if (!record) {
        return repondre({
          portee: "dossier", reference: ref, depuis: fr(since),
          precision: `Aucun dossier ne porte « ${ref} » — ni demande de paiement, ni règlement, ni document Legal, ni dossier `
            + "Regulatory, ni tâche. La liste est vide parce que le SUJET est introuvable, pas parce que rien n'a changé. "
            + "Vérifier la référence (search_everything).",
        });
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

      const rien = meaningful.length === 0 && etapesFranchies.length === 0;
      return repondre({
        portee: "dossier",
        type: record.type, reference: record.reference, titre: record.titre,
        depuis: fr(since),
        changements, etapesFranchies, quiAAgi: acteurs,
        etatActuel: record.etatActuel,
        lien: record.lien,
        borne: audits.length >= 120 ? "journal borné à 120 mouvements : les plus anciens de la période ne sont pas listés" : null,
        precision: rien
          ? "Aucun changement SIGNIFICATIF tracé sur ce dossier depuis cette date — ni au journal, ni sur les étapes. "
            + "Le journal ne capture que ce qui a été tracé dans l'ERP : un échange hors système n'y figure pas."
          : "Changements TRACÉS uniquement — décrire n'est pas expliquer : vérifier la cause (inspect_record) avant d'en tirer une décision.",
      });
    },
  },
];
