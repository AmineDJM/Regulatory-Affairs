import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { accessibleModules, userCan } from "@/lib/rbac";
import { NAVIGATION } from "@/lib/labels";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ActivityTracker } from "@/components/layout/activity-tracker";
import { CommandPalette } from "@/components/layout/command-palette";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { getTotalUnread } from "@/lib/queries/messaging";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  const modules = accessibleModules(user);
  const navItems = NAVIGATION.filter((n) => modules.includes(n.module));
  const canMessage = userCan(user, "MESSAGING", "VIEW");
  const [unreadCount, messagingUnread] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    canMessage ? getTotalUnread(user.id) : Promise.resolve(0),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ActivityTracker />
      <CommandPalette navItems={navItems} />
      <Sidebar items={navItems} messagingUnread={messagingUnread} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {user.impersonatedBy && <ImpersonationBanner adminName={user.impersonatedBy.name} viewedName={user.name} />}
        <Topbar navItems={navItems} user={user} unreadCount={unreadCount} canMessage={canMessage} messagingUnread={messagingUnread} />
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-[1400px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
