"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessagesSquare } from "lucide-react";

// ─── Son de notification (généré à la volée, sans fichier audio) ───
let audioCtx: AudioContext | null = null;
/** Joue un petit « ding » à deux tons quand un nouveau message arrive. */
function playPing() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    const ctx = audioCtx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    gain.connect(ctx.destination);
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      osc.connect(gain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.2);
    });
  } catch {
    /* audio indisponible : on ignore */
  }
}

/**
 * Indicateur de messages non lus dans la topbar. Source unique de polling pour
 * le badge global : interroge /api/messaging/sync, diffuse le total via un
 * évènement `amd:messaging-unread` (écouté par la sidebar), et se met à jour
 * instantanément quand la messagerie ouverte émet ce même évènement. Ne poll pas
 * sur la page /messages (le Messenger pilote déjà la valeur).
 */
export function MessagesIndicator({ initial }: { initial: number }) {
  const [count, setCount] = React.useState(initial);
  const prevCount = React.useRef(initial);
  const pathname = usePathname();
  const onMessagesPage = pathname.startsWith("/messages");

  // Son de notification dès que le total de non-lus augmente (nouveau message reçu).
  React.useEffect(() => {
    if (count > prevCount.current) playPing();
    prevCount.current = count;
  }, [count]);

  React.useEffect(() => {
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ total: number }>).detail;
      if (detail && typeof detail.total === "number") setCount(detail.total);
    };
    window.addEventListener("amd:messaging-unread", onEvent);
    return () => window.removeEventListener("amd:messaging-unread", onEvent);
  }, []);

  React.useEffect(() => {
    if (onMessagesPage) return; // le Messenger gère la valeur via l'évènement
    let alive = true;
    const fetchCount = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/messaging/sync", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        const total = data.totalUnread as number;
        setCount(total);
        window.dispatchEvent(new CustomEvent("amd:messaging-unread", { detail: { total } }));
      } catch {
        /* réseau : prochain tick */
      }
    };
    fetchCount();
    const t = setInterval(fetchCount, 12000);
    return () => { alive = false; clearInterval(t); };
  }, [onMessagesPage]);

  return (
    <Link href="/messages" className="relative rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label="Messagerie">
      <MessagesSquare className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
