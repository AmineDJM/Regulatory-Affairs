/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE REGISTRE DES SOURCES — Adam sait ENFIN ce qui existe, où, et jusqu'à quand c'est frais.
 *
 * ── LE MANQUE QU'IL COMBLE (tranche F3 de la fabric) ────────────────────────────────────
 *
 * Le savoir « quelles sources existent et comment on y cherche » vivait ÉPARS : le registre de
 * recours des missions connaît ses greniers, la liste courte d'outils classe 77 outils par
 * domaine, `investigate_event` code huit sources en dur. Aucun endroit ne répond aux questions
 * qu'un planificateur — humain ou machine — se pose AVANT de chercher :
 *
 *   · qu'est-ce que cette source CONTIENT, et pour quelles entités ?
 *   · par quels MODES se cherche-t-elle (exact, texte intégral, fuzzy, sémantique) ?
 *   · qui fait AUTORITÉ sur quoi (le Drive stocke, Regulatory fait foi sur l'avancement) ?
 *   · une ABSENCE y est-elle démontrable (compte exhaustif possible) ou seulement plausible ?
 *   · jusqu'à QUAND est-elle fraîche — temps réel, ou datée du dernier passage d'ingestion ?
 *
 * ── FRAÎCHEUR : MESURÉE OU ESTIMÉE, JAMAIS CONFONDUES (§78) ────────────────────────────
 *
 * Les tables VIVANTES (écrites par les écrans) sont fraîches par construction : « temps réel »
 * n'est pas une mesure, c'est une propriété du chemin d'écriture. Les tables DÉRIVÉES (l'index
 * de contenu du Drive) portent un retard réel : leur sonde mesure `max(updatedAt)` — c'est la
 * réponse exacte à « données synchronisées jusqu'à quand ? ». Le nombre d'éléments vient de
 * `pg_class.reltuples` : une ESTIMATION du planificateur Postgres, étiquetée comme telle
 * (`elementsEstimes`), parce qu'un COUNT(*) exact coûterait un parcours complet à chaque appel
 * pour un chiffre dont la précision n'apporte rien ici.
 *
 * ── CE QUE LE REGISTRE N'EST PAS ────────────────────────────────────────────────────────
 *
 * Pas un routeur (le triage et la liste courte routent déjà), pas un contrôle d'accès (les
 * outils gardent le leur), pas une seconde implémentation de recherche. C'est une CARTE — et
 * une carte se consulte : ses appelants réels (§14) sont l'outil `source_map` d'Adam et les
 * tests de cohérence qui vérifient que chaque capacité déclarée existe vraiment.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { prisma } from "@/lib/prisma";

export const MODES_RECHERCHE = ["EXACT", "TEXTE_INTEGRAL", "FUZZY", "SEMANTIQUE", "SQL"] as const;
export type ModeRecherche = (typeof MODES_RECHERCHE)[number];

export const ENTITES = [
  "PRODUIT", "PERSONNE", "ORGANISATION", "DOCUMENT", "DOSSIER_REGULATORY", "MARCHE",
  "CONTRAT", "FACTURE", "PAIEMENT", "COURRIER", "TACHE", "EVENEMENT", "ARTEFACT",
] as const;
export type EntiteCanonique = (typeof ENTITES)[number];

export interface Fraicheur {
  /** "TEMPS_REEL" = table vivante (écrite par les écrans) ; "INDEXEE" = dérivée, donc datée. */
  nature: "TEMPS_REEL" | "INDEXEE";
  /** Pour une source INDEXEE : l'instant du dernier élément indexé. `null` = non mesurable. */
  synchroniseeJusqua: Date | null;
  /** Estimation du nombre d'éléments (pg_class.reltuples) — une ESTIMATION, jamais un compte. */
  elementsEstimes: number | null;
}

export interface DescripteurSource {
  famille: string;
  /** Ce que la source contient, en une phrase — pour un planificateur, humain ou machine. */
  contenu: string;
  entites: readonly EntiteCanonique[];
  modes: readonly ModeRecherche[];
  /** Ce sur quoi CETTE source fait foi. Deux sources peuvent stocker ; une seule fait autorité. */
  autorite: string;
  /**
   * UNE ABSENCE Y EST-ELLE DÉMONTRABLE ? Vrai quand un compte exhaustif est possible (table
   * SQL bornée par un WHERE). Faux quand la couverture est partielle par nature — l'index de
   * contenu ne couvre que les fichiers déjà ingérés : « pas dans l'index » n'est PAS « pas
   * dans le Drive », et ce booléen est ce qui empêche un juge de confondre les deux (§36).
   */
  preuveNegative: boolean;
  /** Les capacités (outils) qui interrogent cette source — vérifiées par test de cohérence. */
  capacites: readonly string[];
  /** Les tables Prisma qui la portent — pour la sonde et pour la provenance. */
  tables: readonly string[];
}

/**
 * LES FAMILLES — alignées sur les greniers du recours de mission et les domaines de la liste
 * courte d'outils, parce que trois cartes qui découpent le monde différemment sont trois
 * cartes fausses.
 */
export const SOURCES: readonly DescripteurSource[] = [
  {
    famille: "DRIVE",
    contenu: "Les fichiers de l'entreprise : arborescence, versions, partages.",
    entites: ["DOCUMENT"],
    modes: ["EXACT", "FUZZY", "SQL"],
    autorite: "L'existence et le contenu des FICHIERS. Pas leur sens métier.",
    preuveNegative: true,
    capacites: ["search_drive", "read_document", "inspect_drive_folder"],
    tables: ["DriveNode", "FileVersion"],
  },
  {
    famille: "DRIVE_CONTENU_INDEXE",
    contenu: "Le TEXTE extrait des fichiers déjà ingérés (~20 000 caractères), classé par nature, vectorisé.",
    entites: ["DOCUMENT"],
    modes: ["TEXTE_INTEGRAL", "FUZZY", "SEMANTIQUE"],
    autorite: "Rien : c'est un INDEX dérivé. Le fichier fait foi ; l'index accélère.",
    // « Pas dans l'index » ≠ « pas dans le Drive » : l'ingestion est incrémentale et bornée.
    preuveNegative: false,
    capacites: ["find_documents"],
    tables: ["DriveTextIndex"],
  },
  {
    famille: "REGULATORY",
    contenu: "Produits (identité canonique DCI/marque), dossiers réglementaires, étapes, présoumissions.",
    entites: ["PRODUIT", "DOSSIER_REGULATORY"],
    modes: ["EXACT", "FUZZY", "SQL"],
    autorite: "L'AVANCEMENT réglementaire d'un dossier, l'identité canonique d'un produit.",
    preuveNegative: true,
    capacites: ["regulatory_portfolio", "regulatory_workload", "search_products", "product_360"],
    tables: ["RegulatoryProduct", "RegulatoryDossier"],
  },
  {
    famille: "CORPUS",
    contenu: "La base juridique et documentaire vérifiée (droit du travail, ANPP, marchés…), découpée et citable.",
    entites: ["DOCUMENT"],
    modes: ["TEXTE_INTEGRAL", "FUZZY", "SEMANTIQUE"],
    autorite: "Les TEXTES de référence versés et vérifiés. Pas le droit en général.",
    preuveNegative: false,
    capacites: ["search_knowledge_corpus", "read_corpus_document", "list_corpus_sources"],
    tables: ["KnowledgeItem", "KnowledgeChunk"],
  },
  {
    famille: "LEGAL",
    contenu: "Documents légaux, bons de commande, factures, et la chaîne devis → BC → facture → règlement.",
    entites: ["CONTRAT", "FACTURE", "ORGANISATION"],
    modes: ["EXACT", "FUZZY", "SQL"],
    autorite: "Les ENGAGEMENTS contractuels enregistrés et leurs échéances.",
    preuveNegative: true,
    capacites: ["search_everything", "inspect_record"],
    tables: ["LegalDocument"],
  },
  {
    famille: "FINANCE",
    contenu: "Paiements, règlements, ordres de dépense, trésorerie, budgets.",
    entites: ["PAIEMENT", "FACTURE"],
    modes: ["EXACT", "SQL"],
    autorite: "Ce qui a été PAYÉ, quand, à qui — et ce qui reste dû.",
    preuveNegative: true,
    capacites: ["read_finances", "finance_totals"],
    tables: ["PaymentRequest", "ExpenseOrder"],
  },
  {
    famille: "COURRIERS",
    contenu: "Le registre des courriers entrants/sortants, accusés, pièces, classement.",
    entites: ["COURRIER", "ORGANISATION"],
    modes: ["EXACT", "FUZZY", "SQL"],
    autorite: "Ce qui est OFFICIELLEMENT parti ou arrivé par courrier.",
    preuveNegative: true,
    capacites: ["search_courriers"],
    tables: ["MailEntry"],
  },
  {
    famille: "ANNUAIRE",
    contenu: "Les personnes : salariés, comptes, contacts d'entreprise, praticiens — avec provenance des coordonnées.",
    entites: ["PERSONNE", "ORGANISATION"],
    modes: ["EXACT", "FUZZY", "SQL"],
    autorite: "L'IDENTITÉ interne des personnes et leurs coordonnées vérifiées.",
    preuveNegative: true,
    capacites: ["directory_lookup", "directory_list", "search_people"],
    tables: ["User", "Employee"],
  },
  {
    famille: "TACHES",
    contenu: "Tâches, demandes administratives, décisions en attente, rappels.",
    entites: ["TACHE"],
    modes: ["EXACT", "SQL"],
    autorite: "Ce qui est À FAIRE, par qui, et ce qui attend une décision.",
    preuveNegative: true,
    capacites: ["list_pending_decisions", "list_my_tasks"],
    tables: ["Task"],
  },
  {
    famille: "ARTEFACTS",
    contenu: "Les livrables générés par Adam (rapports, classeurs, présentations), versionnés, avec leurs fichiers Drive.",
    entites: ["ARTEFACT", "DOCUMENT"],
    modes: ["EXACT", "FUZZY"],
    autorite: "Ce qu'ADAM a produit, en quelle version, et où le relire.",
    preuveNegative: true,
    capacites: ["list_artifacts", "draft_deliverable", "read_document"],
    tables: ["AssistantArtifact"],
  },
  {
    famille: "JOURNAL",
    contenu: "Le journal d'audit : qui a fait quoi, quand — la matière de « qu'est-ce qui a changé ? ».",
    entites: ["EVENEMENT", "PERSONNE"],
    modes: ["SQL"],
    autorite: "La CHRONOLOGIE des actions dans l'ERP.",
    preuveNegative: true,
    capacites: ["what_changed"],
    tables: ["AuditLog"],
  },
] as const;

/** Les tables dérivées, dont la fraîcheur se MESURE (max updatedAt) au lieu de se présumer. */
const INDEXEES: Record<string, { table: string; colonne: string }> = {
  DRIVE_CONTENU_INDEXE: { table: "DriveTextIndex", colonne: "updatedAt" },
};

/** Estimation du nombre de lignes par le planificateur Postgres — jamais présentée en compte. */
async function lignesEstimees(table: string): Promise<number | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT reltuples::bigint AS n FROM pg_class WHERE relname = $1`, table,
    );
    const n = rows[0]?.n;
    // reltuples vaut -1 sur une table jamais analysée : « pas encore estimé », pas « vide ».
    return n === undefined || n < 0 ? null : Number(n);
  } catch {
    return null;
  }
}

/**
 * LA SONDE DE FRAÎCHEUR d'une famille.
 *
 * Une table vivante est fraîche par construction du chemin d'écriture — sa sonde ne mesure que
 * la taille estimée. Une table dérivée mesure en plus l'instant du dernier élément indexé :
 * c'est LA réponse à « synchronisé jusqu'à quand ? », et elle est indexée (`updatedAt`).
 */
export async function fraicheurDe(famille: string): Promise<Fraicheur> {
  const source = SOURCES.find((s) => s.famille === famille);
  const derivee = INDEXEES[famille];
  const elementsEstimes = source?.tables[0] ? await lignesEstimees(source.tables[0]) : null;
  if (!derivee) return { nature: "TEMPS_REEL", synchroniseeJusqua: null, elementsEstimes };
  try {
    const rows = await prisma.$queryRawUnsafe<{ m: Date | null }[]>(
      `SELECT max("${derivee.colonne}") AS m FROM "${derivee.table}"`,
    );
    return { nature: "INDEXEE", synchroniseeJusqua: rows[0]?.m ?? null, elementsEstimes };
  } catch {
    return { nature: "INDEXEE", synchroniseeJusqua: null, elementsEstimes };
  }
}
