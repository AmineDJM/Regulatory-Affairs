import { prisma } from "@/lib/prisma";
import { bilanDesNotes, lireGrille, lireNotes, type GrilleCoaching, type Points } from "./grille";
import { clauseFichesVisibles, gestesSurLaFiche, peutLireFiche, type LecteurCoaching, type StatutFiche } from "./acces";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES FICHES DE COACHING, lues sous la règle de `acces.ts` (§118.157). Côté serveur.
 *
 * La liste passe par `clauseFichesVisibles`, la fiche seule par `peutLireFiche` — les deux
 * traductions de la même règle, qu'un banc compare sur chaque branche. Une fiche invisible rend
 * `null`, exactement comme une fiche inexistante : distinguer les deux dirait à un collègue
 * qu'une évaluation existe sur quelqu'un.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface FicheListee {
  id: string;
  collaboratorId: string;
  collaborateur: string;
  manager: string | null;
  visitDate: Date;
  sector: string | null;
  status: StatutFiche;
  gridVersion: number;
  /** `null` quand la grille de la fiche ne se lit plus — l'écran le dit, il n'invente pas un total. */
  total: number | null;
  max: number | null;
  complet: boolean;
  grille: GrilleCoaching | null;
  notes: Record<string, Points>;
  strengths: string | null;
  improvements: string | null;
  updatedAt: Date;
}

const SELECT_FICHE = {
  id: true, collaboratorId: true, managerId: true, createdById: true, visitDate: true, sector: true,
  status: true, scores: true, strengths: true, improvements: true, finalizedAt: true, createdAt: true, updatedAt: true,
  gridId: true,
  grid: { select: { id: true, version: true, content: true } },
  collaborator: { select: { name: true } },
  manager: { select: { name: true } },
  createdBy: { select: { name: true } },
  finalizedBy: { select: { name: true } },
} as const;

type LigneBrute = {
  id: string; collaboratorId: string; managerId: string | null; createdById: string | null; visitDate: Date;
  sector: string | null; status: StatutFiche; scores: unknown; strengths: string | null; improvements: string | null; updatedAt: Date;
  grid: { id: string; version: number; content: unknown };
  collaborator: { name: string }; manager: { name: string } | null;
};

function versListee(r: LigneBrute): FicheListee {
  const grille = lireGrille(r.grid.content);
  const notes = grille ? lireNotes(r.scores, grille) : {};
  const bilan = grille ? bilanDesNotes(grille, notes) : null;
  return {
    id: r.id,
    collaboratorId: r.collaboratorId,
    collaborateur: r.collaborator.name,
    manager: r.manager?.name ?? null,
    visitDate: r.visitDate,
    sector: r.sector,
    status: r.status,
    gridVersion: r.grid.version,
    total: bilan?.total ?? null,
    max: bilan?.max ?? null,
    complet: bilan?.complet ?? false,
    grille,
    notes,
    strengths: r.strengths,
    improvements: r.improvements,
    updatedAt: r.updatedAt,
  };
}

export interface FiltresFiches {
  collaboratorId?: string | null;
  statut?: StatutFiche | null;
  /** Première date de tournée incluse. */
  depuis?: Date | null;
  limite?: number;
}

/** LES FICHES VISIBLES, de la plus récente tournée à la plus ancienne. */
export async function listerFichesVisibles(l: LecteurCoaching, f: FiltresFiches = {}): Promise<{ fiches: FicheListee[]; tronque: boolean }> {
  const limite = f.limite ?? 300;
  const rows = await prisma.coachingSheet.findMany({
    where: {
      AND: [
        clauseFichesVisibles(l),
        f.collaboratorId ? { collaboratorId: f.collaboratorId } : {},
        f.statut ? { status: f.statut } : {},
        f.depuis ? { visitDate: { gte: f.depuis } } : {},
      ],
    },
    orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
    take: limite + 1,
    select: SELECT_FICHE,
  });
  // UNE COUPE SE DIT (§118.60) : au-delà de la limite, l'écran l'annonce au lieu de laisser croire
  // que la liste est complète.
  return { fiches: rows.slice(0, limite).map((r) => versListee(r as LigneBrute)), tronque: rows.length > limite };
}

export interface FicheDetaillee extends FicheListee {
  managerId: string | null;
  createdById: string | null;
  finalizedAt: Date | null;
  finalisePar: string | null;
  creePar: string | null;
  createdAt: Date;
  gridId: string;
  gestes: { modifier: boolean; finaliser: boolean; supprimer: boolean };
}

/** UNE FICHE, si ce lecteur a le droit de la lire — sinon `null`, comme si elle n'existait pas. */
export async function chargerFicheVisible(l: LecteurCoaching, id: string): Promise<FicheDetaillee | null> {
  const r = await prisma.coachingSheet.findUnique({ where: { id }, select: SELECT_FICHE });
  if (!r) return null;
  const faits = { collaboratorId: r.collaboratorId, managerId: r.managerId, createdById: r.createdById, status: r.status };
  if (!peutLireFiche(l, faits)) return null;
  return {
    ...versListee(r as LigneBrute),
    managerId: r.managerId,
    createdById: r.createdById,
    finalizedAt: r.finalizedAt,
    finalisePar: r.finalizedBy?.name ?? null,
    creePar: r.createdBy?.name ?? null,
    createdAt: r.createdAt,
    gridId: r.gridId,
    gestes: gestesSurLaFiche(l, faits),
  };
}
