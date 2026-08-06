"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, X, ChevronDown } from "lucide-react";

/**
 * GESTIONNAIRE D'ENVOIS GÉNÉRIQUE, GLOBAL — n'importe quel téléversement de la plateforme
 * (Documents, Drive, …) est confié à ce provider, monté dans la mise en page de l'app. L'envoi
 * continue EN ARRIÈRE-PLAN : l'utilisateur peut changer de module, naviguer, travailler ailleurs
 * — les fichiers montent en parallèle et une pastille flottante montre la progression partout.
 * Chaque fichier est un POST indépendant avec progression réelle (XHR) et RETENTE (réseau / 5xx /
 * 429 avec backoff). À la fin d'un lot, la vue courante est rafraîchie.
 *
 * (Le dossier CTD garde son propre moteur résumable par parties — voir upload-manager.tsx.)
 */

type FileStatus = "pending" | "uploading" | "done" | "error";
interface BgFile { name: string; size: number; status: FileStatus; progress: number; error?: string }
interface BgJob { id: string; label: string; files: BgFile[]; phase: "uploading" | "done" | "error"; spec: EnqueueSpec }

/** Spécification d'un envoi : un libellé, des fichiers, et comment poster CHAQUE fichier. */
export interface EnqueueSpec {
  label: string;
  files: File[];
  /** Construit la requête (URL + FormData) pour un fichier donné. */
  makeRequest: (file: File) => { url: string; formData: FormData };
  concurrency?: number;
}

interface Ctx { enqueue: (spec: EnqueueSpec) => void }
const BgUploadContext = React.createContext<Ctx | null>(null);

/** Accès au gestionnaire d'envois générique (démarrer un envoi en arrière-plan). */
export function useBackgroundUpload(): Ctx {
  const ctx = React.useContext(BgUploadContext);
  if (!ctx) throw new Error("useBackgroundUpload doit être utilisé dans <BackgroundUploadProvider>.");
  return ctx;
}

const humanSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.ceil(n / 1024))} Ko`);

/** POST d'un FormData avec progression d'upload réelle ; ne rejette jamais. */
function postFormXhr(url: string, formData: FormData, onProgress: (frac: number) => void, timeoutMs: number): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* corps non-JSON */ }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, body: {} });
    xhr.ontimeout = () => resolve({ ok: false, status: 0, body: {} });
    xhr.send(formData);
  });
}

export function BackgroundUploadProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [jobs, setJobs] = React.useState<BgJob[]>([]);

  const patchFile = React.useCallback((jobId: string, idx: number, p: Partial<BgFile>) => {
    setJobs((js) => js.map((j) => (j.id === jobId ? { ...j, files: j.files.map((f, i) => (i === idx ? { ...f, ...p } : f)) } : j)));
  }, []);
  const patchJob = React.useCallback((jobId: string, p: Partial<BgJob>) => {
    setJobs((js) => js.map((j) => (j.id === jobId ? { ...j, ...p } : j)));
  }, []);
  const dismiss = React.useCallback((jobId: string) => setJobs((js) => js.filter((j) => j.id !== jobId)), []);

  // Lance (ou relance) l'envoi des fichiers du lot dont l'index est dans `indices`.
  const runJob = React.useCallback(async (jobId: string, spec: EnqueueSpec, indices: number[]) => {
    const uploadOne = async (idx: number): Promise<void> => {
      const file = spec.files[idx];
      patchFile(jobId, idx, { status: "uploading", progress: 0, error: undefined });
      const { url, formData } = spec.makeRequest(file);
      const attempts = 5;
      for (let attempt = 0; attempt < attempts; attempt++) {
        const r = await postFormXhr(url, formData, (frac) => patchFile(jobId, idx, { progress: Math.round(frac * 100) }), 20 * 60_000);
        if (r.ok && (r.body.ok ?? true)) { patchFile(jobId, idx, { status: "done", progress: 100 }); return; }
        const retryable = r.status === 0 || r.status >= 500 || r.status === 429;
        const errs = r.body.errors as { error?: string }[] | undefined;
        const msg = errs?.[0]?.error ?? (r.body.error as string | undefined) ?? (r.status === 0 ? "Réseau indisponible." : `Échec (code ${r.status}).`);
        if (!retryable || attempt === attempts - 1) { patchFile(jobId, idx, { status: "error", progress: 0, error: msg }); return; }
        await new Promise((res) => setTimeout(res, 500 * 2 ** attempt)); // backoff : 0,5 → 1 → 2 → 4 s
      }
    };

    // Concurrence bornée : plusieurs fichiers montent en parallèle.
    const pool = Math.max(1, Math.min(spec.concurrency ?? 4, indices.length));
    let cursor = 0;
    const worker = async () => { while (cursor < indices.length) { const i = cursor++; await uploadOne(indices[i]); } };
    await Promise.all(Array.from({ length: pool }, () => worker()));

    // État final du lot + rafraîchissement de la vue courante.
    setJobs((js) => js.map((j) => (j.id === jobId ? { ...j, phase: j.files.some((f) => f.status === "error") ? "error" : "done" } : j)));
    router.refresh();
  }, [patchFile, router]);

  const enqueue = React.useCallback((spec: EnqueueSpec) => {
    const files = spec.files.filter((f) => f.size > 0);
    if (files.length === 0) return;
    const id = `bg${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const fullSpec = { ...spec, files };
    setJobs((js) => [...js, { id, label: spec.label, phase: "uploading", spec: fullSpec, files: files.map((f) => ({ name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, size: f.size, status: "pending", progress: 0 })) }]);
    void runJob(id, fullSpec, files.map((_, i) => i));
  }, [runJob]);

  // RÉESSAYER les fichiers en échec d'un lot, sans perdre la file (bouton du widget).
  const retryFailed = React.useCallback((jobId: string) => {
    setJobs((js) => js.map((j) => {
      if (j.id !== jobId) return j;
      const failed = j.files.map((f, i) => (f.status === "error" ? i : -1)).filter((i) => i >= 0);
      if (failed.length === 0) return j;
      void runJob(jobId, j.spec, failed);
      return { ...j, phase: "uploading", files: j.files.map((f) => (f.status === "error" ? { ...f, status: "pending" as FileStatus, error: undefined } : f)) };
    }));
  }, [runJob]);

  // Avertit avant de fermer l'onglet tant qu'un envoi est en cours.
  React.useEffect(() => {
    const active = jobs.some((j) => j.phase === "uploading");
    if (!active) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [jobs]);

  const value = React.useMemo(() => ({ enqueue }), [enqueue]);
  return (
    <BgUploadContext.Provider value={value}>
      {children}
      <BgUploadWidget jobs={jobs} onDismiss={dismiss} onRetry={retryFailed} />
    </BgUploadContext.Provider>
  );
}

/**
 * Pastille flottante des téléversements — **déplaçable** (glisser l'en-tête) partout à l'écran et
 * **réductible** en une petite bulle (bouton −). Un bouton **Réessayer** relance les fichiers en
 * échec sans perdre la file. Position par défaut : bas-gauche (n'écrase ni l'assistant ni le CTD).
 */
function BgUploadWidget({ jobs, onDismiss, onRetry }: { jobs: BgJob[]; onDismiss: (id: string) => void; onRetry: (id: string) => void }) {
  const [minimized, setMinimized] = React.useState(false);
  // Position libre (coin haut-gauche du widget). `null` = ancrage par défaut en bas-gauche.
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const drag = React.useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    // On ne démarre pas le glissement depuis un bouton (réduire, masquer…).
    if ((e.target as HTMLElement).closest("button")) return;
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const w = 320, margin = 8;
    const x = Math.min(Math.max(margin, e.clientX - drag.current.dx), window.innerWidth - w - margin);
    const y = Math.min(Math.max(margin, e.clientY - drag.current.dy), window.innerHeight - 56 - margin);
    setPos({ x, y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  if (jobs.length === 0) return null;
  const active = jobs.filter((j) => j.phase === "uploading").length;
  const anyFailed = jobs.some((j) => j.phase === "error");
  const style: React.CSSProperties = pos ? { left: pos.x, top: pos.y } : { left: 16, bottom: 96 };

  // ── Réduit : petite bulle déplaçable (clic pour rouvrir) ──
  if (minimized) {
    return (
      <div className="fixed z-40" style={style}>
        <button type="button" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onClick={() => { if (!drag.current) setMinimized(false); }}
          className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium shadow-lg hover:bg-muted/60"
          title="Ouvrir les téléversements">
          {active > 0 ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : anyFailed ? <AlertCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
          <span>{active > 0 ? `Envoi (${active})` : anyFailed ? "Échecs" : "Terminé"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed z-40 w-[min(92vw,20rem)]" style={style}>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          className="flex cursor-grab touch-none select-none items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground active:cursor-grabbing">
          <span className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-primary" />
            {active > 0 ? `Téléversement en cours (${active})` : "Téléversements"}
          </span>
          <span className="flex items-center gap-0.5">
            <button type="button" onClick={() => setMinimized(true)} className="rounded p-0.5 text-muted-foreground hover:bg-muted" aria-label="Réduire"><ChevronDown className="h-4 w-4" /></button>
          </span>
        </div>
        <ul className="max-h-[40vh] divide-y divide-border overflow-y-auto">
          {jobs.map((j) => {
            const done = j.files.filter((f) => f.status === "done").length;
            const failed = j.files.filter((f) => f.status === "error").length;
            const firstErr = j.files.find((f) => f.status === "error")?.error;
            const pct = Math.round((j.files.reduce((a, f) => a + (f.status === "done" ? 100 : f.progress), 0) / (j.files.length * 100)) * 100);
            return (
              <li key={j.id} className="px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {j.phase === "uploading" ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                      : j.phase === "done" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                      : <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                    <span className="truncate text-foreground" title={j.label}>{j.label}</span>
                  </span>
                  {j.phase !== "uploading" && (
                    <button type="button" onClick={() => onDismiss(j.id)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted" aria-label="Masquer"><X className="h-3.5 w-3.5" /></button>
                  )}
                </div>
                {j.phase === "uploading" && (
                  <div className="mt-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground"><span>{done}/{j.files.length} fichier·s</span><span>{pct}%</span></div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
                  </div>
                )}
                {j.phase === "done" && <p className="mt-1 text-xs text-success">{done} fichier·s téléversé·s{failed > 0 ? `, ${failed} en échec` : ""}.</p>}
                {j.phase === "error" && (
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-destructive">{done} réussi·s, {failed} en échec.</p>
                      <button type="button" onClick={() => onRetry(j.id)} className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted">Réessayer</button>
                    </div>
                    {firstErr && <p className="rounded bg-destructive/10 px-2 py-1 text-[0.6875rem] leading-snug text-destructive" title={firstErr}>{firstErr}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
