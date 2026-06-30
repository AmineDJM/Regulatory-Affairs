import { prisma } from "@/lib/prisma";
import { hasGlobalView } from "@/lib/rbac";
import { notifyUser } from "@/lib/notify";
import { algiersYmd, algiersTime, formatAlgiers } from "@/lib/calendar-tz";
import type { CalendarEventKind, CalendarInviteStatus, UserRole } from "@prisma/client";

// Réexport des helpers purs (fuseau d'Alger) pour les consommateurs serveur.
export {
  ALGIERS_TZ, CALENDAR_KINDS, algiersYmd, algiersTime, algiersInputToUtc,
  utcToAlgiersInput, formatAlgiers, algiersTodayYmd, monthGrid, MONTH_LABELS, type GridDay,
} from "@/lib/calendar-tz";

export interface SessionLike { id: string; role: UserRole }

// ───────────────────────── DTO + requêtes ─────────────────────────

export interface CalendarInviteeDTO { userId: string; name: string; status: CalendarInviteStatus }

export interface CalendarEventDTO {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  kind: CalendarEventKind;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  color: string | null;
  meetLink: string | null;
  organizerId: string;
  organizerName: string;
  isOrganizer: boolean;
  myStatus: CalendarInviteStatus | null;
  ymd: string; // jour d'Alger du début (placement dans la grille)
  timeLabel: string; // heure d'Alger « HH:mm » (vide si journée entière)
  invitees: CalendarInviteeDTO[];
}

type EventRow = {
  id: string; title: string; description: string | null; location: string | null;
  kind: CalendarEventKind; startAt: Date; endAt: Date | null; allDay: boolean; color: string | null;
  meetLink: string | null; organizerId: string; organizer: { name: string };
  invitees: { userId: string; status: CalendarInviteStatus; user: { name: string } }[];
};

function toDTO(e: EventRow, userId: string): CalendarEventDTO {
  const mine = e.invitees.find((i) => i.userId === userId);
  return {
    id: e.id, title: e.title, description: e.description, location: e.location, kind: e.kind,
    startAt: e.startAt.toISOString(), endAt: e.endAt?.toISOString() ?? null, allDay: e.allDay,
    color: e.color, meetLink: e.meetLink, organizerId: e.organizerId, organizerName: e.organizer.name,
    isOrganizer: e.organizerId === userId, myStatus: mine?.status ?? null,
    ymd: algiersYmd(e.startAt), timeLabel: e.allDay ? "" : algiersTime(e.startAt),
    invitees: e.invitees.map((i) => ({ userId: i.userId, name: i.user.name, status: i.status })),
  };
}

/** Portée : un utilisateur voit les événements qu'il organise ou auxquels il est invité. */
function scopeWhere(user: SessionLike) {
  if (hasGlobalView(user.role)) return {};
  return { OR: [{ organizerId: user.id }, { invitees: { some: { userId: user.id } } }] };
}

const includeRel = { organizer: { select: { name: true } }, invitees: { include: { user: { select: { name: true } } } } };

/** Événements visibles dans une fenêtre [from, to) (la grille affichée du mois). */
export async function getCalendarEvents(user: SessionLike, from: Date, to: Date): Promise<CalendarEventDTO[]> {
  const rows = await prisma.calendarEvent.findMany({
    where: { AND: [scopeWhere(user), { startAt: { gte: from, lt: to } }] },
    include: includeRel,
    orderBy: { startAt: "asc" },
  });
  return rows.map((r) => toDTO(r as EventRow, user.id));
}

/** Prochains événements de l'utilisateur (agenda à droite). */
export async function getUpcomingEvents(user: SessionLike, limit = 8): Promise<CalendarEventDTO[]> {
  const rows = await prisma.calendarEvent.findMany({
    where: { AND: [scopeWhere(user), { startAt: { gte: new Date(Date.now() - 3600000) } }] },
    include: includeRel,
    orderBy: { startAt: "asc" },
    take: limit,
  });
  return rows.map((r) => toDTO(r as EventRow, user.id));
}

/** Un événement (si l'utilisateur y a accès). */
export async function getCalendarEvent(user: SessionLike, id: string): Promise<CalendarEventDTO | null> {
  const e = await prisma.calendarEvent.findFirst({
    where: { AND: [{ id }, scopeWhere(user)] },
    include: includeRel,
  });
  return e ? toDTO(e as EventRow, user.id) : null;
}

export interface NewCalendarEvent {
  title: string;
  description?: string | null;
  location?: string | null;
  kind?: CalendarEventKind;
  startAt: Date;
  endAt?: Date | null;
  allDay?: boolean;
  color?: string | null;
  meetLink?: string | null;
  inviteeIds?: string[];
}

/**
 * Crée un événement de calendrier (organisateur = userId) + invitations + notifications.
 * Réutilisé par l'action serveur et par l'outil de l'assistant IA.
 */
export async function createEventForUser(userId: string, data: NewCalendarEvent): Promise<string> {
  const invitees = Array.from(new Set((data.inviteeIds ?? []).filter((id) => id && id !== userId)));
  const event = await prisma.calendarEvent.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      location: data.location ?? null,
      kind: data.kind ?? "APPOINTMENT",
      startAt: data.startAt,
      endAt: data.endAt ?? null,
      allDay: data.allDay ?? false,
      color: data.color ?? null,
      meetLink: data.meetLink ?? null,
      organizerId: userId,
      createdById: userId,
      invitees: invitees.length ? { create: invitees.map((id) => ({ userId: id })) } : undefined,
    },
  });

  const when = data.allDay ? formatAlgiers(data.startAt, { day: "2-digit", month: "long", year: "numeric" })
    : formatAlgiers(data.startAt, { weekday: "short", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
  await Promise.all(invitees.map((id) =>
    notifyUser({ userId: id, type: "ASSIGNMENT", title: "Invitation à un rendez-vous", body: `${data.title} — ${when}`, link: "/calendar" }).catch(() => {}),
  ));
  return event.id;
}
