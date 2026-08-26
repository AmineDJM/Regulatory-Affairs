import { prisma } from "@/lib/prisma";
import { userCan, MODULES, ACTIONS, hasGlobalView, type Module, type Action } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { findPeople } from "@/lib/directory/resolve";
import { DirectoryChannel } from "@prisma/client";
import { subscribe as busSubscribe } from "../event-bus";
import {
  PLATFORM_CONTRACT_VERSION,
  type CommandOutcome, type ContactEndpoint, type EventHandler, type PendingDecision,
  type PersonView, type PlatformCommand, type PlatformPort, type PlatformQuery,
  type PlatformQueryResult, type Principal, type RecordView, type Unsubscribe,
} from "../contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ADAPTATEUR EN-PROCESSUS — LE SEUL FICHIER D'ADAM QUI A LE DROIT DE CONNAÎTRE L'ERP.
 *
 * ── CE QU'IL EST ─────────────────────────────────────────────────────────────────────────
 *
 * L'implémentation du contrat par des APPELS DE FONCTION. Pas de HTTP, pas de sérialisation,
 * pas de réseau : le coût par rapport à l'existant est nul, à la nanoseconde près. C'est le
 * cœur du compromis choisi — **on sépare le code sans séparer le déploiement**, donc on gagne
 * l'indépendance sans jamais payer la latence des microservices.
 *
 * Le jour où Adam devient un service à part, ce fichier reste ici (côté ERP), un second
 * adaptateur HTTP naît côté Adam, et le reste d'Adam ne change pas d'une ligne — parce qu'il ne
 * connaît que `PlatformPort`.
 *
 * ── LA DISCIPLINE ────────────────────────────────────────────────────────────────────────
 *
 * Tout ce qui est sale est ICI, et nulle part ailleurs : Prisma, `CurrentUser`, les énumérés
 * générés, les fonctions internes. Ce fichier TRADUIT ; il ne décide de rien.
 *
 * `boundary.test.ts` échoue si un autre fichier d'Adam importe l'ERP. C'est ce test, et non
 * l'intention, qui maintient la frontière quand quinze autres lots passeront par là.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════════════════════════════════
// IDENTITÉ — traduire `CurrentUser` en `Principal`
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * RÉSOUT les capacités d'une personne, UNE FOIS, au début du tour.
 *
 * Pourquoi tout aplatir d'un coup plutôt qu'interroger à la demande : Adam filtre sa liste
 * d'outils à chaque tour, ce qui représente des dizaines de vérifications. Les faire une par une
 * en asynchrone ajouterait des dizaines d'allers-retours sur le chemin critique, pour un
 * résultat identique — l'accès est déjà entièrement résolu en mémoire par `getAccess`.
 *
 * Ce que cela ne change PAS : ces capacités servent à FILTRER (montrer, proposer). Elles
 * n'autorisent rien. `authorize()` et, surtout, l'action canonique elle-même restent seules
 * juges au moment d'exécuter.
 */
export function principalOf(user: CurrentUser): Principal {
  const capabilities = new Set<string>();
  for (const m of MODULES) {
    for (const a of ACTIONS) {
      if (userCan(user, m as Module, a as Action)) capabilities.add(`${m}:${a}`);
    }
  }
  if (hasGlobalView(user)) capabilities.add("platform:global-view");
  if (user.role === "SUPER_ADMIN") capabilities.add("platform:super-admin");

  return {
    id: user.id,
    displayName: user.name,
    email: user.email,
    role: String(user.role),
    capabilities,
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// TRADUCTIONS
// ═════════════════════════════════════════════════════════════════════════════════════════════

const CONFIDENCE_LABEL: Record<string, string> = {
  VERIFIED_INTERNAL: "vérifiée en interne",
  VERIFIED_PROVIDER: "compte / fiche ERP",
  OBSERVED_HISTORY: "vue en correspondance",
  INFERRED: "déduite — à confirmer",
};

const channelOf = (c: DirectoryChannel): ContactEndpoint["channel"] =>
  c === DirectoryChannel.EMAIL ? "email" : c === DirectoryChannel.PHONE ? "phone" : "whatsapp";

/** `PersonMatch` (interne, riche en identifiants techniques) → `PersonView` (ce qu'Adam voit). */
function toPersonView(m: {
  key: string; name: string; jobTitle: string | null; company: string | null;
  endpoints: { channel: DirectoryChannel; value: string; label: string | null; confidence: string; isPrimary: boolean }[];
}): PersonView {
  return {
    id: m.key,
    fullName: m.name,
    jobTitle: m.jobTitle,
    department: null,
    company: m.company,
    endpoints: m.endpoints.map((e) => ({
      channel: channelOf(e.channel),
      value: e.value,
      label: e.label,
      confidence: CONFIDENCE_LABEL[e.confidence] ?? e.confidence,
      primary: e.isPrimary,
    })),
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LECTURES
// ═════════════════════════════════════════════════════════════════════════════════════════════

async function runQuery(principal: Principal, q: PlatformQuery): Promise<PlatformQueryResult> {
  switch (q.kind) {
    case "person.search": {
      const people = await findPeople(q.text, q.limit ?? 5);
      return { kind: "person.search", people: people.map(toPersonView), total: people.length };
    }

    case "person.list": {
      // LE REGISTRE COMPLET EST GARDÉ — chercher UNE personne est un geste d'annuaire, ouvert ;
      // extraire TOUT LE MONDE avec les coordonnées de chacun est une extraction. La porte est
      // la même qu'à l'écran, et elle est revérifiée ici, pas héritée du contexte d'appel.
      const allowed = principal.capabilities.has("RH:VIEW")
        || principal.capabilities.has("platform:global-view")
        || principal.capabilities.has("platform:super-admin");
      if (!allowed) return { kind: "person.list", people: [], total: 0 };

      const rows = await prisma.employee.findMany({
        where: {
          isActive: true,
          ...(q.department ? { department: { contains: q.department, mode: "insensitive" } } : {}),
        },
        orderBy: { fullName: "asc" },
        take: Math.min(q.limit ?? 100, 300),
        select: {
          id: true, fullName: true, position: true, department: true, email: true, phone: true,
          company: { select: { shortName: true, name: true } },
          user: { select: { email: true } },
          directoryEntry: {
            select: { endpoints: { where: { isActive: true }, select: { channel: true, value: true, label: true, confidence: true, isPrimary: true } } },
          },
        },
      });

      const people: PersonView[] = rows.map((e) => {
        const seen = new Map<string, ContactEndpoint>();
        for (const p of e.directoryEntry?.endpoints ?? []) {
          seen.set(p.value.toLowerCase(), {
            channel: channelOf(p.channel), value: p.value, label: p.label,
            confidence: CONFIDENCE_LABEL[p.confidence] ?? String(p.confidence), primary: p.isPrimary,
          });
        }
        for (const fallback of [e.email, e.user?.email]) {
          if (fallback && !seen.has(fallback.toLowerCase())) {
            seen.set(fallback.toLowerCase(), {
              channel: "email", value: fallback.toLowerCase(), label: "fiche ERP",
              confidence: CONFIDENCE_LABEL.VERIFIED_PROVIDER, primary: false,
            });
          }
        }
        if (e.phone && !seen.has(e.phone.toLowerCase())) {
          seen.set(e.phone.toLowerCase(), {
            channel: "phone", value: e.phone, label: "fiche ERP",
            confidence: CONFIDENCE_LABEL.VERIFIED_PROVIDER, primary: false,
          });
        }
        return {
          id: e.id,
          fullName: e.fullName,
          jobTitle: e.position,
          department: e.department,
          company: e.company?.shortName ?? e.company?.name ?? null,
          endpoints: [...seen.values()],
        };
      });
      return { kind: "person.list", people, total: people.length };
    }

    case "record.get":
    case "record.search":
    case "pending-decisions.list":
      // DÉCLARÉES, PAS ENCORE SERVIES — et le dire est plus honnête que rendre un tableau vide,
      // qui se lirait « il n'y a rien » au lieu de « je ne sais pas encore faire ». Ces lectures
      // passent aujourd'hui par les outils historiques ; elles migreront ici avec leur tranche.
      throw new Error(`Lecture « ${q.kind} » pas encore servie par l'adaptateur en-processus.`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// COMMANDES
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * L'EXÉCUTION DES ACTIONS RESTE À L'ERP, ENTIÈREMENT.
 *
 * L'adaptateur ne fait que passer le plat : il n'évalue aucun droit, ne contourne aucune
 * approbation, ne fabrique aucun raccourci. `performAction` conserve l'arrêt d'urgence, les
 * portes, la revalidation canonique, l'audit et l'idempotence — c'est-à-dire tout ce qui compte.
 *
 * L'import est PARESSEUX, et pas par élégance : `@/lib/assistant` est le gros module d'Adam, et
 * le charger au premier import de l'adaptateur créerait un cycle (Adam → adaptateur → Adam).
 */
async function runCommand(principal: Principal, cmd: PlatformCommand): Promise<CommandOutcome> {
  const { performAction } = await import("@/lib/assistant");
  const { getCurrentUser } = await import("@/lib/session");

  // L'IDENTITÉ EST RELUE À LA SOURCE, jamais reconstruite depuis le `Principal`. Un `Principal`
  // est une VUE, éventuellement périmée ; laisser Adam fabriquer l'utilisateur qui exécute
  // reviendrait à lui laisser fabriquer ses propres droits.
  const user = await getCurrentUser();
  if (!user || user.id !== principal.id) {
    return { ok: false, refused: true, reason: "Session absente ou différente de celle qui a demandé l'action." };
  }

  const payload = { kind: cmd.actionId, ...cmd.args, idempotencyKey: cmd.idempotencyKey } as never;
  const res = await performAction(user, payload);

  if (res.ok) {
    return { ok: true, message: res.message ?? "Fait.", link: res.link ?? null, createdId: res.createdId ?? null };
  }
  // On distingue le REFUS (la plateforme a décidé) de la PANNE (elle n'a pas pu décider). Adam
  // dit un refus tel quel ; une panne, il peut la réessayer. Les confondre produit soit des
  // relances sur un refus définitif, soit un abandon sur une erreur passagère.
  return { ok: false, refused: true, reason: res.error ?? "Action refusée." };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LE PORT
// ═════════════════════════════════════════════════════════════════════════════════════════════

export const inProcessPlatform: PlatformPort = {
  contractVersion: PLATFORM_CONTRACT_VERSION,

  query: (principal, query) => runQuery(principal, query),
  command: (principal, command) => runCommand(principal, command),

  /**
   * LA RÉPONSE QUI FAIT FOI. Contrairement aux capacités portées par le `Principal` — un
   * instantané destiné au filtrage rapide — celle-ci est relue à l'instant.
   */
  async authorize(principal, capability) {
    const [moduleName, action] = capability.split(":");
    if (!moduleName || !action) return false;
    const { getCurrentUser } = await import("@/lib/session");
    const user = await getCurrentUser();
    if (!user || user.id !== principal.id) return false;
    if (capability === "platform:global-view") return hasGlobalView(user);
    if (capability === "platform:super-admin") return user.role === "SUPER_ADMIN";
    return userCan(user, moduleName as Module, action as Action);
  },

  subscribe(handler: EventHandler): Unsubscribe {
    return busSubscribe(handler);
  },
};
