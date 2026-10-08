import {
  BRIQUE_PAR_ID, LETTRES_KPI, NATURES, PERIODES_REF, SENS, estBrique,
  type BriqueId, type LettreKpi, type NatureKpi, type ParametreBrique, type PeriodeRef, type SensKpi, type UniteKpi,
} from "./briques";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA DÉFINITION D'UN KPI — couche 2. Module PUR (seul import : le catalogue des briques, pur lui aussi).
 *
 * Une définition est une FICHE, pas un programme : quelle brique (ou rapport de deux briques), quels filtres, quelle
 * cible, quels seuils, quelle période de référence. `validerDefinition` est la SEULE porte d'entrée : l'écran, les
 * actions et la sortie de Luna y passent tous. Une brique inconnue est REFUSÉE — Luna ne peut pas inventer une
 * mesure que la plateforme ne sait pas calculer ; un réglage qu'une brique ne connaît pas est retiré.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface MesureKpi {
  brique: BriqueId;
  lettres?: LettreKpi[];
  /** « Vu au moins N fois par mois ». */
  seuilN?: number;
  /** « Rapport rendu dans X heures ». */
  heures?: number;
  produitId?: string;
  buId?: string;
}

export interface NiveauGrille {
  libelle: string;
  critere: string;
}

export interface DefinitionKpi {
  nom: string;
  description: string | null;
  nature: NatureKpi;
  numerateur: MesureKpi | null;
  denominateur: MesureKpi | null;
  unite: UniteKpi;
  sens: SensKpi;
  cible: number | null;
  seuilVert: number | null;
  seuilOrange: number | null;
  periode: PeriodeRef;
  /** La grille d'un KPI ÉVALUÉ : 2 à 6 niveaux, du plus faible au meilleur, chacun avec son critère observable. */
  grille: NiveauGrille[] | null;
}

export type ResultatDefinition = { ok: true; def: DefinitionKpi } | { ok: false; erreurs: string[] };

const NOM_MIN = 3;
const NOM_MAX = 80;
const NIVEAUX_MIN = 2;
const NIVEAUX_MAX = 6;

const texte = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim().slice(0, max);
  return s.length ? s : null;
};

const nombre = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

const dans = <T extends string>(liste: readonly T[], v: unknown): v is T => typeof v === "string" && (liste as readonly string[]).includes(v);

/** Lit UNE mesure : la brique doit exister ; les réglages qu'elle ne connaît pas sont retirés, ceux qu'elle connaît bornés. */
export function lireMesure(v: unknown, role: string, erreurs: string[]): MesureKpi | null {
  if (!v || typeof v !== "object") { erreurs.push(`${role} : mesure absente.`); return null; }
  const o = v as Record<string, unknown>;
  if (!estBrique(o.brique)) {
    erreurs.push(`${role} : la brique « ${String(o.brique ?? "")} » n'existe pas — seules les briques du catalogue se calculent.`);
    return null;
  }
  const brique = BRIQUE_PAR_ID[o.brique];
  const accepte = (p: ParametreBrique) => brique.parametres.includes(p);
  const m: MesureKpi = { brique: brique.id };
  if (accepte("lettres") && Array.isArray(o.lettres)) {
    const lettres = [...new Set(o.lettres.filter((l): l is LettreKpi => dans(LETTRES_KPI, l)))];
    if (lettres.length) m.lettres = lettres;
  }
  if (accepte("seuilN")) {
    const n = nombre(o.seuilN);
    if (n !== null) {
      if (!Number.isInteger(n) || n < 1 || n > 20) erreurs.push(`${role} : « N fois par mois » doit être un entier de 1 à 20.`);
      else m.seuilN = n;
    }
  }
  if (accepte("heures")) {
    const h = nombre(o.heures);
    if (h !== null) {
      if (h < 1 || h > 720) erreurs.push(`${role} : le délai doit être compris entre 1 et 720 heures.`);
      else m.heures = Math.round(h);
    }
  }
  if (accepte("produitId")) { const p = texte(o.produitId, 64); if (p) m.produitId = p; }
  if (accepte("buId")) { const b = texte(o.buId, 64); if (b) m.buId = b; }
  return m;
}

/** Lit une grille ÉVALUÉE. */
export function lireGrille(v: unknown, erreurs: string[]): NiveauGrille[] | null {
  if (!Array.isArray(v)) { erreurs.push("Grille : une liste de niveaux est attendue."); return null; }
  const niveaux = v.map((n) => {
    const o = (n && typeof n === "object" ? n : {}) as Record<string, unknown>;
    return { libelle: texte(o.libelle, 60) ?? "", critere: texte(o.critere, 300) ?? "" };
  });
  if (niveaux.length < NIVEAUX_MIN || niveaux.length > NIVEAUX_MAX) {
    erreurs.push(`Grille : ${NIVEAUX_MIN} à ${NIVEAUX_MAX} niveaux.`);
    return null;
  }
  if (niveaux.some((n) => !n.libelle || !n.critere)) { erreurs.push("Grille : chaque niveau porte un libellé ET un critère observable."); return null; }
  return niveaux;
}

/** L'unité qu'impose une mesure CALCULÉE : celle de sa brique. */
function uniteDeBrique(b: BriqueId): UniteKpi {
  return BRIQUE_PAR_ID[b].unite;
}

/**
 * VALIDER UNE DÉFINITION — la seule porte d'entrée (écran, actions, Luna).
 *
 *  · CALCULÉ : une brique, aucune autre ; l'unité est celle de la brique.
 *  · RATIO   : numérateur ÷ dénominateur, deux briques ; l'unité est le pourcentage.
 *  · ÉVALUÉ  : une grille de niveaux, aucune brique ; l'unité est le niveau.
 *  · DÉCLARÉ : une valeur saisie avec une pièce, validée par le manager ; l'unité est le nombre.
 *  · IMPORTÉ : une colonne d'un fichier extérieur ; nombre ou pourcentage.
 */
export function validerDefinition(entree: unknown): ResultatDefinition {
  const erreurs: string[] = [];
  const o = (entree && typeof entree === "object" ? entree : {}) as Record<string, unknown>;
  const nom = texte(o.nom, NOM_MAX);
  if (!nom || nom.length < NOM_MIN) erreurs.push(`Le nom compte de ${NOM_MIN} à ${NOM_MAX} caractères.`);
  if (!dans(NATURES, o.nature)) erreurs.push("Nature inconnue (calculé, ratio, évalué, déclaré, importé).");
  const nature = (dans(NATURES, o.nature) ? o.nature : "CALCULE") as NatureKpi;

  let numerateur: MesureKpi | null = null;
  let denominateur: MesureKpi | null = null;
  let grille: NiveauGrille[] | null = null;
  let unite: UniteKpi = "NOMBRE";

  if (nature === "CALCULE") {
    numerateur = lireMesure(o.numerateur, "Mesure", erreurs);
    if (o.denominateur) erreurs.push("Un KPI calculé n'a pas de dénominateur — choisissez « ratio ».");
    if (numerateur) unite = uniteDeBrique(numerateur.brique);
  } else if (nature === "RATIO") {
    numerateur = lireMesure(o.numerateur, "Numérateur", erreurs);
    denominateur = lireMesure(o.denominateur, "Dénominateur", erreurs);
    unite = "POURCENT";
  } else if (nature === "EVALUE") {
    grille = lireGrille(o.grille, erreurs);
    unite = "NIVEAU";
  } else if (nature === "DECLARE") {
    unite = "NOMBRE";
  } else {
    unite = o.unite === "POURCENT" ? "POURCENT" : "NOMBRE";
  }
  if ((nature === "EVALUE" || nature === "DECLARE" || nature === "IMPORTE") && (o.numerateur || o.denominateur)) {
    erreurs.push("Un KPI évalué, déclaré ou importé ne se calcule pas depuis une brique.");
  }

  const sens = (dans(SENS, o.sens) ? o.sens : uniteDeSensParDefaut(numerateur)) as SensKpi;
  const cible = nombre(o.cible);
  const seuilVert = nombre(o.seuilVert);
  const seuilOrange = nombre(o.seuilOrange);
  if (cible !== null && cible < 0) erreurs.push("La cible ne peut pas être négative.");
  if (nature === "EVALUE" && grille && cible !== null && (cible < 1 || cible > grille.length)) {
    erreurs.push(`La cible d'un KPI évalué est un niveau de 1 à ${grille.length}.`);
  }
  if (seuilVert !== null && seuilOrange !== null) {
    const coherent = sens === "PLUS_HAUT" ? seuilVert >= seuilOrange : seuilVert <= seuilOrange;
    if (!coherent) erreurs.push(sens === "PLUS_HAUT" ? "Le seuil vert doit être au-dessus du seuil orange." : "Le seuil vert doit être en dessous du seuil orange.");
  }
  const periode = (dans(PERIODES_REF, o.periode) ? o.periode : "MOIS") as PeriodeRef;

  if (erreurs.length) return { ok: false, erreurs };
  return {
    ok: true,
    def: {
      nom: nom!, description: texte(o.description, 400), nature, numerateur, denominateur, unite, sens,
      cible, seuilVert, seuilOrange, periode, grille,
    },
  };
}

/** Un délai se lit « plus bas = mieux » ; tout le reste « plus haut = mieux ». */
function uniteDeSensParDefaut(m: MesureKpi | null): SensKpi {
  return m && BRIQUE_PAR_ID[m.brique].unite === "HEURES" ? "PLUS_BAS" : "PLUS_HAUT";
}

/** Les identifiants de briques d'une définition (la colonne `briques` de la base). */
export function briquesDe(def: Pick<DefinitionKpi, "numerateur" | "denominateur">): BriqueId[] {
  return [def.numerateur?.brique, def.denominateur?.brique].filter((b): b is BriqueId => Boolean(b));
}

/** Les paramètres stockés (`params` JSON). */
export function paramsDe(def: Pick<DefinitionKpi, "numerateur" | "denominateur">): { numerateur: MesureKpi | null; denominateur: MesureKpi | null } {
  return { numerateur: def.numerateur, denominateur: def.denominateur };
}

/** Relire une définition stockée (colonnes + params JSON) — `null` si elle ne se relit pas à coup sûr. */
export function relireDefinition(ligne: {
  nom: string; description: string | null; nature: string; params: unknown; unite: string; sens: string;
  cible: number | null; seuilVert: number | null; seuilOrange: number | null; periode: string; grille: unknown;
}): DefinitionKpi | null {
  const p = (ligne.params && typeof ligne.params === "object" ? ligne.params : {}) as Record<string, unknown>;
  const r = validerDefinition({
    nom: ligne.nom, description: ligne.description, nature: ligne.nature, numerateur: p.numerateur ?? null,
    denominateur: p.denominateur ?? null, unite: ligne.unite, sens: ligne.sens, cible: ligne.cible,
    seuilVert: ligne.seuilVert, seuilOrange: ligne.seuilOrange, periode: ligne.periode, grille: ligne.grille ?? null,
  });
  return r.ok ? r.def : null;
}

/** Une phrase lisible du calcul : « Cibles vues à fréquence (H, A, B) ÷ Cibles du panel (H, A, B) ». */
export function phraseCalcul(def: Pick<DefinitionKpi, "nature" | "numerateur" | "denominateur" | "grille">): string {
  const m = (x: MesureKpi | null) => {
    if (!x) return "—";
    const b = BRIQUE_PAR_ID[x.brique];
    const reglages = [
      x.lettres?.length ? x.lettres.join(", ") : null,
      x.seuilN ? `≥ ${x.seuilN}×/mois` : null,
      x.heures ? `${x.heures} h` : null,
      x.produitId ? "un produit" : null,
    ].filter(Boolean);
    return `${b.libelle}${reglages.length ? ` (${reglages.join(" · ")})` : ""}`;
  };
  if (def.nature === "RATIO") return `${m(def.numerateur)} ÷ ${m(def.denominateur)}`;
  if (def.nature === "CALCULE") return m(def.numerateur);
  if (def.nature === "EVALUE") return `Grille en ${def.grille?.length ?? 0} niveaux, notée par le manager`;
  if (def.nature === "DECLARE") return "Saisi avec une pièce, validé par le manager";
  return "Importé d'un fichier extérieur";
}

// ── Le versionnement (Direction, 08/10 : « versionné et signé ») ─────────────────────────────

export interface LigneDeRevue {
  famille: string;
  definitionId: string;
  version: number;
  nom: string;
  nature: NatureKpi;
  unite: UniteKpi;
  poids: number;
  valeur: number | null;
  score: number | null;
  affichage: string;
  raison: string | null;
}

/**
 * QUELLE RÈGLE NOTE CETTE PÉRIODE ? Une revue SIGNÉE garde les lignes figées à la signature — la version de chaque
 * définition, sa valeur, son score, son poids — même si le KPI a changé depuis : un mois déjà revu ne se relit pas
 * dans la règle du jour. Une revue non signée suit les versions ACTIVES, recalculées en continu.
 */
export function lignesApplicables<T extends { famille: string }>(
  revue: { statut: string; lignes: readonly LigneDeRevue[] } | null,
  actives: readonly T[],
): { figee: true; lignes: readonly LigneDeRevue[] } | { figee: false; definitions: readonly T[] } {
  if (revue && revue.statut === "SIGNEE") return { figee: true, lignes: revue.lignes };
  return { figee: false, definitions: actives };
}

/** Relit le détail JSON figé d'une revue signée. Une ligne illisible est écartée, jamais devinée. */
export function lireLignesDeRevue(json: unknown): LigneDeRevue[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((l) => {
    const o = (l && typeof l === "object" ? l : null) as Record<string, unknown> | null;
    if (!o || typeof o.famille !== "string" || typeof o.definitionId !== "string" || typeof o.nom !== "string") return [];
    return [{
      famille: o.famille, definitionId: o.definitionId, version: Number(o.version) || 1, nom: o.nom,
      nature: (dans(NATURES, o.nature) ? o.nature : "CALCULE") as NatureKpi,
      unite: (typeof o.unite === "string" ? o.unite : "NOMBRE") as UniteKpi,
      poids: Number(o.poids) || 0,
      valeur: typeof o.valeur === "number" ? o.valeur : null,
      score: typeof o.score === "number" ? o.score : null,
      affichage: typeof o.affichage === "string" ? o.affichage : "—",
      raison: typeof o.raison === "string" ? o.raison : null,
    }];
  });
}
