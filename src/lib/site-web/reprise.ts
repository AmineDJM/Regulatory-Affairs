import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notify";
import { refusArticle, refusOffre, type EnregistrementSite, type OffreSaisie } from "./contrat";
import { refusTitresNiveau1 } from "./markdown";
import {
  articleRepris, offreAdminReprise, offreExempleReprise,
  type DepotDuSite, type OrigineReprise,
} from "./reprise-lecture";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA REPRISE DES CONTENUS DU SITE (§118.160) — l'ERP crée SES enregistrements pour ce que le site
 * avait écrit lui-même. La lecture et la traduction vivent dans `reprise-lecture.ts` (pur) ; ici on
 * ÉCRIT, une fois par contenu, et on DIT ce qui s'est passé.
 *
 *   • UNE REPRISE PAR CONTENU DU SITE, TENUE PAR LA BASE (`@@unique([origine, cleSite])`). Deux
 *     rapprochements qui se croisent ne créent pas deux copies du même article : le second perd sur la
 *     contrainte, et c'est voulu — la création et sa reprise sont une seule transaction.
 *   • UN CONTENU REPRIS PUIS SUPPRIMÉ N'EST JAMAIS REPRIS UNE SECONDE FOIS : la ligne de reprise
 *     survit à l'article (`SetNull`). Supprimer, c'est décider ; le rapprochement de la nuit suivante
 *     n'a pas à défaire cette décision.
 *   • UNE ADRESSE DÉJÀ PRISE DANS L'ERP N'EST PAS FUSIONNÉE : l'article du dépôt n'est pas repris, et
 *     le conflit est NOMMÉ avec le geste qui le lève. Deux articles différents à la même adresse ne se
 *     réunissent pas d'office (§118.24 : jamais de fusion silencieuse).
 *   • UN CONTENU QUE LE CONTRAT DU SITE REFUSERAIT (un titre de niveau 1 dans un article du dépôt, une
 *     description trop longue) EST REPRIS QUAND MÊME, et dit « à corriger » : c'est précisément pour le
 *     corriger qu'on le veut dans l'ERP. Tant qu'il ne l'est pas, rien ne part : le site garde SA
 *     version, et rien ne change pour le public.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const AUDIT_MODULE = "Site web";

// Un `type` et non une `interface` : le bilan est écrit tel quel dans une colonne JSON, et une
// interface n'est pas assignable à une valeur JSON (pas de signature d'index implicite).
export type ContenuRepris = {
  origine: OrigineReprise;
  nature: "POST" | "JOB";
  id: string;
  titre: string;
  /** Repris publié (il l'était sur le site) — sinon en brouillon. */
  publie: boolean;
};

export interface BilanReprise {
  /** Le dépôt du site a-t-il été lu ? Faux : rien n'a pu être comparé, et `impossible` dit pourquoi. */
  lue: boolean;
  impossible: string | null;
  repris: ContenuRepris[];
  /** Repris, mais refusés TELS QUELS par le contrat du site : rien ne part avant correction. */
  aCorriger: { origine: OrigineReprise; nature: "POST" | "JOB"; id: string; titre: string; raison: string }[];
  /** NON repris, et pourquoi — avec le geste qui le permettra. */
  conflits: { origine: OrigineReprise; titre: string; raison: string }[];
  illisibles: number;
}

export const repriseImpossible = (raison: string): BilanReprise => ({
  lue: false, impossible: raison, repris: [], aCorriger: [], conflits: [], illisibles: 0,
});

/** Laquelle des contraintes d'unicité a sauté ? Celle de la reprise veut dire « un autre passage l'a déjà fait ». */
function uniciteSur(e: unknown): "REPRISE" | "AUTRE" | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return null;
  const cible = JSON.stringify(e.meta?.target ?? "");
  return /cleSite|origine/.test(cible) ? "REPRISE" : "AUTRE";
}

function donneesOffre(saisie: OffreSaisie, parId: string | null) {
  return {
    title: saisie.title, department: saisie.department, location: saisie.location, contractLabel: saisie.type,
    experience: saisie.experience, summary: saisie.summary, mission: [...saisie.mission], profile: [...saisie.profile],
    offer: [...saisie.offer], published: saisie.published, createdById: parId, updatedById: parId,
  };
}

/**
 * REPREND ce que le site a écrit lui-même et que l'ERP ne connaît pas encore. Idempotent : ce qui a
 * déjà été repris (ou repris puis supprimé) est ignoré. Les contenus repris sont ENSUITE poussés par
 * le rapprochement qui l'appelle — avec leur marqueur de reprise, pour que le site remplace sa copie.
 */
export async function reprendreDuSite(entree: {
  depot: DepotDuSite;
  /** Les offres de `GET /jobs` sans `externalId` — saisies dans l'administration du site. */
  manuels: readonly EnregistrementSite[];
  parId: string | null;
  maintenant?: Date;
}): Promise<BilanReprise> {
  const maintenant = entree.maintenant ?? new Date();
  const parId = entree.parId;
  const bilan: BilanReprise = { lue: true, impossible: null, repris: [], aCorriger: [], conflits: [], illisibles: entree.depot.illisibles };
  const deja = await prisma.siteReprise.findMany({ select: { origine: true, cleSite: true } });
  const connus = new Set(deja.map((r) => `${r.origine}:${r.cleSite}`));

  // ── Les articles du dépôt ───────────────────────────────────────────────────────────
  for (const a of entree.depot.articles) {
    if (connus.has(`ARTICLE_DEPOT:${a.slug}`)) continue;
    const saisie = articleRepris(a);
    const occupe = await prisma.blogArticle.findFirst({ where: { slug: a.slug }, select: { title: true } });
    if (occupe) {
      bilan.conflits.push({
        origine: "ARTICLE_DEPOT", titre: a.titre,
        raison: `L'article de l'ERP « ${occupe.title} » porte déjà l'adresse /blog/${a.slug} : l'article du site n'a pas été repris. Donnez une autre adresse à celui de l'ERP (ou supprimez-le), puis relancez le rapprochement.`,
      });
      continue;
    }
    try {
      const article = await prisma.$transaction(async (tx) => {
        const cree = await tx.blogArticle.create({
          data: {
            title: saisie.title, slug: a.slug, description: saisie.description, body: saisie.body, category: saisie.category,
            tags: [...saisie.tags], author: saisie.author, publishedOn: a.date,
            // Sa première mise en ligne est celle du SITE, pas celle de la reprise : la date affichée
            // ne doit pas avancer au jour où l'ERP l'a reprise.
            firstPublishedAt: saisie.published ? (a.date ?? maintenant) : null,
            revisedAt: a.maj, featured: saisie.featured, published: saisie.published, createdById: parId, updatedById: parId,
          },
          select: { id: true },
        });
        await tx.siteReprise.create({ data: { origine: "ARTICLE_DEPOT", cleSite: a.slug, titre: a.titre, articleId: cree.id, parId } });
        return cree;
      });
      connus.add(`ARTICLE_DEPOT:${a.slug}`);
      bilan.repris.push({ origine: "ARTICLE_DEPOT", nature: "POST", id: article.id, titre: a.titre, publie: saisie.published });
      const refus = refusArticle(saisie, refusTitresNiveau1(saisie.body));
      if (refus.length) bilan.aCorriger.push({ origine: "ARTICLE_DEPOT", nature: "POST", id: article.id, titre: a.titre, raison: refus.join(" ") });
      await recordAudit({
        actorId: parId, action: "CREATE", module: AUDIT_MODULE, entityId: article.id,
        summary: `Reprise du site : l'article « ${a.titre} » (/blog/${a.slug}) est désormais tenu par l'ERP`,
      });
    } catch (e) {
      const u = uniciteSur(e);
      if (u === "REPRISE") continue; // un autre passage l'a repris à l'instant : rien à faire.
      if (u === "AUTRE") {
        bilan.conflits.push({ origine: "ARTICLE_DEPOT", titre: a.titre, raison: `L'adresse /blog/${a.slug} vient d'être prise dans l'ERP : l'article du site n'a pas été repris. Relancez le rapprochement.` });
        continue;
      }
      throw e;
    }
  }

  // ── Les offres : exemples livrés avec le site, puis offres saisies dans son administration ──
  const offres: { origine: OrigineReprise; cle: string; saisie: OffreSaisie }[] = [
    ...entree.depot.exemples.map((e) => ({ origine: "OFFRE_EXEMPLE" as const, cle: e.slug, saisie: offreExempleReprise(e) })),
    ...entree.manuels.flatMap((m) => {
      const r = offreAdminReprise(m);
      return r ? [{ origine: "OFFRE_ADMIN" as const, cle: r.cle, saisie: r.saisie }] : [];
    }),
  ];
  for (const o of offres) {
    if (connus.has(`${o.origine}:${o.cle}`)) continue;
    try {
      const offre = await prisma.$transaction(async (tx) => {
        const cree = await tx.jobPosting.create({ data: donneesOffre(o.saisie, parId), select: { id: true } });
        await tx.siteReprise.create({ data: { origine: o.origine, cleSite: o.cle, titre: o.saisie.title, jobId: cree.id, parId } });
        return cree;
      });
      connus.add(`${o.origine}:${o.cle}`);
      bilan.repris.push({ origine: o.origine, nature: "JOB", id: offre.id, titre: o.saisie.title, publie: o.saisie.published });
      const refus = refusOffre(o.saisie);
      if (refus.length) bilan.aCorriger.push({ origine: o.origine, nature: "JOB", id: offre.id, titre: o.saisie.title, raison: refus.join(" ") });
      await recordAudit({
        actorId: parId, action: "CREATE", module: AUDIT_MODULE, entityId: offre.id,
        summary: `Reprise du site : l'offre « ${o.saisie.title} » (${o.origine === "OFFRE_EXEMPLE" ? "exemple livré avec le site, en brouillon" : "saisie dans l'administration du site"}) est désormais tenue par l'ERP`,
      });
    } catch (e) {
      if (uniciteSur(e) === "REPRISE") continue;
      throw e;
    }
  }

  if (bilan.repris.length) await prevenir(bilan);
  return bilan;
}

/**
 * UNE ALERTE PAR REPRISE, JAMAIS UNE PAR CONTENU. Elle dit ce qui est désormais dans l'ERP, ce qui
 * reste à corriger, et surtout ce qui N'A PAS changé pour le public.
 */
async function prevenir(bilan: BilanReprise): Promise<void> {
  const articles = bilan.repris.filter((r) => r.nature === "POST").length;
  const exemples = bilan.repris.filter((r) => r.origine === "OFFRE_EXEMPLE").length;
  const saisies = bilan.repris.filter((r) => r.origine === "OFFRE_ADMIN").length;
  const morceaux = [
    articles ? `${articles} article(s) du site` : null,
    saisies ? `${saisies} offre(s) saisie(s) sur le site` : null,
    exemples ? `${exemples} offre(s) d'exemple (en brouillon : elles ne sont pas en ligne)` : null,
  ].filter(Boolean);
  const phrases = [
    `${morceaux.join(", ")} sont désormais dans l'ERP : vous pouvez les modifier ou les supprimer depuis le module « Site web ».`,
    "Rien n'a changé pour le public au moment de la reprise.",
    bilan.aCorriger.length
      ? `${bilan.aCorriger.length} à corriger avant que la version de l'ERP ne remplace celle du site (${bilan.aCorriger.slice(0, 2).map((c) => `« ${c.titre} »`).join(", ")}${bilan.aCorriger.length > 2 ? "…" : ""}).`
      : null,
  ].filter(Boolean);
  await notifyRoles(["SUPER_ADMIN"], { type: "GENERIC", title: "Site web : contenus repris du site", body: phrases.join(" "), link: "/site-web" });
}

/**
 * LES FICHIERS DU DÉPÔT QUE LE SITE DOIT GARDER CACHÉS même sans version de l'ERP : ceux dont
 * l'article repris a été SUPPRIMÉ dans l'ERP. Envoyés au site à chaque rechargement (`replacedFiles`) —
 * sans eux, un site qui redémarre sans disque ferait revenir l'article qu'on a supprimé. Un article
 * repris qui EXISTE n'y figure pas : son propre envoi porte `replacesFile`, et s'il est à corriger
 * (jamais parti), c'est la version du site qui doit rester visible en attendant.
 */
export async function fichiersRemplacesSansVersion(): Promise<string[]> {
  const r = await prisma.siteReprise.findMany({ where: { origine: "ARTICLE_DEPOT", articleId: null }, select: { cleSite: true } });
  return r.map((x) => x.cleSite).sort();
}
