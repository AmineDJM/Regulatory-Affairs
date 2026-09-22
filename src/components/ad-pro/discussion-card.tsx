import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { canModerateEntity } from "@/lib/entity-access";
import { entityHref } from "@/lib/entity-href";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CommentThread } from "@/components/shared/comment-thread";
import { DISCUSSION_TITRE, DISCUSSION_AIDE, DISCUSSION_VIDE } from "@/lib/ad-pro/discussion";
import { addAdProComment } from "@/lib/actions/ad-pro-discussion-actions";
import { updateComment, deleteComment } from "@/lib/actions/comment-actions";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA SECTION DISCUSSION — UN composant serveur, monté sur les SEPT natures du pôle.
 *
 * Sept blocs recopiés auraient divergé sur le titre, la phrase d'aide, la porte de modération ou
 * la liste chargée — et le premier correctif n'aurait touché qu'un écran (§118.5). D'où un
 * composant SERVEUR qui charge le fil et compose le bloc : l'écran n'écrit qu'une ligne.
 *
 * ── CE QU'IL NE FAIT PAS ────────────────────────────────────────────────────────────────
 *
 * Il ne garde RIEN : l'écran qui le monte a déjà refusé qui ne peut pas lire la fiche
 * (`notFound()` sur sa propre porte), et l'ACTION revérifie par enregistrement — c'est elle qui
 * fait foi, parce qu'un composant ne protège que l'affichage. Le poser sans sa porte d'écran
 * serait une seconde vérité en retard (§118.74).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function AdProDiscussionCard({
  entityType, entityId, user,
}: {
  entityType: EntityType;
  entityId: string;
  user: SessionUser & { id: string };
}) {
  const rows = await prisma.comment.findMany({
    where: { entityType, entityId },
    select: { id: true, body: true, createdAt: true, editedAt: true, authorId: true, author: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  // LE MÊME FAIT QUE L'ACTION, jamais un second : `canModerateEntity` est exactement ce que
  // `updateComment` / `deleteComment` vérifient. Un prédicat à part ici afficherait un bouton
  // que l'action refuse (§118.5).
  const canModerate = await canModerateEntity(user, entityType, entityId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{DISCUSSION_TITRE}</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">{DISCUSSION_AIDE}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 && (
          <p className="mb-3 text-sm text-muted-foreground">{DISCUSSION_VIDE}</p>
        )}
        <CommentThread
          comments={rows.map((c) => ({
            id: c.id,
            author: c.author?.name ?? "—",
            authorId: c.authorId,
            body: c.body,
            createdAt: c.createdAt.toISOString(),
            editedAt: c.editedAt?.toISOString() ?? null,
          }))}
          action={addAdProComment}
          hiddenFields={{ entityType, entityId }}
          currentUserId={user.id}
          canModerate={canModerate}
          updateAction={updateComment}
          deleteAction={deleteComment}
          // LE CHEMIN VOYAGE : les actions canoniques revalident ce que le composant leur donne,
          // et l'adresse d'une entité se lit UNE fois (`entityHref`) — la recopier par nature
          // ferait sept chemins qui divergent au premier renommage de route.
          path={entityHref(entityType, entityId) ?? undefined}
        />
      </CardContent>
    </Card>
  );
}
