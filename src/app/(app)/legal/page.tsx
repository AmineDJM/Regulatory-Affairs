import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { companyScopedWhere, getMyCompanies, companyLabel } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { toNumber } from "@/lib/utils";
import { createLegalDocument } from "@/lib/actions/legal-actions";
import { effectiveStatus, expiryLevel, daysLeft } from "@/lib/legal/lifecycle";
import { legalFields } from "./legal-fields";
import { LegalTable, type LegalRow } from "./legal-table";
import { LegalFolderBar, type FolderRow } from "./folder-bar";
import { buildFolderTree, flattenFolders, indentedLabel } from "@/lib/legal/folders";
import { legalListScope } from "@/lib/legal/list-view";
import { legalReaderWhere } from "@/lib/legal/readers";
import { legalViewScope, natureFromParam, invoiceTally } from "@/lib/legal/invoices";
import { formatCurrency } from "@/lib/utils";
import { ROLE_LABELS, LEGAL_DOC_KIND } from "@/lib/labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Legal — AMD Internal OS" };

/**
 * LEGAL — LES ENGAGEMENTS DE LA SOCIÉTÉ.
 *
 * Contrats, bons de commande, conventions, assurances, baux : tout ce qui engage l'entreprise et
 * qu'il faut pouvoir ressortir. Le FICHIER, lui, reste dans le Drive — Legal le référence et
 * ajoute ce que le Drive ne sait pas dire : le titre exact, les dates, l'échéance, la partie en
 * face, et ce qu'il est devenu (renouvelé, annulé).
 *
 * Un document peut n'avoir AUCUNE date : c'est un cas normal (statuts, tacite reconduction), pas
 * un oubli. Il ne se périme jamais et ne déclenche donc aucun rappel — la règle vit dans le
 * module pur `legal/lifecycle`, testé, partagé par l'écran et par le balayage des échéances.
 *
 * ── LES FACTURES SONT ICI, ET NULLE PART AILLEURS ───────────────────────────────────────────
 *
 * Elles avaient leur écran ; elles sont désormais des documents de nature « facture », dans le
 * registre où vivent déjà les devis et les bons de commande dont elles découlent. « Les
 * factures » (`?nature=INVOICE`) est une VUE de cette liste, pas un autre endroit.
 *
 * Deux portes s'ouvrent donc dessus, et la seconde est étroite : Legal voit tout le registre, la
 * COMPTABILITÉ ne voit que les factures. Centraliser ne devait rien retirer à celle qui venait y
 * lire ce qui reste à payer — et ne devait pas non plus lui ouvrir les baux et les contrats de
 * cadre. La restriction est posée DANS LA REQUÊTE : un filtre d'écran se retire dans le navigateur.
 */
export default async function LegalPage({ searchParams }: { searchParams?: { echeances?: string; dossier?: string; nature?: string } }) {
  const user = await requireUser();
  const portee = legalViewScope({
    onLegal: userCan(user, "LEGAL", "VIEW"),
    onFinances: userCan(user, "FINANCES", "VIEW"),
  });
  if (portee === "NONE") notFound();
  const facturesSeules = portee === "INVOICES_ONLY";

  // LA NATURE DEMANDÉE. Une portée « factures seulement » l'impose : elle ne se choisit pas.
  const nature = facturesSeules ? "INVOICE" : natureFromParam(searchParams?.nature, Object.keys(LEGAL_DOC_KIND));

  const canCreate = userCan(user, nature === "INVOICE" || facturesSeules ? "FINANCES" : "LEGAL", "CREATE") || userCan(user, "LEGAL", "CREATE");
  const canEdit = userCan(user, "LEGAL", "UPDATE") || (facturesSeules && userCan(user, "FINANCES", "UPDATE"));

  // LES LECTEURS DÉSIGNÉS, en plus du cloisonnement d'entité. Un document restreint n'apparaît
  // pas dans la liste de ceux qui n'y sont pas nommés — pas même en grisé : une ligne qu'on voit
  // sans pouvoir l'ouvrir révèle déjà le titre, la partie en face et le montant.
  const readerScope = legalReaderWhere({ viewerId: user.id, isSuperAdmin: user.role === "SUPER_ADMIN" });
  // LE DOSSIER OUVERT. `dossier=none` = les engagements non classés — ils ont leur porte, sinon
  // un document déposé vite et jamais rangé devient invisible dès qu'on prend l'habitude
  // d'ouvrir un dossier.
  const openFolderId = searchParams?.dossier && searchParams.dossier !== "none" ? searchParams.dossier : null;
  const unfiledOnly = searchParams?.dossier === "none";
  const folderWhere = unfiledOnly ? { folderId: null } : openFolderId ? { folderId: openFolderId } : {};
  // LA PORTÉE, DANS LA REQUÊTE. `facturesSeules` n'est pas une préférence d'affichage : c'est le
  // droit de la personne, et il se tient côté serveur.
  const natureWhere = facturesSeules ? { kind: "INVOICE" as const } : {};

  const docs = await prisma.legalDocument.findMany({
    where: await companyScopedWhere(user.id, {
      ...folderWhere,
      ...natureWhere,
      ...(readerScope ? { AND: [readerScope] } : {}),
    }),
    orderBy: [{ endDate: "asc" }, { createdAt: "desc" }],
    include: {
      driveNode: { select: { id: true, name: true } },
      renewedFrom: { select: { title: true } },
      readers: { select: { userId: true } },
    },
  });

  // Les personnes désignables comme lecteurs : les comptes actifs, sauf soi-même — on a déjà
  // accès à ce qu'on dépose, et se proposer dans sa propre liste ne veut rien dire.
  const people = canCreate
    ? (await prisma.user.findMany({
        where: { isActive: true, id: { not: user.id } },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })).map((u) => ({ value: u.id, label: `${u.name} — ${ROLE_LABELS[u.role] ?? u.role}` }))
    : [];

  const today = new Date();
  const rows: LegalRow[] = docs.map((d) => ({
    id: d.id,
    reference: d.reference,
    title: d.title,
    kind: d.kind,
    counterparty: d.counterparty,
    startDate: d.startDate?.toISOString() ?? null,
    endDate: d.endDate?.toISOString() ?? null,
    // Le statut AFFICHÉ tient compte du calendrier : un terme passé se voit sans qu'on ait
    // rouvert la fiche. On ne le réécrit pas en base à la lecture — ce serait une écriture furtive.
    status: effectiveStatus(d, today),
    expiry: expiryLevel(d, today),
    daysLeft: daysLeft(d, today),
    amount: d.amount !== null ? toNumber(d.amount) : null,
    driveNodeId: d.driveNode?.id ?? null,
    driveName: d.driveNode?.name ?? null,
    renewedFromTitle: d.renewedFrom?.title ?? null,
    restricted: d.readers.length > 0,
    // LE RÈGLEMENT d'une facture — vide sur toute autre nature.
    paidDate: d.paidDate?.toISOString() ?? null,
    expenseOrderId: d.expenseOrderId,
  }));

  // L'ARMOIRE. Le compte de documents par dossier respecte le MÊME cloisonnement que la liste :
  // afficher « Baux (12) » à quelqu'un qui n'a le droit d'en ouvrir aucun révélerait déjà qu'il
  // en existe douze.
  const [folderRows, myCompanies] = await Promise.all([
    prisma.legalFolder.findMany({ select: { id: true, name: true, parentId: true, companyId: true, company: { select: { name: true, shortName: true } } } }),
    getMyCompanies(user.id),
  ]);
  const counts = await prisma.legalDocument.groupBy({
    by: ["folderId"],
    where: await companyScopedWhere(user.id, {
      ...natureWhere,
      ...(readerScope ? { AND: [readerScope] } : {}),
      folderId: { not: null },
    }),
    _count: { _all: true },
  });
  const countByFolder = new Map(counts.map((c) => [c.folderId as string, c._count._all]));
  const folders: FolderRow[] = folderRows.map((f) => ({
    id: f.id, name: f.name, parentId: f.parentId, companyId: f.companyId,
    companyLabel: f.company ? (f.company.shortName || f.company.name) : null,
    documentCount: countByFolder.get(f.id) ?? 0,
  }));

  // Le menu de classement montre l'ARBRE, indenté : « 2026 » seul ne dit pas de quoi.
  const folderOptions = flattenFolders(buildFolderTree(folders)).map((n) => ({ value: n.id, label: indentedLabel(n) }));

  // Les pièces AMONT possibles pour la chaîne d'achat (un BC suit son devis, une facture son BC).
  // Requête à part, SANS le filtre de dossier ouvert : le devis peut être rangé ailleurs que là où
  // l'on crée la facture. Même cloisonnement (entité + lecteurs) que la liste.
  const chainDocs = canCreate
    ? await prisma.legalDocument.findMany({
        where: await companyScopedWhere<Prisma.LegalDocumentWhereInput>(user.id, {
          ...(readerScope ? { AND: [readerScope] } : {}),
          kind: { in: ["QUOTE", "PURCHASE_ORDER"] },
        }),
        select: { id: true, kind: true, reference: true, title: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];
  const chainCandidates = chainDocs.map((r) => ({
    value: r.id,
    label: `${LEGAL_DOC_KIND[r.kind] ?? r.kind} — ${r.reference ? `${r.reference} · ` : ""}${r.title}`,
  }));

  const watch = rows.filter((r) => r.expiry === "SOON" || r.expiry === "IMMINENT").length;
  const overdue = rows.filter((r) => r.expiry === "OVERDUE").length;
  // CE QUI RESTE À PAYER — le seul chiffre que l'écran dédié apportait vraiment, calculé sur les
  // lignes servies. Il ne s'affiche que là où il veut dire quelque chose.
  const factures = invoiceTally(rows);

  return (
    <div className="space-y-5">
      <PageHeader
        title={facturesSeules ? "Factures" : "Legal"}
        description={facturesSeules
          ? "Les factures de la société, dans le registre des engagements : elles y suivent le devis et le bon de commande dont elles découlent. Renseigner la date de règlement suffit à les déclarer réglées."
          : "Les engagements de la société : contrats, devis, bons de commande, factures, conventions, assurances, baux. Le fichier reste dans le Drive — Legal porte les dates, l'échéance et ce qu'il advient du document."}
      >
        {canCreate && (
          <CreateRecordButton
            label={nature === "INVOICE" ? "Nouvelle facture" : "Nouveau document"}
            title={nature === "INVOICE" ? "Enregistrer une facture" : "Déclarer un document légal"} width="lg"
            description={nature === "INVOICE"
              ? "Une facture est un document légal de nature « facture » : elle se range avec les devis et les bons de commande dont elle découle. Renseigner la date de règlement suffit à la déclarer réglée."
              : "Un document peut n'avoir aucune date : laissez les dates vides, il ne se périmera jamais et ne déclenchera aucun rappel."}
            action={createLegalDocument}
            fields={legalFields(
              // La nature demandée par l'URL PRÉREMPLIT le formulaire : arriver par « les
              // factures » et devoir rechoisir « facture » dans une liste de dix est le genre
              // de frottement qui fait recréer un écran dédié.
              { folderId: openFolderId ?? undefined, kind: nature || undefined },
              "create", people, folderOptions, chainCandidates,
              facturesSeules,
            )}
            redirectBase="/legal"
          />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={facturesSeules ? "Factures" : "Documents"} value={rows.length} icon="Scale" />
        {factures.count > 0 ? (
          <>
            <KpiCard label="Factures à régler" value={factures.unpaid} icon="Hourglass" tone={factures.unpaid > 0 ? "warning" : "default"} />
            <KpiCard label="Reste à payer" value={formatCurrency(factures.unpaidTotal)} icon="Wallet" />
            <KpiCard
              label="Échéance dépassée" value={factures.overdue + (facturesSeules ? 0 : overdue)}
              icon="AlertTriangle" tone={factures.overdue + overdue > 0 ? "danger" : "default"}
            />
          </>
        ) : (
          <>
            <KpiCard label="Échéance < 3 mois" value={watch} icon="AlarmClock" tone={watch > 0 ? "warning" : "default"} />
            <KpiCard label="Échéances dépassées" value={overdue} icon="AlertTriangle" tone={overdue > 0 ? "danger" : "default"} />
            <KpiCard label="Bons de commande" value={rows.filter((r) => r.kind === "PURCHASE_ORDER").length} icon="ClipboardList" tone="info" />
          </>
        )}
      </div>

      {/* L'ARMOIRE ne s'affiche pas à qui ne voit que les factures : ses dossiers rangent tout
          le registre, et une barre qui compte des documents qu'on ne peut pas ouvrir se lit
          comme une panne. */}
      {!facturesSeules && (
        <LegalFolderBar
          folders={folders}
          current={searchParams?.dossier ?? null}
          companies={myCompanies.map((c) => ({ id: c.id, label: companyLabel(c) }))}
          canManage={canCreate}
        />
      )}

      {/* `scope` DÉCLARE à quel ensemble de documents ces filtres s'appliquent. La barre de
          dossiers navigue par <Link> : sans lui, le filtre « à surveiller » posé par un rappel
          d'échéance survivait au changement de dossier et masquait des documents pourtant
          servis — les fameux bons de commande « disparus ». */}
      <LegalTable
        rows={rows} canEdit={canEdit} watchByDefault={searchParams?.echeances === "1"}
        initialKind={nature}
        scope={legalListScope({
          folderId: openFolderId,
          unfiledOnly,
          fromExpiryAlert: searchParams?.echeances === "1",
          kind: nature,
        })}
        folders={folders.map((f) => ({ id: f.id, name: f.name }))}
        currentFolderId={openFolderId}
      />
    </div>
  );
}
