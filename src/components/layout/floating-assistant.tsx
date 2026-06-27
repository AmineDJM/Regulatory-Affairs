"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, X, Maximize2, Bot, MessageSquareWarning } from "lucide-react";
import { AssistantChat, ActionCard, cleanReply, type ActionState } from "@/app/(app)/assistant/assistant-chat";
import { assistantNudge, executeAssistantAction } from "@/lib/actions/assistant-actions";
import type { ProposedAction } from "@/lib/assistant";

interface Suggestion { summary: string; proposal?: ProposedAction }

/**
 * Assistant flottant — la bulle IA présente sur TOUTE l'application (remplace
 * l'onglet « Assistant IA »). Quand de nouveaux messages internes non lus arrivent,
 * il les analyse et propose une action, surfacée comme une notification discrète sur
 * la bulle. L'utilisateur ouvre s'il veut. Maîtrise du coût IA : analyse uniquement
 * lorsqu'il y a du nouveau (signature). Gracieux sans clé.
 */
export function FloatingAssistant({ userName, configured }: { userName: string; configured: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<Suggestion | null>(null);
  const [nudgeState, setNudgeState] = React.useState<ActionState>("pending");
  const [nudgeResult, setNudgeResult] = React.useState<string | undefined>();
  const [nudgeLink, setNudgeLink] = React.useState<string | undefined>();
  const sigRef = React.useRef("");
  const dismissedRef = React.useRef("");
  const busyRef = React.useRef(false);

  // Sondage proactif : analyse les messages non lus quand il y a du nouveau.
  React.useEffect(() => {
    if (!configured) return;
    let alive = true;
    const poll = async () => {
      if (!alive || busyRef.current || document.visibilityState !== "visible") return;
      busyRef.current = true;
      try {
        const r = await assistantNudge(sigRef.current);
        sigRef.current = r.signature;
        if (alive && r.suggestion && r.signature !== dismissedRef.current) {
          setSuggestion(r.suggestion);
          setNudgeState("pending"); setNudgeResult(undefined); setNudgeLink(undefined);
        }
      } catch { /* silencieux */ } finally { busyRef.current = false; }
    };
    const t0 = window.setTimeout(poll, 4000);
    const id = window.setInterval(poll, 75_000);
    return () => { alive = false; window.clearTimeout(t0); window.clearInterval(id); };
  }, [configured]);

  // Sur la page plein écran de l'assistant, pas de bulle (évite le doublon).
  if (pathname === "/assistant") return null;

  const hasBadge = Boolean(suggestion) && !open;
  const dismissSuggestion = () => { dismissedRef.current = sigRef.current; setSuggestion(null); };

  const confirmNudge = async () => {
    if (!suggestion?.proposal) return;
    setNudgeState("running");
    try {
      const r = await executeAssistantAction(suggestion.proposal.payload);
      if (r.ok) { setNudgeState("done"); setNudgeResult(r.message); setNudgeLink(r.link); }
      else { setNudgeState("error"); setNudgeResult(r.error); }
    } catch { setNudgeState("error"); setNudgeResult("Exécution impossible."); }
  };

  return (
    <>
      {/* Bulle */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Assistant IA"
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[55] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600 text-primary-foreground shadow-xl ring-1 ring-black/5 transition hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        {hasBadge && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
            <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-white">!</span>
          </span>
        )}
      </button>

      {/* Panneau */}
      {open && (
        <div className="fixed inset-x-2 bottom-[calc(5rem+env(safe-area-inset-bottom))] top-16 z-[55] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:right-6 sm:top-auto sm:h-[600px] sm:max-h-[80vh] sm:w-[400px]">
          <div className="flex items-center gap-2 border-b border-border bg-gradient-to-br from-primary/90 to-purple-600 px-4 py-2.5 text-primary-foreground">
            <Bot className="h-5 w-5" />
            <p className="text-sm font-semibold">Assistant IA</p>
            <div className="ml-auto flex items-center gap-1">
              <Link href="/assistant" onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/15" title="Ouvrir en grand"><Maximize2 className="h-4 w-4" /></Link>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/15"><X className="h-4 w-4" /></button>
            </div>
          </div>

          {suggestion && (
            <div className="space-y-2 border-b border-border bg-warning/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-warning"><MessageSquareWarning className="h-4 w-4" /> Suggestion à partir de vos messages</p>
              {suggestion.summary && <p className="whitespace-pre-wrap text-sm">{cleanReply(suggestion.summary)}</p>}
              {suggestion.proposal && (
                <ActionCard proposal={suggestion.proposal} state={nudgeState} result={nudgeResult} link={nudgeLink} onConfirm={confirmNudge} onCancel={dismissSuggestion} />
              )}
              {!suggestion.proposal && <button onClick={dismissSuggestion} className="text-xs text-muted-foreground hover:underline">Ignorer</button>}
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col">
            <AssistantChat userName={userName} configured={configured} />
          </div>
        </div>
      )}
    </>
  );
}
