"use client";

import * as React from "react";
import { Bookmark, MessagesSquare } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import type {
  ConversationSummaryDTO, ConversationDetailDTO, DirectoryUserDTO, ChannelDTO, MessageDTO, BookmarkDTO,
} from "@/lib/queries/messaging";
import type { Presence } from "@/lib/messaging-ui";
import {
  sendMessage, toggleReaction, togglePinMessage, bookmarkMessage, deleteMessage, editMessage, markRead,
} from "@/lib/actions/messaging-actions";
import { ConversationList } from "./conversation-list";
import { MyStatus } from "./my-status";
import { MessageThread } from "./message-thread";
import { InfoPanel } from "./info-panel";
import { NewConversation } from "./new-conversation";
import type { SendPayload } from "./composer";
import { relativeTime } from "./format";

interface Props {
  selfId: string;
  selfName: string;
  selfColor: string | null;
  selfStatus: string | null;
  selfStatusMessage: string | null;
  initialConversations: ConversationSummaryDTO[];
  initialActiveId: string | null;
  initialDetail: ConversationDetailDTO | null;
  directory: DirectoryUserDTO[];
  channels: ChannelDTO[];
}

export function Messenger({
  selfId, selfName, selfColor, selfStatus, selfStatusMessage, initialConversations, initialActiveId, initialDetail, directory, channels,
}: Props) {
  const [convs, setConvs] = React.useState(initialConversations);
  const [activeId, setActiveId] = React.useState<string | null>(initialActiveId);
  const [detail, setDetail] = React.useState<ConversationDetailDTO | null>(initialDetail);
  const [typing, setTyping] = React.useState<string[]>([]);
  const [replyTo, setReplyTo] = React.useState<MessageDTO | null>(null);
  const [showInfo, setShowInfo] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [mobileThread, setMobileThread] = React.useState(Boolean(initialActiveId));
  const [bookmarksOpen, setBookmarksOpen] = React.useState(false);
  const [bookmarks, setBookmarks] = React.useState<BookmarkDTO[]>([]);

  const activeRef = React.useRef(activeId);
  activeRef.current = activeId;
  const lastReadId = React.useRef<string | null>(null);

  const dispatchUnread = (total: number) => {
    window.dispatchEvent(new CustomEvent("amd:messaging-unread", { detail: { total } }));
  };

  // ── Polling de la liste + badge global (toutes les 6 s, en avant-plan).
  const refreshSync = React.useCallback(async () => {
    try {
      const res = await fetch("/api/messaging/sync", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setConvs(data.conversations as ConversationSummaryDTO[]);
      dispatchUnread(data.totalUnread as number);
    } catch {
      /* réseau : on réessaiera au prochain tick */
    }
  }, []);

  React.useEffect(() => {
    refreshSync();
    const t = setInterval(() => { if (document.visibilityState === "visible") refreshSync(); }, 6000);
    return () => clearInterval(t);
  }, [refreshSync]);

  // ── Ouverture d'une conversation : charge le détail complet.
  const openConversation = React.useCallback(async (id: string) => {
    setActiveId(id);
    setMobileThread(true);
    setReplyTo(null);
    setTyping([]);
    try {
      const res = await fetch(`/api/messaging/conversation?conversationId=${id}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setDetail(data.detail as ConversationDetailDTO);
        lastReadId.current = null;
      } else {
        setDetail(null);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ── Polling du fil actif (messages + présence + typing) toutes les 3,5 s.
  const pollThread = React.useCallback(async () => {
    const id = activeRef.current;
    if (!id) return;
    try {
      const res = await fetch(`/api/messaging/messages?conversationId=${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;
      setTyping(data.typing ?? []);
      setDetail((d) => {
        if (!d || d.id !== id) return d;
        // Présence en direct : met à jour l'en-tête (statut + « vu à… ») et la présence des membres.
        const presence = (data.presence ?? {}) as Record<string, Presence>;
        return {
          ...d,
          messages: data.messages as MessageDTO[],
          pinnedMessages: data.pinnedMessages as MessageDTO[],
          presence: d.otherUserId && presence[d.otherUserId] ? presence[d.otherUserId] : d.presence,
          otherLastSeenAt: (data.otherLastSeenAt ?? d.otherLastSeenAt) as string | null,
          members: d.members.map((mem) => (presence[mem.userId] ? { ...mem, presence: presence[mem.userId] } : mem)),
        };
      });
      // Accusé de lecture quand le dernier message vient d'un autre et que l'onglet est visible.
      const msgs = data.messages as MessageDTO[];
      const last = msgs[msgs.length - 1];
      if (last && last.senderId !== selfId && last.id !== lastReadId.current && document.visibilityState === "visible") {
        lastReadId.current = last.id;
        const f = new FormData(); f.set("conversationId", id);
        markRead(f).then(() => {
          setConvs((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
          refreshSync();
        });
      }
    } catch {
      /* ignore */
    }
  }, [selfId, refreshSync]);

  React.useEffect(() => {
    if (!activeId) return;
    pollThread();
    const t = setInterval(() => { if (document.visibilityState === "visible") pollThread(); }, 3500);
    return () => clearInterval(t);
  }, [activeId, pollThread]);

  // Marque lu à l'ouverture.
  React.useEffect(() => {
    if (activeId) {
      setConvs((cs) => cs.map((c) => (c.id === activeId ? { ...c, unread: 0 } : c)));
    }
  }, [activeId]);

  // ── Mutations sur les messages (optimistes), réconciliées au prochain poll.
  const patchMessage = (id: string, fn: (m: MessageDTO) => MessageDTO) =>
    setDetail((d) => (d ? { ...d, messages: d.messages.map((m) => (m.id === id ? fn(m) : m)) } : d));

  const handleSend = async (payload: SendPayload): Promise<boolean> => {
    const id = activeId;
    if (!id) return false;
    const tempId = `tmp-${crypto.randomUUID()}`;
    const parent = payload.parentId ? detail?.messages.find((m) => m.id === payload.parentId) : null;
    const optimistic: MessageDTO = {
      id: tempId,
      kind: (payload.attachments.length > 0 || payload.driveRefs.length > 0) && !payload.body ? "FILE" : "TEXT",
      body: payload.body,
      deleted: false,
      senderId: selfId,
      senderName: selfName,
      senderColor: selfColor,
      createdAt: new Date().toISOString(),
      editedAt: null,
      isPinned: false,
      bookmarked: false,
      parentId: payload.parentId,
      parent: parent ? { id: parent.id, senderName: parent.senderName, preview: parent.body.slice(0, 60) || "Pièce jointe" } : null,
      reactions: [],
      attachments: [
        ...payload.attachments.map((a, i) => ({
          id: `tmp-${i}`, name: a.name, mime: a.mime, size: a.size, isImage: false,
          driveNodeId: null, isFolder: false,
        })),
        // L'aperçu OPTIMISTE d'une référence Drive porte déjà son identifiant de nœud : la
        // vignette est donc cliquable avant même le retour du serveur.
        ...payload.driveRefs.map((r, i) => ({
          id: `tmp-drive-${i}`, name: r.name, mime: "", size: 0, isImage: false,
          driveNodeId: r.id, isFolder: r.isFolder,
        })),
      ],
      mentionIds: payload.mentions,
      refType: null, refId: null, refLabel: null,
      receipt: "sent", // une coche immédiate ; le poll passera à distribué/lu
    };
    setDetail((d) => (d && d.id === id ? { ...d, messages: [...d.messages, optimistic] } : d));

    const f = new FormData();
    f.set("conversationId", id);
    f.set("body", payload.body);
    if (payload.mentions.length) f.set("mentions", payload.mentions.join(","));
    if (payload.parentId) f.set("parentId", payload.parentId);
    if (payload.attachments.length) f.set("attachments", JSON.stringify(payload.attachments));
    // Seuls les IDENTIFIANTS partent : le serveur relit le nom, la taille et le type en base, et
    // revérifie que l'expéditeur a bien accès au nœud qu'il partage.
    if (payload.driveRefs.length) f.set("driveRefs", JSON.stringify(payload.driveRefs.map((r) => r.id)));

    const r = await sendMessage(f);
    if (r.ok && r.message) {
      const real = r.message;
      setDetail((d) => (d && d.id === id ? { ...d, messages: d.messages.map((m) => (m.id === tempId ? real : m)) } : d));
      setConvs((cs) => bumpConversation(cs, id, real.body || "Pièce jointe", true));
      refreshSync();
      return true;
    }
    setDetail((d) => (d && d.id === id ? { ...d, messages: d.messages.filter((m) => m.id !== tempId) } : d));
    return false;
  };

  const handleReact = (messageId: string, emoji: string) => {
    patchMessage(messageId, (m) => {
      const existing = m.reactions.find((r) => r.emoji === emoji);
      let reactions;
      if (existing?.mine) {
        reactions = m.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r)).filter((r) => r.count > 0);
      } else if (existing) {
        reactions = m.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r));
      } else {
        reactions = [...m.reactions, { emoji, count: 1, mine: true, users: [selfName] }];
      }
      return { ...m, reactions };
    });
    const f = new FormData(); f.set("messageId", messageId); f.set("emoji", emoji);
    toggleReaction(f).then(() => pollThread());
  };

  const handleTogglePin = (messageId: string) => {
    patchMessage(messageId, (m) => ({ ...m, isPinned: !m.isPinned }));
    const f = new FormData(); f.set("messageId", messageId);
    togglePinMessage(f).then(() => pollThread());
  };

  const handleBookmark = (messageId: string) => {
    patchMessage(messageId, (m) => ({ ...m, bookmarked: !m.bookmarked }));
    const f = new FormData(); f.set("messageId", messageId);
    bookmarkMessage(f);
  };

  const handleDelete = (messageId: string) => {
    patchMessage(messageId, (m) => ({ ...m, deleted: true, body: "", attachments: [], reactions: [] }));
    const f = new FormData(); f.set("id", messageId);
    deleteMessage(f).then(() => pollThread());
  };

  const handleSaveEdit = async (messageId: string, body: string): Promise<boolean> => {
    const f = new FormData(); f.set("id", messageId); f.set("body", body);
    const r = await editMessage(f);
    if (r.ok) patchMessage(messageId, (m) => ({ ...m, body, editedAt: new Date().toISOString() }));
    return r.ok;
  };

  const refreshDetail = React.useCallback(() => { if (activeId) openConversation(activeId); refreshSync(); }, [activeId, openConversation, refreshSync]);

  const onLeft = () => { setShowInfo(false); setActiveId(null); setDetail(null); setMobileThread(false); refreshSync(); };

  const openBookmarks = async () => {
    setBookmarksOpen(true);
    try {
      const res = await fetch("/api/messaging/bookmarks", { cache: "no-store" });
      const data = await res.json();
      setBookmarks(data.bookmarks as BookmarkDTO[]);
    } catch {
      /* ignore */
    }
  };

  return (
    // Hauteur mesurée (cf. chrome-metrics.tsx) : le `7.5rem` écrit en dur ne correspondait à
    // aucune barre réelle et faisait passer le composeur sous la barre d'onglets sur téléphone.
    <div className="app-viewport relative flex overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Liste */}
      <div className={mobileThread && activeId ? "hidden md:flex" : "flex w-full md:w-auto"}>
        <ConversationList
          conversations={convs}
          activeId={activeId}
          onSelect={openConversation}
          onNew={() => setNewOpen(true)}
          onOpenBookmarks={openBookmarks}
          myStatus={<MyStatus name={selfName} status={selfStatus} message={selfStatusMessage} />}
        />
      </div>

      {/* Fil */}
      <div className={mobileThread && activeId ? "flex min-w-0 flex-1" : "hidden min-w-0 flex-1 md:flex"}>
        {detail && activeId ? (
          <MessageThread
            detail={detail}
            selfId={selfId}
            typingUserIds={typing}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            onSend={handleSend}
            onReact={handleReact}
            onTogglePin={handleTogglePin}
            onBookmark={handleBookmark}
            onDelete={handleDelete}
            onSaveEdit={handleSaveEdit}
            onToggleInfo={() => setShowInfo((v) => !v)}
            onBack={() => { setMobileThread(false); setShowInfo(false); }}
          />
        ) : (
          <EmptyState onNew={() => setNewOpen(true)} />
        )}
      </div>

      {/* Détails (colonne sur desktop, plein écran sur mobile) */}
      {showInfo && detail && (
        <div className="absolute inset-0 z-30 md:static md:z-auto md:flex">
          <InfoPanel
            detail={detail}
            directory={directory}
            selfId={selfId}
            onChanged={refreshDetail}
            onLeft={onLeft}
            onClose={() => setShowInfo(false)}
          />
        </div>
      )}

      <NewConversation
        open={newOpen}
        onClose={() => setNewOpen(false)}
        directory={directory}
        channels={channels}
        onCreated={(id) => { setNewOpen(false); refreshSync(); openConversation(id); }}
      />

      <Sheet open={bookmarksOpen} onClose={() => setBookmarksOpen(false)} title="Messages enregistrés" description="Vos messages mis de côté." width="md">
        {bookmarks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun message enregistré. Survolez un message et cliquez sur le marque-page.</p>
        ) : (
          <div className="space-y-2">
            {bookmarks.map((b) => (
              <button
                key={b.message.id}
                onClick={() => { setBookmarksOpen(false); openConversation(b.conversationId); }}
                className="block w-full rounded-xl border border-border p-3 text-left hover:bg-secondary"
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Bookmark className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium text-foreground">{b.conversationTitle}</span>
                  <span>· {b.message.senderName}</span>
                  <span className="ml-auto">{relativeTime(b.message.createdAt)}</span>
                </div>
                <p className="line-clamp-3 text-sm">{b.message.body || "📎 Pièce jointe"}</p>
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** Met à jour l'aperçu d'une conversation et la remonte en tête de liste. */
function bumpConversation(cs: ConversationSummaryDTO[], id: string, preview: string, isSelf: boolean): ConversationSummaryDTO[] {
  const now = new Date().toISOString();
  const updated = cs.map((c) =>
    c.id === id ? { ...c, lastMessagePreview: preview, lastMessageAt: now, lastSenderIsSelf: isSelf, unread: 0 } : c,
  );
  updated.sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.lastMessageAt.localeCompare(a.lastMessageAt));
  return updated;
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <MessagesSquare className="h-8 w-8" />
      </span>
      <div>
        <p className="text-lg font-semibold">Votre messagerie interne</p>
        <p className="max-w-sm text-sm text-muted-foreground">Sélectionnez une conversation à gauche, ou démarrez un nouvel échange — message direct, groupe ou canal d'équipe.</p>
      </div>
      <button onClick={onNew} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Nouvelle conversation
      </button>
    </div>
  );
}
