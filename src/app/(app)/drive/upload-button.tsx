"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UploadButton({ parentId, nodeId, label }: { parentId?: string | null; nodeId?: string; label?: string }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        if (nodeId) fd.append("nodeId", nodeId);
        else if (parentId) fd.append("parentId", parentId);
        const res = await fetch("/api/drive/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setErr(j.error ?? "Échec de l'envoi.");
          break;
        }
        if (nodeId) break; // une seule nouvelle version
      }
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <input ref={inputRef} type="file" multiple={!nodeId} hidden onChange={onChange} />
      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy} type="button">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {label ?? "Importer"}
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </span>
  );
}
