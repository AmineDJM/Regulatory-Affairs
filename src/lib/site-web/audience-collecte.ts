import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { adresseDuSite } from "./config";
import {
  analyserAgent, paysDepuisEntetes, sourceDepuis, validerLot, CORPS_MAX, RETENTION_MOIS, type EvenementValide,
} from "./audience-calc";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA COLLECTE DE L'AUDIENCE (Direction, 07/10) — `POST /api/site-web/v1/audience`.
 *
 * C'est la seule route PUBLIQUE de `v1/` qui écrive : elle est appelée par le NAVIGATEUR des
 * visiteurs du site, où aucun secret ne peut vivre. Sa porte n'est donc pas une clé, mais :
 *   1. l'ORIGINE — celle du site (`ADVENTUM_BASE_URL`, avec et sans `www.`), rien d'autre ;
 *   2. un DÉBIT borné par adresse IP (120 événements par minute, en mémoire) ;
 *   3. une validation stricte de chaque champ (`audience-calc.ts`).
 * Et elle n'écrit QUE dans `SiteAnalyticsEvent` — un cliquet le tient (`liaison-portes.test.ts`).
 *
 * ── CE QUI N'EST JAMAIS GARDÉ ────────────────────────────────────────────────────────────
 *
 * Ni l'adresse IP, ni l'agent utilisateur : `visitor` est le condensat (sha256) du SEL DU JOUR,
 * de l'IP et de l'agent. Le sel dérive d'un secret serveur et de la date (heure d'Alger) : le même
 * visiteur a une autre empreinte demain, et personne — pas même l'ERP — ne peut la relier à
 * celle d'hier ni remonter à l'IP. L'identifiant de session du navigateur est condensé de même.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const DEBIT_PAR_MINUTE = 120;

/** Les origines admises : celle du site, et sa variante avec ou sans `www.`. */
export function originesAutorisees(env: NodeJS.ProcessEnv = process.env): string[] {
  const a = adresseDuSite(env);
  if (!a.ok) return [];
  try {
    const u = new URL(a.racine);
    const hote = u.hostname.replace(/^www\./, "");
    const port = u.port ? `:${u.port}` : "";
    const out = new Set([`${u.protocol}//${u.hostname}${port}`]);
    if (hote !== "localhost" && !/^[\d.]+$/.test(hote)) {
      out.add(`${u.protocol}//${hote}${port}`);
      out.add(`${u.protocol}//www.${hote}${port}`);
    }
    return [...out];
  } catch {
    return [];
  }
}

/** Les hôtes du site — un référent venu d'eux est une navigation interne (« Direct »). */
export function hotesDuSite(env: NodeJS.ProcessEnv = process.env): string[] {
  return originesAutorisees(env).map((o) => new URL(o).hostname.replace(/^www\./, ""));
}

export function entetesCors(origine: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origine,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// ───────────────────────────── Le débit ─────────────────────────────

const compteurs = new Map<string, { debut: number; n: number }>();

/** Combien d'événements cette adresse peut encore envoyer dans la minute (et les lui compte). */
export function prendreDebit(ip: string, demandes: number, maintenant = Date.now()): number {
  if (compteurs.size > 20_000) {
    for (const [k, v] of compteurs) if (maintenant - v.debut >= 60_000) compteurs.delete(k);
    if (compteurs.size > 20_000) compteurs.clear();
  }
  let c = compteurs.get(ip);
  if (!c || maintenant - c.debut >= 60_000) {
    c = { debut: maintenant, n: 0 };
    compteurs.set(ip, c);
  }
  const accordes = Math.max(0, Math.min(demandes, DEBIT_PAR_MINUTE - c.n));
  c.n += accordes;
  return accordes;
}

/** Pour les bancs : repartir d'un compteur vide. */
export function oublierDebits(): void {
  compteurs.clear();
}

// ───────────────────────────── L'empreinte du jour ─────────────────────────────

let selDeSecours: string | null = null;

function secretServeur(env: NodeJS.ProcessEnv): string {
  const s = (env.ADVENTUM_WEBHOOK_SECRET || env.AUTH_SECRET || env.NEXTAUTH_SECRET || "").trim();
  if (s) return s;
  // Sans secret, un sel tiré au démarrage : moins stable (un redémarrage recompte), jamais devinable.
  selDeSecours ??= randomBytes(32).toString("hex");
  return selDeSecours;
}

/** Le jour d'Alger « AAAA-MM-JJ ». */
function jourAlger(t: number): string {
  return new Date(t + 3_600_000).toISOString().slice(0, 10);
}

export function selDuJour(maintenant = Date.now(), env: NodeJS.ProcessEnv = process.env): string {
  return createHash("sha256").update(`audience\n${secretServeur(env)}\n${jourAlger(maintenant)}`, "utf8").digest("hex");
}

export function empreinteVisiteur(ip: string, agent: string, maintenant = Date.now(), env: NodeJS.ProcessEnv = process.env): string {
  return createHash("sha256").update(`${selDuJour(maintenant, env)}\n${ip}\n${agent}`, "utf8").digest("hex").slice(0, 32);
}

function empreinteSession(session: string, maintenant: number, env: NodeJS.ProcessEnv): string {
  return createHash("sha256").update(`${selDuJour(maintenant, env)}\nsession\n${session}`, "utf8").digest("hex").slice(0, 24);
}

/** L'adresse du client, telle que l'hébergeur la transmet — lue, jamais écrite. */
export function adresseClient(get: (nom: string) => string | null): string {
  const xff = (get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  return xff || (get("x-real-ip") ?? "").trim() || "inconnue";
}

// ───────────────────────────── La porte ─────────────────────────────

export type Porte =
  | { ok: true; origine: string }
  | { ok: false; statut: 403; erreur: string };

/** LA PORTE DE LA ROUTE : l'origine doit être celle du site. Rien n'est lu avant elle. */
export function porteAudience(entetes: Headers, env: NodeJS.ProcessEnv = process.env): Porte {
  const origine = (entetes.get("origin") ?? "").trim();
  if (!origine || !originesAutorisees(env).includes(origine)) {
    return { ok: false, statut: 403, erreur: "Origine refusée." };
  }
  return { ok: true, origine };
}

// ───────────────────────────── L'écriture ─────────────────────────────

export type Reception =
  | { ok: true; enregistres: number }
  | { ok: false; statut: 400 | 413 | 429; erreur: string };

/**
 * ENREGISTRE UN LOT reçu du navigateur. `corps` est la chaîne reçue (bornée ici), `entetes` ceux de
 * la requête (agent, adresse, pays, Do Not Track). Un robot ou un « ne pas me suivre » : rien n'est
 * écrit, et la réponse est la même (204) — le dire n'apprendrait rien d'utile à personne.
 */
export async function enregistrerAudience(
  corps: string, entetes: Headers, env: NodeJS.ProcessEnv = process.env, maintenant = new Date(),
): Promise<Reception> {
  if (corps.length > CORPS_MAX) return { ok: false, statut: 413, erreur: "Lot trop lourd." };
  const get = (n: string) => entetes.get(n);
  if ((get("dnt") ?? "").trim() === "1" || (get("sec-gpc") ?? "").trim() === "1") return { ok: true, enregistres: 0 };
  const agent = (get("user-agent") ?? "").slice(0, 512);
  const ua = analyserAgent(agent);
  if (ua.robot) return { ok: true, enregistres: 0 };

  let brut: unknown;
  try {
    brut = JSON.parse(corps);
  } catch {
    return { ok: false, statut: 400, erreur: "Corps illisible." };
  }
  const evenements = validerLot(brut);
  if (evenements.length === 0) return { ok: true, enregistres: 0 };

  const ip = adresseClient(get);
  const accordes = prendreDebit(ip, evenements.length, maintenant.getTime());
  if (accordes === 0) return { ok: false, statut: 429, erreur: "Trop d'événements." };

  const t = maintenant.getTime();
  const visitor = empreinteVisiteur(ip, agent, t, env);
  const pays = paysDepuisEntetes(get);
  const hotes = hotesDuSite(env);
  const lignes = evenements.slice(0, accordes).map((e: EvenementValide) => ({
    at: maintenant,
    type: e.type,
    path: e.path,
    title: e.title,
    referrer: e.referrer && !hotes.includes(e.referrer) ? e.referrer : null,
    source: sourceDepuis({ utmSource: e.utmSource, referrerHost: e.referrer, hotesDuSite: hotes }),
    medium: e.medium,
    campaign: e.campaign,
    visitor,
    session: e.session ? empreinteSession(e.session, t, env) : null,
    device: ua.device,
    browser: ua.browser,
    os: ua.os,
    country: pays,
    label: e.label,
    target: e.target,
    durationMs: e.durationMs,
  }));
  await prisma.siteAnalyticsEvent.createMany({ data: lignes });
  return { ok: true, enregistres: lignes.length };
}

/** Le dernier événement reçu — l'état de la mesure sur l'écran de la liaison. */
export async function dernierEvenementRecu(): Promise<Date | null> {
  const l = await prisma.siteAnalyticsEvent.findFirst({ orderBy: { at: "desc" }, select: { at: true } });
  return l?.at ?? null;
}

// ───────────────────────────── La purge ─────────────────────────────

let dernierePurge = 0;

/** Supprime les événements de plus de 13 mois — au plus une fois par jour et par processus. */
export async function purgerAudienceSiDu(maintenant = new Date()): Promise<number> {
  if (maintenant.getTime() - dernierePurge < 86_400_000) return 0;
  dernierePurge = maintenant.getTime();
  const limite = new Date(maintenant);
  limite.setUTCMonth(limite.getUTCMonth() - RETENTION_MOIS);
  const r = await prisma.siteAnalyticsEvent.deleteMany({ where: { at: { lt: limite } } });
  return r.count;
}
