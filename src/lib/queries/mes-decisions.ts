/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « MON ESPACE » EST LE LIEU OÙ L'ON DÉCIDE — les règles de la file, PURES (lot E2 — audit 360°,
 * N2, M09, 07-05).
 *
 * Trois propriétés, chacune avec le défaut qu'elle ferme :
 *
 *   · UNE LIGNE PAR OBJET. Une même demande arrivait par deux portes : le congé d'un N+1 absent
 *     était listé dans « Validations à faire » (bloc d'intérim) ET dans « Congés qui attendent
 *     votre signature » ; une demande assignée ET à valider faisait deux lignes ; une prise en
 *     charge était à la fois « À arbitrer » et « Validation préliminaire ». On dédoublonne sur
 *     l'IDENTITÉ de l'objet (`objet`, « LEAVE_REQUEST:<id> »), jamais sur le libellé ou le lien —
 *     et la PREMIÈRE ligne gagne : l'ordre des blocs du centre dit quel geste passe devant.
 *
 *   · L'ANCIENNE D'ABORD. Une carte disait son échéance, jamais depuis quand elle attendait :
 *     impossible de voir que la demande du haut dormait depuis trois semaines (07-05). On trie sur
 *     `depuis` ; une ligne qu'on ne sait pas dater passe APRÈS les datées (on n'invente pas
 *     d'ancienneté pour la placer, §118.16) ; une ligne « et d'autres… » ferme sa section.
 *
 *   · LE COMPTEUR DIT LES LIGNES (§118.51). « À valider » comptait les validations de la liste et
 *     ignorait les congés que la personne doit signer, rendus dans leur propre bloc — sauf ceux de
 *     l'intérim, comptés et montrés deux fois. Il vaut désormais exactement les lignes des deux
 *     blocs de décision : les validations (hors congés) et les congés à signer, chacun une fois.
 *
 * Module SANS IMPORT : la page le lit, le centre d'actions aussi — et un test le joue sans base.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** L'identité d'un congé dans le centre — le bloc des signatures le rend, la liste générique non. */
export const PREFIXE_CONGE = "LEAVE_REQUEST:";
/** L'identité d'une demande au secrétariat — assignée, ou à valider : une seule ligne pour les deux. */
export const PREFIXE_DEMANDE_ADMIN = "ADMIN_REQUEST:";
/** Les lignes « et d'autres… » (une coupe qui se dit, §118.60) — elles ferment leur section. */
export const PREFIXE_RESTE = "reste:";

/** Ce que les règles de la file lisent d'une ligne du centre d'actions. */
export interface LigneAttente {
  objet: string;
  kind: string;
  /** ISO — depuis quand l'élément attend un geste ; `null` quand rien ne le date à coup sûr. */
  depuis: string | null;
  deadline: string | null;
  title: string;
}

/**
 * UNE LIGNE PAR OBJET — la première gagne. Les blocs du centre sont rangés du geste le plus
 * pressant au moins pressant (valider avant traiter, arbitrer à l'étape avant le statut hérité) :
 * garder la première, c'est garder le geste qui passe devant.
 */
export function dedoublonner<T extends { objet: string }>(lignes: readonly T[]): T[] {
  const vus = new Set<string>();
  const out: T[] = [];
  for (const l of lignes) {
    if (vus.has(l.objet)) continue;
    vus.add(l.objet);
    out.push(l);
  }
  return out;
}

const instant = (iso: string | null): number => {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
};

/** Comparateur : l'attente la plus ANCIENNE d'abord, puis l'échéance la plus proche. */
function parAnciennete(a: LigneAttente, b: LigneAttente): number {
  const ra = a.objet.startsWith(PREFIXE_RESTE) ? 1 : 0;
  const rb = b.objet.startsWith(PREFIXE_RESTE) ? 1 : 0;
  if (ra !== rb) return ra - rb;
  const da = instant(a.depuis);
  const db = instant(b.depuis);
  if (da !== db) return da < db ? -1 : 1;
  const ea = instant(a.deadline);
  const eb = instant(b.deadline);
  if (ea !== eb) return ea < eb ? -1 : 1;
  return a.title.localeCompare(b.title, "fr");
}

/** L'ANCIENNE D'ABORD — une ligne non datée après les datées, une ligne « reste » en dernier. */
export function trierParAnciennete<T extends LigneAttente>(lignes: readonly T[]): T[] {
  return [...lignes].sort(parAnciennete);
}

/**
 * LES CONGÉS À SIGNER, l'attente la plus ancienne d'abord ; à ancienneté égale, le départ le plus
 * proche. Le centre d'actions coupe sa liste avec cet ordre, le bloc de la page la rend avec lui.
 */
export function trierConges<C extends { depuis: string | null; startDate: string; employee: string }>(conges: readonly C[]): C[] {
  return [...conges].sort((a, b) => {
    const da = instant(a.depuis);
    const db = instant(b.depuis);
    if (da !== db) return da < db ? -1 : 1;
    const sa = instant(a.startDate);
    const sb = instant(b.startDate);
    if (sa !== sb) return sa < sb ? -1 : 1;
    return a.employee.localeCompare(b.employee, "fr");
  });
}

/**
 * LES TROIS BLOCS DE « MON ESPACE », et le compteur qui les annonce.
 *
 * `decisions` — ce qui attend ma signature (validations, paiements), SANS les congés : ils ont leur
 * propre bloc, qui porte la fiche et les boutons ; les y montrer aussi, c'était la même décision
 * deux fois. `conges` — les congés à signer, triés de même (à ancienneté égale, le départ le plus
 * proche). `aTraiter` — les demandes et dossiers. Les tâches n'y sont pas : elles ont leurs
 * sections, plus riches. `aValider` = les lignes de `decisions` + celles de `conges`, exactement.
 */
export function sectionsMonEspace<
  T extends LigneAttente,
  C extends { depuis: string | null; startDate: string; employee: string },
>(lignes: readonly T[], conges: readonly C[]): { decisions: T[]; conges: C[]; aTraiter: T[]; aValider: number } {
  const decisions = trierParAnciennete(
    lignes.filter((l) => (l.kind === "validation" || l.kind === "payment") && !l.objet.startsWith(PREFIXE_CONGE)),
  );
  const aTraiter = trierParAnciennete(lignes.filter((l) => l.kind === "request" || l.kind === "regulatory"));
  const congesTries = trierConges(conges);
  return { decisions, conges: congesTries, aTraiter, aValider: decisions.length + congesTries.length };
}
