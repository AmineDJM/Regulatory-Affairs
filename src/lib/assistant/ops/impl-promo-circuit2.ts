import {
  designerDossierPromo, designerDevis, designerFacture, devisLusDuDossier, executionDuDossier, lignesDesignees, totauxSiRetenues,
  formatDzd, totauxRetenus,
  demanderDevisPromo, supprimerDevisPromo, terminerRetranscriptionPromo, choisirLignesPromo, demanderCorrectionDevisPromo,
  genererBonsDeCommandePromo, modifierBonDeCommandePromo, annulerBonDeCommandePromo, marquerBonDeCommandeEnvoye,
  deposerFacturePromo, demanderPaiementFacturePromo, adresserInfoMedicaleFacturePromo,
  type DossierPromoDesigne,
} from "@/platform/in-process/promo";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { fieldsOf, runFd, toFd } from "./helpers";
import { resolveDriveFile, driveNodeToFile, kb } from "./impl-wave8-files";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CIRCUIT 2 DU MATÉRIEL PROMOTIONNEL, EN CONVERSATION (§118.152).
 *
 * « Demande les devis du MP-2026-014 », « je retiens tout le devis Atlas et la ligne Kakémono de
 * Stands Sahel, valide », « génère les bons de commande », « dépose la facture F-118 de l'Atlas »,
 * « demande le paiement, avec la demande de visa ». Chaque geste passe par l'ACTION de l'écran,
 * qui revérifie tout (qui, à quelle étape, sur quel devis) : ce fichier DÉSIGNE et MONTRE, il ne
 * décide rien.
 *
 * ── LA DÉSIGNATION, SOUS LA PORTE DE LA FICHE ────────────────────────────────────────────
 * Le dossier se désigne par `designerDossierPromo` : un candidat n'existe que s'il est ouvert à la
 * personne (§118.150d). Le devis, la ligne, la facture se désignent DANS ce dossier — par le
 * fournisseur, la référence, « Fournisseur : ligne » quand deux devis portent la même. Rien n'est
 * tranché à la place de la personne : une ligne ambiguë est un refus qui liste, jamais « la
 * première des deux » — la retenir, c'est la commander (§104.7).
 *
 * ── L'ÉTAPE SE DIT SUR LA CARTE, ET UN GESTE HORS ÉTAPE N'EST PAS OFFERT ─────────────────
 * Une carte qu'on confirme puis que l'action refuse est une fausse promesse (§118.83). L'étape
 * où chaque geste a un sens est un FAIT du dossier, lu ici ; l'action le revérifie, et c'est elle
 * qui a raison si les deux divergent — le sens sûr : un refus après le clic, jamais un effet de
 * trop.
 *
 * ── CE QUI N'EST PAS ICI ─────────────────────────────────────────────────────────────────
 * La RETRANSCRIPTION d'un devis (`enregistrerDevisPromo`) — le tableau que l'assistante recopie
 * depuis le papier — est exclue de la conversation, raison écrite au registre de parité : les
 * prix recopiés deviennent le bon de commande puis le paiement, et un document lu est une
 * DONNÉE, jamais la main qui écrit ce qui sera commandé (§118.7, §118.15).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

type Utilisateur = Parameters<OpImpl["propose"]>[1];
const PATH = ["/promo-material"];

/** Les étapes où chaque geste a un sens — revérifiées par l'action, qui a le dernier mot. */
const ETAPE_REQUISE: Record<string, { etat: string; phrase: string }> = {
  request_promo_quotes: { etat: "QUOTE_TO_REQUEST", phrase: "Les devis se demandent une fois la demande validée, et une seule fois." },
  delete_promo_quote: { etat: "QUOTE_REQUESTED", phrase: "Un devis ne se retire que pendant la retranscription." },
  finish_promo_transcription: { etat: "QUOTE_REQUESTED", phrase: "Ce dossier n'attend pas de retranscription." },
  choose_promo_lines: { etat: "REVIEW_REQUESTER", phrase: "Ce dossier n'attend pas le choix des lignes du demandeur." },
  request_promo_quote_correction: { etat: "REVIEW_REQUESTER", phrase: "Une correction de retranscription se demande au moment du choix des lignes." },
};
const EXECUTION = "IN_EXECUTION";
const PHRASE_EXECUTION = "Les bons de commande, factures et paiements se font une fois TOUTES les validations obtenues (demandeur, Direction Marketing, et Directeur Général au-dessus du seuil).";

/** Le dossier, au circuit 2, à l'étape que le geste exige — ou le refus qui dit laquelle. */
async function dossierALEtape(user: Utilisateur, input: Record<string, unknown>, etat: string, phrase: string): Promise<DossierPromoDesigne | { error: string }> {
  const d = await designerDossierPromo(user, opStr(input, "reference") || opStr(input, "label"));
  if ("error" in d) return d;
  if (d.circuitVersion !== 2) return { error: `${d.reference} suit l'ancien circuit (étape « ${d.etape ?? "—"} ») : ses gestes sont ceux du parcours d'avant.` };
  if (d.circuitState !== etat) return { error: `${phrase} ${d.reference} est à l'étape « ${d.etape ?? "—"} ».` };
  return d;
}

const dossierField = (d: DossierPromoDesigne): [string, string] => ["Dossier", `${d.reference} — ${d.title}`];

/** Une liste écrite par une personne : « ; », retours à la ligne — et « , » pour les fournisseurs. */
const liste = (brut: string, virgule: boolean): string[] =>
  brut.split(virgule ? /[;,\n]/ : /[;\n]/).map((x) => x.trim()).filter(Boolean);

/** Le devis d'un dossier en EXÉCUTION, désigné par son fournisseur — avec son BC actif. */
async function devisEnExecution(user: Utilisateur, input: Record<string, unknown>) {
  const d = await dossierALEtape(user, input, EXECUTION, PHRASE_EXECUTION);
  if ("error" in d) return d;
  const execution = await executionDuDossier(d.id);
  const devis = designerDevis(execution, opStr(input, "supplier") || opStr(input, "name"));
  if ("error" in devis) return devis;
  return { d, devis, execution };
}

export const PROMO2_OPS_IMPL: Record<string, OpImpl> = {
  // ───────────────────────── Les devis ─────────────────────────
  request_promo_quotes: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const r = ETAPE_REQUISE.request_promo_quotes;
      const d = await dossierALEtape(user, input, r.etat, r.phrase);
      if ("error" in d) return d;
      const note = opStr(input, "note");
      return {
        title: `Demander les devis au secrétariat — ${d.reference}`,
        fields: fieldsOf([dossierField(d), ["Message au secrétariat", note || null]]),
        warnings: ["Geste du DEMANDEUR : la demande part au secrétariat (l'assistante désignée, sinon toutes les assistantes de direction), qui retranscrit chaque devis ligne à ligne sur la fiche."],
        args: { promoMaterialId: d.id, note: note || null },
        successMessage: `Devis demandés au secrétariat sur ${d.reference}.`,
        revalidate: PATH,
      };
    },
    execute: (args) => runFd(demanderDevisPromo, args, "La demande de devis a été refusée.", { revalidate: PATH }),
  },

  delete_promo_quote: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const r = ETAPE_REQUISE.delete_promo_quote;
      const d = await dossierALEtape(user, input, r.etat, r.phrase);
      if ("error" in d) return d;
      const devis = designerDevis(await devisLusDuDossier(d.id), opStr(input, "supplier") || opStr(input, "name"));
      if ("error" in devis) return devis;
      return {
        title: `Retirer le devis de ${devis.supplierName} — ${d.reference}`,
        fields: fieldsOf([dossierField(d), ["Devis", `${devis.supplierName}${devis.reference ? ` (${devis.reference})` : ""} — ${devis.lines.length} ligne(s)`]]),
        warnings: ["Le devis retranscrit et ses lignes sont retirés ; le scan reste dans les pièces du dossier."],
        args: { promoMaterialId: d.id, quoteId: devis.id },
        successMessage: `Devis de ${devis.supplierName} retiré de ${d.reference}.`,
        revalidate: PATH,
      };
    },
    execute: (args) => runFd(supprimerDevisPromo, args, "Le retrait du devis a été refusé.", { revalidate: PATH }),
  },

  finish_promo_transcription: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const r = ETAPE_REQUISE.finish_promo_transcription;
      const d = await dossierALEtape(user, input, r.etat, r.phrase);
      if ("error" in d) return d;
      const devis = await devisLusDuDossier(d.id);
      if (devis.length === 0) return { error: `Aucun devis n'est encore retranscrit sur ${d.reference}.` };
      return {
        title: `Retranscription terminée — ${d.reference}`,
        fields: fieldsOf([
          dossierField(d),
          ["Devis retranscrits", devis.map((q) => `${q.supplierName} (${q.lines.length} ligne${q.lines.length > 1 ? "s" : ""})`).join(" ; ")],
        ]),
        warnings: ["Refusé tant qu'un devis manque de fournisseur, de scan ou de lignes, ou que ses lignes ne retombent pas sur le total imprimé. Le demandeur choisit ensuite ses lignes."],
        args: { promoMaterialId: d.id },
        successMessage: `Retranscription terminée sur ${d.reference} — au demandeur de choisir.`,
        revalidate: PATH,
      };
    },
    execute: (args) => runFd(terminerRetranscriptionPromo, args, "La fin de la retranscription a été refusée.", { revalidate: PATH }),
  },

  choose_promo_lines: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const r = ETAPE_REQUISE.choose_promo_lines;
      const d = await dossierALEtape(user, input, r.etat, r.phrase);
      if ("error" in d) return d;
      const devis = await devisLusDuDossier(d.id);
      const fournisseurs = liste(opStr(input, "supplier"), true);
      const lignes = liste(opStr(input, "lines"), false);
      if (fournisseurs.length === 0 && lignes.length === 0) {
        return { error: `Dites quelles lignes retenir : un fournisseur (« supplier », tout son devis) et/ou des lignes (« lines », « Fournisseur : ligne »). Devis : ${devis.map((q) => q.supplierName).join(", ") || "aucun"}.` };
      }
      const choix = lignesDesignees(devis, fournisseurs, lignes);
      if ("error" in choix) return choix;
      const t = totauxSiRetenues(devis, choix.ids);
      const valider = /valid|soumet|envoi/i.test(opStr(input, "mode"));
      const parDevis = devis
        .map((q) => ({ q, n: q.lines.filter((l) => choix.ids.includes(l.id)).length }))
        .filter((x) => x.n > 0)
        .map(({ q, n }) => {
          const tq = totauxRetenus({ ...q, lines: q.lines.map((l) => ({ ...l, selected: choix.ids.includes(l.id) })) });
          return `${q.supplierName} — ${n} ligne${n > 1 ? "s" : ""}, ${formatDzd(tq.ttc)} TTC`;
        });
      return {
        title: `${valider ? "Retenir et valider" : "Retenir"} ${t.lignes} ligne${t.lignes > 1 ? "s" : ""} — ${d.reference}`,
        fields: fieldsOf([
          dossierField(d),
          ["Lignes retenues", parDevis.join(" ; ")],
          ["Total retenu", `${formatDzd(t.ttc)} TTC (${formatDzd(t.ht)} HT)`],
        ]),
        warnings: [
          "La sélection REMPLACE celle d'avant : les lignes nommées, et elles seules.",
          ...(valider ? ["Valider fige ce montant : il part en validation à la Direction Marketing (et au Directeur Général au-dessus du seuil)."] : []),
        ],
        args: { promoMaterialId: d.id, lineIds: choix.ids.join(","), valider: valider ? "1" : null },
        successMessage: valider ? `Choix validé sur ${d.reference} (${formatDzd(t.ttc)} TTC).` : `Choix enregistré sur ${d.reference} (${formatDzd(t.ttc)} TTC).`,
        revalidate: PATH,
      };
    },
    execute: (args) => runFd(choisirLignesPromo, args, "Le choix des lignes a été refusé.", { revalidate: PATH, listes: ["lineIds"] }),
  },

  request_promo_quote_correction: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const motif = opStr(input, "note");
      if (!motif) return { error: "Dites ce qui est à corriger (champ « note ») : l'assistante reprendrait sinon à l'identique." };
      const r = ETAPE_REQUISE.request_promo_quote_correction;
      const d = await dossierALEtape(user, input, r.etat, r.phrase);
      if ("error" in d) return d;
      return {
        title: `Demander une correction de la retranscription — ${d.reference}`,
        fields: fieldsOf([dossierField(d), ["À corriger", motif]]),
        warnings: ["Le dossier revient à l'assistante de direction, et votre sélection de lignes est effacée : les lignes vont changer."],
        args: { promoMaterialId: d.id, motif },
        successMessage: `Correction demandée sur ${d.reference} — le dossier revient à l'assistante.`,
        revalidate: PATH,
      };
    },
    execute: (args) => runFd(demanderCorrectionDevisPromo, args, "La demande de correction a été refusée.", { revalidate: PATH }),
  },

  // ───────────────────────── Les bons de commande ─────────────────────────
  generate_promo_bcs: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const d = await dossierALEtape(user, input, EXECUTION, PHRASE_EXECUTION);
      if ("error" in d) return d;
      const execution = await executionDuDossier(d.id);
      const aGenerer = execution.filter((e) => e.lignesRetenues > 0 && !e.bc);
      if (aGenerer.length === 0) return { error: `Chaque devis retenu de ${d.reference} a déjà son bon de commande — rien de nouveau à générer.` };
      const adresse = opStr(input, "address");
      const delai = opStr(input, "delay");
      return {
        title: `Générer ${aGenerer.length} bon${aGenerer.length > 1 ? "s" : ""} de commande — ${d.reference}`,
        fields: fieldsOf([
          dossierField(d),
          ["À générer", aGenerer.map((e) => `${e.fournisseur} — ${formatDzd(e.retenu.ttc)} TTC`).join(" ; ")],
          ["Livraison", [adresse, delai].filter(Boolean).join(" — ") || null],
        ]),
        warnings: [
          "La plateforme compose chaque BC d'après les lignes VALIDÉES, sur le papier de la société — un par fournisseur retenu.",
          "Au-dessus du seuil réglé au centre Ad & Pro, le BC passe au centre de validation ; il n'engage la société qu'une fois SIGNÉ par les Finances.",
        ],
        args: { promoMaterialId: d.id, livraisonAdresse: adresse || null, livraisonDelai: delai || null, notes: opStr(input, "notes") || null },
        successMessage: `Bons de commande générés sur ${d.reference}.`,
        revalidate: [...PATH, "/finances/bons-de-commande"],
      };
    },
    execute: (args) => runFd(genererBonsDeCommandePromo, args, "La génération des bons de commande a été refusée.", { revalidate: [...PATH, "/finances/bons-de-commande"] }),
  },

  update_promo_bc: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const x = await devisEnExecution(user, input);
      if ("error" in x) return x;
      const { d, devis } = x;
      if (!devis.bc) return { error: `Le devis de ${devis.fournisseur} n'a pas de bon de commande actif à modifier.` };
      const champs: [string, string | null][] = [
        ["Adresse de livraison", opStr(input, "address") || null],
        ["Délai", opStr(input, "delay") || null],
        ["Interlocuteur", opStr(input, "person") || null],
        ["Téléphone", opStr(input, "phone") || null],
        ["Notes", opStr(input, "notes") || null],
      ];
      if (champs.every(([, v]) => !v)) return { error: "Dites ce qui change sur le BC : adresse, délai, interlocuteur, téléphone ou notes. Les LIGNES ne se modifient pas : elles sont celles qui ont été validées." };
      return {
        title: `Modifier le BC ${devis.bc.reference ?? ""} (${devis.fournisseur}) — ${d.reference}`,
        fields: fieldsOf([dossierField(d), ...champs, ["Motif", opStr(input, "note") || null]]),
        warnings: [
          "Même numéro, nouvelle version du même fichier ; ce qui n'est pas nommé ici garde sa valeur.",
          "Une signature des Finances déjà posée tombe (le BC modifié se re-signe), et l'envoi au fournisseur est à refaire. Refusé si une facture découle déjà du BC.",
        ],
        args: {
          promoMaterialId: d.id, quoteId: devis.quoteId,
          livraisonAdresse: opStr(input, "address") || null, livraisonDelai: opStr(input, "delay") || null,
          contactNom: opStr(input, "person") || null, contactTelephone: opStr(input, "phone") || null,
          notes: opStr(input, "notes") || null, motif: opStr(input, "note") || null,
        },
        successMessage: `BC de ${devis.fournisseur} modifié sur ${d.reference}.`,
        revalidate: [...PATH, "/finances/bons-de-commande"],
      };
    },
    execute: (args) => runFd(modifierBonDeCommandePromo, args, "La modification du bon de commande a été refusée.", { revalidate: [...PATH, "/finances/bons-de-commande"] }),
  },

  cancel_promo_bc: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const motif = opStr(input, "note");
      if (!motif) return { error: "Donnez le motif de l'annulation (champ « note ») — il est écrit sur la pièce." };
      const x = await devisEnExecution(user, input);
      if ("error" in x) return x;
      const { d, devis } = x;
      if (!devis.bc) return { error: `Le devis de ${devis.fournisseur} n'a pas de bon de commande actif à annuler.` };
      return {
        title: `Annuler le BC ${devis.bc.reference ?? ""} (${devis.fournisseur}) — ${d.reference}`,
        fields: fieldsOf([dossierField(d), ["Montant", devis.bc.montant != null ? formatDzd(devis.bc.montant) : null], ["Motif", motif]]),
        warnings: ["Refusé si une facture en découle déjà. Le devis redevient « à générer »."],
        args: { promoMaterialId: d.id, quoteId: devis.quoteId, motif },
        successMessage: `BC de ${devis.fournisseur} annulé sur ${d.reference}.`,
        revalidate: [...PATH, "/finances/bons-de-commande"],
      };
    },
    execute: (args) => runFd(annulerBonDeCommandePromo, args, "L'annulation du bon de commande a été refusée.", { revalidate: [...PATH, "/finances/bons-de-commande"] }),
  },

  mark_promo_bc_sent: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const x = await devisEnExecution(user, input);
      if ("error" in x) return x;
      const { d, devis } = x;
      if (!devis.bc) return { error: `Le devis de ${devis.fournisseur} n'a pas de bon de commande actif.` };
      if (devis.envoyeLe) return { error: `Le BC de ${devis.fournisseur} est déjà marqué envoyé.` };
      return {
        title: `BC envoyé au fournisseur — ${devis.fournisseur} (${d.reference})`,
        fields: fieldsOf([dossierField(d), ["Bon de commande", `${devis.bc.reference ?? "—"} — ${devis.bcDetail?.libelleEtape ?? ""}`]]),
        warnings: ["Refusé tant que les Finances n'ont pas SIGNÉ le BC : avant, il n'engage pas la société."],
        args: { promoMaterialId: d.id, quoteId: devis.quoteId },
        successMessage: `BC de ${devis.fournisseur} marqué envoyé sur ${d.reference}.`,
        revalidate: PATH,
      };
    },
    execute: (args) => runFd(marquerBonDeCommandeEnvoye, args, "Le marquage d'envoi a été refusé.", { revalidate: PATH }),
  },

  // ───────────────────────── Factures, paiement, information médicale ─────────────────────────
  deposit_promo_invoice: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const x = await devisEnExecution(user, input);
      if ("error" in x) return x;
      const { d, devis } = x;
      if (!devis.bc) return { error: `Le devis de ${devis.fournisseur} n'a pas de bon de commande actif : une facture se rattache à son BC.` };
      const fichier = await resolveDriveFile(user, opStr(input, "file"));
      if ("error" in fichier) return fichier;
      const montant = Number(opStr(input, "amount").replace(/[\s  ]/g, "").replace(",", "."));
      if (!(montant > 0)) return { error: "Donnez le montant de la facture (champ « amount », DZD)." };
      const reference = opStr(input, "invoiceRef");
      if (!reference) return { error: "Donnez la référence de la facture (champ « invoiceRef »)." };
      const deja = devis.factures.reduce((s, f) => s + (f.montant ?? 0), 0);
      return {
        title: `Déposer la facture ${reference} (${devis.fournisseur}) — ${d.reference}`,
        fields: fieldsOf([
          dossierField(d),
          ["Bon de commande", `${devis.bc.reference ?? "—"} — ${devis.bc.montant != null ? formatDzd(devis.bc.montant) : "montant inconnu"}`],
          ["Facture", `${reference} — ${formatDzd(montant)}`],
          ["Date", opStr(input, "date") || null],
          ["Fichier", `${fichier.name} (${kb(fichier.size)})`],
          ["Déjà facturé sur ce BC", deja > 0 ? formatDzd(deja) : null],
        ]),
        warnings: ["Le fichier est obligatoire, et les factures d'un BC ne dépassent jamais son montant. Le BC doit être signé par les Finances."],
        args: { promoMaterialId: d.id, quoteId: devis.quoteId, reference, amount: String(montant), invoiceDate: opStr(input, "date") || null, fileNodeId: fichier.id },
        successMessage: `Facture ${reference} déposée sur le BC de ${devis.fournisseur} (${d.reference}).`,
        revalidate: PATH,
      };
    },
    async execute(args, user) {
      const fichier = await driveNodeToFile(user, args.fileNodeId ?? "");
      if ("error" in fichier) return { ok: false, error: fichier.error };
      const { fileNodeId: _, ...reste } = args;
      const fd = toFd(reste);
      fd.set("file", fichier);
      const r = await deposerFacturePromo(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le dépôt de la facture a été refusé." };
      return { ok: true, ...(r.message ? { message: r.message } : {}), revalidate: PATH };
    },
  },

  request_promo_invoice_payment: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const d = await dossierALEtape(user, input, EXECUTION, PHRASE_EXECUTION);
      if ("error" in d) return d;
      const formalite = formaliteDe(opStr(input, "mode"));
      if (!formalite) return { error: "Quelle formalité accompagne ce paiement (champ « mode ») : demande de visa publicitaire, ou déclaration au ministère ?" };
      const f = designerFacture(await executionDuDossier(d.id), opStr(input, "invoiceRef") || opStr(input, "supplier"));
      if ("error" in f) return f;
      if (f.facture.paiementDemande) return { error: `Le paiement de la facture ${f.facture.reference ?? ""} est déjà demandé (${f.facture.etatReglement}).` };
      return {
        title: `Demander le paiement de la facture ${f.facture.reference ?? ""} (${f.devis.fournisseur}) — ${d.reference}`,
        fields: fieldsOf([
          dossierField(d),
          ["Facture", `${f.facture.reference ?? "—"} — ${f.facture.montant != null ? formatDzd(f.facture.montant) : "montant inconnu"}`],
          ["Formalité", formalite.libelle],
        ]),
        warnings: [
          "Le paiement passe par le CENTRE DE PAIEMENT, puis les Finances le règlent.",
          `La ${formalite.libelle} part AVEC chez l'information médicale — sans montant : ce n'est pas un second paiement.`,
        ],
        args: { promoMaterialId: d.id, invoiceId: f.facture.id, formalite: formalite.code },
        successMessage: `Paiement demandé pour la facture ${f.facture.reference ?? ""} (${d.reference}).`,
        revalidate: [...PATH, "/information-medicale"],
      };
    },
    execute: (args) => runFd(demanderPaiementFacturePromo, args, "La demande de paiement a été refusée.", { revalidate: [...PATH, "/information-medicale"] }),
  },

  send_promo_invoice_to_medical_info: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const d = await dossierALEtape(user, input, EXECUTION, PHRASE_EXECUTION);
      if ("error" in d) return d;
      const formalite = formaliteDe(opStr(input, "mode"));
      if (!formalite) return { error: "Quelle formalité (champ « mode ») : demande de visa publicitaire, ou déclaration au ministère ?" };
      const f = designerFacture(await executionDuDossier(d.id), opStr(input, "invoiceRef") || opStr(input, "supplier"));
      if ("error" in f) return f;
      if (f.facture.demandeInfoMedicale) return { error: `La facture ${f.facture.reference ?? ""} a déjà sa demande à l'information médicale (${f.facture.demandeInfoMedicale.reference}).` };
      return {
        title: `Adresser la ${formalite.libelle} à l'information médicale — facture ${f.facture.reference ?? ""} (${d.reference})`,
        fields: fieldsOf([dossierField(d), ["Facture", `${f.facture.reference ?? "—"} (${f.devis.fournisseur})`], ["Formalité", formalite.libelle]]),
        warnings: ["Le rattrapage d'une demande qui n'est pas partie avec le paiement. Refusé tant qu'aucun paiement n'est demandé pour cette facture."],
        args: { promoMaterialId: d.id, invoiceId: f.facture.id, formalite: formalite.code },
        successMessage: `${formalite.libelle[0].toUpperCase()}${formalite.libelle.slice(1)} adressée à l'information médicale (${d.reference}).`,
        revalidate: [...PATH, "/information-medicale"],
      };
    },
    execute: (args) => runFd(adresserInfoMedicaleFacturePromo, args, "L'envoi à l'information médicale a été refusé.", { revalidate: [...PATH, "/information-medicale"] }),
  },
};

/** « visa », « déclaration », « ministère » — la formalité en clair ; rien de reconnu = on demande. */
function formaliteDe(brut: string): { code: "AD_VISA" | "MIP"; libelle: string } | null {
  const b = brut.toLowerCase();
  if (/visa/.test(b)) return { code: "AD_VISA", libelle: "demande de visa publicitaire" };
  if (/d[ée]clar|minist|mip/.test(b)) return { code: "MIP", libelle: "déclaration au ministère" };
  return null;
}
