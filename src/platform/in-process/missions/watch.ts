import { prisma } from "@/lib/prisma";
import { EntityType } from "@prisma/client";
import { userCan } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { resoudreEntitesDe } from "@/lib/fabric";
import { watchState } from "@/lib/assistant/reminders";
import { journaliser } from "@/lib/missions/runtime/store";
import {
  decrireRegles, evaluerRegles, graviteDe, lireEtat, lireRegles, reglesParDefaut, signatureDe,
  type EtatCible, type Probleme, type RegleSurveillance,
} from "@/lib/missions/watch/rules";
import { porteAttentionPour } from "@/platform/in-process/missions/attention";
import { proprietaire } from "@/platform/in-process/missions/sweep";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA SURVEILLANCE DURABLE — le pont : ce qui lit l'ERP, crée, balaie, arrête.
 *
 * « Surveille ce dossier et préviens-moi seulement s'il y a un problème. » Ce que cela exige :
 *
 *   DURABLE      une ligne `AdamWatch` + une MISSION-SUPPORT (kind WATCH). Un redémarrage relit
 *                la table ; aucun minuteur, aucune mémoire de processus.
 *   RÉVEILLÉE    par le battement à sa cadence, et par le registre d'événements dès qu'un fait
 *                touche la cible (`watch/router.ts`) — « changement ERP → réveil ».
 *   SOBRE        un problème est une RÈGLE (code), sa signature stable n'est signalée qu'une
 *                fois, sa résolution passe au journal, la fin de la cible s'annonce une fois et
 *                clôt la surveillance. La porte d'attention plafonne le reste.
 *   SOUS DROITS  la cible se résout et se relit sous les droits du propriétaire, relus en base
 *                à chaque battement — comme les missions.
 *   CONDUITE     suspendre / arrêter passent par la mission-support : les gestes existants.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const TYPES_CIBLE = [
  "REGULATORY_PRODUCT", "REGULATORY_DOSSIER", "TASK", "EXPENSE_ORDER", "PAYMENT_REQUEST", "VALIDATION_REQUEST",
  "PCH_TENDER", "PRODUIT", "ORGANISATION", "PERSONNE",
] as const;
export type TypeCible = (typeof TYPES_CIBLE)[number];

export interface CibleResolue {
  type: TypeCible;
  id: string;
  label: string;
  ref?: string | null;
  /** Trouvée par sa référence EXACTE — une correspondance de nom ne l'est pas. */
  exact: boolean;
}

const LIBELLE_TYPE: Record<TypeCible, string> = {
  REGULATORY_PRODUCT: "dossier réglementaire", REGULATORY_DOSSIER: "dossier CTD", TASK: "tâche",
  EXPENSE_ORDER: "règlement", PAYMENT_REQUEST: "demande de paiement", VALIDATION_REQUEST: "validation",
  PCH_TENDER: "appel d'offres", PRODUIT: "produit", ORGANISATION: "organisation", PERSONNE: "personne",
};

/**
 * LES ÉCRITURES D'UNE RÉFÉRENCE DE MARCHÉ. « AO 2026/14 », « 2026-14 », « PCH 2026/14 » désignent le
 * même appel d'offres ; la base porte UNE forme. On compare des formes NORMALISÉES (chiffres et
 * lettres, séparateurs effacés), jamais un « contient » sur deux chiffres qui attraperait tout.
 */
const formeMarche = (t: string): string => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/^(AO|PCH|MARCHE|APPEL D'OFFRES)\s*/g, "").replace(/[^A-Z0-9]+/g, "");
const memeMarche = (a: string, b: string): boolean => {
  const fa = formeMarche(a); const fb = formeMarche(b);
  return fa.length >= 4 && (fa === fb || fa.endsWith(fb) || fb.endsWith(fa));
};

const STATUTS_TACHE_OUVERTS = ["REQUESTED", "TODO", "IN_PROGRESS"];

/**
 * RÉSOUT LA CIBLE d'une référence, sous les droits de la personne. Une référence exacte
 * l'emporte ; plusieurs correspondances de nom rendent des CANDIDATS — jamais « le premier des
 * quatre » (doctrine du décodeur : surveiller la mauvaise cible en annonçant le contraire est le
 * défaut le plus coûteux).
 */
export async function resoudreCible(user: CurrentUser, reference: string): Promise<{ cible: CibleResolue | null; candidats: CibleResolue[] }> {
  const ref = reference.trim();
  if (ref.length < 2) return { cible: null, candidats: [] };
  const peutRegulatory = userCan(user, "REGULATORY", "VIEW");
  const peutPch = userCan(user, "PCH", "VIEW");
  const [produits, dossiers, ordres, paiements, validations, taches, canoniques, marches] = await Promise.all([
    peutRegulatory ? prisma.regulatoryProduct.findMany({
      where: { OR: [{ reference: { equals: ref, mode: "insensitive" } }, { dci: { contains: ref, mode: "insensitive" } }, { brandName: { contains: ref, mode: "insensitive" } }] },
      select: { id: true, reference: true, dci: true, brandName: true }, take: 6,
    }).catch(() => []) : Promise.resolve([]),
    peutRegulatory ? prisma.regulatoryDossier.findMany({
      where: { OR: [{ reference: { equals: ref, mode: "insensitive" } }, { title: { contains: ref, mode: "insensitive" } }] },
      select: { id: true, reference: true, title: true }, take: 6,
    }).catch(() => []) : Promise.resolve([]),
    prisma.expenseOrder.findMany({ where: { reference: { equals: ref, mode: "insensitive" } }, select: { id: true, reference: true, label: true }, take: 2 }).catch(() => []),
    prisma.paymentRequest.findMany({ where: { reference: { equals: ref, mode: "insensitive" } }, select: { id: true, reference: true, title: true }, take: 2 }).catch(() => []),
    prisma.validationRequest.findMany({ where: { reference: { equals: ref, mode: "insensitive" } }, select: { id: true, reference: true, title: true }, take: 2 }).catch(() => []),
    prisma.task.findMany({
      where: { title: { contains: ref, mode: "insensitive" }, status: { in: STATUTS_TACHE_OUVERTS as never } },
      select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 6,
    }).catch(() => []),
    resoudreEntitesDe(ref).catch(() => []),
    // LES APPELS D'OFFRES : la référence sous ses écritures, ou le titre. « Surveille l'appel
    // d'offres PCH 2026/14 » était sans cible avant cette ligne — la surveillance répondait
    // « rien à surveiller » pour un marché que la maison suit au quotidien.
    peutPch ? prisma.pchTender.findMany({
      where: { OR: [{ reference: { contains: ref.replace(/^(AO|PCH)\s*/i, "").replace(/[^0-9]+/g, "/").replace(/^\/|\/$/g, ""), mode: "insensitive" } }, { title: { contains: ref, mode: "insensitive" } }] },
      select: { id: true, reference: true, title: true, status: true }, take: 8,
    }).then((rows) => rows.filter((m) => memeMarche(m.reference, ref) || (m.title ?? "").toLowerCase().includes(ref.toLowerCase()))).catch(() => []) : Promise.resolve([]),
  ]);

  const candidats: CibleResolue[] = [
    ...produits.map((p) => ({ type: "REGULATORY_PRODUCT" as const, id: p.id, ref: p.reference, label: `${p.reference} — ${p.dci}${p.brandName ? ` (${p.brandName})` : ""}`, exact: p.reference.toLowerCase() === ref.toLowerCase() })),
    ...dossiers.map((d) => ({ type: "REGULATORY_DOSSIER" as const, id: d.id, ref: d.reference, label: `${d.reference} — ${d.title}`, exact: d.reference.toLowerCase() === ref.toLowerCase() })),
    ...ordres.map((o) => ({ type: "EXPENSE_ORDER" as const, id: o.id, ref: o.reference, label: `${o.reference} — ${o.label}`, exact: true })),
    ...paiements.map((p) => ({ type: "PAYMENT_REQUEST" as const, id: p.id, ref: p.reference, label: `${p.reference} — ${p.title}`, exact: true })),
    ...validations.map((v) => ({ type: "VALIDATION_REQUEST" as const, id: v.id, ref: v.reference, label: `${v.reference} — ${v.title}`, exact: true })),
    ...taches.map((t) => ({ type: "TASK" as const, id: t.id, ref: null, label: `tâche « ${t.title} »`, exact: t.title.toLowerCase() === ref.toLowerCase() })),
    ...marches.map((m) => ({ type: "PCH_TENDER" as const, id: m.id, ref: m.reference, label: `appel d'offres ${m.reference}${m.title ? ` — ${m.title}` : ""}`, exact: memeMarche(m.reference, ref) })),
    ...canoniques.map((e) => ({ type: e.type as TypeCible, id: e.id, ref: null, label: `${LIBELLE_TYPE[e.type as TypeCible] ?? e.type} ${e.label}`, exact: e.label.toLowerCase() === ref.toLowerCase() })),
  ];
  const exacts = candidats.filter((c) => c.exact);
  if (exacts.length === 1) return { cible: exacts[0], candidats };
  if (candidats.length === 1) return { cible: candidats[0], candidats };
  return { cible: null, candidats };
}

/** Les types d'entité que le registre connaît — un type hors de l'énumération ne se cherche pas. */
const TYPES_REGISTRE = new Set<string>(Object.values(EntityType));

/** Le dernier fait du registre canonique qui touche la cible — la mémoire commune de l'entreprise. */
async function dernierFait(types: readonly string[], id: string): Promise<Date | null> {
  const connus = types.filter((t) => TYPES_REGISTRE.has(t)) as EntityType[];
  const refs = types.map((t) => `${t}:${id}`);
  const e = await prisma.businessEvent.findFirst({
    where: { OR: [...(connus.length ? [{ entityType: { in: connus }, entityId: id }] : []), { relatedRefs: { hasSome: refs } }] },
    orderBy: { occurredAt: "desc" }, select: { occurredAt: true },
  }).catch(() => null);
  return e?.occurredAt ?? null;
}

const plusRecent = (...dates: (Date | null | undefined)[]): string | null => {
  const t = dates.filter((d): d is Date => d instanceof Date).map((d) => d.getTime());
  return t.length ? new Date(Math.max(...t)).toISOString() : null;
};

/**
 * LIT L'ÉTAT NORMALISÉ d'une cible — la seule fonction qui connaît les modèles de l'ERP. Chaque
 * type dit son statut, s'il est terminal ou bloqué, son échéance et son dernier changement ; les
 * règles (façade) ne voient que cela.
 */
export async function lireEtatCible(user: CurrentUser | null, type: TypeCible, id: string): Promise<EtatCible> {
  switch (type) {
    case "REGULATORY_PRODUCT": {
      if (user && !userCan(user, "REGULATORY", "VIEW")) return { existe: true, resume: "droit REGULATORY retiré : lecture impossible", champs: {} };
      const p = await prisma.regulatoryProduct.findUnique({
        where: { id },
        select: { reference: true, dci: true, brandName: true, status: true, isLocked: true, targetSubmissionDate: true, targetDate: true, externalDeadline: true, updatedAt: true, responsible: { select: { name: true } } },
      });
      if (!p) return { existe: false, champs: {} };
      const avantDepot = ["PRE_SUBMISSION", "IN_PREPARATION"].includes(p.status);
      const echeance = (avantDepot ? p.targetSubmissionDate : null) ?? p.targetDate ?? p.externalDeadline ?? null;
      return {
        existe: true, statut: p.status, terminal: ["DECISION_OBTAINED", "CLOSED"].includes(p.status), bloque: p.status === "BLOCKED",
        echeance: echeance ? echeance.toISOString() : null,
        dernierChangement: plusRecent(p.updatedAt, await dernierFait(["REGULATORY_PRODUCT"], id)),
        champs: { statut: p.status, responsable: p.responsible?.name ?? null, reference: p.reference, verrouille: p.isLocked },
        resume: `${p.reference} — ${p.dci}${p.brandName ? ` (${p.brandName})` : ""} : ${p.status}${p.responsible ? `, responsable ${p.responsible.name}` : ""}`,
      };
    }
    case "REGULATORY_DOSSIER": {
      if (user && !userCan(user, "REGULATORY", "VIEW")) return { existe: true, resume: "droit REGULATORY retiré : lecture impossible", champs: {} };
      const d = await prisma.regulatoryDossier.findUnique({ where: { id }, select: { reference: true, title: true, status: true, updatedAt: true } });
      if (!d) return { existe: false, champs: {} };
      return {
        existe: true, statut: d.status, terminal: ["MAINTAINED", "ARCHIVED"].includes(d.status), bloque: d.status === "ERROR",
        dernierChangement: plusRecent(d.updatedAt, await dernierFait(["REGULATORY_DOSSIER", "DOSSIER"], id)),
        champs: { statut: d.status, reference: d.reference }, resume: `${d.reference} — ${d.title} : ${d.status}`,
      };
    }
    case "TASK": {
      const t = await prisma.task.findUnique({ where: { id }, select: { title: true, status: true, dueDate: true, updatedAt: true, completedAt: true } });
      if (!t) return { existe: false, champs: {} };
      return {
        existe: true, statut: t.status, terminal: !STATUTS_TACHE_OUVERTS.includes(t.status), bloque: false,
        echeance: t.dueDate ? t.dueDate.toISOString() : null,
        dernierChangement: plusRecent(t.updatedAt, t.completedAt, await dernierFait(["TASK"], id)),
        champs: { statut: t.status, titre: t.title }, resume: `tâche « ${t.title} » : ${t.status}${t.dueDate ? `, échéance ${t.dueDate.toISOString().slice(0, 10)}` : ""}`,
      };
    }
    case "PCH_TENDER": {
      if (user && !userCan(user, "PCH", "VIEW")) return { existe: true, resume: "droit PCH retiré : lecture impossible", champs: {} };
      const m = await prisma.pchTender.findUnique({
        where: { id },
        select: { reference: true, title: true, status: true, submissionDeadline: true, submittedAt: true, awardDate: true, updatedAt: true },
      });
      if (!m) return { existe: false, champs: {} };
      // L'ÉCHÉANCE QUI COMPTE : le dépôt tant qu'il n'est pas fait, l'attribution ensuite.
      const echeance = (m.submittedAt ? null : m.submissionDeadline) ?? m.awardDate ?? null;
      return {
        existe: true, statut: m.status, terminal: ["COMPLETED", "CANCELLED", "LOST"].includes(m.status), bloque: m.status === "SUSPENDED",
        echeance: echeance ? echeance.toISOString() : null,
        dernierChangement: plusRecent(m.updatedAt, m.submittedAt, await dernierFait(["PCH_TENDER"], id)),
        champs: { statut: m.status, reference: m.reference, depose: Boolean(m.submittedAt) },
        resume: `appel d'offres ${m.reference}${m.title ? ` — ${m.title}` : ""} : ${m.status}${m.submittedAt ? ", offre déposée" : echeance ? `, dépôt le ${echeance.toISOString().slice(0, 10)}` : ""}`,
      };
    }
    case "EXPENSE_ORDER":
    case "PAYMENT_REQUEST":
    case "VALIDATION_REQUEST": {
      const w = await watchState(type, id);
      if (!w) return { existe: false, champs: {} };
      const disparu = /introuvable/.test(w.detail);
      return {
        existe: !disparu, statut: w.detail.split(" — ").pop() ?? w.detail, terminal: !w.pending, bloque: false,
        dernierChangement: plusRecent(await dernierFait([type], id)),
        champs: { statut: w.detail, enAttente: w.pending }, resume: w.detail,
      };
    }
    case "PRODUIT":
    case "ORGANISATION":
    case "PERSONNE": {
      // Une entité du dictionnaire canonique : on ne relit pas sa fiche (elle vit dans plusieurs
      // tables), on observe ce qui la TOUCHE au registre des faits. Le silence est la seule règle
      // qui ait un sens ici, et c'est précisément celle qu'on demande (« s'il ne se passe rien »).
      const dernier = type === "PERSONNE"
        ? await prisma.businessEvent.findFirst({ where: { OR: [{ actorId: id }, { relatedRefs: { has: `USER:${id}` } }] }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true } }).catch(() => null)
        : await prisma.businessEvent.findFirst({ where: { entityId: id }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true } }).catch(() => null);
      return { existe: true, statut: null, terminal: false, bloque: false, dernierChangement: dernier?.occurredAt?.toISOString() ?? null, champs: {}, resume: `${LIBELLE_TYPE[type]} suivie au registre des faits` };
    }
  }
}

export interface OptionsSurveillance {
  reference: string;
  label?: string | null;
  /** Les règles dites, BRUTES (un outil, une conversation) — relues sans confiance par `lireRegles`. */
  regles?: readonly unknown[] | null;
  checkEveryH?: number | null;
  /** La phrase de la personne, mot pour mot — c'est l'objectif de la mission-support. */
  instruction?: string | null;
}

export type ResultatCreation =
  | { ok: true; id: string; missionId: string; cible: CibleResolue; regles: RegleSurveillance[]; reglesTexte: string; cadenceHeures: number; etat: EtatCible; prochainControle: Date }
  | { ok: false; raison: string; candidats: CibleResolue[] };

/**
 * CRÉE UNE SURVEILLANCE — la cible résolue sous les droits de la personne, les règles par défaut
 * du type ou celles qu'on a dites, une mission-support pour le journal et la conduite, et un
 * premier état relu tout de suite (le prochain battement comparera à celui-là).
 */
export async function creerSurveillance(user: CurrentUser, opts: OptionsSurveillance): Promise<ResultatCreation> {
  const { cible, candidats } = await resoudreCible(user, opts.reference);
  if (!cible) {
    return {
      ok: false, candidats,
      raison: candidats.length === 0
        ? `rien à surveiller sous « ${opts.reference} » — ni dossier réglementaire, ni appel d'offres, ni tâche ouverte, ni règlement, ni entité connue.`
        : `plusieurs cibles correspondent à « ${opts.reference} » : ${candidats.slice(0, 5).map((c) => c.label).join(" ; ")}. Précisez la référence.`,
    };
  }
  // La même cible n'est surveillée qu'une fois par personne : deux surveillances feraient deux alertes.
  const existante = await prisma.adamWatch.findFirst({
    where: { ownerId: user.id, status: "ACTIVE", targetType: cible.type, targetId: cible.id },
    select: { id: true, missionId: true, rules: true, label: true, nextCheckAt: true, lastState: true, checkEveryH: true },
  });
  const dites = lireRegles(opts.regles ?? []);
  const regles = dites.length > 0 ? dites : reglesParDefaut(cible.type);
  const etat = await lireEtatCible(user, cible.type, cible.id);
  if (existante) {
    // On COMPLÈTE (règles, libellé) au lieu de créer : la surveillance existante garde son histoire.
    await prisma.adamWatch.update({ where: { id: existante.id }, data: { rules: regles as never, label: opts.label?.trim() || existante.label, nextCheckAt: new Date() } });
    await journaliser(existante.missionId, "WATCH_UPDATED", `Surveillance mise à jour : ${decrireRegles(regles)}.`, { regles: regles as never });
    return { ok: true, id: existante.id, missionId: existante.missionId, cible, regles, reglesTexte: decrireRegles(regles), cadenceHeures: existante.checkEveryH, etat, prochainControle: new Date() };
  }
  const label = opts.label?.trim() || cible.label;
  const cadence = Math.min(Math.max(Math.round(opts.checkEveryH ?? 24), 1), 24 * 14);
  const instruction = opts.instruction?.trim() || `Surveiller ${cible.label} et prévenir seulement s'il y a un problème.`;
  const mission = await prisma.mission.create({
    data: {
      kind: "WATCH", status: "WAITING_EVENT", title: `Surveillance — ${label}`, objective: instruction, goalRaw: instruction, ownerId: user.id,
    },
    select: { id: true },
  });
  const prochain = new Date(Date.now() + cadence * 3_600_000);
  const w = await prisma.adamWatch.create({
    data: {
      ownerId: user.id, missionId: mission.id, label, targetType: cible.type, targetId: cible.id, targetRef: cible.ref ?? null,
      rules: regles as never, checkEveryH: cadence, nextCheckAt: prochain, lastCheckedAt: new Date(), lastState: etat as never,
    },
    select: { id: true },
  });
  await journaliser(mission.id, "WATCH_CREATED",
    `Surveillance de ${cible.label} (${LIBELLE_TYPE[cible.type]}) : ${decrireRegles(regles)} ; contrôle toutes les ${cadence} h et à chaque fait qui la touche.`,
    { watchId: w.id, targetType: cible.type, targetId: cible.id, regles: regles as never, etat: etat as never }, user.id);
  return { ok: true, id: w.id, missionId: mission.id, cible, regles, reglesTexte: decrireRegles(regles), cadenceHeures: cadence, etat, prochainControle: prochain };
}

export interface BalayageSurveillances {
  examinees: number;
  signalees: number;
  resolues: number;
  terminees: number;
  erreurs: number;
}

const ETATS_MISSION_INACTIFS = ["PAUSED", "CANCELLED", "COMPLETED", "FAILED"];

/**
 * LE BALAYAGE — appelé par le battement. Une surveillance due est relue, ses règles évaluées,
 * et SEUL un changement de signature parle : problème nouveau → porte d'attention (niveau
 * suggéré par la gravité) ; problème disparu → journal ; cible terminée → une information et la
 * clôture. Une surveillance dont la mission-support est suspendue n'est pas relue : la pause est
 * une pause.
 */
export async function balayerSurveillances(maintenant = new Date(), opts: { max?: number } = {}): Promise<BalayageSurveillances> {
  const out: BalayageSurveillances = { examinees: 0, signalees: 0, resolues: 0, terminees: 0, erreurs: 0 };
  if ((process.env.MISSIONS_SWEEP ?? "").toLowerCase() === "off") return out;
  const dues = await prisma.adamWatch.findMany({
    where: { status: "ACTIVE", nextCheckAt: { lte: maintenant }, mission: { status: { notIn: ETATS_MISSION_INACTIFS as never } } },
    orderBy: { nextCheckAt: "asc" }, take: opts.max ?? 50,
  }).catch(() => []);
  const porte = porteAttentionPour();
  const proprietaires = new Map<string, CurrentUser | null>();

  for (const w of dues) {
    out.examinees += 1;
    try {
      if (!proprietaires.has(w.ownerId)) proprietaires.set(w.ownerId, await proprietaire(w.ownerId));
      const owner = proprietaires.get(w.ownerId) ?? null;
      if (!owner) {
        // Compte désactivé : la surveillance s'éteint sans bruit — personne pour la recevoir.
        await prisma.adamWatch.update({ where: { id: w.id }, data: { status: "CLOSED", closeReason: "propriétaire inactif", lastCheckedAt: maintenant } });
        continue;
      }
      const type = w.targetType as TypeCible;
      const etat = await lireEtatCible(owner, type, w.targetId);
      const precedent = lireEtat(w.lastState);
      const regles = lireRegles(w.rules);
      const problemes = evaluerRegles(etat, regles, precedent, maintenant);
      const signature = signatureDe(problemes);
      const prochain = new Date(maintenant.getTime() + w.checkEveryH * 3_600_000);
      const base = { lastCheckedAt: maintenant, nextCheckAt: prochain, lastState: etat as never };

      // ── LA CIBLE EST TERMINÉE : on le dit une fois, et on cesse ─────────────────────
      if (etat.existe && etat.terminal) {
        await porte.signaler({
          kind: "WATCH_ENDED", missionId: w.missionId, ownerId: w.ownerId, titre: w.label,
          raison: `${etat.resume ?? w.label} — ${etat.statut ?? "terminé"}`, stepKey: `fin:${etat.statut ?? ""}`,
        }).catch(() => undefined);
        await prisma.adamWatch.update({ where: { id: w.id }, data: { ...base, status: "CLOSED", closeReason: `cible terminée (${etat.statut ?? "-"})`, lastSignalAt: maintenant } });
        await prisma.mission.update({ where: { id: w.missionId }, data: { status: "COMPLETED" } }).catch(() => undefined);
        await journaliser(w.missionId, "WATCH_ENDED", `La cible est arrivée à son terme (${etat.statut ?? "-"}) : la surveillance est close.`, { etat: etat as never });
        out.terminees += 1;
        continue;
      }

      if (signature && signature !== w.lastSignature) {
        // ── UN PROBLÈME NOUVEAU (ou un lot différent) : la porte d'attention décide du canal ──
        const gravite = graviteDe(problemes);
        const raison = `${etat.resume ?? w.label} — ${problemes.map((p) => p.detail).join(" ; ")}`;
        await porte.signaler({
          kind: "WATCH_ALERT", missionId: w.missionId, ownerId: w.ownerId, titre: w.label, raison,
          decision: recommandationPour(problemes), stepKey: signature, niveauSuggere: gravite,
        }).catch(() => undefined);
        await prisma.adamWatch.update({ where: { id: w.id }, data: { ...base, lastSignature: signature, lastSignalAt: maintenant } });
        await journaliser(w.missionId, "WATCH_CHECKED", `Problème(s) : ${problemes.map((p) => p.detail).join(" ; ")}.`,
          { signature, gravite, problemes: problemes as never, etat: etat as never });
        out.signalees += 1;
        // Une cible DISPARUE ne se resurveille pas : elle est dite, et la surveillance se ferme.
        if (!etat.existe) {
          await prisma.adamWatch.update({ where: { id: w.id }, data: { status: "CLOSED", closeReason: "cible disparue" } });
          await prisma.mission.update({ where: { id: w.missionId }, data: { status: "COMPLETED" } }).catch(() => undefined);
        }
        continue;
      }

      if (!signature && w.lastSignature) {
        // ── LE PROBLÈME A DISPARU : le journal le dit, personne n'est dérangé ────────────
        await porte.signaler({
          kind: "WATCH_RESOLVED", missionId: w.missionId, ownerId: w.ownerId, titre: w.label,
          raison: etat.resume ?? w.label, stepKey: `resolu:${w.lastSignature}`,
        }).catch(() => undefined);
        await prisma.adamWatch.update({ where: { id: w.id }, data: { ...base, lastSignature: null } });
        await journaliser(w.missionId, "WATCH_CHECKED", "Le problème signalé n'est plus observé : revenu à la normale.", { etat: etat as never });
        out.resolues += 1;
        continue;
      }

      // Rien de neuf : on note le passage, sans une ligne de journal par battement.
      await prisma.adamWatch.update({ where: { id: w.id }, data: base });
    } catch (e) {
      out.erreurs += 1;
      console.error(`[surveillances] contrôle de ${w.id} échoué`, e);
      // Une lecture impossible n'est pas une cible disparue : on réessaie dans une heure, et le
      // journal le dit une fois par panne (la même signature d'erreur n'est pas répétée).
      await prisma.adamWatch.update({ where: { id: w.id }, data: { lastCheckedAt: maintenant, nextCheckAt: new Date(maintenant.getTime() + 3_600_000) } }).catch(() => undefined);
      await journaliser(w.missionId, "WATCH_ERROR", `Contrôle impossible : ${e instanceof Error ? e.message : String(e)}`, {}).catch(() => undefined);
    }
  }
  return out;
}

/** La recommandation d'un chef de cabinet, depuis les codes — pas depuis un modèle. */
function recommandationPour(problemes: readonly Probleme[]): string {
  const codes = new Set(problemes.map((p) => p.code));
  if (codes.has("DISPARU")) return "vérifier si la cible a été supprimée ou renommée, puis relancer la surveillance sur la bonne référence";
  if (codes.has("BLOQUE")) return "demander au responsable ce qui bloque et ce qu'il lui faut";
  if (codes.has("ECHEANCE_DEPASSEE")) return "trancher : repousser l'échéance, réassigner, ou clore";
  if (codes.has("ECHEANCE_PROCHE")) return "s'assurer auprès du responsable que l'échéance tiendra";
  if (codes.has("SANS_CHANGEMENT")) return "demander un point d'avancement au responsable";
  if (codes.has("STATUT_PARMI") || codes.has("VALEUR")) return "vérifier la situation et décider de la suite";
  return "prendre connaissance";
}

/** ARRÊTE une surveillance — la sienne seulement ; la mission-support est annulée, le journal le dit. */
export async function arreterSurveillance(user: CurrentUser, idOuMission: string): Promise<{ ok: boolean; label?: string }> {
  const w = await prisma.adamWatch.findFirst({
    where: { ownerId: user.id, status: "ACTIVE", OR: [{ id: idOuMission }, { missionId: idOuMission }] },
    select: { id: true, missionId: true, label: true },
  });
  if (!w) return { ok: false };
  await prisma.adamWatch.update({ where: { id: w.id }, data: { status: "CLOSED", closeReason: "arrêtée par la personne" } });
  await prisma.mission.update({ where: { id: w.missionId }, data: { status: "CANCELLED" } }).catch(() => undefined);
  await journaliser(w.missionId, "WATCH_STOPPED", "Surveillance arrêtée à la demande de la personne.", {}, user.id);
  return { ok: true, label: w.label };
}

/** LES SURVEILLANCES ACTIVES d'une personne, avec leur dernier état et leur dernier problème. */
export async function listerSurveillances(user: CurrentUser) {
  const rows = await prisma.adamWatch.findMany({
    where: { ownerId: user.id, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 50,
    include: { mission: { select: { status: true } } },
  });
  return rows.map((w) => {
    const etat = lireEtat(w.lastState);
    return {
      id: w.id, missionId: w.missionId, label: w.label, type: LIBELLE_TYPE[w.targetType as TypeCible] ?? w.targetType, reference: w.targetRef,
      regles: decrireRegles(lireRegles(w.rules)), cadenceHeures: w.checkEveryH,
      suspendue: w.mission.status === "PAUSED",
      dernierControle: w.lastCheckedAt?.toISOString() ?? null, prochainControle: w.nextCheckAt.toISOString(),
      etat: etat?.resume ?? null, problemeEnCours: Boolean(w.lastSignature),
    };
  });
}
