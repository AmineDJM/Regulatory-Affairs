"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search, Upload, Loader2, FileSpreadsheet, Info, Plus, Rows3, LayoutList, Check, X, Trash2, Columns3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { normalizeHeader } from "@/lib/medical/directory-sheet";
import { ANNUAIRE_COLUMNS, annuaireCell, type AnnuaireRow, type AnnuaireField, type CustomColumnVue } from "@/lib/medical/directory-grid";
import {
  importDirectorySheet, previewDirectorySheet, saveDirectoryCell, saveDirectoryCustomCell,
  addDirectoryDoctor, deleteDirectoryDoctors,
} from "@/lib/actions/medical-directory-actions";
import { createDirectoryColumn, deleteDirectoryColumn } from "@/lib/actions/medical-directory-crud-actions";
import { colorerCellulesAnnuaire } from "@/lib/actions/annuaire-couleurs-actions";
import type { HeaderProposal, TargetColumn } from "@/lib/medical/directory-mapping";
import { cleCellule, type CouleurCellule } from "@/lib/grille/couleurs";
import type { Coord } from "@/lib/grille/selection";
import { useSelectionGrille } from "@/components/grille/use-selection";
import { BarreSelection, classeCouleurCellule } from "@/components/grille/barre-selection";
import { ImportMappingSheet } from "./import-mapping-sheet";

/**
 * L'ANNUAIRE COMME UN VRAI TABLEUR — sélection, couleurs, colonnes sur mesure, édition en place.
 *
 * ── CE QUI A CHANGÉ, ET POURQUOI (§118.133) ──────────────────────────────────────────────
 *
 * La première feuille éditait au CLIC : chaque cellule était un champ de saisie ouvert en
 * permanence. C'était bien pour corriger un numéro, et cela rendait impossible tout le reste
 * d'un tableur — sélectionner une plage, la colorer, la copier — puisque le clic était déjà
 * pris. Le dirigeant l'a dit en une phrase : « les annuaires doivent permettre plus de
 * flexibilité, possibilité de sélectionner des cellules, mettre des couleurs ».
 *
 * La feuille suit donc le modèle qu'on connaît tous : UN CLIC SÉLECTIONNE (Maj étend, Ctrl
 * ajoute, glisser étend, les flèches déplacent) ; DOUBLE-CLIC, ENTRÉE, F2 OU UNE FRAPPE ÉDITENT
 * (Entrée valide et descend, Tab valide et avance, Échap annule). La sélection vit dans un module
 * pur testé (`lib/grille/selection.ts`) ; la couleur est une donnée PARTAGÉE de la feuille,
 * posée sous le même droit que la cellule (`annuaire-couleurs-actions.ts`).
 *
 * ── LES COLONNES SUR MESURE EXISTAIENT SANS ÉCRAN ────────────────────────────────────────
 *
 * `MedicalDirectoryColumn` était en base, l'import savait les remplir, Adam savait les créer —
 * et cette feuille ne les affichait pas (§118.14). Elles suivent désormais le tronc commun,
 * s'éditent selon leur type (texte, nombre, date, choix) et se gèrent depuis « Colonnes ».
 *
 * Les coordonnées de sélection sont GLOBALES à la feuille — y compris en vue par spécialité, où
 * chaque groupe rend une tranche de la même numérotation : une plage qui traverse deux groupes
 * reste une plage.
 */

const SPECIALTY_LIST_ID = "annuaire-specialties";

export type { CustomColumnVue };

/** Une colonne telle que la feuille la rend — tronc commun ou sur mesure, même contrat. */
interface ColonneVue {
  cle: string;
  header: string;
  editor: "text" | "select" | "number" | "date";
  options?: { value: string; label: string }[];
  suggest?: boolean;
  width: number;
  custom: boolean;
  /** Le champ du tronc commun, quand c'en est un (pour l'affichage traduit et l'écriture). */
  field?: AnnuaireField;
}

function colonnesDeLaFeuille(custom: CustomColumnVue[]): ColonneVue[] {
  const std: ColonneVue[] = ANNUAIRE_COLUMNS.map((c) => ({
    cle: c.field, header: c.header, editor: c.editor, options: c.options, suggest: c.suggest,
    width: c.width ?? 12, custom: false, field: c.field,
  }));
  const cus: ColonneVue[] = custom.map((c) => ({
    cle: c.key, header: c.label, width: 12, custom: true,
    editor: c.kind === "CHOICE" ? "select" : c.kind === "NUMBER" ? "number" : c.kind === "DATE" ? "date" : "text",
    options: c.kind === "CHOICE" ? c.options.map((o) => ({ value: o, label: o })) : undefined,
  }));
  return [...std, ...cus];
}

/** La valeur AFFICHÉE d'une cellule — la même pour l'écran, la copie et la recherche. */
function valeurAffichee(row: AnnuaireRow, col: ColonneVue): string {
  if (col.field) return annuaireCell(row, col.field);
  const v = row.custom?.[col.cle];
  if (v === null || v === undefined) return "";
  return typeof v === "number" ? String(v).replace(".", ",") : String(v);
}

/** La valeur BRUTE d'une cellule (code d'énuméré, texte) — ce que l'éditeur reçoit. */
function valeurBrute(row: AnnuaireRow, col: ColonneVue): string {
  if (col.field) return ((row[col.field] as string | null) ?? "");
  const v = row.custom?.[col.cle];
  return v === null || v === undefined ? "" : String(v);
}

interface Edition {
  r: number;
  c: number;
  initial?: string;
}

// ── L'ÉDITEUR D'UNE CELLULE : rendu seulement pendant l'édition. ──
function EditeurCellule({
  col, valeur, initial, onCommit, onCancel,
}: {
  col: ColonneVue;
  valeur: string;
  initial?: string;
  onCommit: (next: string, suite?: "bas" | "droite" | "gauche") => void;
  onCancel: () => void;
}) {
  const ref = React.useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  // UNE SEULE ISSUE PAR ÉDITION. Entrée valide puis l'éditeur se démonte, et le navigateur envoie
  // encore un `blur` : sans ce verrou, la même valeur partirait deux fois — et Échap, qui annule,
  // serait suivi d'un blur qui VALIDE ce qu'on venait d'annuler.
  const fini = React.useRef(false);
  const commit = (next: string, suite?: "bas" | "droite" | "gauche") => {
    if (fini.current) return;
    fini.current = true;
    onCommit(next, suite);
  };
  const cancel = () => {
    if (fini.current) return;
    fini.current = true;
    onCancel();
  };
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Une frappe qui a ouvert l'édition remplace le contenu : le curseur se met à la fin.
    if (el instanceof HTMLInputElement && el.type !== "date") {
      const n = el.value.length;
      try { el.setSelectionRange(n, n); } catch { /* type non textuel */ }
    }
  }, []);

  const classes = "w-full min-w-[6rem] select-text rounded bg-card px-2 py-1.5 text-sm outline-none ring-2 ring-ring";

  if (col.editor === "select") {
    return (
      <select
        ref={ref as React.RefObject<HTMLSelectElement>}
        defaultValue={valeur}
        className={cn(classes, "cursor-pointer")}
        onChange={(e) => commit(e.target.value)}
        onBlur={cancel}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
          if (e.key === "Enter") { e.preventDefault(); commit((e.target as HTMLSelectElement).value, "bas"); }
          if (e.key === "Tab") { e.preventDefault(); commit((e.target as HTMLSelectElement).value, e.shiftKey ? "gauche" : "droite"); }
        }}
      >
        {(col.field === "wilaya" || col.custom) && <option value="">—</option>}
        {(col.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      type={col.editor === "date" ? "date" : "text"}
      inputMode={col.editor === "number" ? "decimal" : undefined}
      defaultValue={initial ?? valeur}
      list={col.suggest ? SPECIALTY_LIST_ID : undefined}
      className={classes}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        const el = e.target as HTMLInputElement;
        if (e.key === "Enter") { e.preventDefault(); commit(el.value, "bas"); }
        else if (e.key === "Tab") { e.preventDefault(); commit(el.value, e.shiftKey ? "gauche" : "droite"); }
        else if (e.key === "Escape") { e.preventDefault(); cancel(); }
      }}
    />
  );
}

/**
 * LE QUADRILLAGE — des CELLULES, comme dans un tableur.
 *
 * Un annuaire se lit à l'horizontale (« quelle est la wilaya de cette ligne ? ») et à la
 * verticale (« qui est en cardiologie ? »). Sans trait vertical, l'œil perd la colonne dès la
 * cinquième ligne et l'on corrige la mauvaise cellule. D'où le quadrillage complet, et le
 * surlignage de la ligne survolée. `offset` est le rang de la première ligne de cette tranche
 * dans la feuille entière : c'est ce qui rend la sélection continue entre deux groupes.
 */
function GridTable({
  rows, offset, colonnes, editable, selected, onToggle, onToggleAll, grille, edition, onCommit, onCancel,
  couleurs, overrides,
}: {
  rows: AnnuaireRow[];
  offset: number;
  colonnes: ColonneVue[];
  editable: boolean;
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  onToggleAll: (ids: string[], on: boolean) => void;
  grille: ReturnType<typeof useSelectionGrille>;
  edition: Edition | null;
  onCommit: (row: AnnuaireRow, col: ColonneVue, next: string, suite?: "bas" | "droite" | "gauche") => void;
  onCancel: () => void;
  couleurs: Record<string, string>;
  overrides: Map<string, string>;
}) {
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full min-w-[72rem] border-collapse text-sm select-none">
        <thead>
          <tr className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="w-10 border border-border px-2 py-2">
              <input
                type="checkbox" checked={allChecked}
                onChange={(e) => onToggleAll(rows.map((r) => r.id), e.target.checked)}
                aria-label="Tout sélectionner" className="h-4 w-4 rounded border-input"
              />
            </th>
            {colonnes.map((c) => (
              <th
                key={c.cle}
                className={cn("whitespace-nowrap border border-border px-2 py-2 text-left font-medium", c.custom && "text-primary")}
                style={{ minWidth: `${c.width}rem` }}
                title={c.custom ? "Colonne propre à cet annuaire" : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const r = offset + i;
            return (
              <tr key={row.id} className={cn("hover:bg-secondary/20", selected.has(row.id) && "bg-primary/5")}>
                <td className="border border-border px-2 text-center">
                  <input
                    type="checkbox" checked={selected.has(row.id)}
                    onChange={(e) => onToggle(row.id, e.target.checked)}
                    aria-label={`Sélectionner ${row.lastName ?? row.firstName ?? "cette ligne"}`}
                    className="h-4 w-4 rounded border-input"
                  />
                </td>
                {colonnes.map((col, c) => {
                  const enEdition = edition !== null && edition.r === r && edition.c === c;
                  const selectionnee = grille.estSelectionnee(r, c);
                  const couleur = couleurs[cleCellule(row.id, col.cle)];
                  const affichee = overrides.get(cleCellule(row.id, col.cle)) ?? valeurAffichee(row, col);
                  return (
                    <td
                      key={col.cle}
                      {...grille.propsCellule(r, c)}
                      className={cn(
                        "border border-border align-middle",
                        col.cle === "lastName" && "font-medium",
                        classeCouleurCellule(couleur),
                        selectionnee && "shadow-[inset_0_0_0_2px_hsl(var(--primary))] bg-primary/5",
                        !editable && "text-muted-foreground",
                      )}
                    >
                      {enEdition && editable ? (
                        <EditeurCellule
                          col={col}
                          valeur={valeurBrute(row, col)}
                          initial={edition.initial}
                          onCommit={(next, suite) => onCommit(row, col, next, suite)}
                          onCancel={onCancel}
                        />
                      ) : (
                        <span className="block min-h-[2rem] px-2 py-1.5">
                          {affichee || <span className="text-muted-foreground/40">—</span>}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AnnuaireGrid({
  rows, couleurs, customColumns, canEdit, canImport, canDelete, specialties, directoryId, directoryName,
  titreParDefaut, exportHref = "/api/medical/annuaire/export",
}: {
  rows: AnnuaireRow[];
  /** Les couleurs posées sur la feuille — `<id>:<colonne>` → clé de palette. */
  couleurs: Record<string, string>;
  /** Les colonnes propres à l'annuaire ouvert (vide pour l'annuaire général ou la vue « Tous »). */
  customColumns: CustomColumnVue[];
  canEdit: boolean; canImport: boolean; canDelete: boolean; specialties: string[];
  /**
   * L'ANNUAIRE OUVERT — `null` = l'annuaire général.
   *
   * Il MANQUAIT, et c'était tout le défaut : la grille ne savait pas dans quel annuaire elle
   * travaillait, l'import partait donc sans destination et atterrissait dans le général.
   */
  directoryId: string | null;
  directoryName: string;
  /** Le grade d'une fiche ajoutée depuis cette vue (l'onglet Pharmaciens ajoute un PHARMACIEN). */
  titreParDefaut?: string;
  exportHref?: string;
}) {
  const router = useRouter();
  // SÉLECTION DE LIGNES (cases) — un annuaire se nettoie par lots (doublons d'import, cabinet
  // fermé). Ligne par ligne, personne ne le fait : on garde alors des fiches fausses, pire
  // qu'absentes. Distincte de la sélection de CELLULES, qui sert à colorer et copier.
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const toggleOne = React.useCallback((id: string, on: boolean) => {
    setSelected((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });
  }, []);
  const toggleMany = React.useCallback((ids: string[], on: boolean) => {
    setSelected((p) => { const n = new Set(p); for (const id of ids) { if (on) n.add(id); else n.delete(id); } return n; });
  }, []);
  const [deleting, setDeleting] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [bySpecialty, setBySpecialty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [colonnesOuvertes, setColonnesOuvertes] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  // Le fichier lu, en attente que la correspondance soit tranchée.
  const [pending, setPending] = React.useState<
    { file: File; proposals: HeaderProposal[]; targets: TargetColumn[]; rowCount: number } | null
  >(null);

  const colonnes = React.useMemo(() => colonnesDeLaFeuille(customColumns), [customColumns]);

  // Chaque ligne, mise à plat une fois, pour une recherche qui porte sur ce qu'on VOIT
  // (« Professeur », « Alger », « Très haut »), pas sur les codes internes.
  const haystacks = React.useMemo(
    () => new Map(rows.map((r) => [r.id, normalizeHeader(colonnes.map((c) => valeurAffichee(r, c)).join(" "))])),
    [rows, colonnes],
  );
  const needle = normalizeHeader(q);
  const filtered = React.useMemo(
    () => (needle ? rows.filter((r) => (haystacks.get(r.id) ?? "").includes(needle)) : rows),
    [rows, needle, haystacks],
  );

  const groups = React.useMemo(() => {
    if (!bySpecialty) return null;
    const map = new Map<string, AnnuaireRow[]>();
    for (const r of filtered) {
      const key = (r.specialty ?? "").trim() || "Sans spécialité";
      (map.get(key) ?? map.set(key, []).get(key)!).push(r);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === "Sans spécialité") return 1;
      if (b[0] === "Sans spécialité") return -1;
      return a[0].localeCompare(b[0], "fr");
    });
  }, [bySpecialty, filtered]);

  // L'ORDRE DE LA FEUILLE — celui dans lequel les lignes sont rendues, groupes compris. C'est
  // sur lui que les coordonnées de sélection sont numérotées.
  const ordonnees = React.useMemo<AnnuaireRow[]>(
    () => (groups ? groups.flatMap(([, list]) => list) : filtered),
    [groups, filtered],
  );

  // ── ÉDITION EN PLACE ──
  const [edition, setEdition] = React.useState<Edition | null>(null);
  // Ce qu'on vient d'écrire, affiché tout de suite : entre l'envoi et le rafraîchissement du
  // serveur, la cellule ne doit pas remontrer l'ancienne valeur.
  const [overrides, setOverrides] = React.useState<Map<string, string>>(new Map());
  React.useEffect(() => { setOverrides(new Map()); }, [rows]);

  // ── COULEURS, avec mise à jour optimiste ──
  const [couleursLocales, setCouleursLocales] = React.useState<Record<string, string>>(couleurs);
  React.useEffect(() => { setCouleursLocales(couleurs); }, [couleurs]);

  const valeurPourCopie = React.useCallback((r: number, c: number) => {
    const row = ordonnees[r]; const col = colonnes[c];
    if (!row || !col) return "";
    return overrides.get(cleCellule(row.id, col.cle)) ?? valeurAffichee(row, col);
  }, [ordonnees, colonnes, overrides]);

  const demanderEdition = React.useCallback((coord: Coord, initial?: string) => {
    if (!canEdit) return;
    const col = colonnes[coord.c];
    if (!col) return;
    // Une frappe sur un menu fermé n'a pas de sens : on ouvre le menu, sans texte initial.
    setEdition({ r: coord.r, c: coord.c, initial: col.editor === "text" || col.editor === "number" ? initial : undefined });
  }, [canEdit, colonnes]);

  const grille = useSelectionGrille({
    lignes: ordonnees.length,
    colonnes: colonnes.length,
    valeur: valeurPourCopie,
    onEditer: canEdit ? demanderEdition : undefined,
    editionActive: edition !== null,
  });

  const annulerEdition = React.useCallback(() => {
    setEdition(null);
    grille.apresEdition();
  }, [grille]);

  const validerEdition = React.useCallback((row: AnnuaireRow, col: ColonneVue, next: string, suite?: "bas" | "droite" | "gauche") => {
    setEdition(null);
    grille.apresEdition(suite);
    const avant = valeurBrute(row, col);
    if (next === avant) return;
    const k = cleCellule(row.id, col.cle);
    // Affichage immédiat : pour un menu, le libellé de l'option ; sinon le texte tel quel.
    const libelle = col.options?.find((o) => o.value === next)?.label ?? next;
    setOverrides((m) => new Map(m).set(k, libelle));
    const promesse = col.field
      ? saveDirectoryCell({ id: row.id, field: col.field, value: next })
      : saveDirectoryCustomCell({ id: row.id, key: col.cle, value: next });
    void promesse.then((r) => {
      if (r.ok) { setMsg(null); router.refresh(); }
      else {
        setOverrides((m) => { const n = new Map(m); n.delete(k); return n; });
        setMsg({ ok: false, text: r.error ?? "Écriture refusée." });
      }
    });
  }, [grille, router]);

  const appliquerCouleur = React.useCallback((couleur: CouleurCellule | null) => {
    const cibles = grille.cellules
      .map(({ r, c }) => ({ id: ordonnees[r]?.id ?? "", field: colonnes[c]?.cle ?? "" }))
      .filter((c) => c.id && c.field);
    if (cibles.length === 0) return;
    const avant = couleursLocales;
    const apres = { ...avant };
    for (const c of cibles) {
      const k = cleCellule(c.id, c.field);
      if (couleur) apres[k] = couleur; else delete apres[k];
    }
    setCouleursLocales(apres);
    setBusy(true); setMsg(null);
    void colorerCellulesAnnuaire({ feuille: "praticiens", cellules: cibles.map((c) => cleCellule(c.id, c.field)), couleur }).then((r) => {
      setBusy(false);
      if (!r.ok) { setCouleursLocales(avant); setMsg({ ok: false, text: r.error ?? "Coloration refusée." }); return; }
      if (r.ignorees > 0) setMsg({ ok: true, text: r.message ?? "" });
      router.refresh();
    });
  }, [grille.cellules, ordonnees, colonnes, couleursLocales, router]);

  // ÉTAPE 1 — on LIT le fichier et on propose une correspondance. Rien n'est écrit.
  const runPreview = (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    if (directoryId) fd.set("directoryId", directoryId);
    setBusy(true); setMsg(null);
    void previewDirectorySheet(fd).then((r) => {
      setBusy(false);
      if (!r.ok || !r.preview) {
        setMsg({ ok: false, text: r.error ?? "Lecture impossible." });
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      setPending({ file, ...r.preview });
    });
  };

  // ÉTAPE 2 — la correspondance validée à l'écran part avec le fichier.
  const runImport = (file: File, mapping: (string | null)[]) => {
    const fd = new FormData();
    fd.set("file", file);
    // LA DESTINATION. Son absence était le bug : sans elle, tout finissait dans le général.
    if (directoryId) fd.set("directoryId", directoryId);
    fd.set("mapping", JSON.stringify(mapping));
    setBusy(true); setMsg(null); setPending(null);
    void importDirectorySheet(fd).then((r) => {
      setBusy(false);
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Annuaire importé.") : (r.error ?? "Import impossible.") });
      if (r.ok) router.refresh();
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const tableProps = {
    colonnes, editable: canEdit, selected, onToggle: toggleOne, onToggleAll: toggleMany, grille, edition,
    onCommit: validerEdition, onCancel: annulerEdition, couleurs: couleursLocales, overrides,
  };

  return (
    <div className="space-y-3">
      {/* L'ÉTAPE QUI MANQUAIT : on montre ce qu'on a compris AVANT d'écrire quoi que ce soit. */}
      {pending && (
        <ImportMappingSheet
          fileName={pending.file.name}
          directoryName={directoryName}
          rowCount={pending.rowCount}
          proposals={pending.proposals}
          targets={pending.targets}
          busy={busy}
          onCancel={() => { setPending(null); if (fileRef.current) fileRef.current.value = ""; }}
          onConfirm={(mapping) => runImport(pending.file, mapping)}
        />
      )}

      <datalist id={SPECIALTY_LIST_ID}>
        {specialties.map((s) => <option key={s} value={s} />)}
      </datalist>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher un nom, une wilaya, une spécialité…"
            className="w-72 pl-8"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} / {rows.length} praticien{rows.length > 1 ? "s" : ""}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-input">
            <button
              type="button" onClick={() => setBySpecialty(false)}
              className={cn("inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium", !bySpecialty ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50")}
            >
              <LayoutList className="h-3.5 w-3.5" /> Liste
            </button>
            <button
              type="button" onClick={() => setBySpecialty(true)}
              className={cn("inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium", bySpecialty ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50")}
            >
              <Rows3 className="h-3.5 w-3.5" /> Par spécialité
            </button>
          </div>
          {canEdit && directoryId && (
            <Button size="sm" variant={colonnesOuvertes ? "secondary" : "outline"} onClick={() => setColonnesOuvertes((v) => !v)}>
              <Columns3 className="h-3.5 w-3.5" /> Colonnes{customColumns.length > 0 ? ` (${customColumns.length})` : ""}
            </Button>
          )}
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-2 text-xs font-medium hover:bg-secondary"
            title="Exporter l'annuaire en Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Exporter
          </a>
          {canImport && (
            <>
              <input
                ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) runPreview(f); }}
              />
              <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Importer
              </Button>
            </>
          )}
        </div>
      </div>

      {colonnesOuvertes && directoryId && (
        <GestionColonnes
          directoryId={directoryId}
          colonnes={customColumns}
          onDone={() => router.refresh()}
        />
      )}

      {/* CE QUI EST SÉLECTIONNÉ, ET CE QU'ON EN FAIT — la barre n'apparaît que s'il y a une
          sélection : un bouton « Supprimer » toujours visible finit par être cliqué à vide. */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2.5 text-sm">
          <span className="font-medium">{selected.size} ligne{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}</span>
          {canDelete && (
            <Button
              size="sm" variant="outline" disabled={deleting}
              onClick={() => {
                if (!window.confirm(`Supprimer ${selected.size} fiche(s) de l'annuaire ? Cette action est définitive.`)) return;
                setDeleting(true);
                void deleteDirectoryDoctors([...selected]).then((r) => {
                  setDeleting(false);
                  setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Supprimé.") : (r.error ?? "Suppression impossible.") });
                  if (r.ok) { setSelected(new Set()); router.refresh(); }
                });
              }}
              className="text-destructive"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Supprimer
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            <X className="h-3.5 w-3.5" /> Tout désélectionner
          </Button>
        </div>
      )}

      <BarreSelection
        nombre={grille.nombre}
        peutColorer={canEdit}
        busy={busy}
        onCouleur={(c) => appliquerCouleur(c)}
        onEffacer={() => appliquerCouleur(null)}
        onCopier={grille.copier}
        onFermer={grille.vider}
        message={msg && grille.nombre > 0 ? msg : null}
      />

      {canImport && <AddDoctorRow specialtyListId={SPECIALTY_LIST_ID} titreParDefaut={titreParDefaut} directoryId={directoryId} />}

      {canEdit && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Un clic sélectionne</strong> une cellule — Maj étend, Ctrl ajoute, on peut aussi glisser et se
            déplacer aux flèches. <strong>Double-clic, Entrée ou une frappe</strong> ouvrent la correction ;
            Entrée valide et descend, Tab valide et avance, Échap annule. Wilaya, grade, secteur et potentiel se
            choisissent dans un menu. Les cellules sélectionnées se <strong>colorent</strong> et se{" "}
            <strong>copient</strong> (Ctrl+C) depuis la barre qui apparaît.
            {canImport && <> L&apos;<strong>import</strong> accepte un fichier existant ; l&apos;<strong>export</strong> reprend les colonnes de la feuille.</>}
          </span>
        </p>
      )}

      {msg && grille.nombre === 0 && (
        <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {msg.text}
        </p>
      )}

      <div {...grille.propsConteneur} className="space-y-5 rounded-xl outline-none focus-visible:ring-1 focus-visible:ring-ring">
        {ordonnees.length === 0 ? (
          <div className="surface px-3 py-10 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "L'annuaire est vide. Ajoutez un praticien ci-dessus, ou importez un fichier existant."
              : "Aucun praticien ne correspond à cette recherche."}
          </div>
        ) : groups ? (
          (() => {
            let offset = 0;
            return groups.map(([name, list]) => {
              const debut = offset;
              offset += list.length;
              return (
                <section key={name} className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    {name} <span className="text-xs font-normal text-muted-foreground">· {list.length}</span>
                  </h3>
                  <GridTable rows={list} offset={debut} {...tableProps} />
                </section>
              );
            });
          })()
        ) : (
          <GridTable rows={ordonnees} offset={0} {...tableProps} />
        )}
      </div>
    </div>
  );
}

/** La ligne d'ajout — un nom (ou prénom) suffit, le reste se remplit ensuite dans la feuille. */
function AddDoctorRow({ specialtyListId, titreParDefaut, directoryId }: { specialtyListId: string; titreParDefaut?: string; directoryId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [lastName, setLastName] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [specialty, setSpecialty] = React.useState("");
  const [wilaya, setWilaya] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const wilayaOptions = ANNUAIRE_COLUMNS.find((c) => c.field === "wilaya")?.options ?? [];

  const reset = () => { setLastName(""); setFirstName(""); setSpecialty(""); setWilaya(""); setErr(null); };
  const submit = () => {
    setBusy(true); setErr(null);
    void addDirectoryDoctor({ lastName, firstName, specialty, wilaya, title: titreParDefaut, directoryId }).then((r) => {
      setBusy(false);
      if (r.ok) { reset(); setOpen(false); router.refresh(); }
      else setErr(r.error ?? "Ajout impossible.");
    });
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> {titreParDefaut === "PHARMACIEN" ? "Ajouter un pharmacien" : "Ajouter un praticien"}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} autoFocus />
        <Input placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Input placeholder="Spécialité 1" list={specialtyListId} value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
        <Select value={wilaya} onChange={(e) => setWilaya(e.target.value)}>
          <option value="">Wilaya…</option>
          {wilayaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy} onClick={submit}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Ajouter
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => { reset(); setOpen(false); }}>
          <X className="h-3.5 w-3.5" /> Annuler
        </Button>
      </div>
    </div>
  );
}

/**
 * LES COLONNES PROPRES À L'ANNUAIRE — enfin gérables depuis la feuille.
 *
 * Ajouter (« Dernier congrès », « Numéro d'officine »), typer (texte, nombre, date, choix),
 * retirer. Les actions existaient (`createDirectoryColumn`, `deleteDirectoryColumn`) ; il leur
 * manquait un écran. Retirer une colonne ne détruit pas les valeurs déjà saisies dans les fiches
 * (elles restent dans le JSON de chaque praticien), elle les rend simplement invisibles — la
 * confirmation le dit.
 */
function GestionColonnes({ directoryId, colonnes, onDone }: { directoryId: string; colonnes: CustomColumnVue[]; onDone: () => void }) {
  const [label, setLabel] = React.useState("");
  const [kind, setKind] = React.useState<CustomColumnVue["kind"]>("TEXT");
  const [options, setOptions] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const ajouter = () => {
    const fd = new FormData();
    fd.set("directoryId", directoryId);
    fd.set("label", label);
    fd.set("kind", kind);
    if (kind === "CHOICE") fd.set("options", options);
    setBusy(true); setErr(null);
    void createDirectoryColumn(fd).then((r) => {
      setBusy(false);
      if (r.ok) { setLabel(""); setOptions(""); setKind("TEXT"); onDone(); }
      else setErr(r.error ?? "Ajout impossible.");
    });
  };

  const retirer = (c: CustomColumnVue) => {
    if (!window.confirm(`Retirer la colonne « ${c.label} » de cet annuaire ? Les valeurs déjà saisies ne seront plus affichées.`)) return;
    const fd = new FormData();
    fd.set("id", c.id);
    setBusy(true); setErr(null);
    void deleteDirectoryColumn(fd).then((r) => {
      setBusy(false);
      if (r.ok) onDone(); else setErr(r.error ?? "Suppression impossible.");
    });
  };

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3" data-testid="gestion-colonnes">
      <p className="text-sm font-medium">Colonnes propres à cet annuaire</p>
      {colonnes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune pour l&apos;instant. Une colonne ajoutée ici n&apos;existe que dans cet annuaire.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {colonnes.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs">
              <span className="font-medium">{c.label}</span>
              <span className="text-muted-foreground">
                · {c.kind === "TEXT" ? "texte" : c.kind === "NUMBER" ? "nombre" : c.kind === "DATE" ? "date" : `choix : ${c.options.join(", ")}`}
              </span>
              <button type="button" onClick={() => retirer(c)} disabled={busy} className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Retirer la colonne ${c.label}`}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Input placeholder="Nom de la colonne" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Select value={kind} onChange={(e) => setKind(e.target.value as CustomColumnVue["kind"])}>
          <option value="TEXT">Texte</option>
          <option value="NUMBER">Nombre</option>
          <option value="DATE">Date</option>
          <option value="CHOICE">Choix</option>
        </Select>
        {kind === "CHOICE" && (
          <Input placeholder="Options séparées par |" value={options} onChange={(e) => setOptions(e.target.value)} className="sm:col-span-2" />
        )}
        <Button size="sm" disabled={busy || !label.trim()} onClick={ajouter} className={kind === "CHOICE" ? "sm:col-span-4 sm:w-fit" : ""}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Ajouter la colonne
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
