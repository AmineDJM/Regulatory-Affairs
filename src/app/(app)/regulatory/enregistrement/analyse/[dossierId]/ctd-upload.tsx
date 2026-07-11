"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, FileArchive, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Summary { total: number; stored: number; blocked: number; suspicious: number; totalBytes: number }
type Phase = "idle" | "uploading" | "processing" | "done" | "error";

const humanSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.ceil(n / 1024))} Ko`);

/**
 * Envoi d'UNE partie via XHR : contrairement à `fetch`, XHR expose la **progression d'octets
 * en temps réel** (`upload.onprogress`) → la barre bouge dès les premiers octets, sans attendre
 * la fin de la partie. Délai de garde : une requête réellement bloquée échoue (→ retente).
 */
function putPartXhr(url: string, body: ArrayBuffer, onLoaded: (loaded: number) => void, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onLoaded(e.loaded); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `code ${xhr.status}`;
      try { msg = JSON.parse(xhr.responseText)?.error ?? msg; } catch { /* corps non-JSON */ }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("réseau"));
    xhr.ontimeout = () => reject(new Error("délai dépassé"));
    xhr.send(body);
  });
}

/**
 * Téléversement d'un dossier CTD en **ZIP** vers la route d'ingestion sécurisée.
 * Progression réelle (XHR), puis restitution du **manifeste de sécurité** (conservés /
 * bloqués / suspects). L'archive originale est figée ; chaque fichier sain est stocké chiffré.
 */
export function CtdUpload({ dossierId }: { dossierId: string }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);

  // Seuil « petit fichier » : en-deçà, route directe ; au-delà, upload résumable par parties.
  const SMALL_THRESHOLD = 12 * 1048576;

  function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) {
      setPhase("error");
      setError("Le dossier CTD doit être un fichier ZIP (.zip).");
      return;
    }
    if (file.size > SMALL_THRESHOLD) sendResumable(file);
    else send(file);
  }

  /**
   * Upload RÉSUMABLE (G14) pour gros fichiers : ouvre une session, envoie le fichier par
   * PARTIES en PARALLÈLE (pool borné → on remplit le tuyau au lieu d'un aller-retour à la
   * fois), avec retente par partie, puis finalise (vérif taille côté serveur + ingestion).
   * Chaque tranche n'est lue qu'au moment de son envoi → le navigateur ne charge jamais
   * l'archive entière (pic mémoire ≈ CONCURRENCY × taille de partie).
   */
  // Concurrence alignée sur le pool de connexions DB (défaut Prisma souvent = 3 sur 1 CPU) :
  // 3 parties en parallèle remplissent le lien sans épuiser le pool → plus de 500. Chaque partie
  // ne fait qu'un seul upsert côté serveur. (Relevez le pool DB — connection_limit — pour + de //).
  const UPLOAD_CONCURRENCY = 3;

  async function sendResumable(file: File) {
    setPhase("uploading"); setProgress(0); setError(null); setSummary(null); setFileName(file.name);
    let cleanupSessionId: string | null = null;
    try {
      // Ouverture de session avec délai de garde → jamais bloqué à 0 % si le serveur ne répond pas.
      const ctrl = new AbortController();
      const openTimer = setTimeout(() => ctrl.abort(), 30_000);
      let open: Response;
      try {
        open = await fetch("/api/regulatory/intelligence/upload/session", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ dossierId, filename: file.name, totalBytes: file.size, contentType: file.type }),
          signal: ctrl.signal,
        });
      } catch {
        throw new Error("Ouverture de session : serveur injoignable ou trop lent (30 s).");
      } finally { clearTimeout(openTimer); }
      const meta = await open.json();
      if (!open.ok) throw new Error(meta.error ?? "Ouverture de session refusée.");
      const { sessionId, partSize, expectedParts } = meta as { sessionId: string; partSize: number; expectedParts: number };
      cleanupSessionId = sessionId; // à libérer si l'envoi échoue → pas de session fantôme

      // Progression RÉELLE au niveau octet, agrégée sur toutes les parties en vol → la barre
      // avance dès les premiers octets (plus d'attente « 0 % » jusqu'à la fin d'une partie).
      const loaded = new Array<number>(expectedParts).fill(0);
      const refresh = () => {
        const sum = loaded.reduce((a, b) => a + b, 0);
        setProgress(Math.min(99, Math.round((sum / file.size) * 100))); // 100 % réservé à la fin réelle
      };

      let cursor = 0;
      let aborted = false;

      const putPart = async (i: number): Promise<void> => {
        const slice = file.slice(i * partSize, Math.min((i + 1) * partSize, file.size));
        const buf = await slice.arrayBuffer();
        let lastErr = "";
        for (let attempt = 0; attempt < 4; attempt++) {
          if (aborted) return;
          try {
            await putPartXhr(
              `/api/regulatory/intelligence/upload/session/${sessionId}/part?index=${i}`,
              buf, (l) => { loaded[i] = l; refresh(); }, 120_000,
            );
            loaded[i] = buf.byteLength; refresh();
            return;
          } catch (e) {
            loaded[i] = 0; refresh(); // une tentative échouée ne compte pas
            lastErr = e instanceof Error ? e.message : "échec";
            if (!aborted) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          }
        }
        throw new Error(`Échec de la partie ${i + 1}/${expectedParts} (${lastErr}).`);
      };

      // Pool de workers : chacun tire la prochaine partie libre jusqu'à épuisement.
      const worker = async (): Promise<void> => {
        while (!aborted) {
          const i = cursor++;
          if (i >= expectedParts) return;
          await putPart(i);
        }
      };
      try {
        await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, expectedParts) }, () => worker()));
      } catch (e) {
        aborted = true; // stoppe les workers restants au plus tôt
        throw e;
      }
      setProgress(100);

      setPhase("processing");
      const fin = await fetch(`/api/regulatory/intelligence/upload/session/${sessionId}/finalize`, { method: "POST" });
      const data = await fin.json();
      if (!fin.ok || !data.ok) throw new Error(data.error ?? "Finalisation refusée.");
      setPhase("done"); setSummary(data.summary ?? null);
      fetch("/api/regulatory/intelligence/process", { method: "POST" }).catch(() => undefined).finally(() => router.refresh());
      router.refresh();
    } catch (e) {
      // Best-effort : libère la session pour ne pas bloquer les envois suivants (« trop d'envois »).
      if (cleanupSessionId) void fetch(`/api/regulatory/intelligence/upload/session/${cleanupSessionId}`, { method: "DELETE" }).catch(() => undefined);
      setPhase("error"); setError(e instanceof Error ? e.message : "Échec du téléversement résumable.");
    }
  }

  function send(file: File) {
    setPhase("uploading");
    setProgress(0);
    setError(null);
    setSummary(null);
    setFileName(file.name);

    const fd = new FormData();
    fd.set("dossierId", dossierId);
    fd.append("file", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/regulatory/intelligence/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => setPhase("processing"); // octets envoyés → inspection serveur
    xhr.onload = () => {
      let data: { ok?: boolean; error?: string; summary?: Summary } = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
        setPhase("done");
        setSummary(data.summary ?? null);
        // Lance l'extraction sans attendre le planificateur (filet de sécurité ≤ 1 min).
        fetch("/api/regulatory/intelligence/process", { method: "POST" })
          .catch(() => undefined)
          .finally(() => router.refresh());
        router.refresh();
      } else {
        setPhase("error");
        setError(data.error ?? `Échec du téléversement (code ${xhr.status}).`);
      }
    };
    xhr.onerror = () => { setPhase("error"); setError("Réseau indisponible pendant le téléversement."); };
    xhr.send(fd);
  }

  const busy = phase === "uploading" || phase === "processing";

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!busy) pick(e.dataTransfer.files); }}
        className={cn(
          "rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragOver ? "border-primary bg-accent/50" : "border-border bg-muted/30",
          busy && "opacity-70",
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <FileArchive className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Déposez l'archive CTD (.zip) ici, ou :</p>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            <UploadCloud className="h-4 w-4" /> Choisir un fichier ZIP
          </Button>
          <p className="text-xs text-muted-foreground">
            Décompression sécurisée · chaque fichier lu &amp; conservé chiffré · archive originale figée
          </p>
        </div>
        <input ref={inputRef} type="file" accept=".zip,application/zip" hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
      </div>

      {busy && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {phase === "uploading" ? `Téléversement de ${fileName}…` : "Inspection & extraction sécurisées…"}
            </span>
            {phase === "uploading" && <span>{progress}%</span>}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: phase === "processing" ? "100%" : `${progress}%` }}
            />
          </div>
        </div>
      )}

      {phase === "error" && error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {phase === "done" && summary && (
        <div className="space-y-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-success">
            <CheckCircle2 className="h-4 w-4" /> Dossier ingéré — {summary.stored} fichier·s conservé·s ({humanSize(summary.totalBytes)}).
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-success"><ShieldCheck className="h-3.5 w-3.5" /> {summary.stored} sain·s</span>
            {summary.suspicious > 0 && <span className="inline-flex items-center gap-1 text-amber-600"><ShieldAlert className="h-3.5 w-3.5" /> {summary.suspicious} à vérifier</span>}
            {summary.blocked > 0 && <span className="inline-flex items-center gap-1 text-destructive"><ShieldAlert className="h-3.5 w-3.5" /> {summary.blocked} bloqué·s</span>}
          </div>
        </div>
      )}
    </div>
  );
}
