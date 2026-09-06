/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ORDONNANCEMENT (mandat 5 §39) — pur.
 *
 * Le CHEMIN CRITIQUE (CPM) : dates au plus tôt, au plus tard, marges totale et libre, et la
 * séquence de tâches où un jour de retard est un jour de retard sur la fin. Puis l'ordonnancement
 * SOUS RESSOURCES (liste par priorité) : une personne ne fait qu'une chose à la fois, et le code le
 * DIT quand la contrainte de ressource, et non la logique du projet, allonge le délai.
 *
 * Ce que ce moteur ne fait pas : il ne prétend pas à l'optimum sous ressources (le problème est
 * NP-difficile) ; il rend une solution RÉALISABLE, la règle utilisée, et l'écart avec la borne
 * inférieure du chemin critique. Une durée « probable » n'est pas une durée : les incertitudes
 * passent par la simulation (montecarlo.ts), pas par un chiffre unique déguisé en certitude.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { type Rigueur, arrondi, rigueurVide } from "./rigueur";

export interface Tache {
  id: string;
  nom?: string;
  /** En jours (ou toute unité, la même pour tout le projet). */
  duree: number;
  /** Ids des tâches qui doivent être FINIES avant que celle-ci commence. */
  apres?: string[];
  /** Noms des ressources requises pendant toute la durée. */
  ressources?: string[];
  /** Plus grand = plus prioritaire quand deux tâches se disputent une ressource. */
  priorite?: number;
  /** Date de début au plus tôt imposée (en unités depuis l'origine). */
  auPlusTot?: number;
}

export interface Projet {
  taches: Tache[];
  /** Capacité par ressource (nombre de tâches simultanées) ; 1 par défaut. */
  capacites?: Record<string, number>;
  /** Horizon imposé : si la fin le dépasse, c'est DIT. */
  echeance?: number;
}

export interface TachePlanifiee {
  id: string;
  nom: string;
  duree: number;
  debutAuPlusTot: number;
  finAuPlusTot: number;
  debutAuPlusTard: number;
  finAuPlusTard: number;
  margeTotale: number;
  margeLibre: number;
  critique: boolean;
  /** Après arbitrage des ressources (identique au plus tôt si aucune ressource ne manque). */
  debutPlanifie: number;
  finPlanifiee: number;
  /** Le retard imposé par une ressource occupée, pas par les dépendances. */
  attenteRessource: number;
  ressources: string[];
}

export interface ResultatOrdonnancement {
  ok: true;
  dureeChemin: number;
  dureeAvecRessources: number;
  taches: TachePlanifiee[];
  cheminCritique: string[];
  /** Les ressources dont l'occupation dépasse la moitié de la durée du projet. */
  chargeRessources: { ressource: string; occupation: number; tauxPourcent: number; taches: number }[];
  goulots: string[];
  retardRessources: number;
  echeance: { valeur: number; tenue: boolean; retard: number } | null;
  rigueur: Rigueur;
  ms: number;
}
export type Ordonnancement = ResultatOrdonnancement | { ok: false; erreur: string; details?: string[] };

export const TACHES_MAX = 5_000;

function valider(p: Projet): string[] {
  const e: string[] = [];
  const taches = p.taches ?? [];
  if (!taches.length) e.push("Aucune tâche.");
  if (taches.length > TACHES_MAX) e.push(`${taches.length} tâches : ${TACHES_MAX} au plus.`);
  const ids = new Set<string>();
  for (const t of taches) {
    if (!t?.id) { e.push("Tâche sans identifiant."); continue; }
    if (ids.has(t.id)) e.push(`Tâche « ${t.id} » déclarée deux fois.`);
    ids.add(t.id);
    if (!Number.isFinite(t.duree) || t.duree < 0) e.push(`Tâche « ${t.id} » : durée invalide (${t.duree}).`);
  }
  for (const t of taches) for (const d of t.apres ?? []) if (!ids.has(d)) e.push(`Tâche « ${t.id} » : dépendance « ${d} » inconnue.`);
  for (const [r, c] of Object.entries(p.capacites ?? {})) if (!Number.isInteger(c) || c < 1) e.push(`Capacité de « ${r} » : entier ≥ 1 attendu (${c}).`);
  return e;
}

/** Tri topologique ; rend le cycle quand il y en a un (une dépendance circulaire est une RÉPONSE). */
function ordreTopologique(taches: Tache[]): { ok: true; ordre: string[] } | { ok: false; cycle: string[] } {
  const entrant = new Map<string, number>(taches.map((t) => [t.id, 0]));
  const sortants = new Map<string, string[]>(taches.map((t) => [t.id, []]));
  for (const t of taches) for (const d of t.apres ?? []) { entrant.set(t.id, (entrant.get(t.id) ?? 0) + 1); sortants.get(d)!.push(t.id); }
  const file = taches.filter((t) => (entrant.get(t.id) ?? 0) === 0).map((t) => t.id);
  const ordre: string[] = [];
  while (file.length) {
    const id = file.shift()!;
    ordre.push(id);
    for (const s of sortants.get(id) ?? []) { entrant.set(s, entrant.get(s)! - 1); if (entrant.get(s) === 0) file.push(s); }
  }
  if (ordre.length === taches.length) return { ok: true, ordre };
  const restants = taches.filter((t) => !ordre.includes(t.id)).map((t) => t.id);
  // Isoler un cycle court à afficher.
  const parId = new Map(taches.map((t) => [t.id, t]));
  const cycle: string[] = [];
  let courant = restants[0]!;
  const vus = new Set<string>();
  while (courant && !vus.has(courant)) {
    vus.add(courant); cycle.push(courant);
    courant = (parId.get(courant)?.apres ?? []).find((d) => restants.includes(d)) ?? "";
  }
  if (courant) cycle.push(courant);
  return { ok: false, cycle };
}

export function ordonnancer(p: Projet): Ordonnancement {
  const t0 = Date.now();
  const erreurs = valider(p);
  if (erreurs.length) return { ok: false, erreur: erreurs[0]!, details: erreurs };
  const taches = p.taches;
  const topo = ordreTopologique(taches);
  if (!topo.ok) return { ok: false, erreur: `Dépendance circulaire : ${topo.cycle.join(" → ")}. Un projet dont une tâche s'attend elle-même n'a pas de calendrier.` };
  const rigueur = rigueurVide();
  const parId = new Map(taches.map((t) => [t.id, t]));
  const tot = new Map<string, number>();
  const fin = new Map<string, number>();

  // Passe avant : dates au plus tôt.
  for (const id of topo.ordre) {
    const t = parId.get(id)!;
    let debut = t.auPlusTot ?? 0;
    for (const d of t.apres ?? []) debut = Math.max(debut, fin.get(d)!);
    tot.set(id, debut);
    fin.set(id, debut + t.duree);
  }
  const dureeChemin = Math.max(0, ...[...fin.values()]);

  // Passe arrière : dates au plus tard.
  const tard = new Map<string, number>();
  const finTard = new Map<string, number>();
  const successeurs = new Map<string, string[]>(taches.map((t) => [t.id, []]));
  for (const t of taches) for (const d of t.apres ?? []) successeurs.get(d)!.push(t.id);
  for (const id of [...topo.ordre].reverse()) {
    const t = parId.get(id)!;
    const succ = successeurs.get(id)!;
    const f = succ.length ? Math.min(...succ.map((s) => tard.get(s)!)) : dureeChemin;
    finTard.set(id, f);
    tard.set(id, f - t.duree);
  }

  // Ordonnancement sous ressources : liste par priorité (marge la plus faible d'abord, puis priorité déclarée).
  const capacites = p.capacites ?? {};
  const utilise = new Map<string, { debut: number; fin: number }[]>();
  const debutPlanifie = new Map<string, number>();
  const finPlanifiee = new Map<string, number>();
  const aRessources = taches.some((t) => (t.ressources ?? []).length);
  const ordreListe = [...topo.ordre].sort((a, b) => {
    const ta = parId.get(a)!, tb = parId.get(b)!;
    const ma = tard.get(a)! - tot.get(a)!, mb = tard.get(b)! - tot.get(b)!;
    if (ma !== mb) return ma - mb;
    if ((tb.priorite ?? 0) !== (ta.priorite ?? 0)) return (tb.priorite ?? 0) - (ta.priorite ?? 0);
    return tot.get(a)! - tot.get(b)!;
  });
  // Respecter les dépendances : une tâche n'est placée qu'après ses prédécesseurs (boucle jusqu'à stabilisation).
  const restants = new Set(ordreListe);
  let garde = 0;
  while (restants.size && garde < taches.length * taches.length + 10) {
    garde += 1;
    for (const id of ordreListe) {
      if (!restants.has(id)) continue;
      const t = parId.get(id)!;
      if ((t.apres ?? []).some((d) => restants.has(d))) continue;
      let debut = t.auPlusTot ?? 0;
      for (const d of t.apres ?? []) debut = Math.max(debut, finPlanifiee.get(d)!);
      const res = t.ressources ?? [];
      if (res.length && t.duree > 0) {
        // Avancer jusqu'au premier créneau où TOUTES les ressources ont de la place.
        for (let tour = 0; tour < 10_000; tour += 1) {
          let conflit = 0;
          for (const r of res) {
            const cap = capacites[r] ?? 1;
            const occupations = (utilise.get(r) ?? []).filter((o) => o.debut < debut + t.duree && o.fin > debut);
            if (occupations.length >= cap) conflit = Math.max(conflit, Math.min(...occupations.map((o) => o.fin)));
          }
          if (!conflit) break;
          debut = conflit;
        }
        for (const r of res) { if (!utilise.has(r)) utilise.set(r, []); utilise.get(r)!.push({ debut, fin: debut + t.duree }); }
      }
      debutPlanifie.set(id, debut);
      finPlanifiee.set(id, debut + t.duree);
      restants.delete(id);
    }
  }
  const dureeAvecRessources = Math.max(0, ...[...finPlanifiee.values()]);

  const planifiees: TachePlanifiee[] = topo.ordre.map((id) => {
    const t = parId.get(id)!;
    const succ = successeurs.get(id)!;
    const margeLibre = (succ.length ? Math.min(...succ.map((s) => tot.get(s)!)) : dureeChemin) - fin.get(id)!;
    return {
      id, nom: t.nom ?? id, duree: t.duree,
      debutAuPlusTot: tot.get(id)!, finAuPlusTot: fin.get(id)!,
      debutAuPlusTard: tard.get(id)!, finAuPlusTard: finTard.get(id)!,
      margeTotale: tard.get(id)! - tot.get(id)!,
      margeLibre: Math.max(0, margeLibre),
      critique: Math.abs(tard.get(id)! - tot.get(id)!) < 1e-9,
      debutPlanifie: debutPlanifie.get(id) ?? tot.get(id)!,
      finPlanifiee: finPlanifiee.get(id) ?? fin.get(id)!,
      attenteRessource: (debutPlanifie.get(id) ?? tot.get(id)!) - tot.get(id)!,
      ressources: t.ressources ?? [],
    };
  }).sort((a, b) => a.debutAuPlusTot - b.debutAuPlusTot || a.id.localeCompare(b.id));

  // Le chemin critique comme SÉQUENCE (pas seulement un ensemble).
  const critiques = planifiees.filter((t) => t.critique);
  const cheminCritique: string[] = [];
  let curseur: TachePlanifiee | undefined = critiques.find((t) => t.debutAuPlusTot === 0 && (parId.get(t.id)!.apres ?? []).length === 0) ?? critiques[0];
  while (curseur) {
    const actuel: TachePlanifiee = curseur;
    cheminCritique.push(actuel.id);
    curseur = critiques.find((c) => (parId.get(c.id)!.apres ?? []).includes(actuel.id) && Math.abs(c.debutAuPlusTot - actuel.finAuPlusTot) < 1e-9);
  }

  const chargeRessources = [...utilise.entries()].map(([ressource, occ]) => {
    const occupation = occ.reduce((s, o) => s + (o.fin - o.debut), 0);
    const cap = capacites[ressource] ?? 1;
    return { ressource, occupation, tauxPourcent: dureeAvecRessources > 0 ? (occupation / (dureeAvecRessources * cap)) * 100 : 0, taches: occ.length };
  }).sort((a, b) => b.tauxPourcent - a.tauxPourcent);

  const retardRessources = dureeAvecRessources - dureeChemin;
  const goulots = chargeRessources.filter((c) => c.tauxPourcent > 80).map((c) => c.ressource);

  rigueur.hypotheses.push("Une tâche commence dès que ses prédécesseurs sont finis (liaison fin → début), sans chevauchement partiel ni interruption.");
  if (aRessources) {
    rigueur.hypotheses.push("Une ressource ne fait qu'une chose à la fois (capacité 1 par défaut) et n'est jamais interrompue en cours de tâche.");
    rigueur.limites.push("L'ordonnancement sous ressources rend une solution RÉALISABLE par règle de priorité (marge la plus faible d'abord), pas l'optimum : le problème est NP-difficile.");
    if (retardRessources > 1e-9) rigueur.avertissements.push(`Le projet dure ${arrondi(dureeAvecRessources, 3)} au lieu de ${arrondi(dureeChemin, 3)} : ${arrondi(retardRessources, 3)} de plus imposés par les RESSOURCES, pas par la logique du projet${goulots.length ? ` (${goulots.join(", ")})` : ""}.`);
  }
  rigueur.limites.push("Les durées sont prises comme certaines : une durée « probable » se traite en simulation, pas par un chiffre unique.");
  if (critiques.length === planifiees.length && planifiees.length > 1) rigueur.avertissements.push("Toutes les tâches sont critiques : aucune marge nulle part, le moindre aléa décale la fin.");

  const echeance = p.echeance !== undefined && Number.isFinite(p.echeance)
    ? { valeur: p.echeance, tenue: dureeAvecRessources <= p.echeance + 1e-9, retard: Math.max(0, dureeAvecRessources - p.echeance) }
    : null;
  if (echeance && !echeance.tenue) rigueur.avertissements.push(`Échéance ${arrondi(echeance.valeur, 3)} dépassée de ${arrondi(echeance.retard, 3)} : raccourcir une tâche du chemin critique, ou ajouter de la ressource sur ${goulots[0] ?? "le goulot"}.`);

  return { ok: true, dureeChemin, dureeAvecRessources, taches: planifiees, cheminCritique, chargeRessources, goulots, retardRessources, echeance, rigueur, ms: Date.now() - t0 };
}

/** Le texte court : durée, chemin critique, marges, ce qui bloque. */
export function resumerOrdonnancement(r: ResultatOrdonnancement): string[] {
  const lignes = [`Durée du projet : ${arrondi(r.dureeAvecRessources, 3)}${r.retardRessources > 1e-9 ? ` (dont ${arrondi(r.retardRessources, 3)} d'attente de ressource ; ${arrondi(r.dureeChemin, 3)} par la seule logique des dépendances)` : ""}.`];
  lignes.push(`Chemin critique : ${r.cheminCritique.join(" → ")} — aucune marge, un jour de retard y est un jour de retard sur la fin.`);
  const marges = r.taches.filter((t) => t.margeTotale > 0).sort((a, b) => b.margeTotale - a.margeTotale).slice(0, 3);
  if (marges.length) lignes.push(`Plus grandes marges : ${marges.map((t) => `${t.nom} (${arrondi(t.margeTotale, 3)})`).join(", ")}.`);
  if (r.goulots.length) lignes.push(`Ressources saturées : ${r.chargeRessources.filter((c) => r.goulots.includes(c.ressource)).map((c) => `${c.ressource} ${arrondi(c.tauxPourcent, 1)} %`).join(", ")}.`);
  if (r.echeance) lignes.push(r.echeance.tenue ? `Échéance ${arrondi(r.echeance.valeur, 3)} tenue.` : `Échéance ${arrondi(r.echeance.valeur, 3)} dépassée de ${arrondi(r.echeance.retard, 3)}.`);
  return lignes;
}
