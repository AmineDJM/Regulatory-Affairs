import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import {
  monthGrid, getCalendarEvents, getUpcomingEvents, algiersInputToUtc, algiersTodayYmd,
} from "@/lib/calendar";
import { CalendarView } from "./calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: { y?: string; m?: string } }) {
  const user = await requireModule("WORKSPACE");

  const [ty, tm] = algiersTodayYmd().split("-").map(Number);
  const year = Number(searchParams.y) || ty;
  const month = (Number(searchParams.m) >= 1 && Number(searchParams.m) <= 12 ? Number(searchParams.m) : tm) - 1; // 0-based

  const grid = monthGrid(year, month);
  // Fenêtre UTC couvrant la grille affichée (jours d'Alger).
  const from = algiersInputToUtc(`${grid[0].ymd}T00:00`)!;
  const to = new Date(algiersInputToUtc(`${grid[grid.length - 1].ymd}T00:00`)!.getTime() + 86400000);

  const [events, upcoming, users] = await Promise.all([
    getCalendarEvents(user, from, to),
    getUpcomingEvents(user, 8),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const canCreate = userCan(user, "WORKSPACE", "CREATE");

  return (
    <div className="space-y-5">
      <PageHeader title="Calendrier" description="Vos rendez-vous, réunions et informations importantes — au fuseau d'Alger. Créez des rendez-vous et invitez vos collègues. L'assistant IA peut aussi les planifier pour vous." />
      <CalendarView
        year={year}
        month={month}
        grid={grid}
        events={events}
        upcoming={upcoming}
        users={users}
        currentUserId={user.id}
        canCreate={canCreate}
      />
    </div>
  );
}
