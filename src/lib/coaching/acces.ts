/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * QUI ADMINISTRE, QUI COACHE, QUI LIT UNE FICHE DE COACHING (§118.157). Module PUR.
 *
 * ── LE DIRECTEUR DES OPÉRATIONS ADMINISTRE ─────────────────────────────────────────────────
 *
 * Demande de la Direction (28/09/2026) : la fiche est « sous l'administration et la gestion du
 * directeur des opérations », « modifiable par le directeur des opérations ». Le métier emploie
 * DEUX libellés pour cette fonction, et le dépôt a déjà tranché qu'ils la désignent tous deux :
 * la Direction des opérations (`DIRECTION`, §118.139) et le Directeur des Opérations
 * (`OPERATIONS_DIRECTOR`) — c'est la lecture de `promo-material/validateurs.ts` (« les deux
 * libellés que le métier emploie pour la même fonction »). Les deux administrent, plus le Super
 * Admin. Pour réserver la grille au seul Directeur des Opérations, retirer `DIRECTION` de
 * `ROLES_ADMINISTRATEURS` suffit — la règle n'est écrite qu'ici.
 *
 * ADMINISTRER, c'est : modifier la GRILLE (chaque modification crée une version), voir TOUTES
 * les fiches — brouillons compris —, les modifier même finalisées, les supprimer, coacher
 * n'importe quel collaborateur.
 *
 * ── LES AUTRES ──────────────────────────────────────────────────────────────────────────────
 *
 * Le PÉRIMÈTRE vient de la force de vente (`resolveRepScope`, `lib/sfe.ts`) : qui configure la
 * force de vente voit tous les KAM, un superviseur de BU voit ceux de ses BU, un KAM se voit
 * lui-même. Le recalculer ici donnerait deux réponses à « quels KAM sont les miens ? » (§118.5).
 *
 *   • COACHER un collaborateur : l'avoir dans son périmètre — jamais soi-même.
 *   • LIRE une fiche : l'avoir écrite ou y être désigné manager ; sinon, elle doit être
 *     FINALISÉE et porter sur un collaborateur de son périmètre (ou sur soi). Un BROUILLON est
 *     le travail en cours de son auteur : ni le collaborateur, ni un collègue ne le lisent.
 *   • MODIFIER : l'auteur ou le manager désigné tant que la fiche est un brouillon. Une fiche
 *     finalisée a été partagée avec le collaborateur ; seule l'administration la retouche, et
 *     le collaborateur en est prévenu.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const ROLES_ADMINISTRATEURS = ["SUPER_ADMIN", "DIRECTION", "OPERATIONS_DIRECTOR"] as const;

type PorteurDeRoles = { role: string; secondaryRole?: string | null };

/** Le rôle principal OU le rôle secondaire — la lecture canonique d'un rôle métier (`hasRole`). */
export function peutAdministrerLeCoaching(u: PorteurDeRoles): boolean {
  return ROLES_ADMINISTRATEURS.some((r) => u.role === r || u.secondaryRole === r);
}

/** Le périmètre d'une personne sur la force de vente — la forme de `resolveRepScope`. */
export type PerimetreCoaching = "TOUT" | { collaborateurs: readonly string[] };

export interface LecteurCoaching {
  id: string;
  administre: boolean;
  perimetre: PerimetreCoaching;
}

export type StatutFiche = "DRAFT" | "FINALIZED";

export interface FaitsFiche {
  collaboratorId: string;
  managerId: string | null;
  createdById: string | null;
  status: StatutFiche;
}

const dansLePerimetre = (l: LecteurCoaching, collaboratorId: string): boolean =>
  l.perimetre === "TOUT" || l.perimetre.collaborateurs.includes(collaboratorId);

/** L'auteur ou le manager désigné — ceux qui ont TENU la fiche. */
const enEstLAuteur = (l: LecteurCoaching, f: FaitsFiche): boolean =>
  f.createdById === l.id || f.managerId === l.id;

export function peutCoacher(l: LecteurCoaching, collaboratorId: string): boolean {
  if (collaboratorId === l.id) return false;
  return l.administre || dansLePerimetre(l, collaboratorId);
}

export function peutLireFiche(l: LecteurCoaching, f: FaitsFiche): boolean {
  if (l.administre || enEstLAuteur(l, f)) return true;
  if (f.status !== "FINALIZED") return false;
  return f.collaboratorId === l.id || dansLePerimetre(l, f.collaboratorId);
}

export function peutModifierFiche(l: LecteurCoaching, f: FaitsFiche): boolean {
  if (l.administre) return true;
  return f.status === "DRAFT" && enEstLAuteur(l, f);
}

export function peutFinaliserFiche(l: LecteurCoaching, f: FaitsFiche): boolean {
  return f.status === "DRAFT" && (l.administre || enEstLAuteur(l, f));
}

export function peutSupprimerFiche(l: LecteurCoaching, f: FaitsFiche): boolean {
  if (l.administre) return true;
  return f.status === "DRAFT" && f.createdById === l.id;
}

/**
 * LA CLAUSE DE LISTE — `peutLireFiche` traduite en filtre de base, pour ne pas charger toutes les
 * fiches du groupe et les trier en mémoire.
 *
 * Deux lectures du même droit finissent par diverger (§118.5) : un banc exige que cette clause
 * rende EXACTEMENT les fiches que `peutLireFiche` accepte, sur un décor qui couvre chaque branche.
 * L'objet est un filtre Prisma écrit en clair — ce module n'importe rien.
 */
export function clauseFichesVisibles(l: LecteurCoaching): Record<string, unknown> {
  if (l.administre) return {};
  const branches: Record<string, unknown>[] = [
    { createdById: l.id },
    { managerId: l.id },
    { status: "FINALIZED", collaboratorId: l.id },
  ];
  if (l.perimetre === "TOUT") branches.push({ status: "FINALIZED" });
  else if (l.perimetre.collaborateurs.length > 0) {
    branches.push({ status: "FINALIZED", collaboratorId: { in: [...l.perimetre.collaborateurs] } });
  }
  return { OR: branches };
}

/** Les gestes offerts à l'écran — la même règle que les actions, lue une fois. */
export function gestesSurLaFiche(l: LecteurCoaching, f: FaitsFiche) {
  return {
    modifier: peutModifierFiche(l, f),
    finaliser: peutFinaliserFiche(l, f),
    supprimer: peutSupprimerFiche(l, f),
  };
}
