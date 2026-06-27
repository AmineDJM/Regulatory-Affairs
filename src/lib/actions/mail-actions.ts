"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { encryptSecret, getMailAccount, testImap, sendMail } from "@/lib/mail";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

/** Connecte (ou met à jour) la boîte mail Infomaniak de l'utilisateur. Teste IMAP avant d'enregistrer. */
export async function connectMailbox(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const email = fdStr(formData, "email");
  const password = fdStr(formData, "password");
  if (!email || !password) return { ok: false, error: "Adresse e-mail et mot de passe d'application requis." };

  const imapHost = fdStr(formData, "imapHost") ?? "mail.infomaniak.com";
  const imapPort = fdNum(formData, "imapPort") ?? 993;
  const smtpHost = fdStr(formData, "smtpHost") ?? "mail.infomaniak.com";
  const smtpPort = fdNum(formData, "smtpPort") ?? 465;
  const passwordEnc = encryptSecret(password);

  // Vérifie la connexion IMAP avant d'enregistrer (sinon message clair).
  const err = await testImap({ email, passwordEnc, imapHost, imapPort });
  if (err) return { ok: false, error: `Connexion impossible : ${err}. Vérifiez l'adresse et le mot de passe d'application Infomaniak.` };

  await prisma.mailAccount.upsert({
    where: { userId: user.id },
    update: { email, displayName: fdStr(formData, "displayName") ?? user.name, imapHost, imapPort, smtpHost, smtpPort, passwordEnc },
    create: { userId: user.id, email, displayName: fdStr(formData, "displayName") ?? user.name, imapHost, imapPort, smtpHost, smtpPort, passwordEnc },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Courrier", summary: `Boîte mail connectée (${email})` });
  revalidatePath("/courrier");
  return { ok: true };
}

export async function disconnectMailbox(): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.mailAccount.deleteMany({ where: { userId: user.id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Courrier", summary: "Boîte mail déconnectée" });
  revalidatePath("/courrier");
  return { ok: true };
}

export async function sendMailAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const account = await getMailAccount(user.id);
  if (!account) return { ok: false, error: "Aucune boîte connectée." };
  const to = fdStr(formData, "to");
  const subject = fdStr(formData, "subject") ?? "(sans objet)";
  if (!to) return { ok: false, error: "Destinataire requis." };
  try {
    await sendMail(account, { to, cc: fdStr(formData, "cc") ?? undefined, subject, text: fdStr(formData, "body") ?? "" });
  } catch (e) {
    return { ok: false, error: `Envoi impossible : ${(e as Error)?.message ?? "erreur SMTP"}.` };
  }
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Courrier", summary: `E-mail envoyé à ${to}` });
  return { ok: true };
}
