import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { accessibleModules } from "@/lib/rbac";
import { NAVIGATION } from "@/lib/labels";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ActivityTracker } from "@/components/layout/activity-tracker";
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
  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ActivityTracker />
      <Sidebar items={navItems} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar navItems={navItems} user={user} unreadCount={unreadCount} />
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-[1400px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
