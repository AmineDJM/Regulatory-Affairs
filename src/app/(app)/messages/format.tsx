import * as React from "react";
import type { Presence } from "@/lib/messaging-ui";

/** Couleurs de présence. */
const PRESENCE_COLOR: Record<Presence, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-400",
  offline: "bg-slate-300",
};

export function PresenceDot({ presence, className = "" }: { presence: Presence; className?: string }) {
  return <span className={`inline-block rounded-full ring-2 ring-card ${PRESENCE_COLOR[presence]} ${className}`} />;
}

/** Horodatage relatif court pour la liste / les messages. */
export function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "hier";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/** Heure d'un message (HH:MM). */
export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Étiquette de séparateur de jour. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function presenceText(presence: Presence): string {
  return presence === "online" ? "En ligne" : presence === "away" ? "Absent" : "Hors ligne";
}

/**
 * Ligne de présence d'un contact direct, façon messagerie : « En ligne » (vert) sinon
 * « Vu à HH:MM » / « Vu hier à HH:MM » / « Vu le JJ mois à HH:MM » à partir de l'heure exacte
 * du dernier passage. Sans horodatage connu → « Hors ligne ».
 */
export function presenceLine(presence: Presence, lastSeenAt: string | null): string {
  if (presence === "online") return "En ligne";
  if (!lastSeenAt) return "Hors ligne";
  const d = new Date(lastSeenAt);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Vu à ${time}`;
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `Vu hier à ${time}`;
  return `Vu le ${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} à ${time}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Construit la regex inline (gras / italique / lien / mentions) pour une conversation. */
export function buildInlineRegex(memberNames: string[]): RegExp {
  const names = [...new Set(memberNames.filter(Boolean))].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const mention = names.length ? `|(@(?:${names.join("|")}))` : "";
  return new RegExp(`(\\*\\*[^*]+\\*\\*)|(__[^_]+__)|(\\*[^*]+\\*)|(https?:\\/\\/[^\\s]+)${mention}`, "g");
}

function inlineNoCode(text: string, regex: RegExp, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  regex.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1]) out.push(<strong key={key} className="font-semibold">{m[1].slice(2, -2)}</strong>);
    else if (m[2]) out.push(<em key={key} className="italic">{m[2].slice(2, -2)}</em>);
    else if (m[3]) out.push(<em key={key} className="italic">{m[3].slice(1, -1)}</em>);
    else if (m[4])
      out.push(
        <a key={key} href={m[4]} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">
          {m[4]}
        </a>,
      );
    else if (m[5])
      out.push(
        <span key={key} className="rounded bg-accent px-1 font-medium text-accent-foreground">
          {m[5]}
        </span>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Rendu enrichi d'un corps de message (markdown léger + liens + mentions, multi-lignes). */
export function renderRich(body: string, memberNames: string[]): React.ReactNode {
  const regex = buildInlineRegex(memberNames);
  const lines = body.split("\n");
  return lines.map((line, li) => {
    // Découpe d'abord les portions `code` (inline), le reste passe par la regex.
    const segments = line.split(/(`[^`]+`)/g);
    const nodes = segments.map((seg, si) => {
      if (seg.startsWith("`") && seg.endsWith("`") && seg.length > 1) {
        return (
          <code key={`c-${li}-${si}`} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.85em]">
            {seg.slice(1, -1)}
          </code>
        );
      }
      return <React.Fragment key={`s-${li}-${si}`}>{inlineNoCode(seg, regex, `${li}-${si}`)}</React.Fragment>;
    });
    return (
      <React.Fragment key={`l-${li}`}>
        {li > 0 && <br />}
        {nodes}
      </React.Fragment>
    );
  });
}
