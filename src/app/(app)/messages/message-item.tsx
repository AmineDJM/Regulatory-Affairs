"use client";

import * as React from "react";
import {
  SmilePlus, Reply, Pin, PinOff, Bookmark, BookmarkCheck, Pencil, Trash2, Copy, Check,
  Download, FileText, CornerDownRight,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { MessageDTO } from "@/lib/queries/messaging";
import { timeOf, renderRich, formatBytes } from "./format";
import { QUICK_REACTIONS, EMOJI_PALETTE } from "./emoji";

interface Props {
  m: MessageDTO;
  selfId: string;
  showHeader: boolean;
  memberNames: string[];
  canModerate: boolean;
  onReact: (id: string, emoji: string) => void;
  onReply: (m: MessageDTO) => void;
  onTogglePin: (id: string) => void;
  onBookmark: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveEdit: (id: string, body: string) => Promise<boolean>;
  onJumpToParent: (id: string) => void;
}

export function MessageItem({
  m, selfId, showHeader, memberNames, canModerate,
  onReact, onReply, onTogglePin, onBookmark, onDelete, onSaveEdit, onJumpToParent,
}: Props) {
  const isOwn = m.senderId === selfId;
  const mentionsMe = m.mentionIds.includes(selfId);
  const [showEmoji, setShowEmoji] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(m.body);
  const [copied, setCopied] = React.useState(false);
  const editRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (editing) {
      const el = editRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }, [editing]);

  if (m.kind === "SYSTEM") {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-secondary/70 px-3 py-1 text-center text-xs text-muted-foreground">{m.body}</span>
      </div>
    );
  }

  if (m.deleted) {
    return (
      <div className={cn("flex gap-2.5 px-3", isOwn && "flex-row-reverse", showHeader ? "mt-3" : "mt-0.5")}>
        {!isOwn && <span className="w-9 shrink-0" />}
        <span className="rounded-full bg-secondary/50 px-3 py-1 text-xs italic text-muted-foreground">message supprimé</span>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  const saveEdit = async () => {
    const v = editValue.trim();
    if (!v || v === m.body) return setEditing(false);
    const ok = await onSaveEdit(m.id, v);
    if (ok) setEditing(false);
  };

  const react = (emoji: string) => {
    onReact(m.id, emoji);
    setShowEmoji(false);
  };

  return (
    <div
      id={`msg-${m.id}`}
      className={cn("group relative flex gap-2.5 px-3", isOwn && "flex-row-reverse", showHeader ? "mt-3" : "mt-0.5")}
    >
      {!isOwn &&
        (showHeader ? (
          <Avatar name={m.senderName} color={m.senderColor} size="sm" className="mt-0.5" />
        ) : (
          <span className="w-7 shrink-0" />
        ))}

      <div className={cn("flex min-w-0 max-w-[80%] flex-col", isOwn ? "items-end" : "items-start")}>
        {showHeader && !isOwn && (
          <div className="mb-0.5 flex items-baseline gap-2 px-1">
            <span className="text-xs font-semibold text-foreground">{m.senderName}</span>
            <span className="text-[10px] text-muted-foreground">{timeOf(m.createdAt)}</span>
          </div>
        )}

        {m.parent && (
          <button
            onClick={() => onJumpToParent(m.parent!.id)}
            className={cn(
              "mb-1 flex max-w-full items-center gap-1.5 rounded-lg border-l-2 border-primary/50 bg-secondary/60 px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-secondary",
            )}
          >
            <CornerDownRight className="h-3 w-3 shrink-0" />
            <span className="font-medium text-foreground">{m.parent.senderName}</span>
            <span className="truncate">{m.parent.preview}</span>
          </button>
        )}

        {editing ? (
          <div className="w-full min-w-[260px]">
            <textarea
              ref={editRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void saveEdit();
                } else if (e.key === "Escape") {
                  setEditing(false);
                  setEditValue(m.body);
                }
              }}
              rows={2}
              className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <button onClick={() => void saveEdit()} className="font-medium text-primary hover:underline">Enregistrer</button>
              <span>·</span>
              <button onClick={() => { setEditing(false); setEditValue(m.body); }} className="hover:underline">Annuler</button>
              <span className="ml-1">Échap pour annuler</span>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "relative rounded-2xl px-3.5 py-2 text-sm shadow-sm",
              isOwn ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
              showHeader && (isOwn ? "rounded-tr-md" : "rounded-tl-md"),
              mentionsMe && "ring-2 ring-warning ring-offset-1 ring-offset-card",
            )}
          >
            {m.body && <div className="whitespace-pre-wrap break-words leading-relaxed">{renderRich(m.body, memberNames)}</div>}

            {m.attachments.length > 0 && (
              <div className={cn("flex flex-col gap-2", m.body && "mt-2")}>
                {m.attachments.map((a) =>
                  a.isImage ? (
                    <a key={a.id} href={`/api/messaging/attachment/${a.id}`} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/messaging/attachment/${a.id}`} alt={a.name} className="max-h-64 max-w-full rounded-lg border border-border object-cover" />
                    </a>
                  ) : (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-foreground"
                    >
                      <FileText className="h-5 w-5 shrink-0 text-primary" />
                      {/* Clic = APERÇU (ouverture inline dans un nouvel onglet), plus de téléchargement automatique. */}
                      <a
                        href={`/api/messaging/attachment/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Aperçu"
                        className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                      >
                        {a.name}
                      </a>
                      <span className="text-[11px] text-muted-foreground">{formatBytes(a.size)}</span>
                      {/* Téléchargement explicite. */}
                      <a
                        href={`/api/messaging/attachment/${a.id}?dl=1`}
                        download={a.name}
                        title="Télécharger"
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <Download className="h-4 w-4 shrink-0" />
                      </a>
                    </div>
                  ),
                )}
              </div>
            )}

            <span className={cn("mt-0.5 block text-right text-[10px]", isOwn ? "text-primary-foreground/60" : "text-muted-foreground")}>
              {m.editedAt && "modifié · "}
              {timeOf(m.createdAt)}
            </span>
          </div>
        )}

        {m.reactions.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", isOwn && "justify-end")}>
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(m.id, r.emoji)}
                title={r.users.join(", ")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                  r.mine ? "border-primary/40 bg-accent text-accent-foreground" : "border-border bg-card hover:bg-secondary",
                )}
              >
                <span>{r.emoji}</span>
                <span className="tabular-nums">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Barre d'actions au survol */}
      {!editing && (
        <div
          className={cn(
            "absolute -top-3 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-card px-0.5 py-0.5 opacity-0 shadow-md transition-opacity group-hover:opacity-100",
            isOwn ? "left-3" : "right-3",
          )}
        >
          <div className="relative">
            <ActionBtn title="Réagir" onClick={() => setShowEmoji((v) => !v)}><SmilePlus className="h-4 w-4" /></ActionBtn>
            {showEmoji && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowEmoji(false)} />
                <div className={cn("absolute z-20 mt-1 w-64 rounded-xl border border-border bg-popover p-2 shadow-xl", isOwn ? "left-0" : "right-0")}>
                  <div className="mb-1.5 flex flex-wrap gap-1 border-b border-border pb-1.5">
                    {QUICK_REACTIONS.map((e) => (
                      <button key={e} onClick={() => react(e)} className="rounded-md px-1.5 py-1 text-lg hover:bg-secondary">{e}</button>
                    ))}
                  </div>
                  <div className="grid max-h-40 grid-cols-8 gap-0.5 overflow-y-auto">
                    {EMOJI_PALETTE.map((e) => (
                      <button key={e} onClick={() => react(e)} className="rounded-md p-1 text-base hover:bg-secondary">{e}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <ActionBtn title="Répondre" onClick={() => onReply(m)}><Reply className="h-4 w-4" /></ActionBtn>
          <ActionBtn title={m.bookmarked ? "Retirer des favoris" : "Enregistrer"} onClick={() => onBookmark(m.id)}>
            {m.bookmarked ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
          </ActionBtn>
          <ActionBtn title={m.isPinned ? "Désépingler" : "Épingler"} onClick={() => onTogglePin(m.id)}>
            {m.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </ActionBtn>
          <ActionBtn title="Copier" onClick={copy}>{copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}</ActionBtn>
          {isOwn && <ActionBtn title="Modifier" onClick={() => { setEditValue(m.body); setEditing(true); }}><Pencil className="h-4 w-4" /></ActionBtn>}
          {(isOwn || canModerate) && (
            <ActionBtn title="Supprimer" onClick={() => { if (window.confirm("Supprimer ce message ?")) onDelete(m.id); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </ActionBtn>
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
      {children}
    </button>
  );
}
