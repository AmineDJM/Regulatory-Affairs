"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";
import { askDossierAction } from "@/lib/regulatory/intelligence/knowledge/actions";
import type { ChatCitation } from "@/lib/regulatory/intelligence/knowledge/dossier-chat";

interface Msg { role: "user" | "assistant"; text: string; citations?: ChatCitation[]; error?: boolean }

const SUGGESTIONS = [
  "Quelle est la durée de conservation (stabilité) ?",
  "Quel est le dosage et la forme pharmaceutique ?",
  "Qui est le fabricant de la substance active ?",
  "Où est décrite la méthode de contrôle du produit fini ?",
];

/**
 * CHATBOT DE DOSSIER — pose des questions sur CE dossier ; chaque réponse s'appuie sur les documents
 * réellement lus et cite ses sources (fichier · section · page). L'assistant s'abstient si l'info n'y est pas.
 */
export function DossierChatPanel({ dossierId, configured, canView }: { dossierId: string; configured: boolean; canView: boolean }) {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    // Historique (avant d'ajouter la nouvelle question) — permet les questions de suivi (« et sa DCI ? »).
    const history = messages.filter((m) => !m.error).slice(-6).map((m) => ({ role: m.role, content: m.text }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("dossierId", dossierId);
      fd.set("question", q);
      fd.set("history", JSON.stringify(history));
      const r = await askDossierAction(fd);
      setMessages((m) => [...m, r.ok
        ? { role: "assistant", text: r.answer || "(réponse vide)", citations: r.citations }
        : { role: "assistant", text: r.error ?? "Réponse indisponible.", error: true }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Le service a rencontré une erreur. Réessayez.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  if (!canView) return null;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
      <div ref={scrollRef} className="max-h-[26rem] min-h-[8rem] space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              Posez une question sur ce dossier. Chaque réponse s'appuie sur les <strong>documents réellement lus</strong>{" "}
              et cite ses <strong>sources (fichier · section · page)</strong>. L'assistant <strong>s'abstient</strong> si
              l'information n'est pas dans le dossier — il n'invente rien.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => setInput(s)}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] transition-colors hover:bg-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.role === "user" ? "bg-primary text-primary-foreground"
                : m.error ? "border border-destructive/30 bg-destructive/5 text-destructive"
                : "border border-border/60 bg-background"}`}>
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              {m.citations && m.citations.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-border/40 pt-2">
                  {m.citations.map((c) => (
                    <li key={c.n} className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">[{c.n}] {c.filename}</span>
                      {c.ctdSection ? ` · ${c.ctdSection}` : ""}
                      {c.page ? ` · p.${c.page}` : ""}
                      <span className="mt-0.5 block truncate italic opacity-80" title={c.snippet}>« {c.snippet} »</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Recherche dans le dossier…
          </div>
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border/60 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={configured ? "Poser une question sur ce dossier…" : "Clé IA requise — les sources restent affichées"}
          aria-label="Question sur le dossier"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button type="submit" disabled={busy || !input.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="hidden sm:inline">Demander</span>
        </button>
      </form>
    </div>
  );
}
