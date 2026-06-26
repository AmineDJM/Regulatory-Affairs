"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles, Send, Loader2, Bot, CheckCircle2, AlertTriangle, KeyRound,
  Search, ArrowRight, X, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { assistantChat, executeAssistantAction } from "@/lib/actions/assistant-actions";
import type { ProposedAction, AssistantActionPayload, ChatTurn } from "@/lib/assistant";

type ActionState = "pending" | "running" | "done" | "cancelled" | "error";

interface Msg {
  id: number;
  role: "user" | "assistant";
  content: string;
  trace?: string[];
  proposal?: ProposedAction;
  actionState?: ActionState;
  actionResult?: string;
  actionLink?: string;
}

const SUGGESTIONS = [
  "Où en suis-je ? Résume mon espace de travail.",
  "Crée une tâche : préparer le dossier AMM pour vendredi.",
  "Demande à l'assistante de direction un billet Alger → Paris du 12 au 14 mars.",
  "Quels sont mes médecins à fort potentiel ?",
];

let counter = 1;
const nextId = () => counter++;

export function AssistantChat({ userName, configured }: { userName: string; configured: boolean }) {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending || !configured) return;
    const userMsg: Msg = { id: nextId(), role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);
    const history: ChatTurn[] = next
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));
    try {
      const res = await assistantChat(history);
      if (!res.configured) {
        setMessages((m) => [...m, { id: nextId(), role: "assistant", content: "IA non configurée." }]);
      } else if (res.ok) {
        setMessages((m) => [...m, {
          id: nextId(), role: "assistant", content: res.reply, trace: res.trace,
          proposal: res.proposal, actionState: res.proposal ? "pending" : undefined,
        }]);
      } else {
        setMessages((m) => [...m, { id: nextId(), role: "assistant", content: res.error ?? "Une erreur est survenue." }]);
      }
    } catch {
      setMessages((m) => [...m, { id: nextId(), role: "assistant", content: "Appel à l'assistant impossible." }]);
    } finally {
      setSending(false);
      taRef.current?.focus();
    }
  };

  const confirm = async (msgId: number, payload: AssistantActionPayload) => {
    setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, actionState: "running" } : x)));
    try {
      const r = await executeAssistantAction(payload);
      setMessages((m) => m.map((x) =>
        x.id === msgId
          ? { ...x, actionState: r.ok ? "done" : "error", actionResult: r.ok ? r.message : r.error, actionLink: r.link }
          : x,
      ));
    } catch {
      setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, actionState: "error", actionResult: "Exécution impossible." } : x)));
    }
  };

  const cancel = (msgId: number) => {
    setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, actionState: "cancelled" } : x)));
  };

  return (
    <div className="surface flex min-h-0 flex-1 flex-col overflow-hidden">
      {!configured && (
        <div className="flex items-start gap-2 border-b border-border bg-warning/10 px-4 py-2.5 text-sm text-warning">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <span>IA non configurée. Ajoutez la clé <code className="font-mono">ANTHROPIC_API_KEY</code> dans Render (Settings → Environment) pour activer l'assistant.</span>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-500 text-primary-foreground shadow-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold">Bonjour {userName.split(" ")[0]} 👋</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Posez une question sur votre travail, ou demandez-moi de préparer une action.
              Je m'appuie sur vos données (selon vos droits) et chaque action vous est soumise pour confirmation.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={!configured}
                  className="group flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm transition hover:border-primary/50 hover:bg-secondary/50 disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1">{s}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} msg={m} onConfirm={confirm} onCancel={cancel} />
          ))
        )}
        {sending && (
          <div className="flex items-center gap-2.5">
            <Avatar />
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> L'assistant réfléchit…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-card/60 p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={configured ? "Écrivez votre demande…  (Entrée pour envoyer, Maj+Entrée pour un retour à la ligne)" : "Assistant indisponible — clé IA manquante."}
            disabled={!configured || sending}
            rows={1}
            className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
          <Button type="submit" size="lg" disabled={!configured || sending || !input.trim()} className="h-[2.75rem] px-4">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500 text-primary-foreground">
      <Bot className="h-4 w-4" />
    </div>
  );
}

function MessageBubble({
  msg, onConfirm, onCancel,
}: {
  msg: Msg;
  onConfirm: (id: number, payload: AssistantActionPayload) => void;
  onCancel: (id: number) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <Avatar />
      <div className="min-w-0 max-w-[85%] space-y-2">
        {msg.trace && msg.trace.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.trace.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                <Search className="h-3 w-3" /> {t}
              </span>
            ))}
          </div>
        )}
        {msg.content && (
          <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-secondary px-4 py-2.5 text-sm leading-relaxed">
            {msg.content}
          </div>
        )}
        {msg.proposal && (
          <ActionCard
            proposal={msg.proposal}
            state={msg.actionState ?? "pending"}
            result={msg.actionResult}
            link={msg.actionLink}
            onConfirm={() => onConfirm(msg.id, msg.proposal!.payload)}
            onCancel={() => onCancel(msg.id)}
          />
        )}
      </div>
    </div>
  );
}

function ActionCard({
  proposal, state, result, link, onConfirm, onCancel,
}: {
  proposal: ProposedAction;
  state: ActionState;
  result?: string;
  link?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-accent/40 to-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{proposal.title}</span>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">À confirmer</span>
      </div>

      <dl className="divide-y divide-border/50">
        {proposal.fields.map((f) => (
          <div key={f.label} className="flex gap-3 px-4 py-2 text-sm">
            <dt className="w-28 shrink-0 text-muted-foreground">{f.label}</dt>
            <dd className="min-w-0 flex-1 whitespace-pre-wrap font-medium">{f.value}</dd>
          </div>
        ))}
      </dl>

      {proposal.warnings.length > 0 && state === "pending" && (
        <div className="space-y-1 border-t border-border/60 bg-warning/5 px-4 py-2">
          {proposal.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2.5">
        {state === "pending" && (
          <>
            <Button size="sm" onClick={onConfirm}><CheckCircle2 className="h-4 w-4" /> Confirmer</Button>
            <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-4 w-4" /> Annuler</Button>
          </>
        )}
        {state === "running" && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Exécution…</span>
        )}
        {state === "done" && (
          <span className="flex flex-wrap items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> {result ?? "Action effectuée."}
            {link && <Link href={link} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Ouvrir <ArrowRight className="h-3 w-3" /></Link>}
          </span>
        )}
        {state === "cancelled" && <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><X className="h-4 w-4" /> Action annulée.</span>}
        {state === "error" && <span className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> {result ?? "Échec de l'action."}</span>}
      </div>
    </div>
  );
}
