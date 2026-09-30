import { createHmac, timingSafeEqual } from "node:crypto";
import { ACTIVE, ATTENTE, cleActive, cleEnAttente, promouvoir } from "./cles";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUI ARRIVE DU SITE (§118.159) — l'authentification des appels que le SITE fait à l'ERP.
 *
 * Deux routes seulement l'emploient (`/api/site-web/v1/…`) : les candidatures déposées sur le site,
 * et la relecture de ses contenus quand il redémarre. Elles vivent HORS de la session (le site n'a
 * pas de compte), donc cette fonction EST leur porte — et un cliquet (`liaison.test.ts`) exige que
 * chaque route de ce dossier l'appelle avant tout le reste.
 *
 * ── LA MÊME CLÉ DANS LES DEUX SENS ──────────────────────────────────────────────────────
 *
 * Le site authentifie ses appels avec la clé qu'il connaît déjà (`ERP_API_KEY`), et signe ses corps
 * avec le même secret (`ERP_WEBHOOK_SECRET`). Une seconde clé pour l'autre sens aurait fait coller
 * DEUX blocs à une personne qui n'en veut qu'un, sans rien protéger de plus : quiconque détient
 * l'une détient déjà le droit de publier sur le site public.
 *
 * ── CE QUI EST ACCEPTÉ ──────────────────────────────────────────────────────────────────
 *
 *   • la clé ACTIVE de l'ERP ;
 *   • la clé EN ATTENTE — et c'est une PREUVE : le site ne peut la présenter que si quelqu'un l'a
 *     collée dans son environnement. Elle est promue sur-le-champ (rotation sans coupure) ;
 *   • la clé de l'environnement (`ADVENTUM_API_KEY`), seulement tant que l'ERP n'a pas de clé
 *     active : une fois qu'il en a une, le site ne porte plus l'ancienne, et l'accepter garderait
 *     vivant un identifiant que personne n'utilise plus.
 *
 * Toute requête doit être SIGNÉE dès que la clé présentée a un secret — c'est le cas de toute clé
 * générée par l'ERP : le HMAC-SHA256 du corps exact, de la CHAÎNE VIDE pour un GET. C'est la règle
 * que le site applique à l'ERP (`lib/api-auth.ts` du site : il vérifie aussi ses GET et ses DELETE),
 * donc une seule règle dans les deux sens. Un GET non signé laisserait une clé seule, fuitée d'un
 * journal de mandataire sans son secret, relire les offres PRÉPARÉES — un poste qu'on ouvre avant
 * que la personne qu'il remplace le sache (§118.158). La comparaison est à temps constant ; aucune
 * réponse ne dit laquelle des clés a failli.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type Authentification =
  | { ok: true; source: "ACTIVE" | "ATTENTE_PROMUE" | "ENVIRONNEMENT" }
  | { ok: false; statut: 401 | 503; erreur: string };

function egal(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

export function signatureAttendue(corps: string, secret: string): string {
  return createHmac("sha256", secret).update(corps, "utf8").digest("hex");
}

interface Candidate { source: "ACTIVE" | "ATTENTE" | "ENVIRONNEMENT"; cle: string; secret: string | null; id: string | null }

/** Le refus dit ce qu'il faut signer — le site le relaie tel quel sur l'écran de la liaison. */
export const SIGNATURE_REFUSEE =
  "Signature refusée : X-Adventum-Signature doit porter le HMAC-SHA256 du corps exact (de la chaîne vide pour un GET).";

/**
 * AUTHENTIFIE UN APPEL DU SITE. `corps` est la chaîne EXACTE reçue (nulle sur un GET, signée alors
 * comme la chaîne vide) : c'est elle qui est signée, jamais un JSON relu et resérialisé.
 */
export async function authentifierLeSite(
  entetes: Headers,
  corps: string | null,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Authentification> {
  const [active, attente] = await Promise.all([cleActive(), cleEnAttente()]);
  const candidates: Candidate[] = [];
  if (active) candidates.push({ source: ACTIVE, cle: active.cle, secret: active.secret, id: active.id });
  if (attente) candidates.push({ source: ATTENTE, cle: attente.cle, secret: attente.secret, id: attente.id });
  const cleEnv = (env.ADVENTUM_API_KEY ?? "").trim();
  if (!active && cleEnv) {
    candidates.push({ source: "ENVIRONNEMENT", cle: cleEnv, secret: (env.ADVENTUM_WEBHOOK_SECRET ?? "").trim() || null, id: null });
  }
  if (candidates.length === 0) return { ok: false, statut: 503, erreur: "L'ERP n'est pas encore relié au site : aucune clé de liaison." };

  const entete = entetes.get("authorization") ?? "";
  const presentee = /^Bearer\s+(\S+)\s*$/i.exec(entete)?.[1] ?? "";
  if (!presentee) return { ok: false, statut: 401, erreur: "Clé absente." };
  // Toutes les comparaisons ont lieu, trouvée ou non : le temps de réponse ne dit pas laquelle.
  let trouvee: Candidate | null = null;
  for (const c of candidates) if (egal(presentee, c.cle) && !trouvee) trouvee = c;
  if (!trouvee) return { ok: false, statut: 401, erreur: "Clé refusée." };

  if (trouvee.secret) {
    const fournie = (entetes.get("x-adventum-signature") ?? "").trim().replace(/^sha256=/i, "");
    if (!fournie || !egal(fournie.toLowerCase(), signatureAttendue(corps ?? "", trouvee.secret))) {
      return { ok: false, statut: 401, erreur: SIGNATURE_REFUSEE };
    }
  }

  if (trouvee.source === ATTENTE && trouvee.id) {
    // Le site s'en est servi : il l'a donc. Promue même si une présentation concurrente la
    // promeut au même instant — une seule des deux transactions l'emporte, l'autre ne fait rien.
    await promouvoir(trouvee.id, "le site s'en est servi pour appeler l'ERP");
    return { ok: true, source: "ATTENTE_PROMUE" };
  }
  return { ok: true, source: trouvee.source === ACTIVE ? "ACTIVE" : "ENVIRONNEMENT" };
}
