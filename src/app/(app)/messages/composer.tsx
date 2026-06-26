"use client";

import * as React from "react";
import { Send, Paperclip, Smile, X, Loader2, FileText, Reply } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ConvMemberDTO, MessageDTO } from "@/lib/queries/messaging";
import { EMOJI_PALETTE } from "./emoji";
import { formatBytes } from "./format";

export interface UploadedAttachment {
  blobId: string;
  sig: string;
  name: string;
  mime: string;
  size: number;
}

export interface SendPayload {
  body: string;
  attachments: UploadedAttachment[];
  mentions: string[];
  parentId: string | null;
}

interface Props {
  conversationId: string;
  members: ConvMemberDTO[];
  selfId: string;
  replyTo: MessageDTO | null;
  onCancelReply: () => void;
  onSend: (payload: SendPayload) => Promise<boolean>;
}

interface Pending {
  tempId: string;
  name: string;
}

export function Composer({ conversationId, members, selfId, replyTo, onCancelReply, onSend }: Props) {
  const [text, setText] = React.useState("");
  const [attachments, setAttachments] = React.useState<UploadedAttachment[]>([]);
  const [pending, setPending] = React.useState<Pending[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [showEmoji, setShowEmoji] = React.useState(false);
  const [mention, setMention] = React.useState<{ open: boolean; query: string; start: number; caret: number }>({
    open: false, query: "", start: 0, caret: 0,
  });
  const [mentionIndex, setMentionIndex] = React.useState(0);

  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const lastPing = React.useRef(0);
  const draftKey = `amd-msg-draft-${conversationId}`;

  const others = React.useMemo(() => members.filter((m) => m.userId !== selfId), [members, selfId]);
  const mentionMatches = mention.open
    ? others.filter((m) => m.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6)
    : [];

  // Charge / restaure le brouillon par conversation.
  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(draftKey) : null;
    setText(saved ?? "");
    setAttachments([]);
    setShowEmoji(false);
    setMention((m) => ({ ...m, open: false }));
    setTimeout(() => taRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const autoGrow = () => {
    const ta = taRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
    }
  };
  React.useEffect(autoGrow, [text]);

  const pingTyping = () => {
    const now = Date.now();
    if (now - lastPing.current < 2500) return;
    lastPing.current = now;
    fetch("/api/messaging/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
      keepalive: true,
    }).catch(() => undefined);
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    setError(null);
    if (typeof window !== "undefined") window.localStorage.setItem(draftKey, val);
    if (val.trim()) pingTyping();

    const caret = e.target.selectionStart ?? val.length;
    const upto = val.slice(0, caret);
    const match = /(?:^|\s)@([^\s@]*)$/.exec(upto);
    if (match) {
      setMention({ open: true, query: match[1], start: caret - match[1].length - 1, caret });
      setMentionIndex(0);
    } else if (mention.open) {
      setMention((m) => ({ ...m, open: false }));
    }
  };

  const pickMention = (member: ConvMemberDTO) => {
    const before = text.slice(0, mention.start);
    const after = text.slice(mention.caret);
    const next = `${before}@${member.name} ${after}`;
    setText(next);
    setMention((m) => ({ ...m, open: false }));
    if (typeof window !== "undefined") window.localStorage.setItem(draftKey, next);
    setTimeout(() => {
      const ta = taRef.current;
      if (ta) {
        const pos = before.length + member.name.length + 2;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const insertEmoji = (emoji: string) => {
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? text.length;
    const next = text.slice(0, caret) + emoji + text.slice(caret);
    setText(next);
    setShowEmoji(false);
    setTimeout(() => {
      if (ta) {
        ta.focus();
        ta.setSelectionRange(caret + emoji.length, caret + emoji.length);
      }
    }, 0);
  };

  const uploadFiles = async (files: FileList) => {
    setError(null);
    for (const file of Array.from(files).slice(0, 10)) {
      const tempId = crypto.randomUUID();
      setPending((p) => [...p, { tempId, name: file.name }]);
      const fd = new FormData();
      fd.set("file", file);
      fd.set("conversationId", conversationId);
      try {
        const res = await fetch("/api/messaging/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok) {
          setAttachments((a) => [...a, { blobId: data.blobId, sig: data.sig, name: data.name, mime: data.mime, size: data.size }]);
        } else {
          setError(data.error ?? "Échec de l'envoi du fichier.");
        }
      } catch {
        setError("Échec de l'envoi du fichier.");
      } finally {
        setPending((p) => p.filter((x) => x.tempId !== tempId));
      }
    }
  };

  const submit = async () => {
    const body = text.trim();
    if ((!body && attachments.length === 0) || sending || pending.length > 0) return;
    const mentions = others.filter((m) => body.includes(`@${m.name}`)).map((m) => m.userId);
    setSending(true);
    const ok = await onSend({ body, attachments, mentions, parentId: replyTo?.id ?? null });
    setSending(false);
    if (ok) {
      setText("");
      setAttachments([]);
      setShowEmoji(false);
      if (typeof window !== "undefined") window.localStorage.removeItem(draftKey);
      onCancelReply();
      setTimeout(() => taRef.current?.focus(), 0);
    } else {
      setError("Échec de l'envoi.");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention.open && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => (i + 1) % mentionMatches.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMention(mentionMatches[mentionIndex]); return; }
      if (e.key === "Escape") { setMention((m) => ({ ...m, open: false })); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !sending && pending.length === 0;

  return (
    <div className="relative border-t border-border bg-card px-3 py-2.5">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-primary bg-secondary/60 px-3 py-1.5 text-xs">
          <Reply className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">{replyTo.senderName}</span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{replyTo.body || "Pièce jointe"}</span>
          <button onClick={onCancelReply} className="rounded p-0.5 text-muted-foreground hover:bg-secondary"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {(attachments.length > 0 || pending.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <div key={a.blobId + i} className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
              <FileText className="h-4 w-4 text-primary" />
              <span className="max-w-[160px] truncate font-medium">{a.name}</span>
              <span className="text-muted-foreground">{formatBytes(a.size)}</span>
              <button onClick={() => setAttachments((list) => list.filter((_, j) => j !== i))} className="rounded p-0.5 text-muted-foreground hover:bg-secondary">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {pending.map((p) => (
            <div key={p.tempId} className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="max-w-[160px] truncate">{p.name}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mb-2 px-1 text-xs text-destructive">{error}</p>}

      {mention.open && mentionMatches.length > 0 && (
        <div className="absolute bottom-full left-3 z-30 mb-1 w-72 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          {mentionMatches.map((m, i) => (
            <button
              key={m.userId}
              onMouseDown={(e) => { e.preventDefault(); pickMention(m); }}
              onMouseEnter={() => setMentionIndex(i)}
              className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm", i === mentionIndex ? "bg-secondary" : "hover:bg-secondary/60")}
            >
              <Avatar name={m.name} color={m.avatarColor} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-medium">{m.name}</p>
                {m.title && <p className="truncate text-xs text-muted-foreground">{m.title}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <button
          onClick={() => fileRef.current?.click()}
          title="Joindre un fichier"
          className="mb-1 rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = ""; }}
        />

        <div className="relative flex-1">
          <textarea
            ref={taRef}
            value={text}
            onChange={onChange}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Écrire un message…   (@ pour mentionner, Entrée pour envoyer)"
            className="max-h-40 w-full resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowEmoji((v) => !v)}
            title="Émoji"
            className="mb-1 rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Smile className="h-5 w-5" />
          </button>
          {showEmoji && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowEmoji(false)} />
              <div className="absolute bottom-full right-0 z-20 mb-1 w-64 rounded-xl border border-border bg-popover p-2 shadow-xl">
                <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto">
                  {EMOJI_PALETTE.map((e) => (
                    <button key={e} onClick={() => insertEmoji(e)} className="rounded-md p-1 text-base hover:bg-secondary">{e}</button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => void submit()}
          disabled={!canSend}
          title="Envoyer"
          className={cn(
            "mb-0.5 flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition-colors",
            canSend ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-secondary text-muted-foreground",
          )}
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
