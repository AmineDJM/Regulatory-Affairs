import { prisma } from "@/lib/prisma";
import { etatPublication, type EtatFile, type FaitsPublication, type NatureContenu, type Ton } from "./contrat";
import { apercuDe, urlPublique, type ApercuConfiguration } from "./config";
import { clesIllisibles, configurationEnVigueur } from "./cles";
import { derniereSante, type SanteSite } from "./liaison";
import { lireBlocage, type Blocage } from "./file";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LES ÉCRANS MONTRENT DE LA PUBLICATION (§118.158) — des lectures, et une seule phrase
 * d'état par contenu (`etatPublication`, pure) : la liste des articles, la fiche d'une offre, la
 * carte d'un recrutement et le tableau de bord disent la MÊME chose du même contenu.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface VuePublication {
  id: string;
  nature: NatureContenu;
  externalId: string;
  libelle: string;
  operation: "PUT" | "DELETE";
  etat: EtatFile;
  essais: number;
  prochainEssai: Date;
  dernierStatut: number | null;
  derniereErreur: string | null;
  derniereTentative: Date | null;
  confirmePublie: boolean | null;
  confirmeLe: Date | null;
  urlPublique: string | null;
  majLe: Date;
}

export type Suspension = "NON_CONFIGURE" | "BLOQUE" | null;

/** Rien ne part-il en ce moment, et pourquoi ? */
export async function suspensionEnVigueur(apercuDonne?: ApercuConfiguration): Promise<Suspension> {
  const apercu = apercuDonne ?? apercuDe(await configurationEnVigueur());
  if (!apercu.configuree) return "NON_CONFIGURE";
  const b = await lireBlocage();
  return b && b.empreinte === apercu.empreinte ? "BLOQUE" : null;
}

type LignePublication = {
  id: string; kind: NatureContenu; externalId: string; label: string; operation: string; state: EtatFile; attempts: number;
  nextAttemptAt: Date; lastStatus: number | null; lastError: string | null; lastAttemptAt: Date | null;
  confirmedPublished: boolean | null; confirmedAt: Date | null; siteUrl: string | null; updatedAt: Date;
};

const SELECTION = {
  id: true, kind: true, externalId: true, label: true, operation: true, state: true, attempts: true, nextAttemptAt: true,
  lastStatus: true, lastError: true, lastAttemptAt: true, confirmedPublished: true, confirmedAt: true, siteUrl: true, updatedAt: true,
} as const;

function vue(l: LignePublication): VuePublication {
  return {
    id: l.id, nature: l.kind, externalId: l.externalId, libelle: l.label, operation: l.operation === "DELETE" ? "DELETE" : "PUT",
    etat: l.state, essais: l.attempts, prochainEssai: l.nextAttemptAt, dernierStatut: l.lastStatus, derniereErreur: l.lastError,
    derniereTentative: l.lastAttemptAt, confirmePublie: l.confirmedPublished, confirmeLe: l.confirmedAt,
    urlPublique: urlPublique(l.siteUrl), majLe: l.updatedAt,
  };
}

export function faitsDe(v: VuePublication | null, publieDansErp: boolean, suspendu: Suspension): FaitsPublication {
  return {
    existe: v !== null,
    operation: v?.operation ?? null,
    etat: v?.etat ?? null,
    essais: v?.essais ?? 0,
    prochainEssai: v?.prochainEssai ?? null,
    dernierStatut: v?.dernierStatut ?? null,
    derniereErreur: v?.derniereErreur ?? null,
    publieDansErp,
    publieSurLeSite: v?.confirmePublie ?? null,
    urlPublique: v?.urlPublique ?? null,
    suspendu,
  };
}

/** L'état d'un contenu, prêt à afficher : une phrase, un ton, un détail, et le lien public s'il est en ligne. */
export interface EtatAffiche { libelle: string; ton: Ton; detail: string | null; lien: string | null; publicationId: string | null; relancable: boolean }

export function etatAffiche(v: VuePublication | null, publieDansErp: boolean, suspendu: Suspension): EtatAffiche {
  const e = etatPublication(faitsDe(v, publieDansErp, suspendu));
  const enLigne = v?.etat === "DONE" && v.operation === "PUT" && v.confirmePublie === true;
  return {
    ...e,
    lien: enLigne ? v!.urlPublique : null,
    publicationId: v?.id ?? null,
    relancable: v !== null && (v.etat === "FAILED" || (v.etat === "PENDING" && v.essais > 0)),
  };
}

/** Les publications de ces contenus, par externalId. */
export async function publicationsDe(nature: NatureContenu, externalIds: string[]): Promise<Map<string, VuePublication>> {
  if (externalIds.length === 0) return new Map();
  const lignes = await prisma.sitePublication.findMany({ where: { kind: nature, externalId: { in: externalIds } }, select: SELECTION });
  return new Map(lignes.map((l) => [l.externalId, vue(l)] as const));
}

export async function listePublications(limite = 300): Promise<VuePublication[]> {
  const lignes = await prisma.sitePublication.findMany({ orderBy: { updatedAt: "desc" }, take: limite, select: SELECTION });
  return lignes.map(vue);
}

export interface LigneJournal {
  at: Date; nature: NatureContenu; externalId: string; libelle: string; methode: string; chemin: string;
  statut: number | null; issue: string; ms: number; extrait: string | null; erreur: string | null;
}

export async function journalRecent(limite = 40): Promise<LigneJournal[]> {
  const lignes = await prisma.sitePushAttempt.findMany({
    orderBy: { createdAt: "desc" },
    take: limite,
    select: {
      createdAt: true, kind: true, externalId: true, method: true, path: true, status: true, outcome: true,
      durationMs: true, responseBody: true, error: true, publication: { select: { label: true } },
    },
  });
  return lignes.map((l) => ({
    at: l.createdAt, nature: l.kind, externalId: l.externalId, libelle: l.publication.label, methode: l.method, chemin: l.path,
    statut: l.status, issue: l.outcome, ms: l.durationMs, extrait: l.responseBody ? l.responseBody.slice(0, 240) : null, erreur: l.error,
  }));
}

export interface EtatIntegration {
  config: ApercuConfiguration;
  blocage: Blocage | null;
  suspendu: Suspension;
  compteurs: { enFile: number; enEchec: number; enLigne: number; retires: number; supprimes: number };
  dernier: {
    at: Date; fini: Date | null; ok: boolean; declencheur: string; erreur: string | null; siteJobs: number | null; sitePosts: number | null;
    conformes: number; repousses: number; suppressions: number; rejetes: number;
    orphelins: { nature: string; externalId: string; titre: string; url: string | null }[];
    collisions: { externalId: string; libelle: string; slug: string; titreDuDepot: string }[];
    ecarts: { nature: string; externalId: string; libelle: string; raison: string }[];
    manuels: { jobs: number; posts: number } | null;
  } | null;
  dernierReussi: Date | null;
}

const tableau = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export async function etatIntegration(): Promise<EtatIntegration> {
  const config = apercuDe(await configurationEnVigueur());
  const [blocage, groupes, dernier, dernierReussi] = await Promise.all([
    lireBlocage(),
    prisma.sitePublication.groupBy({ by: ["state", "operation", "confirmedPublished"], _count: { _all: true } }),
    prisma.siteReconciliation.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.siteReconciliation.findFirst({ where: { ok: true }, orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
  ]);
  const compteurs = { enFile: 0, enEchec: 0, enLigne: 0, retires: 0, supprimes: 0 };
  for (const g of groupes) {
    const n = g._count._all;
    if (g.state === "PENDING") compteurs.enFile += n;
    else if (g.state === "FAILED") compteurs.enEchec += n;
    else if (g.operation === "DELETE") compteurs.supprimes += n;
    else if (g.confirmedPublished) compteurs.enLigne += n;
    else compteurs.retires += n;
  }
  const suspendu = !config.configuree ? "NON_CONFIGURE" : blocage && blocage.empreinte === config.empreinte ? "BLOQUE" : null;
  return {
    config,
    blocage: suspendu === "BLOQUE" ? blocage : null,
    suspendu,
    compteurs,
    dernier: dernier ? {
      at: dernier.startedAt, fini: dernier.finishedAt, ok: dernier.ok, declencheur: dernier.trigger, erreur: dernier.error,
      siteJobs: dernier.siteJobs, sitePosts: dernier.sitePosts, conformes: dernier.conformes, repousses: dernier.repousses,
      suppressions: dernier.suppressions, rejetes: dernier.rejetes,
      orphelins: tableau(dernier.orphelins), collisions: tableau(dernier.collisions), ecarts: tableau(dernier.ecarts),
      manuels: dernier.manuels && typeof dernier.manuels === "object" ? (dernier.manuels as { jobs: number; posts: number }) : null,
    } : null,
    dernierReussi: dernierReussi?.startedAt ?? null,
  };
}

/**
 * LES SLUGS DES ARTICLES DU DÉPÔT DU SITE, tels que le dernier rapprochement réussi les a lus :
 * l'éditeur d'article prévient d'une collision AVANT l'envoi, sans interroger le site à chaque
 * frappe (et sans rien inventer : aucun rapprochement encore, aucune liste).
 */
export async function slugsDuDepotConnus(): Promise<{ slugs: string[]; au: Date | null }> {
  const r = await prisma.siteReconciliation.findFirst({ where: { ok: true }, orderBy: { startedAt: "desc" }, select: { depotSlugs: true, startedAt: true } });
  return { slugs: r?.depotSlugs ?? [], au: r?.startedAt ?? null };
}

// ───────────────────────────── La liaison (§118.159) ─────────────────────────────

export interface EtatLiaison {
  /** La clé en vigueur quand elle vient de l'ERP — son empreinte et ses dates, jamais sa valeur. */
  active: { empreinte: string; creeLe: Date; activeeLe: Date | null } | null;
  /** La clé en attente — sans sa valeur : l'écran la relit à part, et seulement pour le Super Admin. */
  attente: { empreinte: string; creeLe: Date; derniereVerification: Date | null; dernierConstat: string | null; prochaineVerification: Date } | null;
  /** Les états dont la clé ne s'ouvre plus (clé maîtresse du serveur changée) — à régénérer, dit comme tel. */
  illisibles: string[];
  sante: SanteSite | null;
  santeAu: Date | null;
}

export async function etatLiaison(): Promise<EtatLiaison> {
  const [lignes, illisibles, s] = await Promise.all([
    prisma.siteWebCle.findMany({
      where: { etat: { in: ["ACTIVE", "ATTENTE"] } },
      select: { etat: true, empreinte: true, creeLe: true, activeeLe: true, derniereVerification: true, dernierConstat: true, prochaineVerification: true },
    }),
    clesIllisibles(),
    derniereSante(),
  ]);
  const a = lignes.find((l) => l.etat === "ACTIVE");
  const p = lignes.find((l) => l.etat === "ATTENTE");
  return {
    active: a && !illisibles.includes("ACTIVE") ? { empreinte: a.empreinte, creeLe: a.creeLe, activeeLe: a.activeeLe } : null,
    attente: p && !illisibles.includes("ATTENTE")
      ? { empreinte: p.empreinte, creeLe: p.creeLe, derniereVerification: p.derniereVerification, dernierConstat: p.dernierConstat, prochaineVerification: p.prochaineVerification }
      : null,
    illisibles,
    sante: s.sante,
    santeAu: s.au,
  };
}
