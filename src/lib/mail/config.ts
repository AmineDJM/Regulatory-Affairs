/**
 * LA CONFIGURATION MICROSOFT 365 — ce que le serveur doit connaître, et rien de plus.
 *
 * Quatre valeurs viennent d'Entra (locataire, application, secret, URL de retour). Aucune ne porte
 * de préfixe `NEXT_PUBLIC_` : le secret d'application ne doit jamais atteindre un navigateur, et
 * un nom public rendrait cette faute possible sans que personne ne la remarque.
 *
 * Module PUR — il reçoit l'environnement en argument, donc il se teste sans variables réelles.
 */

export type Env = Record<string, string | undefined>;

export interface MicrosoftMailConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Les seuls droits demandés — voir `SCOPES` pour la justification de chacun. */
export const SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "User.Read",
  "Mail.ReadWrite",
  "Mail.Send",
] as const;

export const SCOPE_STRING = SCOPES.join(" ");

const REQUIRED = ["MICROSOFT_TENANT_ID", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI"];

export function resolveMicrosoftConfig(env: Env): MicrosoftMailConfig | null {
  const tenantId = env.MICROSOFT_TENANT_ID?.trim();
  const clientId = env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = env.MICROSOFT_CLIENT_SECRET?.trim();
  const redirectUri = env.MICROSOFT_REDIRECT_URI?.trim();
  if (!tenantId || !clientId || !clientSecret || !redirectUri) return null;
  return { tenantId, clientId, clientSecret, redirectUri: redirectUri.replace(/\/+$/, "") };
}

/** Ce qui manque, NOMMÉ — « non configuré » envoie relire un panneau où tout paraît rempli. */
export function missingMicrosoftVars(env: Env): string[] {
  return REQUIRED.filter((k) => !env[k]?.trim());
}

/**
 * LE DRAPEAU DU PILOTE. Tant qu'il est fermé, la messagerie Microsoft n'existe pour personne —
 * même configurée. On valide sur une boîte avant d'ouvrir à l'entreprise.
 *
 * `MICROSOFT_MAIL_PILOT` liste les adresses autorisées (séparées par des virgules). Vide = seul le
 * Super Admin peut entrer, ce qui est le comportement voulu au premier jour.
 */
export function pilotMailboxes(env: Env): string[] {
  return (env.MICROSOFT_MAIL_PILOT ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function microsoftMailEnabled(env: Env): boolean {
  const raw = (env.MICROSOFT_MAIL ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** URL d'autorisation et URL de jetons du locataire — le reste de Graph est constant. */
export const authorizeUrl = (tenantId: string) =>
  `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize`;
export const tokenUrl = (tenantId: string) =>
  `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
