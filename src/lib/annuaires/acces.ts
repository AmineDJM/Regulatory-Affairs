/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ACCÈS PAR ANNUAIRE — une règle, écrite une fois, lue par les onglets, les pages, les
 * chargeurs, les actions et la conversation.
 *
 * Décision de la Direction (09/2026) : « dans le module Annuaires, quand je donne accès à ce
 * module à un user, je dois pouvoir lui donner des accès PAR annuaire — l'annuaire des
 * établissements à part, les partenaires, etc. »
 *
 * ── CE QUI NE CHANGE PAS ────────────────────────────────────────────────────────────────────
 *
 * Le module Annuaires reste une PORTE : chaque annuaire continue d'être ouvert par le module de
 * son référentiel (la Promotion médicale pour les praticiens et les établissements, les Moyens
 * généraux pour écrire dans les partenaires, les RH ou les Moyens généraux pour tenir les
 * personnes). Cette règle-là est recopiée ICI, une fois, et plus nulle part ailleurs.
 *
 * ── CE QUI S'AJOUTE ─────────────────────────────────────────────────────────────────────────
 *
 * Un accès PERSONNALISÉ au module Annuaires peut désormais cocher des annuaires : ils s'ouvrent
 * à la personne AVEC les gestes cochés sur cet accès (voir, créer, modifier, supprimer), et
 * sans lui donner le module du référentiel. Donner l'annuaire des établissements à l'assistante
 * de direction ne lui ouvre plus toute la Promotion médicale — c'était le seul moyen avant, et
 * c'est précisément ce que la Direction refusait de faire.
 *
 * L'accès coché est ADDITIF : il ouvre, il ne ferme rien. Un délégué qui tient la Promotion
 * médicale garde ses praticiens même si on ne lui coche que les établissements — sinon une case
 * oubliée dans la console retirerait en silence l'outil de travail de quelqu'un (§118.27).
 *
 * Un annuaire ouvert par la console s'ouvre EN ENTIER. C'est un référentiel, pas un portefeuille :
 * la portée par ligne d'un délégué (ses praticiens) est une règle du MÉTIER de la promotion
 * médicale, et quelqu'un à qui l'on ouvre l'annuaire des médecins sans être délégué n'a pas de
 * praticiens à lui — une portée « assignée » lui ouvrirait un annuaire vide, c'est-à-dire rien.
 *
 * « Autres annuaires » n'est pas accordable : c'est une page de liens vers des référentiels qui
 * vivent dans leur propre module (fournisseurs, courriers, stocks) et que ce module garde.
 *
 * Module PUR, zéro import : la console (composant client), `rbac.ts`, les pages et les actions
 * en ont besoin, et aucun n'a le droit d'importer les autres.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les annuaires qu'on peut ouvrir à quelqu'un depuis la console, dans l'ordre des onglets. */
export const ANNUAIRES_ACCORDABLES = ["MEDECINS", "PHARMACIENS", "ETABLISSEMENTS", "PARTENAIRES", "PARTENAIRES_PUBLICS", "FOURNISSEURS", "PERSONNES"] as const;
export type AnnuaireAccordable = (typeof ANNUAIRES_ACCORDABLES)[number];

export const LIBELLE_ANNUAIRE: Record<AnnuaireAccordable, string> = {
  MEDECINS: "Médecins",
  PHARMACIENS: "Pharmaciens",
  ETABLISSEMENTS: "Établissements",
  PARTENAIRES: "Partenaires",
  PARTENAIRES_PUBLICS: "Partenaires publics",
  FOURNISSEURS: "Fournisseurs Regulatory",
  PERSONNES: "Personnes",
};

/**
 * Ce que chaque annuaire ouvre déjà à TOUT LE MONDE, dit à la console — pour que cocher une case
 * ne laisse pas croire qu'on accorde une lecture que tout le monde a. « Tout le monde », c'est
 * quiconque tient l'espace de travail : mesuré, les dix-neuf rôles le tiennent — seul un accès
 * BLOQUÉ l'en prive, et la règle suit ce fait plutôt que d'ouvrir plus large (§118.16).
 */
export const LECTURE_POUR_TOUS: ReadonlySet<AnnuaireAccordable> = new Set(["PARTENAIRES", "PARTENAIRES_PUBLICS", "PERSONNES"]);

/** Les gestes qu'un annuaire connaît. VALIDATE, EXPORT, UPLOAD n'ont pas de sens ici. */
export type GesteAnnuaire = "VIEW" | "CREATE" | "UPDATE" | "DELETE";

export function estAnnuaireAccordable(v: unknown): v is AnnuaireAccordable {
  return typeof v === "string" && (ANNUAIRES_ACCORDABLES as readonly string[]).includes(v);
}

/**
 * LIRE une liste de sections venue de la base ou d'un formulaire. Une clé inconnue est
 * ÉCARTÉE, jamais interprétée : une faute de frappe ne doit pas ouvrir un annuaire au hasard.
 */
export function lireSections(brut: unknown): AnnuaireAccordable[] {
  if (!Array.isArray(brut)) return [];
  const vues = new Set<AnnuaireAccordable>();
  for (const v of brut) if (estAnnuaireAccordable(v)) vues.add(v);
  // Toujours dans l'ordre canonique : deux enregistrements du même choix se comparent égaux.
  return ANNUAIRES_ACCORDABLES.filter((c) => vues.has(c));
}

/** L'annuaire d'un praticien, par son grade — c'est ce qui le range dans un onglet ou l'autre. */
export function annuaireDuPraticien(title: string | null | undefined): "MEDECINS" | "PHARMACIENS" {
  return title === "PHARMACIEN" ? "PHARMACIENS" : "MEDECINS";
}

/** Ce que la règle a besoin de savoir d'une personne — lu par l'appelant, jamais par ce module. */
export interface FaitsAnnuaire {
  /** `userCan(module, geste)` — la lecture canonique d'un droit de module. */
  peut: (module: string, geste: GesteAnnuaire) => boolean;
  /** Les annuaires cochés sur un accès PERSONNALISÉ au module Annuaires. Vide sinon. */
  sections: ReadonlySet<string>;
  /** Tient-elle l'annuaire des personnes par son RÔLE (Super Admin, Direction) ? */
  tientPersonnesParRole: boolean;
}

/**
 * L'OUVERTURE PAR LE MODULE DU RÉFÉRENTIEL — la règle d'avant, à l'identique.
 *
 * Les personnes : l'identité vient du registre RH, l'annuaire n'y ajoute que les moyens de
 * joindre. On n'y CRÉE ni n'y SUPPRIME donc personne ; ajouter ou corriger une coordonnée est une
 * MODIFICATION de la personne.
 */
export function ouvertParModule(f: FaitsAnnuaire, cle: AnnuaireAccordable, geste: GesteAnnuaire): boolean {
  switch (cle) {
    case "MEDECINS":
    case "PHARMACIENS":
    case "ETABLISSEMENTS":
      return f.peut("MEDICAL", geste);
    case "PARTENAIRES":
    case "PARTENAIRES_PUBLICS":
      // Un carnet d'adresses : quiconque tient l'espace de travail le LIT (c'était la porte de
      // l'onglet avant cette règle) ; les Moyens généraux l'écrivent.
      return geste === "VIEW" ? f.peut("WORKSPACE", "VIEW") : f.peut("GENERAL_MEANS", geste);
    case "FOURNISSEURS":
      // LES FABRICANTS DES DOSSIERS D'ENREGISTREMENT : le Regulatory les lit et les tient. Les comptes du portail
      // externe, eux, restent au Super Admin (Administration › Fournisseurs).
      return f.peut("REGULATORY", geste);
    case "PERSONNES":
      if (geste === "VIEW") return f.peut("WORKSPACE", "VIEW");
      if (geste !== "UPDATE") return false;
      return f.tientPersonnesParRole || f.peut("GENERAL_MEANS", "UPDATE") || f.peut("RH", "UPDATE");
  }
}

/**
 * L'OUVERTURE PAR LA CONSOLE — l'annuaire coché, avec les gestes cochés sur l'accès au module
 * Annuaires. Pour les personnes, cocher « Créer » ou « Supprimer » ne fabrique pas de geste que
 * l'annuaire n'a pas : seule la modification a un sens.
 */
export function ouvertParSection(f: FaitsAnnuaire, cle: AnnuaireAccordable, geste: GesteAnnuaire): boolean {
  if (!f.sections.has(cle)) return false;
  if (cle === "PERSONNES" && geste !== "VIEW" && geste !== "UPDATE") return false;
  return f.peut("DIRECTORIES", geste);
}

/** PEUT-ELLE faire ce geste dans cet annuaire ? — l'une des deux ouvertures suffit. */
export function peutAnnuaire(f: FaitsAnnuaire, cle: AnnuaireAccordable, geste: GesteAnnuaire): boolean {
  return ouvertParModule(f, cle, geste) || ouvertParSection(f, cle, geste);
}
