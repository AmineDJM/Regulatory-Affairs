"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Upload, Loader2, FileSpreadsheet, Info, Plus, Rows3, LayoutList, Check, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { normalizeHeader } from "@/lib/medical/directory-sheet";
import { ANNUAIRE_COLUMNS, annuaireCell, type AnnuaireRow, type AnnuaireColumn } from "@/lib/medical/directory-grid";
import { importDirectorySheet, previewDirectorySheet, saveDirectoryCell, addDirectoryDoctor, deleteDirectoryDoctors } from "@/lib/actions/medical-directory-actions";
import type { HeaderProposal, TargetColumn } from "@/lib/medical/directory-mapping";
import { ImportMappingSheet } from "./import-mapping-sheet";

/**
 * L'ANNUAIRE COMME UNE VRAIE FEUILLE — modifiable en place, exportable, vue par spécialité.
 *
 * On ne consulte pas un annuaire : on le CORRIGE. Un numéro qui change, une wilaya oubliée, un
 * grade à ajuster — chaque cellule s'édite sur place et part seule au serveur (les menus déroulants
 * n'acceptent que leurs valeurs : wilaya, grade, secteur, potentiel). La recherche porte sur toute
 * la ligne. Et l'on peut basculer en « vue par spécialité » — la question qu'on se pose vraiment :
 * « qui suit-on en cardiologie ? ».
 *
 * Les cellules sont NON CONTRÔLÉES et mémoïsées : taper ne re-rend pas les quatre cents lignes, et
 * filtrer ne perd pas la saisie en cours (on enregistre au « blur », avant que le focus ne parte).
 */

const SPECIALTY_LIST_ID = "annuaire-specialties";

// ── Une cellule texte : on tape, on quitte, ça enregistre si ça a changé. ──
const TextCell = React.memo(function TextCell({
  id, field, value, editable, listId,
}: {
  id: string; field: string; value: string | null; editable: boolean; listId?: string;
}) {
  const router = useRouter();
  const ref = React.useRef<HTMLInputElement>(null);
  const [status, setStatus] = React.useState<"idle" | "saving" | "error">("idle");

  if (!editable) {
    return <span className="block px-2 py-1.5 text-muted-foreground">{value || <span className="text-muted-foreground/40">—</span>}</span>;
  }

  const save = () => {
    const next = ref.current?.value ?? "";
    if (next === (value ?? "")) { setStatus("idle"); return; }
    setStatus("saving");
    void saveDirectoryCell({ id, field, value: next }).then((r) => {
      if (r.ok) { setStatus("idle"); router.refresh(); }
      else { setStatus("error"); if (ref.current) ref.current.value = value ?? ""; }
    });
  };

  return (
    <div className="relative">
      <input
        ref={ref}
        defaultValue={value ?? ""}
        list={listId}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ref.current?.blur(); } if (e.key === "Escape" && ref.current) { ref.current.value = value ?? ""; ref.current.blur(); } }}
        className={cn(
          "w-full min-w-[6rem] rounded bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-secondary/50 focus:ring-1 focus:ring-ring",
          status === "saving" && "opacity-60",
          status === "error" && "ring-1 ring-destructive",
        )}
      />
      {status === "saving" && <Loader2 className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-muted-foreground" />}
    </div>
  );
});

// ── Une cellule à menu déroulant : liste fermée, enregistrement au changement. ──
const SelectCell = React.memo(function SelectCell({
  id, field, value, options, editable, allowEmpty,
}: {
  id: string; field: string; value: string; options: { value: string; label: string }[]; editable: boolean; allowEmpty?: boolean;
}) {
  const router = useRouter();
  const [val, setVal] = React.useState(value);
  const [status, setStatus] = React.useState<"idle" | "saving" | "error">("idle");
  React.useEffect(() => setVal(value), [value]);

  if (!editable) {
    const label = options.find((o) => o.value === value)?.label ?? "";
    return <span className="block px-2 py-1.5 text-muted-foreground">{label || <span className="text-muted-foreground/40">—</span>}</span>;
  }

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    const prev = val;
    setVal(next); setStatus("saving");
    void saveDirectoryCell({ id, field, value: next }).then((r) => {
      if (r.ok) { setStatus("idle"); router.refresh(); }
      else { setStatus("error"); setVal(prev); }
    });
  };

  return (
    <select
      value={val}
      onChange={onChange}
      className={cn(
        "w-full min-w-[6rem] cursor-pointer rounded border-0 bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-secondary/50 focus:ring-1 focus:ring-ring",
        status === "saving" && "opacity-60",
        status === "error" && "ring-1 ring-destructive",
      )}
    >
      {allowEmpty && <option value="">—</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
});

function Cell({ row, col, editable }: { row: AnnuaireRow; col: AnnuaireColumn; editable: boolean }) {
  if (col.editor === "select") {
    return (
      <SelectCell
        id={row.id} field={col.field} value={(row[col.field] as string | null) ?? ""}
        options={col.options ?? []} editable={editable} allowEmpty={col.field === "wilaya"}
      />
    );
  }
  return (
    <TextCell
      id={row.id} field={col.field} value={row[col.field] as string | null}
      editable={editable} listId={col.suggest ? SPECIALTY_LIST_ID : undefined}
    />
  );
}

/**
 * LE QUADRILLAGE — des CELLULES, comme dans un tableur.
 *
 * Un annuaire qu'on corrige se lit à l'horizontale (« quelle est la wilaya de cette ligne ? ») et
 * à la verticale (« qui est en cardiologie ? »). Sans trait vertical, l'œil perd la colonne dès
 * la cinquième ligne et l'on corrige la mauvaise cellule. D'où le quadrillage complet, et le
 * surlignage de la ligne survolée.
 */
function GridTable({
  rows, editable, selected, onToggle, onToggleAll,
}: {
  rows: AnnuaireRow[]; editable: boolean;
  selected: Set<string>; onToggle: (id: string, on: boolean) => void; onToggleAll: (ids: string[], on: boolean) => void;
}) {
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full min-w-[72rem] border-collapse text-sm">
        <thead>
          <tr className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="w-10 border border-border px-2 py-2">
              <input
                type="checkbox" checked={allChecked}
                onChange={(e) => onToggleAll(rows.map((r) => r.id), e.target.checked)}
                aria-label="Tout sélectionner" className="h-4 w-4 rounded border-input"
              />
            </th>
            {ANNUAIRE_COLUMNS.map((c) => (
              <th
                key={c.field}
                className="whitespace-nowrap border border-border px-2 py-2 text-left font-medium"
                style={{ minWidth: `${c.width ?? 12}rem` }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={cn("hover:bg-secondary/20", selected.has(r.id) && "bg-primary/5")}>
              <td className="border border-border px-2 text-center">
                <input
                  type="checkbox" checked={selected.has(r.id)}
                  onChange={(e) => onToggle(r.id, e.target.checked)}
                  aria-label={`Sélectionner ${r.lastName ?? r.firstName ?? "cette ligne"}`}
                  className="h-4 w-4 rounded border-input"
                />
              </td>
              {ANNUAIRE_COLUMNS.map((c) => (
                <td
                  key={c.field}
                  className={cn("border border-border align-middle", c.field === "lastName" && "font-medium")}
                >
                  <Cell row={r} col={c} editable={editable} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnnuaireGrid({
  rows, canEdit, canImport, canDelete, specialties, directoryId, directoryName,
}: {
  rows: AnnuaireRow[]; canEdit: boolean; canImport: boolean; canDelete: boolean; specialties: string[];
  /**
   * L'ANNUAIRE OUVERT — `null` = l'annuaire général.
   *
   * Il MANQUAIT, et c'était tout le défaut : la grille ne savait pas dans quel annuaire elle
   * travaillait, l'import partait donc sans destination et atterrissait dans le général.
   */
  directoryId: string | null;
  directoryName: string;
}) {
  const router = useRouter();
  // SÉLECTION MULTIPLE — un annuaire se nettoie par lots (doublons d'import, cabinet fermé).
  // Ligne par ligne, personne ne le fait : on garde alors des fiches fausses, pire qu'absentes.
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
  const fileRef = React.useRef<HTMLInputElement>(null);
  // Le fichier lu, en attente que la correspondance soit tranchée.
  const [pending, setPending] = React.useState<
    { file: File; proposals: HeaderProposal[]; targets: TargetColumn[]; rowCount: number } | null
  >(null);

  // Chaque ligne, mise à plat une fois, pour une recherche qui porte sur ce qu'on VOIT
  // (« Professeur », « Alger », « Très haut »), pas sur les codes internes.
  const haystacks = React.useMemo(
    () => new Map(rows.map((r) => [r.id, normalizeHeader(ANNUAIRE_COLUMNS.map((c) => annuaireCell(r, c.field)).join(" "))])),
    [rows],
  );
  const needle = normalizeHeader(q);
  const filtered = needle ? rows.filter((r) => (haystacks.get(r.id) ?? "").includes(needle)) : rows;

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
            placeholder="Chercher un nom, une ville, une spécialité…"
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
          <a
            href="/api/medical/annuaire/export"
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

      {canImport && <AddDoctorRow specialtyListId={SPECIALTY_LIST_ID} />}

      {canImport && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Cliquez dans une cellule pour la corriger — la modification est enregistrée dès que vous
            quittez la cellule. Wilaya, grade, secteur et potentiel se choisissent dans un menu.
            L&apos;<strong>import</strong> accepte un fichier existant (les colonnes sont reconnues telles
            qu&apos;elles sont écrites) ; l&apos;<strong>export</strong> reprend exactement ces colonnes.
          </span>
        </p>
      )}

      {msg && (
        <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {msg.text}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="surface px-3 py-10 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "L'annuaire est vide. Ajoutez un praticien ci-dessus, ou importez un fichier existant."
            : "Aucun praticien ne correspond à cette recherche."}
        </div>
      ) : groups ? (
        <div className="space-y-5">
          {groups.map(([name, list]) => (
            <section key={name} className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                {name} <span className="text-xs font-normal text-muted-foreground">· {list.length}</span>
              </h3>
              <GridTable rows={list} editable={canEdit} selected={selected} onToggle={toggleOne} onToggleAll={toggleMany} />
            </section>
          ))}
        </div>
      ) : (
        <GridTable rows={filtered} editable={canEdit} selected={selected} onToggle={toggleOne} onToggleAll={toggleMany} />
      )}
    </div>
  );
}

/** La ligne d'ajout — un nom (ou prénom) suffit, le reste se remplit ensuite dans la feuille. */
function AddDoctorRow({ specialtyListId }: { specialtyListId: string }) {
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
    void addDirectoryDoctor({ lastName, firstName, specialty, wilaya }).then((r) => {
      setBusy(false);
      if (r.ok) { reset(); setOpen(false); router.refresh(); }
      else setErr(r.error ?? "Ajout impossible.");
    });
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Ajouter un praticien
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
