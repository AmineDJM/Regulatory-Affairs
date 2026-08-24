import type { FieldDef } from "@/components/shared/create-record-button";
import { PRIORITY, SPONSORING_TYPES, MATERIAL_TYPE_OPTIONS, CONSULTING_BILLING_OPTIONS } from "@/lib/labels";

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
  /** Collaborateurs actifs : participants, responsable d'événement, assistante de direction. */
  users: UserOption[];
  /** Chefs de produit désignables pour l'analyse. */
  productManagers: PersonOption[];
  /** Entités (matériel promotionnel), déjà réduites à des options. */
  companies: { value: string; label: string }[];
}

const optionsOf = (map: Record<string, string | { label: string }>): { value: string; label: string }[] =>
  Object.entries(map).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label }));

/** Ne garde que les personnes — l'appelant passe souvent la liste complète des collaborateurs. */
export function toPeople(users: readonly UserOption[]): PersonOption[] {
  return users.map((u) => ({ id: u.id, name: u.name }));
}

/**
 * Le bloc « circuit » commun aux demandes qui peuvent partir en analyse.
 *
 * Deux créateurs, deux situations : le National Sales DÉSIGNE le chef de produit (c'est son étape,
 * il la remplace), la Direction CHOISIT de demander un avis ou de trancher tout de suite. Un
 * délégué, lui, ne voit rien de ce bloc : sa demande suit le circuit ordinaire.
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
          { value: "0", label: "Décider maintenant (aucune analyse préalable)" },
          { value: "1", label: "Demander d'abord l'avis d'un chef de produit" },
        ],
      }]
    : [];
  return [
    ...choice,
    {
      type: "select", name: "productManagerId",
      label: opts.canChooseAnalysis ? "Chef de produit (si analyse demandée)" : "Chef de produit (analyse)",
      // Quand le circuit est un choix, la désignation ne peut pas être obligatoire : celui qui
      // tranche tout de suite n'a personne à désigner.
      required: !opts.canChooseAnalysis,
      placeholder: "— Sélectionner le chef de produit —", full: true,
      options: opts.productManagers.map((u) => ({ value: u.id, label: u.name })),
    },
  ];
}

export function sponsoringCreateFields(opts: {
  productManagers: readonly PersonOption[];
  canDesignatePM: boolean;
  canChooseAnalysis: boolean;
}): FieldDef[] {
  return [
    ...circuitFields(opts),
    { type: "text", name: "institution", label: "Institution / Association", required: true },
    { type: "file", name: "files", label: "Demande(s) du médecin", multiple: true, full: true, hint: "Courrier, invitation, programme… Plusieurs fichiers possibles." },
    { type: "text", name: "doctor", label: "Médecin concerné" },
    { type: "text", name: "specialty", label: "Spécialité" },
    { type: "text", name: "city", label: "Ville" },
    { type: "select", name: "type", label: "Type", options: SPONSORING_TYPES.map((t) => ({ value: t, label: t })), defaultValue: "Congrès" },
    { type: "text", name: "product", label: "Produit concerné" },
    { type: "number", name: "amountRequested", label: "Budget demandé par l'intéressé (DZD)" },
    { type: "number", name: "amountProposed", label: "Budget suggéré par le délégué (DZD)" },
    { type: "select", name: "strategicImportance", label: "Importance stratégique", options: optionsOf(PRIORITY), defaultValue: "MEDIUM" },
    { type: "textarea", name: "description", label: "Description de la demande" },
    { type: "textarea", name: "comments", label: "Appréciation personnelle / recommandation" },
  ];
}

export function promoMaterialCreateFields(opts: {
  companies: readonly { value: string; label: string }[];
  assistants: readonly PersonOption[];
}): FieldDef[] {
  return [
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
}): FieldDef[] {
  return [
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
}): FieldDef[] {
  return [
    { type: "text", name: "title", label: "Objet de la demande", required: true, full: true, placeholder: "En une phrase" },
    { type: "textarea", name: "description", label: "Description", required: true, full: true, placeholder: "Ce que vous demandez, pour qui, et pourquoi." },
    { type: "text", name: "beneficiary", label: "Pour qui / avec qui" },
    { type: "number", name: "amount", label: "Montant estimé (DZD)" },
    { type: "select", name: "companyId", label: "Entité", options: [...opts.companies], placeholder: "— Entité —" },
  ];
}
