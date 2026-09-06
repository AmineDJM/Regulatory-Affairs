/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE TEMPS DES FAITS (mandat 6 §45) — pur.
 *
 * ── DEUX TEMPS, ET LES CONFONDRE EST LA FAUTE CLASSIQUE ─────────────────────────────────
 *
 * Un fait a DEUX dates, et elles ne disent pas la même chose :
 *
 *   · le TEMPS DE VALIDITÉ (`depuis` / `jusqua`) — quand le fait était vrai dans le monde :
 *     « Yassine était responsable du dossier du 1er janvier au 30 juin » ;
 *   · le TEMPS DE CONSTAT (`constateLe`) — quand NOUS l'avons su : la ligne de journal a été
 *     écrite le 3 juillet, parce que la passation a été saisie en retard.
 *
 * « Qui était responsable au moment de cette décision ? » interroge le PREMIER. « Que savait-on
 * quand on a décidé ? » interroge le SECOND — et la réponse peut être « personne ne le savait
 * encore ». Un modèle qui n'aurait qu'une date répondrait à la première question avec la
 * seconde, c'est-à-dire réécrirait l'histoire en la corrigeant.
 *
 * ── UN INTERVALLE OUVERT N'EST PAS UN INTERVALLE INFINI ─────────────────────────────────
 *
 * `jusqua: null` signifie « encore vrai à notre connaissance », pas « vrai pour toujours ».
 * `depuis: null` signifie « vrai depuis avant ce que nous savons », pas « depuis l'origine des
 * temps ». Les deux se lisent comme des BORNES INCONNUES, et les fonctions ci-dessous les
 * traitent ainsi — c'est ce qui empêche d'affirmer qu'un fait valait déjà à une date antérieure
 * à tout ce que le journal contient.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Un intervalle de validité. `null` d'un côté = borne INCONNUE, jamais « infinie ». */
export interface Intervalle {
  depuis: Date | null;
  jusqua: Date | null;
}

const t = (d: Date | null | undefined): number | null => (d ? d.getTime() : null);

/**
 * L'INSTANT `quand` TOMBE-T-IL DANS L'INTERVALLE ?
 *
 * Bornes : `depuis` est INCLUSE (le fait vaut dès l'instant du changement), `jusqua` est EXCLUE
 * (à l'instant où le suivant commence, c'est le suivant qui vaut). Sans cette convention, deux
 * faits consécutifs se chevaucheraient d'un instant et « qui était responsable ce jour-là ? »
 * aurait deux réponses.
 */
export function contient(i: Intervalle, quand: Date): boolean {
  const q = quand.getTime();
  const a = t(i.depuis);
  const b = t(i.jusqua);
  if (a !== null && q < a) return false;
  if (b !== null && q >= b) return false;
  return true;
}

/** Deux intervalles se recouvrent-ils, ne serait-ce qu'un instant ? */
export function chevauche(a: Intervalle, b: Intervalle): boolean {
  const a1 = t(a.depuis); const a2 = t(a.jusqua);
  const b1 = t(b.depuis); const b2 = t(b.jusqua);
  if (a2 !== null && b1 !== null && a2 <= b1) return false;
  if (b2 !== null && a1 !== null && b2 <= a1) return false;
  return true;
}

/** Ce que deux intervalles ont en commun — `null` quand ils ne se touchent pas. */
export function intersection(a: Intervalle, b: Intervalle): Intervalle | null {
  if (!chevauche(a, b)) return null;
  const a1 = t(a.depuis); const b1 = t(b.depuis);
  const a2 = t(a.jusqua); const b2 = t(b.jusqua);
  const depuis = a1 === null ? b.depuis : b1 === null ? a.depuis : new Date(Math.max(a1, b1));
  const jusqua = a2 === null ? b.jusqua : b2 === null ? a.jusqua : new Date(Math.min(a2, b2));
  return { depuis, jusqua };
}

/**
 * LA DURÉE EN JOURS — `null` quand une borne est inconnue.
 *
 * On ne remplace PAS une borne ouverte par « aujourd'hui » : « il est responsable depuis une
 * date inconnue » ne devient pas « depuis 0 jour », et un fait encore en cours n'a pas de durée
 * définitive. Passer `maintenant` demande explicitement la durée ÉCOULÉE, ce qui est une autre
 * question et se voit dans l'appel.
 */
export function dureeJours(i: Intervalle, maintenant?: Date): number | null {
  const a = t(i.depuis);
  const b = t(i.jusqua) ?? (maintenant ? maintenant.getTime() : null);
  if (a === null || b === null) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Un intervalle en français, avec ses bornes inconnues dites comme telles. */
export function direIntervalle(i: Intervalle): string {
  const j = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : null) ?? "";
  if (i.depuis && i.jusqua) return `du ${j(i.depuis)} au ${j(i.jusqua)}`;
  if (i.depuis) return `depuis le ${j(i.depuis)}`;
  if (i.jusqua) return `jusqu'au ${j(i.jusqua)} (début inconnu)`;
  return "période inconnue";
}

/**
 * FERME LES INTERVALLES d'une suite d'observations de la MÊME propriété.
 *
 * ── LE CŒUR DU MODÈLE, ET IL TIENT EN UNE IDÉE ──────────────────────────────────────────
 *
 * L'ERP ne stocke pas d'historique : il stocke la valeur COURANTE, et le journal d'audit note
 * chaque changement (« ce champ est passé de A à B, le 12 mars »). Un historique se reconstruit
 * donc en lisant les changements dans l'ordre : la valeur A valait JUSQU'AU 12 mars, la valeur B
 * À PARTIR DU 12 mars — jusqu'au changement suivant.
 *
 * C'est ce que fait cette fonction, et c'est pour cela qu'aucune table d'historique n'est créée
 * (§17) : l'histoire est déjà écrite, elle n'était simplement pas LUE comme une histoire.
 *
 * `depuis` du tout premier intervalle est laissé à `debut` quand on le connaît (la création de
 * l'entité), et à `null` sinon — jamais à la date du premier changement journalisé, qui
 * ferait croire que rien n'existait avant.
 */
export interface Observation<T> {
  /** La valeur qui devient vraie à cet instant. */
  valeur: T;
  /** L'instant du changement. */
  quand: Date;
  /** Ce qui l'a fait savoir — un identifiant de journal, une source. */
  source: string;
  /** Qui l'a fait, quand on le sait. */
  acteur?: string | null;
}

export interface Tranche<T> extends Intervalle {
  valeur: T;
  source: string;
  acteur: string | null;
}

export function fermerIntervalles<T>(observations: readonly Observation<T>[], options: { debut?: Date | null; valeurInitiale?: T; sourceInitiale?: string } = {}): Tranche<T>[] {
  const tri = [...observations].sort((a, b) => a.quand.getTime() - b.quand.getTime());
  const out: Tranche<T>[] = [];

  // LA VALEUR D'AVANT LE PREMIER CHANGEMENT, quand on la connaît (elle est dans `oldValue` de la
  // première ligne de journal). Sans elle, l'histoire commence au premier changement, et la
  // période précédente — souvent la plus longue — disparaît.
  if (options.valeurInitiale !== undefined) {
    out.push({
      valeur: options.valeurInitiale,
      depuis: options.debut ?? null,
      jusqua: tri.length ? tri[0]!.quand : null,
      source: options.sourceInitiale ?? "état initial",
      acteur: null,
    });
  }

  for (const [i, o] of tri.entries()) {
    out.push({
      valeur: o.valeur,
      depuis: o.quand,
      jusqua: i + 1 < tri.length ? tri[i + 1]!.quand : null,
      source: o.source,
      acteur: o.acteur ?? null,
    });
  }
  return out;
}

/** La tranche valide à un instant — `null` quand aucune ne l'est (avant le début connu). */
export function trancheA<T>(tranches: readonly Tranche<T>[], quand: Date): Tranche<T> | null {
  return tranches.find((x) => contient(x, quand)) ?? null;
}
