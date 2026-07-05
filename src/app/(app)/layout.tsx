import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { accessibleModules, userCan } from "@/lib/rbac";
import { NAVIGATION, type NavItem } from "@/lib/labels";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ActivityTracker } from "@/components/layout/activity-tracker";
import { CommandPalette } from "@/components/layout/command-palette";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { FloatingAssistant } from "@/components/layout/floating-assistant";
import { PushRegister } from "@/components/layout/push-register";
import { getTotalUnread } from "@/lib/queries/messaging";
import { getAdoptionBadge } from "@/lib/adoption";
import { aiConfigured } from "@/lib/ai";
import { getCompanies, getCompanyScope } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  // Onboarding guidé : lecture à chaud (BDD) plutôt que via le JWT — la fin du
  // parcours prend effet immédiatement, sans forcer une reconnexion.
  if (!user.impersonatedBy) {
    const flags = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mustOnboard: true },
    });
    if (flags?.mustOnboard) redirect("/onboarding");
  }
  const modules = accessibleModules(user);
  // Entrées fusionnées (`tabs`) : visibles si l'utilisateur a accès à au moins un
  // onglet ; le lien pointe vers le premier onglet autorisé, et `match` couvre les
  // chemins de tous les onglets pour le surlignage. Les entrées simples sont
  // filtrées par leur module, comme avant.
  const navItems = NAVIGATION.reduce<NavItem[]>((acc, n) => {
    if (!n.tabs) {
      if (modules.includes(n.module)) acc.push(n);
      return acc;
    }
    const accessible = n.tabs.filter((t) => modules.includes(t.module));
    if (accessible.length > 0) {
      acc.push({ ...n, href: accessible[0].href, match: n.tabs.map((t) => t.href) });
    }
    return acc;
  }, []);
  const canMessage = userCan(user, "MESSAGING", "VIEW");
  const [unreadCount, messagingUnread, adoption, companies] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    canMessage ? getTotalUnread(user.id) : Promise.resolve(0),
    // Pastille « score d'adoption » de l'utilisateur courant (snapshot mis en cache).
    getAdoptionBadge(user.id, user.role).catch(() => null),
    // Entités (sélecteur multi-sociétés de la barre supérieure).
    getCompanies().catch(() => []),
  ]);
  const companyScope = getCompanyScope();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ActivityTracker />
      <CommandPalette navItems={navItems} />
      <Sidebar items={navItems} messagingUnread={messagingUnread} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {user.impersonatedBy && <ImpersonationBanner adminName={user.impersonatedBy.name} viewedName={user.name} />}
        <Topbar navItems={navItems} user={user} unreadCount={unreadCount} canMessage={canMessage} messagingUnread={messagingUnread} adoption={adoption} companies={companies} companyScope={companyScope} />
        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-6 lg:px-8 lg:pb-8">
          <div className="mx-auto max-w-[1400px] space-y-6">{children}</div>
        </main>
      </div>
      {/* Assistant flottant — présent partout (remplace l'onglet Assistant IA). */}
      <FloatingAssistant userName={user.name} configured={aiConfigured()} />
      {/* Notifications push (PWA) : enregistre le service worker + (ré)abonne l'appareil. */}
      <PushRegister />
    </div>
  );
}
