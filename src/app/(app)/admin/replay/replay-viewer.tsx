"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, FileText, Keyboard, MousePointerClick, Navigation, Play, Pause,
  Search, Send, SkipForward, Loader2,
} from "lucide-react";
import {
  describeEvent, stamp, firstErrorIndex, EVENT_KINDS,
  type CapturedEvent, type EventKind,
} from "@/lib/replay/capture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ReplaySession {
  id: string;
  who: string;
  startedLabel: string;
  events: number;
  errors: number;
  entryPath: string;
}

export interface ReplayEvent {
  id: string;
  kind: string;
  at: number;
  path: string;
  label: string | null;
  detail: string | null;
}

const ICON: Record<EventKind, React.ComponentType<{ className?: string }>> = {
  PAGE: FileText,
  CLICK: MousePointerClick,
  INPUT: Keyboard,
  SUBMIT: Send,
  ERROR: AlertTriangle,
  NAV: Navigation,
};

/** Le rejeu avance au rythme réel, accéléré ×4 — et sans jamais laisser un blanc de deux minutes. */
const SPEED = 4;
const MAX_GAP_MS = 1500;

function asCaptured(e: ReplayEvent): CapturedEvent {
  const kind = (EVENT_KINDS as readonly string[]).includes(e.kind) ? (e.kind as EventKind) : "NAV";
  return { kind, at: e.at, path: e.path, label: e.label, detail: e.detail };
}

/**
 * LE REJEU — dérouler la session de quelqu'un, du début jusqu'à l'endroit où ça a cassé.
 *
 * Trois gestes, et rien d'autre : choisir une session, faire défiler la chronologie, sauter à
 * l'erreur. Le curseur s'y place déjà tout seul à l'ouverture — c'est ce que le support vient
 * chercher, et le faire dérouler à la main serait lui faire perdre le temps qu'on veut lui rendre.
 *
 * La lecture automatique respecte le RYTHME RÉEL (accéléré ×4, silences plafonnés) : on voit
 * l'hésitation, les allers-retours, les trois clics sur le même bouton qui ne répond pas. Une liste
 * plate perdrait exactement cette information-là.
 *
 * ⚠️ Ce qui s'affiche ici est un LIBELLÉ, jamais une valeur : « Saisie « Montant » », jamais le
 * montant. Le masquage est fait à l'entrée (`src/lib/replay/capture.ts`) et vérifié par ses tests ;
 * l'affichage ne peut donc pas révéler ce qui n'a jamais été enregistré.
 */
export function ReplayViewer({
  sessions, openId, events,
}: { sessions: ReplaySession[]; openId: string | null; events: ReplayEvent[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const listRef = React.useRef<HTMLOListElement>(null);

  const captured = React.useMemo(() => events.map(asCaptured), [events]);
  const errorAt = React.useMemo(() => firstErrorIndex(captured), [captured]);

  // À l'ouverture d'une session, le curseur se pose sur la première erreur — ou au début si la
  // session s'est bien passée.
  React.useEffect(() => {
    setPlaying(false);
    setCursor(errorAt >= 0 ? errorAt : 0);
  }, [openId, errorAt]);

  // La lecture : chaque pas attend l'écart réel entre deux gestes, accéléré et plafonné.
  React.useEffect(() => {
    if (!playing || cursor >= events.length - 1) return;
    const gap = Math.min(MAX_GAP_MS, Math.max(120, (events[cursor + 1].at - events[cursor].at) / SPEED));
    const t = window.setTimeout(() => setCursor((c) => Math.min(c + 1, events.length - 1)), gap);
    return () => window.clearTimeout(t);
  }, [playing, cursor, events]);

  React.useEffect(() => {
    if (cursor >= events.length - 1) setPlaying(false);
  }, [cursor, events.length]);

  // Garder l'événement courant sous les yeux pendant la lecture.
  React.useEffect(() => {
    listRef.current?.querySelector(`[data-i="${cursor}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [cursor]);

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => `${s.who} ${s.entryPath} ${s.startedLabel}`.toLowerCase().includes(q));
  }, [sessions, query]);

  const openSession = (id: string) => {
    if (id === openId) return;
    startTransition(() => router.push(`/admin/replay?session=${encodeURIComponent(id)}`, { scroll: false }));
  };

  const current = events[cursor];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
      {/* LES SESSIONS — celles qui ont une erreur d'abord à l'œil, par leur pastille rouge. */}
      <aside className="surface flex max-h-[70vh] flex-col gap-2 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Personne ou page…"
            className="pl-8"
            aria-label="Filtrer les sessions"
          />
        </div>

        <ul className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
          {shown.map((s) => {
            const active = s.id === openId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => openSession(s.id)}
                  className={`w-full rounded-lg px-2.5 py-2 text-left transition ${
                    active ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-secondary"
                  }`}
                >
                  <p className="flex items-center justify-between gap-2 text-sm font-medium">
                    <span className="truncate">{s.who}</span>
                    {s.errors > 0 && <Badge tone="danger">{s.errors}</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{s.startedLabel}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.entryPath} · {s.events} action{s.events > 1 ? "s" : ""}
                  </p>
                </button>
              </li>
            );
          })}
          {shown.length === 0 && (
            <li className="px-2 py-6 text-center text-xs text-muted-foreground">Aucune session ne correspond.</li>
          )}
        </ul>
      </aside>

      {/* LA CHRONOLOGIE. */}
      <section className="surface flex max-h-[70vh] flex-col p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <Button
            size="sm"
            variant={playing ? "outline" : "primary"}
            onClick={() => setPlaying((p) => !p)}
            disabled={events.length < 2}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pause" : "Rejouer"}
          </Button>
          {errorAt >= 0 && (
            <Button size="sm" variant="outline" onClick={() => { setPlaying(false); setCursor(errorAt); }}>
              <SkipForward className="h-4 w-4" /> Première erreur
            </Button>
          )}
          <p className="ml-auto text-xs text-muted-foreground">
            {events.length > 0 ? (
              <>
                <span className="font-medium text-foreground">{cursor + 1}</span> / {events.length} ·{" "}
                {current ? stamp(current.at) : "—"} · {current?.path}
              </>
            ) : (
              "Session vide"
            )}
          </p>
          {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {events.length > 0 && (
          <input
            type="range"
            min={0}
            max={Math.max(0, events.length - 1)}
            value={cursor}
            onChange={(e) => { setPlaying(false); setCursor(Number(e.target.value)); }}
            aria-label="Position dans la session"
            className="my-3 w-full accent-primary"
          />
        )}

        <ol ref={listRef} className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1">
          {events.map((e, i) => {
            const c = captured[i];
            const Icon = ICON[c.kind];
            const isError = c.kind === "ERROR";
            const isCurrent = i === cursor;
            // Ce qui est PASSÉ est net, ce qui vient est estompé : on lit d'un coup d'œil où on en est.
            return (
              <li
                key={e.id}
                data-i={i}
                className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                  isCurrent ? "bg-primary/10 ring-1 ring-primary/30" : i > cursor ? "opacity-45" : ""
                }`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${isError ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="w-16 shrink-0 pt-px text-xs tabular-nums text-muted-foreground">{stamp(e.at)}</span>
                <span className="min-w-0 flex-1">
                  <span className={isError ? "font-medium text-destructive" : ""}>{describeEvent(c)}</span>
                  {/* Le chemin ne se répète que lorsqu'il CHANGE : sinon il noie la chronologie. */}
                  {(i === 0 || events[i - 1].path !== e.path) && (
                    <span className="ml-1.5 text-xs text-muted-foreground">{e.path}</span>
                  )}
                </span>
              </li>
            );
          })}
          {events.length === 0 && (
            <li className="px-2 py-10 text-center text-sm text-muted-foreground">
              Aucune action enregistrée pour cette session.
            </li>
          )}
        </ol>
      </section>
    </div>
  );
}
