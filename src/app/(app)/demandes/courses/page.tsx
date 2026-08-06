import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView, anyRoleFilter } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getDriverMissions, getMissionAttachments } from "@/lib/queries/admin-requests";
import { PageHeader } from "@/components/shared/page-header";
import { CoursesBoard, type CourseDTO } from "./courses-board";
import { BackLink } from "@/components/shared/back-link";

/**
 * Espace « Courses » du bureau du secrétariat (+ super admin, Direction, et tout
 * rôle à qui le Super Admin accorde « Modifier » sur le module) : demander une
 * course au chauffeur / coordinateur, avec points de passage, échéance et pièces.
 */
export default async function CoursesPage() {
  const user = await requireModule("ADMIN_REQUESTS");
  const canManage = hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE");
  if (!canManage) redirect("/demandes");

  const [missions, drivers, everyone] = await Promise.all([
    getDriverMissions(user),
    prisma.user.findMany({
      where: { isActive: true, ...anyRoleFilter(["COORDINATOR"]) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const driverIds = new Set(drivers.map((d) => d.id));
  const others = everyone.filter((u) => !driverIds.has(u.id));
  const attachments = await getMissionAttachments(missions.map((m) => m.id));

  const rows: CourseDTO[] = missions.map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status,
    assignee: m.assignedTo?.name ?? null,
    deadline: m.deadline?.toISOString() ?? null,
    contactName: m.contactName,
    contactPhone: m.contactPhone,
    instructions: m.instructions,
    startLocation: m.startLocation,
    destination: m.destination,
    address: m.address,
    createdAt: m.createdAt.toISOString(),
    request: m.request ? { id: m.request.id, reference: m.request.reference } : null,
    stops: m.stops.map((s) => ({ id: s.id, location: s.location, task: s.task, done: s.done })),
    attachments: attachments.get(m.id) ?? [],
  }));

  return (
    <div className="space-y-5">
      <BackLink href="/demandes">
        <ArrowLeft className="h-4 w-4" /> Bureau du secrétariat
      </BackLink>
      <PageHeader
        title="Courses"
        description="Demandez une course au chauffeur ou au coordinateur : points de passage (A, B, C…), quoi faire à chaque point, date et heure max, pièces jointes."
      />
      <CoursesBoard courses={rows} drivers={drivers} others={others} />
    </div>
  );
}
