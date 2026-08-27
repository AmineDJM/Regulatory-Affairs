import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { buildProposal, executeReadTool, performAction, RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { executeIntentGuarded, intentSummary } from "@/lib/assistant/action-intents";
import type { CapabilityCall, CapabilityOutcome, CapabilityRunner } from "@/lib/missions/ports";
import { capabilityMeta, EFFECT_RANK } from "@/lib/missions/registry/capability-meta";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'EXÉCUTANT RÉEL — le seul point par lequel une mission touche l'ERP (§7 de la doctrine).
 *
 * ── LA RÈGLE, ET CE QU'ELLE INTERDIT ────────────────────────────────────────────────────
 *
 * Une mission passe par le MÊME chemin qu'un clic à l'écran. Pas un chemin parallèle « pour
 * l'automatisation », pas un raccourci « puisque c'est déjà validé ». Littéralement le même :
 *
 *   lecture  → `executeReadTool`, qui revérifie le droit à chaque appel ;
 *   écriture → `buildProposal` (le payload canonique) → `AssistantActionIntent` (l'état serveur)
 *              → `executeIntentGuarded` (la réclamation atomique) → `performAction` (RBAC,
 *              arrêt d'urgence, audit).
 *
 * C'est ce qui donne son sens à « une mission n'est jamais une porte dérobée ». Aucune règle de
 * sécurité n'a besoin d'être répétée ici : elles sont toutes DÉJÀ sur ce chemin, et c'est
 * précisément pour cela qu'on le reprend au lieu d'en écrire un plus court.
 *
 * ── L'IDEMPOTENCE, ET LE TROU QU'ELLE FERME ─────────────────────────────────────────────
 *
 * `executeIntentGuarded` protège d'un double-clic sur un intent EXISTANT. Elle ne protège pas
 * du cas propre aux missions : le processus meurt entre la création de l'intent et son
 * exécution, et la reprise ignore que le premier existe. La clé d'idempotence — unique EN BASE
 * — ferme ce trou : la reprise RETROUVE l'intent au lieu d'en créer un second.
 *
 * ── CE QUE LE RUNNER NE FAIT PAS ────────────────────────────────────────────────────────
 *
 * Il ne décide pas si une action est autorisée : `performAction` le fait. Il ne décide pas si
 * elle doit être approuvée : la porte d'approbation est un NŒUD du graphe, en amont. Il ne
 * réessaie pas : c'est le moteur qui compte les tentatives. Il exécute, et il rend un reçu.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const estEcriture = (n: string): boolean => RESOLVER_WRITE_NAMES.has(n);

/** Un texte d'outil rendu en objet quand c'en est un — sinon, tel quel sous `texte`. */
function structurer(brut: string): unknown {
  const t = brut.trim();
  if (!t) return { texte: "" };
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return JSON.parse(t);
    } catch {
      // Une lecture qui commence par une accolade sans être du JSON est presque toujours un
      // message d'erreur formaté. On le garde en texte plutôt que de le perdre.
      return { texte: t };
    }
  }
  return { texte: t };
}

/**
 * LES RÉPONSES QUI SONT DES REFUS.
 *
 * `executeReadTool` rend une PHRASE quand le droit manque ou que la lecture échoue — c'est le
 * bon comportement en conversation, où un humain lit la phrase. Dans une mission, une phrase
 * d'excuse rangée comme un résultat serait ensuite comptée comme une étape réussie, et le
 * contrôle qualité la validerait. On la reconnaît donc et on ÉCHOUE l'étape.
 */
const REFUS = [
  /ne vous est pas ouvert/i,
  /^la lecture a échoué/i,
  /je préfère ne rien avancer/i,
];

export class ExecutantReel implements CapabilityRunner {
  constructor(private readonly user: CurrentUser) {}

  async run(call: CapabilityCall): Promise<CapabilityOutcome> {
    if (call.actor.userId !== this.user.id) {
      // UN EXÉCUTANT NE SERT QU'UNE PERSONNE. Un acteur qui ne correspond pas signale un
      // composeur réutilisé à tort — et l'exécuter emprunterait les droits de quelqu'un d'autre.
      return {
        ok: false,
        output: null,
        error: { kind: "MISSING_PERMISSION", message: "l'exécutant n'appartient pas à cet acteur", retryable: false },
      };
    }

    const meta = capabilityMeta(call.capability, estEcriture);
    const ecrit = EFFECT_RANK[meta.effect] >= EFFECT_RANK.INTERNAL_REVERSIBLE_WRITE;

    return ecrit ? this.ecrire(call) : this.lire(call);
  }

  // ── LECTURE ────────────────────────────────────────────────────────────────────────
  private async lire(call: CapabilityCall): Promise<CapabilityOutcome> {
    let brut: string;
    try {
      brut = await executeReadTool(call.capability, call.input, this.user);
    } catch (e) {
      return {
        ok: false,
        output: null,
        error: {
          kind: "CAPABILITY_FAILURE",
          message: e instanceof Error ? e.message : "la lecture a échoué",
          retryable: true,
        },
      };
    }

    if (REFUS.some((r) => r.test(brut))) {
      return {
        ok: false,
        output: null,
        error: {
          kind: brut.match(/ne vous est pas ouvert/i) ? "MISSING_PERMISSION" : "CAPABILITY_FAILURE",
          message: brut.slice(0, 300),
          retryable: !brut.match(/ne vous est pas ouvert/i),
        },
      };
    }

    return { ok: true, output: structurer(brut) };
  }

  // ── ÉCRITURE ───────────────────────────────────────────────────────────────────────
  private async ecrire(call: CapabilityCall): Promise<CapabilityOutcome> {
    const cle = call.idempotencyKey;

    // 1. UN INTENT DÉJÀ EXÉCUTÉ REND SON REÇU, SANS RIEN RELANCER.
    if (cle) {
      const deja = await prisma.assistantActionIntent.findUnique({
        where: { idempotencyKey: cle },
        select: { id: true, status: true, resultMessage: true, resultLink: true },
      });
      if (deja?.status === "EXECUTED") {
        return {
          ok: true,
          deduplicated: true,
          output: { receipt: deja.id, message: deja.resultMessage, link: deja.resultLink, rejoue: true },
        };
      }
      if (deja) return this.executerIntent(deja.id);
    }

    // 2. LE PAYLOAD CANONIQUE — celui-là même que produit la conversation.
    const proposition = await buildProposal(call.capability, call.input, this.user);
    if ("error" in proposition) {
      return {
        ok: false,
        output: null,
        error: { kind: "INVALID_STEP", message: proposition.error, retryable: false },
      };
    }
    if (proposition.warnings.length > 0 && proposition.fields.length === 0) {
      // Une proposition sans aucun champ résolu ET avec des avertissements est une cible
      // introuvable : agir dessus enverrait dans le vide. C'est un CIBLE_INTROUVABLE, pas une
      // panne — la récupération sait quoi en faire (chercher ailleurs, demander).
      return {
        ok: false,
        output: null,
        error: { kind: "TARGET_NOT_FOUND", message: proposition.warnings.join(" ; "), retryable: false },
      };
    }

    // 3. L'INTENT — l'état serveur canonique, porteur de la clé et du reçu.
    let intentId: string;
    try {
      const cree = await prisma.assistantActionIntent.create({
        data: {
          userId: this.user.id,
          kind: proposition.kind,
          module: proposition.module,
          title: proposition.title,
          summary: intentSummary(proposition),
          payload: proposition.payload as never,
          status: "CONFIRMED",
          origin: "text",
          level: proposition.level ?? null,
          confirmText: proposition.confirmText ?? null,
          idempotencyKey: cle,
          missionId: call.missionId,
          events: [{ status: "PROPOSED", at: new Date().toISOString() }] as never,
        },
        select: { id: true },
      });
      intentId = cree.id;
    } catch {
      // LA COURSE : deux exécutions concurrentes de la même étape. La contrainte d'unicité a
      // désigné un gagnant ; le perdant reprend l'intent du gagnant au lieu d'en créer un
      // second. C'est exactement le comportement voulu, et il est garanti par la base.
      const gagnant = cle
        ? await prisma.assistantActionIntent.findUnique({ where: { idempotencyKey: cle }, select: { id: true } })
        : null;
      if (!gagnant) {
        return {
          ok: false,
          output: null,
          error: { kind: "CAPABILITY_FAILURE", message: "l'action n'a pas pu être enregistrée", retryable: true },
        };
      }
      intentId = gagnant.id;
    }

    return this.executerIntent(intentId);
  }

  /**
   * EXÉCUTE SOUS L'INTENT — réclamation atomique, RBAC revérifié, reçu persisté.
   *
   * `performAction` est le MÊME appel que celui de la carte de confirmation à l'écran.
   */
  private async executerIntent(intentId: string): Promise<CapabilityOutcome> {
    const garde = await executeIntentGuarded(this.user, intentId, async (stored) =>
      performAction(this.user, stored as Parameters<typeof performAction>[1]));

    if (!garde) {
      return {
        ok: false,
        output: null,
        error: { kind: "CAPABILITY_FAILURE", message: "l'intent d'action est introuvable", retryable: false },
      };
    }
    if (!garde.ok) {
      return {
        ok: false,
        output: null,
        error: {
          kind: "CAPABILITY_FAILURE",
          message: garde.error ?? "l'action a échoué",
          // Un échec d'exécution est rejouable : la clé garantit qu'un rejeu ne double pas
          // l'effet, et la plupart de ces échecs sont transitoires.
          retryable: true,
        },
      };
    }
    return {
      ok: true,
      deduplicated: garde.alreadyExecuted === true,
      output: { receipt: intentId, message: garde.message, link: garde.link },
    };
  }
}
