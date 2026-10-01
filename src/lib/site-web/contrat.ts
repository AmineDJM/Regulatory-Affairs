/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONTRAT DE L'API DE CONTENU DU SITE ADVENTUM — côté ERP, et PUR (zéro import).
 *
 * Le site expose une API prête et testée (`docs/openapi.yaml` et `docs/ERP-INTEGRATION.md`, dans
 * le dépôt du site). L'ERP en est le CLIENT : il est la source de vérité et POUSSE le contenu —
 * `PUT /jobs/{externalId}`, `PUT /posts/{externalId}`, `DELETE …`. Rien ne se développe côté site.
 *
 * Ce fichier ne sait ni lire la base, ni ouvrir le réseau, ni lire la clé. Il dit :
 *   • ce qu'un corps d'offre ou d'article CONTIENT, champ par champ, dans l'ordre ;
 *   • ce qui le fait refuser AVANT qu'il parte (les limites du contrat, toutes en une fois) ;
 *   • ce qu'une réponse du site VEUT DIRE pour la file (réussi, à réessayer, à corriger, bloquant) ;
 *   • quand réessayer (1 s, 5 s, 30 s, 2 min, 10 min — et jamais sur un 4xx hors 429) ;
 *   • en quoi ce que le site détient DIFFÈRE de ce que l'ERP veut (la réconciliation quotidienne).
 *
 * Le serveur (la file, la réconciliation), les écrans (composants client) et les bancs en ont
 * tous besoin : d'où un module sans le moindre import, que le navigateur a le droit de charger.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les deux natures de contenu que le site accepte de l'ERP. */
export type NatureContenu = "JOB" | "POST";

/** Le segment d'URL de chaque nature : `/api/v1/jobs/…`, `/api/v1/posts/…`. */
export const CHEMIN_API: Record<NatureContenu, "jobs" | "posts"> = { JOB: "jobs", POST: "posts" };

export const LIBELLE_NATURE: Record<NatureContenu, string> = { JOB: "Offre d'emploi", POST: "Article" };

// ───────────────────────────── L'identifiant externe ─────────────────────────────

/**
 * L'`externalId` est l'identifiant de l'ERP, placé dans l'URL : c'est la clé d'idempotence.
 * Le premier PUT crée, les suivants mettent à jour, et rejouer une requête ne crée jamais de
 * doublon — l'ERP n'a donc AUCUN identifiant à stocker en retour.
 *
 * On emploie l'identifiant INTERNE de l'objet (un cuid), jamais sa référence lisible : une
 * référence peut être réattribuée après une suppression, un cuid jamais. Réutiliser un
 * `externalId` ferait réécrire, sur le site public, la page d'un contenu qui n'a rien à voir.
 *
 * Contrainte du site : 1 à 128 caractères, sûrs pour une URL. On exige les caractères NON
 * RÉSERVÉS de la RFC 3986 — ce qu'un cuid est par construction — plutôt que de compter sur
 * l'encodage pour sauver un identifiant qui contiendrait « / » ou « ? ».
 */
const EXTERNAL_ID_SUR = /^[A-Za-z0-9._~-]{1,128}$/;
export function externalIdValide(id: string): boolean {
  return EXTERNAL_ID_SUR.test(id);
}

// ───────────────────────────── Les limites du contrat ─────────────────────────────

/** Les longueurs maximales déclarées par `docs/openapi.yaml` (JobInput). */
export const LIMITES_OFFRE = {
  title: 160, department: 120, location: 120, type: 60, experience: 120, summary: 600, liste: 30,
} as const;

/** Les longueurs maximales déclarées par `docs/openapi.yaml` (PostInput). */
export const LIMITES_ARTICLE = {
  title: 200, body: 200_000, description: 400, slug: 96, category: 80, tags: 20, author: 120,
} as const;

/** « C'est le texte affiché par Google. Viser 150–160 caractères. » — `ERP-INTEGRATION.md` §5.3. */
export const DESCRIPTION_IDEALE = { min: 150, max: 160 } as const;

/**
 * LES VALEURS PAR DÉFAUT DU SITE, envoyées EXPLICITEMENT.
 *
 * Le site les applique quand le champ manque. On les écrit quand même : si le site traite un PUT
 * comme un REMPLACEMENT, un champ omis prendrait sa valeur par défaut — ce qui est aussi ce qu'on
 * envoie ; s'il FUSIONNE, un champ omis garderait l'ancienne valeur — et c'est ce qu'on veut
 * éviter. Écrire la valeur rend les deux lectures équivalentes, et la réconciliation compare à
 * ce qu'on a réellement envoyé au lieu de deviner une valeur par défaut.
 */
export const DEFAUTS_SITE = { category: "Secteur", author: "Adventum Pharma" } as const;

/** Les types de contrat qu'on propose, écrits comme le site les lit (`CDD` → TEMPORARY, `Stage` → INTERN). */
export const TYPES_CONTRAT_SITE = ["CDI", "CDD", "Stage", "Consulting", "Intérim", "Freelance"] as const;

// ───────────────────────────── Ce que l'ERP saisit ─────────────────────────────

/** Une offre d'emploi telle que l'ERP la tient — et RIEN d'autre : ni salaire, ni justification. */
export interface OffreSaisie {
  title: string;
  department: string | null;
  location: string | null;
  type: string | null;
  experience: string | null;
  summary: string | null;
  mission: readonly string[];
  profile: readonly string[];
  offer: readonly string[];
  /** Le choix de la personne : l'offre est-elle publiée ? */
  published: boolean;
  /**
   * L'offre SAISIE DANS L'ADMINISTRATION DU SITE que celle-ci reprend (§118.160) — son identifiant
   * côté site. Posée, le site retire sa copie et ne garde que la nôtre : jamais deux fois le même
   * poste sur la page Carrières.
   */
  repriseDe?: string | null;
}

/** Un article de blog tel que l'ERP le tient. */
export interface ArticleSaisi {
  title: string;
  /** Markdown. Pas de titre de niveau 1 : le `title` le fournit. */
  body: string;
  description: string | null;
  slug: string | null;
  category: string | null;
  tags: readonly string[];
  author: string | null;
  /** Date de publication (datePublished). */
  date: Date | null;
  /** Date de dernière révision (dateModified), posée quand un article déjà publié change. */
  updated: Date | null;
  featured: boolean;
  published: boolean;
  /**
   * L'article du DÉPÔT du site que celui-ci reprend (§118.160) — son slug. Posé, le site cache le
   * fichier pour de bon et c'est notre version qui EST l'article, publiée ou non.
   */
  repriseDe?: string | null;
}

// ───────────────────────────── Ce qui part sur le réseau ─────────────────────────────

/** Le corps d'un `PUT /jobs/{externalId}` — `JobInput` de l'OpenAPI, champ pour champ. */
export interface JobInput {
  title: string;
  department: string;
  location: string;
  type: string;
  experience: string;
  summary: string;
  mission: string[];
  profile: string[];
  offer: string[];
  published: boolean;
  /** L'offre saisie dans l'administration du site que celle-ci remplace (§118.160). */
  replacesJob?: string;
}

/** Le corps d'un `PUT /posts/{externalId}` — `PostInput` de l'OpenAPI, champ pour champ. */
export interface PostInput {
  title: string;
  body: string;
  description: string;
  slug?: string;
  category: string;
  tags: string[];
  author: string;
  date: string;
  updated?: string;
  featured: boolean;
  published: boolean;
  /** L'article du dépôt du site que celui-ci remplace (§118.160). */
  replacesFile?: string;
}

/**
 * LE CORPS D'UNE SUPPRESSION de contenu repris (§118.160). Un `DELETE` ordinaire n'en a pas ; celui
 * d'un contenu repris du site dit AUSSI ce qu'il remplaçait — parce que le site doit le cacher même
 * s'il n'a jamais reçu notre version (supprimée avant d'être partie, ou refusée tant qu'elle était à
 * corriger). Sans ce corps, supprimer un article repris ferait REVENIR le fichier du dépôt.
 */
export type CorpsSuppression = { replacesFile: string } | { replacesJob: string };

/**
 * UNE LISTE À PUCES saisie en texte — une ligne par élément.
 *
 * On retire les puces qu'une personne tape par réflexe (« - », « • », « * », « 1. ») : le site
 * rend lui-même la liste, et une puce recopiée s'afficherait en double. Les lignes vides tombent.
 */
export function lignes(texte: string | null | undefined): string[] {
  if (!texte) return [];
  return texte
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*·–]|\d{1,2}[.)])\s+/, "").trim())
    .filter((l) => l.length > 0);
}

const net = (v: string | null | undefined): string => (v ?? "").trim();
const liste = (xs: readonly string[]): string[] => xs.map((x) => x.trim()).filter(Boolean);

/**
 * TOUT CE QUI EMPÊCHE UNE OFFRE DE PARTIR — en une fois (§118.18 : un refus qui distille ses
 * objections fait payer un aller-retour par objection). Une liste vide veut dire « elle peut
 * partir » : le site ne la refusera pas pour une longueur.
 */
export function refusOffre(o: OffreSaisie): string[] {
  const refus: string[] = [];
  const titre = net(o.title);
  if (!titre) refus.push("L'intitulé du poste est obligatoire : c'est lui qui forme l'adresse de la page (/carrieres/…).");
  const bornes: [string, string | null, number][] = [
    ["L'intitulé", o.title, LIMITES_OFFRE.title],
    ["Le département", o.department, LIMITES_OFFRE.department],
    ["Le lieu", o.location, LIMITES_OFFRE.location],
    ["Le type de contrat", o.type, LIMITES_OFFRE.type],
    ["L'expérience", o.experience, LIMITES_OFFRE.experience],
    ["Le résumé", o.summary, LIMITES_OFFRE.summary],
  ];
  for (const [nom, v, max] of bornes) {
    const n = net(v).length;
    if (n > max) refus.push(`${nom} dépasse ${max} caractères (${n}) — le site le refuserait.`);
  }
  const listes: [string, readonly string[]][] = [["Les missions", o.mission], ["Le profil", o.profile], ["Ce que l'on offre", o.offer]];
  for (const [nom, xs] of listes) {
    const n = liste(xs).length;
    if (n > LIMITES_OFFRE.liste) refus.push(`${nom} comptent ${n} lignes : le site en accepte ${LIMITES_OFFRE.liste} au plus.`);
  }
  return refus;
}

/**
 * LE SLUG, s'il est donné : ce qui forme l'adresse `/blog/<slug>`. Minuscules, chiffres et tirets
 * simples — la forme qu'un moteur de recherche lit sans l'encoder. Absent, le site le dérive du
 * titre, et c'est le cas normal.
 */
const SLUG_SUR = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function slugValide(slug: string): boolean {
  return slug.length <= LIMITES_ARTICLE.slug && SLUG_SUR.test(slug);
}

/**
 * LE SLUG QUE L'ON SUGGÈRE à partir d'un titre — minuscules sans accents, tirets. C'est une
 * PROPOSITION affichée à l'auteur, jamais une affirmation sur ce que le site dérivera : seule la
 * réponse du site (`post.url`) dit l'adresse réelle, et c'est elle qu'on stocke.
 */
export function slugSuggere(titre: string): string {
  return titre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[œ]/g, "oe")
    .replace(/[æ]/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITES_ARTICLE.slug)
    .replace(/-+$/g, "");
}

/**
 * TOUT CE QUI EMPÊCHE UN ARTICLE DE PARTIR, en une fois. `titresInterdits` vient du contrôle
 * Markdown (`markdown.ts`) : on le reçoit plutôt que de l'importer, pour que ce module reste le
 * contrat et l'autre la lecture du texte — deux questions, deux fichiers.
 */
export function refusArticle(a: ArticleSaisi, titresInterdits: readonly string[] = []): string[] {
  const refus: string[] = [];
  if (!net(a.title)) refus.push("Le titre est obligatoire : il sert de titre de la page et de balise <title>.");
  if (!net(a.body)) refus.push("Le corps de l'article est vide.");
  const bornes: [string, string | null, number][] = [
    ["Le titre", a.title, LIMITES_ARTICLE.title],
    ["La description", a.description, LIMITES_ARTICLE.description],
    ["La catégorie", a.category, LIMITES_ARTICLE.category],
    ["L'auteur", a.author, LIMITES_ARTICLE.author],
  ];
  for (const [nom, v, max] of bornes) {
    const n = net(v).length;
    if (n > max) refus.push(`${nom} dépasse ${max} caractères (${n}) — le site le refuserait.`);
  }
  if (a.body.length > LIMITES_ARTICLE.body) {
    refus.push(`Le corps dépasse ${LIMITES_ARTICLE.body.toLocaleString("fr-FR")} caractères (${a.body.length.toLocaleString("fr-FR")}).`);
  }
  const slug = net(a.slug);
  if (slug && !slugValide(slug)) {
    refus.push(`L'adresse « ${slug} » n'est pas valide : minuscules, chiffres et tirets seulement, ${LIMITES_ARTICLE.slug} caractères au plus (exemple : ${slugSuggere(slug) || "tracabilite-des-lots"}).`);
  }
  const tags = new Set(liste(a.tags).map((t) => t.toLocaleLowerCase("fr")));
  if (tags.size > LIMITES_ARTICLE.tags) refus.push(`${tags.size} mots-clés : le site en accepte ${LIMITES_ARTICLE.tags} au plus.`);
  refus.push(...titresInterdits);
  return refus;
}

/**
 * UNE ADRESSE DÉJÀ PRISE PAR UN ARTICLE DU DÉPÔT DU SITE (contrat §8) : le fichier du dépôt reste
 * prioritaire, le site répond 200 et n'affiche pas le nôtre. Une phrase, lue par l'action serveur
 * ET par l'éditeur — deux rédactions du même refus finiraient par dire deux choses (§118.5).
 */
export function refusAdresseDuDepot(slug: string): string {
  return `L'adresse /blog/${slug} est celle d'un article du dépôt du site : le site afficherait le sien et ignorerait celui-ci. Choisissez une autre adresse.`;
}

/**
 * CE QUI NE BLOQUE PAS MAIS SE DIT. La description est ce que Google affiche : absente, le moteur
 * en fabrique une avec la première phrase venue ; trop longue, elle est coupée au milieu d'un mot.
 */
export function avertissementsArticle(a: ArticleSaisi): string[] {
  const out: string[] = [];
  const d = net(a.description).length;
  if (d === 0) out.push("Sans description, Google affichera un extrait choisi par lui. Visez 150 à 160 caractères.");
  else if (d < DESCRIPTION_IDEALE.min) out.push(`Description courte (${d} caractères) : Google en affiche jusqu'à ${DESCRIPTION_IDEALE.max}.`);
  else if (d > DESCRIPTION_IDEALE.max) out.push(`Description longue (${d} caractères) : Google la coupera vers ${DESCRIPTION_IDEALE.max}.`);
  if (liste(a.tags).length === 0) out.push("Aucun mot-clé : le bloc « articles liés » du site n'aura rien pour choisir.");
  return out;
}

/**
 * LE CORPS D'UNE OFFRE, champ pour champ, DANS L'ORDRE — `JSON.stringify` garde l'ordre
 * d'insertion, donc deux corps égaux sérialisent pareil (c'est ce qui rend l'empreinte stable).
 *
 * `posteOuvert` : une offre rattachée à un recrutement n'est PUBLIQUE que tant que le poste est
 * ouvert. Pourvu, clos, refusé ou annulé, elle part avec `published: false`, quoi qu'on ait coché
 * — un poste pourvu qu'on continue d'afficher fait postuler des gens pour rien, et c'est à la
 * page publique de l'entreprise que ça se voit. La règle vit ICI, dans le corps, et non dans le
 * seul crochet qui suit un changement d'étape : même un crochet oublié ne publierait pas un poste
 * fermé au prochain envoi.
 */
export function corpsOffre(o: OffreSaisie, posteOuvert = true): JobInput {
  return {
    title: net(o.title),
    department: net(o.department),
    location: net(o.location),
    type: net(o.type),
    experience: net(o.experience),
    summary: net(o.summary),
    mission: liste(o.mission),
    profile: liste(o.profile),
    offer: liste(o.offer),
    published: o.published && posteOuvert,
    // EN DERNIER, et seulement quand il y a lieu : le corps d'une offre qui n'est pas une reprise
    // sérialise EXACTEMENT comme avant — son empreinte ne change pas, rien ne repart pour rien.
    ...(net(o.repriseDe) ? { replacesJob: net(o.repriseDe) } : {}),
  };
}

/** Une date en ISO — ou `null` si elle ne se lit pas (une date invalide ne part jamais). */
function iso(d: Date | null | undefined): string | null {
  if (!d) return null;
  const t = d.getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * LES MOTS-CLÉS SANS DOUBLON, la casse ignorée — et c'est la PREMIÈRE graphie qui reste, celle que
 * l'auteur a tapée d'abord (un `Map` construit d'un coup garderait la dernière).
 */
function sansDoublons(tags: readonly string[]): string[] {
  const vus = new Map<string, string>();
  for (const t of tags) {
    const cle = t.toLocaleLowerCase("fr");
    if (!vus.has(cle)) vus.set(cle, t);
  }
  return [...vus.values()];
}

/**
 * LE CORPS D'UN ARTICLE, dans l'ordre.
 *
 * `date` part TOUJOURS : si le site traite un PUT comme un remplacement, une date omise vaudrait
 * « maintenant » — et la date de publication de l'article avancerait à chaque correction de
 * coquille, ce que les moteurs de recherche lisent comme un contenu neuf. `dateParDefaut` est
 * l'instant de la première mise en ligne quand l'auteur n'en a pas fixé.
 */
export function corpsArticle(a: ArticleSaisi, dateParDefaut: Date): PostInput {
  const slug = net(a.slug);
  const corps: PostInput = {
    title: net(a.title),
    body: a.body.replace(/\r\n/g, "\n"),
    description: net(a.description),
    ...(slug ? { slug } : {}),
    category: net(a.category) || DEFAUTS_SITE.category,
    tags: sansDoublons(liste(a.tags)),
    author: net(a.author) || DEFAUTS_SITE.author,
    // Dernier recours : « maintenant », c'est-à-dire la valeur par défaut du site lui-même —
    // jamais une date inventée (1970) qui s'afficherait en tête de l'article.
    date: iso(a.date) ?? iso(dateParDefaut) ?? new Date().toISOString(),
    featured: a.featured,
    published: a.published,
  };
  const updated = iso(a.updated);
  if (updated) corps.updated = updated;
  // EN DERNIER, et seulement pour une reprise : un article ordinaire garde sa sérialisation exacte.
  const reprise = net(a.repriseDe);
  if (reprise) corps.replacesFile = reprise;
  return corps;
}

/**
 * LA SÉRIALISATION UNIQUE. « Sérialiser le JSON une seule fois, signer cette chaîne, envoyer cette
 * même chaîne » (ERP-INTEGRATION.md §3) : la chaîne produite ici est stockée telle quelle dans la
 * file, signée telle quelle, envoyée telle quelle. Personne ne la reconstruit entre-temps.
 */
export function serialiser(corps: JobInput | PostInput | CorpsSuppression): string {
  return JSON.stringify(corps);
}

// ───────────────────────────── Ce qu'une réponse veut dire ─────────────────────────────

/**
 * L'ISSUE D'UNE REQUÊTE, pour la file :
 *   SUCCES      200/201 — le site détient le contenu (ou l'a supprimé) ;
 *   DEJA_ABSENT 404 sur un DELETE — « traiter comme déjà supprimé » (§6 du contrat) ;
 *   REESSAYER   réseau, délai, 429, 5xx — la requête est idempotente, réessayer est toujours sûr ;
 *   CORRIGER    4xx (hors 401 et 429) — la CHARGE UTILE est en cause, la rejouer telle quelle
 *               échouerait pareil ;
 *   BLOQUANT    401 (clé ou signature refusée) ou redirection (adresse du site fausse) — c'est la
 *               CONFIGURATION qui est en cause, pour TOUTES les requêtes : on arrête tout, on
 *               alerte, et l'on ne réessaie pas en boucle (§6 : « Ne pas réessayer en boucle »).
 */
export type IssueRequete = "SUCCES" | "DEJA_ABSENT" | "REESSAYER" | "CORRIGER" | "BLOQUANT";

export function classerReponse(methode: "GET" | "PUT" | "DELETE", statut: number | null): IssueRequete {
  if (statut === null) return "REESSAYER";
  if (statut >= 200 && statut < 300) return "SUCCES";
  if (statut === 404 && methode === "DELETE") return "DEJA_ABSENT";
  if (statut === 401) return "BLOQUANT";
  // Une redirection n'est jamais suivie (`redirect: "manual"`) : un PUT redirigé pourrait être
  // rejoué ailleurs, en GET, ou porter la clé vers un autre hôte. Elle dit que l'adresse
  // configurée n'est pas la bonne — pour toutes les requêtes à la fois.
  if (statut >= 300 && statut < 400) return "BLOQUANT";
  if (statut === 429) return "REESSAYER";
  if (statut >= 500) return "REESSAYER";
  return "CORRIGER";
}

/**
 * LES DÉLAIS DE RÉESSAI du contrat (§7) : 1 s, 5 s, 30 s, 2 min, 10 min. Le premier envoi part
 * tout de suite ; cinq réessais le suivent ; au sixième échec, la file s'arrête et le DIT — la
 * réconciliation quotidienne reprendra ce qui diverge.
 */
export const DELAIS_REESSAI_MS = [1_000, 5_000, 30_000, 120_000, 600_000] as const;
export const ESSAIS_MAX = DELAIS_REESSAI_MS.length + 1;

/** Un `Retry-After` plus long que le délai prévu est honoré — mais jamais au-delà d'une heure. */
const RETRY_AFTER_MAX_S = 3_600;

/**
 * LE PROCHAIN ESSAI après `essaisFaits` tentatives échouées pour CETTE version du contenu, ou
 * `null` quand les cinq réessais sont épuisés.
 */
export function prochainEssai(essaisFaits: number, maintenant: Date, retryAfterS: number | null = null): Date | null {
  if (essaisFaits < 1 || essaisFaits >= ESSAIS_MAX) return null;
  const prevu = DELAIS_REESSAI_MS[essaisFaits - 1]!;
  const demande = retryAfterS !== null && Number.isFinite(retryAfterS) && retryAfterS > 0
    ? Math.min(retryAfterS, RETRY_AFTER_MAX_S) * 1_000
    : 0;
  return new Date(maintenant.getTime() + Math.max(prevu, demande));
}

/** Le message d'erreur du site (`{"error": "…"}`), s'il se lit — sinon le début du corps brut. */
export function messageDuSite(texte: string | null): string | null {
  if (!texte) return null;
  try {
    const j = JSON.parse(texte) as unknown;
    if (j && typeof j === "object" && typeof (j as { error?: unknown }).error === "string") {
      return ((j as { error: string }).error).slice(0, 500);
    }
  } catch { /* le corps n'est pas du JSON : on rend son début, tel quel */ }
  const brut = texte.trim();
  return brut ? brut.slice(0, 300) : null;
}

// ───────────────────────────── Ce que le site détient ─────────────────────────────

/** Un enregistrement renvoyé par `GET /jobs` ou `GET /posts`, lu sans supposer sa forme. */
export interface EnregistrementSite {
  externalId: string | null;
  titre: string;
  url: string | null;
  slug: string | null;
  brut: Record<string, unknown>;
}

const chaine = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * LIT une liste renvoyée par le site. Un élément qui n'est pas un objet est ignoré ET compté :
 * une réponse qu'on ne sait pas lire ne se transforme pas en « le site n'a rien ».
 */
export function lireListeSite(v: unknown): { enregistrements: EnregistrementSite[]; illisibles: number } {
  if (!Array.isArray(v)) return { enregistrements: [], illisibles: 0 };
  const enregistrements: EnregistrementSite[] = [];
  let illisibles = 0;
  for (const e of v) {
    if (!e || typeof e !== "object" || Array.isArray(e)) { illisibles += 1; continue; }
    const o = e as Record<string, unknown>;
    const url = chaine(o.url);
    const slug = chaine(o.slug) ?? (url ? (url.split("/").filter(Boolean).pop() ?? null) : null);
    enregistrements.push({
      externalId: chaine(o.externalId),
      titre: chaine(o.title) ?? "(sans titre)",
      url,
      slug,
      brut: o,
    });
  }
  return { enregistrements, illisibles };
}

/** Les articles du DÉPÔT du site : le site les garde prioritaires sur un article poussé de même slug. */
export interface ArticleDuDepot { slug: string; url: string | null; titre: string }

export function lireArticlesDuDepot(v: unknown): ArticleDuDepot[] {
  if (!Array.isArray(v)) return [];
  const out: ArticleDuDepot[] = [];
  for (const e of v) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const slug = chaine(o.slug);
    if (!slug) continue;
    out.push({ slug, url: chaine(o.url), titre: chaine(o.title) ?? slug });
  }
  return out;
}

// ───────────────────────────── Comparer ce qu'on veut à ce qu'il a ─────────────────────────────

const texte = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v)).trim();

/** Une liste du site peut revenir en tableau OU en texte à sauts de ligne (le contrat accepte les deux). */
const listeSite = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map((x) => texte(x)).filter(Boolean);
  if (typeof v === "string") return lignes(v);
  return [];
};

const booleen = (v: unknown, defaut: boolean): boolean => (typeof v === "boolean" ? v : defaut);

/**
 * UNE DATE SE COMPARE AU JOUR. Si le site ne garde que la date calendaire, comparer à la
 * milliseconde déclarerait l'article divergent chaque nuit — et on le repousserait chaque nuit
 * pour rien. L'heure de publication d'un article n'a pas de sens éditorial ; le jour, si.
 */
const jour = (v: unknown): string | null => {
  const s = texte(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
};

/**
 * LES MOTS-CLÉS SE COMPARENT COMME UN ENSEMBLE, sans la casse. Le site s'en sert pour choisir des
 * articles liés — l'ordre n'y compte pas, et un site qui les met en minuscules ne doit pas faire
 * repousser l'article toutes les nuits.
 */
const ensemble = (xs: string[]): string => [...new Set(xs.map((x) => x.toLocaleLowerCase("fr")))].sort().join("\u0001");

/** Les champs d'une offre où le site diverge de ce que l'ERP veut. Vide = conforme. */
export function ecartsOffre(voulu: JobInput, site: Record<string, unknown>): string[] {
  const ecarts: string[] = [];
  for (const k of ["title", "department", "location", "type", "experience", "summary"] as const) {
    if (texte(site[k]) !== voulu[k]) ecarts.push(k);
  }
  for (const k of ["mission", "profile", "offer"] as const) {
    if (listeSite(site[k]).join("\n") !== voulu[k].join("\n")) ecarts.push(k);
  }
  if (booleen(site.published, false) !== voulu.published) ecarts.push("published");
  return ecarts;
}

/** Les champs d'un article où le site diverge de ce que l'ERP veut. Vide = conforme. */
export function ecartsArticle(voulu: PostInput, site: Record<string, unknown>): string[] {
  const ecarts: string[] = [];
  if (texte(site.title) !== voulu.title) ecarts.push("title");
  // Le corps : fins de ligne unifiées et blancs finaux ignorés — un site qui normalise les
  // retours chariot ne doit pas faire repousser 200 000 caractères chaque nuit. Et il ne se juge
  // que si le site le REND (§118.160) : sa liste l'omettait, contrat pourtant clair, et chaque
  // rapprochement repoussait TOUS les articles en les croyant modifiés — « 5 repoussés, écart sur
  // body » chaque nuit, sans un seul écart réel. Un champ qu'on ne lit pas ne prouve rien (§118.16).
  if (typeof site.body === "string") {
    const corpsSite = site.body.replace(/\r\n/g, "\n").trimEnd();
    if (corpsSite !== voulu.body.trimEnd()) ecarts.push("body");
  }
  if (texte(site.description) !== voulu.description) ecarts.push("description");
  if (voulu.slug !== undefined && texte(site.slug) !== voulu.slug) ecarts.push("slug");
  if ((texte(site.category) || DEFAUTS_SITE.category) !== voulu.category) ecarts.push("category");
  if ((texte(site.author) || DEFAUTS_SITE.author) !== voulu.author) ecarts.push("author");
  if (ensemble(listeSite(site.tags)) !== ensemble(voulu.tags)) ecarts.push("tags");
  if (jour(site.date) !== jour(voulu.date)) ecarts.push("date");
  if (voulu.updated !== undefined && jour(site.updated) !== jour(voulu.updated)) ecarts.push("updated");
  if (booleen(site.featured, false) !== voulu.featured) ecarts.push("featured");
  if (booleen(site.published, true) !== voulu.published) ecarts.push("published");
  // LA REPRISE se compare quand le site DIT ce qu'il détient (§118.160) : un site qui aurait perdu
  // le marqueur remontrerait le fichier du dépôt à côté de notre version. Un site qui ne rend pas
  // la clé (version antérieure) ne compte pas : ce qu'on ne lit pas à coup sûr ne fait pas
  // repousser un article chaque nuit (§118.16).
  if (voulu.replacesFile !== undefined && "replacesFile" in site && texte(site.replacesFile) !== voulu.replacesFile) {
    ecarts.push("replacesFile");
  }
  return ecarts;
}

// ───────────────────────────── La réconciliation quotidienne ─────────────────────────────

/** Ce que l'ERP VEUT que le site détienne, pour un contenu déjà connu de la file ou publié. */
export interface EtatVoulu {
  nature: NatureContenu;
  externalId: string;
  libelle: string;
  /** PUT = le site doit détenir ce corps ; DELETE = le site ne doit plus le détenir. */
  operation: "PUT" | "DELETE";
  /**
   * `null` sur un PUT : le contenu EXISTE dans l'ERP mais son état actuel serait refusé par le
   * site. Il n'est ni repoussé (le site le refuserait pareil) ni — surtout — compté parmi les
   * orphelins : ce qu'il détient n'est pas « inconnu de l'ERP », c'est une version qu'on ne sait
   * plus envoyer, et une personne doit la corriger.
   */
  corps: JobInput | PostInput | null;
  /** Pourquoi le corps manque, quand il manque sur un PUT — la phrase du contrat. */
  refus?: string;
}

export interface PlanRapprochement {
  /** À repousser : absent du site, ou divergent (avec les champs en cause). */
  aPousser: { nature: NatureContenu; externalId: string; libelle: string; raison: string; champs: string[] }[];
  /** Supprimé dans l'ERP, encore présent sur le site : le DELETE est rejoué. */
  aSupprimer: { nature: NatureContenu; externalId: string; libelle: string }[];
  /** Le site détient exactement ce que l'ERP veut (ou n'a plus ce que l'ERP a supprimé). */
  conformes: { nature: NatureContenu; externalId: string; url: string | null; slug: string | null }[];
  /**
   * Un `externalId` que l'ERP ne connaît pas. On ne le SUPPRIME PAS : ne pas le trouver dans la
   * file n'est pas une preuve qu'on l'a retiré (un test manuel de mise en service, un autre
   * environnement…). On le NOMME, et une personne décide (§118.9 : seul TROUVÉ autorise à agir).
   */
  orphelins: { nature: NatureContenu; externalId: string; titre: string; url: string | null }[];
  /** Saisis dans l'admin du site, sans `externalId` : pas les nôtres, on les compte et on n'y touche pas. */
  manuels: { jobs: number; posts: number };
  /**
   * Un article poussé dont le slug est aussi celui d'un article du DÉPÔT du site : le fichier du
   * dépôt reste prioritaire et notre version est ignorée publiquement (§8 du contrat). Le site
   * répond 200, l'ERP croit l'article en ligne — c'est le faux succès que ce champ rend visible.
   */
  collisions: { externalId: string; libelle: string; slug: string; titreDuDepot: string }[];
}

export function planifierRapprochement(
  voulus: readonly EtatVoulu[],
  site: { jobs: readonly EnregistrementSite[]; posts: readonly EnregistrementSite[]; depot: readonly ArticleDuDepot[] },
): PlanRapprochement {
  const plan: PlanRapprochement = { aPousser: [], aSupprimer: [], conformes: [], orphelins: [], manuels: { jobs: 0, posts: 0 }, collisions: [] };
  const index: Record<NatureContenu, Map<string, EnregistrementSite>> = { JOB: new Map(), POST: new Map() };
  for (const [nature, liste] of [["JOB", site.jobs], ["POST", site.posts]] as const) {
    for (const e of liste) {
      if (!e.externalId) { plan.manuels[nature === "JOB" ? "jobs" : "posts"] += 1; continue; }
      index[nature].set(e.externalId, e);
    }
  }
  const slugsDuDepot = new Map(site.depot.map((d) => [d.slug, d] as const));
  const connus: Record<NatureContenu, Set<string>> = { JOB: new Set(), POST: new Set() };

  for (const v of voulus) {
    connus[v.nature].add(v.externalId);
    const detenu = index[v.nature].get(v.externalId) ?? null;
    if (v.operation === "DELETE") {
      if (detenu) plan.aSupprimer.push({ nature: v.nature, externalId: v.externalId, libelle: v.libelle });
      else plan.conformes.push({ nature: v.nature, externalId: v.externalId, url: null, slug: null });
      continue;
    }
    if (!v.corps) continue;
    if (!detenu) {
      plan.aPousser.push({ nature: v.nature, externalId: v.externalId, libelle: v.libelle, raison: "absent du site", champs: [] });
      continue;
    }
    const champs = v.nature === "JOB"
      ? ecartsOffre(v.corps as JobInput, detenu.brut)
      : ecartsArticle(v.corps as PostInput, detenu.brut);
    if (champs.length > 0) {
      plan.aPousser.push({ nature: v.nature, externalId: v.externalId, libelle: v.libelle, raison: `écart sur ${champs.join(", ")}`, champs });
    } else {
      plan.conformes.push({ nature: v.nature, externalId: v.externalId, url: detenu.url, slug: detenu.slug });
    }
    if (v.nature === "POST") {
      const slug = detenu.slug ?? (v.corps as PostInput).slug ?? null;
      const duDepot = slug ? slugsDuDepot.get(slug) : undefined;
      if (slug && duDepot) plan.collisions.push({ externalId: v.externalId, libelle: v.libelle, slug, titreDuDepot: duDepot.titre });
    }
  }

  for (const nature of ["JOB", "POST"] as const) {
    for (const [externalId, e] of index[nature]) {
      if (!connus[nature].has(externalId)) plan.orphelins.push({ nature, externalId, titre: e.titre, url: e.url });
    }
  }
  return plan;
}

// ───────────────────────────── Ce qu'un écran affiche ─────────────────────────────

export type EtatFile = "PENDING" | "DONE" | "FAILED";

export interface FaitsPublication {
  /** Aucune ligne de file : le contenu n'est jamais parti. */
  existe: boolean;
  operation: "PUT" | "DELETE" | null;
  etat: EtatFile | null;
  essais: number;
  prochainEssai: Date | null;
  dernierStatut: number | null;
  derniereErreur: string | null;
  /** Ce que la personne a coché dans l'ERP. */
  publieDansErp: boolean;
  /** Ce que le dernier envoi confirmé portait (`published` du corps confirmé). */
  publieSurLeSite: boolean | null;
  urlPublique: string | null;
  /** Rien ne part : intégration absente, ou clé refusée. */
  suspendu: "NON_CONFIGURE" | "BLOQUE" | null;
}

export type Ton = "neutral" | "info" | "success" | "warning" | "danger";

/**
 * L'ÉTAT D'UNE PUBLICATION EN UNE PHRASE — la même pour la liste, la fiche et le tableau de bord.
 * Jamais « publié » tant que le site n'a pas répondu 200/201 : une case cochée dans l'ERP n'est
 * pas une page en ligne, et les confondre est exactement le faux succès que la file existe pour
 * éviter.
 */
export function etatPublication(f: FaitsPublication): { libelle: string; ton: Ton; detail: string | null } {
  if (!f.existe) {
    return f.publieDansErp
      ? { libelle: "À envoyer", ton: "warning", detail: "Pas encore transmis au site." }
      : { libelle: "Brouillon", ton: "neutral", detail: "Jamais publié : rien n'est sur le site." };
  }
  if (f.etat === "PENDING") {
    if (f.suspendu === "NON_CONFIGURE") return { libelle: "En attente", ton: "warning", detail: "L'intégration au site n'est pas configurée : l'envoi partira dès qu'elle le sera." };
    if (f.suspendu === "BLOQUE") return { libelle: "Suspendu", ton: "danger", detail: "Le site refuse la clé d'API : aucun envoi ne part tant que la configuration n'est pas corrigée." };
    if (f.essais === 0) return { libelle: "Envoi en cours", ton: "info", detail: null };
    // L'heure d'Alger, lisible : c'est une personne qui lit, pas un journal.
    const quand = f.prochainEssai
      ? f.prochainEssai.toLocaleString("fr-FR", { timeZone: "Africa/Algiers", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : null;
    return {
      libelle: "Nouvel essai prévu",
      ton: "warning",
      detail: `${f.essais} essai(s) sans succès${f.dernierStatut ? ` (dernière réponse : ${f.dernierStatut})` : " (site injoignable)"}${quand ? ` — prochain essai le ${quand}` : ""}.`,
    };
  }
  if (f.etat === "FAILED") {
    const corrige = f.dernierStatut !== null && f.dernierStatut >= 400 && f.dernierStatut < 500;
    return corrige
      ? { libelle: "Refusé par le site", ton: "danger", detail: f.derniereErreur ?? `Réponse ${f.dernierStatut}.` }
      : { libelle: "Échec d'envoi", ton: "danger", detail: `Le site n'a pas répondu après ${ESSAIS_MAX} essais. La réconciliation quotidienne réessaiera ; vous pouvez aussi relancer.` };
  }
  if (f.operation === "DELETE") return { libelle: "Supprimé du site", ton: "neutral", detail: null };
  if (f.publieSurLeSite) return { libelle: "En ligne", ton: "success", detail: f.urlPublique };
  return { libelle: "Retiré du site", ton: "neutral", detail: "Le site le garde en brouillon, invisible du public." };
}
