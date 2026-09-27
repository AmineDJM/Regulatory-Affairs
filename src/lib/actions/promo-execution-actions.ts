"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { hasGlobalView, type SessionUser } from "@/lib/rbac";
import { persistUploadedDocument } from "@/lib/documents";
import { validateDocumentUpload } from "@/lib/storage";
import { createExpenseOrder } from "@/lib/expense-orders";
import { createMedicalInfoDeclaration } from "@/lib/medical-info";
import { aiguillerBC, porteDuBC } from "@/lib/bons-de-commande/aiguillage";
import { etatDuBC, etatsDesBC } from "@/lib/bons-de-commande/etat";
import { canCancel } from "@/lib/legal/lifecycle";
import { canSendToSettlement } from "@/lib/finances/settlement";
import { getAppSettings } from "@/lib/settings";
import { enSerie } from "@/lib/refs";
import { emettreDocumentDrive, reviserDocumentDrive } from "@/platform/in-process/artifact/factory";
import { devisDuDossier, devisLu } from "@/lib/queries/promo-circuit";
import { lignesDuBonDeCommande, formatDzd } from "@/lib/promo-material/devis";
import { piloteLExecution } from "@/lib/promo-material/circuit";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

/**
 * L'EXÉCUTION DU MATÉRIEL PROMOTIONNEL — bons de commande, factures, paiements, visas (§118.152).
 *
 * « Une fois les validations obtenues, le demandeur génère un ou plusieurs bons de commande
 * automatiquement, selon ce qu'il a validé — le bon de commande est généré par la plateforme
 * elle-même. Il peut supprimer ou modifier un bon de commande généré. Il envoie le bon de
 * commande, et il se doit d'uploader la facture pour demander un paiement, c'est obligatoire —
 * la ou les factures, associées chacune à son bon de commande. Et à chaque paiement, la demande
 * de visa publicitaire, ou la déclaration au ministère, part chez l'information médicale. »
 *
 * ── LES QUATRE RÈGLES QUE CES GESTES PARTAGENT ────────────────────────────────────────────
 *
 * 1. QUI : le demandeur, l'assistante de direction, la Direction — la règle de `canDrive` de la
 *    fiche et de `completePromoTrack`. Le demandeur n'a pas le module Legal : ce qui l'autorise à
 *    faire émettre ses BC, ce sont les VALIDATIONS obtenues sur son dossier, vérifiées ici et
 *    NOMMÉES à la fabrique (`delegation`, que l'audit reprend). Il ne compose rien : les lignes
 *    viennent du choix validé, jamais d'un formulaire — sans quoi la délégation deviendrait une
 *    porte pour émettre n'importe quel BC au nom de la société.
 * 2. UN BC PAR DEVIS RETENU, tagué au dossier (`source`) : c'est ce qui l'envoie au centre de
 *    validation Ad & Pro au-dessus du seuil (§118.148/149), puis à la signature des Finances.
 * 3. UN BC SIGNÉ AVANT TOUT : on n'envoie pas, on ne facture pas un BC que les Finances n'ont
 *    pas signé — il n'engage pas encore la société (§118.149).
 * 4. LE MÊME DINAR NE SORT PAS DEUX FOIS : les factures d'un BC ne dépassent pas son montant, et
 *    le paiement passe par la porte commune (`canSendToSettlement` → `createExpenseOrder` → centre
 *    de paiement, §118.148).
 */

const PATH = "/promo-material";
const chemin = (id: string) => `${PATH}/${id}`;

type Dossier = {
  id: string; reference: string; title: string; circuitVersion: number; circuitState: string | null;
  requesterId: string | null; companyId: string | null;
};

async function chargerDossier(id: string | null): Promise<Dossier | null> {
  if (!id) return null;
  return prisma.promoMaterial.findUnique({
    where: { id },
    select: { id: true, reference: true, title: true, circuitVersion: true, circuitState: true, requesterId: true, companyId: true },
  });
}

/** Ceux qui PILOTENT l'exécution — la règle du module pur, lue aussi par la fiche et la clôture des chantiers. */
function pilote(user: SessionUser, pm: Dossier): boolean {
  return piloteLExecution({ id: user.id, role: user.role, secondaryRole: user.secondaryRole, vueGlobale: hasGlobalView(user.role) }, pm);
}

/** Le refus commun : ni pilote, ni circuit 2, ni validations obtenues. `null` = on peut agir. */
function refusExecution(user: SessionUser, pm: Dossier | null): string | null {
  if (!pm) return "Dossier introuvable.";
  if (pm.circuitVersion !== 2) return "Ce dossier suit l'ancien circuit : ses bons de commande se créent depuis « Pièces liées ».";
  if (!pilote(user, pm)) return "Seuls le demandeur, l'assistante de direction et la Direction pilotent l'exécution de ce dossier.";
  if (pm.circuitState !== "IN_EXECUTION") {
    return pm.circuitState === "COMPLETED"
      ? "Ce dossier est terminé."
      : "Les bons de commande se génèrent une fois TOUTES les validations obtenues (demandeur, Direction Marketing, et Directeur Général au-dessus du seuil).";
  }
  return null;
}

async function audit(user: SessionUser, id: string, summary: string) {
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Matériel promotionnel", entityType: "PROMO_MATERIAL", entityId: id, summary });
}

/**
 * LA SOCIÉTÉ QUI COMMANDE — celle du dossier ; à défaut, celle où travaille son DEMANDEUR (sa
 * fiche salarié, puis son département). Jamais celle de la personne qui clique, ni celle d'un
 * sélecteur d'affichage : l'assistante qui génère les BC d'un demandeur de Pharmagène ne les
 * émet pas au nom de sa propre société, et deux pilotes du même dossier doivent produire le même
 * BC. `null` quand rien ne se lit à coup sûr — on ne devine pas une société qui s'engage.
 */
async function societeDuDossier(pm: Dossier): Promise<string | null> {
  if (pm.companyId) return pm.companyId;
  if (!pm.requesterId) return null;
  const e = await prisma.employee.findFirst({
    where: { userId: pm.requesterId },
    select: { companyId: true, departmentRef: { select: { companyId: true } } },
  });
  return e?.companyId ?? e?.departmentRef?.companyId ?? null;
}

/** Le devis de ce dossier, et son BC s'il en a un d'actif. */
async function devisEtBC(pm: Dossier, quoteId: string | null) {
  if (!quoteId) return null;
  const devis = await prisma.promoQuote.findFirst({
    where: { id: quoteId, promoMaterialId: pm.id },
    select: { id: true, supplierId: true, supplierName: true, purchaseOrderId: true, purchaseOrderSentAt: true },
  });
  if (!devis) return null;
  const etat = devis.purchaseOrderId ? await etatDuBC(devis.purchaseOrderId) : null;
  return { devis, bc: etat && !etat.annule ? etat : null };
}

// ───────────────────────── 1. Générer les bons de commande ─────────────────────────

/**
 * GÉNÉRER LES BONS DE COMMANDE — un par devis dont une ligne est retenue, et qui n'en a pas.
 *
 * Idempotent : un devis qui a déjà son BC actif n'en reçoit pas un second, et la fabrique rend
 * une pièce identique au lieu d'en émettre une autre. Sérialisé par dossier (`enSerie`) : deux
 * clics simultanés ne font pas deux BC pour le même devis. Chaque devis est isolé : l'échec de
 * l'un (fournisseur sans identité, société que le pilote ne peut pas voir) est DIT sans empêcher les autres.
 */
export async function genererBonsDeCommandePromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  const refus = refusExecution(user, pm);
  if (refus || !pm) return { ok: false, error: refus ?? "Dossier introuvable." };
  const livraison = { adresse: fdStr(formData, "livraisonAdresse"), delai: fdStr(formData, "livraisonDelai") };
  const notes = fdStr(formData, "notes");

  const societe = await societeDuDossier(pm);
  if (!societe) {
    return { ok: false, error: "La société qui commande est introuvable : le dossier n'en nomme aucune, et la fiche salarié de son demandeur non plus. Renseignez la société du demandeur (RH › fiche salarié), puis relancez." };
  }

  return enSerie(`promo-bc:${pm.id}`, async () => {
    const devis = await devisDuDossier(pm.id);
    const etats = await etatsDesBC(devis.map((d) => d.purchaseOrderId).filter((x): x is string => Boolean(x)));
    const actifs = new Set(devis.filter((d) => {
      const e = d.purchaseOrderId ? etats.get(d.purchaseOrderId) : undefined;
      return e && !e.annule;
    }).map((d) => d.id));
    const aGenerer = devis.filter((d) => d.lines.some((l) => l.selected) && !actifs.has(d.id));
    if (aGenerer.length === 0) {
      return { ok: true, message: "Chaque devis retenu a déjà son bon de commande — rien de nouveau à générer." };
    }
    const fournisseurs = await prisma.companyContact.findMany({
      where: { id: { in: aGenerer.map((d) => d.supplierId).filter((x): x is string => Boolean(x)) } },
      select: { id: true, name: true, address: true, city: true, wilaya: true, rc: true, nif: true, rib: true, phone: true, email: true },
    });
    const parId = new Map(fournisseurs.map((f) => [f.id, f]));

    const emis: string[] = [];
    const echecs: string[] = [];
    const reserves: string[] = [];
    for (const brut of aGenerer) {
      const d = devisLu(brut);
      const f = brut.supplierId ? parId.get(brut.supplierId) : undefined;
      if (!f) { echecs.push(`${d.supplierName} : fournisseur absent de l'annuaire — faites corriger le devis`); continue; }
      const adresse = [f.address, [f.city, f.wilaya].filter(Boolean).join(", ")].filter((x) => x && x.trim()).join("\n") || null;
      const r = await emettreDocumentDrive(user, {
        type: "BON_DE_COMMANDE",
        societe,
        tiers: { nom: f.name, adresse, rc: f.rc, nif: f.nif, rib: f.rib, telephone: f.phone, email: f.email },
        lignes: lignesDuBonDeCommande(d),
        tvaDefaut: d.tvaRate / 100,
        taxes: d.extraTaxRate ? [{ libelle: d.extraTaxLabel ?? "Taxe additionnelle", taux: d.extraTaxRate / 100 }] : null,
        referenceAmont: d.reference,
        referenceAmontDate: brut.quoteDate ? brut.quoteDate.toISOString().slice(0, 10) : null,
        objet: `Matériel promotionnel ${pm.reference} — ${pm.title}`,
        livraison: livraison.adresse || livraison.delai ? livraison : null,
        notes,
        dossier: `Matériel promotionnel/${pm.reference}`,
      }, {
        source: { type: "PROMO_MATERIAL", id: pm.id },
        delegation: `${pm.reference} — dossier de matériel promotionnel validé (demande, Direction Marketing, seuil du DG), bon de commande composé d'après les lignes retenues`,
      });
      if (!r.ok) { echecs.push(`${d.supplierName} : ${r.motif}`); continue; }
      await prisma.promoQuote.update({ where: { id: d.id }, data: { purchaseOrderId: r.legalDocumentId, purchaseOrderSentAt: null, purchaseOrderSentById: null } });
      emis.push(`${r.reference} (${d.supplierName}, ${formatDzd(r.totaux.totalTtc)} TTC)`);
      if (r.reserveBonDeCommande) reserves.push(r.reserveBonDeCommande);
    }
    if (emis.length) await audit(user, pm.id, `Bons de commande générés : ${emis.join(" ; ")}`);
    revalidatePath(chemin(pm.id));
    revalidatePath("/finances/bons-de-commande");
    if (emis.length === 0) return { ok: false, error: `Aucun bon de commande n'a pu être généré — ${echecs.join(" ; ")}.` };
    const suite = [...new Set(reserves)].join(" ");
    return {
      ok: true,
      message: `${emis.length} bon${emis.length > 1 ? "s" : ""} de commande généré${emis.length > 1 ? "s" : ""} : ${emis.join(" ; ")}.`
        + (echecs.length ? ` Non générés : ${echecs.join(" ; ")}.` : "")
        + (suite ? ` ${suite}` : ""),
    };
  });
}

// ───────────────────────── 2. Modifier, supprimer, envoyer un BC ─────────────────────────

/**
 * MODIFIER UN BON DE COMMANDE GÉNÉRÉ — livraison, délai, interlocuteur, notes.
 *
 * Même numéro, nouvelle version du même fichier (la fabrique). Les LIGNES ne se modifient pas ici :
 * elles sont ce qui a été validé, et un BC qui s'en écarterait engagerait la société sur ce que
 * personne n'a validé. Une révision retire la signature des Finances (§118.149) : ce n'est plus la
 * pièce qu'elles ont signée — et la version envoyée au fournisseur n'est plus la bonne, donc
 * l'envoi est à refaire.
 */
export async function modifierBonDeCommandePromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  const refus = refusExecution(user, pm);
  if (refus || !pm) return { ok: false, error: refus ?? "Dossier introuvable." };
  const lu = await devisEtBC(pm, fdStr(formData, "quoteId"));
  if (!lu) return { ok: false, error: "Ce devis n'appartient pas à ce dossier." };
  if (!lu.bc) return { ok: false, error: "Ce devis n'a pas de bon de commande actif à modifier." };
  const factures = await prisma.legalDocument.count({ where: { kind: "INVOICE", chainFromId: lu.bc.id, status: { not: "CANCELLED" } } });
  if (factures > 0) return { ok: false, error: "Une facture découle déjà de ce bon de commande : il ne se modifie plus." };

  // UN CHAMP LAISSÉ VIDE GARDE SA VALEUR. Le formulaire n'est pas pré-rempli, et Adam ne nomme
  // que ce qui change : écrire `null` pour chaque champ absent effaçait l'adresse de livraison de
  // qui ne changeait que le délai — une pièce révisée partie sans elle, sans un mot (§118.152).
  const saisi = (k: string): string | undefined => fdStr(formData, k) ?? undefined;
  const adresse = saisi("livraisonAdresse");
  const delai = saisi("livraisonDelai");
  const contactNom = saisi("contactNom");
  const contactTelephone = saisi("contactTelephone");
  const notes = saisi("notes");
  const modifications = {
    ...(adresse !== undefined || delai !== undefined
      ? { livraison: { ...(adresse !== undefined ? { adresse } : {}), ...(delai !== undefined ? { delai } : {}) } }
      : {}),
    ...(contactNom !== undefined || contactTelephone !== undefined
      ? { contact: { ...(contactNom !== undefined ? { nom: contactNom } : {}), ...(contactTelephone !== undefined ? { telephone: contactTelephone } : {}) } }
      : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
  if (Object.keys(modifications).length === 0) {
    return { ok: false, error: "Rien à modifier : renseignez au moins un champ — ceux laissés vides gardent leur valeur." };
  }

  const r = await reviserDocumentDrive(user, {
    legalDocumentId: lu.bc.id,
    modifications,
    motif: fdStr(formData, "motif") ?? "modification par le demandeur",
  }, { delegation: `${pm.reference} — bon de commande du dossier, modifié par ses pilotes (livraison, contact, notes)` });
  if (!r.ok) return { ok: false, error: r.motif };
  await prisma.promoQuote.update({ where: { id: lu.devis.id }, data: { purchaseOrderSentAt: null, purchaseOrderSentById: null } });
  await audit(user, pm.id, `Bon de commande ${r.reference} modifié (v${r.version})`);
  revalidatePath(chemin(pm.id));
  return { ok: true, message: `Bon de commande ${r.reference} modifié (version ${r.version}).${r.reserveBonDeCommande ? ` ${r.reserveBonDeCommande}` : ""}` };
}

/**
 * SUPPRIMER UN BON DE COMMANDE GÉNÉRÉ — il est ANNULÉ au registre (jamais effacé : son numéro a
 * été attribué, et un trou dans la numérotation se lit comme une pièce perdue), sa porte en
 * attente quitte le centre, et le devis redevient « à générer ».
 */
export async function annulerBonDeCommandePromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  const refus = refusExecution(user, pm);
  if (refus || !pm) return { ok: false, error: refus ?? "Dossier introuvable." };
  const lu = await devisEtBC(pm, fdStr(formData, "quoteId"));
  if (!lu) return { ok: false, error: "Ce devis n'appartient pas à ce dossier." };
  if (!lu.bc) return { ok: false, error: "Ce devis n'a pas de bon de commande actif." };
  const motif = fdStr(formData, "motif");
  if (!motif) return { ok: false, error: "Dites pourquoi ce bon de commande est supprimé : son numéro reste au registre, avec ce motif." };
  const factures = await prisma.legalDocument.count({ where: { kind: "INVOICE", chainFromId: lu.bc.id, status: { not: "CANCELLED" } } });
  if (factures > 0) return { ok: false, error: "Une facture découle de ce bon de commande : annulez-la d'abord, sans quoi elle se rattacherait à une commande qui n'existe plus." };
  const doc = await prisma.legalDocument.findUnique({ where: { id: lu.bc.id }, select: { status: true } });
  if (!doc || !canCancel(doc.status)) return { ok: false, error: "Ce bon de commande ne peut plus être annulé." };

  await prisma.legalDocument.update({
    where: { id: lu.bc.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: motif, updatedById: user.id },
  });
  // Un BC annulé n'a plus rien à faire valider : sa porte en attente quitte le centre.
  await aiguillerBC(lu.bc.id, { acteurId: user.id });
  await prisma.promoQuote.update({ where: { id: lu.devis.id }, data: { purchaseOrderId: null, purchaseOrderSentAt: null, purchaseOrderSentById: null } });
  await audit(user, pm.id, `Bon de commande ${lu.bc.reference ?? ""} supprimé (annulé au registre) — ${motif.slice(0, 200)}`);
  revalidatePath(chemin(pm.id));
  revalidatePath("/finances/bons-de-commande");
  return { ok: true, message: `Bon de commande ${lu.bc.reference ?? ""} annulé — le devis de ${lu.devis.supplierName} peut en recevoir un nouveau.` };
}

/** LE BC EST PARTI CHEZ LE FOURNISSEUR — seulement signé : avant, il n'engage pas la société. */
export async function marquerBonDeCommandeEnvoye(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  const refus = refusExecution(user, pm);
  if (refus || !pm) return { ok: false, error: refus ?? "Dossier introuvable." };
  const lu = await devisEtBC(pm, fdStr(formData, "quoteId"));
  if (!lu) return { ok: false, error: "Ce devis n'appartient pas à ce dossier." };
  if (!lu.bc) return { ok: false, error: "Ce devis n'a pas de bon de commande actif." };
  if (lu.bc.etape !== "SIGNE") {
    return { ok: false, error: `Le bon de commande ${lu.bc.reference ?? ""} n'est pas encore signé par les Finances : il ne part pas chez le fournisseur avant (§ bons de commande à signer).` };
  }
  if (lu.devis.purchaseOrderSentAt) return { ok: true, message: "Ce bon de commande est déjà marqué envoyé." };
  await prisma.promoQuote.update({ where: { id: lu.devis.id }, data: { purchaseOrderSentAt: new Date(), purchaseOrderSentById: user.id } });
  await audit(user, pm.id, `Bon de commande ${lu.bc.reference ?? ""} envoyé à ${lu.devis.supplierName}`);
  revalidatePath(chemin(pm.id));
  return { ok: true, message: `Bon de commande ${lu.bc.reference ?? ""} marqué envoyé à ${lu.devis.supplierName}.` };
}

// ───────────────────────── 3. Factures, paiements, visas ─────────────────────────

/**
 * DÉPOSER LA FACTURE D'UN BON DE COMMANDE — obligatoire pour demander un paiement.
 *
 * La facture devient une pièce Legal CHAÎNÉE à son BC (`chainFromId`) et rattachée au dossier —
 * c'est ce lien qui la fait compter dans le chantier des paiements, et qui applique au paiement la
 * porte du BC. Le FICHIER est obligatoire : une facture sans pièce ne se contrôle pas. Et les
 * factures d'un BC ne dépassent pas son montant : payer plus que la commande validée, c'est
 * engager la société sur ce que personne n'a validé.
 */
export async function deposerFacturePromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  const refus = refusExecution(user, pm);
  if (refus || !pm) return { ok: false, error: refus ?? "Dossier introuvable." };
  const lu = await devisEtBC(pm, fdStr(formData, "quoteId"));
  if (!lu) return { ok: false, error: "Ce devis n'appartient pas à ce dossier." };
  if (!lu.bc) return { ok: false, error: "Ce devis n'a pas de bon de commande : la facture se rattache à un BC." };
  if (lu.bc.etape !== "SIGNE") return { ok: false, error: `Le bon de commande ${lu.bc.reference ?? ""} n'est pas signé par les Finances : aucune facture ne peut encore en découler.` };

  const reference = fdStr(formData, "reference");
  const montant = fdNum(formData, "amount");
  const fichier = formData.get("file");
  const manques = [
    ...(!reference ? ["le numéro de la facture"] : []),
    ...(!(montant != null && montant > 0) ? ["son montant TTC"] : []),
    ...(!(fichier instanceof File && fichier.size > 0) ? ["le fichier de la facture (obligatoire)"] : []),
  ];
  if (manques.length) return { ok: false, error: `Il manque ${manques.join(", ")}.` };
  const file = fichier as File;
  const invalide = validateDocumentUpload(file.name, file.size, (await getAppSettings()).maxUploadMb);
  if (invalide) return { ok: false, error: `Fichier « ${file.name} » : ${invalide}` };

  // SÉRIALISÉ PAR BC, du plafond à la création : deux dépôts simultanés liraient le même cumul et
  // passeraient tous deux sous le montant du BC — ensemble, ils le dépasseraient (§118.148).
  const bcId = lu.bc.id;
  const bcMontant = lu.bc.montant;
  const bcReference = lu.bc.reference;
  return enSerie(`promo-facture:${bcId}`, async (): Promise<ActionResult> => {
    const deja = await prisma.legalDocument.aggregate({ where: { kind: "INVOICE", chainFromId: bcId, status: { not: "CANCELLED" } }, _sum: { amount: true } });
    const cumul = Number(deja._sum.amount ?? 0) + (montant as number);
    if (bcMontant != null && cumul > bcMontant + 1) {
      return { ok: false, error: `Les factures de ce bon de commande feraient ${formatDzd(cumul)}, pour un BC de ${formatDzd(bcMontant)} : on ne paie pas plus que la commande validée. Vérifiez le montant, ou faites réviser le BC.` };
    }
    const bc = await prisma.legalDocument.findUnique({ where: { id: bcId }, select: { companyId: true } });
    const facture = await prisma.legalDocument.create({
      data: {
        companyId: bc?.companyId ?? pm.companyId,
        kind: "INVOICE",
        reference,
        title: `Facture ${reference} — ${lu.devis.supplierName} (${pm.reference})`,
        counterparty: lu.devis.supplierName,
        counterpartyIds: lu.devis.supplierId ? [lu.devis.supplierId] : [],
        startDate: fdDate(formData, "invoiceDate") ?? new Date(),
        amount: new Prisma.Decimal(montant as number),
        chainFromId: bcId,
        sourceType: "PROMO_MATERIAL",
        sourceId: pm.id,
        createdById: user.id, updatedById: user.id,
      },
      select: { id: true },
    });
    const piece = await persistUploadedDocument(user.id, {
      entityType: "LEGAL_DOCUMENT", entityId: facture.id, category: "INVOICE", confidentiality: "INTERNAL", stepKey: "facture", file,
    });
    if (!piece.ok) {
      // Une facture sans son fichier ne se contrôle pas : on ne la garde pas.
      await prisma.legalDocument.delete({ where: { id: facture.id } }).catch(() => undefined);
      return { ok: false, error: `Fichier « ${file.name} » : ${piece.error ?? "téléversement impossible"}` };
    }
    await audit(user, pm.id, `Facture ${reference} déposée pour le BC ${bcReference ?? ""} (${lu.devis.supplierName}) — ${formatDzd(montant as number)} TTC`);
    revalidatePath(chemin(pm.id));
    return { ok: true, id: facture.id, message: `Facture ${reference} enregistrée — vous pouvez demander son paiement.` };
  });
}

const FORMALITES = ["AD_VISA", "MIP"] as const;
type Formalite = (typeof FORMALITES)[number];
const LIBELLE_FORMALITE: Record<Formalite, string> = { AD_VISA: "demande de visa publicitaire", MIP: "déclaration au ministère" };

/** La facture de CE dossier, et le BC dont elle découle. */
async function factureDuDossier(pm: Dossier, invoiceId: string | null) {
  if (!invoiceId) return null;
  return prisma.legalDocument.findFirst({
    where: { id: invoiceId, kind: "INVOICE", sourceType: "PROMO_MATERIAL", sourceId: pm.id, status: { not: "CANCELLED" } },
    select: {
      id: true, reference: true, title: true, kind: true, amount: true, counterparty: true, endDate: true,
      paidDate: true, expenseOrderId: true, chainFrom: { select: { id: true, reference: true } },
    },
  });
}

/**
 * DEMANDER LE PAIEMENT D'UNE FACTURE — et, avec lui, la demande à l'information médicale.
 *
 * Le paiement passe par la porte commune : `canSendToSettlement` (pas deux fois, pas sans montant,
 * pas sur un BC que son centre n'a pas validé), puis `createExpenseOrder`, qui le fait naître en
 * attente du CENTRE DE PAIEMENT (§118.148). La demande de visa publicitaire — ou la déclaration au
 * ministère — part AVEC le paiement, une par paiement : c'est ce que la Direction a demandé, et le
 * PRIM instruit en parallèle du règlement au lieu de l'attendre. Elle ne porte AUCUN montant :
 * l'information médicale n'émet pas d'ordre pour elle, sans quoi le même matériel serait payé deux
 * fois (§118.151).
 */
export async function demanderPaiementFacturePromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  const refus = refusExecution(user, pm);
  if (refus || !pm) return { ok: false, error: refus ?? "Dossier introuvable." };
  const formalite = fdStr(formData, "formalite") as Formalite | null;
  if (!formalite || !FORMALITES.includes(formalite)) {
    return { ok: false, error: "Choisissez la formalité qui accompagne ce paiement : demande de visa publicitaire, ou déclaration au ministère." };
  }
  const invoiceId = fdStr(formData, "invoiceId");
  // SÉRIALISÉ PAR FACTURE : deux clics simultanés liraient tous deux « aucun ordre » et feraient
  // naître deux ordres de dépense pour la même facture — le même dinar demandé deux fois.
  return enSerie(`promo-paiement:${invoiceId ?? ""}`, async (): Promise<ActionResult> => {
    const facture = await factureDuDossier(pm, invoiceId);
    if (!facture) return { ok: false, error: "Cette facture n'appartient pas à ce dossier." };
    const bc = facture.chainFrom ? await etatDuBC(facture.chainFrom.id) : null;
    if (!bc || bc.annule) return { ok: false, error: "Cette facture ne découle d'aucun bon de commande actif du dossier." };
    if (bc.etape !== "SIGNE") return { ok: false, error: `Le bon de commande ${bc.reference ?? ""} n'est pas signé par les Finances : sa facture ne se paie pas encore.` };

    const montant = facture.amount != null ? Number(facture.amount) : 0;
    const envoi = canSendToSettlement({
      kind: facture.kind, amount: montant || null, paidDate: facture.paidDate, expenseOrderId: facture.expenseOrderId,
      bc: { porte: await porteDuBC(bc.id), reference: bc.reference },
    });
    if (!envoi.ok) return { ok: false, error: envoi.error };

    const ordre = await createExpenseOrder({
      label: `${facture.reference ? `${facture.reference} — ` : ""}${facture.title}`,
      amount: montant,
      category: "FOURNISSEUR",
      beneficiary: facture.counterparty,
      sourceType: "LEGAL_DOCUMENT",
      sourceId: facture.id,
      requestedById: user.id,
      dueDate: facture.endDate,
    });
    await prisma.legalDocument.update({ where: { id: facture.id }, data: { expenseOrderId: ordre.id, updatedById: user.id } });
    // LA DEMANDE À L'INFORMATION MÉDICALE part avec le paiement. Si elle échoue, le paiement, lui,
    // est PARTI : le taire en rendant une erreur ferait recliquer — et `canSendToSettlement`
    // refuserait alors un paiement déjà demandé, sans dire que la seule chose qui manque est la
    // demande de visa. On le DIT, avec le geste qui la rattrape.
    const declaration = await createMedicalInfoDeclaration({
      sourceType: "LEGAL_DOCUMENT",
      sourceId: facture.id,
      label: `Matériel promotionnel ${pm.reference} — ${pm.title} — ${facture.counterparty ?? "fournisseur"}, facture ${facture.reference ?? ""}`.trim(),
      beneficiary: facture.counterparty,
      amount: null,
      requesterId: pm.requesterId,
      declarationKind: formalite,
    }).catch(() => null);
    await audit(user, pm.id, `Paiement demandé — facture ${facture.reference ?? ""} (${formatDzd(montant)}, ordre ${ordre.reference}) ; ${declaration ? `${LIBELLE_FORMALITE[formalite]} ${declaration.reference} adressée à l'information médicale` : `${LIBELLE_FORMALITE[formalite]} NON adressée (échec) — à rattraper`}`);
    revalidatePath(chemin(pm.id));
    revalidatePath("/information-medicale");
    const formaliteLue = `${LIBELLE_FORMALITE[formalite][0].toUpperCase()}${LIBELLE_FORMALITE[formalite].slice(1)}`;
    return {
      ok: true,
      message: `Paiement demandé (ordre ${ordre.reference}) : il attend le centre de paiement. `
        + (declaration
          ? `${formaliteLue} ${declaration.reference} adressée à l'information médicale.`
          : `${formaliteLue} : elle n'a PAS pu partir — utilisez « Adresser à l'information médicale » sur cette facture.`),
    };
  });
}

/**
 * ADRESSER LA DEMANDE À L'INFORMATION MÉDICALE pour un paiement qui n'en a pas — le rattrapage.
 *
 * Une facture du dossier peut partir au règlement par un autre chemin (sa fiche Legal), ou la
 * demande avoir échoué après le paiement : le chantier « visa ou déclaration » le NOMME, et ce
 * geste le répare. Idempotent : une demande déjà adressée est rendue telle quelle.
 */
export async function adresserInfoMedicaleFacturePromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  const refus = refusExecution(user, pm);
  if (refus || !pm) return { ok: false, error: refus ?? "Dossier introuvable." };
  const formalite = fdStr(formData, "formalite") as Formalite | null;
  if (!formalite || !FORMALITES.includes(formalite)) {
    return { ok: false, error: "Choisissez la formalité : demande de visa publicitaire, ou déclaration au ministère." };
  }
  const facture = await factureDuDossier(pm, fdStr(formData, "invoiceId"));
  if (!facture) return { ok: false, error: "Cette facture n'appartient pas à ce dossier." };
  if (!facture.expenseOrderId && !facture.paidDate) {
    return { ok: false, error: "Aucun paiement n'est encore demandé pour cette facture : la demande part avec le paiement." };
  }
  const existante = await prisma.medicalInfoDeclaration.findUnique({
    where: { sourceType_sourceId: { sourceType: "LEGAL_DOCUMENT", sourceId: facture.id } },
    select: { reference: true },
  });
  if (existante) return { ok: true, message: `La demande ${existante.reference} est déjà adressée à l'information médicale.` };
  const declaration = await createMedicalInfoDeclaration({
    sourceType: "LEGAL_DOCUMENT",
    sourceId: facture.id,
    label: `Matériel promotionnel ${pm.reference} — ${pm.title} — ${facture.counterparty ?? "fournisseur"}, facture ${facture.reference ?? ""}`.trim(),
    beneficiary: facture.counterparty,
    amount: null,
    requesterId: pm.requesterId,
    declarationKind: formalite,
  });
  await audit(user, pm.id, `${LIBELLE_FORMALITE[formalite]} ${declaration.reference} adressée à l'information médicale (facture ${facture.reference ?? ""})`);
  revalidatePath(chemin(pm.id));
  revalidatePath("/information-medicale");
  return { ok: true, message: `${LIBELLE_FORMALITE[formalite][0].toUpperCase()}${LIBELLE_FORMALITE[formalite].slice(1)} ${declaration.reference} adressée à l'information médicale.` };
}
