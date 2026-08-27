/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA COUCHE SÉMANTIQUE — un mot, un calcul, partout le même.
 *
 * ── LE PROBLÈME QU'ELLE RÈGLE ────────────────────────────────────────────────────────────
 *
 * « Chiffre d'affaires » ne veut rien dire tant qu'on n'a pas dit LEQUEL. Ce qu'on a gagné sur
 * un marché, ce qui a été commandé, ce qui a été livré, ce qui a été facturé, ce qui est
 * ENCAISSÉ : cinq nombres différents, souvent d'un facteur deux, que tout le monde appelle
 * « le CA ». Deux personnes peuvent en discuter une heure sans savoir qu'elles ne parlent pas
 * de la même chose.
 *
 * Ce catalogue leur donne chacun un NOM et une DÉFINITION ÉCRITE. Chaque valeur rendue par la
 * couche métriques porte sa définition avec elle — pas dans une documentation à côté, DANS la
 * réponse. Un chiffre sans sa définition est une opinion.
 *
 * ── POURQUOI CE FICHIER N'IMPORTE RIEN ───────────────────────────────────────────────────
 *
 * Les définitions sont le CONTRAT ; le calcul est l'implémentation. Les séparer permet de
 * vérifier le contrat (noms uniques, définitions non vides, cohérence des unités) sans base de
 * données, et empêche une définition de dériver en silence parce qu'on a retouché une requête.
 *
 * ── CE QUE CETTE COUCHE INTERDIT ─────────────────────────────────────────────────────────
 *
 * Aucun de ces nombres n'est estimé, arrondi « au plus probable », ni demandé à un modèle de
 * langage. Une donnée manquante rend `null` et le DIT. Un modèle qui devine un chiffre d'affaires
 * produit une phrase crédible et fausse — le pire résultat possible pour une réunion.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type Unite = "DZD" | "jours" | "pourcentage" | "nombre";

/** Sur quoi la métrique se calcule. Une même famille de mots, deux portées différentes. */
export type Portee = "produit" | "marche" | "entreprise";

export interface MetricDef {
  /** Le nom canonique — celui qu'une capability expose et qu'un tableau de bord affiche. */
  nom: string;
  libelle: string;
  unite: Unite;
  portees: Portee[];
  /** LA DÉFINITION. Elle voyage avec la valeur : un chiffre sans elle est une opinion. */
  definition: string;
  /** Ce que la métrique N'EST PAS — la confusion précise qu'elle doit empêcher. */
  neConfondrePasAvec?: string;
}

export const METRICS: readonly MetricDef[] = [
  // ───────────────────────── L'ARGENT, DANS SON ORDRE D'ARRIVÉE ─────────────────────────
  {
    nom: "awardedRevenue",
    libelle: "Chiffre d'affaires attribué",
    unite: "DZD",
    portees: ["produit", "marche"],
    definition:
      "Somme des lignes de marché GAGNÉES, à leur prix d'attribution × quantité demandée. "
      + "Une ligne gagnée dont le prix d'attribution n'est pas saisi n'est PAS comptée, et le nombre "
      + "de lignes ainsi écartées est rendu à côté.",
    neConfondrePasAvec: "de l'argent acquis — c'est la valeur d'un marché remporté, dont la PCH peut ne jamais commander la totalité",
  },
  {
    nom: "orderedRevenue",
    libelle: "Chiffre d'affaires commandé",
    unite: "DZD",
    portees: ["produit", "marche"],
    definition: "Somme des bons de commande PCH non annulés. Ce que le client a réellement commandé.",
    neConfondrePasAvec: "l'attribué : un marché gagné n'est commandé qu'au fil des besoins",
  },
  {
    nom: "deliveredRevenue",
    libelle: "Chiffre d'affaires livré",
    unite: "DZD",
    portees: ["produit", "marche"],
    definition: "Bons de commande au statut LIVRÉ ou PAYÉ. La marchandise est partie.",
  },
  {
    nom: "invoicedRevenue",
    libelle: "Chiffre d'affaires facturé",
    unite: "DZD",
    portees: ["entreprise"],
    definition:
      "Somme des factures ÉMISES (`direction = IN`) sur la période, à leur date d'émission. "
      + "Les factures REÇUES (`OUT`) en sont exclues : ce sont des dépenses.",
    neConfondrePasAvec: "les ventes enregistrées : une vente saisie sans facture n'y figure pas, et l'écart est un signal de saisie",
  },
  {
    nom: "collectedRevenue",
    libelle: "Chiffre d'affaires encaissé",
    unite: "DZD",
    portees: ["produit", "marche", "entreprise"],
    definition:
      "Ce qui est RÉGLÉ. Sur un produit : ventes au statut PAYÉ. Sur un marché : bons de commande "
      + "payés ou portant une date de règlement. L'argent est arrivé.",
    neConfondrePasAvec: "le facturé — entre les deux il y a le délai de règlement, et parfois l'impayé",
  },
  {
    nom: "outstandingReceivables",
    libelle: "Créances ouvertes",
    unite: "DZD",
    portees: ["produit", "marche", "entreprise"],
    definition:
      "Ventes non entièrement réglées : statuts NON PAYÉ, PARTIEL, EN RETARD. "
      + "Une vente PARTIELLE y figure pour son montant TOTAL — la base ne porte pas la part déjà "
      + "reçue, et l'inventer donnerait un encours faux qui aurait l'air précis.",
  },

  // ───────────────────────── CE QUE LE PRODUIT COÛTE ─────────────────────────
  {
    nom: "adProSpend",
    libelle: "Investissement promotionnel imputé",
    unite: "DZD",
    portees: ["produit"],
    definition:
      "Somme des imputations Ad&Pro sur le produit : montant saisi directement, sinon la PART "
      + "appliquée au montant ACCORDÉ du poste. Jamais sur l'estimation du demandeur — une "
      + "estimation n'est pas une dépense.",
    neConfondrePasAvec: "le budget Ad&Pro total : un poste sert souvent plusieurs produits, seule sa part compte ici",
  },
  {
    nom: "hrAllocatedCost",
    libelle: "Coût humain analytique",
    unite: "DZD",
    portees: ["produit"],
    definition:
      "Somme, sur les personnes affectées au produit pendant la période, de leur COÛT EMPLOYEUR "
      + "mensuel × quotité d'affectation × nombre de mois d'affectation dans la période. "
      + "Une affectation sans quotité saisie est EXCLUE et comptée à part : répartir au prorata "
      + "des autres inventerait une décision d'organisation que personne n'a prise.",
    neConfondrePasAvec: "la masse salariale : c'est une ventilation analytique, pas une paie",
  },
  {
    nom: "productContribution",
    libelle: "Contribution du produit",
    unite: "DZD",
    portees: ["produit"],
    definition:
      "Encaissé − investissement promotionnel imputé − coût humain analytique. "
      + "Rendu UNIQUEMENT si ses trois composantes sont calculables ; sinon `null`, avec la liste "
      + "de ce qui manque.",
    neConfondrePasAvec: "une marge : le coût d'achat de la marchandise n'y est pas — la base ne le porte pas par produit",
  },

  // ───────────────────────── LE TEMPS, L'ACTIVITÉ, LA COUVERTURE ─────────────────────────
  {
    nom: "regulatoryDelay",
    libelle: "Retard réglementaire",
    unite: "jours",
    portees: ["produit"],
    definition:
      "Jours écoulés depuis la date CIBLE dépassée la plus ancienne du dossier (dépôt ou "
      + "enregistrement). Zéro si aucune cible n'est dépassée, `null` si aucune cible n'est fixée — "
      + "et « pas de cible » n'est pas « pas de retard ».",
  },
  {
    nom: "budgetConsumption",
    libelle: "Consommation budgétaire",
    unite: "pourcentage",
    portees: ["entreprise"],
    definition:
      "Montant consommé rapporté au montant alloué, par enveloppe. Calculé par le module Budget, "
      + "qui fait autorité — cette couche le NOMME, elle ne le recalcule pas.",
  },
  {
    nom: "visitFrequency",
    libelle: "Fréquence de visite",
    unite: "nombre",
    portees: ["produit"],
    definition:
      "Nombre de visites médicales où le produit a été présenté sur la période, et moyenne "
      + "mensuelle. Ne compte que les visites RATTACHÉES au produit : le texte libre "
      + "`presentedProducts` n'est pas interprété.",
    neConfondrePasAvec: "l'activité réelle des délégués — une visite non rattachée existe et n'est pas comptée ici",
  },
  {
    nom: "salesCoverage",
    libelle: "Couverture commerciale",
    unite: "pourcentage",
    portees: ["entreprise"],
    definition:
      "Part des produits ACTIFS ayant enregistré au moins une vente sur la période. "
      + "Mesure la largeur du portefeuille réellement vendu, pas son volume.",
  },
] as const;

const PAR_NOM = new Map(METRICS.map((m) => [m.nom, m]));

export function metricDef(nom: string): MetricDef | null {
  return PAR_NOM.get(nom) ?? null;
}

/**
 * LA VALEUR ET SA DÉFINITION, INSÉPARABLES.
 *
 * `null` est une réponse légitime et fréquente : la donnée manque. `pourquoi` dit alors ce qui
 * manque, parce qu'« indisponible » sans raison pousse à réessayer ou, pire, à estimer.
 */
export interface MetricValue {
  nom: string;
  libelle: string;
  valeur: number | null;
  unite: Unite;
  definition: string;
  pourquoi?: string;
  /** Ce sur quoi la valeur a été calculée — « 74 lignes de vente », « 3 affectations ». */
  base?: string;
}

export function valeurDe(nom: string, valeur: number | null, extra: { pourquoi?: string; base?: string } = {}): MetricValue {
  const def = PAR_NOM.get(nom);
  if (!def) {
    // UNE MÉTRIQUE NON DÉCLARÉE NE PASSE PAS. C'est ce qui empêche un nom inventé au fil de
    // l'eau de circuler comme s'il avait une définition.
    throw new Error(`métrique inconnue : ${nom} — la déclarer dans METRICS avant de l'utiliser`);
  }
  return {
    nom: def.nom, libelle: def.libelle, valeur,
    unite: def.unite, definition: def.definition,
    ...(extra.pourquoi ? { pourquoi: extra.pourquoi } : {}),
    ...(extra.base ? { base: extra.base } : {}),
  };
}
