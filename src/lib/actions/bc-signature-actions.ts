"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { etatDuBC } from "@/lib/bons-de-commande/etat";
import { CHEMIN_BC_A_SIGNER } from "@/lib/bons-de-commande/aiguillage";
import { motifNonSignable } from "@/lib/bons-de-commande/regle";
import { bcVisiblesWhere, peutSignerBC, REFUS_SIGNATURE_BC } from "@/lib/queries/bons-de-commande";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * SIGNER UN BON DE COMMANDE — le geste des signataires (§118.149), module à part (§118.176).
 *
 * « Si un BC se retrouve là-bas, c'est qu'il doit être signé. » La signature est une
 * ATTESTATION : elle engage la société au nom d'une personne, et l'audit portera son nom. Elle
 * se donne donc par un CLIC, dans une vraie session — jamais par Adam, jamais par le chemin
 * générique (le fichier est une surface humaine, §118.15, `actions/generique.ts`).
 *
 * Trois gardes, dans l'ordre où elles se lisent : le DROIT (« Modifier » sur le module « Bons de
 * commande », que le Super Admin accorde à qui il veut), la LECTURE (la même
 * portée que l'écran Legal : un BC restreint ne se signe pas par quelqu'un qui ne peut pas le
 * voir), et l'ÉTAPE — un BC qui attend encore son centre, ou qui a été refusé, ne se signe pas,
 * et le refus dit pourquoi et ce qui le lève (`motifNonSignable`). L'écriture ne pose la signature
 * que si elle manque encore : deux clics simultanés ne signent pas deux fois.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function signerBonDeCommande(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Bon de commande non précisé." };
  if (!peutSignerBC(user)) return { ok: false, error: REFUS_SIGNATURE_BC };

  const visibles = await bcVisiblesWhere(user);
  const visible = visibles
    ? await prisma.legalDocument.findFirst({ where: { AND: [visibles, { id }] }, select: { id: true } })
    : null;
  if (!visible) return { ok: false, error: "Bon de commande introuvable." };

  const etat = await etatDuBC(id);
  if (!etat) return { ok: false, error: "Bon de commande introuvable." };
  if (etat.annule) return { ok: false, error: "Ce bon de commande est annulé : il ne se signe pas." };
  const motif = motifNonSignable(etat.etape, etat.porte);
  if (motif) return { ok: false, error: motif };

  // CE QUI A ÉTÉ RELU EST CE QUI EST SIGNÉ. La pièce a pu changer entre la lecture de son étape
  // et ce clic — un montant relevé qui la renvoie à son centre, un autre fournisseur. Le verrou
  // porte donc sur sa DERNIÈRE ÉCRITURE, pas seulement sur l'absence de signature : sinon on
  // signerait un BC que la règle venait de renvoyer à la validation.
  const signe = await prisma.legalDocument.updateMany({
    where: { id, signedAt: null, updatedAt: etat.majLe },
    data: { signedAt: new Date(), signedById: user.id },
  });
  if (signe.count === 0) {
    const deja = await prisma.legalDocument.findUnique({ where: { id }, select: { signedAt: true } });
    return {
      ok: false,
      error: deja?.signedAt
        ? "Ce bon de commande vient d'être signé."
        : "Ce bon de commande vient d'être modifié : relisez-le avant de le signer.",
    };
  }

  const ref = etat.reference?.trim() ? etat.reference.trim() : `« ${etat.title} »`;
  const montant = etat.montant != null && etat.montant > 0 ? `${etat.montant.toLocaleString("fr-FR")} DZD` : "montant non renseigné";
  await recordAudit({
    // L'audit nomme le MODULE de la signature, et la personne par `actorId` : « signé par les
    // Finances » serait faux sous la plume d'un signataire que le Super Admin a désigné ailleurs.
    actorId: user.id, action: "VALIDATE", module: "Bons de commande", entityType: "LEGAL_DOCUMENT", entityId: id,
    summary: `Bon de commande ${ref} signé (${montant})${etat.counterparty ? ` — ${etat.counterparty}` : ""}`,
  });
  // CELUI QUI A ÉTABLI LE BC EST PRÉVENU : c'est lui qui l'envoie au fournisseur, et il ne le fait
  // qu'une fois signé.
  if (etat.createdById && etat.createdById !== user.id) {
    await notifyUser({
      userId: etat.createdById, type: "GENERIC",
      title: "Bon de commande signé",
      body: `${ref} (${montant}) — il peut partir chez le fournisseur.`,
      link: `/legal/${id}`,
    }).catch(() => undefined);
  }
  revalidatePath(CHEMIN_BC_A_SIGNER);
  revalidatePath("/legal");
  revalidatePath(`/legal/${id}`);
  return { ok: true, id, message: `Bon de commande ${ref} signé. Il peut partir chez le fournisseur.` };
}

/**
 * RENVOYER UN BON DE COMMANDE À SON ÉMETTEUR — au lieu de le signer (audit 360°, R09).
 *
 * Un seul geste existait, signer : un BC erroné (mauvais fournisseur, montant faux, pièce illisible)
 * ne pouvait ni être refusé ni repartir chez son émetteur — le signataire n'avait que le silence. Il
 * le RENVOIE maintenant avec ce qu'il faut corriger : le BC quitte la file des signataires, son
 * émetteur est prévenu, et TOUTE modification de la pièce le rend à la signature (ou à son centre si
 * son montant l'y renvoie — `aiguillerBC`). Ce n'est pas un refus : rien n'est fermé, et la décision
 * du centre qui l'a validé reste acquise tant que le montant ne monte pas.
 *
 * Mêmes gardes que la signature, parce que c'est le même siège qui le fait : le droit, la lecture,
 * l'étape (« à signer », et elle seule). Le motif est EXIGÉ : renvoyer sans dire pourquoi laisse
 * l'émetteur deviner quoi corriger. L'écriture est conditionnelle à la DERNIÈRE écriture relue : ce
 * qui a été relu est ce qui est renvoyé, et deux clics ne renvoient pas deux fois.
 */
export async function renvoyerBonDeCommande(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const note = fdStr(formData, "note");
  if (!id) return { ok: false, error: "Bon de commande non précisé." };
  if (!peutSignerBC(user)) return { ok: false, error: REFUS_SIGNATURE_BC };
  if (!note) return { ok: false, error: "Dites ce qu'il faut corriger : sans cela, l'émetteur ne sait pas quoi changer avant de vous le rendre." };

  const visibles = await bcVisiblesWhere(user);
  const visible = visibles
    ? await prisma.legalDocument.findFirst({ where: { AND: [visibles, { id }] }, select: { id: true } })
    : null;
  if (!visible) return { ok: false, error: "Bon de commande introuvable." };

  const etat = await etatDuBC(id);
  if (!etat) return { ok: false, error: "Bon de commande introuvable." };
  if (etat.annule) return { ok: false, error: "Ce bon de commande est annulé : il n'y a rien à renvoyer." };
  if (etat.etape === "A_CORRIGER") return { ok: false, error: "Ce bon de commande est déjà renvoyé à son émetteur." };
  // Seul un BC « à signer » se renvoie : avant, c'est son centre qui a la main ; signé, il est parti.
  const motif = motifNonSignable(etat.etape, etat.porte);
  if (motif) return { ok: false, error: motif };

  const renvoye = await prisma.legalDocument.updateMany({
    where: { id, signedAt: null, signatureReturnedAt: null, updatedAt: etat.majLe },
    data: { signatureReturnedAt: new Date(), signatureReturnedById: user.id, signatureReturnNote: note },
  });
  if (renvoye.count === 0) {
    return { ok: false, error: "Ce bon de commande vient de changer (signé, renvoyé ou modifié) : relisez-le." };
  }

  const ref = etat.reference?.trim() ? etat.reference.trim() : `« ${etat.title} »`;
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Bons de commande", entityType: "LEGAL_DOCUMENT", entityId: id,
    summary: `Bon de commande ${ref} renvoyé à son émetteur pour correction — ${note}`,
  });
  // L'ÉMETTEUR EST PRÉVENU, et le geste qui le rend à la signature est NOMMÉ (§118.30). Sans émetteur
  // connu (une pièce ancienne), la phrase le DIT plutôt que de laisser croire que quelqu'un sait.
  const prevenu = Boolean(etat.createdById && etat.createdById !== user.id);
  if (prevenu) {
    await notifyUser({
      userId: etat.createdById!, type: "GENERIC",
      title: "Bon de commande renvoyé pour correction",
      body: `${ref} : « ${note} ». Modifiez-le dans Legal — sa modification le rend à la signature.`,
      link: `/legal/${id}`,
    }).catch(() => undefined);
  }
  revalidatePath(CHEMIN_BC_A_SIGNER);
  revalidatePath("/legal");
  revalidatePath(`/legal/${id}`);
  return {
    ok: true, id,
    message: prevenu
      ? `Bon de commande ${ref} renvoyé à son émetteur : il revient dans votre file dès qu'il est corrigé.`
      : `Bon de commande ${ref} renvoyé — aucun émetteur n'est enregistré sur la pièce : prévenez la personne qui l'a établie.`,
  };
}
