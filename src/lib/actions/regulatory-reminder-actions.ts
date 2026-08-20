"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { regulatoryReminderBoard } from "@/lib/queries/regulatory-reminders";
import {
  canSendUpdateReminder, reminderTitle, reminderBody, reminderAuditSummary, reminderResultMessage,
} from "@/lib/regulatory/update-reminder";

/**
 * LA RELANCE DE MISE À JOUR — « où en sont vos dossiers ? », posé d'en haut.
 *
 * Une personne en particulier, ou tout le monde d'un coup. Réservée au Super Admin et au
 * Directeur Général : une relance dit « la direction vous attend », et entre les mains d'un pair
 * elle devient un moyen de pression latéral.
 *
 * Les CHIFFRES ne viennent jamais du navigateur. Le formulaire n'envoie qu'un destinataire et
 * une note ; le portefeuille et la part en sommeil sont recalculés ici, dans le périmètre de
 * celui qui relance. Sans cela, on pourrait faire dire n'importe quoi à la notification — et
 * surtout envoyer un décompte qui ne correspond à rien.
 */
export async function sendRegulatoryUpdateReminder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canSendUpdateReminder(user)) {
    return { ok: false, error: "Réservé au Super Admin et au Directeur Général." };
  }

  const note = fdStr(formData, "note");
  // Vide = tout le monde. C'est le geste le plus courant, il est donc le défaut du formulaire.
  const only = fdStr(formData, "recipientId");

  const board = await regulatoryReminderBoard(user);
  const targets = only ? board.targets.filter((t) => t.userId === only) : board.targets;
  if (only && targets.length === 0) {
    // La personne a pu être retirée de ses dossiers entre l'affichage et le clic.
    return { ok: false, error: "Cette personne ne porte plus aucun dossier à traiter." };
  }
  if (targets.length === 0) return { ok: true, message: reminderResultMessage(0) };

  const toEveryone = !only;
  for (const t of targets) {
    await notifyUser({
      userId: t.userId,
      type: "GENERIC",
      title: reminderTitle(),
      body: reminderBody(t, note),
      link: "/regulatory",
    });
  }
  // L'historique retient le portefeuille AU MOMENT de la relance : relu des mois plus tard,
  // « 12 dossiers » explique la relance mieux que le portefeuille d'aujourd'hui.
  await prisma.regulatoryUpdateReminder.createMany({
    data: targets.map((t) => ({
      recipientId: t.userId,
      senderId: user.id,
      dossierCount: t.total,
      staleCount: t.stale,
      toEveryone,
      note: note ?? null,
    })),
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Regulatory",
    summary: reminderAuditSummary(targets.map((t) => t.name), note),
  });

  revalidatePath("/regulatory");
  return { ok: true, message: reminderResultMessage(targets.length) };
}
