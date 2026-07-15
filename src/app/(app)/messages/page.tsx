import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  getConversationSummaries,
  getDirectory,
  getDiscoverableChannels,
  getConversationDetail,
} from "@/lib/queries/messaging";
import { Messenger } from "./messenger";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: { c?: string } }) {
  const user = await requireModule("MESSAGING");

  const [me, conversations, directory, channels] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { avatarColor: true, chatStatus: true, statusMessage: true } }),
    getConversationSummaries(user.id),
    getDirectory(user.id),
    getDiscoverableChannels(user.id),
  ]);

  const wanted = searchParams.c ?? null;
  const initialDetail = wanted ? await getConversationDetail(user.id, wanted) : null;
  const initialActiveId = initialDetail ? wanted : null;

  return (
    <Messenger
      selfId={user.id}
      selfName={user.name}
      selfColor={me?.avatarColor ?? null}
      selfStatus={me?.chatStatus ?? null}
      selfStatusMessage={me?.statusMessage ?? null}
      initialConversations={conversations}
      initialActiveId={initialActiveId}
      initialDetail={initialDetail}
      directory={directory}
      channels={channels}
    />
  );
}
