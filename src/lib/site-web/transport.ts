import { createHmac } from "node:crypto";
import { exigerSortieAutorisee } from "@/lib/sortie/garde";
import { lireConfiguration } from "./config";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE TRANSPORT VERS LE SITE ADVENTUM (§118.158) — la SEULE fonction du dépôt qui l'appelle.
 *
 * Une requête, et rien d'autre : la file décide quand réessayer, la réconciliation décide quoi
 * repousser. Ici on tient le contrat du lien lui-même :
 *
 *   • LA GARDE DE SORTIE D'ABORD, avant même de lire la clé. En test, sur un banc, sous
 *     `ADAM_SORTIE_INTERDITE`, la requête ne part pas — y compris un GET : toute requête vers le
 *     site porte la clé qui donne le droit de PUBLIER, et un test ne doit dépendre ni de la
 *     disponibilité du site public, ni lui transmettre ce droit. La garde s'arme sur le CANAL,
 *     pas sur le verbe (§118.88).
 *   • LA CLÉ DANS L'EN-TÊTE, jamais dans l'URL ; l'identifiant externe ENCODÉ dans le chemin.
 *   • LA SIGNATURE SUR LES OCTETS EXACTS : la chaîne reçue est celle que la file a sérialisée
 *     une fois ; on la signe telle quelle, on l'envoie telle quelle (contrat §3).
 *   • DIX SECONDES au plus par requête (contrat §7), puis la requête est abandonnée et DITE
 *     comme telle — « délai dépassé » n'est pas « le site a refusé ».
 *   • AUCUNE REDIRECTION SUIVIE : un PUT redirigé pourrait être rejoué ailleurs, en GET, ou
 *     emporter la clé vers un autre hôte. La redirection est rendue telle quelle ; la file la
 *     classe comme une adresse fausse.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface RequeteSite {
  methode: "GET" | "PUT" | "DELETE";
  /** Relatif à l'API : `/jobs/<externalId>`, `/posts`, `/health`. */
  chemin: string;
  /** La chaîne JSON EXACTE à envoyer (PUT). Jamais reconstruite ici. */
  corps?: string | null;
  /** Pour les bancs seulement : un délai plus court que les dix secondes du contrat. */
  delaiMs?: number;
}

export interface ReponseSite {
  /** Nul = aucune réponse HTTP (réseau, délai dépassé). */
  statut: number | null;
  texte: string | null;
  erreur: string | null;
  ms: number;
  /** `Retry-After`, en secondes, s'il a été envoyé avec un 429 ou un 503. */
  retryAfterS: number | null;
  /** La cible d'une redirection, pour la NOMMER dans l'alerte. */
  location: string | null;
}

/** Le transport est injectable : les bancs de la file et de la réconciliation n'ouvrent aucun réseau. */
export type TransportSite = (r: RequeteSite) => Promise<ReponseSite>;

export const DELAI_REQUETE_MS = 10_000;

/** `Retry-After` : un nombre de secondes, ou une date HTTP. */
export function lireRetryAfter(v: string | null, maintenant = Date.now()): number | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d+$/.test(s)) return Number(s);
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.ceil((t - maintenant) / 1000));
}

export function signer(corps: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(corps, "utf8").digest("hex")}`;
}

/**
 * ENVOIE UNE REQUÊTE AU SITE. Ne lève jamais pour une panne réseau (elle est rendue, avec sa
 * cause) ; lève `SortieInterdite` quand ce processus n'a pas le droit de sortir — et c'est
 * volontaire : la file doit savoir que RIEN n'est parti, pas croire à une panne du site.
 */
export async function envoyerAuSite(r: RequeteSite): Promise<ReponseSite> {
  // LA PORTE, avant la moindre lecture de la clé ou de l'adresse.
  exigerSortieAutorisee("ECRITURE_EXTERNE", `site-adventum ${r.methode} ${r.chemin}`, {
    apercu: r.corps ? `${r.corps.length} caractères` : undefined,
    origine: "site-web",
  });

  const lecture = lireConfiguration();
  if (!lecture.ok) {
    // La file vérifie la configuration AVANT d'appeler ; ce retour n'est qu'un filet. Il n'est pas
    // classé « réessayer » par erreur : aucune requête n'est partie, et la cause est nommée.
    return { statut: null, texte: null, erreur: lecture.raison, ms: 0, retryAfterS: null, location: null };
  }
  const { base, cle, secret } = lecture.config;
  const headers: Record<string, string> = { Authorization: `Bearer ${cle}`, Accept: "application/json" };
  const corps = r.methode === "PUT" ? (r.corps ?? "") : null;
  if (corps !== null) {
    headers["Content-Type"] = "application/json";
    if (secret) headers["X-Adventum-Signature"] = signer(corps, secret);
  }

  const delai = r.delaiMs ?? DELAI_REQUETE_MS;
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delai);
  const debut = Date.now();
  try {
    const res = await fetch(`${base}${r.chemin}`, {
      method: r.methode,
      headers,
      body: corps ?? undefined,
      redirect: "manual",
      signal: controleur.signal,
      cache: "no-store",
    });
    const texte = await res.text().catch(() => null);
    return {
      statut: res.status,
      texte,
      erreur: null,
      ms: Date.now() - debut,
      retryAfterS: lireRetryAfter(res.headers.get("retry-after")),
      location: res.headers.get("location"),
    };
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    return {
      statut: null,
      texte: null,
      erreur: controleur.signal.aborted ? `délai dépassé (${delai} ms)` : `site injoignable : ${cause}`,
      ms: Date.now() - debut,
      retryAfterS: null,
      location: null,
    };
  } finally {
    clearTimeout(minuteur);
  }
}
