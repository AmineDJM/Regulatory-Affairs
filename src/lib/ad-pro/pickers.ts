/**
 * CE QU'UNE DEMANDE Ad&Pro DÉSIGNE — des produits RÉELS, des médecins de l'ANNUAIRE, une wilaya.
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * Trois champs libres : « Produit concerné », « Médecin concerné », « Ville ». On y tapait ce
 * qu'on voulait, et la colonne devenait inexploitable :
 *
 *   • un produit écrit de six façons — nom commercial, DCI, abréviation, faute de frappe — et,
 *     régulièrement, un produit qui n'existe PAS encore : un dossier réglementaire en cours, dont
 *     la promotion est interdite tant que la décision n'est pas obtenue ;
 *   • un médecin nommé de mémoire, qui ne se rapproche d'aucune fiche de l'annuaire, si bien
 *     qu'on ne sait jamais combien de fois on a pris en charge la même personne ;
 *   • une ville en huit orthographes (voir `geo/algeria.ts`).
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────────────────────
 *
 * On CHOISIT dans le réel. Les produits proposés sont ceux dont **le traitement réglementaire est
 * terminé** — les seuls qu'on ait le droit de promouvoir ; les médecins viennent de l'annuaire ;
 * la ville du référentiel des wilayas. Et **plusieurs** de chaque : une prise en charge concerne
 * souvent deux praticiens et trois produits, et forcer un seul faisait écrire le reste dans la
 * description, où rien ne le compte.
 *
 * ── POURQUOI ON STOCKE DES NOMS, ET NON DES IDENTIFIANTS ────────────────────────────────────
 *
 * Les colonnes existent déjà (`doctor`, `product`, `city`) et sont LUES COMME DU TEXTE partout :
 * la liste, la fiche, le libellé de l'ordre de dépense, la notification, l'export. Les remplacer
 * par des relations demanderait quatre tables de liaison et la réécriture de tous ces points de
 * lecture, pour un lien qu'aucun écran ne suit aujourd'hui.
 *
 * Ce qui change — et c'est tout ce qui compte ici — c'est que la valeur écrite vient désormais du
 * référentiel au lieu du clavier. La LIMITE assumée : renommer un produit dans Regulatory ne
 * renomme pas les demandes passées. C'est le comportement voulu — une demande dit ce qui a été
 * demandé À L'ÉPOQUE, elle ne se réécrit pas toute seule.
 *
 * Module PUR : ni base, ni session. Testé.
 */

/**
 * LES DOSSIERS DONT LE TRAITEMENT EST TERMINÉ — les produits réellement disponibles.
 *
 * `DECISION_OBTAINED` : la décision de l'agence est tombée, le produit existe. `CLOSED` : le
 * dossier est clos après sa vie réglementaire — le produit est au marché depuis longtemps.
 *
 * Tout le reste est un dossier EN COURS : proposer ces produits-là reviendrait à faire préparer
 * la promotion d'un médicament qui n'a pas encore le droit d'être promu, et ce n'est pas une
 * maladresse d'écran — c'est une faute réglementaire.
 */
export const AVAILABLE_PRODUCT_STATUSES: readonly string[] = ["DECISION_OBTAINED", "CLOSED"];

export function isAvailableProduct(status: string | null | undefined): boolean {
  return AVAILABLE_PRODUCT_STATUSES.includes(status ?? "");
}

export interface ProductRow {
  id: string;
  /** Le nom commercial — celui sous lequel on le promeut. */
  brandName: string | null;
  /** La DCI — la molécule, qui reste le repère quand le nom commercial manque. */
  dci: string;
  status: string;
}

/**
 * COMMENT UN PRODUIT SE NOMME DANS UNE DEMANDE.
 *
 * Le nom commercial d'abord : c'est celui que le médecin connaît et celui qu'on écrit sur un
 * sponsoring. La DCI le suit entre parenthèses — deux marques peuvent porter la même molécule, et
 * l'inverse aussi. Sans nom commercial, la DCI tient seule : mieux vaut « Amlodipine » qu'un
 * identifiant.
 */
export function productLabel(p: ProductRow): string {
  const marque = (p.brandName ?? "").trim();
  const dci = p.dci.trim();
  if (!marque) return dci;
  return marque.toLowerCase() === dci.toLowerCase() ? marque : `${marque} (${dci})`;
}

/**
 * LES PRODUITS PROPOSABLES, triés par nom.
 *
 * Rien d'autre n'est offert : un menu qui contiendrait les dossiers en cours ferait choisir, un
 * jour, celui qui ne devait pas l'être — et personne à l'écran ne verrait la différence.
 */
export function availableProductOptions(rows: readonly ProductRow[]): { value: string; label: string }[] {
  return rows
    .filter((p) => isAvailableProduct(p.status))
    .map((p) => ({ value: productLabel(p), label: productLabel(p) }))
    // Dédoublonnage : deux dossiers peuvent aboutir au même libellé (même marque, même DCI).
    .filter((o, i, arr) => arr.findIndex((x) => x.value === o.value) === i)
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

export interface DoctorRow {
  id: string;
  name: string;
  specialty?: string | null;
  city?: string | null;
}

/**
 * COMMENT UN MÉDECIN SE NOMME DANS UNE DEMANDE.
 *
 * Le nom seul suffit rarement à lever le doute — deux « Dr Benali » existent. La spécialité et la
 * ville accompagnent donc le nom DANS LE MENU, pour choisir juste ; c'est le NOM seul qui est
 * écrit sur la demande, parce que c'est lui qu'on lit ensuite partout.
 */
export function doctorOptionLabel(d: DoctorRow): string {
  const suite = [d.specialty, d.city].map((x) => (x ?? "").trim()).filter(Boolean);
  return suite.length > 0 ? `${d.name} — ${suite.join(" · ")}` : d.name;
}

export function doctorOptions(rows: readonly DoctorRow[]): { value: string; label: string }[] {
  return rows
    .map((d) => ({ value: d.name.trim(), label: doctorOptionLabel(d) }))
    .filter((o) => o.value.length > 0)
    .filter((o, i, arr) => arr.findIndex((x) => x.value === o.value) === i)
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

/** Le séparateur des valeurs multiples — visible, lisible, et absent des noms propres. */
export const MULTI_SEP = " · ";

/**
 * PLUSIEURS VALEURS DANS UN CHAMP QUI EN ATTENDAIT UNE.
 *
 * Le formulaire envoie une entrée par case cochée ; la colonne, elle, est un texte. On les joint
 * avec un séparateur qu'on lit sans effort et qu'aucun nom propre ne contient — une virgule
 * aurait coupé « Benali, Ahmed », un point-virgule aurait eu l'air d'un export.
 */
export function joinMulti(values: readonly string[]): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = (v ?? "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.length > 0 ? out.join(MULTI_SEP) : null;
}

/** L'inverse — pour réafficher les cases cochées quand on rouvre une demande. */
export function splitMulti(raw: string | null | undefined): string[] {
  const t = (raw ?? "").trim();
  if (!t) return [];
  return t.split(MULTI_SEP).map((v) => v.trim()).filter(Boolean);
}

/**
 * CE QUE LE FORMULAIRE ENVOIE, RAMENÉ À UNE VALEUR DE COLONNE.
 *
 * Les anciennes demandes portent une saisie libre, et certains écrans envoient encore un champ
 * texte : on accepte les deux. Une liste cochée l'emporte quand elle existe ; sinon la saisie
 * libre passe telle quelle — refuser une valeur qu'on n'a pas su proposer, c'est bloquer la
 * demande pour un défaut de référentiel.
 */
export function readMultiField(picked: readonly string[], freeText: string | null | undefined): string | null {
  const joint = joinMulti(picked);
  if (joint) return joint;
  const t = (freeText ?? "").trim();
  return t || null;
}
