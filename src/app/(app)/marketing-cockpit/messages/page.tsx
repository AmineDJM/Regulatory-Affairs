import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { peutEcrireMessagesPromo } from "@/lib/sfe/tournee";
import { EnTeteMarketingCockpit } from "../en-tete";
import { MessagesManager } from "./messages-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketing cockpit — Messages — AMD Internal OS" };

/**
 * LES MESSAGES PRÉ-DÉFINIS DE LA DIRECTION MARKETING — onglet du MARKETING COCKPIT (Sales &
 * Marketing), déplacé depuis Force de vente le 06/10. Les droits n'ont pas bougé.
 *
 * Chaque rapport terrain EXIGE au moins un message : sans référentiel, ce qu'un KAM porte au
 * médecin n'existait qu'en texte libre, donc personne ne pouvait mesurer quel message passe.
 *
 * ── L'ÉCRAN SE VOIT MÊME QUAND ON NE PEUT PAS ÉCRIRE ────────────────────────────────────────
 *
 * La LECTURE suit le module (Force de vente) ; l'ÉCRITURE est une liste de rôles que le Super
 * Admin pose (`promoMessageAuthorRoles`), parce que Direction Marketing n'a que la lecture sur
 * la promotion médicale et que lui donner l'écriture du module lui ouvrirait aussi les
 * praticiens et les visites (§118.16). Quand la personne ne peut pas écrire, l'écran le DIT avec
 * le geste qui accorde le droit — un écran muet se lit comme une panne.
 */
export default async function MessagesPage() {
  const user = await requireModule("SALES_PLANNING");
  const settings = await getAppSettings();
  const peutEcrire = peutEcrireMessagesPromo(user, settings.promoMessageAuthorRoles);

  const [messages, bus] = await Promise.all([
    prisma.promoMessage.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: {
        id: true, title: true, body: true, businessUnitId: true, isActive: true, sortOrder: true,
        businessUnit: { select: { name: true } },
        _count: { select: { visitLinks: true } },
      },
    }),
    prisma.businessUnit.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <EnTeteMarketingCockpit
        user={user}
        title="Marketing cockpit — Messages"
        description="Ce que le KAM doit dire au médecin. Chaque rapport terrain en exige au moins un — c'est ce qui rend leur efficacité mesurable."
      />
      <MessagesManager
        messages={messages.map((m) => ({
          id: m.id, title: m.title, body: m.body,
          businessUnitId: m.businessUnitId, buName: m.businessUnit?.name ?? null,
          isActive: m.isActive, sortOrder: m.sortOrder, usages: m._count.visitLinks,
        }))}
        bus={bus}
        peutEcrire={peutEcrire}
      />
    </div>
  );
}
