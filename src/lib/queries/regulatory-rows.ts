import { prisma } from "@/lib/prisma";
import { isRegulatorySupervisor, type SessionUser } from "@/lib/rbac";
import { getMyCompanies } from "@/lib/company";
import { clauseRegulatoryVisible } from "@/lib/queries/regulatory-visibilite";
import { getAppSettings } from "@/lib/settings";
import { regProgress, type RegWorkflowState } from "@/lib/regulatory-workflow";
import { regStage } from "@/lib/regulatory/stage";
import { dossierReceived } from "@/lib/regulatory/dossier-received";
import { effectiveStage } from "@/lib/regulatory/manufacturing-stage";
import { PHARMA_FORM, DOSAGE_UNIT } from "@/lib/labels";
import type { RegulatoryRow } from "@/app/(app)/regulatory/regulatory-table";

/**
 * LES LIGNES DU TABLEAU REGULATORY — chargées une seule fois, lues par deux écrans.
 *
 * Le suivi des dossiers (`/regulatory`) et le PIPELINE (`/regulatory/pipeline`)
 * montrent les mêmes objets sous deux angles : ce qu'on instruit, et ce qu'on étudie. Deux
 * chargements parallèles finiraient par diverger sur une colonne — celle qu'on aurait corrigée
 * d'un côté seulement.
 */
/**
 * LE PÉRIMÈTRE VISIBLE D'UNE PERSONNE SUR REGULATORY — la clause UNIQUE de l'écran, du pipeline et des outils
 * du Chief of Staff (LE CHIEF NE DOIT JAMAIS CONTREDIRE L'ÉCRAN). Elle vit dans `regulatory-visibilite.ts`,
 * que la fiche lit aussi (`canAccessEntity`) — deux écritures de la même règle finiraient par diverger
 * (§118.5), et c'est exactement ce que l'audit a trouvé : la fiche ne composait ni l'entité ni la gamme.
 */
export async function regulatoryVisibleWhere(user: SessionUser) {
  return clauseRegulatoryVisible(user, "liste");
}

export async function getRegulatoryRows(user: SessionUser) {
  const [products, suppliers, companies, settings] = await Promise.all([
    prisma.regulatoryProduct.findMany({
      where: await regulatoryVisibleWhere(user),
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      include: {
        responsible: { select: { name: true } },
        assistant: { select: { name: true } },
        supplier: { select: { name: true } },
        company: { select: { id: true, name: true, shortName: true, color: true } },
        // LE PROJET BD — le classement stratégique du dossier (sous-module « Projets »).
        bdProject: { select: { id: true, name: true } },
        // Variations : c'est la variation OBTENUE qui fait foi sur le niveau de process.
        variations: { select: { toStatus: true, status: true, decisionDate: true, createdAt: true } },
      },
    }),
    prisma.supplier.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getMyCompanies(user.id),
    getAppSettings(),
  ]);
  // Supervision Regulatory : Super Admin + rôles configurés (priorité, dates, MàJ de statut).
  const canSupervise = isRegulatorySupervisor(user, settings.regulatorySupervisorRoles);

  // ── « DOSSIER REÇU » — CONSTATÉ, JAMAIS SAISI ───────────────────────────────────────────────
  //
  // La question « avons-nous reçu le dossier CTD ? » se posait en ouvrant l'onglet Enregistrement
  // et en cherchant le produit. Elle se lit désormais dans le tableau, et sa réponse vient du
  // FAIT : une ARCHIVE a-t-elle été téléversée ? Un dossier d'enregistrement simplement ouvert ne
  // suffit pas — on l'ouvre souvent des semaines avant que le fournisseur envoie quoi que ce soit.
  //
  // Une seule requête pour toute la page : interroger produit par produit ferait soixante-neuf
  // allers en base pour une colonne.
  const withArchive = await prisma.regulatoryDossier.findMany({
    where: {
      productId: { in: products.map((p) => p.id) },
      versions: { some: { originalZipBlobId: { not: null } } },
    },
    select: { productId: true },
  });
  const recus = new Set(withArchive.map((d) => d.productId).filter((v): v is string => Boolean(v)));

  const rows: RegulatoryRow[] = products.map((p) => {
    const prog = regProgress(p.workflow as RegWorkflowState | null);
    const done = prog.done;
    const total = prog.total;
    const dosage = [p.dosage, p.dosageUnit ? DOSAGE_UNIT[p.dosageUnit] ?? p.dosageUnit : null]
      .filter(Boolean)
      .join(" ");
    const stage = effectiveStage(p.manufacturingStatus, p.variations);
    return {
      id: p.id,
      reference: p.reference,
      dci: p.dci,
      brandName: p.brandName ?? "",
      dosage,
      form: p.pharmaceuticalForm ? PHARMA_FORM[p.pharmaceuticalForm] ?? p.pharmaceuticalForm : "",
      packaging: p.packaging ?? "",
      therapeuticClass: p.therapeuticClass ?? "",
      therapeuticSegments: p.therapeuticSegments ?? [],
      companyId: p.companyId ?? "",
      companyName: p.company?.shortName ?? p.company?.name ?? "",
      bdProjectId: p.bdProject?.id ?? "",
      bdProjectName: p.bdProject?.name ?? "",
      supplier: p.supplier?.name ?? "",
      category: p.category,
      // RÈGLE : une variation OBTENUE fait foi ; sinon, le niveau déclaré sur la fiche.
      manufacturingStatus: stage.status,
      manufacturingSource: stage.source,
      manufacturingPending: stage.pendingTo,
      status: p.status,
      priority: p.priority,
      isLocked: p.isLocked,
      responsible: p.responsible?.name ?? "",
      responsibleId: p.responsibleId ?? "",
      assistant: p.assistant?.name ?? "",
      targetSubmissionDate: p.targetSubmissionDate?.toISOString() ?? null,
      targetDate: p.targetDate?.toISOString() ?? null,
      progress: Math.round((done / total) * 100),
      stepsDone: done,
      stepsTotal: total,
      // LE VERROU EST LE PIPELINE : un dossier verrouillé attend d'être ouvert, un dossier
      // ouvert est à traiter, un dossier abouti reste abouti. Règle pure et testée.
      stage: regStage({ isLocked: p.isLocked, status: p.status }),
      // Voir `regulatory/dossier-received.ts` : la colonne se constate, elle ne se coche pas.
      dossierReceived: dossierReceived({ hasArchive: recus.has(p.id) }),
    };
  });

  return { rows, products, suppliers, companies, settings, canSupervise };
}
