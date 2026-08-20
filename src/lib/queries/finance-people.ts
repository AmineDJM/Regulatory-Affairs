import { prisma } from "@/lib/prisma";
import { rolesWithModule } from "@/lib/rbac";

/**
 * LES DESTINATAIRES D'UNE DEMANDE DE PAIEMENT — les personnes des Finances, pas toute la société.
 *
 * On croise deux sources, et les deux comptent : les RÔLES qui gouvernent le module (lus dans la
 * matrice RBAC, jamais devinés depuis une liste écrite à la main) et les accès accordés au cas
 * par cas par le Super Admin. Sans la seconde, un contrôleur promu par autorisation nominative
 * n'apparaîtrait jamais dans le menu, et la demande partirait à quelqu'un d'autre.
 *
 * Extrait ici parce que la liste sert désormais depuis DEUX écrans (les Finances et le bureau de
 * validation) : recopiée, elle aurait divergé sur l'une des deux sources.
 */
export async function financeRecipients(): Promise<{ id: string; name: string }[]> {
  const financeRoles = rolesWithModule("FINANCES");
  return prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: { in: financeRoles } },
        { access: { some: { module: "FINANCES", canView: true } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
