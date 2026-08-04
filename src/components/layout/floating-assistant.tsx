"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, X, Maximize2, Bot } from "lucide-react";
import { AssistantChat } from "@/app/(app)/assistant/assistant-chat";

/**
 * Assistant flottant — la bulle IA présente sur TOUTE l'application (remplace
 * l'onglet « Assistant IA »). **Il ne lit RIEN de manière proactive** : il
 * n'analyse vos messages/e-mails que lorsque VOUS le sollicitez explicitement
 * (en ouvrant la bulle puis en posant la question / en ouvrant un message).
 * Une seule conversation à l'écran. Gracieux sans clé API.
 */
export function FloatingAssistant({ userName, configured, voiceConfigured = false }: { userName: string; configured: boolean; voiceConfigured?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Sur la page plein écran de l'assistant, pas de bulle (évite le doublon).
  if (pathname === "/assistant") return null;

  return (
    <>
      {/* Bulle */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Assistant IA"
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[55] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600 text-primary-foreground shadow-xl ring-1 ring-black/5 transition hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {/* Panneau — une seule conversation */}
      {open && (
        <div className="fixed inset-x-2 bottom-[calc(5rem+env(safe-area-inset-bottom))] top-16 z-[55] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:right-6 sm:top-auto sm:h-[640px] sm:max-h-[85vh] sm:w-[420px]">
          <div className="flex items-center gap-2 border-b border-border bg-gradient-to-br from-primary/90 to-purple-600 px-4 py-2.5 text-primary-foreground">
            <Bot className="h-5 w-5" />
            <p className="text-sm font-semibold">Assistant IA</p>
            <div className="ml-auto flex items-center gap-1">
              <Link href="/assistant" onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/15" title="Ouvrir en grand"><Maximize2 className="h-4 w-4" /></Link>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/15"><X className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <AssistantChat userName={userName} configured={configured} voiceConfigured={voiceConfigured} />
          </div>
        </div>
      )}
    </>
  );
}
