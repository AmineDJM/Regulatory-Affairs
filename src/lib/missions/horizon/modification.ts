/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * MODIFIER UNE MISSION EN COURS — chirurgicalement, ou pas du tout.
 *
 * ── CE QUE LA PERSONNE DIT, ET CE QUE ÇA DOIT COÛTER ────────────────────────────────────
 *
 *   « Finalement Amel à la place de Deepak. »
 *   « Annule uniquement le PowerPoint. »
 *   « Ajoute une analyse financière. »
 *   « Cette mission passe priorité 1. »
 *   « Mets-la en pause, reprends demain. »
 *   « Utilise maintenant le nouveau forecast. »
 *
 * Aucune de ces phrases ne dit « recommence tout ». Pourtant, sans ce module, chacune ne peut
 * se traduire que par une replanification COMPLÈTE : le planificateur relit l'objectif entier,
 * réécrit trois cents étapes, et la mission perd tout — les réponses déjà reçues, les fichiers
 * déjà produits, les accords déjà donnés. C'est ruineux, c'est lent, et c'est faux : un plan
 * neuf n'a aucune raison de reproduire les décisions qu'un humain avait déjà validées.
 *
 * ── LA RÈGLE, ET C'EST LA MÊME QUE §118.16 ──────────────────────────────────────────────
 *
 * L'empreinte RÉELLE d'une modification ne dépasse jamais l'empreinte DEMANDÉE. Deux axes, et
 * ils ne se confondent pas :
 *
 *   • la PROFONDEUR — une étape visée, ou toute sa descendance ? Remplacer un destinataire
 *     touche l'envoi ET ce qui lit sa réponse ; retirer un livrable ne touche que lui et ce qui
 *     ne sert plus qu'à lui.
 *   • la CARDINALITÉ — une cible nommée, ou toutes celles qui lui ressemblent ? « Deepak »
 *     désigne les étapes où Deepak est nommé, jamais « toutes les demandes d'information ».
 *
 * ── CE QU'ON NE FAIT PAS ────────────────────────────────────────────────────────────────
 *
 * On ne devine pas. Une cible qu'on ne reconnaît nulle part rend `reconnue: false` et la liste
 * de ce qu'on a REGARDÉ — jamais un « j'ai supposé que vous parliez de… ». Choisir à la place
 * d'un humain la branche à jeter est exactement le geste que §118.15 interdit.
 *
 * On ne rejoue pas un effet. Une étape qui a déjà envoyé, écrit ou déposé garde son reçu : elle
 * est NOMMÉE dans l'empreinte (`effetsIrreversibles`) pour que la personne sache ce qui est
 * déjà parti, et le pilote ne la relance pas. « Amel à la place de Deepak » ne dé-envoie pas le
 * message à Deepak ; il évite le suivant et le dit.
 *
 * PUR — pas de base, pas de modèle, pas d'horloge. C'est ce qui permet à la CONVERSATION et au
 * PILOTE d'en avoir besoin tous les deux sans avoir le droit de se parler (§118.16).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const GENRES_MODIFICATION = [
  /** Une personne, une source ou une entité en remplace une autre. */
  "REMPLACER",
  /** Une partie du travail n'est plus voulue — « annule uniquement le PPT ». */
  "RETIRER",
  /** Du travail s'ajoute — « ajoute une analyse financière ». Rien d'existant n'est invalidé. */
  "AJOUTER",
  /** L'ordonnancement change, pas le travail. */
  "REPRIORISER",
  /** La mission s'arrête sans rien perdre, et repartira. */
  "SUSPENDRE",
  "REPRENDRE",
  /** La mission s'arrête définitivement. */
  "ANNULER",
  /** Une donnée déjà lue a changé — « utilise maintenant le nouveau forecast ». */
  "RAFRAICHIR",
] as const;
export type GenreModification = (typeof GENRES_MODIFICATION)[number];

/** Les genres qui ne touchent AUCUNE étape : le graphe est identique après comme avant. */
export const SANS_IMPACT_GRAPHE: ReadonlySet<GenreModification> = new Set([
  "REPRIORISER", "SUSPENDRE", "REPRENDRE", "AJOUTER",
]);

export interface DemandeModification {
  genre: GenreModification;
  /**
   * CE QUI EST VISÉ, dans les mots de la personne : « Deepak », « le PowerPoint »,
   * « forecast NIVOLEX ». Vide pour les genres qui ne visent rien (pause, priorité).
   */
  cible: string;
  /** Le remplaçant, pour REMPLACER. */
  remplacant?: string | null;
  /** Ce qu'on ajoute, pour AJOUTER — décrit en clair, il deviendra un jalon. */
  ajout?: string | null;
  priorite?: number | null;
  motif?: string | null;
}

/**
 * UN NŒUD DU PLAN, tel que la modification a besoin de le voir.
 *
 * `texte` est composé par l'appelant : titre + valeurs textuelles de l'entrée, aplatis. Ce
 * module ne connaît ni Prisma ni la forme d'un payload — c'est ce qui le garde pur, et
 * testable sans base.
 */
export interface NoeudModifiable {
  key: string;
  titre: string;
  nodeType: string;
  status: string;
  milestoneOrdre: number | null;
  dependsOn: readonly string[];
  texte: string;
  /** L'étape a-t-elle DÉJÀ produit un effet (envoi parti, fichier déposé, écriture faite) ? */
  aEuUnEffet: boolean;
}

export interface EmpreinteModification {
  genre: GenreModification;
  /** La cible a-t-elle été reconnue quelque part ? `false` = on ne touche à rien. */
  reconnue: boolean;
  /** Les étapes où la cible est NOMMÉE — le cœur de l'empreinte. */
  visees: string[];
  /** Elles et leur descendance : ce qu'un sous-plan doit réécrire. */
  aRecompiler: string[];
  /** Les rangs des jalons concernés — ceux-là seuls sont rouverts. */
  jalonsTouches: number[];
  /** Ce qui est déjà parti : nommé, jamais rejoué en silence. */
  effetsIrreversibles: string[];
  /** Ce qui ne bouge pas. Dit explicitement : c'est la moitié de la promesse. */
  preservees: string[];
  /** La phrase exacte de ce qui va changer — celle que la personne lira avant de confirmer. */
  resume: string;
}

/** Normalisation minuscule et sans accent — assez pour reconnaître un nom dans un titre. */
export function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * LES MOTS QUI NE DÉSIGNENT RIEN — « le », « la », « uniquement », « finalement ».
 *
 * Sans eux, « le PowerPoint » chercherait aussi « le », qui apparaît dans toutes les étapes :
 * la cardinalité exploserait et la modification toucherait la mission entière. C'est exactement
 * le défaut que ce module existe pour empêcher.
 */
const VIDES = new Set(
  ("le la les l un une des du de d au aux et ou a à en dans sur pour par avec sans "
    + "ce cet cette ces son sa ses mon ma mes notre nos leur leurs "
    + "finalement uniquement seulement juste plutot maintenant desormais aussi encore "
    + "mets met mettre remplace remplacer annule annuler ajoute ajouter retire retirer "
    + "place lieu fais faire the of and to").split(/\s+/),
);

export function motsUtiles(cible: string): string[] {
  return normaliser(cible).split(" ").filter((m) => m.length >= 2 && !VIDES.has(m));
}

/**
 * LE NŒUD NOMME-T-IL LA CIBLE ?
 *
 * TOUS les mots utiles doivent y être. Un seul suffisant transformerait « le rapport Deepak »
 * en « toutes les étapes qui portent le mot rapport » — une empreinte plus large que la
 * demande, ce que §118.16 interdit. Zéro mot utile ne désigne rien : on ne fait pas correspondre
 * une cible vide à tout.
 */
export function nomme(noeud: NoeudModifiable, mots: readonly string[]): boolean {
  if (mots.length === 0) return false;
  const t = normaliser(`${noeud.titre} ${noeud.texte}`);
  // DÉBUT DE MOT, pas sous-chaîne : « amel » ne doit pas se reconnaître dans « camel ». Le
  // préfixe suffit à l'autre bout (« powerpoint » retrouve « powerpoints »), et c'est voulu :
  // un pluriel ou un accord ne doit pas faire manquer la cible que la personne a nommée.
  return mots.every((m) => new RegExp(`(?:^| )${echapper(m)}`).test(t));
}

const echapper = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Les nœuds qui descendent de `depuis`, lui compris, dans un ordre stable. */
function descendance(depuis: readonly string[], noeuds: readonly NoeudModifiable[]): string[] {
  const enfants = new Map<string, string[]>();
  for (const n of noeuds) {
    for (const d of n.dependsOn) {
      const l = enfants.get(d);
      if (l) l.push(n.key); else enfants.set(d, [n.key]);
    }
  }
  const vus = new Set<string>(depuis);
  const file = [...depuis];
  const out: string[] = [];
  while (file.length > 0) {
    const k = file.shift() as string;
    out.push(k);
    for (const e of (enfants.get(k) ?? []).sort()) {
      if (!vus.has(e)) { vus.add(e); file.push(e); }
    }
  }
  return out;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'EMPREINTE D'UNE MODIFICATION — la réponse à « qu'est-ce qui va bouger ? ».
 *
 * Deux profondeurs, et le genre les décide :
 *
 *   • REMPLACER et RAFRAICHIR touchent la DESCENDANCE : changer le destinataire d'une demande
 *     invalide la réponse qu'on en attendait et tout ce qui la lit. S'arrêter à l'étape visée
 *     laisserait une consolidation qui cite Deepak sous un envoi adressé à Amel.
 *
 *   • RETIRER ne touche que la branche EXCLUSIVE de la cible : ce qui ne sert QU'à elle.
 *     « Annule le PowerPoint » ne doit pas emporter le classeur, même si les deux descendent de
 *     la même consolidation. Une étape qui a un autre débouché vivant est préservée.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function empreinteDeLaModification(
  demande: DemandeModification,
  noeuds: readonly NoeudModifiable[],
): EmpreinteModification {
  const toutes = noeuds.map((n) => n.key);
  const vide = (resume: string, reconnue: boolean): EmpreinteModification => ({
    genre: demande.genre, reconnue, visees: [], aRecompiler: [], jalonsTouches: [],
    effetsIrreversibles: [], preservees: toutes, resume,
  });

  if (SANS_IMPACT_GRAPHE.has(demande.genre)) {
    return vide(phraseSansImpact(demande), true);
  }
  if (demande.genre === "ANNULER") {
    const vivantes = noeuds.filter((n) => !["DONE", "SKIPPED", "CANCELLED"].includes(n.status));
    return {
      genre: "ANNULER", reconnue: true,
      visees: vivantes.map((n) => n.key),
      aRecompiler: [],
      jalonsTouches: [...new Set(vivantes.map((n) => n.milestoneOrdre).filter((o): o is number => o !== null))].sort((a, b) => a - b),
      effetsIrreversibles: noeuds.filter((n) => n.aEuUnEffet).map((n) => n.key),
      preservees: noeuds.filter((n) => ["DONE", "SKIPPED"].includes(n.status)).map((n) => n.key),
      resume: `La mission s'arrête : ${vivantes.length} étape(s) encore vivantes sont annulées. `
        + `Ce qui est déjà fait reste au dossier.`,
    };
  }

  const mots = motsUtiles(demande.cible);
  if (mots.length === 0) {
    return vide(
      `Aucun mot exploitable dans « ${demande.cible} » : rien n'a été touché, `
      + `parce qu'une cible vide désignerait toute la mission.`, false);
  }
  const visees = noeuds.filter((n) => nomme(n, mots));
  if (visees.length === 0) {
    return vide(
      `« ${demande.cible} » n'est nommé dans aucune des ${noeuds.length} étapes du plan : `
      + `rien n'a été touché. Précisez ce qui est visé — deviner reviendrait à choisir la branche à jeter à votre place.`,
      false);
  }

  const clesVisees = visees.map((n) => n.key);
  const aRecompiler = demande.genre === "RETIRER"
    ? brancheExclusive(clesVisees, noeuds)
    : descendance(clesVisees, noeuds);
  const parCle = new Map(noeuds.map((n) => [n.key, n]));
  const effets = aRecompiler.filter((k) => parCle.get(k)?.aEuUnEffet === true);
  const jalons = [...new Set(
    aRecompiler.map((k) => parCle.get(k)?.milestoneOrdre ?? null).filter((o): o is number => o !== null),
  )].sort((a, b) => a - b);
  const touche = new Set(aRecompiler);

  return {
    genre: demande.genre,
    reconnue: true,
    visees: clesVisees,
    aRecompiler,
    jalonsTouches: jalons,
    effetsIrreversibles: effets,
    preservees: toutes.filter((k) => !touche.has(k)),
    resume: resumer(demande, clesVisees, aRecompiler, jalons, effets, toutes.length),
  };
}

/**
 * LA BRANCHE EXCLUSIVE — ce qui ne sert QU'À la cible.
 *
 * On part de la descendance complète, puis on RETIRE tout nœud qui garde un parent vivant hors
 * de l'ensemble : il a un autre débouché, donc il sert encore à quelque chose. Sans cette
 * soustraction, « annule le PowerPoint » emporterait la consolidation qui alimente aussi le
 * classeur — la mission perdrait un livrable que personne n'a demandé de retirer.
 *
 * On itère jusqu'au point fixe : retirer un nœud peut en sauver un autre plus bas.
 */
function brancheExclusive(depuis: readonly string[], noeuds: readonly NoeudModifiable[]): string[] {
  const complete = new Set(descendance(depuis, noeuds));
  const racines = new Set(depuis);
  const parCle = new Map(noeuds.map((n) => [n.key, n]));
  let change = true;
  while (change) {
    change = false;
    for (const k of [...complete]) {
      if (racines.has(k)) continue;
      const n = parCle.get(k);
      if (!n) continue;
      // UN SEUL PARENT HORS DE L'ENSEMBLE SUFFIT À LE SAUVER : il est alimenté par autre chose
      // que la cible retirée, donc il sert encore. La boucle recommence parce que le sauver
      // sauve aussi ses enfants — un point fixe, pas une passe.
      if (n.dependsOn.some((d) => parCle.has(d) && !complete.has(d))) {
        complete.delete(k);
        change = true;
      }
    }
  }
  return descendance(depuis, noeuds).filter((k) => complete.has(k));
}

function phraseSansImpact(d: DemandeModification): string {
  switch (d.genre) {
    case "REPRIORISER":
      return `La mission passe en priorité ${d.priorite ?? "?"}. Aucune étape ne change : `
        + `c'est l'ordre de service du battement qui change, pas le travail.`;
    case "SUSPENDRE":
      return `La mission se met en pause${d.motif ? ` (${d.motif})` : ""}. Rien n'est perdu : `
        + `les étapes gardent leur statut et leurs reçus, et la reprise repart d'où elle en était.`;
    case "REPRENDRE":
      return "La mission repart de l'état exact où la pause l'avait laissée.";
    case "AJOUTER":
      return `Un jalon s'ajoute — « ${d.ajout ?? d.cible} ». Rien d'existant n'est invalidé : `
        + `ajouter du travail n'est pas en remettre en cause.`;
    default:
      return "Aucun impact sur le graphe.";
  }
}

function resumer(
  d: DemandeModification,
  visees: readonly string[],
  aRecompiler: readonly string[],
  jalons: readonly number[],
  effets: readonly string[],
  total: number,
): string {
  const quoi = d.genre === "REMPLACER"
    ? `${d.remplacant ?? "le remplaçant"} prend la place de ${d.cible}`
    : d.genre === "RETIRER"
      ? `${d.cible} est retiré du plan`
      : `${d.cible} a changé et doit être relu`;
  const cascade = aRecompiler.length > visees.length
    ? ` ; ${aRecompiler.length - visees.length} étape(s) en dépendent et sont reprises avec`
    : "";
  const garde = ` ${total - aRecompiler.length} étape(s) sur ${total} ne bougent pas.`;
  const parti = effets.length > 0
    ? ` ATTENTION : ${effets.length} de ces étapes ont DÉJÀ produit leur effet (${effets.slice(0, 3).join(", ")}`
      + `${effets.length > 3 ? "…" : ""}) — ce qui est parti ne se rattrape pas, seule la suite change.`
    : "";
  const ou = jalons.length > 0 ? ` Jalon(s) concerné(s) : ${jalons.join(", ")}.` : "";
  return `${quoi} : ${visees.length} étape(s) directement visée(s)${cascade}.${ou}${garde}${parti}`;
}
