"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Check, Undo2, Pencil, ChevronLeft, ChevronRight, Paperclip, FileWarning, Send } from "lucide-react";
import { markSalaryPaid, unmarkSalaryPaid, updatePayrollEntry } from "@/lib/actions/payroll-hr-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label } from "@/components/ui/input";
import { formatBytes, formatCurrency, formatMonth } from "@/lib/utils";
import { DocumentPreview } from "@/components/documents/document-preview";
import { BoutonDecisif } from "@/components/ui/bouton-decisif";

export interface PayrollCell {
  /**
   * Où en est le salaire (§118.176) : `UNPAID` rien de saisi ; `SAISI` saisi, pas encore envoyé ;
   * `ENVOYE` dans la paie de l'entité partie au centre de paiement ; `VIRE` réglé par les Finances
   * (ou transféré par l'ancien circuit). « Payé » avant le virement aurait été une promesse.
   */
  state: "UNPAID" | "SAISI" | "ENVOYE" | "VIRE";
  /** Brut — ligne de bulletin. */
  amount: number | null;
  /** Net = ce que perçoit le salarié. */
  net: number | null;
  /** Coût employeur réellement enregistré — c'est lui qu'on rouvre pour corriger. */
  employerCost?: number | null;
  entryId: string | null;
  /**
   * LA FICHE DE PAIE ATTACHÉE À CE MOIS, quand elle a été déposée.
   *
   * Elle l'était déjà — dans le dossier RH du salarié — mais rien ne la montrait ICI : on
   * revenait sur l'écran et le bulletin qu'on venait de joindre semblait avoir disparu. Un
   * fichier qu'on ne peut pas rouvrir depuis l'endroit où on l'a déposé est un fichier perdu.
   */
  payslip: { id: string; name: string; sizeBytes: number | null; addedAt: string } | null;
}
export interface PayrollRow {
  employeeId: string;
  name: string;
  /** Pré-remplissage au marquage : salaire brut (→ budget) et net (→ salarié). */
  defaultGross: number | null;
  /** Coût employeur de référence — ce qui préremplit le champ obligatoire de la paie. */
  defaultEmployerCost: number | null;
  defaultNet: number | null;
  months: PayrollCell[]; // index 0 = janvier
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

const ETAT_CELLULE: Record<Exclude<PayrollCell["state"], "UNPAID">, { texte: string; classe: string; titre: string }> = {
  SAISI: { texte: "Saisi", classe: "bg-success/15 text-success", titre: "saisi — part au centre de paiement avec la paie de son entité (annulable tant qu'elle n'est pas envoyée)" },
  ENVOYE: { texte: "Envoyé", classe: "bg-warning/15 text-warning", titre: "dans la paie envoyée au centre de paiement — virée une fois autorisée" },
  VIRE: { texte: "Viré", classe: "bg-primary/10 text-primary", titre: "viré par les Finances" },
};

export function PayrollMatrix({ year, rows }: { year: number; rows: PayrollRow[] }) {
  const router = useRouter();
  const [paying, setPaying] = React.useState<{ row: PayrollRow; month: number } | null>(null);
  // CORRIGER une ligne déjà saisie : le même formulaire, prérempli avec ce qui a été enregistré.
  const [editing, setEditing] = React.useState<{ row: PayrollRow; month: number; cell: PayrollCell } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function undo(entryId: string, name: string, month: number) {
    const fd = new FormData(); fd.set("id", entryId);
    const r = await unmarkSalaryPaid(fd);
    if (!r.ok) window.alert(r.error ?? "Échec.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Link href={`/rh/paie?year=${year - 1}`} className="rounded-md border border-border p-1.5 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="min-w-16 text-center text-sm font-semibold">{year}</span>
          <Link href={`/rh/paie?year=${year + 1}`} className="rounded-md border border-border p-1.5 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></Link>
        </div>
        {/* LE « TRANSFERT AU BUDGET » N'EXISTE PLUS (§118.176) : il écrivait un décaissement par
            salarié, hors du centre de paiement. La paie part au centre, entité par entité, depuis
            le panneau « Virement de la paie » — c'est son règlement qui l'inscrit au livre. */}
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Send className="h-3.5 w-3.5" /> Envoi au centre de paiement : panneau « Virement de la paie » ci-dessus.
        </span>
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left">Employé</th>
              {MONTHS.map((m) => <th key={m} className="px-2 py-2 text-center">{m}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.employeeId}>
                <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-medium">{r.name}</td>
                {r.months.map((cell, i) => (
                  <td key={i} className="px-1 py-1.5 text-center">
                    {cell.state === "UNPAID" ? (
                      <button
                        onClick={() => { setErr(null); setPaying({ row: r, month: i + 1 }); }}
                        className="rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                        title={`Marquer payé — ${MONTHS[i]} ${year}`}
                      >
                        —
                      </button>
                    ) : (
                      <div className="group relative inline-flex flex-col items-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ETAT_CELLULE[cell.state].classe}`}
                          title={`${cell.employerCost != null ? `Coût employeur ${formatCurrency(cell.employerCost)}` : cell.amount != null ? `Brut ${formatCurrency(cell.amount)}` : ""}${cell.net != null ? ` · Net ${formatCurrency(cell.net)} (salarié)` : ""} · ${ETAT_CELLULE[cell.state].titre}`}
                        >
                          <Check className="h-3 w-3" /> {ETAT_CELLULE[cell.state].texte}
                        </span>
                        {/* LA FICHE DE PAIE, VISIBLE SANS SURVOL. Le trombone n'est pas un
                            ornement : c'est la preuve que le bulletin est bien là, et le lien
                            pour le rouvrir. Son absence se voit tout autant — un mois payé sans
                            fiche affiche l'invitation à la déposer. */}
                        {cell.payslip ? (
                          // ON REGARDE LA FICHE, ON NE LA TÉLÉCHARGE PAS. Un lien brut envoyait
                          // le fichier au disque — et un `.docx` cliqué s'ouvrait dans Word,
                          // hors de l'application, pour une simple vérification. L'aperçu commun
                          // rend le PDF comme le Word sur place ; le téléchargement reste
                          // disponible dans sa barre d'outils, pour qui en a vraiment besoin.
                          <span className="mt-0.5 inline-flex max-w-24 items-center gap-0.5 text-[0.625rem] text-muted-foreground [&_button]:truncate [&_button]:text-[0.625rem]">
                            <Paperclip className="h-3 w-3 shrink-0" />
                            <DocumentPreview
                              id={cell.payslip.id}
                              name={cell.payslip.name}
                              hasFile
                              srcOverride={`/api/rh/document/${cell.payslip.id}`}
                            />
                          </span>
                        ) : (
                          cell.entryId && (
                            <button
                              onClick={() => { setErr(null); setEditing({ row: r, month: i + 1, cell }); }}
                              title="Aucune fiche de paie pour ce mois — la déposer"
                              className="mt-0.5 inline-flex items-center gap-0.5 text-[0.625rem] text-warning hover:underline"
                            >
                              <FileWarning className="h-3 w-3" /> sans fiche
                            </button>
                          )
                        )}
                        {cell.entryId && (
                          <span className="mt-0.5 hidden items-center gap-1.5 group-hover:inline-flex">
                            {/* Une paie fausse ne se rattrape pas au mois suivant : elle se
                                corrige, même transférée — l'écriture budgétaire suit. */}
                            <button
                              onClick={() => { setErr(null); setEditing({ row: r, month: i + 1, cell }); }}
                              className="inline-flex items-center gap-0.5 text-[0.625rem] text-muted-foreground hover:text-primary"
                            >
                              <Pencil className="h-3 w-3" /> modifier
                            </button>
                            {cell.state === "SAISI" && (
                              <BoutonDecisif brut
                                confirmation={`annuler la saisie de ${r.name} pour ${formatMonth(ym(year, i + 1))}`}
                                onClick={() => undo(cell.entryId!, r.name, i + 1)}
                                className="inline-flex items-center gap-0.5 text-[0.625rem] text-muted-foreground hover:text-destructive"
                              >
                                <Undo2 className="h-3 w-3" /> annuler
                              </BoutonDecisif>
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Vert = saisi (annulable tant que la paie n&apos;est pas envoyée) · Orange = envoyé au centre de paiement ·
        Bleu = viré par les Finances. Le <strong>trombone</strong> ouvre la fiche de paie du mois ; « sans fiche »
        signale un mois saisi dont le bulletin manque encore — on le dépose d&apos;un clic. Une ligne se
        <strong> corrige</strong> à tout moment ; une paie déjà envoyée garde la somme déclarée à l&apos;envoi.
        L&apos;employé est prévenu au virement, et jamais moins de 24 h après la saisie.
      </p>

      {/* Marquer payé : montant total + fiche de paie */}
      <Sheet
        open={paying !== null}
        onClose={() => !busy && setPaying(null)}
        title={paying ? `Saisir la paie — ${paying.row.name}` : ""}
        description={paying ? `${formatMonth(ym(year, paying.month))} · la fiche de paie (facultative), si jointe, sera déposée dans son dossier RH ; le salarié sera prévenu au virement de la paie de son entité.` : undefined}
        width="md"
      >
        {paying && (
          <form
            action={async (fd) => {
              setBusy(true); setErr(null);
              fd.set("employeeId", paying.row.employeeId);
              fd.set("year", String(year));
              fd.set("month", String(paying.month));
              const r = await markSalaryPaid(fd);
              setBusy(false);
              if (r.ok) { setPaying(null); router.refresh(); } else setErr(r.error ?? "Échec.");
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* LE COÛT EMPLOYEUR REMPLACE LE BRUT comme montant obligatoire : c'est ce que la
                  société décaisse réellement, et donc ce qui pèse sur le budget et fait la masse
                  salariale. Le brut, lui, n'est qu'une ligne du bulletin — l'imputer sous-évaluait
                  la masse du montant exact des charges patronales. */}
              <div className="space-y-1.5">
                <Label htmlFor="pay-cost">Coût employeur (DZD) <span className="text-destructive">*</span></Label>
                <Input id="pay-cost" name="employerCost" type="number" step="any" min="1" required defaultValue={paying.row.defaultEmployerCost ?? undefined} />
                <p className="text-xs text-muted-foreground">Brut + <span className="font-medium text-foreground">charges patronales</span> : le total imputé au budget, et la brique de la masse salariale. Pré-rempli depuis la fiche employé — modifiable.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-net">Salaire net (DZD) <span className="text-destructive">*</span></Label>
                <Input id="pay-net" name="net" type="number" step="any" min="1" required defaultValue={paying.row.defaultNet ?? undefined} />
                <p className="text-xs text-muted-foreground">Montant <span className="font-medium text-foreground">affiché au salarié</span>. Ne peut pas dépasser le coût employeur.</p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pay-gross">Salaire brut (DZD) <span className="text-xs font-normal text-muted-foreground">(facultatif)</span></Label>
                <Input id="pay-gross" name="gross" type="number" step="any" min="0" defaultValue={paying.row.defaultGross ?? undefined} />
                <p className="text-xs text-muted-foreground">Information de bulletin. Laissé vide, il est repris du coût employeur — il n'entre pas dans le calcul du budget.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-file">Fiche de paie <span className="text-xs font-normal text-muted-foreground">(facultatif)</span></Label>
              <input id="pay-file" name="payslip" type="file" className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium" />
              <p className="text-xs text-muted-foreground">Optionnel — vous pouvez saisir le salaire sans joindre la fiche.</p>
            </div>
            {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPaying(null)} disabled={busy}>Annuler</Button>
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer la saisie</Button>
            </div>
          </form>
        )}
      </Sheet>

      {/* CORRIGER une ligne déjà saisie — le même formulaire, prérempli. Refuser la correction
          après l'envoi, c'est garantir qu'on vit avec un bulletin faux : personne ne défera une
          paie virée pour mille dinars. On corrige la ligne ; le virement, lui, porte la somme
          déclarée à l'envoi (§118.176) — et l'ancien transfert au budget suit sa ligne comme avant. */}
      <Sheet
        open={editing !== null}
        onClose={() => !busy && setEditing(null)}
        title={editing ? `Corriger la paie — ${editing.row.name}` : ""}
        description={editing
          ? `${formatMonth(ym(year, editing.month))}${editing.cell.state === "VIRE" || editing.cell.state === "ENVOYE" ? " · la paie de ce mois est déjà envoyée : la ligne se corrige, la somme déclarée au centre ne change pas." : ""}`
          : undefined}
        width="md"
      >
        {editing && (
          <form
            action={async (fd) => {
              setBusy(true); setErr(null);
              fd.set("id", editing.cell.entryId ?? "");
              const r = await updatePayrollEntry(fd);
              setBusy(false);
              if (r.ok) { setEditing(null); router.refresh(); } else setErr(r.error ?? "Échec.");
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-cost">Coût employeur (DZD) <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-cost" name="employerCost" type="number" step="any" min="1" required
                  defaultValue={editing.cell.employerCost ?? editing.cell.amount ?? undefined}
                />
                <p className="text-xs text-muted-foreground">Le total imputé au budget. Le corriger corrige la masse salariale.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-net">Salaire net (DZD) <span className="text-destructive">*</span></Label>
                <Input id="edit-net" name="net" type="number" step="any" min="1" required defaultValue={editing.cell.net ?? undefined} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-gross">Salaire brut (DZD) <span className="text-xs font-normal text-muted-foreground">(facultatif)</span></Label>
                <Input id="edit-gross" name="gross" type="number" step="any" min="0" defaultValue={editing.cell.amount ?? undefined} />
              </div>
            </div>
            <div className="space-y-1.5">
              {/* CE QUI EST DÉJÀ LÀ, AVANT CE QU'ON PEUT METTRE. Un champ « Remplacer la fiche »
                  au-dessus du vide laissait croire qu'il n'y en avait pas ; on rejoignait alors
                  le même bulletin une seconde fois, sans savoir qu'on écrasait le premier. */}
              {editing.cell.payslip ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <DocumentPreview
                    id={editing.cell.payslip.id}
                    name={editing.cell.payslip.name}
                    hasFile
                    srcOverride={`/api/rh/document/${editing.cell.payslip.id}`}
                  />
                  <span className="text-muted-foreground">
                    déposée le {new Date(editing.cell.payslip.addedAt).toLocaleDateString("fr-FR")}
                    {editing.cell.payslip.sizeBytes != null ? ` · ${formatBytes(editing.cell.payslip.sizeBytes)}` : ""} · dans le dossier RH du salarié
                  </span>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-warning/50 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
                  Aucune fiche de paie n&apos;est jointe à ce mois. Vous pouvez la déposer maintenant.
                </p>
              )}
              <Label htmlFor="edit-file">
                {editing.cell.payslip ? "Remplacer la fiche de paie" : "Déposer la fiche de paie"}{" "}
                <span className="text-xs font-normal text-muted-foreground">(facultatif)</span>
              </Label>
              <input id="edit-file" name="payslip" type="file" className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium" />
              <p className="text-xs text-muted-foreground">
                {editing.cell.payslip
                  ? "La nouvelle prend la place de l'ancienne dans le dossier du salarié — deux bulletins pour le même mois lui laisseraient deviner lequel fait foi."
                  : "Elle sera déposée dans le dossier RH du salarié, visible par lui, et restera rattachée à ce mois."}
              </p>
            </div>
            {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={busy}>Annuler</Button>
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer la correction</Button>
            </div>
          </form>
        )}
      </Sheet>

    </div>
  );
}
