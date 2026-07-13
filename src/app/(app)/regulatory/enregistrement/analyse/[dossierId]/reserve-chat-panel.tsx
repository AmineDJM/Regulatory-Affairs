"use client";

import * as React from "react";
import { Loader2, Send, ShieldQuestion } from "lucide-react";
import { askReservesAction } from "@/lib/regulatory/intelligence/knowledge/actions";
import type { ChatCitation } from "@/lib/regulatory/intelligence/knowledge/dossier-chat";

interface Msg { role: "user" | "assistant"; text: string; citations?: ChatCitation[]; error?: boolean }

const SUGGESTIONS = [
  "Rédige une réponse au point 1",
  "Comment répondre à la réserve sur la stabilité ?",
  "Quels éléments manquent pour lever ces réserves ?",
  "Quelles données faut-il demander au fournisseur ?",
];

/**
 * « Discuter avec les réserves » — rédige/discute des réponses EXIGEANTES aux réserves ANPP,
 * sourcées et dans le périmètre technique (abstention prix/commercial ; renvoi fournisseur si une
 * donnée manque). Rendu en texte brut ; sources citées (fichier · section · page).
 */
export function ReserveChatPanel({ dossierId, configured }: { dossierId: string; configured: boolean }) {
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
    const history = messages.filter((m) => !m.error).slice(-6).map((m) => ({ role: m.role, content: m.text }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("dossierId", dossierId);
      fd.set("question", q);
      fd.set("history", JSON.stringify(history));
      const r = await askReservesAction(fd);
      setMessages((m) => [...m, r.ok
        ? { role: "assistant", text: r.answer || "(réponse vide)", citations: r.citations }
        : { role: "assistant", text: r.error ?? "Réponse indisponible.", error: true }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Le service a rencontré une erreur. Réessayez.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
      <div ref={scrollRef} className="max-h-[26rem] min-h-[6rem] space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="flex items-start gap-1.5">
              <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Rédigez ou discutez des <strong>réponses aux réserves</strong>. L'assistant reste
                <strong> exigeant et sourcé</strong>, <strong>s'abstient</strong> sur le prix / le commercial,
                et <strong>signale</strong> ce qu'il faut <strong>demander au fournisseur</strong> — il n'invente rien.
              </span>
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
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyse des réserves…
          </div>
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border/60 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={configured ? "Discuter des réponses aux réserves…" : "Clé IA requise — les points restent affichés"}
          aria-label="Question sur les réserves"
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
