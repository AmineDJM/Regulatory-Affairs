import { lignes, type ArticleSaisi, type EnregistrementSite, type OffreSaisie } from "./contrat";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LE SITE A ÉCRIT LUI-MÊME, LU POUR QUE L'ERP LE REPRENNE (§118.160) — module PUR.
 *
 * « Les articles actuellement présents ou offres doivent être présents dans le module de l'ERP pour
 * pouvoir modifier ou supprimer ces derniers. » Trois sortes de contenus existaient sur le site sans
 * que l'ERP les connaisse :
 *
 *   • ARTICLE_DEPOT — les articles écrits dans le DÉPÔT du site (`content/blog/*.md`). Ce sont ceux
 *     que le public lit aujourd'hui, et l'ERP ne pouvait ni les corriger ni les retirer : le site
 *     les gardait prioritaires sur tout article poussé à la même adresse (§118.158).
 *   • OFFRE_EXEMPLE — les offres d'exemple livrées avec le site. Le site ne les montre plus depuis
 *     qu'il est relié (elles attireraient des candidatures pour des postes qui n'existent pas), mais
 *     elles restent dans son dépôt, et on les voyait avant la liaison.
 *   • OFFRE_ADMIN — les offres saisies dans l'administration du site, sans `externalId`. Son écran
 *     d'administration est désormais en lecture seule quand le site est relié : sans reprise,
 *     personne ne pourrait plus y toucher.
 *
 * LA RÈGLE DE LA REPRISE, et elle tient en une phrase : CE QUI EST EN LIGNE RESTE EN LIGNE, CE QUI NE
 * L'EST PAS NE LE DEVIENT PAS. Un article du dépôt visible est repris publié, un fichier que le site
 * cache déjà est repris en brouillon ; une offre d'exemple est reprise en BROUILLON (publier un poste
 * est une décision de recrutement, pas un effet de bord d'un déploiement) ; une offre saisie garde
 * l'état que le site lui donnait. Le public ne voit rien changer au moment de la reprise — il verra
 * ce que l'ERP décidera ensuite.
 *
 * Ce module ne fait que LIRE et TRADUIRE. Il rend `null` sur une réponse qu'il ne lit pas à coup sûr
 * (§118.16) : une reprise fondée sur une réponse à moitié comprise créerait des articles à moitié
 * vides, et c'est eux que la personne corrigerait ensuite sans savoir d'où ils viennent.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type OrigineReprise = "ARTICLE_DEPOT" | "OFFRE_EXEMPLE" | "OFFRE_ADMIN";

export const ORIGINES_REPRISE: readonly OrigineReprise[] = ["ARTICLE_DEPOT", "OFFRE_EXEMPLE", "OFFRE_ADMIN"];

/** D'où vient un contenu repris — la phrase que l'écran affiche à côté de lui. */
export const LIBELLE_ORIGINE: Record<OrigineReprise, string> = {
  ARTICLE_DEPOT: "Repris du site (article écrit dans son dépôt)",
  OFFRE_EXEMPLE: "Reprise du site (offre d'exemple livrée avec le site)",
  OFFRE_ADMIN: "Reprise du site (offre saisie dans son administration)",
};

export function origineReprise(v: string | null | undefined): OrigineReprise | null {
  return v && (ORIGINES_REPRISE as readonly string[]).includes(v) ? (v as OrigineReprise) : null;
}

/**
 * LE SITE DÉTIENT-IL DÉJÀ CE CONTENU DE LUI-MÊME ? Un article de son dépôt, une offre saisie dans son
 * administration : oui — et c'est ce qui change la règle « un brouillon jamais publié n'est pas
 * envoyé » (§118.158). Elle protège un site qui ne connaît pas le contenu ; ici il le connaît, et ne
 * pas lui envoyer notre version, même en brouillon, laisserait SA copie en ligne : un article que
 * l'on retire dans l'ERP juste après la reprise resterait lisible sur le site, pour toujours.
 * Une offre d'EXEMPLE, elle, n'est plus montrée par un site relié : la règle ordinaire s'applique.
 */
export function detenuParLeSite(origine: string | null | undefined): boolean {
  return origine === "ARTICLE_DEPOT" || origine === "OFFRE_ADMIN";
}

// ───────────────────────────── La réponse de `GET /repository` ─────────────────────────────

/** Un article du dépôt du site, tel que le site l'a écrit — le Markdown BRUT, pas le rendu. */
export interface ArticleDuDepotComplet {
  slug: string;
  titre: string;
  description: string;
  corps: string;
  categorie: string;
  tags: string[];
  auteur: string;
  date: Date | null;
  maj: Date | null;
  aLaUne: boolean;
  /** Le site le cache déjà (une reprise antérieure) : repris, il ne redevient pas visible. */
  cache: boolean;
}

/** Une offre d'exemple livrée avec le site. */
export interface OffreExemple {
  slug: string;
  titre: string;
  departement: string;
  lieu: string;
  type: string;
  experience: string;
  resume: string;
  missions: string[];
  profil: string[];
  offre: string[];
}

export interface DepotDuSite {
  articles: ArticleDuDepotComplet[];
  exemples: OffreExemple[];
  /** Les éléments qu'on n'a pas su lire — ignorés ET comptés : jamais « le site n'a rien ». */
  illisibles: number;
}

const texte = (v: unknown): string => (typeof v === "string" ? v : "");
const net = (v: unknown): string => texte(v).trim();
const listeTexte = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean) : typeof v === "string" ? lignes(v) : [];
const date = (v: unknown): Date | null => {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t) : null;
};
/** La forme d'un slug de fichier telle que le site l'accepte (`lib/replaced-files.ts`) — relue, pas devinée. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugDuSite = (v: unknown): string | null => {
  const s = net(v);
  return s && s.length <= 96 && SLUG.test(s) ? s : null;
};

/**
 * LIT `GET /api/v1/repository`. `null` quand la réponse n'a pas la forme attendue — une liste
 * `articles` manquante n'est pas « le dépôt est vide ». Un élément illisible est écarté et compté.
 */
export function lireDepotDuSite(v: unknown): DepotDuSite | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.articles)) return null;
  let illisibles = 0;
  const articles: ArticleDuDepotComplet[] = [];
  const vus = new Set<string>();
  for (const e of o.articles) {
    if (!e || typeof e !== "object" || Array.isArray(e)) { illisibles += 1; continue; }
    const a = e as Record<string, unknown>;
    const slug = slugDuSite(a.slug);
    const corps = texte(a.body);
    // Sans adresse sûre ni corps, il n'y a rien à reprendre qui tienne : écarté, compté.
    if (!slug || !corps.trim() || vus.has(slug)) { illisibles += 1; continue; }
    vus.add(slug);
    articles.push({
      slug,
      titre: net(a.title) || slug,
      description: net(a.description),
      corps: corps.replace(/\r\n/g, "\n"),
      categorie: net(a.category),
      tags: listeTexte(a.tags),
      auteur: net(a.author),
      date: date(a.date),
      maj: date(a.updated),
      aLaUne: a.featured === true,
      cache: a.replaced === true,
    });
  }
  const exemples: OffreExemple[] = [];
  if (Array.isArray(o.sampleJobs)) {
    for (const e of o.sampleJobs) {
      if (!e || typeof e !== "object" || Array.isArray(e)) { illisibles += 1; continue; }
      const j = e as Record<string, unknown>;
      const slug = slugDuSite(j.slug);
      const titre = net(j.title);
      if (!slug || !titre) { illisibles += 1; continue; }
      exemples.push({
        slug, titre,
        departement: net(j.department), lieu: net(j.location), type: net(j.type), experience: net(j.experience),
        resume: net(j.summary), missions: listeTexte(j.mission), profil: listeTexte(j.profile), offre: listeTexte(j.offer),
      });
    }
  }
  return { articles, exemples, illisibles };
}

// ───────────────────────────── Traduire en contenu de l'ERP ─────────────────────────────

/**
 * UN ARTICLE DU DÉPÔT, TEL QUE L'ERP LE TIENDRA. Même adresse (les liens déjà partagés restent
 * valables), même texte, même date — et publié tant que le site le montrait (§ la règle en tête).
 */
export function articleRepris(a: ArticleDuDepotComplet): ArticleSaisi {
  return {
    title: a.titre,
    body: a.corps,
    description: a.description || null,
    slug: a.slug,
    category: a.categorie || null,
    tags: a.tags,
    author: a.auteur || null,
    date: a.date,
    updated: a.maj,
    featured: a.aLaUne,
    published: !a.cache,
    repriseDe: a.slug,
  };
}

/** UNE OFFRE D'EXEMPLE, reprise en BROUILLON : publier un poste est une décision, pas une reprise. */
export function offreExempleReprise(e: OffreExemple): OffreSaisie {
  return {
    title: e.titre,
    department: e.departement || null,
    location: e.lieu || null,
    type: e.type || null,
    experience: e.experience || null,
    summary: e.resume || null,
    mission: e.missions,
    profile: e.profil,
    offer: e.offre,
    published: false,
    // Pas de `repriseDe` : un site relié ne montre plus ses exemples, il n'y a rien à y remplacer.
    repriseDe: null,
  };
}

/**
 * UNE OFFRE SAISIE DANS L'ADMINISTRATION DU SITE (`GET /jobs`, sans `externalId`), avec l'état que le
 * site lui donnait. `null` quand l'élément n'a ni identifiant ni intitulé : on ne reprend pas ce
 * qu'on ne saurait pas désigner au site pour qu'il retire sa copie.
 */
export function offreAdminReprise(e: EnregistrementSite): { cle: string; saisie: OffreSaisie } | null {
  if (e.externalId) return null;
  const b = e.brut;
  const cle = net(b.id);
  const titre = net(b.title);
  if (!cle || !/^[A-Za-z0-9._~-]{1,128}$/.test(cle) || !titre) return null;
  return {
    cle,
    saisie: {
      title: titre,
      department: net(b.department) || null,
      location: net(b.location) || null,
      type: net(b.type) || null,
      experience: net(b.experience) || null,
      summary: net(b.summary) || null,
      mission: listeTexte(b.mission),
      profile: listeTexte(b.profile),
      offer: listeTexte(b.offer),
      published: b.published === true,
      repriseDe: cle,
    },
  };
}
