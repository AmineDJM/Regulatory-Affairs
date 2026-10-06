import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { moneyEntityOf } from "@/lib/company";
import type { CurrentUser } from "@/lib/session";
import { buildRef, createWithRetry, enSerie } from "@/lib/refs";
import { MENU_CATALOGUE_PROMO } from "@/lib/chemins/stock-promo";
import { CHEMIN_BONS_DE_COMMANDE } from "@/lib/chemins/bons-de-commande";
import { etatsDesBC } from "@/lib/bons-de-commande/etat";
import { emettreDocumentDrive } from "@/platform/in-process/artifact/factory";
import { devisDuDossier, devisLu } from "@/lib/queries/promo-circuit";
import { articleDemandeLu, SELECT_ARTICLE_DEMANDE } from "@/lib/queries/promo-achats";
import { lignesDuBonDeCommande, formatDzd } from "@/lib/promo-material/devis";
import { libellesPromusDeLArticle } from "@/lib/promo-material/achats";
import { ACTION_LABEL } from "@/lib/promo-material/actions-fournisseur";
import { texteDemandeDeDevis } from "@/lib/promo-material/texte-demande-devis";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES AUTOMATISMES DU CIRCUIT 2 DU MATÉRIEL PROMOTIONNEL (§118.204).
 *
 * « La demande de devis est générée automatiquement » et « le BC devient automatique, par
 * fournisseur » (Direction, 04/10). Deux gestes que le demandeur faisait à la main — « Demander les
 * devis à l'assistante de direction », « Générer les bons de commande » — partent désormais d'eux-mêmes
 * au moment où le circuit les rend possibles :
 *
 *   • LA DEMANDE DE DEVIS, quand le dossier ARRIVE sur « devis à demander » : à la création s'il n'a
 *     pas de validation de la demande, sinon quand cette validation tombe (`validatePromoStep`). Avant,
 *     demander des devis sur une demande que personne n'a encore acceptée ferait travailler le
 *     secrétariat et les agences pour rien — la règle d'avant reste, seul le clic disparaît.
 *   • LES BONS DE COMMANDE, quand la DERNIÈRE validation du choix tombe (Direction Marketing, puis le
 *     Directeur Général au-dessus du seuil) : aucune validation n'est retirée, la génération vient après.
 *
 * Hors d'un fichier « use server », et hors de `src/lib/actions/` : ce ne sont pas des actions d'écran — le
 * contrat d'action et la parité d'Adam les auraient comptées, et le chemin générique aurait pu les appeler.
 * Ces fonctions reçoivent l'auteur en argument. Exportées d'un tel
 * fichier, elles seraient des points d'entrée publics où l'on agirait au nom de n'importe qui (§118.153).
 * Chacune garde ses portes d'ÉTAT (version, étape lue, écriture conditionnelle) : ce sont les APPELANTS
 * qui disent qui a le droit de les déclencher.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const chemin = (id: string) => `/promo-material/${id}`;

export type DossierDevis = {
  id: string; reference: string; title: string; circuitVersion: number; circuitState: string | null;
  requesterId: string | null; assistantId: string | null; description: string | null; companyId: string | null;
};

const SELECT_DOSSIER_DEVIS = {
  id: true, reference: true, title: true, circuitVersion: true, circuitState: true, requesterId: true,
  assistantId: true, description: true, companyId: true, precisionsDevis: true,
} as const;

/** La référence d'une demande au secrétariat — la même série que les demandes de devis des postes. */
async function prochaineReferenceDemande(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await prisma.administrativeRequest.findMany({ where: { reference: { startsWith: `DEM-${year}-` } }, select: { reference: true } });
  return buildRef("DEM", year, rows.map((r) => r.reference));
}

/** Les articles d'un dossier, dans la forme que le texte de la demande lit — la même que l'aperçu du formulaire. */
async function articlesPourLeDevis(promoMaterialId: string) {
  const rows = await prisma.promoRequestItem.findMany({
    where: { promoMaterialId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: SELECT_ARTICLE_DEMANDE,
  });
  return rows.map(articleDemandeLu).map((a) => ({
    reference: a.reference, nom: a.nom, quantite: a.quantite, unite: a.unite,
    actions: a.actions.map((x) => ACTION_LABEL[x]), promus: libellesPromusDeLArticle(a), commentaire: a.commentaire,
  }));
}

/**
 * OUVRIR UNE DEMANDE DE DEVIS AU SECRÉTARIAT — la première, ou une nouvelle (`redemanderDevisPromo`).
 * Une seule rédaction (`texteDemandeDeDevis`), celle que le demandeur a vue en aperçu. Rien ne bascule
 * ici : la bascule est conditionnelle, chez l'appelant, APRÈS la création (§118.107).
 */
export async function ouvrirDemandeDeDevis(
  auteurId: string, pm: DossierDevis, note: string | null, relance: boolean,
): Promise<{ ok: true; demande: { id: string; reference: string } } | { ok: false; error: string }> {
  // LES ARTICLES D'ABORD (§118.165) : une demande de devis sans article ferait chercher l'assistante
  // dans un brief en prose. Le refus nomme le geste, et le cas du catalogue vide.
  const articles = await articlesPourLeDevis(pm.id);
  if (articles.length === 0) {
    const catalogueVide = (await prisma.promoCatalogueArticle.count({ where: { actif: true } })) === 0;
    return {
      ok: false,
      error: catalogueVide
        ? `Composez d'abord la liste des articles à faire chiffrer — mais le catalogue est encore vide : demandez au Super Admin d'y ajouter vos supports (${MENU_CATALOGUE_PROMO}).`
        : "Composez d'abord la liste des articles à faire chiffrer (« Articles demandés », piochés dans le catalogue) : c'est elle qui dit à l'assistante quels devis chercher.",
    };
  }
  // LA SOCIÉTÉ DE LA DEMANDE — celle du dossier, sinon celle où TRAVAILLE le demandeur (§118.154).
  const societe = pm.companyId ?? (await moneyEntityOf(pm.requesterId ?? auteurId));
  const demande = await createWithRetry(async () => prisma.administrativeRequest.create({
    data: {
      reference: await prochaineReferenceDemande(),
      type: "QUOTE",
      title: `${relance ? "Nouveaux devis" : "Devis"} — matériel promotionnel ${pm.reference} : ${pm.title}`,
      description: texteDemandeDeDevis({ reference: pm.reference, titre: pm.title, brief: pm.description, precisions: note, relance, articles }),
      priority: "HIGH",
      status: "NEW",
      requesterId: pm.requesterId ?? auteurId,
      assignedToId: pm.assistantId,
      companyId: societe,
      linkedEntityType: "PROMO_MATERIAL",
      linkedEntityId: pm.id,
    },
    select: { id: true, reference: true },
  }));
  return { ok: true, demande };
}

/** L'avis à l'assistante — une rédaction, que chaque appelant envoie (l'assistante nommée, sinon le secrétariat). */
export function avisDemandeDeDevis(pm: { id: string; reference: string; title: string }) {
  return { type: "ASSIGNMENT" as const, title: "Matériel promotionnel — devis à demander et à retranscrire", body: `${pm.reference} — ${pm.title}`, link: chemin(pm.id) };
}

export type EnvoiDemandeDeDevis =
  | { ok: true; demande: { id: string; reference: string }; assistantId: string | null; avis: ReturnType<typeof avisDemandeDeDevis> }
  | { ok: false; error: string };

/**
 * ENVOYER LA DEMANDE DE DEVIS D'UN DOSSIER QUI EST SUR « DEVIS À DEMANDER » — à sa création, à la
 * validation de la demande, ou depuis la rubrique « Articles demandés » (le repli, quand l'envoi
 * automatique n'a pas pu partir). La demande d'abord, la bascule CONDITIONNELLE ensuite : deux envois
 * simultanés ne font pas deux demandes — le perdant retire la sienne, que personne n'a vue.
 *
 * Les précisions sont celles qu'on lui passe, sinon celles saisies à la création (`precisionsDevis`).
 * L'avis à l'assistante n'est PAS envoyé ici : l'appelant l'envoie (`avisDemandeDeDevis`), pour que
 * chaque geste déclare lui-même qu'il prévient quelqu'un.
 */
export async function envoyerDemandeDeDevis(auteurId: string, promoMaterialId: string, note?: string | null): Promise<EnvoiDemandeDeDevis> {
  const pm = await prisma.promoMaterial.findUnique({ where: { id: promoMaterialId }, select: SELECT_DOSSIER_DEVIS });
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (pm.circuitVersion !== 2) return { ok: false, error: "Ce dossier suit l'ancien circuit : ses devis s'y déposent comme pièces." };
  if (pm.circuitState === "REVIEW_REQUEST") return { ok: false, error: "La demande n'est pas encore validée : la demande de devis partira d'elle-même dès qu'elle le sera." };
  if (pm.circuitState !== "QUOTE_TO_REQUEST") return { ok: false, error: "La demande de devis de ce dossier est déjà partie." };
  const precisions = note !== undefined && note !== null ? note : pm.precisionsDevis;
  const ouverte = await ouvrirDemandeDeDevis(auteurId, pm, precisions, false);
  if (!ouverte.ok) return ouverte;
  const bascule = await prisma.promoMaterial.updateMany({
    where: { id: pm.id, circuitVersion: 2, circuitState: "QUOTE_TO_REQUEST" },
    data: {
      circuitState: "QUOTE_REQUESTED", quotesRequestedAt: new Date(), quotesRequestedById: pm.requesterId ?? auteurId,
      adminRequestId: ouverte.demande.id, precisionsDevis: precisions, updatedById: auteurId,
    },
  });
  if (bascule.count === 0) {
    await prisma.administrativeRequest.delete({ where: { id: ouverte.demande.id } }).catch(() => {});
    return { ok: false, error: "La demande de devis de ce dossier vient de partir." };
  }
  await recordAudit({
    actorId: auteurId, action: "UPDATE", module: "Matériel promotionnel", entityType: "PROMO_MATERIAL", entityId: pm.id,
    summary: `Demande de devis envoyée au secrétariat (${ouverte.demande.reference})${precisions ? ` — ${precisions.slice(0, 200)}` : ""}`,
  });
  revalidatePath(chemin(pm.id));
  revalidatePath("/demandes");
  return { ok: true, demande: ouverte.demande, assistantId: pm.assistantId, avis: avisDemandeDeDevis(pm) };
}

// ───────────────────────── Les bons de commande ─────────────────────────

/**
 * LA SOCIÉTÉ QUI COMMANDE — celle du dossier ; à défaut, celle où travaille son DEMANDEUR. Jamais celle
 * de la personne qui clique (ni du validateur qui déclenche la génération automatique) : deux gestes du
 * même dossier doivent produire le même BC. `null` quand rien ne se lit à coup sûr.
 */
async function societeDuDossier(pm: { companyId: string | null; requesterId: string | null }): Promise<string | null> {
  if (pm.companyId) return pm.companyId;
  if (!pm.requesterId) return null;
  const e = await prisma.employee.findFirst({
    where: { userId: pm.requesterId },
    select: { companyId: true, departmentRef: { select: { companyId: true } } },
  });
  return e?.companyId ?? e?.departmentRef?.companyId ?? null;
}

const SELECT_DOSSIER_BC = { id: true, reference: true, title: true, status: true, circuitVersion: true, circuitState: true, requesterId: true, companyId: true } as const;
type DossierBC = { id: string; reference: string; title: string; status: string; circuitVersion: number; circuitState: string | null; requesterId: string | null; companyId: string | null };

/** L'ÉTAT qui autorise une génération — la porte d'état, sans la porte de PERSONNE (l'appelant la tient). */
export function refusEtatGeneration(pm: DossierBC | null): string | null {
  if (!pm) return "Dossier introuvable.";
  if (pm.circuitVersion !== 2) return "Ce dossier suit l'ancien circuit : ses bons de commande se créent depuis « Pièces liées ».";
  if (pm.circuitState === "IN_EXECUTION") return null;
  if (pm.status === "CANCELLED") return "Ce dossier a été annulé : plus rien ne s'y génère ni ne s'y facture.";
  if (pm.circuitState === "REFUSED") return "Ce dossier a été refusé : plus rien ne s'y génère ni ne s'y facture.";
  return pm.circuitState === "COMPLETED"
    ? "Ce dossier est terminé."
    : "Les bons de commande se génèrent une fois TOUTES les validations obtenues (demandeur, Direction Marketing, et Directeur Général au-dessus du seuil).";
}

export interface OptionsGeneration {
  livraison: { adresse: string | null; delai: string | null };
  notes: string | null;
  /** `undefined` : celle de chaque devis ; `null` : aucune ; sinon la taxe pour tous les BC. */
  taxe: { libelle: string; taux: number } | null | undefined;
  /** Généré à la dernière validation, sans geste : dit dans l'audit de la fabrique. */
  automatique: boolean;
}

export type BilanGeneration = { ok: true; emis: number; echecs: string[]; message: string } | { ok: false; error: string };

/**
 * GÉNÉRER LES BONS DE COMMANDE — un par devis dont une ligne est retenue, et qui n'en a pas (un devis
 * est celui d'UN fournisseur : c'est le BC de l'agence). Idempotent et sérialisé par dossier (`enSerie`) :
 * deux déclenchements simultanés — la validation automatique et un clic de repli — ne font pas deux BC.
 * Chaque devis est isolé : l'échec de l'un est DIT sans empêcher les autres.
 */
export async function genererLesBonsDeCommande(user: CurrentUser, promoMaterialId: string, o: OptionsGeneration): Promise<BilanGeneration> {
  const lu = await prisma.promoMaterial.findUnique({ where: { id: promoMaterialId }, select: SELECT_DOSSIER_BC });
  const refus = refusEtatGeneration(lu);
  if (refus || !lu) return { ok: false, error: refus ?? "Dossier introuvable." };
  const societe = await societeDuDossier(lu);
  if (!societe) {
    return { ok: false, error: "La société qui commande est introuvable : le dossier n'en nomme aucune, et la fiche salarié de son demandeur non plus. Renseignez la société du demandeur (RH › fiche salarié), puis relancez la génération depuis la carte « Exécution »." };
  }
  return enSerie(`promo-bc:${lu.id}`, async (): Promise<BilanGeneration> => {
    // LE DOSSIER SE RELIT DANS LA FILE : l'annulation y passe aussi (`cancelPromoMaterial`).
    const pm = await prisma.promoMaterial.findUnique({ where: { id: promoMaterialId }, select: SELECT_DOSSIER_BC });
    const refusDansLaFile = refusEtatGeneration(pm);
    if (refusDansLaFile || !pm) return { ok: false, error: refusDansLaFile ?? "Dossier introuvable." };
    const devis = await devisDuDossier(pm.id);
    const etats = await etatsDesBC(devis.map((d) => d.purchaseOrderId).filter((x): x is string => Boolean(x)));
    const actifs = new Set(devis.filter((d) => {
      const e = d.purchaseOrderId ? etats.get(d.purchaseOrderId) : undefined;
      return e && !e.annule;
    }).map((d) => d.id));
    const aGenerer = devis.filter((d) => d.lines.some((l) => l.selected) && !actifs.has(d.id));
    if (aGenerer.length === 0) {
      return { ok: true, emis: 0, echecs: [], message: "Chaque devis retenu a déjà son bon de commande — rien de nouveau à générer." };
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
        // Pas de TVA indiquée sur le devis = pas de TVA (jamais devinée).
        tvaDefaut: (d.tvaRate ?? 0) / 100,
        taxes: o.taxe !== undefined
          ? (o.taxe ? [o.taxe] : null)
          : d.extraTaxRate ? [{ libelle: d.extraTaxLabel ?? "Taxe additionnelle", taux: d.extraTaxRate / 100 }] : null,
        referenceAmont: d.reference,
        referenceAmontDate: brut.quoteDate ? brut.quoteDate.toISOString().slice(0, 10) : null,
        objet: `Matériel promotionnel ${pm.reference} — ${pm.title}`,
        livraison: o.livraison.adresse || o.livraison.delai ? o.livraison : null,
        notes: o.notes,
        dossier: `Matériel promotionnel/${pm.reference}`,
      }, {
        source: { type: "PROMO_MATERIAL", id: pm.id },
        delegation: `${pm.reference} — dossier de matériel promotionnel validé (demande, Direction Marketing, seuil du DG), bon de commande composé d'après les lignes retenues${o.automatique ? ", généré automatiquement à la dernière validation" : ""}`,
      });
      if (!r.ok) { echecs.push(`${d.supplierName} : ${r.motif}`); continue; }
      // LE LIEN S'ÉCRIT SUR CE QUI A ÉTÉ LU (§118.204) : le dossier encore en exécution, le devis encore sur le BC
      // (ou l'absence de BC) que la génération a lu. Une écriture par le seul identifiant recoudrait le devis à ce
      // BC par-dessus un autre lien posé entre-temps, ou sur un dossier sorti de l'exécution.
      const lie = await prisma.promoQuote.updateMany({
        where: { id: d.id, purchaseOrderId: brut.purchaseOrderId ?? null, promoMaterial: { circuitVersion: 2, circuitState: "IN_EXECUTION" } },
        data: { purchaseOrderId: r.legalDocumentId, purchaseOrderSentAt: null, purchaseOrderSentById: null },
      });
      if (lie.count === 0) { echecs.push(`${d.supplierName} : ${r.reference} émis, mais le devis ou le dossier a changé pendant la génération — rechargez la fiche`); continue; }
      emis.push(`${r.reference} (${d.supplierName}, ${formatDzd(r.totaux.totalTtc)} TTC)`);
      if (r.reserveBonDeCommande) reserves.push(r.reserveBonDeCommande);
    }
    if (emis.length) {
      await recordAudit({
        actorId: user.id, action: "UPDATE", module: "Matériel promotionnel", entityType: "PROMO_MATERIAL", entityId: pm.id,
        summary: `Bons de commande générés${o.automatique ? " automatiquement (dernière validation)" : ""} : ${emis.join(" ; ")}`,
      });
    }
    revalidatePath(chemin(pm.id));
    revalidatePath(CHEMIN_BONS_DE_COMMANDE);
    if (emis.length === 0) return { ok: false, error: `Aucun bon de commande n'a pu être généré — ${echecs.join(" ; ")}.` };
    const suite = [...new Set(reserves)].join(" ");
    return {
      ok: true, emis: emis.length, echecs,
      message: `${emis.length} bon${emis.length > 1 ? "s" : ""} de commande généré${emis.length > 1 ? "s" : ""} : ${emis.join(" ; ")}.`
        + (echecs.length ? ` Non générés : ${echecs.join(" ; ")}.` : "")
        + (suite ? ` ${suite}` : ""),
    };
  });
}
