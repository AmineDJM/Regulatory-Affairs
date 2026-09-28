import { createHash } from "node:crypto";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA CONFIGURATION DE L'INTÉGRATION AU SITE ADVENTUM (§118.158) — lue dans l'environnement.
 *
 *   ADVENTUM_BASE_URL        l'adresse du site (`https://www.adventumdz.com`, ou l'URL Render)
 *   ADVENTUM_API_KEY         la clé partagée avec le site (`ERP_API_KEY` côté site)
 *   ADVENTUM_WEBHOOK_SECRET  facultatif : le secret de signature HMAC (`ERP_WEBHOOK_SECRET` côté site)
 *
 * « La clé donne le droit de publier sur le site public. Elle ne transite jamais dans une URL,
 * uniquement dans l'en-tête Authorization. Ne pas la committer dans un dépôt. » (contrat, §2)
 *
 * Elle vit donc dans le magasin de secrets de l'hébergeur (Render → Environment), jamais en base,
 * jamais dans un journal. Ce qui en sort de ce module pour l'écran ou la base, c'est une
 * EMPREINTE : un condensat tronqué, qui permet de savoir « est-ce la même clé qu'hier ? » sans
 * rien révéler d'elle.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface ConfigurationSite {
  /** L'adresse de l'API, normalisée : `https://www.adventumdz.com/api/v1`. */
  base: string;
  /** La racine publique du site, pour composer les liens (`https://www.adventumdz.com`). */
  racine: string;
  cle: string;
  secret: string | null;
  /**
   * Empreinte de (adresse, clé, secret de signature) — change dès que l'un des trois change. C'est
   * elle qui lève un blocage : un 401 peut venir de la clé comme de la SIGNATURE, et réparer l'une
   * ou l'autre doit suffire à relancer les envois.
   */
  empreinte: string;
}

export type LectureConfiguration =
  | { ok: true; config: ConfigurationSite }
  | { ok: false; raison: string; manquantes: string[] };

const HOTES_LOCAUX = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * L'ADRESSE DU SITE, normalisée. Elle accepte la racine (`https://www.adventumdz.com`, comme le
 * contrat la donne) ou l'adresse de l'API (`…/api/v1`), avec ou sans barre finale.
 *
 * Refus nommés, parce qu'une clé partirait avec chaque requête : pas de `http://` hors d'un poste
 * local (la clé circulerait en clair), pas d'identifiants dans l'adresse.
 */
export function normaliserBase(brut: string): { ok: true; base: string; racine: string } | { ok: false; raison: string } {
  const s = brut.trim();
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, raison: `ADVENTUM_BASE_URL n'est pas une adresse lisible (« ${s.slice(0, 80)} »).` };
  }
  const local = HOTES_LOCAUX.has(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) {
    return { ok: false, raison: "ADVENTUM_BASE_URL doit être en https : la clé d'API part avec chaque requête, elle ne circule jamais en clair." };
  }
  if (u.username || u.password) {
    return { ok: false, raison: "ADVENTUM_BASE_URL ne doit pas porter d'identifiants : la clé va dans ADVENTUM_API_KEY." };
  }
  const chemin = u.pathname.replace(/\/+$/, "");
  const racineChemin = chemin.endsWith("/api/v1") ? chemin.slice(0, -"/api/v1".length) : chemin;
  const origine = `${u.protocol}//${u.host}`;
  return { ok: true, base: `${origine}${racineChemin}/api/v1`, racine: `${origine}${racineChemin}` };
}

export function empreinteDe(base: string, cle: string, secret: string | null = null): string {
  return createHash("sha256").update(`${base}\n${cle}\n${secret ?? ""}`, "utf8").digest("hex").slice(0, 16);
}

/**
 * LIT LA CONFIGURATION. Rend ce qui MANQUE plutôt qu'un simple « non » : l'écran de l'intégration
 * affiche la liste, et la personne sait quelle variable poser.
 */
export function lireConfiguration(env: NodeJS.ProcessEnv = process.env): LectureConfiguration {
  const brutBase = (env.ADVENTUM_BASE_URL ?? "").trim();
  // Une clé collée depuis un terminal emporte souvent son retour à la ligne : on le retire. Une
  // espace AU MILIEU, en revanche, n'est pas une clé — c'est un collage raté, et on le dit.
  const cle = (env.ADVENTUM_API_KEY ?? "").trim();
  const secret = (env.ADVENTUM_WEBHOOK_SECRET ?? "").trim() || null;
  const manquantes = [!brutBase ? "ADVENTUM_BASE_URL" : null, !cle ? "ADVENTUM_API_KEY" : null].filter((x): x is string => x !== null);
  if (manquantes.length) {
    return { ok: false, raison: `Intégration au site non configurée : ${manquantes.join(" et ")} ${manquantes.length > 1 ? "manquent" : "manque"} (Render → Environment).`, manquantes };
  }
  if (/\s/.test(cle)) {
    return { ok: false, raison: "ADVENTUM_API_KEY contient une espace : la valeur collée n'est pas une clé entière.", manquantes: [] };
  }
  const base = normaliserBase(brutBase);
  if (!base.ok) return { ok: false, raison: base.raison, manquantes: [] };
  return { ok: true, config: { base: base.base, racine: base.racine, cle, secret, empreinte: empreinteDe(base.base, cle, secret) } };
}

/**
 * CE QUE L'ÉCRAN PEUT MONTRER de la configuration — et rien de plus. Jamais la clé, jamais sa
 * fin (les derniers caractères d'une clé en sont une partie) : seulement l'empreinte.
 */
export interface ApercuConfiguration {
  configuree: boolean;
  raison: string | null;
  manquantes: string[];
  adresse: string | null;
  racine: string | null;
  signature: boolean;
  empreinte: string | null;
}

export function apercuConfiguration(env: NodeJS.ProcessEnv = process.env): ApercuConfiguration {
  const l = lireConfiguration(env);
  if (!l.ok) {
    return { configuree: false, raison: l.raison, manquantes: l.manquantes, adresse: null, racine: null, signature: Boolean((env.ADVENTUM_WEBHOOK_SECRET ?? "").trim()), empreinte: null };
  }
  return { configuree: true, raison: null, manquantes: [], adresse: l.config.base, racine: l.config.racine, signature: l.config.secret !== null, empreinte: l.config.empreinte };
}

/** L'adresse publique complète d'un contenu, à partir de l'URL relative que le site a rendue. */
export function urlPublique(relative: string | null, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!relative) return null;
  if (/^https?:\/\//i.test(relative)) return relative;
  const l = lireConfiguration(env);
  if (!l.ok) return null;
  return `${l.config.racine}${relative.startsWith("/") ? "" : "/"}${relative}`;
}
