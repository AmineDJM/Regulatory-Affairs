"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, MapPin, Pencil, Plus, Search, Stethoscope, Trash2 } from "lucide-react";
import { createInstitution, updateInstitution, deleteInstitution } from "@/lib/actions/medical-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface EtablissementRow {
  id: string;
  name: string;
  type: string;
  sector: string;
  wilaya: string | null;
  city: string | null;
  region: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  /** Combien de praticiens de l'annuaire y sont rattachés — dans la PORTÉE de la personne. */
  doctorCount: number;
  /** Dans combien de SECTEURS commerciaux il entre. Supprimer un établissement les ampute. */
  sectorCount: number;
}

/**
 * L'ANNUAIRE DES ÉTABLISSEMENTS — CHU, EPH, EHS, cliniques, polycliniques, cabinets.
 *
 * ── POURQUOI CET ÉCRAN N'EXISTAIT PAS, ET CE QUE ÇA COÛTAIT ────────────────────────────────
 *
 * `MedicalInstitution` est en base depuis toujours, avec ses trois écritures
 * (`createInstitution`, `updateInstitution`, `deleteInstitution`) — classées, décrites, et
 * appelables par ADAM. Recensé : leurs seuls importeurs étaient `assistant.ts` et le catalogue
 * d'ops. AUCUN écran. Le référentiel existait, ses écritures existaient, la conversation savait
 * s'en servir, et personne devant un écran ne pouvait en ajouter un — §118.14 dans sa forme
 * exacte, et §118.50 pour l'écran.
 *
 * Ce que ça coûtait concrètement : la fiche d'un praticien porte `institution` en TEXTE LIBRE à
 * côté de `institutionId`. Sans écran, tout le monde tapait le nom à la main, donc « CHU
 * Mustapha », « C.H.U Mustapha » et « CHU MUSTAPHA BACHA » sont trois établissements pour les
 * humains et zéro pour le logiciel : ni panel par hôpital, ni secteur commercial, ni couverture.
 *
 * ── CE QUE LA SUPPRESSION EMPORTE, DIT AVANT LE CLIC ───────────────────────────────────────
 *
 * Les praticiens rattachés ne sont PAS supprimés (clé étrangère `SetNull`) : ils basculent en
 * « sans établissement ». Mais les SECTEURS commerciaux qui le contenaient le perdent en
 * cascade, et un KAM dont le secteur se vide n'a plus de médecin à visiter. Les deux comptes
 * sont donc affichés sur la ligne ET répétés dans la confirmation : c'est la conséquence, pas la
 * ligne supprimée, qu'on doit lire avant de décider.
 */
export function EtablissementsTable({
  rows, types, sectors, canCreate, canEdit, canDelete,
}: {
  rows: EtablissementRow[];
  /** Libellés du référentiel commun (`lib/labels.ts`) — jamais réécrits ici. */
  types: { value: string; label: string }[];
  sectors: { value: string; label: string }[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<EtablissementRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");

  const labelType = (v: string) => types.find((t) => t.value === v)?.label ?? v;
  const labelSector = (v: string) => sectors.find((s) => s.value === v)?.label ?? v;

  const run = async (action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData) => {
    setBusy(true); setErr(null);
    const r = await action(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Action impossible."); return false; }
    router.refresh();
    return true;
  };

  const remove = async (e: EtablissementRow) => {
    const consequences = [
      e.doctorCount > 0 ? `${e.doctorCount} praticien(s) passeront en « sans établissement » (ils ne sont PAS supprimés)` : null,
      e.sectorCount > 0 ? `${e.sectorCount} secteur(s) commercial(aux) le perdront — un KAM dont le secteur se vide n'a plus de médecin à visiter` : null,
    ].filter(Boolean);
    const msg = `Supprimer « ${e.name} » ?`
      + (consequences.length ? `\n\n${consequences.map((c) => `• ${c}`).join("\n")}` : "");
    if (!window.confirm(msg)) return;
    const fd = new FormData();
    fd.set("id", e.id);
    await run(deleteInstitution, fd);
  };

  // LE FILTRE EST CLIENT : le parc d'établissements se compte en centaines, pas en dizaines de
  // milliers — un aller-retour serveur par frappe coûterait plus que le gain.
  const visibles = rows.filter((r) => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (!q.trim()) return true;
    const t = `${r.name} ${r.city ?? ""} ${r.wilaya ?? ""} ${r.region ?? ""}`.toLowerCase();
    return t.includes(q.trim().toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q} onChange={(ev) => setQ(ev.target.value)} className="pl-8"
            placeholder="Chercher un établissement, une ville, une wilaya…"
            aria-label="Chercher un établissement"
          />
        </div>
        <Select value={typeFilter} onChange={(ev) => setTypeFilter(ev.target.value)} className="w-auto" aria-label="Filtrer par type">
          <option value="">Tous les types</option>
          {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        {canCreate && (
          <Button onClick={() => { setErr(null); setCreating(true); }} disabled={busy}>
            <Plus className="h-4 w-4" /> Ajouter un établissement
          </Button>
        )}
      </div>

      {err && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Établissement</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Secteur</th>
              <th className="px-3 py-2 font-medium">Localisation</th>
              <th className="px-3 py-2 font-medium text-right">Praticiens</th>
              <th className="px-3 py-2 font-medium text-right">Secteurs</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {rows.length === 0
                    ? "Aucun établissement dans l'annuaire. C'est lui qui permet de rattacher un praticien à un vrai hôpital, et de découper les secteurs de la force de vente."
                    : "Aucun établissement ne correspond à cette recherche."}
                </td>
              </tr>
            )}
            {visibles.map((e) => (
              <tr key={e.id} className={cn("border-t border-border", !e.isActive && "opacity-60")}>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2 font-medium">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    {e.name}
                    {!e.isActive && <Badge tone="neutral">Inactif</Badge>}
                  </span>
                  {e.phone || e.email ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{[e.phone, e.email].filter(Boolean).join(" · ")}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">{labelType(e.type)}</td>
                <td className="px-3 py-2">
                  <Badge tone={e.sector === "PUBLIC" ? "info" : "purple"}>{labelSector(e.sector)}</Badge>
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {[e.city, e.wilaya, e.region].filter(Boolean).join(", ") || "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {e.doctorCount > 0
                    ? <span className="inline-flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{e.doctorCount}</span>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {e.sectorCount > 0 ? e.sectorCount : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center justify-end gap-1">
                    {canEdit && (
                      <button
                        type="button" onClick={() => { setErr(null); setEditing(e); }} disabled={busy}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Modifier ${e.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button" onClick={() => void remove(e)} disabled={busy}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Supprimer ${e.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {visibles.length} établissement(s) affiché(s) sur {rows.length}.
      </p>

      <Sheet
        open={creating || editing !== null}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Modifier « ${editing.name} »` : "Ajouter un établissement"}
        description="Le nom est ce que la force de vente lit sur un plan de tournée — écrivez-le comme il se dit."
        width="md"
      >
        <form
          className="space-y-3"
          action={async (fd) => {
            if (editing) fd.set("id", editing.id);
            const ok = await run(editing ? updateInstitution : createInstitution, fd);
            if (ok) { setCreating(false); setEditing(null); }
          }}
        >
          <div>
            <Label htmlFor="etab-name">Nom de l&apos;établissement</Label>
            <Input id="etab-name" name="name" required defaultValue={editing?.name ?? ""} placeholder="CHU Mustapha Bacha" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="etab-type">Type</Label>
              <Select id="etab-type" name="type" defaultValue={editing?.type ?? "AUTRE"}>
                {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="etab-sector">Secteur</Label>
              <Select id="etab-sector" name="sector" defaultValue={editing?.sector ?? "PUBLIC"}>
                {sectors.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="etab-city">Ville</Label>
              <Input id="etab-city" name="city" defaultValue={editing?.city ?? ""} placeholder="Alger" />
            </div>
            <div>
              <Label htmlFor="etab-wilaya">Wilaya</Label>
              <Input id="etab-wilaya" name="wilaya" defaultValue={editing?.wilaya ?? ""} placeholder="Alger" />
            </div>
            <div>
              <Label htmlFor="etab-region">Région</Label>
              <Input id="etab-region" name="region" defaultValue={editing?.region ?? ""} placeholder="Centre" />
            </div>
            <div>
              <Label htmlFor="etab-phone">Téléphone</Label>
              <Input id="etab-phone" name="phone" defaultValue={editing?.phone ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="etab-email">E-mail</Label>
              <Input id="etab-email" name="email" type="email" defaultValue={editing?.email ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="etab-address">Adresse</Label>
              <Input id="etab-address" name="address" defaultValue={editing?.address ?? ""} />
            </div>
          </div>
          <div>
            <Label htmlFor="etab-notes">Notes</Label>
            <Textarea id="etab-notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              {/* La case NON cochée doit ENVOYER « off » : `updateInstitution` distingue
                  « on » / « off » / absent, et un champ absent laisse l'état INCHANGÉ. Sans ce
                  champ caché, décocher n'aurait aucun effet — un geste sans conséquence, en
                  silence. */}
              <input type="hidden" name="isActive" value="off" />
              <input type="checkbox" name="isActive" value="on" defaultChecked={editing.isActive} className="h-4 w-4 rounded border-input" />
              Établissement actif (un établissement inactif ne se propose plus au rattachement)
            </label>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setCreating(false); setEditing(null); }} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
