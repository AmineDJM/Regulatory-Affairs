import Link from "next/link";
import type { EntityType } from "@prisma/client";
import { Scale, ReceiptText, Mails, ExternalLink, Paperclip } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LEGAL_DOC_KIND, LEGAL_DOC_STATUS, MAIL_DIRECTION } from "@/lib/labels";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { isInvoice, invoiceSettlementState, INVOICE_SETTLEMENT } from "@/lib/labels";
import { AttachToSourceButtons } from "./attach-to-source";
import { AttacherLegalExistant } from "./attacher-legal-existant";
import { DocumentList, type DocItem } from "@/components/documents/document-list";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUI SE RATTACHE À CET OBJET — engagements, factures, courriers, ET LEURS PIÈCES.
 *
 * Un bon de commande naît d'une demande de sponsoring ; une facture naît d'un événement ou d'une
 * demande au secrétariat ; un courrier accompagne un marché. Ces liens existent dans la vraie vie
 * et se perdaient dans l'ERP : chaque pièce vivait dans son module, et six semaines plus tard
 * personne ne savait plus quelle facture correspondait à quelle demande.
 *
 * Ce bloc se pose sur N'IMPORTE QUELLE fiche : il lit `sourceType` / `sourceId` — que les trois
 * modèles portaient déjà — et affiche ce qui pointe vers l'objet courant. Les boutons créent une
 * pièce DÉJÀ rattachée : c'est le seul moment où l'on sait de quoi elle vient, et le seul moment
 * où le rattachement ne coûte rien.
 *
 * ── CE QUI A CHANGÉ, ET POURQUOI ────────────────────────────────────────────────────────
 *
 * Sur les fiches Ad & Pro, un bloc « Documents » générique vivait à côté de celui-ci : un
 * téléverseur, quarante catégories, une liste à plat. On y déposait à la main ce qui aurait dû
 * être une pièce du circuit — la facture du traiteur, le bon de commande, l'offre de service —
 * si bien que la même dépense existait DEUX fois : un fichier posé là, et un engagement dans
 * Legal. Aucun des deux ne savait que l'autre existait, et rien ne rapprochait le fichier du
 * montant qu'il justifie.
 *
 * Le bloc générique disparaît donc, et celui-ci le REMPLACE : chaque pièce liée montre SES
 * documents, ouvrables, renommables et supprimables en un clic depuis la demande. Il n'y a plus
 * qu'un endroit où une facture existe — celui qui porte aussi son montant, son échéance et son
 * état de règlement.
 *
 * ── CE QUI NE DISPARAÎT PAS AVEC LUI ────────────────────────────────────────────────────
 *
 * La pièce de la demande ELLE-MÊME. Sur un sponsoring, c'est la demande du médecin : obligatoire
 * à la création, et le document que tout le circuit lit. La retirer avec le bloc générique
 * l'aurait rendue INVISIBLE, sur l'écran même où elle se juge. Elle garde donc un emplacement
 * NOMMÉ (`piecesDeLaDemande`), fourni par l'appelant — ce n'est plus un dépôt générique où l'on
 * range n'importe quoi, c'est la pièce qu'on attend, appelée par son nom.
 *
 * ── LA GARDE, ET LE CAS QUI LA JUSTIFIE ─────────────────────────────────────────────────
 *
 * Les documents d'une pièce liée appartiennent à SON module. Quelqu'un qui a Ad & Pro sans Legal
 * voit déjà le titre et le montant d'un engagement rattaché ; lui ouvrir ses fichiers lui
 * donnerait le contrat lui-même. `acces` est donc fourni par l'appelant, qui SEUL connaît les
 * droits du spectateur : sans le droit de lire Legal, les pièces restent listées (comportement
 * d'avant) et leurs documents ne sont même pas CHARGÉS — une garde qui ne se contente pas de
 * masquer un rendu.
 *
 * Composant SERVEUR : il interroge la base. La création, elle, passe par un client (le panneau).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
/** Ce que l'appelant sait des droits du spectateur sur les modules des pièces liées. */
export interface AccesPiecesLiees {
  /** Peut lire les documents d'un engagement / d'une facture (module Legal). */
  legal?: boolean;
  /** Peut lire les documents d'un courrier (module Courriers). */
  courriers?: boolean;
  /** Peut renommer un document d'une pièce liée. */
  peutRenommer?: boolean;
  /** Peut supprimer un document d'une pièce liée. */
  peutSupprimer?: boolean;
  /** L'édition Office est configurée ET permise. */
  peutEditer?: boolean;
}

/** L'emplacement NOMMÉ des pièces de la demande elle-même — jamais un dépôt générique. */
export interface PiecesDeLaDemande {
  /** Ce qu'on attend, appelé par son nom (« Demande(s) du médecin »). */
  titre: string;
  documents: DocItem[];
  /** Le téléverseur, rendu par l'appelant : c'est un composant CLIENT. */
  televerseur?: React.ReactNode;
  /** Pourquoi le dépôt n'est pas offert, quand il ne l'est pas. */
  motif?: string | null;
  canDelete?: boolean;
  canRename?: boolean;
  canEdit?: boolean;
  /** Le chemin à revalider après un renommage ou une suppression. */
  path: string;
}

export async function LinkedRecords({
  entityType, entityId, reference, canCreate = false, acces, piecesDeLaDemande, candidatsLegal,
}: {
  entityType: EntityType;
  entityId: string;
  /** La référence lisible de l'objet (« SPO-2026-014 ») : elle préremplit les pièces créées. */
  reference?: string | null;
  canCreate?: boolean;
  /** Droits du spectateur sur les modules des pièces liées. Absent ⇒ aucun document n'est chargé. */
  acces?: AccesPiecesLiees;
  /** La pièce que la demande porte elle-même, dans son emplacement nommé. */
  piecesDeLaDemande?: PiecesDeLaDemande;
  /**
   * Les documents Legal LIBRES que la personne peut rattacher — préparés par l'appelant, qui
   * SEUL connaît son cloisonnement (`contextePiecesLiees`). Vide ⇒ pas de bouton : un bouton
   * qui ouvre un menu vide fait chercher ce qui n'y est pas.
   */
  candidatsLegal?: { value: string; label: string }[];
}) {
  const where = { sourceType: entityType, sourceId: entityId };
  // UNE SEULE REQUÊTE POUR LES DEUX GROUPES. Une facture est un document légal de nature
  // « facture » : l'interroger à part demanderait deux fois la même table et ferait, tôt ou
  // tard, deux réponses différentes à la même question.
  const [docs, mails] = await Promise.all([
    prisma.legalDocument.findMany({
      where, orderBy: { createdAt: "desc" }, take: 40,
      select: {
        id: true, title: true, reference: true, kind: true, status: true, endDate: true,
        amount: true, startDate: true, paidDate: true, expenseOrderId: true,
      },
    }),
    prisma.mailEntry.findMany({
      where, orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, title: true, reference: true, direction: true, sentAt: true },
    }),
  ]);
  // Les FACTURES gardent leur groupe : elles répondent à une autre question que les engagements
  // (« est-ce payé ? » plutôt que « jusqu'à quand ? »), et les mêler perdrait les deux.
  const invoices = docs.filter((d) => isInvoice(d.kind)).slice(0, 20);
  const legal = docs.filter((d) => !isInvoice(d.kind)).slice(0, 20);

  // ─── LES PIÈCES DES PIÈCES — chargées SOUS LES DROITS du module qui les porte ───────────
  //
  // Deux requêtes au plus, jamais une par ligne : trente engagements liés feraient trente
  // allers-retours à chaque ouverture de fiche. Et rien n'est chargé quand le spectateur n'a pas
  // le module — la garde ne se contente pas de masquer un rendu.
  const idsLegal = acces?.legal ? [...legal, ...invoices].map((d) => d.id) : [];
  const idsCourrier = acces?.courriers ? mails.map((m) => m.id) : [];
  const [fichiersLegal, fichiersCourrier] = await Promise.all([
    idsLegal.length
      ? prisma.document.findMany({
          where: { entityType: "LEGAL_DOCUMENT", entityId: { in: idsLegal } },
          include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    idsCourrier.length
      ? prisma.document.findMany({
          where: { entityType: "MAIL_ENTRY", entityId: { in: idsCourrier } },
          include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);
  const parPiece = new Map<string, DocItem[]>();
  for (const d of [...fichiersLegal, ...fichiersCourrier]) {
    const liste = parPiece.get(d.entityId) ?? [];
    liste.push({
      id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
      confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
      createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
    });
    parPiece.set(d.entityId, liste);
  }
  /** Les documents d'une pièce liée, avec les droits de SON module. */
  const piecesDe = (id: string) => ({
    documents: parPiece.get(id) ?? [],
    canDelete: acces?.peutSupprimer === true,
    canRename: acces?.peutRenommer === true,
    canEdit: acces?.peutEditer === true,
  });

  const total = legal.length + invoices.length + mails.length;
  // Rien à montrer, rien à créer ET aucune pièce propre : on n'affiche pas une carte vide sur
  // toutes les fiches de l'ERP.
  if (total === 0 && !canCreate && !piecesDeLaDemande) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Engagements, factures et courriers liés{total > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">({total})</span>}</span>
          {canCreate && (
            <span className="flex flex-wrap items-center gap-2">
              <AttachToSourceButtons entityType={entityType} entityId={entityId} reference={reference ?? null} />
              {/* RATTACHER CE QUI EXISTE DÉJÀ. Les boutons voisins CRÉENT — la bonne façon quand
                  la pièce n'existe pas encore. Sans celui-ci, la seule issue pour une convention
                  déjà enregistrée dans Legal était de la RECRÉER : deux lignes pour le même
                  engagement, deux montants dans les totaux, et celle qui porte les pièces
                  jointes n'est pas celle qui porte le lien. */}
              <AttacherLegalExistant entityType={entityType} entityId={entityId} candidats={candidatsLegal ?? []} />
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* LA PIÈCE DE LA DEMANDE, appelée par son nom — elle vient EN PREMIER parce que c'est
            elle qui justifie tout le reste, et parce qu'elle est obligatoire à la création. */}
        {piecesDeLaDemande && (
          <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Paperclip className="mr-1 inline h-3.5 w-3.5" />{piecesDeLaDemande.titre}
            </p>
            {piecesDeLaDemande.televerseur ?? (piecesDeLaDemande.motif
              ? <p className="text-xs text-muted-foreground">{piecesDeLaDemande.motif}</p>
              : null)}
            <DocumentList
              documents={piecesDeLaDemande.documents}
              canDelete={piecesDeLaDemande.canDelete}
              canRename={piecesDeLaDemande.canRename}
              canEdit={piecesDeLaDemande.canEdit}
              path={piecesDeLaDemande.path}
            />
          </div>
        )}
        {total === 0 ? (
          <p className="text-muted-foreground">
            Rien de rattaché pour l&apos;instant. Un bon de commande ou une facture créé·e d&apos;ici gardera le lien vers cette fiche.
          </p>
        ) : (
          <>
            {legal.length > 0 && (
              <Group icon={<Scale className="h-3.5 w-3.5" />} title="Engagements">
                {legal.map((d) => {
                  const st = LEGAL_DOC_STATUS[d.status];
                  return (
                    <Row key={d.id} href={`/legal/${d.id}`} title={d.title} reference={d.reference}
                      meta={[LEGAL_DOC_KIND[d.kind] ?? d.kind, d.endDate ? `jusqu'au ${formatDate(d.endDate)}` : "sans échéance",
                        d.amount !== null ? formatCurrency(toNumber(d.amount)) : ""].filter(Boolean).join(" · ")}
                      badge={st ? { label: st.label, tone: st.tone } : null}
                      pieces={piecesDe(d.id)} pathPiece={`/legal/${d.id}`} />
                  );
                })}
              </Group>
            )}
            {invoices.length > 0 && (
              <Group icon={<ReceiptText className="h-3.5 w-3.5" />} title="Factures">
                {invoices.map((i) => {
                  const st = INVOICE_SETTLEMENT[invoiceSettlementState(i)];
                  return (
                    <Row key={i.id} href={`/legal/${i.id}`} title={i.title} reference={i.reference}
                      meta={[i.startDate ? `émise le ${formatDate(i.startDate)}` : "", i.paidDate ? `réglée le ${formatDate(i.paidDate)}` : "",
                        i.amount !== null ? formatCurrency(toNumber(i.amount)) : ""].filter(Boolean).join(" · ")}
                      badge={st ? { label: st.label, tone: st.tone } : null}
                      pieces={piecesDe(i.id)} pathPiece={`/legal/${i.id}`} />
                  );
                })}
              </Group>
            )}
            {mails.length > 0 && (
              <Group icon={<Mails className="h-3.5 w-3.5" />} title="Courriers">
                {mails.map((m) => {
                  const dir = MAIL_DIRECTION[m.direction];
                  return (
                    <Row key={m.id} href={`/courriers/${m.id}`} title={m.title} reference={m.reference}
                      meta={m.sentAt ? `parti le ${formatDate(m.sentAt)}` : ""}
                      badge={dir ? { label: dir.label, tone: dir.tone } : null}
                      pieces={piecesDe(m.id)} pathPiece={`/courriers/${m.id}`} />
                  );
                })}
              </Group>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Group({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{icon} {title}</p>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

/**
 * UNE PIÈCE LIÉE, ET SES DOCUMENTS EN DESSOUS.
 *
 * Les documents sont rendus À L'INTÉRIEUR de la ligne et non dans un bloc séparé : c'est ce qui
 * répond à « de quoi vient ce fichier ? » sans qu'on ait à faire le rapprochement de tête. Un
 * second bloc « tous les fichiers des pièces liées » reproduirait exactement le défaut qu'on
 * corrige — une liste à plat où la facture du traiteur et le bon de commande se ressemblent.
 *
 * Le compte est TOUJOURS affiché, zéro compris : « aucune pièce » sur une facture est une
 * information (le justificatif manque), et le taire ferait chercher ailleurs.
 */
function Row({ href, title, reference, meta, badge, pieces, pathPiece }: {
  href: string; title: string; reference: string | null;
  meta: string; badge: { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" | "purple" } | null;
  pieces?: { documents: DocItem[]; canDelete: boolean; canRename: boolean; canEdit: boolean };
  pathPiece?: string;
}) {
  const fichiers = pieces?.documents ?? [];
  return (
    <li className="py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <Link href={href} className="inline-flex min-w-0 items-center gap-1 font-medium hover:underline">
            <span className="truncate">{title}</span> <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </Link>
          <span className="block truncate text-[0.6875rem] text-muted-foreground">
            {[reference, meta].filter(Boolean).join(" · ") || "—"}
          </span>
        </span>
        {badge && <Badge tone={badge.tone} dot={false}>{badge.label}</Badge>}
      </div>
      {pieces && (
        fichiers.length > 0 ? (
          <div className="mt-1.5 border-l-2 border-border pl-3">
            <DocumentList
              documents={fichiers} canDelete={pieces.canDelete} canRename={pieces.canRename}
              canEdit={pieces.canEdit} path={pathPiece}
            />
          </div>
        ) : (
          <p className="mt-1 pl-3 text-[0.6875rem] text-muted-foreground">Aucune pièce jointe à ce document.</p>
        )
      )}
    </li>
  );
}
