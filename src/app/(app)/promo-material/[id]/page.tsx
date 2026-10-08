import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ClipboardList, FileText, ListChecks, Megaphone, PackageCheck, Paperclip, Scale } from "lucide-react";
import { requireUser, safeLanding } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { canOpenModule } from "@/lib/modules-visibility";
import { getPromoMaterial, promoNames } from "@/lib/queries/promo-material";
import {
  contexteDuDossier, devisDuDossier, devisLu, peutOuvrirLeDossierPromo, validateursMarketing,
} from "@/lib/queries/promo-circuit";
import { executionDuDossier, verdictDuChantierPromo } from "@/lib/queries/promo-execution";
import { listPartyOptions } from "@/lib/queries/company-contacts";
import { manquesDeRetranscription } from "@/lib/promo-material/devis";
import { refusDeRangement } from "@/lib/promo-material/rangement";
import { texteDemandeDeDevis } from "@/lib/promo-material/texte-demande-devis";
import { ACTION_LABEL } from "@/lib/promo-material/actions-fournisseur";
import { libellesPromusDeLArticle } from "@/lib/promo-material/achats";
import { toNumber, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { AdProEditButton } from "@/components/ad-pro/edit-request-button";
import { canEditAdProRequest, isAdProDecided } from "@/lib/ad-pro-edit";
import { adProEditValues } from "@/lib/queries/ad-pro-edit";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { DocumentPreview } from "@/components/documents/document-preview";
import { DocumentUpload } from "@/components/documents/document-upload";
import { PROMO_MATERIAL_DOC_CATEGORIES, categoriesDuDepotDeLaDemande, natureDeLaCategorie } from "@/lib/ad-pro/doc-categories";
import { accesPiecesLiees, contextePiecesLiees } from "@/lib/ad-pro/pieces-liees";
import { LinkedRecords } from "@/components/shared/linked-records";
import { chargerPiecesLiees } from "@/lib/queries/chaine-des-pieces";
import { ETAPE_DEMANDE_DEVIS } from "@/lib/ad-pro/demande-devis-lettre";
import { canAttachToAdPro, attachHint } from "@/lib/ad-pro/attachments";
import { AdProDiscussionCard } from "@/components/ad-pro/discussion-card";
import { MedecinsConcernes } from "@/components/ad-pro/medecins-concernes";
import { SupprimerDemandeAdPro } from "@/components/ad-pro/supprimer-demande";
import { peutSupprimerUneDemandeAdPro } from "@/lib/queries/ad-pro-suppression";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { PROMO_MATERIAL_STATUS } from "@/lib/labels";
import {
  canValidate, seesFullCircuit, progress, waitingOn, PROMO_TRACKS, etapesDuDossier, libelleEtape, libelleCourt,
  libelleChantier, demandeLesDevis, retranscritLesDevis, choisitLesLignes, piloteLExecution,
  type PromoState, type PromoStep, type PromoTrack, type VersionCircuit,
} from "@/lib/promo-material/circuit";
import { attendSaCorrection, etatApresRenvoi, refusParLeDemandeur } from "@/lib/promo-material/renvoi";
import { PromoActionPanel } from "./promo-panels";
import { PromoCircuitCard, type ChantierAffiche } from "./circuit-card";
import { PromoQuotesCard, type DevisAffiche } from "./quotes-card";
import { RetirerDemandeDevis } from "./retirer-demande-devis";
import { etatRetraitDemandeDevis } from "@/lib/promo-material/retrait-devis";
import { PromoExecutionCard, type ExecutionAffichee, type NatureAffichee } from "./execution-card";
import { PromoArticlesCard } from "./articles-card";
import { DemandeDevisCard, type GenerationLettre } from "./demande-devis-card";
import { MenuDossier } from "@/components/shared/menu-dossier";
import { AttachToSourceButtons, type NaturePieceLiee } from "@/components/shared/attach-to-source";
import { articlesDemandesDuDossier, optionsDesArticlesDemandes } from "@/lib/queries/promo-achats";
import { etatReception, natureDeReception, peutReceptionner, resteAFacturer } from "@/lib/promo-material/achats";
import { libelleArticleStock } from "@/lib/promo/stock";
import { BackLink } from "@/components/shared/back-link";
import { siegeAuCentreAdPro } from "@/lib/ad-pro/centre";
import { etatDeLOrdre, LIBELLE_ETAT_REGLEMENT } from "@/lib/payments/reglement";

export const dynamic = "force-dynamic";


export default async function PromoMaterialDetailPage({ params }: { params: { id: string } }) {
  // LA PORTE DE LA FICHE EST CELLE DU DOSSIER, PAS SEULEMENT CELLE DU MODULE (§118.152). Le
  // circuit adresse des gestes à des personnes qui n'ont PAS le module Matériel promotionnel : le
  // N+1 d'un délégué qui valide sa demande, l'assistante de direction qui retranscrit les devis, le
  // pharmacien qui instruit la demande de visa d'un paiement. `requireModule` les renvoyait à leur
  // page d'accueil — la notification menait à une porte fermée, et le dossier attendait quelqu'un
  // qui ne pouvait pas l'ouvrir. On ouvre aux PARTIES PRENANTES du dossier, et à elles seules.
  // Un module MASQUÉ reste masqué (la même règle que `requireModule`) : l'éteindre ne veut pas
  // dire « absent du menu seulement ».
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  const { hiddenModules } = await getAppSettings();
  if (!canOpenModule("PROMO_MATERIAL", hiddenModules, { isSuperAdmin: user.role === "SUPER_ADMIN" })) {
    redirect(`${safeLanding(user)}?masque=PROMO_MATERIAL`);
  }
  const pm = await getPromoMaterial(params.id);
  if (!pm) notFound();
  if (!(await peutOuvrirLeDossierPromo(user, pm))) notFound();
  const names = await promoNames(pm);

  // CORRIGER LA DEMANDE : le demandeur tant que l'agence n'est pas choisie, la Direction
  // toujours. Au-delà du choix d'agence, le bon de commande et le visa s'appuient sur ce qui a
  // été arrêté — corriger après coup ferait diverger la pièce et le dossier.
  const promoDecided = isAdProDecided("PROMO_MATERIAL", pm.status, pm.circuitState);
  const canEditPromoRequest = canEditAdProRequest(
    { id: user.id, hasGlobalView: hasGlobalView(user.role), canManage: userCan(user, "PROMO_MATERIAL", "VALIDATE") },
    { requesterId: pm.requesterId, decided: promoDecided },
  );
  const promoEditValues = canEditPromoRequest ? await adProEditValues("PROMO_MATERIAL", pm.id) : null;

  const isDirection = hasGlobalView(user.role);
  const flags = {
    isMarketing: pm.requesterId === user.id || isDirection,
    isAssistant: user.role === "DIRECTION_ASSISTANT" || isDirection,
    isFinance: user.role === "FINANCE_BUDGET_MANAGER" || isDirection,
    isMedicalInfo: user.role === "MEDICAL_INFO_PHARMACIST" || isDirection,
    isDirection,
    isCentreAdPro: siegeAuCentreAdPro(user),
  };
  // QUI PEUT DÉCIDER DU DOSSIER PEUT Y JOINDRE SA FACTURE — la MÊME règle sur les cinq écrans
  // Ad&Pro (`ad-pro/attachments.ts`). Ici l'ancienne liste NOMMAIT quatre rôles : elle tenait
  // jusqu'à la première nomination qu'on oublie d'y ajouter. On lit désormais ce que la personne
  // peut FAIRE du dossier, et les quatre rôles y entrent par leurs droits — sans être nommés.
  const attacheur = {
    id: user.id,
    canUploadModule: userCan(user, "PROMO_MATERIAL", "UPLOAD"),
    canUpdateModule: userCan(user, "PROMO_MATERIAL", "UPDATE"),
    canValidateModule: userCan(user, "PROMO_MATERIAL", "VALIDATE"),
    hasGlobalView: isDirection,
  };
  const dossierAdPro = { requesterId: pm.requesterId, assistantId: pm.assistantId };
  const canUpload = canAttachToAdPro(attacheur, dossierAdPro)
    || flags.isMarketing || flags.isAssistant || flags.isFinance || flags.isMedicalInfo;
  const uploadHint = canUpload ? null : attachHint(attacheur, dossierAdPro);
  const canDelete = userCan(user, "PROMO_MATERIAL", "DELETE") || isDirection;

  // LES ORDRES DE DÉPENSE du bordereau et du règlement final (§118.148) : « Paiement effectué » et
  // la clôture se constatent sur eux — l'écran dit où ils en sont avant d'offrir le bouton.
  const idsOrdres = [pm.paymentOrderId, pm.settlementOrderId].filter((x): x is string => Boolean(x));
  const ordres = new Map(
    (idsOrdres.length
      ? await prisma.expenseOrder.findMany({ where: { id: { in: idsOrdres } }, select: { id: true, reference: true, status: true, centralStatus: true } })
      : []
    ).map((o) => {
      const etat = etatDeLOrdre(o);
      return [o.id, { reference: o.reference, etat: LIBELLE_ETAT_REGLEMENT[etat], regle: etat === "REGLE" }] as const;
    }),
  );

  const [tousLesDocuments] = await Promise.all([
    prisma.document.findMany({ where: { entityType: "PROMO_MATERIAL", entityId: pm.id }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  // LA LETTRE DE DEMANDE DE DEVIS (Word + PDF, Luna) a sa propre carte : elle ne se montre dans AUCUNE autre liste.
  const lettresDevis = tousLesDocuments.filter((d) => d.stepKey === ETAPE_DEMANDE_DEVIS);
  const documents = tousLesDocuments.filter((d) => d.stepKey !== ETAPE_DEMANDE_DEVIS);
  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null, createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));
  const amount = pm.chosenAmount != null ? toNumber(pm.chosenAmount) : pm.amount != null ? toNumber(pm.amount) : null;

  // LE CIRCUIT — tout se tranche ICI, côté serveur : ce que la personne voit (seesFullCircuit),
  // ce qu'elle peut faire (canValidate et les règles d'acteur du module pur), où en est le dossier,
  // ce qui manque à chaque chantier. Les composants clients n'affichent que ce qui leur est permis,
  // et lisent les mêmes règles que les actions — sinon l'écran montrerait un bouton qu'elles refusent.
  const circuitState = (pm.circuitState ?? null) as PromoState | null;
  const version: VersionCircuit = pm.circuitVersion === 2 ? 2 : 1;
  const v2 = version === 2 && circuitState !== null;
  // Ce que la personne peut ouvrir, déposer, créer parmi les pièces liées — la règle commune du
  // pôle (`contextePiecesLiees`), la même que sur les six autres fiches. Au circuit 2, le bloc « Pièces
  // liées » ne se monte plus (Direction, 07/10) : il ne faut que les accès, pas les candidats à rattacher.
  const ctxPieces = v2 ? { acces: accesPiecesLiees(user), candidatsLegal: [] } : await contextePiecesLiees(user, "PROMO_MATERIAL");
  // Créer un engagement (convention, contrat…) ou un courrier rattaché au dossier — offert dans « ⋯ » au circuit 2.
  const naturesEngagement: NaturePieceLiee[] = v2
    ? [ctxPieces.acces.creer?.engagement ? ("legal" as const) : null, ctxPieces.acces.creer?.courrier ? ("mail" as const) : null].filter((x): x is "legal" | "mail" => x !== null)
    : [];
  const acteur = { id: user.id, role: user.role, secondaryRole: user.secondaryRole, vueGlobale: isDirection };
  const tracksDone = ((pm.tracksDone ?? "").split(",").map((s) => s.trim()).filter(Boolean) as PromoTrack[])
    .filter((t) => (PROMO_TRACKS as readonly string[]).includes(t));
  const ctx = circuitState ? await contexteDuDossier(pm) : null;
  const marketing = v2 && circuitState === "REVIEW_MANAGER" ? await validateursMarketing(pm) : null;

  // L'EXÉCUTION (circuit 2) — lue une fois, pour la carte ET pour les verdicts des chantiers.
  const enExecution = v2 && (circuitState === "IN_EXECUTION" || circuitState === "COMPLETED");
  const execution = enExecution ? await executionDuDossier(pm.id) : [];
  const verdicts = new Map<PromoTrack, string | null>();
  if (v2 && circuitState === "IN_EXECUTION") {
    for (const t of PROMO_TRACKS) {
      if (tracksDone.includes(t)) continue;
      const v = await verdictDuChantierPromo(pm.id, t, execution);
      verdicts.set(t, v.ok ? null : v.raison);
    }
  }
  const chantiers: ChantierAffiche[] = PROMO_TRACKS.map((t) => ({
    key: t, label: libelleChantier(t, version), closed: tracksDone.includes(t), manque: verdicts.get(t) ?? null,
  }));

  // « ON ATTEND QUI ? » — au circuit 2, par leur NOM quand on le sait : une attente anonyme se
  // relance mal, et « la Direction Marketing » ne dit pas à qui écrire.
  const nomsAttendus = await (async (): Promise<string | null> => {
    if (!v2) return null;
    const nomsDe = async (ids: string[]) => (await prisma.user.findMany({ where: { id: { in: ids } }, select: { name: true } })).map((u) => u.name).join(", ");
    if (circuitState === "REVIEW_REQUEST") return pm.requestValidatorId ? await nomsDe([pm.requestValidatorId]) : "la Direction des opérations";
    if (circuitState === "QUOTE_REQUESTED") return names.assistant || "les assistantes de direction";
    if (circuitState === "REVIEW_REQUESTER" || circuitState === "QUOTE_TO_REQUEST") return names.requester || null;
    if (circuitState === "REVIEW_MANAGER") return marketing ? await nomsDe(marketing) : "la Direction Marketing";
    return null;
  })();
  // LE RENVOI POUR CORRECTION (§118.190) — lu par les MÊMES règles que les actions : un bouton offert
  // à qui l'action refuserait ferait chercher une panne qui n'existe pas (§118.83).
  const marque = { circuitState, returnedAt: pm.returnedAt };
  const enCorrectionALaDemande = circuitState === "REVIEW_REQUEST" && attendSaCorrection(marque);
  const peutTrancher = circuitState ? canValidate(user, circuitState, {
    requesterId: pm.requesterId, managerId: pm.managerId, requestValidatorId: pm.requestValidatorId,
    validateursMarketing: marketing, secondaryRole: user.secondaryRole,
  }) && !enCorrectionALaDemande : false;
  const renvoi = attendSaCorrection(marque) && pm.returnedAt ? {
    depuis: pm.returnedFrom ? libelleEtape(pm.returnedFrom as PromoState, version) : (circuitState ? libelleEtape(circuitState, version) : "—"),
    quand: new Date(pm.returnedAt).toLocaleDateString("fr-FR"),
    motif: pm.returnNote ?? "",
  } : null;
  const attente = circuitState ? waitingOn(circuitState, tracksDone, version) : "—";
  const circuitProgress = circuitState ? progress(circuitState, tracksDone, ctx ?? undefined) : { step: 0, total: 1 };
  const circuitProps = {
    id: pm.id,
    state: circuitState,
    version: version as 1 | 2,
    showFull: seesFullCircuit(user),
    etapes: ctx ? etapesDuDossier(ctx).map((st: PromoStep) => ({ key: st, label: libelleCourt(st, version) })) : [],
    stateLabel: circuitState ? libelleEtape(circuitState, version) : "—",
    canAct: peutTrancher,
    validerIci: !(version === 2 && circuitState === "REVIEW_REQUESTER"),
    canConfirmQuote: flags.isMarketing || flags.isAssistant || isDirection || user.role === "SUPER_ADMIN",
    canStart: !circuitState && (user.id === pm.requesterId || isDirection),
    canDrive: piloteLExecution(acteur, pm),
    renvoi,
    canRenvoyer: peutTrancher && circuitState !== null && etatApresRenvoi(circuitState) !== null,
    canRefuser: peutTrancher && refusParLeDemandeur(user, pm) === null,
    canResoumettre: v2 && enCorrectionALaDemande && demandeLesDevis(acteur, pm),
    chantiers,
    // UNE phrase « état — chez qui », sans redite : l'étape en mots courts, puis le nom attendu. (« L'assistante
    // de direction — retranscription des devis — les assistantes de direction » disait trois fois la même chose.)
    waitingLabel: circuitState === "COMPLETED" ? "Dossier terminé"
      : circuitState && nomsAttendus ? `${libelleCourt(circuitState, version)} — chez ${nomsAttendus}`
      : attente,
    progressStep: circuitProgress.step,
    progressTotal: circuitProgress.total,
  };

  // LES ARTICLES DEMANDÉS (circuit 2, §118.165) — la demande piochée dans le catalogue. Le demandeur
  // (ou la Direction) la compose tant que les devis ne sont pas demandés — la règle de l'action.
  const articles = v2 ? await articlesDemandesDuDossier(pm.id) : [];
  // Jusqu'au départ du choix en validation (§118.190) — la règle de `refusComposition`, lue telle quelle.
  // L'APERÇU DE LA DEMANDE DE DEVIS (§118.204) — ce que l'assistante recevra, tant qu'elle n'est pas partie ;
  // et, sur « devis à demander » (l'envoi automatique n'a pas pu partir, ou dossier d'avant), le geste qui l'envoie.
  const avantEnvoi = v2 && (circuitState === "REVIEW_REQUEST" || circuitState === "QUOTE_TO_REQUEST");
  const apercuDevis = avantEnvoi
    ? texteDemandeDeDevis({
        reference: pm.reference, titre: pm.title, brief: pm.description, precisions: pm.precisionsDevis, relance: false,
        articles: articles.map((a) => ({ reference: a.reference, nom: a.nom, quantite: a.quantite, unite: a.unite, actions: a.actions.map((x) => ACTION_LABEL[x]), promus: libellesPromusDeLArticle(a), commentaire: a.commentaire })),
      })
    : null;
  const envoiDevis = apercuDevis
    ? { apercu: apercuDevis, precisions: pm.precisionsDevis, peutEnvoyer: circuitState === "QUOTE_TO_REQUEST" && demandeLesDevis(acteur, pm), attendValidation: circuitState === "REVIEW_REQUEST" }
    : null;
  const canEditArticles = v2 && (circuitState === "REVIEW_REQUEST" || circuitState === "QUOTE_TO_REQUEST" || circuitState === "QUOTE_REQUESTED" || circuitState === "REVIEW_REQUESTER") && demandeLesDevis(acteur, pm);
  const canReceive = v2 && circuitState === "IN_EXECUTION" && peutReceptionner({ id: user.id, role: user.role }, pm);
  // RETIRER LA DEMANDE DE DEVIS (constat 35) — le demandeur (ou la Direction), tant que l'assistante n'a
  // rien retranscrit : la règle de l'action, lue ici pour n'offrir que ce qu'elle accepte (§118.83).
  const retraitDevis = v2 && circuitState === "QUOTE_REQUESTED" && demandeLesDevis(acteur, pm)
    ? await etatRetraitDemandeDevis(pm.id)
    : null;

  // LES DEVIS (circuit 2) — le tableau interne, dès que les devis sont demandés.
  const montrerDevis = v2 && circuitState !== "REVIEW_REQUEST" && circuitState !== "QUOTE_TO_REQUEST";
  const devisBruts = montrerDevis ? await devisDuDossier(pm.id) : [];
  const nomsScans = new Map(
    (devisBruts.length
      ? await prisma.document.findMany({ where: { id: { in: devisBruts.map((d) => d.documentId).filter((x): x is string => Boolean(x)) } }, select: { id: true, name: true } })
      : []
    ).map((d) => [d.id, d.name]),
  );
  const devis: DevisAffiche[] = devisBruts.map((d) => ({
    ...devisLu(d), quoteDate: d.quoteDate ? d.quoteDate.toISOString() : null, note: d.note,
    documentName: d.documentId ? nomsScans.get(d.documentId) ?? null : null,
    documentId: d.documentId ?? null,
  }));
  const canTranscribe = v2 && circuitState === "QUOTE_REQUESTED" && retranscritLesDevis(acteur, pm);
  // LES FICHIERS « DEVIS » DÉPOSÉS SANS FICHE (§118.204) — ceux qu'aucun devis du circuit ne désigne. Ils se
  // RANGENT comme devis d'une agence (« Ranger comme devis de… »), dans la carte « Devis » : plus de « Créer sa
  // fiche » sur un dossier de matériel promotionnel. Les scans déjà rangés ne se montrent qu'une fois — sur la
  // ligne de leur devis.
  const scansRanges = new Set(v2
    ? (await prisma.promoQuote.findMany({ where: { promoMaterialId: pm.id }, select: { documentId: true } })).map((q) => q.documentId).filter((x): x is string => Boolean(x))
    : []);
  const devisARanger = v2 ? docItems.filter((d) => natureDeLaCategorie(d.category) === "QUOTE" && !scansRanges.has(d.id)) : [];
  const rangementRefuse = refusDeRangement(circuitState);
  const peutRanger = v2 && rangementRefuse === null && retranscritLesDevis(acteur, pm);
  // Ce que montre « Pièces liées » : sans les scans rangés, et sans les devis à ranger quand la carte « Devis » les porte.
  const piecesLiees = v2
    ? docItems.filter((d) => !scansRanges.has(d.id) && !(montrerDevis && devisARanger.some((x) => x.id === d.id)))
    : docItems;
  const canSelect = v2 && circuitState === "REVIEW_REQUESTER" && choisitLesLignes(acteur, pm);
  const parties = canTranscribe || peutRanger ? await listPartyOptions(user.id, { includeIds: devis.map((d) => d.supplierId).filter((x): x is string => Boolean(x)) }) : undefined;

  // L'EXÉCUTION — une ligne par devis RETENU, avec son BC, ses factures et leur fichier.
  const facturesIds = execution.flatMap((e) => e.factures.map((f) => f.id));
  const fichiersFactures = new Map<string, string>();
  if (facturesIds.length) {
    const docs = await prisma.document.findMany({
      where: { entityType: "LEGAL_DOCUMENT", entityId: { in: facturesIds } },
      orderBy: { createdAt: "desc" }, select: { id: true, entityId: true },
    });
    for (const d of docs) if (!fichiersFactures.has(d.entityId)) fichiersFactures.set(d.entityId, d.id);
  }
  // OÙ CHAQUE LIGNE REÇUE EST ENTRÉE — le lot et l'article de stock, lus en un lot (§118.165).
  const lotIds = execution.flatMap((e) => e.factures.flatMap((f) => f.detail?.lignes.map((l) => l.stockLotId) ?? [])).filter((x): x is string => Boolean(x));
  const lots = new Map(
    (lotIds.length
      ? await prisma.promoStockLot.findMany({
          where: { id: { in: lotIds } },
          select: { id: true, numero: true, item: { select: { catalogue: { select: { nom: true } }, produits: { select: { product: { select: { canonicalName: true } } } } } } },
        })
      : []
    ).map((l) => [l.id, `Lot ${l.numero} — ${libelleArticleStock(l.item.catalogue.nom, l.item.produits.map((p) => p.product.canonicalName))}`]),
  );
  const articleParId = new Map(articles.map((a) => [a.id, a]));
  const executions: ExecutionAffichee[] = execution.filter((e) => e.lignesRetenues > 0).map((e) => ({
    quoteId: e.quoteId, fournisseur: e.fournisseur, reference: e.reference,
    lignes: e.lignesRetenues, ttc: e.retenu.ttc,
    bc: e.bcDetail && e.bc ? { ...e.bcDetail, etape: e.bc.etape } : null,
    envoyeLe: e.envoyeLe ? e.envoyeLe.toISOString() : null,
    lignesBC: e.lignesBC.map((l) => ({
      quoteLineId: l.quoteLineId, designation: l.designation, action: l.action, unite: l.unite,
      quantite: l.quantite, prixUnitaire: l.prixUnitaire, reste: resteAFacturer(l),
    })),
    taxes: e.taxes,
    factures: e.factures.map((f) => ({
      id: f.id, reference: f.reference, montant: f.montant, date: f.date ? f.date.toISOString() : null,
      etatReglement: f.etatReglement, reglee: f.reglee, paiementDemande: f.paiementDemande,
      demandeInfoMedicale: f.demandeInfoMedicale, fichierId: fichiersFactures.get(f.id) ?? null,
      detail: f.detail
        ? {
            tvaRate: f.detail.tvaRate, extraTaxLabel: f.detail.extraTaxLabel, extraTaxRate: f.detail.extraTaxRate, totalImprime: f.detail.totalImprime,
            lignes: f.detail.lignes.map((l) => {
              const article = l.requestItemId ? articleParId.get(l.requestItemId) ?? null : null;
              const n = natureDeReception(l, article);
              const nature: NatureAffichee = n.type === "STOCK"
                ? { type: "STOCK", famille: n.famille, libelle: article ? libelleArticleStock(article.nom, article.produits.map((p) => p.nom)) : "article demandé" }
                : n;
              return {
                id: l.id, designation: l.designation, action: l.action, unite: l.unite, quantite: l.quantite, prixUnitaire: l.prixUnitaire,
                quantiteRecue: l.quantiteRecue, renonce: l.renonce, etat: etatReception(l), nature,
                entree: l.stockLotId ? lots.get(l.stockLotId) ?? null : null,
              };
            }),
          }
        : null,
    })),
  }));
  // LE CATALOGUE N'EST CHARGÉ QUE SI UNE LIGNE « EN PLUS » ATTEND SA RÉCEPTION — c'est la seule qui
  // choisit son article ici ; les autres reçoivent dans l'article demandé.
  const choixAReception = canReceive && executions.some((e) => e.factures.some((f) => !f.paiementDemande && f.detail?.lignes.some((l) => l.nature.type === "A_CHOISIR" && l.etat === "EN_ATTENTE")));
  const optionsCatalogue = canEditArticles || choixAReception ? await optionsDesArticlesDemandes() : null;

  // LA DEMANDE DE DEVIS EN LETTRE (circuit 2) — Word + PDF de Luna, l'étape d'avant les devis. Regroupée par
  // génération (un PDF et un Word déposés ensemble) ; (re)générer : la règle de l'action (`regenererDemandeDevisPromo`).
  const peutGenererLettre = v2 && demandeLesDevis(acteur, pm);
  const generationsLettre: GenerationLettre[] = [];
  let debutGeneration = 0;
  for (const d of lettresDevis) {
    const cote = d.mimeType === "application/pdf" || /\.pdf$/i.test(d.name) ? "pdf" : "word";
    const t = d.createdAt.getTime();
    let g = generationsLettre[generationsLettre.length - 1];
    if (!g || g[cote] || debutGeneration - t > 5 * 60_000) {
      g = { quand: formatDateTime(d.createdAt.toISOString()), pdf: null, word: null };
      generationsLettre.push(g);
      debutGeneration = t;
    }
    // Supprimable : la règle de `deleteDocument` (qui l'a déposé, ou qui gère le dossier) — l'action la relit.
    g[cote] = { id: d.id, nom: d.name, supprimable: d.uploadedById === user.id || canDelete };
  }
  const derniereLettre = generationsLettre[0] ? (generationsLettre[0].pdf ?? generationsLettre[0].word) : null;
  const montrerDemandeDevis = v2 && (generationsLettre.length > 0 || peutGenererLettre || retraitDevis !== null);

  // LES ENGAGEMENTS LEGAL (circuit 2) — les devis, BC et factures vivent dans « Devis » et « Exécution » ; seuls les
  // conventions / contrats (et courriers) rattachés au dossier se lisent ici, en une ligne, et seulement s'il y en a.
  const piecesV2 = v2
    ? await chargerPiecesLiees({
        entityType: "PROMO_MATERIAL", entityId: pm.id, canCreate: false,
        spectateur: ctxPieces.acces.spectateur ?? null, courriers: ctxPieces.acces.courriers === true, documentsDeLaFiche: [],
      })
    : null;
  const engagements = piecesV2?.sections.ENGAGEMENT ?? [];
  const courriers = piecesV2?.courriers ?? [];

  // LES INFORMATIONS — seulement ce qui est connu ; le demandeur passe dans l'en-tête.
  const infos = ([
    [v2 ? "Fournisseur(s) retenu(s)" : "Agence retenue", pm.chosenAgency],
    // « RETENU » N'EST VRAI QU'APRÈS LE CHOIX (§118.153) : avant, le montant est l'ESTIMATION de la demande.
    [v2 ? (pm.chosenAmount != null ? "Montant retenu (TTC)" : "Montant estimé (demande)") : "Montant", amount != null ? formatCurrency(amount) : null],
    // Au circuit 2, les références de BC, de facture et de visa vivent dans la carte « Exécution », une par fournisseur.
    ...(v2 ? [] : [
      ["N° bon de commande", pm.bcReference],
      ["Visa publicitaire", pm.visaReference],
      ["Réf. autorités", pm.authorityRef],
    ]),
    ["Assistante", names.assistant],
    ...(v2 ? [] : [
      ["BC validé le", pm.bcValidatedAt ? formatDate(pm.bcValidatedAt.toISOString()) : null],
      ["Paiement le", pm.paymentDoneAt ? formatDate(pm.paymentDoneAt.toISOString()) : null],
      ["Relances finances", pm.financeReminderCount > 0 ? `${pm.financeReminderCount}${pm.financeReminderAt ? ` · ${formatDateTime(pm.financeReminderAt.toISOString())}` : ""}` : null],
    ]),
  ] as [string, string | null | undefined][]).filter((x): x is [string, string] => Boolean(x[1]));

  const peutSupprimer = await peutSupprimerUneDemandeAdPro(user, "PROMO_MATERIAL", pm.id);
  const peutCorriger = canEditPromoRequest && promoEditValues !== null;

  return (
    <div className="space-y-5">
      <BackLink href="/promo-material"><ArrowLeft className="h-4 w-4" /> Matériel promotionnel</BackLink>
      <PageHeader title={pm.title} description={`Réf. ${pm.reference}${names.requester ? ` · demandé par ${names.requester}` : ""}`}>
        {/* ANNULÉ l'emporte : l'annulation arrête le circuit (état terminal), mais « Refusé » dirait
            qu'un validateur a tranché — ce n'est pas ce qui s'est passé. */}
        {circuitState && pm.status !== "CANCELLED"
          ? <StatusBadge map={{ [circuitState]: { label: libelleEtape(circuitState, version), tone: circuitState === "REFUSED" ? "danger" : circuitState === "COMPLETED" ? "success" : "info" } }} value={circuitState} />
          : <StatusBadge map={PROMO_MATERIAL_STATUS} value={pm.status} />}
        {/* Corriger, supprimer, créer un engagement ou un courrier rattaché (Direction, 07/10 : il était parti avec
            « Pièces liées ») : des gestes rares — derrière « ⋯ ». Les mêmes droits que l'ancien bloc (`accesPiecesLiees`). */}
        {(peutCorriger || peutSupprimer || naturesEngagement.length > 0) && (
          <MenuDossier>
            {peutCorriger && promoEditValues && (
              <AdProEditButton kind="PROMO_MATERIAL" id={pm.id} decided={promoDecided} values={promoEditValues} />
            )}
            {naturesEngagement.length > 0 && (
              <AttachToSourceButtons entityType="PROMO_MATERIAL" entityId={pm.id} reference={pm.reference} kinds={naturesEngagement} />
            )}
            <SupprimerDemandeAdPro kind="PROMO_MATERIAL" id={pm.id} name={pm.title} enabled={peutSupprimer} />
          </MenuDossier>
        )}
      </PageHeader>

      {/* LE CIRCUIT — ce que chacun voit ici dépend de qui il est : la chaîne entière pour PDG /
          Super Admin, l'étape en cours pour les autres (règle `seesFullCircuit`, tranchée côté
          serveur). Au circuit 2, la frise est celle de CE dossier (les étapes qu'il traverse). */}
      {(circuitState || circuitProps.canStart) && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4" /> Suivi du circuit</CardTitle></CardHeader>
          <CardContent><PromoCircuitCard {...circuitProps} /></CardContent>
        </Card>
      )}

      {/* LES ARTICLES DEMANDÉS — la demande piochée dans le catalogue : ce que l'assistante cherche à
          faire chiffrer, et à quoi chaque ligne de devis se rapproche (§118.165). */}
      {v2 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-4 w-4" /> Articles demandés</CardTitle></CardHeader>
          <CardContent>
            <PromoArticlesCard
              id={pm.id} articles={articles} canEdit={canEditArticles} options={canEditArticles ? optionsCatalogue : null} envoiDevis={envoiDevis}
              avertissement={circuitState === "REVIEW_REQUESTER"
                ? "Ajouter ou corriger un article renvoie le dossier à l'assistante, pour le faire chiffrer."
                : circuitState === "QUOTE_REQUESTED" ? "L'assistante cherche les devis : elle est prévenue de chaque changement." : null}
            />
          </CardContent>
        </Card>
      )}

      {/* LES DEVIS — le tableau interne : l'assistante retranscrit, le demandeur choisit ses lignes,
          les autres lisent. Il apparaît dès que les devis sont demandés. */}
      {/* LA DEMANDE DE DEVIS — la lettre à l'agence (Word + PDF, papier en-tête), l'étape d'avant les devis. Son
          retrait au secrétariat (constat 35) vit ici aussi : c'est la même demande. */}
      {montrerDemandeDevis && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Demande de devis</CardTitle></CardHeader>
          <CardContent>
            <DemandeDevisCard
              promoMaterialId={pm.id} generations={generationsLettre} peutGenerer={peutGenererLettre}
              apercu={derniereLettre ? <DocumentPreview id={derniereLettre.id} name={derniereLettre.nom} hasFile path={`/promo-material/${pm.id}`} /> : null}
              retrait={retraitDevis ? <RetirerDemandeDevis promoMaterialId={pm.id} references={retraitDevis.demandes.map((d) => d.reference)} refus={retraitDevis.refus} /> : null}
            />
          </CardContent>
        </Card>
      )}

      {montrerDevis && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4" /> Devis</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <PromoQuotesCard
              id={pm.id} quotes={devis} articles={articles} canTranscribe={canTranscribe} canSelect={canSelect}
              manques={canTranscribe ? manquesDeRetranscription(devis) : []}
              parties={parties} canCreateContact={userCan(user, "GENERAL_MEANS", "CREATE")}
              seuilDg={ctx?.seuilDg ?? null}
              aRanger={devisARanger.map((d) => ({ id: d.id, nom: d.name, deposePar: d.uploadedBy, le: d.createdAt }))}
              peutRanger={peutRanger} refusRangement={rangementRefuse}
            />
          </CardContent>
        </Card>
      )}

      {/* L'EXÉCUTION — un bon de commande par devis retenu, ses factures, leur paiement et la
          demande de visa (ou de déclaration) qui part avec chaque paiement. */}
      {enExecution && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PackageCheck className="h-4 w-4 shrink-0" /> Exécution — bons de commande, factures, réception, paiements</CardTitle></CardHeader>
          <CardContent>
            <PromoExecutionCard
              id={pm.id} executions={executions} canPilot={piloteLExecution(acteur, pm)} canReceive={canReceive}
              ouvert={circuitState === "IN_EXECUTION"} optionsReception={choixAReception ? optionsCatalogue : null}
            />
          </CardContent>
        </Card>
      )}

      {/* La colonne de droite ne porte que les cartes d'action de l'ANCIEN parcours : sans elles, une seule colonne. */}
      <div className={circuitState ? "space-y-5" : "grid grid-cols-1 gap-5 lg:grid-cols-3"}>
        <div className={circuitState ? "space-y-5" : "space-y-5 lg:col-span-2"}>
          {/* LES INFORMATIONS — seulement les valeurs connues (le demandeur est dans l'en-tête) ; rien de connu : pas de carte. */}
          {(infos.length > 0 || pm.description) && (
            <Card>
              <CardHeader className="pb-3"><CardTitle>Informations</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 sm:gap-x-6">
                {infos.map(([label, value]) => <Info key={label} label={label} value={value} />)}
                {pm.description && <div className="col-span-full"><p className="text-xs text-muted-foreground">Brief</p><p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{pm.description}</p></div>}
              </CardContent>
            </Card>
          )}

          {/* CIRCUIT 2 — PLUS DE « PIÈCES LIÉES » (Direction, 07/10 : « trop de portes de vérité ») : les devis vivent
              dans « Devis », les BC et factures dans « Exécution ». Restent, repliés, les fichiers libres du dossier
              (BAT, maquettes, visa…), et les engagements Legal en une ligne — seulement s'il y en a. */}
          {v2 && (engagements.length > 0 || courriers.length > 0) && (
            <div className="surface flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <span className="flex items-center gap-1.5 font-medium"><Scale className="h-4 w-4 text-muted-foreground" /> Engagements</span>
              {engagements.map((l) => (
                l.fiche
                  ? <Link key={l.id} href={`/legal/${l.id}`} className="min-w-0 truncate hover:underline">{l.reference ?? l.titre}</Link>
                  : <span key={l.id} className="min-w-0 truncate">{l.reference ?? l.titre}</span>
              ))}
              {courriers.map((c) => (
                c.documents !== null
                  ? <Link key={c.id} href={`/courriers/${c.id}`} className="min-w-0 truncate text-muted-foreground hover:underline">{c.reference ?? c.titre}</Link>
                  : <span key={c.id} className="min-w-0 truncate text-muted-foreground">{c.reference ?? c.titre}</span>
              ))}
            </div>
          )}
          {v2 && (piecesLiees.length > 0 || canUpload) && (
            <details className="surface group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-1.5"><Paperclip className="h-4 w-4 text-muted-foreground" /> Fichiers <span className="font-normal text-muted-foreground">({piecesLiees.length})</span></span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-2 border-t border-border px-4 py-3">
                {canUpload
                  ? <DocumentUpload entityType="PROMO_MATERIAL" entityId={pm.id} categories={categoriesDuDepotDeLaDemande(PROMO_MATERIAL_DOC_CATEGORIES)} compact />
                  : uploadHint ? <p className="text-xs text-muted-foreground">{uploadHint}</p> : null}
                {piecesLiees.length > 0 && (
                  <DocumentList
                    documents={piecesLiees} canDelete={canDelete} canRename={canUpload} canEdit={onlyofficeConfigured() && canUpload}
                    path={`/promo-material/${pm.id}`}
                  />
                )}
              </div>
            </details>
          )}

          {/* CE QUI EN DÉCOULE : engagement, facture, courrier. Le mécanisme connaissait déjà ce
              type de dossier ; il ne manquait que le bloc — et l'on ne pouvait donc RIEN rattacher
              à un dossier de matériel. Créés d'ici, ils gardent le lien : c'est le seul moment où
              l'on sait de quoi ils viennent, et le seul où le rattachement ne coûte rien. */}
          {/* AU CIRCUIT 2, LES BC ET LEURS FACTURES NAISSENT DE LA CARTE « EXÉCUTION » : un BC créé
              ici ne serait rattaché à aucun devis validé — il échapperait au choix des lignes, et
              la facture qui en découlerait ne serait comptée par aucun chantier. Le bloc reste en
              LECTURE : ce qui est rattaché au dossier s'y voit toujours. */}
          {/* LE BLOC « DOCUMENTS » GÉNÉRIQUE A DISPARU (§118.161) — décision de la Direction : les
              devis, bons de commande et factures ont chacun leur fiche au registre ET leur PDF, dans
              la chaîne des pièces liées. Les fichiers déjà déposés sur le dossier ne disparaissent
              pas : les pièces du dossier (matériel, BAT, visa, bordereau…) gardent leur place
              nommée, et un devis ou un BC déposé comme simple fichier est montré dans la section de
              sa nature, avec « Créer sa fiche ». */}
          {/* L'ANCIEN CIRCUIT garde son bloc « Pièces liées » tel quel (le circuit 2 a ses fichiers repliés ci-dessus). */}
          {!v2 && (
            <LinkedRecords
              entityType="PROMO_MATERIAL" entityId={pm.id} reference={pm.reference} canCreate={canUpload}
              acces={ctxPieces.acces} candidatsLegal={ctxPieces.candidatsLegal} suppression
              piecesDeLaDemande={{
                titre: "Pièces du dossier (matériel, visa, bordereau, quittance…)",
                documents: piecesLiees,
                televerseur: canUpload
                  ? <DocumentUpload entityType="PROMO_MATERIAL" entityId={pm.id} categories={categoriesDuDepotDeLaDemande(PROMO_MATERIAL_DOC_CATEGORIES)} />
                  : undefined,
                motif: canUpload ? null : uploadHint ?? null,
                // PLUS DE « CRÉER SA FICHE » SUR UN DOSSIER DE MATÉRIEL PROMOTIONNEL (§118.204) — la note est
                // TOUJOURS posée, ancien circuit compris : c'est elle qui retire le bouton.
                noteLibres: "Pièces de l'ancien circuit, déposées sur le dossier.",
                canDelete, canRename: canUpload, canEdit: onlyofficeConfigured() && canUpload,
                path: `/promo-material/${pm.id}`,
              }}
            />
          )}

          {/* LA SECTION DISCUSSION — la MÊME que sur les six autres natures du pôle.
              Le matériel promotionnel était le SEUL des sept à porter un fil, et il le portait
              en propre : son titre, sa phrase, son écrivain et sa porte de modération étaient
              écrits ici. Sept blocs auraient divergé au premier ajustement, et c'est le bloc de
              l'écran qu'on ne relit pas qui aurait pris du retard (§118.5). Le composant
              partagé charge le fil, compose la carte, et garde sur `canModerateEntity` — donc
              par ENREGISTREMENT, là où la version d'ici lisait deux drapeaux de rôle. */}
          {/* LES MÉDECINS CONCERNÉS (Direction, 08/10) — choisis dans l'annuaire : le lien que lisent le cockpit marketing et la fiche du praticien. */}
          <MedecinsConcernes user={user} entityType="PROMO_MATERIAL" entityId={pm.id} />

          <AdProDiscussionCard entityType="PROMO_MATERIAL" entityId={pm.id} user={user} />
        </div>

        {/* Les cartes d'action de l'ANCIEN parcours ne servent qu'aux dossiers d'avant la
            réforme : un dossier au circuit court se pilote depuis la carte « Suivi du circuit ». */}
        {!circuitState && (
          <div className="space-y-5">
            <PromoActionPanel
              id={pm.id}
              status={pm.status}
              flags={flags}
              chosenAgency={pm.chosenAgency}
              bcReference={pm.bcReference}
              visaReference={pm.visaReference}
              authorityRef={pm.authorityRef}
              amount={amount}
              reminderCount={pm.financeReminderCount}
              paymentOrder={ordres.get(pm.paymentOrderId ?? "") ?? null}
              settlementOrder={ordres.get(pm.settlementOrderId ?? "") ?? null}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium [overflow-wrap:anywhere]">{value || "—"}</p></div>;
}
