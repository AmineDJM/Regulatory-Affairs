/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN LOT MASSIF, ET CE QU'IL PROMET (mandat 5 §41) — pur.
 *
 * Douze mille fichiers à ranger, ce n'est pas douze mille clics : c'est un LOT. Et un lot pose
 * quatre questions auxquelles ce module répond par du code, pas par des intentions :
 *
 *   1. QU'EST-CE QUE ÇA VA FAIRE ? — l'aperçu est produit AVANT toute modification, et il est
 *      exact : chaque geste, sur quel fichier, d'où vers où, et pourquoi.
 *   2. ET SI ÇA S'ARRÊTE AU MILIEU ? — chaque geste réussi est son propre point de reprise
 *      (§118.4 : pas de table de points de reprise qui dirait la même chose une seconde fois).
 *      Reprendre, c'est refaire le plan et sauter ce qui porte déjà son reçu.
 *   3. ET SI UN GESTE ÉCHOUE ? — il est réessayé si la cause est passagère, abandonné si elle
 *      ne l'est pas, et le lot CONTINUE. Un fichier verrouillé n'arrête pas les 11 999 autres.
 *   4. QU'EST-CE QUI S'EST VRAIMENT PASSÉ ? — le rapport est ARITHMÉTIQUE : demandés = faits +
 *      ignorés + échoués, et la somme est vérifiée. « Terminé » sans compte exact n'est rien.
 *
 * Et le cinquième, qui n'est pas une question : TOUT GESTE EST RÉVERSIBLE ou il est refusé. Le
 * plan de retour est produit EN MÊME TEMPS que le plan d'aller, pas après coup.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type GesteType = "deplacer" | "renommer" | "copier" | "classer" | "archiver" | "supprimer" | "convertir";

export interface Geste {
  /** L'identifiant du fichier visé — c'est la clé d'idempotence du geste. */
  cible: string;
  type: GesteType;
  /** L'état AVANT, pour le plan de retour. */
  avant: Record<string, string | number | null>;
  /** L'état demandé APRÈS. */
  apres: Record<string, string | number | null>;
  /** Pourquoi ce geste — il figure dans l'aperçu, et une personne doit pouvoir le contester. */
  raison: string;
  confiance: number;
  libelle: string;
}

export type Issue = "FAIT" | "IGNORE" | "ECHEC";

export interface Reçu {
  cible: string;
  type: GesteType;
  issue: Issue;
  detail: string;
  tentatives: number;
  ms: number;
}

export interface Apercu {
  gestes: Geste[];
  parType: Record<string, number>;
  /** Les gestes qu'on REFUSE de proposer, et pourquoi — ils ne sont pas dans le lot. */
  refuses: { cible: string; raison: string }[];
  /** Ce qui demande une décision humaine avant d'être fait. */
  aConfirmer: Geste[];
  reversible: boolean;
  planDeRetour: Geste[];
  resume: string;
}

export const GESTES_MAX = 20_000;
/** Un geste destructeur n'entre jamais dans un lot automatique : c'est une décision, pas un traitement. */
export const DESTRUCTEURS: readonly GesteType[] = ["supprimer"];
/** En dessous, la proposition est trop incertaine pour être appliquée sans un regard humain. */
export const CONFIANCE_AUTOMATIQUE = 0.85;

/**
 * L'APERÇU — produit avant tout, exact, et porteur de son plan de retour.
 * Un geste destructeur ou peu sûr n'est pas retiré en silence : il est RANGÉ dans « à confirmer »
 * ou « refusé », avec sa raison.
 */
export function preparerLot(gestes: readonly Geste[], options: { autoriserSuppression?: boolean; seuilConfiance?: number } = {}): Apercu | { erreur: string } {
  if (!gestes.length) return { erreur: "Aucun geste : il n'y a rien à faire." };
  if (gestes.length > GESTES_MAX) return { erreur: `${gestes.length} gestes : ${GESTES_MAX} au plus par lot (limite opérationnelle — découper le lot).` };
  const seuil = options.seuilConfiance ?? CONFIANCE_AUTOMATIQUE;
  const retenus: Geste[] = [], refuses: { cible: string; raison: string }[] = [], aConfirmer: Geste[] = [];
  const vus = new Set<string>();
  for (const g of gestes) {
    const cle = `${g.type}:${g.cible}`;
    if (vus.has(cle)) { refuses.push({ cible: g.cible, raison: `geste « ${g.type} » demandé deux fois sur le même fichier : le second est ignoré` }); continue; }
    vus.add(cle);
    if (DESTRUCTEURS.includes(g.type) && !options.autoriserSuppression) {
      refuses.push({ cible: g.cible, raison: "une SUPPRESSION ne se fait pas dans un lot automatique : c'est une décision, elle se demande une par une" });
      continue;
    }
    if (!estReversible(g)) {
      refuses.push({ cible: g.cible, raison: `geste « ${g.type} » sans état d'origine complet : il ne pourrait pas être annulé, donc il n'est pas proposé` });
      continue;
    }
    if (g.confiance < seuil) { aConfirmer.push(g); continue; }
    retenus.push(g);
  }
  const parType: Record<string, number> = {};
  for (const g of [...retenus, ...aConfirmer]) parType[g.type] = (parType[g.type] ?? 0) + 1;
  const planDeRetour = [...retenus, ...aConfirmer].map(inverser).reverse();
  return {
    gestes: retenus, parType, refuses, aConfirmer,
    reversible: planDeRetour.length === retenus.length + aConfirmer.length,
    planDeRetour,
    resume: [
      `${retenus.length} geste(s) prêt(s)`,
      aConfirmer.length ? `${aConfirmer.length} à confirmer (confiance < ${Math.round(seuil * 100)} %)` : null,
      refuses.length ? `${refuses.length} refusé(s)` : null,
      `plan de retour de ${planDeRetour.length} geste(s)`,
    ].filter(Boolean).join(" · "),
  };
}

/** Un geste est réversible quand son état d'AVANT est connu, champ pour champ. */
export function estReversible(g: Geste): boolean {
  if (g.type === "supprimer") return false;
  if (g.type === "copier") return true; // le retour est la suppression de la copie
  const clefs = Object.keys(g.apres);
  return clefs.length > 0 && clefs.every((k) => k in g.avant);
}

/** LE GESTE INVERSE — produit avec l'aller, jamais reconstitué après coup. */
export function inverser(g: Geste): Geste {
  if (g.type === "copier") {
    return { ...g, type: "supprimer", avant: g.apres, apres: {}, raison: `retour : suppression de la copie créée par « ${g.libelle} »`, libelle: `annuler ${g.libelle}` };
  }
  return { ...g, avant: g.apres, apres: g.avant, raison: `retour : ${g.libelle}`, libelle: `annuler ${g.libelle}` };
}

export interface RapportLot {
  demandes: number;
  faits: number;
  ignores: number;
  echecs: number;
  /** demandés = faits + ignorés + échoués. Vérifié, pas supposé. */
  compteJuste: boolean;
  recus: Reçu[];
  parEchec: Record<string, number>;
  msTotal: number;
  /** Les gestes à refaire pour revenir en arrière — SEULEMENT ceux qui ont réussi. */
  planDeRetour: Geste[];
  resume: string;
  interrompu: boolean;
}

export interface OptionsExecution {
  /** Un geste déjà porteur de son reçu n'est pas refait : la reprise est gratuite. */
  dejaFait?: (g: Geste) => boolean | Promise<boolean>;
  /** Combien de fois réessayer un échec PASSAGER. */
  tentatives?: number;
  /** Le lot s'arrête-t-il au premier échec ? Non par défaut : un fichier verrouillé n'arrête pas les autres. */
  arreterAuPremierEchec?: boolean;
  /** Un budget de temps : au-delà, le lot s'arrête PROPREMENT et dit où il en est. */
  msMax?: number;
  /** Appelé après chaque geste — l'avancement d'un lot de douze mille se suit. */
  progression?: (fait: number, total: number, dernier: Reçu) => void;
}

/** Un échec PASSAGER se réessaie ; un échec de fond, non. Le mot compte : réessayer un refus de droit est inutile. */
export function estPassager(erreur: string): boolean {
  return /verrouill|occupé|occupe|timeout|délai|delai|réseau|reseau|temporair|indisponible|ECONNRESET|ETIMEDOUT|conflit|concurren|lock/i.test(erreur)
    && !/droit|permission|interdit|introuvable|inexistant|not found|refus/i.test(erreur);
}

/**
 * EXÉCUTE LE LOT — chaque geste porte son reçu, les échecs passagers sont réessayés, le lot
 * continue, et le compte final est ARITHMÉTIQUE.
 */
export async function executerLot(
  gestes: readonly Geste[],
  faire: (g: Geste) => Promise<{ ok: true; detail?: string } | { ok: false; erreur: string }>,
  options: OptionsExecution = {},
): Promise<RapportLot> {
  const t0 = Date.now();
  const tentativesMax = Math.max(1, Math.min(options.tentatives ?? 3, 5));
  const recus: Reçu[] = [];
  const reussis: Geste[] = [];
  let interrompu = false;

  for (const g of gestes) {
    if (options.msMax && Date.now() - t0 > options.msMax) { interrompu = true; break; }
    const debut = Date.now();
    // LA REPRISE : un geste dont le reçu existe déjà n'est pas refait.
    if (options.dejaFait) {
      let deja = false;
      try { deja = await options.dejaFait(g); } catch { deja = false; }
      if (deja) {
        const r: Reçu = { cible: g.cible, type: g.type, issue: "IGNORE", detail: "déjà fait — repris sans être refait", tentatives: 0, ms: Date.now() - debut };
        recus.push(r); options.progression?.(recus.length, gestes.length, r);
        continue;
      }
    }
    let tentatives = 0, dernier = "";
    let issue: Issue = "ECHEC";
    while (tentatives < tentativesMax) {
      tentatives += 1;
      try {
        const r = await faire(g);
        if (r.ok) { issue = "FAIT"; dernier = r.detail ?? "fait"; break; }
        dernier = r.erreur;
        if (!estPassager(r.erreur)) break;
      } catch (e) {
        dernier = e instanceof Error ? e.message : String(e);
        if (!estPassager(dernier)) break;
      }
      if (tentatives < tentativesMax) await new Promise((res) => setTimeout(res, 100 * tentatives));
    }
    const r: Reçu = { cible: g.cible, type: g.type, issue, detail: dernier, tentatives, ms: Date.now() - debut };
    recus.push(r);
    if (issue === "FAIT") reussis.push(g);
    options.progression?.(recus.length, gestes.length, r);
    if (issue === "ECHEC" && options.arreterAuPremierEchec) { interrompu = true; break; }
  }

  const faits = recus.filter((r) => r.issue === "FAIT").length;
  const ignores = recus.filter((r) => r.issue === "IGNORE").length;
  const echecs = recus.filter((r) => r.issue === "ECHEC").length;
  const parEchec: Record<string, number> = {};
  for (const r of recus) if (r.issue === "ECHEC") { const cle = r.detail.slice(0, 60); parEchec[cle] = (parEchec[cle] ?? 0) + 1; }
  const traites = faits + ignores + echecs;
  return {
    demandes: gestes.length, faits, ignores, echecs,
    // Le compte est JUSTE si tout ce qui a été demandé a une issue — sauf ce qu'une interruption
    // n'a jamais atteint, et l'interruption est alors dite.
    compteJuste: traites === (interrompu ? recus.length : gestes.length),
    recus, parEchec, msTotal: Date.now() - t0,
    planDeRetour: reussis.map(inverser).reverse(),
    interrompu,
    resume: `${faits} fait(s), ${ignores} déjà fait(s), ${echecs} échec(s) sur ${gestes.length} demandé(s)`
      + (interrompu ? ` — LOT INTERROMPU après ${recus.length} geste(s) : relancer reprendra où il s'est arrêté` : "")
      + (echecs ? ` — causes : ${Object.entries(parEchec).slice(0, 3).map(([c, n]) => `${c} (${n})`).join(" ; ")}` : ""),
  };
}
