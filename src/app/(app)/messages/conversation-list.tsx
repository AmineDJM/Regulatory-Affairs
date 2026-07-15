"use client";

import * as React from "react";
import { Search, SquarePen, Bookmark, Hash, Users, Pin, BellOff, Volume2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { ConversationSummaryDTO } from "@/lib/queries/messaging";
import { PresenceDot, relativeTime } from "./format";

type Filter = "all" | "unread" | "pinned";

interface Props {
  conversations: ConversationSummaryDTO[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onOpenBookmarks: () => void;
  /** Sélecteur de statut personnel (façon Teams) affiché en tête de liste. */
  myStatus?: React.ReactNode;
}

/** Avatar contextuel : photo/initiales pour un DM (avec présence), glyphe pour un canal/groupe. */
export function ConvAvatar({ c, size = "md" }: { c: ConversationSummaryDTO; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  if (c.type === "DIRECT") {
    return (
      <span className="relative shrink-0">
        <Avatar name={c.avatarName} color={c.avatarColor} size={size === "sm" ? "sm" : "lg"} />
        <PresenceDot presence={c.presence} className="absolute -bottom-0.5 -right-0.5 h-3 w-3" />
      </span>
    );
  }
  const isChannel = c.type === "CHANNEL";
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-xl text-white", dim)}
      style={{ backgroundColor: c.avatarColor ?? (isChannel ? "#0f766e" : "#7c3aed") }}
    >
      {isChannel ? (
        c.icon ? <Icon name={c.icon} className="h-5 w-5" /> : <Hash className="h-5 w-5" />
      ) : (
        <Users className="h-5 w-5" />
      )}
    </span>
  );
}

export function ConversationList({ conversations, activeId, onSelect, onNew, onOpenBookmarks, myStatus }: Props) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");

  const filtered = conversations.filter((c) => {
    if (c.isArchived) return false;
    if (filter === "unread" && (c.unread === 0 || c.isMuted)) return false;
    if (filter === "pinned" && !c.isPinned) return false;
    if (q && !c.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const totalUnread = conversations.reduce((s, c) => s + (c.isMuted ? 0 : c.unread), 0);

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-card md:w-80 lg:w-96">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          Messagerie
          {totalUnread > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{totalUnread}</span>
          )}
        </h1>
        <div className="flex items-center gap-0.5">
          <button onClick={onOpenBookmarks} title="Messages enregistrés" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Bookmark className="h-5 w-5" />
          </button>
          <button onClick={onNew} title="Nouvelle conversation" className="rounded-lg p-2 text-primary hover:bg-accent">
            <SquarePen className="h-5 w-5" />
          </button>
        </div>
      </div>

      {myStatus && <div className="border-y border-border px-2 py-1.5">{myStatus}</div>}

      <div className="px-3 pb-2 pt-2">
        <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une conversation…"
            className="h-9 w-full bg-transparent text-sm focus:outline-none"
          />
        </div>
      </div>

      <div className="flex gap-1 px-3 pb-2">
        {([["all", "Tous"], ["unread", "Non lus"], ["pinned", "Épinglées"]] as [Filter, string][]).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Aucune conversation.</p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                activeId === c.id ? "bg-accent" : "hover:bg-secondary/70",
              )}
            >
              <ConvAvatar c={c} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn("truncate text-sm", c.unread > 0 && !c.isMuted ? "font-bold" : "font-semibold")}>{c.title}</span>
                  {c.isPinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  {c.isMuted && <BellOff className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{relativeTime(c.lastMessageAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("truncate text-xs", c.unread > 0 && !c.isMuted ? "text-foreground" : "text-muted-foreground")}>
                    {c.lastSenderIsSelf && "Vous : "}
                    {!c.lastSenderIsSelf && c.type !== "DIRECT" && c.lastSenderName ? `${c.lastSenderName.split(" ")[0]} : ` : ""}
                    {c.lastMessagePreview || "Nouvelle conversation"}
                  </span>
                  {c.unread > 0 && !c.isMuted && (
                    <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                      {c.unread > 99 ? "99+" : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        <Volume2 className="h-3.5 w-3.5" />
        Messagerie interne sécurisée — chiffrée & privée
      </div>
    </div>
  );
}
