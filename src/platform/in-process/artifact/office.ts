/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE LIVE OFFICE, VU D'AILLEURS — la seule porte d'entrée du reste de l'application.
 *
 * Les actions serveur, les outils d'Adam et la voix appellent CE fichier, jamais le moteur
 * directement. Il compose l'acteur, les ports et le magasin, et il porte la logique qui n'est
 * ni du domaine (elle connaît le décodeur ET les sessions) ni de l'interface : « à quel document
 * cette phrase s'adresse-t-elle ? ».
 *
 * ── LA CONTINUITÉ DE SESSION (§36), QUI EST TOUT LE SUJET ───────────────────────────────
 *
 * « Centre le titre » ne dit pas DE QUEL document il s'agit. La réponse est : celui qui est
 * ouvert. `sessionVisee` va la chercher — la session explicitement citée, sinon la dernière
 * ouverte par cette personne. Sans cela, chaque phrase repartirait de zéro et la conversation
 * de référence du cahier des charges ne fonctionnerait tout simplement pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { CurrentUser } from "@/lib/session";
import type { CommandeArtefact } from "@/lib/artifact/commands/ir";
import type { ContexteDecodage, IntentionDirecte } from "@/lib/artifact/commands/nl";
import { decoder, estAccord } from "@/lib/artifact/commands/nl";
import type {
  ContexteMoteur, ResultatEdition, ResultatOuverture, ResultatSauvegarde, SessionPersistee,
} from "@/lib/artifact/runtime/engine";
import {
  annuler, editer, fermer, ouvrir, retablir, sauvegarder, viser, vueDeSession,
} from "@/lib/artifact/runtime/engine";
import type { VueArtefact } from "@/lib/artifact/render/view";
import { portsArtefact } from "@/platform/in-process/artifact/ports";
import { magasinSessions } from "@/platform/in-process/artifact/store";

export function contexte(user: CurrentUser): ContexteMoteur {
  return {
    ports: portsArtefact,
    magasin: magasinSessions,
    acteur: { id: user.id, libelle: user.name ?? user.email ?? "utilisateur" },
  };
}

export async function ouvrirDocument(
  user: CurrentUser,
  cible: { nodeId?: string; nom?: string; threadId?: string | null; blockId?: string },
): Promise<ResultatOuverture> {
  return ouvrir(contexte(user), cible);
}

export async function editerDocument(
  user: CurrentUser, sessionId: string, commandes: CommandeArtefact[], operationId?: string,
): Promise<ResultatEdition> {
  return editer(contexte(user), sessionId, commandes, { operationId });
}

export const annulerDocument = (user: CurrentUser, sessionId: string) => annuler(contexte(user), sessionId);
export const retablirDocument = (user: CurrentUser, sessionId: string) => retablir(contexte(user), sessionId);
export const fermerDocument = (user: CurrentUser, sessionId: string) => fermer(contexte(user), sessionId);
export const viserDansDocument = (
  user: CurrentUser, sessionId: string,
  ou: { page?: number | null; diapo?: number | null; feuille?: string | null; selection?: string[] | null },
) => viser(contexte(user), sessionId, ou);

export const sauvegarderDocument = (
  user: CurrentUser, sessionId: string, opts: { sousLeNom?: string; forcer?: boolean } = {},
) => sauvegarder(contexte(user), sessionId, opts);

export const vueDocument = (user: CurrentUser, sessionId: string): Promise<VueArtefact | null> =>
  vueDeSession(contexte(user), sessionId);

/**
 * LA SESSION VISÉE par une phrase sans référence explicite.
 *
 * On prend la DERNIÈRE session ouverte de la personne. C'est ce qu'un humain comprend : celui
 * qui vient de dire « affiche-moi le contrat » puis « centre le titre » parle du contrat. Le
 * cloisonnement tient parce que `derniere` filtre déjà sur `userId`.
 */
export async function sessionVisee(user: CurrentUser, sessionId?: string | null): Promise<SessionPersistee | null> {
  if (sessionId) return magasinSessions.lire(sessionId, user.id);
  return magasinSessions.derniere(user.id);
}

export interface ResultatPhrase {
  ok: boolean;
  /** Ce qu'Adam dit — court (§35, §85). */
  message: string;
  vue: VueArtefact | null;
  /** Vrai si le décodeur direct a suffi : aucun appel de modèle (§30). */
  sansModele: boolean;
  /** Renseigné quand la phrase n'a pas été comprise : le modèle doit prendre la main. */
  aDeleguer: boolean;
}

/**
 * TRAITE une phrase adressée au document ouvert, SANS modèle quand c'est possible (§30).
 *
 * Rend `aDeleguer: true` quand le décodeur n'a rien reconnu : l'appelant passera alors la main
 * au modèle, qui produira des commandes IR passées à `editerDocument`. Le décodeur n'invente
 * jamais une interprétation approximative — c'est la règle qui le rend sûr.
 */
export async function phraseSurDocument(
  user: CurrentUser, phrase: string, sessionId?: string | null,
): Promise<ResultatPhrase> {
  const session = await sessionVisee(user, sessionId);
  if (!session) {
    return { ok: false, message: "Aucun document n'est ouvert. Dites-moi lequel afficher.", vue: null, sansModele: true, aDeleguer: false };
  }
  if (estAccord(phrase)) {
    // « Là c'est bon » n'est pas une commande : c'est un accord (§58). Le prendre pour une
    // instruction produirait une modification que personne n'a demandée.
    return {
      ok: true, message: "Parfait. Dites-moi quand vous voulez que j'enregistre.",
      vue: await vueDocument(user, session.id), sansModele: true, aDeleguer: false,
    };
  }

  const ctx: ContexteDecodage = {
    format: session.format,
    derniereCible: session.activeSelection ?? [],
    activePage: session.activePage,
    activeSlide: session.activeSlide,
    activeSheet: session.activeSheet,
  };
  const intention = decoder(phrase, ctx);
  if (!intention) {
    return { ok: false, message: "", vue: null, sansModele: false, aDeleguer: true };
  }
  return appliquerIntention(user, session.id, intention);
}

/** Exécute une intention décodée. Extrait pour que la voix et le texte partagent le chemin (§67). */
export async function appliquerIntention(
  user: CurrentUser, sessionId: string, intention: IntentionDirecte,
): Promise<ResultatPhrase> {
  switch (intention.genre) {
    case "annuler": {
      const r = await annulerDocument(user, sessionId);
      return { ok: r.ok, message: r.ok ? (r.effets[0]?.resume ?? "Annulé.") : (r.motif ?? ""), vue: r.vue, sansModele: true, aDeleguer: false };
    }
    case "retablir": {
      const r = await retablirDocument(user, sessionId);
      return { ok: r.ok, message: r.ok ? (r.effets[0]?.resume ?? "Rétabli.") : (r.motif ?? ""), vue: r.vue, sansModele: true, aDeleguer: false };
    }
    case "fermer": {
      const r = await fermerDocument(user, sessionId);
      return {
        ok: r.ok,
        message: r.perdues
          ? "Document fermé. Attention : des modifications n'étaient pas enregistrées."
          : "Document fermé.",
        vue: null, sansModele: true, aDeleguer: false,
      };
    }
    case "sauvegarder": {
      const r: ResultatSauvegarde = await sauvegarderDocument(user, sessionId, { sousLeNom: intention.sousLeNom ?? undefined });
      return {
        ok: r.ok,
        message: r.ok
          ? `Enregistré${r.version ? ` — version ${r.version}` : ""}.`
          : (r.motif ?? "L'enregistrement a échoué."),
        vue: r.vue, sansModele: true, aDeleguer: false,
      };
    }
    case "commandes": {
      const r = await editerDocument(user, sessionId, intention.commandes);
      const dits = r.effets.filter((e) => e.ok).map((e) => e.resume);
      const rates = r.effets.filter((e) => !e.ok).map((e) => e.motif).filter(Boolean);
      return {
        ok: r.ok,
        message: [dits.join(" "), rates.join(" ")].filter(Boolean).join(" — ") || (r.motif ?? ""),
        vue: r.vue, sansModele: true, aDeleguer: false,
      };
    }
  }
}
