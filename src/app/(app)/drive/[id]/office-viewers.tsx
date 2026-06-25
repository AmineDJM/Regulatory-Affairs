"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";

/** Récupère les octets déchiffrés du fichier (route /raw, inline). */
function useRawBuffer(src: string) {
  const [buf, setBuf] = React.useState<ArrayBuffer | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    fetch(src)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
      .then((b) => { if (alive) setBuf(b); })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, [src]);
  return { buf, err };
}

function Loading() {
  return <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement de l'aperçu…</div>;
}

function Fallback({ src, message }: { src: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <a href={`${src}?dl=1`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
        <Download className="h-4 w-4" /> Télécharger
      </a>
    </div>
  );
}

const SHELL = "max-h-[78vh] overflow-auto rounded-lg border border-border bg-white p-5 text-sm text-neutral-900";

/** Word (.docx) → HTML via mammoth (chargé à la demande). */
export function DocxView({ src }: { src: string; name: string }) {
  const { buf, err } = useRawBuffer(src);
  const [html, setHtml] = React.useState<string | null>(null);
  const [perr, setPerr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!buf) return;
    let alive = true;
    import("mammoth")
      .then((m) => m.convertToHtml({ arrayBuffer: buf }))
      .then((res) => { if (alive) setHtml(res.value || "<p><em>Document vide.</em></p>"); })
      .catch((e) => { if (alive) setPerr(String(e)); });
    return () => { alive = false; };
  }, [buf]);

  if (err || perr) return <Fallback src={src} message="Aperçu Word indisponible pour ce fichier." />;
  if (!html) return <Loading />;
  return (
    <div
      className={`${SHELL} leading-relaxed [&_a]:text-primary [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_img]:max-w-full [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2 [&_table]:my-3 [&_table]:border-collapse [&_td]:border [&_td]:border-neutral-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-neutral-300 [&_th]:bg-neutral-100 [&_th]:px-2 [&_th]:py-1`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Excel (.xlsx/.xls/.csv) → tableaux HTML via SheetJS (chargé à la demande). */
export function XlsxView({ src }: { src: string; name: string }) {
  const { buf, err } = useRawBuffer(src);
  const [sheets, setSheets] = React.useState<{ name: string; html: string }[] | null>(null);
  const [perr, setPerr] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    if (!buf) return;
    let alive = true;
    import("xlsx")
      .then((XLSX) => {
        const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
        return wb.SheetNames.map((name) => ({ name, html: XLSX.utils.sheet_to_html(wb.Sheets[name]) }));
      })
      .then((s) => { if (alive) setSheets(s.length ? s : [{ name: "Feuille", html: "<p>Vide</p>" }]); })
      .catch((e) => { if (alive) setPerr(String(e)); });
    return () => { alive = false; };
  }, [buf]);

  if (err || perr) return <Fallback src={src} message="Aperçu Excel indisponible pour ce fichier." />;
  if (!sheets) return <Loading />;
  return (
    <div className="space-y-2">
      {sheets.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {sheets.map((s, i) => (
            <button key={s.name} onClick={() => setActive(i)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${i === active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>{s.name}</button>
          ))}
        </div>
      )}
      <div
        className={`${SHELL} [&_table]:border-collapse [&_td]:whitespace-nowrap [&_td]:border [&_td]:border-neutral-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-neutral-300 [&_th]:px-2 [&_th]:py-1`}
        dangerouslySetInnerHTML={{ __html: sheets[active].html }}
      />
    </div>
  );
}

/** PowerPoint (.pptx) → texte des diapositives extrait via JSZip (chargé à la demande). */
export function PptxView({ src }: { src: string; name: string }) {
  const { buf, err } = useRawBuffer(src);
  const [slides, setSlides] = React.useState<string[][] | null>(null);
  const [perr, setPerr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!buf) return;
    let alive = true;
    import("jszip")
      .then((mod) => mod.default.loadAsync(buf))
      .then(async (zip) => {
        const names = Object.keys(zip.files)
          .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
          .sort((a, b) => (parseInt(a.match(/(\d+)/)![1]) - parseInt(b.match(/(\d+)/)![1])));
        const parser = new DOMParser();
        const out: string[][] = [];
        for (const n of names) {
          const xml = await zip.files[n].async("string");
          const doc = parser.parseFromString(xml, "application/xml");
          const texts = Array.from(doc.getElementsByTagName("a:t")).map((t) => t.textContent ?? "").filter((t) => t.trim());
          out.push(texts);
        }
        return out;
      })
      .then((s) => { if (alive) setSlides(s); })
      .catch((e) => { if (alive) setPerr(String(e)); });
    return () => { alive = false; };
  }, [buf]);

  if (err || perr) return <Fallback src={src} message="Aperçu PowerPoint indisponible pour ce fichier." />;
  if (!slides) return <Loading />;
  if (slides.length === 0) return <Fallback src={src} message="Aucune diapositive détectée." />;
  return (
    <div className="max-h-[78vh] space-y-3 overflow-auto">
      <p className="text-xs text-muted-foreground">Aperçu texte des {slides.length} diapositive{slides.length > 1 ? "s" : ""}. Téléchargez le fichier pour la mise en page complète.</p>
      {slides.map((texts, i) => (
        <div key={i} className="rounded-lg border border-border bg-white p-4 text-neutral-900">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diapositive {i + 1}</p>
          {texts.length === 0 ? (
            <p className="text-sm text-muted-foreground">(Aucun texte)</p>
          ) : (
            <div className="space-y-1">
              {texts.map((t, j) => <p key={j} className={j === 0 ? "font-semibold" : "text-sm"}>{t}</p>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
