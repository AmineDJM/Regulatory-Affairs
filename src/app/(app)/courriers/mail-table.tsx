"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilterX, Check, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { MAIL_DIRECTION } from "@/lib/labels";
import { setMailDate } from "@/lib/actions/mail-register-actions";

/**
 * LE CARNET DE COURRIERS — un tableau qu'on FILTRE, parce qu'on y cherche toujours une pièce
 * précise (« le courrier à la CNAS de mars ») dans plusieurs centaines de lignes.
 *
 * Les deux dates qui manquent le plus souvent — l'ARRIVÉE et l'ACCUSÉ — se posent ici, dans la
 * ligne : elles se constatent des jours après la saisie, et rouvrir un formulaire complet pour
 * cocher une date, personne ne le fait. Ce qu'on ne peut pas remplir en un geste reste vide.
 *
 * Tout le reste — joindre le scan, corriger un champ, relire le journal — se fait sur la FICHE,
 * qu'on ouvre en cliquant l'objet.
 */

export interface MailRow {
  id: string;
  reference: string | null;
  title: string;
  direction: string;
  sender: string | null;
  recipient: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  acknowledgedAt: string | null;
  carrier: string | null;
  /** Entité concernée et partenaire — deux colonnes qu'on cherche en retrouvant un pli
   *  (« le courrier de Pharmagène à North Tech »). */
  companyName: string;
  partnerName: string;
  /** Nombre de pièces jointes — un courrier sans pièce se repère d'un coup d'œil. */
  attachments: number;
}

const cellInput = "h-8 w-full rounded-md border border-input bg-card px-2 text-xs font-normal normal-case tracking-normal outline-none focus:ring-1 focus:ring-ring";

/** Une date qui se pose (ou s'efface) en un clic depuis la ligne. */
function DateCell({ id, field, value, canEdit }: {
  id: string; field: "receivedAt" | "acknowledgedAt"; value: string | null; canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  if (!canEdit) return <span className="text-muted-foreground">{value ? formatDate(value) : "—"}</span>;

  const save = (v: string | null) => {
    setBusy(true);
    void setMailDate({ id, field, value: v }).then(() => { setBusy(false); router.refresh(); });
  };

  if (value) {
    return (
      <button type="button" disabled={busy} onClick={() => save(null)}
        title="Effacer cette date" className="text-left text-xs hover:underline disabled:opacity-50">
        {formatDate(value)}
      </button>
    );
  }
  return (
    <button type="button" disabled={busy}
      onClick={() => save(new Date().toISOString())}
      title="Marquer à aujourd'hui"
      className="inline-flex items-center gap-1 rounded-md border border-dashed border-input px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground hover:bg-secondary disabled:opacity-50">
      <Check className="h-3 w-3" /> aujourd&apos;hui
    </button>
  );
}

export function MailTable({ rows, canEdit }: { rows: MailRow[]; canEdit: boolean }) {
  const [f, setF] = React.useState({ title: "", reference: "", direction: "", party: "", pending: false });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const has = (hay: string | null, needle: string) => (hay ?? "").toLowerCase().includes(needle.toLowerCase());

  const shown = rows.filter((r) => {
    if (f.title && !has(r.title, f.title)) return false;
    if (f.reference && !has(r.reference, f.reference)) return false;
    if (f.direction && r.direction !== f.direction) return false;
    if (f.party && !has(r.sender, f.party) && !has(r.recipient, f.party)) return false;
    // « Sans accusé » : la seule question qui fasse rouvrir le carnet.
    if (f.pending && r.acknowledgedAt) return false;
    return true;
  });

  const active = f.pending || Boolean(f.title || f.reference || f.direction || f.party);
  const noAck = rows.filter((r) => !r.acknowledgedAt).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{shown.length} / {rows.length} courrier{rows.length > 1 ? "s" : ""}</span>
        <button
          type="button" onClick={() => setF((p) => ({ ...p, pending: !p.pending }))}
          className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium",
            f.pending ? "border-warning/60 bg-warning/10 text-warning" : "border-input hover:bg-secondary")}
        >
          Sans accusé de réception ({noAck})
        </button>
        {active && (
          <button type="button" onClick={() => setF({ title: "", reference: "", direction: "", party: "", pending: false })}
            className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 font-medium hover:bg-secondary">
            <FilterX className="h-3.5 w-3.5" /> Réinitialiser
          </button>
        )}
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[62rem] border-collapse text-sm">
          <thead className="border-b border-border">
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 pt-2 text-left font-medium">Chrono</th>
              <th className="px-3 pt-2 text-left font-medium">Sens</th>
              <th className="px-3 pt-2 text-left font-medium">Objet</th>
              <th className="px-3 pt-2 text-left font-medium">Expéditeur</th>
              <th className="px-3 pt-2 text-left font-medium">Destinataire</th>
              <th className="px-3 pt-2 text-left font-medium">Départ</th>
              <th className="px-3 pt-2 text-left font-medium">Arrivée</th>
              <th className="px-3 pt-2 text-left font-medium">Accusé</th>
              <th className="px-3 pt-2 text-left font-medium">Entité</th>
              <th className="px-3 pt-2 text-left font-medium">Partenaire</th>
              <th className="px-3 pt-2 text-left font-medium">Porteur</th>
              <th className="px-3 pt-2 text-left font-medium"><Paperclip className="h-3.5 w-3.5" aria-label="Pièces jointes" /></th>
            </tr>
            <tr>
              <th className="px-2 pb-2 pt-1"><input value={f.reference} onChange={set("reference")} placeholder="Filtrer" className={cellInput} /></th>
              <th className="px-2 pb-2 pt-1">
                <select value={f.direction} onChange={set("direction")} className={cellInput}>
                  <option value="">Tous</option>
                  {Object.entries(MAIL_DIRECTION).map(([v, d]) => <option key={v} value={v}>{d.label}</option>)}
                </select>
              </th>
              <th className="px-2 pb-2 pt-1"><input value={f.title} onChange={set("title")} placeholder="Filtrer" className={cellInput} /></th>
              <th className="px-2 pb-2 pt-1" colSpan={2}><input value={f.party} onChange={set("party")} placeholder="Expéditeur ou destinataire" className={cellInput} /></th>
              {/* Départ · Arrivée · Accusé · Entité · Partenaire · Porteur · Pièces — sept
                  colonnes sans filtre propre : la ligne doit les compter, sinon les cellules
                  de filtre se décalent d'une colonne et ne filtrent plus ce qu'elles annoncent. */}
              <th className="px-2 pb-2 pt-1" colSpan={7} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.length === 0 ? (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucun courrier ne correspond à ces filtres.</td></tr>
            ) : shown.map((r) => {
              const dir = MAIL_DIRECTION[r.direction];
              return (
                <tr key={r.id} className="hover:bg-secondary/30">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.reference || "—"}</td>
                  <td className="px-3 py-2"><Badge tone={dir?.tone ?? "neutral"} dot={false}>{dir?.label ?? r.direction}</Badge></td>
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/courriers/${r.id}`} className="hover:underline">{r.title}</Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.sender || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.recipient || "—"}</td>
                  {/* Le départ garde son HEURE : deux plis du même jour ne partent pas ensemble. */}
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{r.sentAt ? formatDateTime(r.sentAt) : "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><DateCell id={r.id} field="receivedAt" value={r.receivedAt} canEdit={canEdit} /></td>
                  <td className="px-3 py-2 whitespace-nowrap"><DateCell id={r.id} field="acknowledgedAt" value={r.acknowledgedAt} canEdit={canEdit} /></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.companyName || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.partnerName || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.carrier || "—"}</td>
                  <td className="px-3 py-2">
                    {r.attachments > 0 ? (
                      <Link href={`/courriers/${r.id}`} title={`${r.attachments} pièce(s) jointe(s)`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <Paperclip className="h-3.5 w-3.5" /> {r.attachments}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
