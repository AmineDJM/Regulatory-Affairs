import Link from "next/link";
import { Filter, MessagesSquare, Paperclip } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { InfoBulle } from "@/components/ui/info-bulle";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { DocumentUpload } from "@/components/documents/document-upload";
import { CommentThread, type CommentItem } from "@/components/shared/comment-thread";
import { updateComment, deleteComment } from "@/lib/actions/comment-actions";
import { commenterReclamation } from "@/lib/actions/reclamation-actions";
import { declareDesReclamations, lecteurReclamation } from "@/lib/reclamations/acces";
import { compteursReclamations, listerReclamations, lireReclamation, type FiltresReclamations } from "@/lib/reclamations/donnees";
import { STATUTS_RECLAMATION, STATUT_RECLAMATION, TYPES_RECLAMATION, TYPE_RECLAMATION, peutContribuer, type StatutReclamation } from "@/lib/reclamations/regles";
import { etablissementsPourSignalement, produitsPourSignalement } from "@/lib/pharmacovigilance/donnees";
import { voitTousLesCasPv } from "@/lib/pharmacovigilance/acces";
import { CHEMIN_RECLAMATIONS } from "@/lib/chemins/reclamations";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { NouvelleReclamation } from "./nouvelle-reclamation";
import { InstructionReclamation, PanneauReclamation } from "./panneau-reclamation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Retours & réclamations — AMD Internal OS" };

type Params = { bu?: string; type?: string; statut?: string; produit?: string; id?: string; nouvelle?: string };

/**
 * RETOURS & RÉCLAMATIONS (Direction, 08/10 — Operations & Sales) : retours, réclamations qualité et rappels de lot, par
 * BU. La liste reste un tableau (au téléphone aussi) ; une ligne ouvre le panneau latéral — la fiche, l'instruction, les
 * pièces et l'échange. Un seul geste principal : « Nouvelle réclamation ».
 */
export default async function RetoursReclamationsPage({ searchParams }: { searchParams?: Params }) {
  const user = await requireModule("RETOURS_RECLAMATIONS");
  const sp = searchParams ?? {};
  const f: FiltresReclamations = { bu: sp.bu ?? "", type: sp.type ?? "", statut: sp.statut ?? "", produit: (sp.produit ?? "").trim() };
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  const retour = qs ? `${CHEMIN_RECLAMATIONS}?${qs}` : CHEMIN_RECLAMATIONS;
  const lienFiche = (id: string) => `${CHEMIN_RECLAMATIONS}?${qs ? `${qs}&` : ""}id=${encodeURIComponent(id)}`;
  const peutDeclarer = declareDesReclamations(user);

  const [lignes, compteurs, bus, fiche, formulaire] = await Promise.all([
    listerReclamations(user, f),
    compteursReclamations(user),
    prisma.businessUnit.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    sp.id ? lireReclamation(user, sp.id) : Promise.resolve(null),
    peutDeclarer
      ? Promise.all([
          produitsPourSignalement(user.id),
          etablissementsPourSignalement(),
          prisma.stockAnnex.findMany({ where: { kind: "ANNEX" }, orderBy: { name: "asc" }, select: { name: true } }),
        ])
      : Promise.resolve(null),
  ]);
  const filtre = Boolean(f.bu || f.type || f.statut || f.produit);
  const ouvertes = (compteurs.OUVERTE ?? 0) + (compteurs.EN_ANALYSE ?? 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Retours & réclamations" description={`${ouvertes} en cours`}>
        <InfoBulle>
          Retours de marchandise, réclamations qualité et rappels de lot. Le responsable est prévenu à chaque déclaration et
          à chaque message ; clôturer demande une conclusion.
        </InfoBulle>
        {formulaire && (
          <NouvelleReclamation
            produits={formulaire[0]} etablissements={formulaire[1]} sitesPch={formulaire[2].map((a) => a.name)}
            ouvertAuDepart={sp.nouvelle === "1"} aujourdhui={new Date().toISOString().slice(0, 10)}
          />
        )}
      </PageHeader>

      <form method="get" className="surface grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-5 lg:items-end">
        <Select name="bu" defaultValue={f.bu} aria-label="Business unit">
          <option value="">Toutes les BU</option>
          {bus.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select name="type" defaultValue={f.type} aria-label="Type">
          <option value="">Tous les types</option>
          {TYPES_RECLAMATION.map((t) => <option key={t} value={t}>{TYPE_RECLAMATION[t].label}</option>)}
        </Select>
        <Select name="statut" defaultValue={f.statut} aria-label="Statut">
          <option value="">Tous les statuts</option>
          {STATUTS_RECLAMATION.map((s) => <option key={s} value={s}>{STATUT_RECLAMATION[s].label} ({compteurs[s] ?? 0})</option>)}
        </Select>
        <Input name="produit" defaultValue={f.produit} placeholder="Produit…" aria-label="Produit" />
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          <Button type="submit" size="sm" variant="outline" className="flex-1 lg:flex-none"><Filter className="h-3.5 w-3.5" /> Filtrer</Button>
          {filtre && <Link href={CHEMIN_RECLAMATIONS} className="inline-flex items-center px-2 text-sm text-primary hover:underline">Effacer</Link>}
        </div>
      </form>

      {lignes.length === 0 ? (
        <EmptyState icon="Undo2" title={filtre ? "Aucune réclamation pour ces filtres" : "Aucune réclamation"} description={filtre ? "Retirez un filtre." : "Les retours, réclamations qualité et rappels de lot apparaîtront ici."} />
      ) : (
        <div className="surface overflow-x-auto rounded-xl">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">Réf.</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Produit</th>
                <th className="px-3 py-2 font-medium">BU</th>
                <th className="px-3 py-2 font-medium">Lot</th>
                <th className="px-3 py-2 text-right font-medium">Qté</th>
                <th className="px-3 py-2 font-medium">Établissement / site</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 font-medium">Responsable</th>
                <th className="px-3 py-2 font-medium">Déclarée</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className={`border-b border-border last:border-0 hover:bg-secondary/30 ${sp.id === l.id ? "bg-secondary/40" : ""}`}>
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">
                    <Link href={lienFiche(l.id)} className="text-primary hover:underline">{l.reference}</Link>
                  </td>
                  <td className="px-3 py-2"><StatusBadge map={TYPE_RECLAMATION} value={l.type} dot={false} /></td>
                  <td className="px-3 py-2">{l.productLabel}</td>
                  <td className="px-3 py-2 text-muted-foreground">{l.buNom ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{l.lot ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(l.quantity)}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground" title={l.lieu}>{l.lieu}</td>
                  <td className="px-3 py-2"><StatusBadge map={STATUT_RECLAMATION} value={l.status} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{l.responsable ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(l.createdAt)} · {l.declarant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fiche && <Fiche fiche={fiche} retour={retour} user={user} chemin={lienFiche(fiche.r.id)} />}
    </div>
  );
}

async function Fiche({ fiche, retour, user, chemin }: {
  fiche: NonNullable<Awaited<ReturnType<typeof lireReclamation>>>;
  retour: string;
  user: Awaited<ReturnType<typeof requireModule>>;
  chemin: string;
}) {
  const { r, bu, pv, docs, fil, nom } = fiche;
  const l = lecteurReclamation(user);
  const contribue = peutContribuer(l, r);
  const [personnes, casPv] = l.instruit
    ? await Promise.all([
        prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
        voitTousLesCasPv(user)
          ? prisma.pharmacovigilanceCase.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, reference: true, productLabel: true } })
          : Promise.resolve(null),
      ])
    : [[], null];
  const docItems: DocItem[] = docs.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null, createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));
  const commentaires: CommentItem[] = fil.map((c) => ({
    id: c.id, author: c.author?.name ?? "—", authorId: c.authorId ?? undefined, body: c.body,
    createdAt: c.createdAt.toISOString(), editedAt: c.editedAt?.toISOString() ?? null,
  }));
  const typeLabel = TYPE_RECLAMATION[r.type as keyof typeof TYPE_RECLAMATION]?.label ?? r.type;

  return (
    <PanneauReclamation titre={`${r.reference} — ${r.productLabel}`} description={`${typeLabel} · déclarée le ${formatDateTime(r.createdAt)} par ${nom(r.declaredById)}`} retour={retour}>
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge map={STATUT_RECLAMATION} value={r.status} />
          <span className="text-muted-foreground">Responsable : <span className="font-medium text-foreground">{nom(r.ownerId) ?? "—"}</span></span>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <Info label="BU">{bu ?? "—"}</Info>
          <Info label="Lot">{r.lot ?? "—"}</Info>
          <Info label="Quantité">{formatNumber(r.quantity)}</Info>
          <Info label="Date">{r.occurredOn ? formatDate(r.occurredOn) : "—"}</Info>
          <Info label="Établissement">{r.institutionName ?? "—"}</Info>
          <Info label="Site PCH">{r.pchSite ?? "—"}</Info>
          {pv && <Info label="Pharmacovigilance">{pv.reference}</Info>}
        </dl>
        <div>
          <p className="text-xs text-muted-foreground">Ce qui s&apos;est passé</p>
          <p className="mt-0.5 whitespace-pre-wrap">{r.description}</p>
        </div>
        {r.status === "CLOTUREE" && r.conclusion && (
          <div className="rounded-lg border border-success/40 bg-success/5 px-3 py-2">
            <p className="text-xs text-muted-foreground">Conclusion — {nom(r.closedById)}{r.closedAt ? `, ${formatDate(r.closedAt)}` : ""}</p>
            <p className="mt-0.5 whitespace-pre-wrap">{r.conclusion}</p>
          </div>
        )}
        {l.instruit && (
          <InstructionReclamation
            id={r.id} status={r.status as StatutReclamation} ownerId={r.ownerId} pvCaseId={r.pvCaseId}
            personnes={personnes} casPv={casPv ? casPv.map((c) => ({ id: c.id, label: `${c.reference} — ${c.productLabel}` })) : null}
          />
        )}
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 font-semibold"><Paperclip className="h-4 w-4" /> Pièces ({docItems.length})</h3>
          {docItems.length > 0 && <DocumentList documents={docItems} canDelete={l.instruit} canEdit={false} canRename={l.instruit} path={chemin} />}
          {contribue && <DocumentUpload entityType="RECLAMATION" entityId={r.id} categories={["PHOTO", "SUPPORTING_DOC", "OTHER"]} compact />}
        </section>
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 font-semibold"><MessagesSquare className="h-4 w-4" /> Échange</h3>
          <CommentThread
            comments={commentaires} action={commenterReclamation} hiddenFields={{ reclamationId: r.id }} currentUserId={user.id}
            canModerate={l.instruit} updateAction={updateComment} deleteAction={deleteComment} path={CHEMIN_RECLAMATIONS}
          />
        </section>
      </div>
    </PanneauReclamation>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
