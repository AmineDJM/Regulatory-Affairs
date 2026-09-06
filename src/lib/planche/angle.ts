/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES ANGLES — le même jeu de données vu autrement (mandat 7) — pur.
 *
 * ── « SOUS L'ANGLE QU'IL VEUT », ET CE QUE ÇA VEUT DIRE ─────────────────────────────────
 *
 * Trente-quatre factures peuvent se lire par fournisseur, par mois, par montant, par retard.
 * Ce sont quatre RÉPONSES à quatre questions différentes, et la plupart du temps la personne
 * ne sait pas laquelle elle veut avant de les avoir vues. Un système qui redemande « voulez-vous
 * plutôt par mois ? » puis relit la base pour répondre a perdu deux allers-retours et une
 * seconde lecture, pour un résultat qui était déjà dans ses mains.
 *
 * D'où la règle : **un angle est un CALCUL sur des lignes déjà lues, jamais une seconde
 * lecture.** Il ne peut donc pas rendre des données différentes de celles montrées — il ne
 * peut que les regrouper, les trier, les compter autrement.
 *
 * ── LA PROPRIÉTÉ QUI EMPÊCHE DE MENTIR ──────────────────────────────────────────────────
 *
 * Un angle DIT toujours ce qu'il a écarté. Grouper par mois sur des lignes sans date laisse
 * des lignes de côté ; trier par montant sur des lignes sans montant aussi. Un tableau qui
 * afficherait 28 lignes sur 34 sans le dire ferait croire à un total complet — et c'est la
 * façon la plus courante de se tromper avec un tableau juste.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const ANGLES = [
  /** Regrouper par la valeur d'un champ : par fournisseur, par statut, par responsable. */
  "PAR_VALEUR",
  /** Regrouper par période : jour, semaine, mois, trimestre, année. */
  "PAR_PERIODE",
  /** Trier, du plus grand au plus petit — ou l'inverse. */
  "CLASSEMENT",
  /** Croiser deux champs : fournisseur × mois. */
  "CROISEMENT",
  /** Ne garder que ce qui sort de l'ordinaire, sur un champ numérique. */
  "ECARTS",
] as const;
export type Angle = (typeof ANGLES)[number];

export type Ligne = Record<string, unknown>;

export interface Demande {
  angle: Angle;
  /** Le champ principal — celui par lequel on regroupe, trie ou mesure. */
  champ: string;
  /** CROISEMENT : le second champ. */
  champ2?: string;
  /** PAR_PERIODE : la maille. */
  maille?: "jour" | "semaine" | "mois" | "trimestre" | "annee";
  /** Le champ à SOMMER dans chaque groupe. Sans lui, on compte les lignes. */
  mesure?: string | null;
  decroissant?: boolean;
  limite?: number;
}

export interface Groupe {
  cle: string;
  /** Le nombre de lignes. Toujours présent : c'est la seule mesure qui ne peut pas manquer. */
  n: number;
  /** La somme de la mesure, quand une mesure a été demandée ET trouvée. */
  somme: number | null;
  lignes: Ligne[];
}

export interface Vue {
  angle: Angle;
  titre: string;
  groupes: Groupe[];
  /** Le total sur les lignes RETENUES — jamais sur les lignes de départ. */
  total: { lignes: number; somme: number | null };
  /**
   * LES LIGNES ÉCARTÉES, comptées et expliquées. C'est ce qui distingue un tableau juste d'un
   * tableau vrai : « 28 sur 34, 6 sans date » se lit, « 28 » ment par omission.
   */
  ecartees: { combien: number; pourquoi: string } | null;
  /** Ce que cette vue ne dit pas — toujours renseigné. */
  limites: string[];
}

const texte = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return null;
  return String(v);
};

const nombre = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * UN NOMBRE N'EST PAS UNE DATE, et c'est un piège mesuré.
 *
 * `new Date(120000)` réussit — c'est le 1er janvier 1970 à 00:02. Accepter les nombres faisait
 * donc passer TOUTE colonne numérique pour une colonne de dates, et `anglesUtiles` proposait
 * de grouper les MONTANTS par mois. Le résultat était un tableau parfaitement bien formé et
 * complètement faux, ce qui est la pire des deux options.
 *
 * Un horodatage en millisecondes est un cas réel, mais il est indiscernable d'un montant sans
 * le contexte que ce module n'a pas. On refuse donc de deviner : l'appelant qui porte des
 * epochs les convertit en `Date` avant d'appeler, et il sait, lui, ce que sa colonne contient.
 */
const date = (v: unknown): Date | null => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v !== "string") return null;
  // Une chaîne purement numérique non plus : « 20260112 » n'est pas une date reconnaissable
  // à coup sûr, et `new Date("2026")` rendrait le 1er janvier sans que personne l'ait voulu.
  if (/^\s*-?\d+([.,]\d+)?\s*$/.test(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function periode(d: Date, maille: NonNullable<Demande["maille"]>): string {
  const a = d.getUTCFullYear();
  switch (maille) {
    case "annee": return String(a);
    case "trimestre": return `T${Math.floor(d.getUTCMonth() / 3) + 1} ${a}`;
    case "mois": return `${MOIS[d.getUTCMonth()]} ${a}`;
    case "semaine": {
      // Semaine ISO — le lundi. Recalculer un numéro de semaine « à peu près » produirait des
      // regroupements qui changent d'une année sur l'autre, donc incomparables.
      const t = new Date(Date.UTC(a, d.getUTCMonth(), d.getUTCDate()));
      const jour = t.getUTCDay() || 7;
      t.setUTCDate(t.getUTCDate() + 4 - jour);
      const debut = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
      const num = Math.ceil(((t.getTime() - debut.getTime()) / 86_400_000 + 1) / 7);
      return `S${num} ${t.getUTCFullYear()}`;
    }
    case "jour": return d.toISOString().slice(0, 10);
  }
}

/** L'ordre chronologique d'une clé de période — sans lui, « avril » viendrait avant « janvier ». */
function rangPeriode(cle: string, maille: NonNullable<Demande["maille"]>): number {
  if (maille === "jour") return new Date(cle).getTime();
  if (maille === "annee") return Number(cle) * 10_000;
  const m = /^(?:T(\d)|S(\d+))?\s*(.*?)(\d{4})$/.exec(cle.trim());
  const an = Number(m?.[4] ?? 0);
  if (maille === "trimestre") return an * 100 + Number(m?.[1] ?? 0);
  if (maille === "semaine") return an * 100 + Number(m?.[2] ?? 0);
  const nom = (m?.[3] ?? "").trim();
  return an * 100 + (MOIS.indexOf(nom) + 1);
}

/**
 * COMPOSE LA VUE. Ne lit rien, n'appelle rien : les lignes sont déjà là.
 */
export function regarder(lignes: readonly Ligne[], d: Demande): Vue {
  const limites: string[] = [];
  const mesure = d.mesure ?? null;

  // ── QUI EST RETENU, ET QUI NE L'EST PAS ─────────────────────────────────────────────
  const retenues: { l: Ligne; cle: string }[] = [];
  let sansCle = 0;

  for (const l of lignes) {
    let cle: string | null = null;
    if (d.angle === "PAR_PERIODE") {
      const dd = date(l[d.champ]);
      cle = dd ? periode(dd, d.maille ?? "mois") : null;
    } else if (d.angle === "CROISEMENT") {
      const a = texte(l[d.champ]); const b = texte(l[d.champ2 ?? ""]);
      cle = a !== null && b !== null ? `${a} × ${b}` : null;
    } else if (d.angle === "CLASSEMENT" || d.angle === "ECARTS") {
      // On classe des lignes, pas des groupes : la clé est la ligne elle-même, et ce qui
      // manque est la VALEUR à classer.
      cle = nombre(l[d.champ]) !== null ? (texte(l.libelle ?? l.nom ?? l.titre ?? l.reference) ?? "—") : null;
    } else {
      cle = texte(l[d.champ]);
    }
    if (cle === null) { sansCle += 1; continue; }
    retenues.push({ l, cle });
  }

  const pourquoi = d.angle === "PAR_PERIODE"
    ? `sans date exploitable dans « ${d.champ} »`
    : d.angle === "CROISEMENT"
      ? `sans valeur dans « ${d.champ} » ou « ${d.champ2} »`
      : d.angle === "CLASSEMENT" || d.angle === "ECARTS"
        ? `sans nombre exploitable dans « ${d.champ} »`
        : `sans valeur dans « ${d.champ} »`;

  // ── LES GROUPES ─────────────────────────────────────────────────────────────────────
  const paquets = new Map<string, Ligne[]>();
  for (const { l, cle } of retenues) paquets.set(cle, [...(paquets.get(cle) ?? []), l]);

  let groupes: Groupe[] = [...paquets].map(([cle, ls]) => {
    const valeurs = mesure ? ls.map((x) => nombre(x[mesure])).filter((x): x is number => x !== null) : [];
    return {
      cle, n: ls.length,
      // UNE SOMME PARTIELLE N'EST PAS UNE SOMME : si une ligne du groupe n'a pas de mesure,
      // le total du groupe est `null` plutôt qu'un nombre qui aurait l'air complet.
      somme: mesure ? (valeurs.length === ls.length ? valeurs.reduce((a, x) => a + x, 0) : null) : null,
      lignes: ls,
    };
  });

  if (mesure && groupes.some((g) => g.somme === null)) {
    limites.push(`certains groupes n'ont pas de somme : toutes leurs lignes ne portent pas « ${mesure} », et une somme partielle aurait l'air complète`);
  }

  // ── L'ORDRE ─────────────────────────────────────────────────────────────────────────
  if (d.angle === "PAR_PERIODE") {
    const maille = d.maille ?? "mois";
    groupes.sort((a, b) => rangPeriode(a.cle, maille) - rangPeriode(b.cle, maille));
    if (d.decroissant) groupes.reverse();
  } else if (d.angle === "CLASSEMENT" || d.angle === "ECARTS") {
    const val = (g: Groupe) => nombre(g.lignes[0]?.[d.champ]) ?? 0;
    groupes.sort((a, b) => (d.decroissant === false ? val(a) - val(b) : val(b) - val(a)));
  } else {
    const poids = (g: Groupe) => (g.somme ?? g.n);
    groupes.sort((a, b) => (d.decroissant === false ? poids(a) - poids(b) : poids(b) - poids(a)) || a.cle.localeCompare(b.cle));
  }

  // ── LES ÉCARTS : ne garder que ce qui sort de l'ordinaire ───────────────────────────
  if (d.angle === "ECARTS" && groupes.length >= 4) {
    const vals = groupes.map((g) => nombre(g.lignes[0]?.[d.champ]) ?? 0);
    const moy = vals.reduce((a, x) => a + x, 0) / vals.length;
    const ecart = Math.sqrt(vals.reduce((a, x) => a + (x - moy) ** 2, 0) / vals.length);
    const seuil = ecart * 1.5;
    const avant = groupes.length;
    groupes = groupes.filter((g) => Math.abs((nombre(g.lignes[0]?.[d.champ]) ?? 0) - moy) > seuil);
    limites.push(
      `« écarts » ne montre que les lignes à plus de 1,5 écart-type de la moyenne (${Math.round(moy)}) : ${avant - groupes.length} ligne(s) ordinaire(s) sont masquées, et une ligne ordinaire n'est pas une ligne sans intérêt`,
    );
  }

  const tronque = typeof d.limite === "number" && d.limite > 0 && groupes.length > d.limite;
  const montres = tronque ? groupes.slice(0, d.limite) : groupes;
  if (tronque) limites.push(`${groupes.length - montres.length} groupe(s) au-delà des ${d.limite} demandés ne sont pas affichés — le total ci-dessous porte sur TOUS les groupes, pas seulement ceux montrés`);

  // LE TOTAL PORTE SUR TOUS LES GROUPES RETENUS, pas sur ceux affichés : c'est ce qu'on
  // attend d'un total, et l'écart entre les deux est exactement ce qui trompe.
  const sommes = groupes.map((g) => g.somme);
  const total = {
    lignes: retenues.length,
    somme: mesure && sommes.every((x) => x !== null) ? sommes.reduce((a: number, x) => a + (x ?? 0), 0) : null,
  };

  limites.unshift("un angle ne relit rien : il regroupe les lignes déjà lues, donc il ne peut pas montrer autre chose qu'elles");

  return {
    angle: d.angle,
    titre: titreDe(d, groupes.length),
    groupes: montres,
    total,
    ecartees: sansCle > 0 ? { combien: sansCle, pourquoi } : null,
    limites,
  };
}

function titreDe(d: Demande, n: number): string {
  switch (d.angle) {
    case "PAR_VALEUR": return `Par ${d.champ} (${n})`;
    case "PAR_PERIODE": return `Par ${d.maille ?? "mois"} (${n})`;
    case "CLASSEMENT": return `Classement par ${d.champ}${d.decroissant === false ? " croissant" : " décroissant"}`;
    case "CROISEMENT": return `${d.champ} × ${d.champ2} (${n})`;
    case "ECARTS": return `Écarts sur ${d.champ} (${n})`;
  }
}

/**
 * LES ANGLES QUI ONT UN SENS SUR CES LIGNES — proposés, jamais imposés.
 *
 * On ne suggère PAS de grouper par un champ dont toutes les lignes portent la même valeur (un
 * seul groupe n'est pas un angle), ni par un champ presque toujours distinct (autant de groupes
 * que de lignes n'est pas un angle non plus). Entre les deux vit l'information.
 */
export function anglesUtiles(lignes: readonly Ligne[], champs: readonly string[]): Demande[] {
  const out: Demande[] = [];
  if (lignes.length < 2) return out;

  for (const c of champs) {
    const vals = lignes.map((l) => l[c]);
    const dates = vals.filter((v) => date(v) !== null).length;
    const nombres = vals.filter((v) => nombre(v) !== null).length;
    const distinctes = new Set(vals.map((v) => texte(v)).filter((x): x is string => x !== null)).size;

    if (dates >= lignes.length * 0.8) { out.push({ angle: "PAR_PERIODE", champ: c, maille: "mois" }); continue; }
    if (nombres >= lignes.length * 0.8) {
      out.push({ angle: "CLASSEMENT", champ: c, decroissant: true });
      if (lignes.length >= 8) out.push({ angle: "ECARTS", champ: c });
      continue;
    }
    if (distinctes >= 2 && distinctes <= Math.max(2, Math.floor(lignes.length * 0.6))) {
      out.push({ angle: "PAR_VALEUR", champ: c });
    }
  }
  return out;
}
