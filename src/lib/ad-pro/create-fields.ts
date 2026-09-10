import type { FieldDef } from "@/components/shared/create-record-button";
import { PRIORITY, SPONSORING_TYPES, MATERIAL_TYPE_OPTIONS, CONSULTING_BILLING_OPTIONS } from "@/lib/labels";
import { wilayaOptions } from "@/lib/geo/algeria";
import { availableProductOptions, doctorOptions, specialtyOptions, type DoctorRow, type ProductRow, type SpecialtyRow } from "@/lib/ad-pro/pickers";

/**
 * LES CHAMPS DE CRÉATION AD & PRO, ÉCRITS UNE SEULE FOIS.
 *
 * Depuis que « Nouvelle demande » ouvre le formulaire SUR l'écran Ad & Pro, chaque formulaire a
 * deux points de montage : l'écran de la nature (Sponsoring, Matériel promotionnel…) et le panneau
 * commun. Deux listes de champs recopiées, c'est la garantie qu'un champ ajouté d'un côté
 * manquera de l'autre — et le demandeur ne saura pas pourquoi sa demande est incomplète selon la
 * porte d'entrée. La définition vit donc ici, et les deux écrans la lisent.
 *
 * Module PUR : aucune lecture de base, aucun composant — seulement des données de formulaire.
 * C'est ce qui lui permet d'être importé aussi bien par une page serveur que par le panneau
 * client.
 */

export interface PersonOption { id: string; name: string }
export interface DoctorOption { id: string; name: string; specialty: string; city: string }
export interface UserOption { id: string; name: string; role: string }

/** Tout ce qu'il faut au panneau commun pour dresser les formulaires des natures créables. */
export interface AdProCreateData {
  /** Médecins invitables (prises en charge) — vient de la Promotion médicale. */
  doctors: DoctorOption[];
  /** Les produits dont le traitement réglementaire est TERMINÉ — les seuls promouvables. */
  products: ProductRow[];
  /** Collaborateurs actifs : participants, responsable d'événement, assistante de direction. */
  users: UserOption[];
  /** Référents Direction Marketing nommables à la création. */
  productManagers: PersonOption[];
  /** Le référentiel des spécialités médicales (`MedicalSpecialty`). */
  specialties: SpecialtyRow[];
  /** Les libellés de spécialité HÉRITÉS des fiches médecins non rattachées — la réalité y est. */
  specialtiesHeritees: string[];
  /**
   * La gamme DÉDUITE du demandeur, quand elle se lit à coup sûr (KAM par sa fiche, superviseur
   * national par la gamme qu'il supervise). `null` ⇒ le choix reste manuel.
   */
  businessUnitDeduite: { id: string; name: string; raison: string } | null;
  /** Entités (matériel promotionnel), déjà réduites à des options. */
  companies: { value: string; label: string }[];
  /** LES GAMMES : c'est le budget Ad&Pro de l'une d'elles que la demande engage. */
  businessUnits: { id: string; name: string }[];
}

const optionsOf = (map: Record<string, string | { label: string }>): { value: string; label: string }[] =>
  Object.entries(map).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label }));

/** Ne garde que les personnes — l'appelant passe souvent la liste complète des collaborateurs. */
export function toPeople(users: readonly UserOption[]): PersonOption[] {
  return users.map((u) => ({ id: u.id, name: u.name }));
}

/**
 * Le bloc « circuit » des demandes qui peuvent partir chez Direction Marketing.
 *
 * Deux créateurs, deux situations : le National Sales nomme le RÉFÉRENT Direction Marketing qui
 * suit la gamme, la Direction CHOISIT de demander un arbitrage budgétaire ou de trancher tout de
 * suite. Un KAM ne voit rien de ce bloc : sa demande passe d'abord par son superviseur national.
 *
 * Le référent est FACULTATIF de bout en bout, et c'est ce qui compte : l'arbitrage est porté par
 * le rôle Direction Marketing tout entier. L'exiger ferait échouer une demande légitime le jour
 * où la personne qui suit la gamme est absente de la liste.
 */
function circuitFields(opts: {
  productManagers: readonly PersonOption[];
  canDesignatePM: boolean;
  canChooseAnalysis: boolean;
}): FieldDef[] {
  if (!opts.canDesignatePM || opts.productManagers.length === 0) return [];
  const choice: FieldDef[] = opts.canChooseAnalysis
    ? [{
        type: "select", name: "viaProductManager", label: "Circuit", full: true, defaultValue: "0",
        options: [
          { value: "0", label: "Décider maintenant (aucun arbitrage préalable)" },
          { value: "1", label: "Demander d'abord l'arbitrage budgétaire de Direction Marketing" },
        ],
      }]
    : [];
  return [
    {
      type: "select", name: "productManagerId", label: "Référent Direction Marketing (facultatif)",
      placeholder: "— Aucun référent nommé —", full: true,
      options: opts.productManagers.map((u) => ({ value: u.id, label: u.name })),
      hint: "La personne qui suit la gamme. L'arbitrage reste ouvert à Direction Marketing dans son ensemble.",
    },
    ...choice,
  ];
}

/**
 * LES TROIS CHAMPS QUI SE CHOISISSENT AU LIEU DE SE TAPER — produits, médecins, ville.
 *
 * Ils étaient libres, et la colonne devenait inexploitable : un produit écrit de six façons (et
 * parfois un dossier réglementaire EN COURS, dont la promotion est interdite), un médecin nommé de
 * mémoire qui ne se rapproche d'aucune fiche, une ville en huit orthographes.
 *
 * On choisit désormais dans le réel, et PLUSIEURS de chaque : une prise en charge concerne souvent
 * deux praticiens et trois produits, et n'en accepter qu'un faisait écrire le reste dans la
 * description — où rien ne le compte.
 *
 * Le repli en saisie libre reste offert quand le référentiel est vide : un menu sans option est un
 * cul-de-sac, et une demande légitime ne doit pas attendre qu'on peuple une table.
 */
/**
 * LA BUSINESS UNIT QUI PORTE LA DEMANDE — c'est SON budget Ad&Pro qui est engagé.
 *
 * Sans ce champ, la dépense pesait sur un total commercial que personne ne pouvait répartir :
 * « combien l'oncologie a-t-elle dépensé cette année ? » n'avait pas de réponse, et l'on
 * reconstituait le chiffre à la main en filtrant sur des noms de produits.
 *
 * Le choix est OBLIGATOIRE dès qu'il y a des gammes à proposer — une demande sans gamme retombe
 * dans l'indistinct, et personne ne revient la rattacher. Il DISPARAÎT quand aucune BU n'existe :
 * exiger un choix dans une liste vide n'est pas une règle, c'est une impasse.
 */
export function businessUnitField(
  businessUnits: readonly { id: string; name: string }[],
  deduite?: { id: string; name: string; raison: string } | null,
): FieldDef[] {
  // LA GAMME SE LIT SUR LA PERSONNE : un KAM par sa fiche force de vente, un superviseur
  // national par la gamme qu'il supervise. Le menu ne propose alors que CELLE-LÀ — et le
  // serveur l'impose, parce qu'un champ de formulaire se forge et qu'une gamme forgée fait
  // peser la dépense sur le budget Ad&Pro d'une autre équipe (`business-unit-auto.ts`).
  if (deduite) {
    return [{
      type: "select", name: "businessUnitId", label: "Business Unit", required: true, full: true,
      options: [{ value: deduite.id, label: deduite.name }],
      defaultValue: deduite.id,
      hint: `${deduite.raison} C'est son budget Ad&Pro qui est engagé.`,
    }];
  }
  if (businessUnits.length === 0) return [];
  return [{
    type: "select", name: "businessUnitId", label: "Business Unit", required: true, full: true,
    options: businessUnits.map((b) => ({ value: b.id, label: b.name })),
    placeholder: "— Choisir la gamme —",
    hint: "C'est son budget Ad&Pro qui est engagé — et c'est par elle que la dépense se lit dans Budgets.",
  }];
}

function referentielFields(opts: { products: readonly ProductRow[]; doctors: readonly DoctorRow[] }): FieldDef[] {
  const produits = availableProductOptions(opts.products);
  const medecins = doctorOptions(opts.doctors);
  return [
    medecins.length > 0
      ? {
          type: "multiselect", name: "doctorIds", label: "Médecin(s) concerné(s)", required: true, full: true,
          options: medecins, searchPlaceholder: "Chercher un médecin de l'annuaire…",
          emptyLabel: "Aucun médecin dans l'annuaire.",
          hint: "Depuis l'annuaire des praticiens. Plusieurs choix possibles.",
        }
      : { type: "text", name: "doctor", label: "Médecin concerné", required: true, full: true, hint: "L'annuaire des praticiens est vide : saisissez le nom." },
    produits.length > 0
      ? {
          type: "multiselect", name: "productIds", label: "Produit(s) concerné(s)", required: true, full: true,
          options: produits, searchPlaceholder: "Chercher un produit…",
          emptyLabel: "Aucun produit au traitement terminé.",
          hint: "Seuls les produits dont le traitement réglementaire est TERMINÉ — les seuls qu'on ait le droit de promouvoir.",
        }
      : { type: "text", name: "product", label: "Produit concerné", required: true, full: true, hint: "Aucun dossier réglementaire n'est encore au traitement terminé." },
    {
      type: "select", name: "city", label: "Ville (wilaya)", required: true,
      options: wilayaOptions(), placeholder: "— Choisir la wilaya —",
    },
  ];
}

export function sponsoringCreateFields(opts: {
  productManagers: readonly PersonOption[];
  canDesignatePM: boolean;
  canChooseAnalysis: boolean;
  products?: readonly ProductRow[];
  doctors?: readonly DoctorRow[];
  businessUnits?: readonly { id: string; name: string }[];
  /** La gamme déduite du demandeur — le menu ne propose alors que celle-là. */
  businessUnitDeduite?: { id: string; name: string; raison: string } | null;
  /** Le référentiel des spécialités médicales (`MedicalSpecialty`) + les libellés hérités des fiches. */
  specialties?: readonly SpecialtyRow[];
  specialtiesHeritees?: readonly (string | null | undefined)[];
}): FieldDef[] {
  return [
    ...businessUnitField(opts.businessUnits ?? [], opts.businessUnitDeduite ?? null),
    ...circuitFields(opts),
    { type: "text", name: "institution", label: "Institution / Association", required: true },
    // LA DEMANDE DU MÉDECIN — pièce OBLIGATOIRE, et scannée.
    //
    // C'est le document que tout le circuit lit : le National Sales pour juger l'opportunité,
    // Direction Marketing pour arbitrer le budget. Une demande sans elle faisait un aller-retour
    // par la messagerie à chaque fois. Les formats sont bornés à ceux d'un scan ou d'un courrier
    // (PDF, Word) — le serveur revérifie, un `accept` ne fait que guider le sélecteur.
    {
      type: "file", name: "files", label: "Demande(s) du médecin (scan PDF ou Word)",
      required: true, multiple: true, full: true, accept: ".pdf,.doc,.docx",
      hint: "Courrier ou demande du praticien, SCANNÉ (PDF ou Word). Plusieurs fichiers possibles. "
        + "+ Document original obligatoirement au bureau du secrétariat.",
    },
    ...referentielFields({ products: opts.products ?? [], doctors: opts.doctors ?? [] }),
    ...specialtyField(opts.specialties ?? [], opts.specialtiesHeritees ?? []),
    // TYPE ET IMPORTANCE : un choix EXPLICITE, plus une valeur par défaut.
    //
    // Ils avaient tous deux une valeur pré-remplie (« Congrès », « Moyenne ») : une demande
    // envoyée sans y toucher sortait donc avec une nature et une priorité que personne n'avait
    // décidées, et c'est sur elles que l'arbitrage se fait.
    {
      type: "select", name: "type", label: "Type", required: true,
      options: SPONSORING_TYPES.map((t) => ({ value: t, label: t })),
      placeholder: "— Choisir le type —",
    },
    { type: "number", name: "amountRequested", label: "Budget demandé par l'intéressé (DZD)", required: true },
    { type: "number", name: "amountProposed", label: "Budget suggéré par le délégué (DZD)", required: true },
    {
      type: "select", name: "strategicImportance", label: "Importance stratégique", required: true,
      options: optionsOf(PRIORITY), placeholder: "— Choisir l'importance —",
    },
    { type: "textarea", name: "description", label: "Description de la demande" },
    { type: "textarea", name: "comments", label: "Appréciation personnelle / recommandation" },
  ];
}

/**
 * LA SPÉCIALITÉ EN MENU DÉROULANT — et un repli quand le référentiel est muet.
 *
 * Le champ était libre : « Cardio », « cardiologie », « CARDIOLOGIE » faisaient trois lignes
 * dans un regroupement qui devrait en faire une. La liste vient du référentiel `MedicalSpecialty`
 * fusionné aux libellés hérités des fiches médecins (`pickers.ts`) — jamais d'une liste écrite à
 * la main, fausse le jour où quelqu'un en ajoute une (§118.73).
 *
 * Référentiel ET fiches vides : la saisie redevient LIBRE, obligatoire mais libre. Un menu sans
 * option est un cul-de-sac, et une demande légitime ne doit pas attendre qu'on peuple une table.
 */
function specialtyField(
  referentiel: readonly SpecialtyRow[],
  heritees: readonly (string | null | undefined)[],
): FieldDef[] {
  const options = specialtyOptions(referentiel, heritees);
  if (options.length === 0) {
    return [{
      type: "text", name: "specialty", label: "Spécialité", required: true,
      hint: "Le référentiel des spécialités est vide : saisissez-la.",
    }];
  }
  return [{
    type: "select", name: "specialty", label: "Spécialité", required: true,
    options, placeholder: "— Choisir la spécialité —",
  }];
}

export function promoMaterialCreateFields(opts: {
  companies: readonly { value: string; label: string }[];
  assistants: readonly PersonOption[];
  businessUnits?: readonly { id: string; name: string }[];
}): FieldDef[] {
  return [
    ...businessUnitField(opts.businessUnits ?? []),
    { type: "text", name: "title", label: "Campagne / matériel", required: true, full: true, placeholder: "Ex. Brochure Cardiomax 2026" },
    { type: "select", name: "materialType", label: "Type de matériel", options: MATERIAL_TYPE_OPTIONS, placeholder: "— Type de matériel —" },
    { type: "select", name: "companyId", label: "Entité", options: [...opts.companies], placeholder: "— Entité —" },
    { type: "textarea", name: "description", label: "Brief / description", full: true },
    { type: "number", name: "amount", label: "Budget estimé (DZD)" },
    { type: "select", name: "assistantId", label: "Assistante de direction", options: opts.assistants.map((a) => ({ value: a.id, label: a.name })), placeholder: "— À notifier (Direction) —" },
    // Le cas le plus fréquent : on a appelé l'imprimeur AVANT d'ouvrir l'ERP. Cocher saute la
    // demande de devis — le circuit démarre directement sur la validation du devis en main.
    { type: "checkbox", name: "hasQuote", label: "J'ai déjà un devis en main (saute la demande de devis)", full: true },
  ];
}

/**
 * LE CONTRAT DE CONSULTING — deux parties, une période, une rémunération, des tâches.
 *
 * Le montant ne se comprend qu'avec son RYTHME : 200 000 DZD par mois et 200 000 DZD pour la
 * mission entière n'engagent pas la même somme, et c'est exactement la confusion qui coûte cher
 * au moment de la facture. Les deux champs se suivent donc, jamais séparés.
 *
 * Les tâches se saisissent une par ligne — c'est ainsi qu'on les dicte. Un formulaire qui
 * demanderait de les ajouter une par une aurait tout l'air d'une corvée, et l'on écrirait tout
 * dans le champ « objet ».
 */
export function consultingCreateFields(opts: {
  companies: readonly { value: string; label: string }[];
  businessUnits?: readonly { id: string; name: string }[];
}): FieldDef[] {
  return [
    ...businessUnitField(opts.businessUnits ?? []),
    { type: "text", name: "title", label: "Intitulé du contrat", required: true, full: true, placeholder: "Ex. Accompagnement réglementaire 2026" },
    { type: "text", name: "counterparty", label: "Consultant / cabinet", required: true, placeholder: "L'autre partie au contrat" },
    { type: "text", name: "counterpartyContact", label: "Contact (e-mail, téléphone)" },
    { type: "select", name: "companyId", label: "Entité signataire", options: [...opts.companies], placeholder: "— Entité —" },
    { type: "date", name: "startDate", label: "Début" },
    { type: "date", name: "endDate", label: "Fin" },
    { type: "number", name: "amount", label: "Rémunération (DZD)" },
    { type: "select", name: "billing", label: "Rythme de la rémunération", options: CONSULTING_BILLING_OPTIONS, defaultValue: "ONE_OFF" },
    { type: "textarea", name: "scope", label: "Objet de la mission", full: true, placeholder: "Ce pour quoi on paie." },
    // Le contrat signé, les CV, une proposition commerciale : ils existent AU MOMENT où l'on
    // saisit le contrat. Renvoyer leur dépôt « à l'écran suivant », c'est les voir manquer une
    // fois sur deux.
    { type: "file", name: "files", label: "Pièces jointes", multiple: true, full: true, hint: "Contrat signé, proposition, CV, tout type de fichier." },
    { type: "textarea", name: "tasks", label: "Tâches attendues (une par ligne)", full: true, placeholder: "Audit des dossiers\nFormation de l'équipe\nRapport final" },
    { type: "textarea", name: "paymentTerms", label: "Modalités de paiement", full: true },
    { type: "textarea", name: "notes", label: "Notes internes", full: true },
  ];
}

/**
 * LA DEMANDE « AUTRE » — volontairement courte.
 *
 * Elle n'a pas de champs propres, par définition : c'est la DESCRIPTION qui portera tout, puisque
 * aucun formulaire ne décrit pour nous ce dont il s'agit. Elle est donc obligatoire — une case
 * vide ne se tranche pas.
 */
export function adProOtherCreateFields(opts: {
  companies: readonly { value: string; label: string }[];
  businessUnits?: readonly { id: string; name: string }[];
}): FieldDef[] {
  return [
    ...businessUnitField(opts.businessUnits ?? []),
    { type: "text", name: "title", label: "Objet de la demande", required: true, full: true, placeholder: "En une phrase" },
    { type: "textarea", name: "description", label: "Description", required: true, full: true, placeholder: "Ce que vous demandez, pour qui, et pourquoi." },
    { type: "text", name: "beneficiary", label: "Pour qui / avec qui" },
    { type: "number", name: "amount", label: "Montant estimé (DZD)" },
    { type: "select", name: "companyId", label: "Entité", options: [...opts.companies], placeholder: "— Entité —" },
  ];
}
