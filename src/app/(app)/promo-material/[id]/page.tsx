import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, ListChecks, Megaphone, PackageCheck } from "lucide-react";
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
import { toNumber, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { AdProEditButton } from "@/components/ad-pro/edit-request-button";
import { canEditAdProRequest, isAdProDecided } from "@/lib/ad-pro-edit";
import { adProEditValues } from "@/lib/queries/ad-pro-edit";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocItem } from "@/components/documents/document-list";
import { DocumentUpload } from "@/components/documents/document-upload";
import { PROMO_MATERIAL_DOC_CATEGORIES, categoriesDuDepotDeLaDemande } from "@/lib/ad-pro/doc-categories";
import { contextePiecesLiees } from "@/lib/ad-pro/pieces-liees";
import { LinkedRecords } from "@/components/shared/linked-records";
import { canAttachToAdPro, attachHint } from "@/lib/ad-pro/attachments";
import { AdProDiscussionCard } from "@/components/ad-pro/discussion-card";
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
import { PromoExecutionCard, type ExecutionAffichee, type NatureAffichee } from "./execution-card";
import { PromoArticlesCard } from "./articles-card";
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
  // Ce que la personne peut ouvrir, déposer, créer parmi les pièces liées — la règle commune du
  // pôle (`contextePiecesLiees`), la même que sur les six autres fiches.
  const ctxPieces = await contextePiecesLiees(user, "PROMO_MATERIAL");

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

  const [documents] = await Promise.all([
    prisma.document.findMany({ where: { entityType: "PROMO_MATERIAL", entityId: pm.id }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
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
    canRequestQuotes: v2 && circuitState === "QUOTE_TO_REQUEST" && demandeLesDevis(acteur, pm),
    canDrive: piloteLExecution(acteur, pm),
    renvoi,
    canRenvoyer: peutTrancher && circuitState !== null && etatApresRenvoi(circuitState) !== null,
    canRefuser: peutTrancher && refusParLeDemandeur(user, pm) === null,
    canResoumettre: v2 && enCorrectionALaDemande && demandeLesDevis(acteur, pm),
    chantiers,
    waitingLabel: nomsAttendus ? `${attente} — ${nomsAttendus}` : attente,
    progressStep: circuitProgress.step,
    progressTotal: circuitProgress.total,
  };

  // LES ARTICLES DEMANDÉS (circuit 2, §118.165) — la demande piochée dans le catalogue. Le demandeur
  // (ou la Direction) la compose tant que les devis ne sont pas demandés — la règle de l'action.
  const articles = v2 ? await articlesDemandesDuDossier(pm.id) : [];
  // Jusqu'au départ du choix en validation (§118.190) — la règle de `refusComposition`, lue telle quelle.
  const canEditArticles = v2 && (circuitState === "REVIEW_REQUEST" || circuitState === "QUOTE_TO_REQUEST" || circuitState === "QUOTE_REQUESTED" || circuitState === "REVIEW_REQUESTER") && demandeLesDevis(acteur, pm);
  const canReceive = v2 && circuitState === "IN_EXECUTION" && peutReceptionner({ id: user.id, role: user.role }, pm);

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
  }));
  const canTranscribe = v2 && circuitState === "QUOTE_REQUESTED" && retranscritLesDevis(acteur, pm);
  const canSelect = v2 && circuitState === "REVIEW_REQUESTER" && choisitLesLignes(acteur, pm);
  const parties = canTranscribe ? await listPartyOptions(user.id, { includeIds: devis.map((d) => d.supplierId).filter((x): x is string => Boolean(x)) }) : undefined;

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

  return (
    <div className="space-y-5">
      <BackLink href="/promo-material"><ArrowLeft className="h-4 w-4" /> Matériel promotionnel</BackLink>
      <PageHeader title={pm.title} description={`Réf. ${pm.reference}`}>
        {/* ANNULÉ l'emporte : l'annulation arrête le circuit (état terminal), mais « Refusé » dirait
            qu'un validateur a tranché — ce n'est pas ce qui s'est passé. */}
        {circuitState && pm.status !== "CANCELLED"
          ? <StatusBadge map={{ [circuitState]: { label: libelleEtape(circuitState, version), tone: circuitState === "REFUSED" ? "danger" : circuitState === "COMPLETED" ? "success" : "info" } }} value={circuitState} />
          : <StatusBadge map={PROMO_MATERIAL_STATUS} value={pm.status} />}
        {canEditPromoRequest && promoEditValues && (
          <AdProEditButton kind="PROMO_MATERIAL" id={pm.id} decided={promoDecided} values={promoEditValues} />
        )}
        <SupprimerDemandeAdPro kind="PROMO_MATERIAL" id={pm.id} name={pm.title} enabled={await peutSupprimerUneDemandeAdPro(user, "PROMO_MATERIAL", pm.id)} />
      </PageHeader>

      {/* LE CIRCUIT — ce que chacun voit ici dépend de qui il est : la chaîne entière pour PDG /
          Super Admin, l'étape en cours pour les autres (règle `seesFullCircuit`, tranchée côté
          serveur). Au circuit 2, la frise est celle de CE dossier (les étapes qu'il traverse). */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4" /> Suivi du circuit</CardTitle></CardHeader>
        <CardContent><PromoCircuitCard {...circuitProps} /></CardContent>
      </Card>

      {/* LES ARTICLES DEMANDÉS — la demande piochée dans le catalogue : ce que l'assistante cherche à
          faire chiffrer, et à quoi chaque ligne de devis se rapproche (§118.165). */}
      {v2 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-4 w-4" /> Articles demandés</CardTitle></CardHeader>
          <CardContent>
            <PromoArticlesCard
              id={pm.id} articles={articles} canEdit={canEditArticles} options={canEditArticles ? optionsCatalogue : null}
              avertissement={circuitState === "REVIEW_REQUESTER"
                ? "Ajouter ou corriger un article renvoie le dossier à l'assistante, pour le faire chiffrer."
                : circuitState === "QUOTE_REQUESTED" ? "L'assistante cherche les devis : elle est prévenue de chaque changement." : null}
            />
          </CardContent>
        </Card>
      )}

      {/* LES DEVIS — le tableau interne : l'assistante retranscrit, le demandeur choisit ses lignes,
          les autres lisent. Il apparaît dès que les devis sont demandés. */}
      {montrerDevis && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4" /> Devis retranscrits</CardTitle></CardHeader>
          <CardContent>
            <PromoQuotesCard
              id={pm.id} quotes={devis} articles={articles} canTranscribe={canTranscribe} canSelect={canSelect}
              manques={canTranscribe ? manquesDeRetranscription(devis) : []}
              parties={parties} canCreateContact={userCan(user, "GENERAL_MEANS", "CREATE")}
              seuilDg={ctx?.seuilDg ?? null}
            />
          </CardContent>
        </Card>
      )}

      {/* L'EXÉCUTION — un bon de commande par devis retenu, ses factures, leur paiement et la
          demande de visa (ou de déclaration) qui part avec chaque paiement. */}
      {enExecution && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PackageCheck className="h-4 w-4" /> Exécution — bons de commande, factures, réception, paiements</CardTitle></CardHeader>
          <CardContent>
            <PromoExecutionCard
              id={pm.id} executions={executions} canPilot={piloteLExecution(acteur, pm)} canReceive={canReceive}
              ouvert={circuitState === "IN_EXECUTION"} optionsReception={choixAReception ? optionsCatalogue : null}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {/* Au circuit 2, les références de BC, de facture et de visa vivent dans la carte
                  « Exécution », une par fournisseur : les champs uniques de l'ancien parcours
                  n'y ont plus de sens, et les afficher vides ferait croire qu'il manque quelque chose. */}
              <Info label={v2 ? "Fournisseur(s) retenu(s)" : "Agence retenue"} value={pm.chosenAgency} />
              {/* « RETENU » N'EST VRAI QU'APRÈS LE CHOIX (§118.153). Avant que des lignes soient
                  retenues, le montant affiché est l'ESTIMATION de la demande : l'appeler « retenu »
                  faisait lire à la Direction Marketing un engagement que personne n'avait pris. */}
              <Info label={v2 ? (pm.chosenAmount != null ? "Montant retenu (TTC)" : "Montant estimé (demande)") : "Montant"} value={amount != null ? formatCurrency(amount) : null} />
              {!v2 && <Info label="N° bon de commande" value={pm.bcReference} />}
              {!v2 && <Info label="Visa publicitaire" value={pm.visaReference} />}
              {!v2 && <Info label="Réf. autorités" value={pm.authorityRef} />}
              <Info label="Demandeur" value={names.requester} />
              <Info label="Assistante" value={names.assistant} />
              {!v2 && <Info label="BC validé le" value={pm.bcValidatedAt ? formatDate(pm.bcValidatedAt.toISOString()) : null} />}
              {!v2 && <Info label="Paiement le" value={pm.paymentDoneAt ? formatDate(pm.paymentDoneAt.toISOString()) : null} />}
              {!v2 && pm.financeReminderCount > 0 && <Info label="Relances finances" value={`${pm.financeReminderCount}${pm.financeReminderAt ? ` · ${formatDateTime(pm.financeReminderAt.toISOString())}` : ""}`} />}
              {pm.description && <div className="col-span-full"><p className="text-xs text-muted-foreground">Brief</p><p className="whitespace-pre-wrap">{pm.description}</p></div>}
            </CardContent>
          </Card>

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
          <LinkedRecords
            entityType="PROMO_MATERIAL" entityId={pm.id} reference={pm.reference} canCreate={canUpload && !v2}
            acces={ctxPieces.acces} candidatsLegal={ctxPieces.candidatsLegal}
            piecesDeLaDemande={{
              titre: v2 ? "Pièces du dossier (maquettes, BAT, matériel, visa…)" : "Pièces du dossier (matériel, visa, bordereau, quittance…)",
              documents: docItems,
              televerseur: canUpload
                ? <DocumentUpload entityType="PROMO_MATERIAL" entityId={pm.id} categories={categoriesDuDepotDeLaDemande(PROMO_MATERIAL_DOC_CATEGORIES)} />
                : undefined,
              motif: canUpload ? null : uploadHint ?? null,
              // AU CIRCUIT 2, un fichier « devis » du dossier est le SCAN d'un devis retranscrit :
              // sa version plateforme est la ligne du tableau « Devis retranscrits », pas une fiche
              // à créer — le dire, au lieu de le présenter comme une pièce orpheline.
              noteLibres: v2 ? "Scans joints aux devis retranscrits — leur version plateforme est le tableau « Devis retranscrits »." : undefined,
              canDelete, canRename: canUpload, canEdit: onlyofficeConfigured() && canUpload,
              path: `/promo-material/${pm.id}`,
            }}
          />

          {/* LA SECTION DISCUSSION — la MÊME que sur les six autres natures du pôle.
              Le matériel promotionnel était le SEUL des sept à porter un fil, et il le portait
              en propre : son titre, sa phrase, son écrivain et sa porte de modération étaient
              écrits ici. Sept blocs auraient divergé au premier ajustement, et c'est le bloc de
              l'écran qu'on ne relit pas qui aurait pris du retard (§118.5). Le composant
              partagé charge le fil, compose la carte, et garde sur `canModerateEntity` — donc
              par ENREGISTREMENT, là où la version d'ici lisait deux drapeaux de rôle. */}
          <AdProDiscussionCard entityType="PROMO_MATERIAL" entityId={pm.id} user={user} />
        </div>

        <div className="space-y-5">
          {/* Les cartes d'action de l'ANCIEN parcours ne servent qu'aux dossiers d'avant la
              réforme : un dossier au circuit court se pilote depuis la carte « Suivi du circuit ». */}
          {!circuitState && (
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
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>;
}
