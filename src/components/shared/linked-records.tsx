import Link from "next/link";
import type { EntityType } from "@prisma/client";
import { Scale, ReceiptText, Mails, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LEGAL_DOC_KIND, LEGAL_DOC_STATUS, INVOICE_STATUS, MAIL_DIRECTION } from "@/lib/labels";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { AttachToSourceButtons } from "./attach-to-source";

/**
 * CE QUI SE RATTACHE À CET OBJET — engagements, factures, courriers.
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
 * Composant SERVEUR : il interroge la base. La création, elle, passe par un client (le panneau).
 */
export async function LinkedRecords({
  entityType, entityId, reference, canCreate = false,
}: {
  entityType: EntityType;
  entityId: string;
  /** La référence lisible de l'objet (« SPO-2026-014 ») : elle préremplit les pièces créées. */
  reference?: string | null;
  canCreate?: boolean;
}) {
  const where = { sourceType: entityType, sourceId: entityId };
  const [legal, invoices, mails] = await Promise.all([
    prisma.legalDocument.findMany({
      where, orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, title: true, reference: true, kind: true, status: true, endDate: true, amount: true },
    }),
    prisma.invoice.findMany({
      where, orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, title: true, number: true, status: true, amount: true, issueDate: true, paidDate: true },
    }),
    prisma.mailEntry.findMany({
      where, orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, title: true, reference: true, direction: true, sentAt: true },
    }),
  ]);

  const total = legal.length + invoices.length + mails.length;
  // Rien à montrer ET rien à créer : on n'affiche pas une carte vide sur toutes les fiches de l'ERP.
  if (total === 0 && !canCreate) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Engagements, factures et courriers liés{total > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">({total})</span>}</span>
          {canCreate && <AttachToSourceButtons entityType={entityType} entityId={entityId} reference={reference ?? null} />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
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
                      badge={st ? { label: st.label, tone: st.tone } : null} />
                  );
                })}
              </Group>
            )}
            {invoices.length > 0 && (
              <Group icon={<ReceiptText className="h-3.5 w-3.5" />} title="Factures">
                {invoices.map((i) => {
                  const st = INVOICE_STATUS[i.status];
                  return (
                    <Row key={i.id} href="/legal/factures" title={i.title} reference={i.number}
                      meta={[i.issueDate ? `émise le ${formatDate(i.issueDate)}` : "", i.paidDate ? `réglée le ${formatDate(i.paidDate)}` : "",
                        i.amount !== null ? formatCurrency(toNumber(i.amount)) : ""].filter(Boolean).join(" · ")}
                      badge={st ? { label: st.label, tone: st.tone } : null} />
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
                      badge={dir ? { label: dir.label, tone: dir.tone } : null} />
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

function Row({ href, title, reference, meta, badge }: {
  href: string; title: string; reference: string | null;
  meta: string; badge: { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" | "purple" } | null;
}) {
  return (
    <li className="flex items-center justify-between gap-2 py-1.5">
      <span className="min-w-0">
        <Link href={href} className="inline-flex min-w-0 items-center gap-1 font-medium hover:underline">
          <span className="truncate">{title}</span> <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
        </Link>
        <span className="block truncate text-[0.6875rem] text-muted-foreground">
          {[reference, meta].filter(Boolean).join(" · ") || "—"}
        </span>
      </span>
      {badge && <Badge tone={badge.tone} dot={false}>{badge.label}</Badge>}
    </li>
  );
}
