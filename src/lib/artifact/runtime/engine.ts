/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE MOTEUR — ouvrir, modifier, annuler, rétablir, sauvegarder (§3, §18, §19-23, §48).
 *
 * ── LA DÉCISION CENTRALE : L'ÉTAT EST UN REJEU, PAS UN INSTANTANÉ ───────────────────────
 *
 * L'état courant d'un document ouvert = la version Drive de base, PLUS les opérations non
 * annulées du journal, rejouées dans l'ordre.
 *
 * Trois propriétés en découlent, gratuitement :
 *
 *   ANNULER      c'est marquer la dernière opération « annulée » et rejouer. Exact par
 *                construction, pour les quatre formats, sans écrire une seule commande inverse.
 *   RÉRABLIR     c'est la démarquer. Symétrique, donc sans code en plus.
 *   REPRISE      après un redémarrage du serveur ou la fermeture de l'application (§80-81), il
 *                n'y a RIEN à reconstruire : le journal est déjà en base, on rejoue.
 *
 * Le prix est un rejeu à chaque commande. Mesuré : quelques millisecondes sur les adaptateurs
 * déterministes de ce projet, et un cache mémoire (`cache.ts`) l'évite dans le cas courant —
 * on ne rejoue vraiment qu'au premier accès d'un processus, ou après une annulation.
 *
 * L'alternative (un instantané par opération) coûterait, sur un PPTX de 8 Mo retouché vingt
 * fois, 160 Mo de blobs pour une session — pour dire la même chose que le journal.
 *
 * ── LA SAUVEGARDE EST ATOMIQUE (§48) ────────────────────────────────────────────────────
 *
 * On sérialise, on RELIT ce qu'on vient de produire, et seulement si la relecture réussit on
 * écrit la version dans le Drive. Un fichier illisible ne remplace jamais un fichier lisible.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { randomUUID } from "node:crypto";
import type { ArtifactFormat, ArtifactModel } from "@/lib/artifact/object-model/model";
import type { CommandeArtefact } from "@/lib/artifact/commands/ir";
import { compilerCommandes } from "@/lib/artifact/commands/compile";
import type { DocumentOuvert, EffetCommande } from "@/lib/artifact/adapters/contract";
import { adaptateurPour, mimeDe } from "@/lib/artifact/adapters/registry";
import { controlerVisuel, proportionsInitiales } from "@/lib/artifact/qa/checks";
import { vueDuModele, type VueArtefact } from "@/lib/artifact/render/view";
import type { PortsArtefact } from "@/lib/artifact/ports";
import { mesurer, type Chrono } from "@/lib/artifact/observability/timing";

// ─────────────────────────── Le magasin de sessions ───────────────────────────

/** L'état persistant d'une session, tel que le moteur en a besoin. Fourni par le magasin. */
export interface SessionPersistee {
  id: string;
  userId: string;
  threadId: string | null;
  blockId: string;
  nodeId: string;
  baseVersion: number;
  name: string;
  format: ArtifactFormat;
  state: string;
  revision: number;
  dirty: boolean;
  savedVersion: number | null;
  activePage: number | null;
  activeSlide: number | null;
  activeSheet: string | null;
  activeSelection: string[] | null;
}

export interface OperationPersistee {
  operationId: string;
  seq: number;
  beforeVersion: number;
  afterVersion: number;
  command: CommandeArtefact;
  summary: string;
  actorId: string;
  actorLabel: string;
  undone: boolean;
  createdAt: Date;
}

/**
 * LE MAGASIN. Le moteur ne connaît pas Prisma : c'est ce qui rend ses tests exécutables sans
 * base ET ce qui empêche le domaine `artifact/` d'importer le socle de persistance.
 */
export interface MagasinSessions {
  creer(s: Omit<SessionPersistee, "id" | "revision" | "dirty" | "savedVersion" | "state">): Promise<SessionPersistee>;
  lire(sessionId: string, userId: string): Promise<SessionPersistee | null>;
  /** La session ouverte de cette personne sur ce fichier, s'il y en a une (§36). */
  ouverte(userId: string, nodeId: string): Promise<SessionPersistee | null>;
  /** La DERNIÈRE session encore ouverte de cette personne — « annule », « sauvegarde » sans nom. */
  derniere(userId: string): Promise<SessionPersistee | null>;
  majSession(sessionId: string, champs: Partial<SessionPersistee> & { lastError?: string | null }): Promise<void>;
  operations(sessionId: string): Promise<OperationPersistee[]>;
  /** Écrit une opération. Rend `false` si `operationId` existait déjà (idempotence, §18). */
  ajouterOperation(sessionId: string, op: OperationPersistee): Promise<boolean>;
  marquerAnnulee(sessionId: string, seq: number, annulee: boolean): Promise<void>;
  fermer(sessionId: string): Promise<void>;
}

export interface ContexteMoteur {
  ports: PortsArtefact;
  magasin: MagasinSessions;
  /** Qui agit — l'audit portera ce nom (§76). */
  acteur: { id: string; libelle: string };
}

// ─────────────────────────── Le cache d'états ouverts ───────────────────────────

interface EtatOuvert {
  doc: DocumentOuvert;
  revision: number;
  proportions: Record<string, number>;
}

/**
 * Un document ouvert par session, dans CE processus. Borné : au-delà, la plus ancienne session
 * est évincée et se rejouera au prochain accès — jamais une erreur, juste un rejeu.
 */
const CACHE = new Map<string, EtatOuvert>();
const CACHE_MAX = 24;

function mettreEnCache(sessionId: string, etat: EtatOuvert): void {
  CACHE.delete(sessionId);
  CACHE.set(sessionId, etat);
  while (CACHE.size > CACHE_MAX) {
    const plusAncienne = CACHE.keys().next().value;
    if (plusAncienne === undefined) break;
    CACHE.delete(plusAncienne);
  }
}

/** Vide le cache — utilisé par les tests, et par la fermeture de session. */
export function oublierSession(sessionId: string): void {
  CACHE.delete(sessionId);
}

// ─────────────────────────── Résultats ───────────────────────────

export interface ResultatOuverture {
  ok: boolean;
  motif: string | null;
  vue: VueArtefact | null;
  /** Plusieurs fichiers correspondent au nom demandé : on laisse choisir plutôt que deviner. */
  candidats: { nodeId: string; nom: string; format: string }[];
  chrono: Chrono;
}

export interface ResultatEdition {
  ok: boolean;
  /** Ce qui s'est passé, commande par commande — c'est ce qu'Adam redit à la personne. */
  effets: EffetCommande[];
  motif: string | null;
  vue: VueArtefact | null;
  chrono: Chrono;
}

export interface ResultatSauvegarde {
  ok: boolean;
  motif: string | null;
  version: number | null;
  nodeId: string | null;
  vue: VueArtefact | null;
  chrono: Chrono;
}

// ─────────────────────────── Ouverture ───────────────────────────

/**
 * OUVRE un document. Si la personne a DÉJÀ une session ouverte dessus, on la RÉUTILISE (§36) :
 * ré-ouvrir perdrait les modifications non sauvegardées, et la personne dirait à juste titre
 * qu'Adam a effacé son travail.
 */
export async function ouvrir(
  ctx: ContexteMoteur,
  cible: { nodeId?: string; nom?: string; threadId?: string | null; blockId?: string },
): Promise<ResultatOuverture> {
  const chrono = mesurer();
  const vide = { vue: null, candidats: [] as ResultatOuverture["candidats"] };

  let nodeId = cible.nodeId ?? null;
  if (!nodeId) {
    if (!cible.nom) return { ok: false, motif: "Il faut dire quel document ouvrir.", ...vide, chrono: chrono.fin("open") };
    const trouves = await ctx.ports.documents.chercher(ctx.acteur.id, cible.nom, 6);
    const ouvrables = trouves.filter((f) => f.format !== null);
    if (ouvrables.length === 0) {
      return {
        ok: false,
        motif: `Je ne trouve aucun document bureautique nommé « ${cible.nom} » auquel vous ayez accès.`,
        ...vide, chrono: chrono.fin("open"),
      };
    }
    if (ouvrables.length > 1) {
      // On ne choisit PAS : ouvrir le mauvais contrat et l'annoncer comme le bon est la faute
      // la plus coûteuse de tout ce système.
      return {
        ok: false,
        motif: `${ouvrables.length} documents correspondent à « ${cible.nom} ». Lequel ?`,
        vue: null,
        candidats: ouvrables.map((f) => ({ nodeId: f.nodeId, nom: f.nom, format: String(f.format) })),
        chrono: chrono.fin("open"),
      };
    }
    nodeId = ouvrables[0].nodeId;
  }

  const fiche = await ctx.ports.documents.decrire(ctx.acteur.id, nodeId);
  if (!fiche) {
    return { ok: false, motif: "Ce document n'existe pas, ou vous n'y avez pas accès.", ...vide, chrono: chrono.fin("open") };
  }
  if (!fiche.format) {
    return {
      ok: false,
      motif: `« ${fiche.nom} » n'est pas un document Word, Excel, PowerPoint ou PDF — je ne sais pas l'éditer.`,
      ...vide, chrono: chrono.fin("open"),
    };
  }

  const dejaOuverte = await ctx.magasin.ouverte(ctx.acteur.id, nodeId);
  const session = dejaOuverte ?? await ctx.magasin.creer({
    userId: ctx.acteur.id,
    threadId: cible.threadId ?? null,
    blockId: cible.blockId ?? `artifact-${randomUUID()}`,
    nodeId,
    baseVersion: fiche.version,
    name: fiche.nom,
    format: fiche.format,
    activePage: fiche.format === "PDF" ? 1 : null,
    activeSlide: fiche.format === "PPTX" ? 1 : null,
    activeSheet: null,
    activeSelection: null,
  });

  try {
    const etat = await etatCourant(ctx, session);
    if (!dejaOuverte) await ctx.magasin.majSession(session.id, { state: "OPEN" });
    await ctx.ports.audit.tracer({
      userId: ctx.acteur.id, action: "ARTIFACT_OPEN", cible: nodeId,
      detail: `${fiche.nom} (${fiche.format}) v${fiche.version}`,
    });
    return {
      ok: true, motif: null,
      vue: await construireVue(ctx, { ...session, state: dejaOuverte?.state ?? "OPEN" }, etat),
      candidats: [], chrono: chrono.fin("open"),
    };
  } catch (e) {
    await ctx.magasin.majSession(session.id, { state: "FAILED", lastError: (e as Error).message });
    return { ok: false, motif: `Je n'arrive pas à ouvrir « ${fiche.nom} » : ${(e as Error).message}`, ...vide, chrono: chrono.fin("open") };
  }
}

/** Rejoue la base + les opérations non annulées, ou rend l'état déjà en cache. */
async function etatCourant(ctx: ContexteMoteur, session: SessionPersistee): Promise<EtatOuvert> {
  const enCache = CACHE.get(session.id);
  if (enCache && enCache.revision === session.revision) return enCache;

  const octets = await ctx.ports.documents.lire(ctx.acteur.id, session.nodeId, session.baseVersion);
  if (!octets) throw new Error("le contenu de ce document est introuvable");
  const doc = await adaptateurPour(session.format).ouvrir(octets);
  const proportions = proportionsInitiales(doc.modele());

  const ops = await ctx.magasin.operations(session.id);
  for (const op of ops) {
    if (op.undone) continue;
    // Un rejeu qui échoue ne doit pas rendre la session inutilisable : on le note et on continue.
    // Le contraire (interrompre) laisserait la personne devant un document figé sans recours.
    const effet = doc.appliquer(op.command);
    if (!effet.ok) {
      await ctx.magasin.majSession(session.id, {
        lastError: `L'opération « ${op.summary} » n'a pas pu être rejouée : ${effet.motif}`,
      });
    }
  }
  const etat: EtatOuvert = { doc, revision: session.revision, proportions };
  mettreEnCache(session.id, etat);
  return etat;
}

// ─────────────────────────── Édition ───────────────────────────

/**
 * APPLIQUE un lot de commandes. `operationId` rend l'opération idempotente : un double clic ou
 * un rejeu réseau ne centre pas le titre deux fois.
 *
 * Une commande refusée n'annule PAS les autres (voir `compile.ts`) : « centre le titre, réduis-le
 * à 16 et remonte le tableau » doit appliquer les deux premières même si la troisième est ambiguë.
 */
export async function editer(
  ctx: ContexteMoteur,
  sessionId: string,
  commandes: CommandeArtefact[],
  opts: { operationId?: string } = {},
): Promise<ResultatEdition> {
  const chrono = mesurer();
  const session = await ctx.magasin.lire(sessionId, ctx.acteur.id);
  if (!session) return { ok: false, effets: [], motif: "Aucun document ouvert sous cette référence.", vue: null, chrono: chrono.fin("edit") };
  if (session.state === "CLOSED") return { ok: false, effets: [], motif: "Ce document a été fermé.", vue: null, chrono: chrono.fin("edit") };

  const compile = compilerCommandes(commandes, session.format);
  chrono.etape("commandParse");
  if (compile.commandes.length === 0) {
    const motif = compile.refus.map((r) => `« ${r.op} » : ${r.motif}`).join(" ; ");
    return { ok: false, effets: [], motif: motif || "Aucune commande exploitable.", vue: null, chrono: chrono.fin("edit") };
  }

  const dejaFaites = await ctx.magasin.operations(session.id);
  const seqDepart = dejaFaites.reduce((m, o) => Math.max(m, o.seq), 0);
  const clesConnues = new Set(dejaFaites.map((o) => o.operationId));

  const etat = await etatCourant(ctx, session);
  const effets: EffetCommande[] = [];
  let revision = session.revision;
  let seq = seqDepart;
  let nAppliquees = 0;
  let course = false;

  for (const [i, cmd] of compile.commandes.entries()) {
    // Sur un lot, chaque commande a sa propre clé dérivée : rejouer le lot entier reste
    // idempotent commande par commande.
    const cle = opts.operationId ? `${opts.operationId}#${i}` : randomUUID();

    /**
     * L'IDEMPOTENCE SE VÉRIFIE AVANT D'APPLIQUER, ET C'EST TOUT LE POINT.
     *
     * La vérifier après — en se fiant au refus d'écriture du journal — laisserait la commande
     * s'appliquer au document EN MÉMOIRE avant d'être rejetée. Un double clic sur « supprime le
     * deuxième paragraphe » supprimerait alors le deuxième, puis le troisième, tout en
     * répondant « déjà fait ». Le journal serait juste, l'écran serait faux, et l'écart ne se
     * verrait qu'à la sauvegarde.
     */
    if (clesConnues.has(cle)) {
      effets.push({ ok: false, resume: "", motif: "Cette modification a déjà été appliquée.", touches: [], candidats: [] });
      continue;
    }

    const effet = etat.doc.appliquer(cmd);
    effets.push(effet);
    if (!effet.ok) continue;
    seq += 1;
    const avant = revision;
    revision += 1;
    const ecrite = await ctx.magasin.ajouterOperation(session.id, {
      operationId: cle,
      seq, beforeVersion: avant, afterVersion: revision,
      command: cmd, summary: effet.resume,
      actorId: ctx.acteur.id, actorLabel: ctx.acteur.libelle,
      undone: false, createdAt: new Date(),
    });
    if (!ecrite) {
      // Une requête CONCURRENTE a gagné la course entre notre vérification et l'écriture. Le
      // document en mémoire porte maintenant une modification de trop : on le jette et on
      // rejouera depuis le journal, qui fait autorité.
      revision = avant;
      seq -= 1;
      course = true;
      effets[effets.length - 1] = { ok: false, resume: "", motif: "Cette modification a déjà été appliquée.", touches: [], candidats: [] };
      break;
    }
    clesConnues.add(cle);
    nAppliquees += 1;
  }
  chrono.etape("commandApply");

  if (course) oublierSession(session.id);

  for (const r of compile.refus) {
    effets.push({ ok: false, resume: "", motif: `« ${r.op} » : ${r.motif}`, touches: [], candidats: [] });
  }

  if (nAppliquees > 0) {
    if (!course) {
      etat.revision = revision;
      mettreEnCache(session.id, etat);
    }
    await ctx.magasin.majSession(session.id, { revision, dirty: true, state: "DIRTY", lastError: null });
    await ctx.ports.audit.tracer({
      userId: ctx.acteur.id, action: "ARTIFACT_EDIT", cible: session.nodeId,
      detail: effets.filter((e) => e.ok).map((e) => e.resume).join(" | ").slice(0, 500),
    });
  }

  const sessionMaj = { ...session, revision, dirty: session.dirty || nAppliquees > 0, state: nAppliquees > 0 ? "DIRTY" : session.state };
  const vue = await construireVue(ctx, sessionMaj, etat, effets.flatMap((e) => e.touches));
  return {
    ok: nAppliquees > 0,
    effets,
    motif: nAppliquees > 0 ? null : effets.find((e) => !e.ok)?.motif ?? "Aucune modification appliquée.",
    vue,
    chrono: chrono.fin("edit"),
  };
}

// ─────────────────────────── Annuler / Rétablir ───────────────────────────

export async function annuler(ctx: ContexteMoteur, sessionId: string): Promise<ResultatEdition> {
  return bougerHistorique(ctx, sessionId, "annuler");
}

export async function retablir(ctx: ContexteMoteur, sessionId: string): Promise<ResultatEdition> {
  return bougerHistorique(ctx, sessionId, "retablir");
}

async function bougerHistorique(ctx: ContexteMoteur, sessionId: string, sens: "annuler" | "retablir"): Promise<ResultatEdition> {
  const chrono = mesurer();
  const session = await ctx.magasin.lire(sessionId, ctx.acteur.id);
  if (!session) return { ok: false, effets: [], motif: "Aucun document ouvert sous cette référence.", vue: null, chrono: chrono.fin(sens) };

  const ops = (await ctx.magasin.operations(session.id)).sort((a, b) => a.seq - b.seq);
  const cible = sens === "annuler"
    ? [...ops].reverse().find((o) => !o.undone)
    : ops.find((o) => o.undone);
  if (!cible) {
    return {
      ok: false, effets: [],
      motif: sens === "annuler" ? "Il n'y a rien à annuler sur ce document." : "Il n'y a rien à rétablir.",
      vue: null, chrono: chrono.fin(sens),
    };
  }
  await ctx.magasin.marquerAnnulee(session.id, cible.seq, sens === "annuler");

  // Le rejeu repart de la base : c'est ce qui rend l'annulation exacte, quel que soit le format.
  const revision = session.revision + 1;
  oublierSession(session.id);
  await ctx.magasin.majSession(session.id, { revision, dirty: true, state: "DIRTY" });
  const etat = await etatCourant(ctx, { ...session, revision });
  chrono.etape("commandApply");

  const resume = sens === "annuler" ? `Annulé : ${cible.summary}` : `Rétabli : ${cible.summary}`;
  await ctx.ports.audit.tracer({
    userId: ctx.acteur.id, action: sens === "annuler" ? "ARTIFACT_UNDO" : "ARTIFACT_REDO",
    cible: session.nodeId, detail: cible.summary.slice(0, 300),
  });
  return {
    ok: true,
    effets: [{ ok: true, resume, motif: null, touches: [], candidats: [] }],
    motif: null,
    vue: await construireVue(ctx, { ...session, revision, dirty: true, state: "DIRTY" }, etat),
    chrono: chrono.fin(sens),
  };
}

// ─────────────────────────── Sauvegarde ───────────────────────────

/**
 * SAUVEGARDE en créant une NOUVELLE version Drive (§19-21).
 *
 * Séquence : sérialiser → RELIRE ce qu'on vient de produire → écrire seulement si la relecture
 * passe. Un document illisible ne remplace jamais un document lisible (§48).
 *
 * `verrou` implémente §50 : si quelqu'un d'autre a écrit une version pendant qu'on éditait, on
 * REFUSE et on le dit, plutôt que d'écraser silencieusement son travail.
 */
export async function sauvegarder(
  ctx: ContexteMoteur,
  sessionId: string,
  opts: { sousLeNom?: string; forcer?: boolean } = {},
): Promise<ResultatSauvegarde> {
  const chrono = mesurer();
  const rien = { version: null, nodeId: null, vue: null };
  const session = await ctx.magasin.lire(sessionId, ctx.acteur.id);
  if (!session) return { ok: false, motif: "Aucun document ouvert sous cette référence.", ...rien, chrono: chrono.fin("save") };

  const etat = await etatCourant(ctx, session);
  if (!session.dirty && !opts.sousLeNom) {
    return {
      ok: true, motif: "Ce document n'a aucune modification à enregistrer.",
      version: session.savedVersion ?? session.baseVersion, nodeId: session.nodeId,
      vue: await construireVue(ctx, session, etat), chrono: chrono.fin("save"),
    };
  }

  await ctx.magasin.majSession(session.id, { state: "SAVING" });
  try {
    const validation = await etat.doc.valider();
    if (!validation.ok) {
      await ctx.magasin.majSession(session.id, { state: "FAILED", lastError: validation.problemes.join(" ; ") });
      return {
        ok: false,
        motif: `Je n'enregistre pas : le fichier produit ne serait pas lisible (${validation.problemes.join(" ; ")}).`,
        ...rien, chrono: chrono.fin("save"),
      };
    }
    const octets = await etat.doc.serialiser();
    chrono.etape("serialize");

    if (opts.sousLeNom) {
      const cree = await ctx.ports.documents.creerFichier(ctx.acteur.id, {
        nom: opts.sousLeNom, octets, mime: mimeDe(session.format),
      });
      await ctx.ports.audit.tracer({
        userId: ctx.acteur.id, action: "ARTIFACT_SAVE_AS", cible: cree.nodeId,
        detail: `${opts.sousLeNom} depuis ${session.name}`,
      });
      await ctx.magasin.majSession(session.id, { state: "SAVED" });
      return {
        ok: true, motif: null, version: cree.version, nodeId: cree.nodeId,
        vue: await construireVue(ctx, { ...session, state: "SAVED" }, etat), chrono: chrono.fin("save"),
      };
    }

    // §50 — le verrou optimiste. La version courante du Drive doit être celle qu'on a ouverte.
    const fiche = await ctx.ports.documents.decrire(ctx.acteur.id, session.nodeId);
    const attendue = session.savedVersion ?? session.baseVersion;
    if (fiche && fiche.version !== attendue && !opts.forcer) {
      await ctx.magasin.majSession(session.id, { state: "DIRTY" });
      return {
        ok: false,
        motif: `Quelqu'un a enregistré une version ${fiche.version} de « ${session.name} » pendant que vous travailliez (vous êtes parti de la ${attendue}). Vos modifications sont conservées : dites-moi si je dois enregistrer par-dessus, ou enregistrer sous un autre nom.`,
        ...rien, chrono: chrono.fin("save"),
      };
    }

    const ecrite = await ctx.ports.documents.ecrireVersion(ctx.acteur.id, session.nodeId, octets, {
      mime: mimeDe(session.format),
      resume: resumeDesModifications(await ctx.magasin.operations(session.id)),
    });
    await ctx.magasin.majSession(session.id, {
      state: "SAVED", dirty: false, savedVersion: ecrite.version, lastError: null,
    });
    await ctx.ports.audit.tracer({
      userId: ctx.acteur.id, action: "ARTIFACT_SAVE", cible: session.nodeId,
      detail: `${session.name} → version ${ecrite.version}`,
    });
    return {
      ok: true, motif: null, version: ecrite.version, nodeId: session.nodeId,
      vue: await construireVue(ctx, { ...session, state: "SAVED", dirty: false, savedVersion: ecrite.version }, etat),
      chrono: chrono.fin("save"),
    };
  } catch (e) {
    await ctx.magasin.majSession(session.id, { state: "FAILED", lastError: (e as Error).message });
    return { ok: false, motif: `L'enregistrement a échoué : ${(e as Error).message}`, ...rien, chrono: chrono.fin("save") };
  }
}

/** Le résumé versé au Drive (§22) — ce qu'on lira dans trois mois pour savoir ce qui a changé. */
export function resumeDesModifications(ops: OperationPersistee[]): string {
  const vivantes = ops.filter((o) => !o.undone).sort((a, b) => a.seq - b.seq);
  if (vivantes.length === 0) return "Aucune modification.";
  const resumes = vivantes.map((o) => o.summary.replace(/\s+/g, " ").trim());
  const texte = resumes.join(" ; ");
  return texte.length <= 480 ? texte : `${resumes.length} modifications : ${texte.slice(0, 460)}…`;
}

// ─────────────────────────── Fermeture, sélection, vue ───────────────────────────

export async function fermer(ctx: ContexteMoteur, sessionId: string): Promise<{ ok: boolean; motif: string | null; perdues: boolean }> {
  const session = await ctx.magasin.lire(sessionId, ctx.acteur.id);
  if (!session) return { ok: false, motif: "Aucun document ouvert sous cette référence.", perdues: false };
  await ctx.magasin.fermer(session.id);
  oublierSession(session.id);
  return { ok: true, motif: null, perdues: session.dirty };
}

/** Met à jour le working set (§4) : page, diapo, feuille, sélection cliquée. */
export async function viser(
  ctx: ContexteMoteur,
  sessionId: string,
  ou: { page?: number | null; diapo?: number | null; feuille?: string | null; selection?: string[] | null },
): Promise<ResultatEdition> {
  const chrono = mesurer();
  const session = await ctx.magasin.lire(sessionId, ctx.acteur.id);
  if (!session) return { ok: false, effets: [], motif: "Aucun document ouvert sous cette référence.", vue: null, chrono: chrono.fin("aim") };
  const champs: Partial<SessionPersistee> = {};
  if (ou.page !== undefined) champs.activePage = ou.page;
  if (ou.diapo !== undefined) champs.activeSlide = ou.diapo;
  if (ou.feuille !== undefined) champs.activeSheet = ou.feuille;
  if (ou.selection !== undefined) champs.activeSelection = ou.selection;
  await ctx.magasin.majSession(session.id, champs);
  const fusion = { ...session, ...champs };
  const etat = await etatCourant(ctx, fusion);
  return { ok: true, effets: [], motif: null, vue: await construireVue(ctx, fusion, etat), chrono: chrono.fin("aim") };
}

/** L'état complet d'une session, tel que le workspace le dessine. */
export async function vueDeSession(ctx: ContexteMoteur, sessionId: string): Promise<VueArtefact | null> {
  const session = await ctx.magasin.lire(sessionId, ctx.acteur.id);
  if (!session) return null;
  return construireVue(ctx, session, await etatCourant(ctx, session));
}

async function construireVue(
  ctx: ContexteMoteur,
  session: SessionPersistee,
  etat: EtatOuvert,
  surbrillance: string[] = [],
): Promise<VueArtefact> {
  const modele: ArtifactModel = etat.doc.modele();
  const ops = (await ctx.magasin.operations(session.id)).sort((a, b) => a.seq - b.seq);
  return {
    sessionId: session.id,
    blockId: session.blockId,
    nodeId: session.nodeId,
    nom: session.name,
    format: session.format,
    etat: session.state,
    revision: session.revision,
    dirty: session.dirty,
    baseVersion: session.baseVersion,
    savedVersion: session.savedVersion,
    activePage: session.activePage,
    activeSlide: session.activeSlide,
    activeSheet: session.activeSheet,
    surbrillance: surbrillance.length ? [...new Set(surbrillance)] : (session.activeSelection ?? []),
    peutAnnuler: ops.some((o) => !o.undone),
    peutRetablir: ops.some((o) => o.undone),
    historique: ops.map((o) => ({
      operationId: o.operationId, seq: o.seq, resume: o.summary,
      annulee: o.undone, quand: o.createdAt.toISOString(),
    })),
    contenu: vueDuModele(modele),
    alertes: controlerVisuel(modele, etat.proportions),
  };
}
