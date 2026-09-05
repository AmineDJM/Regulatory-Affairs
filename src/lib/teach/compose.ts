/**
 * LE BLOC DE RÈGLES QUE LE MODÈLE LIT — composé sous budget, jamais accumulé (§11).
 *
 * Les contraintes de société d'abord, puis les règles de département, puis les préférences de
 * la personne ; un domaine demandé filtre (plus `general`, qui vaut partout). Chaque ligne porte
 * le périmètre, la nature, la version et l'identifiant : « supprime cette règle » sait de quoi
 * on parle, et « d'où tu tiens ça ? » a une réponse. Ce qui ne rentre pas dans le budget est
 * COMPTÉ et dit — un modèle qui ignore l'existence de règles omises ne peut pas aller les lire.
 *
 * Module PUR.
 */

import { LIBELLE_KIND, LIBELLE_SCOPE, type Regle } from "@/lib/teach/model";

/** ~4 caractères par jeton : suffisant pour un plafond, on ne facture rien ici. */
const estimerJetons = (t: string): number => Math.ceil(t.length / 4);

export interface OptionsBloc {
  /** Le domaine du tour ou de la mission ; `null` = tout. `general` est toujours servi. */
  domaine?: string | null;
  budgetJetons?: number;
  /** Le libellé de la société, pour les règles de périmètre COMPANY. */
  nomSociete?: (companyId: string | null) => string | null;
}

export const BUDGET_REGLES_DEFAUT = 900;

export function ligneRegle(r: Regle, nomSociete?: OptionsBloc["nomSociete"]): string {
  const societe = r.scope === "COMPANY" ? nomSociete?.(r.companyId) ?? null : null;
  const perimetre = r.scope === "COMPANY" ? (societe ? `Société ${societe}` : r.companyId ? "Société" : "Groupe") : LIBELLE_SCOPE[r.scope];
  const fin = r.effectiveTo ? ` (jusqu'au ${r.effectiveTo.toISOString().slice(0, 10)})` : "";
  return `- [${perimetre} · ${LIBELLE_KIND[r.kind]} · v${r.version} · ${r.id}] ${r.statement.trim()}${fin}`;
}

/** Les règles retenues pour un domaine : celles du domaine, plus `general`. */
export function filtrerParDomaine(regles: readonly Regle[], domaine: string | null | undefined): Regle[] {
  if (!domaine || domaine === "general") return [...regles];
  return regles.filter((r) => r.domain === domaine || r.domain === "general");
}

/**
 * COMPOSE le bloc. Rend `""` quand aucune règle ne s'applique : un en-tête suivi de rien ferait
 * croire qu'on a cherché et qu'il n'y a rien à respecter — ce qui est différent de « aucune
 * règle n'a été enseignée ».
 */
export function composerBlocRegles(enVigueur: readonly Regle[], opts: OptionsBloc = {}): string {
  const retenues = filtrerParDomaine(enVigueur, opts.domaine);
  if (retenues.length === 0) return "";
  const budget = opts.budgetJetons ?? BUDGET_REGLES_DEFAUT;
  const entete = "RÈGLES ENSEIGNÉES À ADAM (Teach Adam) — à respecter ; « une règle » se cite par son identifiant :";
  const lignes: string[] = [];
  let jetons = estimerJetons(entete) + 40;
  let omises = 0;
  for (const r of retenues) {
    const l = ligneRegle(r, opts.nomSociete);
    const j = estimerJetons(l);
    if (jetons + j > budget && lignes.length > 0) { omises += 1; continue; }
    lignes.push(l);
    jetons += j;
  }
  const pied = omises > 0
    ? `(${omises} autre(s) règle(s) en vigueur non affichée(s) faute de place — les lire avec list_rules.)`
    : "";
  return [entete, ...lignes, pied, "Ces règles ne remplacent jamais une donnée métier ni un droit d'accès : elles disent COMMENT agir, pas ce qui est vrai ni ce qui est permis."].filter(Boolean).join("\n");
}

/** Les lignes pour le PLANIFICATEUR de missions (`ContextePlanification.politiques`). */
export function lignesPourPlanificateur(enVigueur: readonly Regle[], domaine?: string | null, max = 12): string[] {
  return filtrerParDomaine(enVigueur, domaine).slice(0, max).map((r) => `${LIBELLE_KIND[r.kind]} (${LIBELLE_SCOPE[r.scope]}, ${r.id}) : ${r.statement.trim()}`);
}
