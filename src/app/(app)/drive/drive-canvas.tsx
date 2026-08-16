"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, FileText, FileSpreadsheet, Presentation, RefreshCw, Loader2 } from "lucide-react";
import { createFolder, createOfficeNode } from "@/lib/actions/drive-actions";

type NewKind = "folder" | "word" | "cell" | "slide";

const ITEMS: { kind: NewKind; label: string; icon: React.ElementType; suffix?: string }[] = [
  { kind: "folder", label: "Dossier", icon: FolderPlus },
  { kind: "word", label: "Document Word", icon: FileText, suffix: ".docx" },
  { kind: "cell", label: "Classeur Excel", icon: FileSpreadsheet, suffix: ".xlsx" },
  { kind: "slide", label: "Présentation PowerPoint", icon: Presentation, suffix: ".pptx" },
];

/**
 * LE CLIC DROIT — « Nouveau ▸ Dossier ».
 *
 * C'est le geste par lequel on crée quelque chose dans un explorateur de fichiers. Pas un bouton
 * en haut de page : un clic droit là où l'on veut que la chose apparaisse. Les boutons de l'en-tête
 * restent (ils se voient, et on ne devine pas un menu contextuel), mais qui connaît l'explorateur
 * Windows essaiera le clic droit d'abord — et il faut que ça marche.
 *
 * Le nom se saisit **dans le menu**, comme la case de renommage qui s'ouvre sous l'icône fraîchement
 * créée. Ouvrir un panneau latéral pour trois caractères casse le geste.
 *
 * On n'intercepte pas le clic droit sur un lien ou un bouton : sur un fichier, le menu du
 * navigateur (« copier l'adresse du lien ») rend un vrai service, et la ligne a déjà ses actions.
 */
export function DriveCanvas({
  parentId, spaceId, canCreate, officeEnabled, children,
}: {
  parentId: string | null;
  spaceId?: string | null;
  canCreate: boolean;
  officeEnabled: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null);
  const [naming, setNaming] = React.useState<NewKind | null>(null);
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const close = React.useCallback(() => { setMenu(null); setNaming(null); setValue(""); setErr(null); }, []);

  React.useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onScroll = () => close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("scroll", onScroll, true); };
  }, [menu, close]);

  React.useEffect(() => { if (naming) inputRef.current?.focus(); }, [naming]);

  const onContextMenu = (e: React.MouseEvent) => {
    if (!canCreate) return;
    const t = e.target as HTMLElement;
    if (t.closest("a,button,input,select,textarea")) return; // le menu du navigateur sert, ici
    e.preventDefault();
    // Le menu mesure ~15 rem de large et ~12 rem de haut : on le recale pour qu'il tienne à l'écran.
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 260), y: Math.min(e.clientY, window.innerHeight - 220) });
    setNaming(null); setValue(""); setErr(null);
  };

  const start = (kind: NewKind) => {
    setNaming(kind);
    setValue(kind === "folder" ? "Nouveau dossier" : "Sans titre");
    setErr(null);
    window.setTimeout(() => inputRef.current?.select(), 0);
  };

  const submit = async () => {
    if (!naming || busy) return;
    const name = value.trim();
    if (!name) { setErr("Donnez un nom."); return; }
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("name", name);
    if (parentId) fd.set("parentId", parentId);
    if (spaceId) fd.set("spaceId", spaceId);
    const r = naming === "folder"
      ? await createFolder(undefined, fd)
      : await (async () => { fd.set("kind", naming); return createOfficeNode(fd); })();
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Création impossible."); return; }
    close();
    if (naming !== "folder" && officeEnabled && r.id) router.push(`/drive/${r.id}/edit`);
    else router.refresh();
  };

  return (
    <div onContextMenu={onContextMenu} className="min-h-[16rem]">
      {children}

      {menu && (
        <>
          {/* Voile transparent : un clic n'importe où referme, comme partout ailleurs. */}
          <div className="fixed inset-0 z-40" onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
          <div
            role="menu"
            style={{ top: menu.y, left: menu.x }}
            className="fixed z-50 w-64 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
          >
            {naming ? (
              <div className="space-y-2 p-2">
                <p className="px-1 text-xs font-medium text-muted-foreground">
                  Nom {ITEMS.find((i) => i.kind === naming)?.suffix ? `(${ITEMS.find((i) => i.kind === naming)!.suffix} ajouté)` : ""}
                </p>
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); void submit(); }
                    if (e.key === "Escape") { e.preventDefault(); close(); }
                  }}
                  className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                />
                {err && <p className="px-1 text-xs text-destructive">{err}</p>}
                <div className="flex justify-end gap-2 px-1 pb-1">
                  <button type="button" onClick={close} className="text-xs text-muted-foreground hover:text-foreground">Annuler</button>
                  <button
                    type="button" onClick={() => void submit()} disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-3 w-3 animate-spin" />} Créer
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="px-3 py-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Nouveau</p>
                {ITEMS.map((it) => (
                  <button
                    key={it.kind} type="button" role="menuitem" onClick={() => start(it.kind)}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-secondary"
                  >
                    <it.icon className="h-4 w-4 shrink-0 text-muted-foreground" /> {it.label}
                  </button>
                ))}
                <div className="my-1 border-t border-border" />
                <button
                  type="button" role="menuitem" onClick={() => { close(); router.refresh(); }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-secondary"
                >
                  <RefreshCw className="h-4 w-4 shrink-0 text-muted-foreground" /> Actualiser
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
