"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, MapPin, Pencil, Plus, Search, Stethoscope, Trash2 } from "lucide-react";
import { createInstitution, updateInstitution, deleteInstitution } from "@/lib/actions/medical-actions";
import { colorerCellulesAnnuaire } from "@/lib/actions/annuaire-couleurs-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ALGERIA_WILAYAS } from "@/lib/labels";
import { ETABLISSEMENT_COLUMNS, type EtablissementField } from "@/lib/medical/etablissements-grid";
import { cleCellule, type CouleurCellule } from "@/lib/grille/couleurs";
import { useSelectionGrille } from "@/components/grille/use-selection";
import { BarreSelection, classeCouleurCellule } from "@/components/grille/barre-selection";

import type { EtablissementRow } from "@/lib/annuaires/types";

export type { EtablissementRow };

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
 * ── LA WILAYA EST LE SEUL DÉCOUPAGE (décision de la Direction, 09/2026) ─────────────────
 *
 * Le formulaire portait « Ville » ET « Wilaya », deux textes libres côte à côte : « Alger »,
 * « ALGER » et « Alger centre » faisaient trois lieux pour le logiciel. La ville a disparu ; la
 * wilaya se CHOISIT dans la liste fermée des 58 (`ALGERIA_WILAYAS`, la même liste que la
 * feuille des praticiens et que le plan de tournée), et l'action serveur refuse tout ce qui n'en
 * fait pas partie.
 *
 * ── LA FEUILLE SE SÉLECTIONNE ET SE COLORE (§118.133) ─────────────────────────────────────
 *
 * Même mécanique que l'annuaire des praticiens : un clic prend une cellule, Maj étend, Ctrl
 * ajoute, glisser étend ; la barre colore, efface, copie. La couleur est partagée et se pose
 * sous le droit de modification du module — un référentiel n'a pas de portée par ligne.
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
  rows, couleurs, types, sectors, canCreate, canEdit, canDelete,
}: {
  rows: EtablissementRow[];
  /** Les couleurs posées sur la feuille — `<id>:<colonne>` → clé de palette. */
  couleurs: Record<string, string>;
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
  const [couleursLocales, setCouleursLocales] = React.useState<Record<string, string>>(couleurs);
  React.useEffect(() => { setCouleursLocales(couleurs); }, [couleurs]);
  const [msgCouleur, setMsgCouleur] = React.useState<{ ok: boolean; text: string } | null>(null);

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
  const visibles = React.useMemo(() => rows.filter((r) => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (!q.trim()) return true;
    const t = `${r.name} ${r.wilaya ?? ""} ${r.region ?? ""}`.toLowerCase();
    return t.includes(q.trim().toLowerCase());
  }), [rows, typeFilter, q]);

  /** La valeur AFFICHÉE d'une cellule — la même pour l'écran et pour la copie. */
  const valeurCellule = React.useCallback((row: EtablissementRow, field: EtablissementField): string => {
    switch (field) {
      case "name": return row.name;
      case "type": return labelType(row.type);
      case "sector": return labelSector(row.sector);
      case "wilaya": return row.wilaya ?? "";
      case "doctorCount": return String(row.doctorCount);
      case "sectorCount": return String(row.sectorCount);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, sectors]);

  const grille = useSelectionGrille({
    lignes: visibles.length,
    colonnes: ETABLISSEMENT_COLUMNS.length,
    valeur: (r, c) => {
      const row = visibles[r]; const col = ETABLISSEMENT_COLUMNS[c];
      return row && col ? valeurCellule(row, col.field) : "";
    },
  });

  const appliquerCouleur = (couleur: CouleurCellule | null) => {
    const cibles = grille.cellules
      .map(({ r, c }) => ({ id: visibles[r]?.id ?? "", field: ETABLISSEMENT_COLUMNS[c]?.field ?? "" }))
      .filter((c) => c.id && c.field);
    if (cibles.length === 0) return;
    const avant = couleursLocales;
    const apres = { ...avant };
    for (const c of cibles) {
      const k = cleCellule(c.id, c.field);
      if (couleur) apres[k] = couleur; else delete apres[k];
    }
    setCouleursLocales(apres);
    setBusy(true); setMsgCouleur(null);
    void colorerCellulesAnnuaire({ feuille: "etablissements", cellules: cibles.map((c) => cleCellule(c.id, c.field)), couleur }).then((r) => {
      setBusy(false);
      if (!r.ok) { setCouleursLocales(avant); setMsgCouleur({ ok: false, text: r.error ?? "Coloration refusée." }); return; }
      if (r.ignorees > 0) setMsgCouleur({ ok: true, text: r.message ?? "" });
      router.refresh();
    });
  };

  const wilayaHorsListe = editing?.wilaya && !ALGERIA_WILAYAS.includes(editing.wilaya) ? editing.wilaya : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q} onChange={(ev) => setQ(ev.target.value)} className="pl-8"
            placeholder="Chercher un établissement, une wilaya…"
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

      <BarreSelection
        nombre={grille.nombre}
        peutColorer={canEdit}
        busy={busy}
        onCouleur={(c) => appliquerCouleur(c)}
        onEffacer={() => appliquerCouleur(null)}
        onCopier={grille.copier}
        onFermer={grille.vider}
        message={msgCouleur}
      />

      <div {...grille.propsConteneur} className="overflow-x-auto rounded-xl border border-border outline-none focus-visible:ring-1 focus-visible:ring-ring">
        <table className="w-full min-w-[760px] select-none text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {ETABLISSEMENT_COLUMNS.map((c) => (
                <th key={c.field} className={cn("px-3 py-2 font-medium", c.calculee && "text-right")}>{c.header}</th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={ETABLISSEMENT_COLUMNS.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                  {rows.length === 0
                    ? "Aucun établissement dans l'annuaire. C'est lui qui permet de rattacher un praticien à un vrai hôpital, et de découper les secteurs de la force de vente."
                    : "Aucun établissement ne correspond à cette recherche."}
                </td>
              </tr>
            )}
            {visibles.map((e, r) => {
              const cellule = (c: number, field: EtablissementField, contenu: React.ReactNode, extra?: string) => (
                <td
                  key={field}
                  {...grille.propsCellule(r, c)}
                  className={cn(
                    "px-3 py-2 align-middle",
                    classeCouleurCellule(couleursLocales[cleCellule(e.id, field)]),
                    grille.estSelectionnee(r, c) && "shadow-[inset_0_0_0_2px_hsl(var(--primary))] bg-primary/5",
                    extra,
                  )}
                >
                  {contenu}
                </td>
              );
              return (
                <tr key={e.id} className={cn("border-t border-border", !e.isActive && "opacity-60")}>
                  {cellule(0, "name", (
                    <>
                      <span className="flex items-center gap-2 font-medium">
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        {e.name}
                        {!e.isActive && <Badge tone="neutral">Inactif</Badge>}
                      </span>
                      {e.phone || e.email ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{[e.phone, e.email].filter(Boolean).join(" · ")}</span>
                      ) : null}
                    </>
                  ))}
                  {cellule(1, "type", labelType(e.type))}
                  {cellule(2, "sector", <Badge tone={e.sector === "PUBLIC" ? "info" : "purple"}>{labelSector(e.sector)}</Badge>)}
                  {cellule(3, "wilaya", (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {e.wilaya || "—"}
                    </span>
                  ))}
                  {cellule(4, "doctorCount", e.doctorCount > 0
                    ? <span className="inline-flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{e.doctorCount}</span>
                    : <span className="text-muted-foreground">—</span>, "text-right tabular-nums")}
                  {cellule(5, "sectorCount", e.sectorCount > 0 ? e.sectorCount : <span className="text-muted-foreground">—</span>, "text-right tabular-nums")}
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
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {visibles.length} établissement(s) affiché(s) sur {rows.length}.
        {canEdit && " Un clic sélectionne une cellule, Maj étend, Ctrl ajoute ; la barre colore et copie la sélection."}
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
              <Label htmlFor="etab-wilaya">Wilaya</Label>
              {/* LA LISTE FERMÉE DES 58 — la même que la feuille des praticiens. Une valeur héritée
                  hors liste n'est pas pré-sélectionnée en silence : on la nomme, et l'on demande de
                  choisir. */}
              <Select id="etab-wilaya" name="wilaya" defaultValue={wilayaHorsListe ? "" : (editing?.wilaya ?? "")}>
                <option value="">—</option>
                {ALGERIA_WILAYAS.map((w) => <option key={w} value={w}>{w}</option>)}
              </Select>
              {wilayaHorsListe && (
                <p className="mt-1 text-xs text-warning">
                  Valeur actuelle hors liste : « {wilayaHorsListe} » — choisissez la wilaya dans le menu.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="etab-region">Région</Label>
              <Input id="etab-region" name="region" defaultValue={editing?.region ?? ""} placeholder="Centre" />
            </div>
            <div>
              <Label htmlFor="etab-phone">Téléphone</Label>
              <Input id="etab-phone" name="phone" defaultValue={editing?.phone ?? ""} />
            </div>
            <div>
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
