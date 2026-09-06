import type { CurrentUser } from "@/lib/session";
import { assistantToolsFor, RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { POWER_TOOLS } from "@/lib/assistant/power-tools";
import type { CapabilityBrief, CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import { capabilityMeta, EFFECT_RANK, type CapabilityMeta, type Effect } from "@/lib/missions/registry/capability-meta";
import { contratDepuisSchema } from "@/lib/missions/registry/input-contract";
import type { ContratEntree } from "@/lib/missions/ports";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CATALOGUE RÉEL — les capacités d'Adam, vues par le Mission Runtime.
 *
 * ── LA SOURCE, ET POURQUOI CELLE-LÀ ─────────────────────────────────────────────────────
 *
 * `assistantToolsFor(user)` est la liste EXACTE des outils ouverts à cette personne : la même
 * que celle envoyée au modèle en conversation, bornée par les mêmes droits, calculée par le
 * même code. En repartir garantit qu'une mission ne peut PAS atteindre ce que la conversation
 * ne pourrait pas atteindre — c'est-à-dire qu'une mission n'est pas une porte dérobée (§48).
 *
 * Écrire une seconde liste « des outils utilisables en mission » aurait été plus simple et
 * strictement faux : deux listes divergent, et celle qui diverge est toujours celle qui gardait.
 *
 * ── CE QUE LE CATALOGUE AJOUTE À LA LISTE ───────────────────────────────────────────────
 *
 * Les MÉTADONNÉES D'EXÉCUTION (effet, idempotence, groupabilité) que la conversation n'a pas
 * besoin de connaître et que le runtime ne peut pas deviner. Elles viennent de
 * `registry/capability-meta.ts`, qui est du côté du runtime — c'est-à-dire consultable par un
 * test sans base ni fournisseur.
 *
 * ── LE COÛT, ET POURQUOI IL EST PAYÉ UNE FOIS ───────────────────────────────────────────
 *
 * `assistantToolsFor` construit cent soixante-cinq définitions. Le catalogue est donc bâti UNE
 * fois par mission et réutilisé pour toute sa durée : le compilateur l'interroge à chaque
 * étape, et il est synchrone précisément pour cela.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LE RÉSUMÉ D'UNE CAPACITÉ — court, mais pas AMPUTÉ.
 *
 * La première écriture coupait à la première phrase. Sur `directory_list`, dont le libellé est
 * « Liste de l'annuaire », le résumé devenait ces quatre mots — et le résolveur, qui confronte
 * la demande à ce texte, lui donnait un score de ZÉRO sur « envoie un message à chaque
 * SALARIÉ ». La capacité qui produit la liste des gens était invisible au planner de la mission
 * la plus courante du produit.
 *
 * On garde donc deux cent vingt caractères, coupés sur un mot, en commençant par le libellé
 * (qui dit CE QUE C'EST) suivi de la description (qui dit QUAND s'en servir).
 */
/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RÉSUMÉ COUPE LE TEXTE — MAIS PLUS LE VOCABULAIRE.
 *
 * ── LE DÉFAUT MESURÉ, ET IL DOMINAIT LE BANC D'AUTONOMIE ────────────────────────────────
 *
 * Le résumé est ce sur quoi `resoudreCapacites` MARQUE : c'est lui qui décide si une capacité
 * est montrée au planificateur. Couper à 220 caractères économise des jetons — et jette les
 * mots distinctifs, qui sont presque toujours à la fin.
 *
 * Cas mesuré : `calcul_statistiques`. Ses 220 premiers caractères parlent des SOURCES de
 * données (« mêmes sources que run_analysis : source, outil+args, drive, sql, lignes »). Les
 * mots qui répondent à une vraie question — significativité, corrélations, régression,
 * anomalies, série, prévision — arrivent après la coupe. Demandez « est-ce que l'écart est
 * significatif ou du bruit ? » : la capacité qui fait exactement cela ne marquait RIEN, donc
 * n'était pas montrée, donc ne pouvait pas être planifiée.
 *
 * Conséquence au banc des deux cents missions : STATISTIQUES 0/17, et « le plan ne prévoit pas
 * CALCUL » en tête des causes d'échec. Le planificateur ne refusait pas de calculer : on ne lui
 * montrait pas de quoi calculer. C'est la même famille de défaut que le registre (§44) — la
 * capacité existe, elle n'est pas VISIBLE au moment où l'on décide.
 *
 * ── LA CORRECTION, ET POURQUOI ELLE NE COÛTE PRESQUE RIEN ───────────────────────────────
 *
 * On garde la coupe (le budget de jetons est la raison d'être du brief), et on rattache une
 * QUEUE DE MOTS : les termes distinctifs de la partie coupée, dédupliqués et bornés à douze.
 * Le brief reste court, et le vocabulaire de toute la description redevient marquable.
 *
 * Elle ne demande aucun entretien : rien n'est écrit à la main capacité par capacité, donc
 * rien ne peut se périmer quand une description change. Et elle ne pèse que sur les briefs
 * réellement MONTRÉS (une vingtaine sur deux cent vingt-neuf), pas sur le catalogue entier.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const RESUME_MAX = 220;
export const MOTS_QUEUE_MAX = 12;
/** Les mots vides : les rattacher ferait grossir la queue sans rien rendre marquable. */
const VIDES = new Set([
  "aussi", "avec", "cette", "chaque", "comme", "dans", "depuis", "donne", "elle", "entre", "être",
  "leur", "leurs", "mais", "meme", "mêmes", "pour", "quand", "quel", "quelle", "sans", "selon",
  "sont", "sous", "toujours", "tous", "toute", "toutes", "jamais", "plutot", "plutôt", "celui",
  "celle", "ceux", "dont", "elles", "ainsi", "alors", "encore", "autre", "autres", "faire",
]);
const ACCENTS_RESUME = /[\u0300-\u036f]/g;

function queueDeMots(reste: string, deja: string): string {
  const vus = new Set(
    deja.normalize("NFD").replace(ACCENTS_RESUME, "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean),
  );
  const mots: string[] = [];
  for (const brut of reste.split(/[^\p{L}\p{N}]+/u)) {
    const norme = brut.normalize("NFD").replace(ACCENTS_RESUME, "").toLowerCase();
    // Cinq lettres au moins : c'est le seuil sous lequel un mot n'est plus distinctif, et c'est
    // aussi celui que `scoreCapacite` utilise pour son rattrapage par préfixe.
    if (norme.length < 5 || VIDES.has(norme) || vus.has(norme)) continue;
    vus.add(norme);
    mots.push(brut.toLowerCase());
    if (mots.length >= MOTS_QUEUE_MAX) break;
  }
  return mots.join(" ");
}

function resumer(texte: string): string {
  const propre = texte.replace(/\s+/g, " ").trim();
  if (propre.length <= RESUME_MAX) return propre;
  const coupe = propre.slice(0, RESUME_MAX);
  const espace = coupe.lastIndexOf(" ");
  const garde = espace > 120 ? coupe.slice(0, espace) : coupe;
  const queue = queueDeMots(propre.slice(garde.length), garde);
  return queue ? `${garde}… aussi : ${queue}` : `${garde}…`;
}

const estEcriture = (n: string): boolean => RESOLVER_WRITE_NAMES.has(n);

/**
 * LA FORME DE SORTIE DES CAPACITÉS QUI PRODUISENT DES LISTES — dite au planificateur, pas devinée.
 *
 * Un éventail se déploie sur un CHEMIN (`forEachPath`). Le planificateur écrivait « documents »
 * pour une capacité qui rend `resultats`, et l'éventail refusait de choisir entre deux listes.
 * Nommer la liste dans le résumé coûte quelques mots et supprime la devinette. Ce tableau est
 * du SAVOIR (la forme réelle des sorties), pas une consigne : il se corrige en le lisant.
 */
const SORTIES: Record<string, string> = {
  // Le banc m6 a payé une erreur ICI : « resultats: [{ id }] » alors que la capacité rend
  // `driveNodeId`. Le planificateur a écrit `{{recherche:contrat.resultats.0.id}}`, le moteur a
  // répondu « ne rend pas resultats.0.id — champs disponibles : nom, driveNodeId, … ». Ces
  // formes sont relues dans le code de chaque outil ; en changer une sans relire l'outil, c'est
  // remettre la devinette que ce tableau existe pour supprimer.
  find_documents: "rend { resultats: [{ nom, driveNodeId, chemin, confiance, preuve, typeDetecte, … }], couverture } — éventail sur « resultats » ; l'identifiant à donner à read_document est « driveNodeId »",
  search_everything: "rend { resultats: [{ famille, titre, reference, … }], total } — éventail sur « resultats »",
  directory_list: "rend { salaries: [{ id, nom, emails, … }], total } — éventail sur « salaries »",
  list_my_tasks: "rend une LISTE à la racine : [{ titre, statut, priorite, echeance, assigneA }] — éventail sur la racine (le chemin est ramené à la liste)",
  gmail_search: "rend { messages: [{ id, filId, de, objet, date, … }] } — éventail sur « messages » ; « filId » est le fil (threadId)",
  search_drive: "rend { items: [{ nom, driveNodeId, lien, … }], count } — éventail sur « items » ; l'identifiant à donner à read_document est « driveNodeId »",
};

export interface CatalogueReel extends CapabilityCatalog {
  /** Le nombre de capacités ouvertes à cette personne — mesuré, pour l'observabilité. */
  readonly taille: number;
}

/**
 * CONSTRUIT LE CATALOGUE D'UNE PERSONNE.
 *
 * L'acteur passé à `allowed()` est comparé à celui du catalogue : un catalogue construit pour
 * quelqu'un ne peut pas servir à autoriser quelqu'un d'autre. Sans ce contrôle, un catalogue
 * mis en cache par erreur autoriserait les droits de la personne précédente — la faute exacte
 * qui produit une élévation de privilège invisible.
 */
export interface OptionsCatalogue {
  /**
   * LE PLAFOND D'EFFET — une RESTRICTION, jamais une ouverture.
   *
   * Passer `"ANALYZE"` retire du catalogue toute capacité qui écrit, communique, engage ou
   * détruit. Le filtre porte sur `defs`, donc sur les TROIS réponses du catalogue à la fois :
   * `has()` dit non, `allowed()` dit non, `brief()` ne la montre pas. Un modèle ne peut donc
   * pas la planifier, et s'il en invente le nom, le compilateur rend `UNKNOWN_CAPABILITY`.
   *
   * C'est ce qui rend « exécution en lecture seule » vérifiable plutôt que promis : la sûreté
   * ne vient pas d'une phrase dans la consigne — un document lu par une étape pourrait la
   * contredire — mais de l'absence de l'outil dans la liste que le compilateur consulte.
   *
   * Le plafond ne peut RIEN élargir : le point de départ reste `assistantToolsFor(user)`, donc
   * les droits réels de la personne. `effetMax` ne fait que soustraire.
   */
  effetMax?: Effect;
}

export function catalogueDe(user: CurrentUser, opts: OptionsCatalogue = {}): CatalogueReel {
  const toutes = assistantToolsFor(user);
  const plafond = opts.effetMax ? EFFECT_RANK[opts.effetMax] : null;
  const defs = plafond === null
    ? toutes
    : toutes.filter((d) => EFFECT_RANK[capabilityMeta(d.name, estEcriture).effect] <= plafond);
  const parNom = new Map(defs.map((d) => [d.name, d]));
  const labels = new Map(POWER_TOOLS.map((t) => [t.def.name, t.label]));
  const metas = new Map<string, CapabilityMeta>();

  const meta = (name: string): CapabilityMeta => {
    const cache = metas.get(name);
    if (cache) return cache;
    const m = capabilityMeta(name, estEcriture);
    metas.set(name, m);
    return m;
  };

  // LE CONTRAT D'ENTRÉE VIENT DU SCHÉMA DE L'OUTIL — celui que la conversation envoie déjà au
  // modèle. Pas de second tableau à tenir : quand un outil change une clé, le planificateur et
  // le compilateur le voient au même instant que la conversation.
  const contrats = new Map<string, ContratEntree | null>(
    defs.map((d) => [d.name, contratDepuisSchema((d as { input_schema?: unknown }).input_schema)]),
  );

  const briefs: CapabilityBrief[] = defs.map((d) => {
    const m = meta(d.name);
    return {
      id: d.name,
      domain: m.domain,
      primitive: m.primitive,
      effect: m.effect,
      batchable: m.batchable,
      summary: resumer(labels.get(d.name) ? `${labels.get(d.name)}. ${d.description}` : d.description)
        + (SORTIES[d.name] ? ` [${SORTIES[d.name]}]` : ""),
      entrees: contrats.get(d.name) ?? null,
    };
  });

  return {
    taille: defs.length,
    // LE PLAFOND VOYAGE AVEC LE CATALOGUE. Celui qui reçoit une liste filtrée doit connaître la
    // raison du filtre — sans elle, le planner propose des nœuds ARTIFACT que le compilateur
    // refusera toujours, et paie des appels pour des plans structurellement impossibles.
    plafondEffet: opts.effetMax ?? null,
    has: (name) => parNom.has(name),
    allowed: (name, actor) => actor.userId === user.id && parNom.has(name),
    meta,
    entrees: (name) => contrats.get(name) ?? null,
    brief: (actor, opts) => {
      if (actor.userId !== user.id) return [];
      const filtres = opts?.domains && opts.domains.length > 0
        ? briefs.filter((b) => opts.domains!.includes(b.domain))
        : briefs;
      return opts?.limit ? filtres.slice(0, opts.limit) : filtres;
    },
  };
}

/** L'acteur ERP correspondant à une personne — utilisé quand elle agit elle-même. */
export function acteurDe(user: CurrentUser): MissionActor {
  return { userId: user.id, label: user.name, isAgent: false };
}
