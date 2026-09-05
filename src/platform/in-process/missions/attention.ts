/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PORTE D'ATTENTION — le seul endroit d'où une mission parle au dirigeant.
 *
 * Elle reçoit un SIGNAL typé du runtime (conclusion, blocage, accord, question, attente échue),
 * lui donne un niveau par la politique (`attention/policy.ts`), refuse de redire ce qui a déjà
 * été dit (clé + cadence, relues dans le journal canonique de la mission — pas de table de plus),
 * rétrograde en JOURNAL au-delà du plafond quotidien, compose le message exécutif, et livre :
 * la notification interne (toujours à partir de JOURNAL), le push (INFO et au-delà), l'e-mail
 * (ATTENTION et au-delà — depuis la boîte que la personne a connectée, vers sa propre adresse ;
 * sans boîte, le journal DIT que l'e-mail n'est pas parti).
 *
 * Tout ce qui est envoyé est inscrit au journal (`NOTIFIED`, avec niveau, clé et canaux) : le
 * dirigeant peut relire pourquoi il a été dérangé, et un banc peut compter.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { getMailAccount, sendMail } from "@/lib/mail";
import { journaliser } from "@/lib/missions/runtime/store";
import { cadenceMs, canauxPour, classer, cleDe, composerMessage, PLAFOND_QUOTIDIEN } from "@/lib/missions/attention/policy";
import type { NiveauSignal, PorteAttention, SignalAttention } from "@/lib/missions/ports";

export interface DependancesAttention {
  /** L'envoi d'e-mail, injectable : les tests ne montent pas de SMTP. Défaut : la boîte connectée de la personne. */
  envoyerMail?: (ownerId: string, sujet: string, corps: string) => Promise<"envoye" | "sans-boite" | "echec">;
  maintenant?: () => Date;
}

async function envoyerParBoiteConnectee(ownerId: string, sujet: string, corps: string): Promise<"envoye" | "sans-boite" | "echec"> {
  const compte = await getMailAccount(ownerId).catch(() => null);
  if (!compte) return "sans-boite";
  try {
    await sendMail(compte, { to: compte.email, subject: sujet, text: corps });
    return "envoye";
  } catch {
    return "echec";
  }
}

/** Le dernier signal de même clé, pour la cadence. Lu dans le journal, jamais en mémoire. */
async function dernierSignal(missionId: string, cle: string): Promise<Date | null> {
  const e = await prisma.missionEvent.findFirst({
    where: { missionId, kind: "NOTIFIED", detail: { path: ["cle"], equals: cle } },
    orderBy: { at: "desc" },
    select: { at: true },
  }).catch(() => null);
  return e?.at ?? null;
}

/** Les signaux INFO/ATTENTION/ARBITRAGE des dernières 24 h pour cette personne — toutes missions. */
async function signauxDuJour(ownerId: string, depuis: Date): Promise<number> {
  return prisma.missionEvent.count({
    where: {
      kind: "NOTIFIED", at: { gte: depuis },
      mission: { ownerId },
      OR: [{ detail: { path: ["niveau"], equals: "INFO" } }, { detail: { path: ["niveau"], equals: "ATTENTION" } }, { detail: { path: ["niveau"], equals: "ARBITRAGE" } }],
    },
  }).catch(() => 0);
}

export function porteAttentionPour(deps: DependancesAttention = {}): PorteAttention {
  const envoyer = deps.envoyerMail ?? envoyerParBoiteConnectee;
  const horloge = deps.maintenant ?? (() => new Date());
  return {
    async signaler(signal: SignalAttention) {
      let niveau: NiveauSignal = classer(signal);
      const cle = cleDe(signal);
      const maintenant = horloge();
      if (niveau === "SILENCE") return { niveau, canaux: [], supprime: false };

      // ── LA CADENCE : le même fait ne se redit pas ─────────────────────────────────────
      const dernier = await dernierSignal(signal.missionId, cle);
      if (dernier && maintenant.getTime() - dernier.getTime() < cadenceMs(niveau)) {
        return { niveau, canaux: [], supprime: true };
      }
      // ── LE PLAFOND QUOTIDIEN : au-delà, on rétrograde — jamais un arbitrage ──────────
      if (niveau === "INFO" || niveau === "ATTENTION") {
        const n = await signauxDuJour(signal.ownerId, new Date(maintenant.getTime() - 24 * 3600_000));
        if (n >= PLAFOND_QUOTIDIEN) niveau = "JOURNAL";
      }
      const canaux = canauxPour(niveau);
      // Le moteur ne connaît pas le titre affiché ; le pont le relit.
      const titreMission = signal.titre
        || (await prisma.mission.findUnique({ where: { id: signal.missionId }, select: { title: true } }).catch(() => null))?.title
        || "Mission";
      const { titre, corps } = composerMessage({ ...signal, titre: titreMission });
      const livres: string[] = [];

      if (canaux.notification) {
        const type = signal.kind === "APPROVAL_REQUIRED" || signal.kind === "PLAN_CHANGED" || signal.kind === "QUESTION" ? "VALIDATION_REQUIRED" : "GENERIC";
        await notifyUser({
          userId: signal.ownerId, type, title: titre, body: corps, link: `/missions/${signal.missionId}`,
          // Sans push pour JOURNAL : la ligne existe au centre de notifications, l'appareil ne vibre pas.
          // `sendPushToUser` ne sait pas se taire ; un tag vide et non insistant reste le minimum.
          push: canaux.push ? { tag: `mission-${signal.missionId}-${signal.kind}`, requireInteraction: canaux.insistant } : { tag: `mission-${signal.missionId}-journal`, requireInteraction: false },
        });
        livres.push("notification");
        if (canaux.push) livres.push("push");
      }
      let email: "envoye" | "sans-boite" | "echec" | "non-requis" = "non-requis";
      if (canaux.email) {
        email = await envoyer(signal.ownerId, `[Adam] ${titre}`, `${corps}\n\nOuvrir la mission : /missions/${signal.missionId}`);
        if (email === "envoye") livres.push("email");
      }
      // JOURNALISÉ À L'HEURE DE LA PORTE : c'est ce journal que la cadence et le plafond relisent.
      await journaliser(signal.missionId, "NOTIFIED", `${niveau} — ${titre} : ${corps}`, {
        niveau, cle, canaux: livres, email, kind: signal.kind, ...(signal.stepKey ? { stepKey: signal.stepKey } : {}),
      }, undefined, maintenant);
      return { niveau, canaux: livres, supprime: false };
    },
  };
}
