/**
 * LES CYCLES — durée, capacité terrain d'un KAM, avancement (requis / réalisé / restant / capacité / utilisation).
 *
 * L'instantané d'un cycle porte, par praticien, ce que les règles demandaient À L'OUVERTURE : changer une règle ou un
 * classement ensuite ne réécrit pas un cycle (§50, §84). La capacité se calcule et se DIT (jours ouvrés, part terrain,
 * absences approuvées, visites par jour) — aucune « fausse précision » (§55) : une absence approuvée la réduit.
 *
 * Module PUR — testé sans base.
 */

export const DUREES = ["MOIS", "QUATRE_SEMAINES", "SIX_SEMAINES", "TRIMESTRE", "PERSONNALISE"] as const;
export type Duree = (typeof DUREES)[number];
export const DUREE_LABELS: Record<Duree, string> = {
  MOIS: "1 mois", QUATRE_SEMAINES: "4 semaines", SIX_SEMAINES: "6 semaines", TRIMESTRE: "Trimestre", PERSONNALISE: "Personnalisée",
};

const jour = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** La fin d'un cycle (dernier jour inclus). Personnalisée : la fin donnée, jamais avant le début. */
export function finDuCycle(debut: Date, duree: Duree, finPersonnalisee?: Date | null): Date | null {
  const d = jour(debut);
  switch (duree) {
    case "MOIS": return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate() - 1));
    case "QUATRE_SEMAINES": return new Date(d.getTime() + 27 * 86_400_000);
    case "SIX_SEMAINES": return new Date(d.getTime() + 41 * 86_400_000);
    case "TRIMESTRE": return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, d.getUTCDate() - 1));
    case "PERSONNALISE": return finPersonnalisee && jour(finPersonnalisee) >= d ? jour(finPersonnalisee) : null;
  }
}

/** Jours ouvrés entre deux dates incluses — semaine algérienne : vendredi et samedi chômés. */
export function joursOuvres(debut: Date, fin: Date): number {
  let n = 0;
  for (let t = jour(debut).getTime(); t <= jour(fin).getTime(); t += 86_400_000) {
    const j = new Date(t).getUTCDay();
    if (j !== 5 && j !== 6) n++;
  }
  return n;
}

/** Les jours ouvrés d'absence APPROUVÉE qui tombent dans le cycle. */
export function joursAbsence(cycle: { debut: Date; fin: Date }, absences: readonly { debut: Date; fin: Date }[]): number {
  let n = 0;
  for (const a of absences) {
    const d = a.debut > cycle.debut ? a.debut : cycle.debut, f = a.fin < cycle.fin ? a.fin : cycle.fin;
    if (d <= f) n += joursOuvres(d, f);
  }
  return n;
}

export interface CapaciteKam {
  repId: string;
  joursOuvres: number;
  partTerrain: number;
  joursAbsence: number;
  visitesParJour: number;
  /** Capacité théorique et réelle (après absences), en visites. */
  theorique: number;
  reelle: number;
  explication: string;
}

export function capaciteKam(repId: string, cycle: { debut: Date; fin: Date }, p: { visitesParJour: number; partTerrainPct: number; absences: readonly { debut: Date; fin: Date }[] }): CapaciteKam {
  const jo = joursOuvres(cycle.debut, cycle.fin);
  const ja = joursAbsence(cycle, p.absences);
  const part = Math.max(0, Math.min(100, p.partTerrainPct)) / 100;
  const theorique = Math.round(jo * part * p.visitesParJour);
  const reelle = Math.round(Math.max(0, jo - ja) * part * p.visitesParJour);
  const explication = `${jo} jours ouvrés × ${Math.round(part * 100)} % terrain × ${p.visitesParJour} visites/jour = ${theorique}${ja ? ` ; ${ja} jour(s) d'absence approuvée → ${reelle}` : ""}.`;
  return { repId, joursOuvres: jo, partTerrain: part, joursAbsence: ja, visitesParJour: p.visitesParJour, theorique, reelle, explication };
}

/** Ce que l'instantané garde d'un praticien. */
export interface PraticienFige {
  doctorId: string;
  nom: string;
  h: boolean;
  cible: boolean;
  affichage: string;
  priorite: string | null;
  visites: number;
  pourquoiVisites: string;
  /** Le ou les KAM qui le couvraient à l'ouverture. */
  kamIds: string[];
}

export interface AvancementKam {
  repId: string;
  praticiens: number;
  requis: number;
  realise: number;
  restant: number;
  capacite: number | null;
  /** requis ÷ capacité réelle — la charge que le cycle demande. */
  utilisation: number | null;
  /** H dont les visites réalisées sont sous la fréquence requise. */
  hSousVisites: number;
  p1: number;
}

/**
 * L'AVANCEMENT d'un cycle : par KAM, requis (Σ visites requises de son panel), réalisé (visites terminées, plafonnées
 * au requis par praticien — une 5e visite au même médecin ne comble pas un autre trou), restant, capacité, utilisation.
 * Un praticien couvert par deux KAM compte pour chacun : le cockpit le dit, il ne le divise pas au hasard.
 */
export function avancement(praticiens: readonly PraticienFige[], realisees: Readonly<Record<string, number>>, capacites: Readonly<Record<string, number>>): { parKam: AvancementKam[]; total: { requis: number; realise: number; restant: number } } {
  const parKam = new Map<string, AvancementKam>();
  let requis = 0, realise = 0;
  for (const p of praticiens) {
    const fait = Math.min(realisees[p.doctorId] ?? 0, Math.ceil(p.visites));
    requis += p.visites;
    realise += fait;
    for (const k of p.kamIds) {
      const a = parKam.get(k) ?? { repId: k, praticiens: 0, requis: 0, realise: 0, restant: 0, capacite: capacites[k] ?? null, utilisation: null, hSousVisites: 0, p1: 0 };
      a.praticiens++;
      a.requis += p.visites;
      a.realise += fait;
      if (p.h && (realisees[p.doctorId] ?? 0) < p.visites) a.hSousVisites++;
      if (p.priorite === "P1") a.p1++;
      parKam.set(k, a);
    }
  }
  for (const a of parKam.values()) {
    a.restant = Math.max(0, a.requis - a.realise);
    a.utilisation = a.capacite ? a.requis / a.capacite : null;
  }
  return { parKam: [...parKam.values()].sort((a, b) => b.requis - a.requis), total: { requis, realise, restant: Math.max(0, requis - realise) } };
}
