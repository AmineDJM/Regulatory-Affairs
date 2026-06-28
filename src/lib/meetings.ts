import { randomBytes } from "crypto";
import type { SessionUser } from "@/lib/rbac";
import { hasGlobalView } from "@/lib/rbac";

/**
 * Appels & réunions via **Jitsi** (meet.jit.si par défaut — gratuit, sans compte, sans
 * configuration). On ne stocke aucune clé : une « salle » est juste un nom unique, et le
 * lien fonctionne immédiatement. Un domaine Jitsi auto-hébergé peut être fourni via
 * `JITSI_DOMAIN` (optionnel). Helpers purs (importables côté serveur et client).
 */

/** Domaine Jitsi (public par défaut ; surchargé par un déploiement auto-hébergé). */
export function jitsiDomain(): string {
  return (process.env.JITSI_DOMAIN || "meet.jit.si").replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

/** Préfixe d'espace pour éviter les collisions de salles sur le serveur public partagé. */
const ROOM_PREFIX = "AdventumOS";

/** Nom de salle Jitsi complet pour un slug de réunion. */
export function roomName(slug: string): string {
  return `${ROOM_PREFIX}-${slug}`;
}

/**
 * URL de la salle Jitsi. `display` renseigne le nom affiché ; `video=false` rejoint en
 * audio (caméra coupée au départ). Le hash `#config.*` est lu par Jitsi à l'ouverture.
 */
export function roomUrl(slug: string, opts: { display?: string; video?: boolean } = {}): string {
  const base = `https://${jitsiDomain()}/${encodeURIComponent(roomName(slug))}`;
  const cfg: string[] = [];
  if (opts.video === false) cfg.push("config.startWithVideoMuted=true");
  if (opts.display) cfg.push(`userInfo.displayName=${encodeURIComponent(`"${opts.display.replace(/"/g, "")}"`)}`);
  return cfg.length ? `${base}#${cfg.join("&")}` : base;
}

/** Lien externe public partageable (sans authentification, sans limite de temps). */
export function publicMeetPath(token: string): string {
  return `/meet/${token}`;
}
export function publicMeetUrl(token: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${publicMeetPath(token)}`;
}

/** URL publique de l'application (pour fabriquer le lien externe). */
export function appBaseUrlForMeet(): string {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || process.env.AUTH_URL || "").replace(/\/+$/, "");
}

// Identifiants url-safe (slug de salle court, jeton de lien externe plus long).
function token(bytes: number): string {
  return randomBytes(bytes).toString("base64").replace(/[+/=]/g, "").slice(0, bytes * 2);
}
export function genSlug(): string {
  return token(6).toLowerCase();
}
export function genPublicToken(): string {
  return token(16);
}

export interface MeetingAccessShape {
  organizerId: string;
  participants?: { userId: string }[];
}

/** Qui peut voir/rejoindre une réunion : organisateur, participant, ou vue globale. */
export function canViewMeeting(user: SessionUser, meeting: MeetingAccessShape): boolean {
  if (hasGlobalView(user.role)) return true;
  if (meeting.organizerId === user.id) return true;
  return (meeting.participants ?? []).some((p) => p.userId === user.id);
}

/** Qui peut gérer (clôturer, supprimer, lancer la transcription) : organisateur ou vue globale. */
export function canManageMeeting(user: SessionUser, meeting: MeetingAccessShape): boolean {
  return hasGlobalView(user.role) || meeting.organizerId === user.id;
}
