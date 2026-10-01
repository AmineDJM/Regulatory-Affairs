import { prisma } from "@/lib/prisma";
import {
  corpsArticle, corpsOffre, refusArticle, refusOffre,
  type ArticleSaisi, type EtatVoulu, type NatureContenu, type OffreSaisie,
} from "./contrat";
import { refusTitresNiveau1 } from "./markdown";
import { mettreEnFile, type ResultatMiseEnFile } from "./file";
import { detenuParLeSite } from "./reprise-lecture";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * DES CONTENUS DE L'ERP AUX CORPS DU SITE (§118.158).
 *
 * La RÈGLE « quoi envoyer » vit dans le module pur (`contrat.ts`) ; ici on LIT la base et on
 * répond à la seule question qui reste : « ce contenu doit-il être sur le site ? »
 *
 *   • Un brouillon JAMAIS publié n'est pas envoyé : le site ne le détient pas, il n'a pas à le
 *     connaître. Rien ne part tant qu'une personne n'a pas décidé de publier. SAUF un contenu REPRIS
 *     du site (§118.160) : là, le site détient déjà sa propre copie, et c'est notre version — même en
 *     brouillon — qui doit la remplacer (`detenuParLeSite`).
 *   • Un contenu déjà envoyé une fois est TOUJOURS synchronisé ensuite — y compris retiré
 *     (`published: false`) : le site le garde alors invisible, prêt à être republié, et la
 *     réconciliation compare ce qu'il détient à ce que l'ERP veut, jamais à ce qu'il espère.
 *   • Une offre rattachée à un recrutement n'est publique que tant que le POSTE EST OUVERT.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** La reprise d'un contenu, telle que les lectures la chargent (§118.160). */
type RepriseEnBase = { origine: string; cleSite: string } | null | undefined;

/** Le poste est-il ouvert ? Sans recrutement rattaché, l'offre ne dépend que d'elle-même. */
export function posteOuvert(stage: string | null | undefined): boolean {
  return stage == null || stage === "SOURCING";
}

type OffreEnBase = {
  id: string; title: string; department: string | null; location: string | null; contractLabel: string | null;
  experience: string | null; summary: string | null; mission: string[]; profile: string[]; offer: string[]; published: boolean;
  reprise?: RepriseEnBase;
};

export function offreSaisie(o: OffreEnBase): OffreSaisie {
  return {
    title: o.title, department: o.department, location: o.location, type: o.contractLabel, experience: o.experience,
    summary: o.summary, mission: o.mission, profile: o.profile, offer: o.offer, published: o.published,
    // Seule une offre SAISIE SUR LE SITE a une copie là-bas à remplacer ; un exemple n'y est plus montré.
    repriseDe: o.reprise?.origine === "OFFRE_ADMIN" ? o.reprise.cleSite : null,
  };
}

type ArticleEnBase = {
  id: string; title: string; slug: string | null; description: string | null; body: string; category: string | null;
  tags: string[]; author: string | null; publishedOn: Date | null; firstPublishedAt: Date | null; revisedAt: Date | null;
  featured: boolean; published: boolean; createdAt: Date;
  reprise?: RepriseEnBase;
};

export function articleSaisi(a: ArticleEnBase): ArticleSaisi {
  return {
    title: a.title, body: a.body, description: a.description, slug: a.slug, category: a.category, tags: a.tags,
    author: a.author, date: a.publishedOn, updated: a.revisedAt, featured: a.featured, published: a.published,
    repriseDe: a.reprise?.origine === "ARTICLE_DEPOT" ? a.reprise.cleSite : null,
  };
}

/** La date qui part quand l'auteur n'en a pas fixé : la première mise en ligne, jamais « maintenant ». */
export const dateParDefautArticle = (a: Pick<ArticleEnBase, "firstPublishedAt" | "createdAt">): Date => a.firstPublishedAt ?? a.createdAt;

const SELECTION_OFFRE = {
  id: true, title: true, department: true, location: true, contractLabel: true, experience: true, summary: true,
  mission: true, profile: true, offer: true, published: true, recruitmentRequest: { select: { stage: true } },
  reprise: { select: { origine: true, cleSite: true } },
} as const;

const SELECTION_ARTICLE = {
  id: true, title: true, slug: true, description: true, body: true, category: true, tags: true, author: true,
  publishedOn: true, firstPublishedAt: true, revisedAt: true, featured: true, published: true, createdAt: true,
  reprise: { select: { origine: true, cleSite: true } },
} as const;

export interface ResultatSynchro extends Partial<ResultatMiseEnFile> {
  etat: "EN_FILE" | "INCHANGE" | "BROUILLON" | "REFUSE" | "INTROUVABLE";
  message: string;
  refus?: string[];
}

async function dejaEnvoye(nature: NatureContenu, externalId: string): Promise<boolean> {
  const n = await prisma.sitePublication.count({ where: { kind: nature, externalId } });
  return n > 0;
}

/** SYNCHRONISE UNE OFFRE avec le site — la met en file si le site doit changer. */
export async function synchroniserOffre(id: string, parId: string | null, opts: { forcer?: boolean } = {}): Promise<ResultatSynchro> {
  const o = await prisma.jobPosting.findUnique({ where: { id }, select: SELECTION_OFFRE });
  if (!o) return { etat: "INTROUVABLE", message: "Offre introuvable." };
  if (!o.published && !detenuParLeSite(o.reprise?.origine) && !(await dejaEnvoye("JOB", o.id))) {
    return { etat: "BROUILLON", message: "Brouillon : rien n'est envoyé au site tant que l'offre n'est pas publiée." };
  }
  const saisie = offreSaisie(o);
  const refus = refusOffre(saisie);
  if (refus.length) return { etat: "REFUSE", message: refus.join(" "), refus };
  const r = await mettreEnFile({
    nature: "JOB", externalId: o.id, libelle: o.title, operation: "PUT",
    corps: corpsOffre(saisie, posteOuvert(o.recruitmentRequest?.stage)), demandeParId: parId, forcer: opts.forcer,
  });
  return { ...r, etat: r.enFile ? "EN_FILE" : "INCHANGE", message: r.raison };
}

/** SYNCHRONISE UN ARTICLE avec le site. */
export async function synchroniserArticle(id: string, parId: string | null, opts: { forcer?: boolean } = {}): Promise<ResultatSynchro> {
  const a = await prisma.blogArticle.findUnique({ where: { id }, select: SELECTION_ARTICLE });
  if (!a) return { etat: "INTROUVABLE", message: "Article introuvable." };
  if (!a.published && !detenuParLeSite(a.reprise?.origine) && !(await dejaEnvoye("POST", a.id))) {
    return { etat: "BROUILLON", message: "Brouillon : rien n'est envoyé au site tant que l'article n'est pas publié." };
  }
  const saisie = articleSaisi(a);
  const refus = refusArticle(saisie, refusTitresNiveau1(a.body));
  if (refus.length) return { etat: "REFUSE", message: refus.join(" "), refus };
  const r = await mettreEnFile({
    nature: "POST", externalId: a.id, libelle: a.title, operation: "PUT",
    corps: corpsArticle(saisie, dateParDefautArticle(a)), demandeParId: parId, forcer: opts.forcer,
  });
  return { ...r, etat: r.enFile ? "EN_FILE" : "INCHANGE", message: r.raison };
}

/**
 * APPELÉE APRÈS CHAQUE CHANGEMENT D'ÉTAPE d'un recrutement : une offre en ligne pour un poste
 * pourvu, clos, refusé ou annulé part en brouillon — tout de suite, pas à la réconciliation de la
 * nuit. Un cliquet (`site-web/recrutement.test.ts`) exige cet appel à chaque écriture d'étape.
 */
export async function synchroniserOffreDeLaDemande(requestId: string, parId: string | null): Promise<void> {
  try {
    const o = await prisma.jobPosting.findUnique({ where: { recruitmentRequestId: requestId }, select: { id: true } });
    if (o) await synchroniserOffre(o.id, parId);
  } catch (err) {
    // Le recrutement a avancé ; la publication suivra à la réconciliation. Ne JAMAIS faire
    // échouer une décision de recrutement parce que le site est injoignable.
    console.error("[site-web] synchronisation de l'offre après changement d'étape", requestId, err);
  }
}

/**
 * RETIRE UN CONTENU DU SITE (DELETE) — sans effet s'il n'y est jamais parti, SAUF s'il avait été
 * repris du site (§118.160) : le site détient alors SA copie (le fichier de son dépôt, l'offre saisie
 * dans son administration), et la suppression doit la faire disparaître aussi. Le DELETE porte ce
 * qu'il remplaçait ; sans ce corps, supprimer un article repris ferait revenir le fichier du dépôt.
 */
export async function retirerDuSite(
  nature: NatureContenu, externalId: string, libelle: string, parId: string | null,
  reprise?: RepriseEnBase,
): Promise<ResultatMiseEnFile> {
  const corps = reprise?.origine === "ARTICLE_DEPOT" && nature === "POST" ? { replacesFile: reprise.cleSite }
    : reprise?.origine === "OFFRE_ADMIN" && nature === "JOB" ? { replacesJob: reprise.cleSite }
    : null;
  return mettreEnFile({ nature, externalId, libelle, operation: "DELETE", corps, demandeParId: parId });
}

/**
 * CE QUE L'ERP VEUT QUE LE SITE DÉTIENNE — recalculé depuis les contenus, jamais recopié de la
 * dernière mise en file : c'est ce qui permet à la réconciliation de rattraper un changement que
 * rien n'a poussé (une étape de recrutement écrite hors des actions, un envoi perdu).
 *
 * Une ligne de file dont le contenu n'existe plus en base est voulue SUPPRIMÉE : on a cherché CE
 * contenu par sa clé primaire dans la source de vérité, et il n'y est pas — une absence VÉRIFIÉE,
 * pas une recherche qui n'a rien trouvé.
 */
export async function voulusDepuisLaBase(): Promise<EtatVoulu[]> {
  const [lignes, offres, articles] = await Promise.all([
    prisma.sitePublication.findMany({ select: { kind: true, externalId: true, label: true, operation: true } }),
    prisma.jobPosting.findMany({ select: SELECTION_OFFRE }),
    prisma.blogArticle.findMany({ select: SELECTION_ARTICLE }),
  ]);
  const connues = new Map<string, (typeof lignes)[number]>(lignes.map((l) => [`${l.kind}:${l.externalId}`, l]));
  const voulus: EtatVoulu[] = [];
  const vus = new Set<string>();

  for (const o of offres) {
    const cle = `JOB:${o.id}`;
    if (!o.published && !connues.has(cle) && !detenuParLeSite(o.reprise?.origine)) continue;
    // VU AVANT d'être validé : un contenu que le contrat refuserait aujourd'hui n'est ni repoussé
    // ni — surtout — déclaré SUPPRIMÉ. Le compter absent le ferait retirer du site par la
    // réconciliation, pour une faute de saisie que personne n'a demandé de sanctionner ainsi.
    // Il est rendu SANS corps (`corps: null`) : connu, donc jamais « orphelin », et nommé à
    // corriger par la réconciliation.
    vus.add(cle);
    const saisie = offreSaisie(o);
    const refus = refusOffre(saisie);
    if (refus.length) {
      voulus.push({ nature: "JOB", externalId: o.id, libelle: o.title, operation: "PUT", corps: null, refus: refus.join(" ") });
      continue;
    }
    voulus.push({ nature: "JOB", externalId: o.id, libelle: o.title, operation: "PUT", corps: corpsOffre(saisie, posteOuvert(o.recruitmentRequest?.stage)) });
  }
  for (const a of articles) {
    const cle = `POST:${a.id}`;
    if (!a.published && !connues.has(cle) && !detenuParLeSite(a.reprise?.origine)) continue;
    vus.add(cle);
    const saisie = articleSaisi(a);
    const refus = refusArticle(saisie, refusTitresNiveau1(a.body));
    if (refus.length) {
      voulus.push({ nature: "POST", externalId: a.id, libelle: a.title, operation: "PUT", corps: null, refus: refus.join(" ") });
      continue;
    }
    voulus.push({ nature: "POST", externalId: a.id, libelle: a.title, operation: "PUT", corps: corpsArticle(saisie, dateParDefautArticle(a)) });
  }
  for (const l of lignes) {
    const cle = `${l.kind}:${l.externalId}`;
    if (vus.has(cle)) continue;
    // Supprimé dans l'ERP (ligne DELETE), ou disparu de la base : le site ne doit plus le détenir.
    voulus.push({ nature: l.kind, externalId: l.externalId, libelle: l.label, operation: "DELETE", corps: null });
  }
  return voulus;
}
