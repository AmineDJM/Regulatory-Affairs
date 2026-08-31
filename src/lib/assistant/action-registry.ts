import type { CurrentUser } from "@/lib/session";
import { buildIndex, resolve, type ResolverContext } from "./nl/resolver";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { canSetStructural } from "@/lib/regulatory/structural-fields";
import { OPS_CATALOG, catalogCoveredKeys } from "@/lib/assistant/ops/catalog";

/**
 * ERP ACTION REGISTRY — le Chief of Staff est le PLAN DE CONTRÔLE en langage naturel de l'ERP.
 *
 * Trois pièces, un principe (« pour chaque bouton métier auquel la personne a droit, le Chief
 * sait invoquer LA MÊME action serveur ») :
 *
 *   1. `ERP_ACTIONS` — les actions natives que le Chief sait déjà PROPOSER : id stable, libellé
 *      du bouton à l'écran, ALIAS en langage naturel, outil du Chief, risque, porte. C'est ce
 *      qui permet de résoudre « demande l'actualisation des soldes » vers le bouton Finances
 *      réel — au lieu de fabriquer une demande administrative générique plus faible.
 *   2. `matchNativeAction(question)` — la résolution intention → action native (repli des
 *      accents, singulier/pluriel, containment de TOUS les jetons d'un alias). Injectée dans le
 *      plan de la question : PRIORITÉ AU NATIF, les replis (tâche, demande générique, message)
 *      ne viennent qu'ensuite.
 *   3. `ACTION_CLASSIFICATION` — l'INVENTAIRE EXHAUSTIF : chaque `export async function` de
 *      `src/lib/actions/` est classée NATIVE (le Chief exécute cette action même), COVERED (le
 *      Chief obtient le même résultat métier par un outil équivalent), GAP (trou de capacité
 *      RECONNU, à combler), ou EXCLUDED (hors sujet pour un assistant, raison donnée).
 *      Le test `action-parity.test.ts` échoue dès qu'une action serveur existe sans
 *      classification — un bouton ajouté à l'ERP ne peut plus devenir un trou silencieux.
 *
 * Module PUR (pas de Prisma) : importable par le planner, testable sans base. Les portes ici
 * sont un PRÉ-FILTRE de découverte — chaque action canonique revérifie les droits à l'exécution.
 */

export type ActionRisk = "NORMAL" | "SENSITIVE" | "CRITICAL";

export interface NativeAction {
  /** Id stable de l'action ERP (indépendant du nom d'outil). */
  id: string;
  /** Module d'écran, en français (« Finances », « Regulatory »…). */
  module: string;
  /** Le libellé du bouton / geste tel qu'il s'affiche à l'écran. */
  uiLabel: string;
  /** L'outil du Chief qui PROPOSE cette action (confirmation obligatoire ensuite). */
  toolName: string;
  /** Outil de DOMAINE : la valeur du champ `op` à passer (ex. `drive_operation` op `move`). */
  toolOp?: string;
  /** Formulations naturelles (français) qui désignent cette action. */
  aliases: string[];
  risk: ActionRisk;
  /** Ce que l'action fait, qui est touché, réversibilité — la sémantique, pas le mécanisme. */
  summary: string;
  /** LA MÊME PORTE QUE L'ÉCRAN (pré-filtre synchrone ; l'exécution revérifie toujours). */
  gate: (user: CurrentUser) => boolean;
  /** Ouverture supplémentaire que le pré-filtre synchrone ne sait pas vérifier (réglages DB). */
  gateNote?: string;
}

const isSA = (u: CurrentUser) => u.role === "SUPER_ADMIN";

const CORE_ERP_ACTIONS: NativeAction[] = [
  {
    id: "FINANCE_REQUEST_BALANCE_REFRESH",
    module: "Finances",
    uiLabel: "Demander l'actualisation des soldes",
    toolName: "request_treasury_update",
    aliases: [
      "actualisation des soldes", "actualisation du solde", "actualiser les soldes",
      "rafraîchir les soldes", "soldes bancaires à jour", "solde du compte bancaire",
      "mise à jour du solde de trésorerie", "mise à jour des soldes", "demander les soldes",
      "actualise la trésorerie",
    ],
    risk: "NORMAL",
    summary: "Notifie les responsables Finances (et le Super Admin) qu'une mise à jour des soldes de trésorerie est attendue — relance traçable, les montants ne sont PAS modifiés.",
    gate: (u) => isSA(u) || hasGlobalView(u),
  },
  {
    id: "REGULATORY_UPDATE_FIELD",
    module: "Regulatory",
    uiLabel: "Modifier un champ du dossier (statut, priorité, dates, partenaire…)",
    toolName: "update_regulatory_product",
    aliases: [
      "modifier le dossier reglementaire", "changer le statut du dossier", "niveau de process",
      "changer la priorité du dossier", "date cible de soumission", "verrouiller le dossier",
    ],
    risk: "NORMAL",
    summary: "Change UN champ d'un dossier Regulatory (statut/niveau de process, priorité, dates cibles, partenaire, verrou…). Réversible en remodifiant le champ ; audité champ par champ.",
    gate: (u) => userCan(u, "REGULATORY", "UPDATE"),
  },
  {
    id: "REGULATORY_ASSIGN_RESPONSIBLE",
    module: "Regulatory",
    uiLabel: "Chargé du dossier (menu déroulant)",
    toolName: "assign_regulatory_responsible",
    aliases: ["confier le dossier", "chargé du dossier", "assigner le dossier à", "réassigner le dossier", "retirer le chargé du dossier"],
    risk: "NORMAL",
    summary: "Désigne (ou retire) la personne CHARGÉE d'un dossier — la personne est notifiée, c'est un engagement pris en son nom. Réversible en réassignant.",
    gate: (u) => canSetStructural(u),
  },
  {
    id: "REGULATORY_SET_STEP",
    module: "Regulatory",
    uiLabel: "Étapes ANPP (statut d'étape / avis de présoumission)",
    toolName: "set_regulatory_step",
    aliases: ["étape anpp", "avis de présoumission", "marquer l'étape", "présoumission favorable", "statut de l'étape"],
    risk: "NORMAL",
    summary: "Met à jour UNE étape du circuit ANPP (ou l'avis de présoumission, qui dérive le statut du dossier). Réversible étape par étape ; audité.",
    gate: (u) => userCan(u, "REGULATORY", "UPDATE"),
  },
  {
    id: "REGULATORY_REQUEST_STATUS_UPDATE",
    module: "Regulatory",
    uiLabel: "Demander une mise à jour de statut",
    toolName: "request_regulatory_status_update",
    aliases: ["mise à jour de statut", "relance le dossier", "demande une mise à jour du dossier", "relance de mise à jour"],
    risk: "NORMAL",
    summary: "Relance traçable : le responsable, l'assistant et les participants du dossier sont notifiés avec un lien vers la fiche — le statut n'est pas modifié.",
    gate: isSA,
    gateNote: "aussi ouvert aux rôles superviseurs Regulatory configurés en Administration",
  },
  {
    id: "RECORD_DELETE",
    module: "Administration (toutes fiches)",
    uiLabel: "Supprimer définitivement (bouton rouge des fiches)",
    toolName: "delete_record",
    aliases: ["supprimer définitivement", "supprime le dossier", "supprimer l'enregistrement", "supprime cet employé", "supprime ce courrier", "supprime l'événement"],
    risk: "CRITICAL",
    summary: "Retire l'élément (25 types), ses pièces jointes et ses commentaires de tous les écrans ; instantané déposé en corbeille, RESTAURABLE par le Super Admin. Cascade non restaurable.",
    gate: isSA,
  },
  {
    id: "RECORD_RESTORE",
    module: "Administration → Corbeille",
    uiLabel: "Restaurer",
    toolName: "restore_record",
    aliases: ["restaurer depuis la corbeille", "restaure le dossier supprimé", "récupérer l'élément supprimé", "annule la suppression"],
    risk: "NORMAL",
    summary: "Recrée l'élément supprimé à l'identique (mêmes id/référence) avec pièces et commentaires. Les enfants perdus en cascade ne reviennent pas.",
    gate: isSA,
  },
  {
    id: "RECORD_PURGE",
    module: "Administration → Corbeille",
    uiLabel: "Détruire",
    toolName: "purge_record",
    aliases: ["détruire définitivement", "vider de la corbeille", "destruction réelle", "purger la corbeille"],
    risk: "CRITICAL",
    summary: "Destruction RÉELLE d'une entrée de corbeille : les fichiers stockés sont effacés, AUCUN retour possible.",
    gate: isSA,
  },
  {
    id: "ACCOUNT_SET_ACTIVE",
    module: "Administration",
    uiLabel: "Activer / Désactiver le compte",
    toolName: "set_account_active",
    aliases: ["désactiver le compte", "réactiver le compte", "bloquer le compte de", "coupe l'accès de", "réactive l'accès de"],
    risk: "SENSITIVE",
    summary: "Un compte désactivé ne peut plus se connecter (réversible à tout moment). Jamais sur son propre compte.",
    gate: isSA,
  },
  {
    id: "ACCOUNT_SET_ROLE",
    module: "Administration",
    uiLabel: "Rôle du compte / Autre rôle",
    toolName: "set_account_role",
    aliases: ["changer le rôle de", "donne le rôle", "rôle secondaire", "autre rôle de", "promouvoir le compte"],
    risk: "SENSITIVE",
    summary: "Change le rôle principal (et/ou l'« autre rôle » cumulé) d'un compte — les droits changent immédiatement. Le secondaire ne peut jamais être Super Admin.",
    gate: isSA,
  },
  {
    id: "PLATFORM_SETTING_UPDATE",
    module: "Administration → Réglages",
    uiLabel: "Réglages de la plateforme",
    toolName: "update_platform_setting",
    aliases: ["réglage de la plateforme", "masquer le module", "modules masqués", "quota du drive", "arrêt d'urgence de l'ia", "rôles superviseurs"],
    risk: "SENSITIVE",
    summary: "Modifie un réglage global (limites d'upload, quotas Drive, budget, rôles d'accès, modules masqués, arrêt d'urgence IA…). Les listes REMPLACENT la valeur existante.",
    gate: isSA,
  },
  {
    id: "NOTIFICATION_BROADCAST",
    module: "Administration",
    uiLabel: "Diffuser une notification / annonce pop-up",
    toolName: "create_notification",
    aliases: ["diffuser une notification", "annonce à tous", "envoie une notification à tout le monde", "annonce pop-up", "préviens tout le monde"],
    risk: "NORMAL",
    summary: "Notification (cloche + push) à tous, à un rôle, ou à des personnes précises — ou annonce pop-up plein écran avec accusé « J'ai compris ».",
    gate: isSA,
  },
  {
    id: "PRODUCTS_SET_COMPANY",
    module: "Regulatory / Administration",
    uiLabel: "Rattacher les produits à une entité",
    toolName: "set_products_company",
    aliases: ["rattacher les produits à", "entité des produits", "rattache les dossiers à la société"],
    risk: "NORMAL",
    summary: "Rattache un LOT de produits Regulatory (décrit par un filtre relu à l'exécution) à une entité du groupe.",
    gate: (u) => userCan(u, "REGULATORY", "UPDATE"),
  },
  {
    id: "TASK_CREATE_OR_REQUEST",
    module: "Espace de travail",
    uiLabel: "Créer une tâche / Demander une tâche",
    toolName: "create_task",
    aliases: ["crée une tâche", "demande une tâche", "planifie une tâche", "tâche pour"],
    risk: "NORMAL",
    summary: "Pour soi : to-do. Pour un collègue : DEMANDE DE TÂCHE (pop-up, accepter/refuser, fil d'échange) — le même circuit que l'écran. Se planifie (échéance, priorité).",
    gate: (u) => userCan(u, "WORKSPACE", "CREATE"),
  },
  {
    id: "TASK_UPDATE",
    module: "Espace de travail",
    uiLabel: "Modifier une tâche (statut, échéance, réassignation)",
    toolName: "update_task",
    aliases: ["termine la tâche", "clôture la tâche", "repousse l'échéance de la tâche", "réassigne la tâche"],
    risk: "NORMAL",
    summary: "Change le statut, l'échéance, la priorité ou l'assignation d'une tâche existante.",
    gate: (u) => userCan(u, "WORKSPACE", "UPDATE"),
  },
  {
    id: "ADMIN_REQUEST_CREATE",
    module: "Demandes",
    uiLabel: "Nouvelle demande administrative",
    toolName: "create_admin_request",
    aliases: ["demande administrative", "demande de billet", "demande de signature", "demande d'achat", "mission chauffeur"],
    risk: "NORMAL",
    summary: "Ouvre une demande administrative typée (déplacement, courrier, signature, achat, devis, paiement, chauffeur, visa, RH simple…) — DERNIER RECOURS quand aucune action de module plus précise n'existe.",
    gate: (u) => userCan(u, "ADMIN_REQUESTS", "CREATE"),
  },
  {
    id: "ADMIN_REQUEST_UPDATE",
    module: "Demandes",
    uiLabel: "Statut / assignation / commentaire d'une demande",
    toolName: "update_request",
    aliases: ["assigne la demande", "statut de la demande", "commente la demande", "clôture la demande"],
    risk: "NORMAL",
    summary: "Fait avancer une demande administrative existante : statut, personne chargée, commentaire — par les actions canoniques de l'écran.",
    gate: (u) => userCan(u, "ADMIN_REQUESTS", "UPDATE"),
  },
  {
    id: "MESSAGE_SEND",
    module: "Messagerie",
    uiLabel: "Envoyer un message",
    toolName: "send_message",
    aliases: ["envoie un message à", "écris un message à", "préviens par message"],
    risk: "NORMAL",
    summary: "Message direct interne (la conversation est créée au besoin). Pour DEMANDER un travail, préférer la demande de tâche.",
    gate: () => true,
  },
  {
    id: "EMAIL_SEND",
    module: "Courrier (e-mail)",
    uiLabel: "Envoyer un e-mail",
    toolName: "send_email",
    aliases: ["envoie un e-mail", "envoie un mail à", "réponds au mail"],
    risk: "NORMAL",
    summary: "E-mail depuis la boîte connectée de l'utilisateur (jamais celle d'un autre).",
    gate: () => true,
  },
  {
    id: "CALENDAR_EVENT_CREATE",
    module: "Agenda",
    uiLabel: "Planifier un rendez-vous",
    toolName: "create_calendar_event",
    aliases: ["planifie un rendez-vous", "ajoute à l'agenda", "cale une réunion", "programme un rendez-vous"],
    risk: "NORMAL",
    summary: "Crée un événement d'agenda pour l'utilisateur (heure d'Alger), avec invités éventuels.",
    gate: () => true,
  },
  {
    id: "CALENDAR_EVENT_UPDATE",
    module: "Agenda",
    uiLabel: "Déplacer / annuler un rendez-vous",
    toolName: "update_calendar_event",
    aliases: ["déplace le rendez-vous", "annule le rendez-vous", "décale la réunion"],
    risk: "NORMAL",
    summary: "Déplace ou annule un événement d'agenda existant — par les actions canoniques (invités prévenus).",
    gate: () => true,
  },
  {
    id: "DOSSIER_CREATE",
    module: "Projets",
    uiLabel: "Ouvrir un projet",
    toolName: "create_dossier",
    aliases: ["ouvre un projet", "crée un dossier projet", "nouveau projet"],
    risk: "NORMAL",
    summary: "Ouvre un projet (référence, responsable, échéance) par le même cœur que l'écran.",
    gate: (u) => userCan(u, "DOSSIERS", "CREATE"),
  },
  {
    id: "HR_REQUEST_CREATE",
    module: "RH",
    uiLabel: "Demande RH (attestation, congé, note de frais…)",
    toolName: "create_hr_request",
    aliases: ["demande d'attestation", "demande de congé", "note de frais", "demande rh"],
    risk: "NORMAL",
    summary: "Ouvre une demande RH pour l'utilisateur — elle suit ensuite le circuit RH normal.",
    gate: () => true,
  },
  {
    id: "SPONSORING_CREATE",
    module: "Sponsoring",
    uiLabel: "Nouvelle demande de sponsoring / congrès",
    toolName: "create_sponsoring_request",
    aliases: ["demande de sponsoring", "sponsoriser", "prise en charge congrès"],
    risk: "NORMAL",
    summary: "Ouvre une demande de sponsoring par l'action canonique — le circuit de validation habituel s'applique.",
    gate: () => true,
  },
  {
    id: "EVENT_CREATE",
    module: "Événements",
    uiLabel: "Créer un événement",
    toolName: "create_event_request",
    aliases: ["crée un événement", "organise un événement", "nouvel événement"],
    risk: "NORMAL",
    summary: "Crée un événement par l'action canonique (circuit de validation selon l'origine).",
    gate: () => true,
  },
  {
    id: "PROMO_MATERIAL_CREATE",
    module: "Matériel promotionnel",
    uiLabel: "Nouveau dossier de matériel promotionnel",
    toolName: "create_promo_material_request",
    aliases: ["matériel promotionnel", "dossier promo", "brochure à produire"],
    risk: "NORMAL",
    summary: "Ouvre un dossier de matériel promotionnel par l'action canonique (circuit devis → BAT → paiement).",
    gate: () => true,
  },
  {
    id: "CONGRESS_REQUEST_CREATE",
    module: "Prises en charge",
    uiLabel: "Nouvelle demande de congrès (national / international)",
    toolName: "create_congress_request",
    aliases: ["congrès international", "congrès national", "prise en charge de congrès"],
    risk: "NORMAL",
    summary: "Ouvre une demande de prise en charge de congrès — le circuit de décision habituel s'applique.",
    gate: () => true,
  },
  {
    id: "PAYMENT_DECIDE",
    module: "Centre de paiement",
    uiLabel: "Autoriser / refuser un paiement",
    toolName: "decide_payment",
    aliases: ["autorise le paiement", "refuse le paiement", "valide le règlement", "décide le paiement"],
    risk: "SENSITIVE",
    summary: "Décision du Centre de paiement sur un règlement en attente — par l'action canonique (audit, notifications).",
    gate: (u) => isSA(u) || hasGlobalView(u),
    gateNote: "selon le circuit d'autorisation du Centre de paiement",
  },
  {
    id: "LEGAL_CREATE",
    module: "Legal",
    uiLabel: "Nouveau document légal",
    toolName: "create_legal_document",
    aliases: ["document légal", "enregistre le contrat", "nouveau contrat légal"],
    risk: "NORMAL",
    summary: "Enregistre un document légal (échéances, renouvellement, lecteurs) par l'action canonique.",
    gate: (u) => userCan(u, "LEGAL", "CREATE"),
  },
  {
    id: "LEGAL_UPDATE",
    module: "Legal",
    uiLabel: "Modifier un document légal",
    toolName: "update_legal_document",
    aliases: ["modifie le document légal", "renouvelle le contrat", "annule le document légal"],
    risk: "NORMAL",
    summary: "Met à jour un document légal existant par l'action canonique.",
    gate: (u) => userCan(u, "LEGAL", "UPDATE"),
  },
  {
    id: "HOSPITAL_CREATE",
    module: "Médical",
    uiLabel: "Ajouter un établissement",
    toolName: "create_hospital",
    aliases: ["ajoute un hôpital", "nouvel établissement", "crée l'établissement"],
    risk: "NORMAL",
    summary: "Ajoute un établissement de santé à l'annuaire (action canonique).",
    gate: (u) => userCan(u, "MEDICAL", "CREATE"),
  },
  {
    id: "HOSPITAL_UPDATE",
    module: "Médical",
    uiLabel: "Modifier un établissement",
    toolName: "update_hospital",
    aliases: ["modifie l'hôpital", "corrige l'établissement", "désactive l'établissement"],
    risk: "NORMAL",
    summary: "Met à jour un établissement de santé (action canonique).",
    gate: (u) => userCan(u, "MEDICAL", "UPDATE"),
  },
  {
    id: "WORKFLOW_CONFIGURE",
    module: "Administration → Circuits",
    uiLabel: "Builder des circuits de validation Ad&Pro",
    toolName: "configure_workflow",
    aliases: [
      "circuit de validation", "modifie le circuit", "ajoute une étape au circuit",
      "retire une étape du circuit", "réordonne le circuit", "réinitialise le circuit",
      "change les validateurs du circuit",
    ],
    risk: "SENSITIVE",
    summary: "Reconfigure un circuit de validation Ad&Pro (Sponsoring, Prises en charge, Événements) : étapes, qui agit, pouvoirs, automatismes — remplacement intégral validé par l'action ; les demandes en cours gardent leur étape par slug. Les autres circuits de l'ERP sont codés en dur.",
    gate: isSA,
  },
  {
    id: "WORKFLOW_ADVANCE",
    module: "Circuits Ad&Pro",
    uiLabel: "Approuver / Refuser / Sauter l'étape courante",
    toolName: "advance_workflow",
    aliases: [
      "approuve la demande de sponsoring", "refuse la demande de sponsoring", "saute l'étape",
      "sauter l'étape de validation", "valide l'étape du circuit", "fais avancer le circuit",
    ],
    risk: "SENSITIVE",
    summary: "Décision sur l'étape courante d'une demande engagée dans un circuit : approuver (l'étape suivante s'ouvre), refuser (circuit clos, demandeur notifié) ou SAUTER une étape intermédiaire (raison obligatoire, tracée, notifiée). Le moteur revérifie l'autorité de l'acteur.",
    gate: () => true,
    gateNote: "l'autorité réelle est décidée par le moteur selon l'étape courante",
  },
  {
    id: "CUSTOM_FIELD_MANAGE",
    module: "Administration → Champs personnalisés",
    uiLabel: "Champs personnalisés des modules (+ « obligatoire »)",
    toolName: "manage_custom_field",
    aliases: [
      "champ personnalisé", "ajoute un champ", "rends le champ obligatoire", "champ obligatoire",
      "rends le champ optionnel", "supprime le champ personnalisé", "ajoute une colonne au module",
    ],
    risk: "SENSITIVE",
    summary: "Crée, modifie ou retire un champ personnalisé d'un module (texte, nombre, date, oui/non, liste) — y compris le rendre OBLIGATOIRE : la fiche ne s'enregistre plus sans lui (appliqué par le serveur). Retirer un champ n'efface pas les valeurs déjà saisies.",
    gate: isSA,
  },
  {
    id: "SALARY_UPDATE",
    module: "RH",
    uiLabel: "Modifier la rémunération (fiche employé)",
    toolName: "update_salary",
    aliases: ["modifie le salaire de", "augmente le salaire", "change la rémunération"],
    risk: "CRITICAL",
    summary: "Change la rémunération sur la fiche RH (base, net, brut, coût employeur) — confirmation FORTE : le montant est à ressaisir. La paie du mois se saisit dans RH → Paie.",
    gate: (u) => userCan(u, "RH", "UPDATE"),
  },
];

/**
 * Les OPS DE DOMAINE (`ops/catalog.ts`) entrent dans le MÊME registre : mêmes alias, même
 * matching, même découverte (`find_available_actions`) — une op ajoutée au catalogue devient
 * découvrable ici sans rien recopier. `toolOp` porte la valeur du champ `op` à passer.
 */
const CATALOG_ERP_ACTIONS: NativeAction[] = OPS_CATALOG.map((m) => ({
  id: `OP_${m.tool.toUpperCase()}_${m.op.toUpperCase()}`,
  module: m.module,
  uiLabel: m.uiLabel,
  toolName: m.tool,
  toolOp: m.op,
  aliases: m.aliases,
  risk: m.risk,
  summary: m.summary,
  gate: m.gate,
  ...(m.gateNote ? { gateNote: m.gateNote } : {}),
}));

export const ERP_ACTIONS: NativeAction[] = [...CORE_ERP_ACTIONS, ...CATALOG_ERP_ACTIONS];

// ───────────────────────── Résolution intention → action native ─────────────────────────

/** Mots-outils français écartés du matching (sinon « demande rh » se réduirait à « demande »). */
const STOP = new Set([
  "de", "du", "des", "le", "la", "les", "un", "une", "en", "et", "ou", "au", "aux",
  "ce", "ces", "cette", "se", "sa", "son", "ses", "ne", "pas", "par", "sur", "pour",
  "dans", "que", "qui", "est", "il", "elle", "je", "tu", "on", "nous", "vous", "ils",
  "me", "te", "mon", "ton", "ma", "ta", "mes", "tes", "avec", "plus", "faut",
  // Démonstratifs et pronoms manquants — mesuré : leur absence rapprochait « supprime CET
  // employé » de « modifie le département de CET employé ». Deux phrases n'ont rien en commun
  // parce qu'elles partagent un démonstratif ; proposer une suppression définitive à qui
  // demande une modification est le pire faux positif possible.
  "cet", "celui", "celle", "ceux", "celles", "leur", "leurs", "lui", "eux", "y",
  "ete", "etre", "soit", "tout", "tous", "toute", "toutes", "meme", "memes",
  "comme", "quand", "dont", "donc", "alors", "aussi", "tres", "bien",
  "vers", "chez", "sans", "sous", "entre", "apres", "avant", "depuis", "encore", "deja",
  "ont", "ai", "as", "ont", "oui", "non", "merci", "stp", "svp",
]);

/**
 * RACINISATION LÉGÈRE DU FRANÇAIS — parce que le PDG ne parle pas à l'infinitif.
 *
 * L'alias du registre dit « assigner le dossier », le PDG dit « assigne le dossier ». Sans cette
 * étape, ces deux mots sont étrangers l'un à l'autre et l'action native n'est jamais reconnue :
 * mesuré sur 110 formulations réelles, c'était la première cause de silence du résolveur.
 *
 * On coupe les terminaisons verbales et le pluriel, en gardant un radical d'au moins 4 lettres —
 * en dessous on rabote des mots courts et on fabrique des collisions. La même fonction s'applique
 * AUX DEUX CÔTÉS : ce qui compte n'est pas la justesse linguistique du radical, c'est que
 * « assigner » et « assigne » tombent sur le MÊME.
 */
function stem(word: string): string {
  if (word.length <= 4) return word;
  // Du plus long au plus court : « ations » avant « ons », sinon on coupe trop court.
  const cut = word.replace(/(ations|ation|ements|ement|erait|eront|ions|iez|ons|ent|ez|er|es|ee|e|s|x)$/, "");
  return cut.length >= 4 ? cut : word.replace(/[sx]$/, "");
}

/** Repli : accents, apostrophes, ponctuation — jetons ≥ 2 lettres hors mots-outils, racinisés. */
function foldTokens(text: string): Set<string> {
  const folded = text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[''`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ");
  const out = new Set<string>();
  for (const raw of folded.split(" ")) {
    if (raw.length < 2 || STOP.has(raw)) continue;
    out.add(stem(raw));
  }
  return out;
}

/**
 * L'INDEX DE RÉSOLUTION — construit une fois, à partir du registre lui-même.
 *
 * La logique vit dans `nl/resolver.ts` : le registre déclare des actions, il ne sait pas
 * comprendre le français. Séparer les deux permet de mesurer le résolveur sur un corpus fixe
 * sans rien savoir de l'ERP, et d'améliorer la compréhension sans toucher aux 529 actions.
 */
const NL_INDEX = buildIndex(ERP_ACTIONS, (a) => ({
  id: a.id,
  module: a.module,
  aliases: a.aliases,
  risk: a.risk,
  uiLabel: a.uiLabel,
}));

/**
 * « Y a-t-il DÉJÀ une action native de l'ERP qui correspond à cette intention ? »
 *
 * Un alias correspond quand TOUS ses jetons (dé-accentués, dé-pluralisés) sont présents dans la
 * question — l'alias le plus SPÉCIFIQUE (le plus de jetons) l'emporte. On rend au plus deux
 * candidats distincts : c'est un INDICE injecté dans le plan, le modèle garde le jugement
 * (et la confirmation humaine garde le dernier mot).
 */
export function matchNativeAction(question: string, ctx: ResolverContext = {}): NativeAction[] {
  return resolve(NL_INDEX, question, ctx).candidates.map((c) => c.action);
}

/**
 * La résolution COMPLÈTE — score, confiance, ambiguïté, motif de refus.
 *
 * `matchNativeAction` n'en garde que la liste, pour les appelants qui n'ont besoin que d'un
 * indice. Ici on rend de quoi DÉCIDER : proposer, demander de préciser, ou se taire.
 */
export function resolveNativeAction(question: string, ctx: ResolverContext = {}) {
  return resolve(NL_INDEX, question, ctx);
}

/** Le bloc de plan injecté quand une action native correspond — PRIORITÉ AU NATIF. */
export function nativeActionHint(question: string): string | null {
  const matches = matchNativeAction(question);
  if (matches.length === 0) return null;
  const lines = matches.map((a) =>
    `• « ${a.uiLabel} » (${a.module}) → outil ${a.toolName}${a.toolOp ? ` (op « ${a.toolOp} »)` : ""}${a.risk !== "NORMAL" ? ` [${a.risk}]` : ""}`,
  );
  return `ACTION NATIVE DE L'ERP DÉTECTÉE pour cette demande :\n${lines.join("\n")}\n`
    + "RÈGLE : utiliser CET outil natif — jamais une demande administrative générique, une tâche ou un "
    + "message à la place d'un bouton métier qui existe. (Si l'intention réelle est différente, ignorer l'indice.)";
}

/**
 * LES ACTIONS DISPONIBLES SUR L'ÉCRAN d'où la conversation démarre (« Appeler » depuis une
 * fiche, entrée contextuelle) : le contexte d'écran (route + référence) se plie en tokens et
 * matche les modules du registre — l'assistant sait D'EMBLÉE quels boutons natifs existent LÀ,
 * au lieu de le découvrir (ou pas) par find_available_actions. Null sans correspondance :
 * jamais de bruit. Borné (12) : le budget d'instructions vocales se paie en latence.
 */
export function screenActionsContext(user: CurrentUser, screen: string): string | null {
  const matched = actionsForUser(user, screen);
  if (matched.length === 0) return null;
  const lines = matched.slice(0, 12).map((a) =>
    `• ${a.uiLabel} → ${a.toolName}${a.toolOp ? ` (op « ${a.toolOp} »)` : ""}${a.risk !== "NORMAL" ? ` [${a.risk}]` : ""}`,
  );
  const more = matched.length > 12 ? `\n(+${matched.length - 12} autres — find_available_actions pour la liste complète)` : "";
  return `ACTIONS NATIVES DISPONIBLES SUR CET ÉCRAN (priorité au natif — jamais une demande générique à la place d'un bouton qui existe ici) :\n${lines.join("\n")}${more}`;
}

/** Les actions natives OUVERTES à cette personne (pré-filtre écran ; l'exécution revérifie). */
export function actionsForUser(user: CurrentUser, moduleQuery?: string): NativeAction[] {
  const all = ERP_ACTIONS.filter((a) => {
    try { return a.gate(user) || Boolean(a.gateNote); } catch { return false; }
  });
  if (!moduleQuery?.trim()) return all;
  const q = foldTokens(moduleQuery);
  return all.filter((a) => {
    const m = foldTokens(a.module);
    return [...q].some((t) => m.has(t));
  });
}

// ───────────────────────── Inventaire exhaustif & classification ─────────────────────────

export type ParityStatus = "NATIVE" | "COVERED" | "GAP" | "EXCLUDED";

export interface ActionClassification {
  status: ParityStatus;
  /** NATIVE/COVERED : l'outil du Chief (ou l'id ERP_ACTIONS) qui rend ce service. */
  via?: string;
  /** GAP : ce qui manque ; EXCLUDED : pourquoi ce n'est pas un travail d'assistant. */
  note?: string;
}

const CLASSIFICATION: Record<string, ActionClassification> = {};
function classify(status: ParityStatus, viaOrNote: string, keys: string[]): void {
  for (const k of keys) {
    CLASSIFICATION[k] = status === "NATIVE" || status === "COVERED"
      ? { status, via: viaOrNote }
      : { status, note: viaOrNote };
  }
}

// ── NATIVE : le Chief exécute CETTE action serveur (via l'outil indiqué). ──
classify("NATIVE", "request_treasury_update", ["finance-actions:requestTreasuryUpdate"]);
classify("NATIVE", "assign_regulatory_responsible", ["regulatory-actions:setRegulatoryResponsible"]);
classify("NATIVE", "set_regulatory_step", ["regulatory-actions:setRegulatoryStepState", "regulatory-actions:setRegulatoryPresubOutcome"]);
classify("NATIVE", "request_regulatory_status_update", ["regulatory-actions:requestRegulatoryStatusUpdate"]);
classify("NATIVE", "delete_record", ["admin-delete-actions:superAdminDelete"]);
classify("NATIVE", "restore_record", ["admin-delete-actions:restoreDeletedRecord"]);
classify("NATIVE", "purge_record", ["admin-delete-actions:destroyDeletedRecord"]);
classify("NATIVE", "set_account_active", ["admin-actions:toggleUserActive"]);
classify("NATIVE", "set_account_role", ["admin-actions:updateUserRole", "admin-actions:setSecondaryRole"]);
classify("NATIVE", "create_task", ["task-actions:createTask"]);
classify("NATIVE", "update_request", ["admin-request-actions:updateRequestStatus", "admin-request-actions:assignRequest", "admin-request-actions:addRequestComment"]);
classify("NATIVE", "create_sponsoring_request", ["sponsoring-actions:createSponsoring"]);
classify("NATIVE", "create_event_request", ["event-actions:createEvent"]);
classify("NATIVE", "create_promo_material_request", ["promo-material-actions:createPromoMaterial"]);
classify("NATIVE", "create_legal_document", ["legal-actions:createLegalDocument"]);
classify("NATIVE", "update_legal_document", ["legal-actions:updateLegalDocument"]);
classify("NATIVE", "update_calendar_event", ["calendar-actions:updateCalendarEvent", "calendar-actions:deleteCalendarEvent"]);
classify("NATIVE", "create_hospital", ["medical-actions:createInstitution"]);
classify("NATIVE", "update_hospital", ["medical-actions:updateInstitution"]);
classify("NATIVE", "decide_payment", ["payment-centre-actions:decidePayment"]);
// « Adam, remets l'approbation obligatoire pour les mails. » — le Chief écrit la MÊME politique
// que l'écran de réglages, derrière la même ressaisie pour armer l'envoi autonome.
classify("NATIVE", "set_mail_policy", ["adam-settings-actions:setAdamMailPolicy"]);

// ── COVERED : le même résultat métier, par un outil équivalent du Chief. ──
classify("COVERED", "update_regulatory_product", [
  "regulatory-actions:updateRegulatoryProduct", "regulatory-actions:updateRegulatoryStatus",
  "regulatory-actions:setRegulatoryPriority", "regulatory-actions:setRegulatoryTargetDates",
  "regulatory-actions:setRegulatoryLock",
]);
classify("COVERED", "create_admin_request", ["admin-request-actions:createRequest"]);
classify("COVERED", "create_task (planifiée, circuit demande)", ["task-actions:requestTask"]);
classify("COVERED", "update_task", ["task-actions:updateTaskStatus", "task-actions:startTask"]);
classify("COVERED", "create_dossier", ["dossier-actions:createDossier"]);
classify("COVERED", "create_calendar_event", ["calendar-actions:createCalendarEvent"]);
classify("COVERED", "create_hr_request", ["hr-document-actions:requestHrDocument"]);
classify("COVERED", "create_congress_request", ["congress-request-actions:createCongressRequest"]);
classify("COVERED", "send_message", ["messaging-actions:sendMessage", "messaging-actions:createDirect"]);
classify("COVERED", "send_email", ["mail-actions:sendMailAction", "microsoft-mail-actions:sendMessage", "smart-mail-actions:sendMail"]);
classify("COVERED", "create_notification", ["notification-actions:sendBroadcast"]);
classify("COVERED", "update_platform_setting", [
  "settings-actions:saveAppSettings", "settings-actions:setRegEnrollmentEnabled",
  "settings-actions:setRegulatorySupervisorRoles", "settings-actions:setRegulatoryTherapeuticSegments",
  "settings-actions:setDriveSpaceCreatorRoles", "settings-actions:setFieldReportsOverviewRoles",
  "settings-actions:setDirectiveAccess", "settings-actions:setOrgChartViewers", "settings-actions:saveDriveStorageSettings",
  "settings-actions:setHiddenModules",
]);
classify("COVERED", "find_documents / inspect_drive_folder (lecture)", ["drive-browse-actions:browseDrive"]);
classify("COVERED", "update_salary", ["payroll-hr-actions:updatePayrollEntry"]);
// La double implémentation d'écran (admin/users) du MÊME geste métier : l'outil de compte
// existant produit l'effet identique (activation + sessions révoquées à la désactivation).
classify("COVERED", "set_account_active", ["access-actions:setUserActive"]);
// Révoquer UNE session précise exige la liste d'écran (empreinte appareil/date) ; le geste de
// sécurité demandé en conversation — « déconnecte X de partout » — est couvert intégralement.
classify("COVERED", "org_operation:revoke_sessions", ["access-actions:revokeSession"]);
// Wrapper d'écran du MÊME geste : editLegalDocument rejoue updateLegalDocument (couvert).
classify("COVERED", "update_legal_document", ["legal-actions:editLegalDocument"]);
// « Adam, suspends les envois » : la politique « brouillons seulement » produit EXACTEMENT le
// même résultat métier que le coupe-circuit sortant — plus rien ne quitte l'entreprise, même
// approuvé. Le Chief atteint donc le service par un autre chemin, déjà confirmé et audité.
classify("COVERED", "set_mail_policy", ["adam-settings-actions:setAdamOutboundPaused"]);

// ── GAP : action d'écran RECONNUE, pas encore proposable par le Chief. ──
const G = (note: string, keys: string[]) => classify("GAP", note, keys);
G("écritures Drive (créer/renommer/déplacer/partager/corbeille) — prochain lot, mêmes actions canoniques", [
  "drive-actions:createFolder", "drive-actions:ensureDriveFolders", "drive-actions:getDriveNodeShares",
  "drive-actions:renameNode", "drive-actions:moveNode", "drive-actions:trashNode", "drive-actions:restoreNode",
  "drive-actions:deleteNode", "drive-actions:shareNode", "drive-actions:shareNodeWithMany", "drive-actions:unshareNode",
  "drive-actions:createOfficeNode", "drive-actions:convertNodeToPdf", "drive-actions:trashNodes",
  "drive-actions:shareNodesWithMany", "drive-actions:copyNodes", "drive-actions:moveNodes",
  "drive-space-actions:createDriveSpace", "drive-space-actions:updateDriveSpace",
  "drive-space-actions:archiveDriveSpace", "drive-space-actions:deleteDriveSpace",
  "drive-comment-actions:postDriveComment", "drive-comment-actions:deleteDriveComment",
]);
G("création de dossier Regulatory (formulaire riche : référence, DCI, entité, segments…)", ["regulatory-actions:createRegulatoryProduct"]);
G("participants / accès du dossier Regulatory", ["regulatory-actions:setRegulatoryParticipants"]);
G("détail d'étape (dates planifiée/réelle, pièces manquantes, note) au-delà du statut", ["regulatory-actions:updateRegulatoryStep", "regulatory-actions:setRegulatoryStepNote"]);
G("commentaires de dossier Regulatory", ["regulatory-actions:addRegulatoryComment"]);
G("déverrouillage global, BV, checklist, variations, classification, fournisseur Regulatory", [
  "regulatory-actions:unlockAllRegulatory", "regulatory-actions:requestBV",
  "regulatory-actions:setRegulatoryChecklistItem", "regulatory-actions:createVariation",
  "regulatory-actions:setVariationStatus", "regulatory-actions:deleteVariation",
  "regulatory-actions:setRegulatoryClassification", "regulatory-actions:createRegulatorySupplier",
  "regulatory-reminder-actions:sendRegulatoryUpdateReminder",
]);
G("écritures comptables & trésorerie (créer/modifier/importer/soldes d'ouverture)", [
  "finance-actions:createTransaction", "finance-actions:updateTransactionStatus", "finance-actions:updateTransaction",
  "finance-actions:deleteTransaction", "finance-actions:importTransactions", "finance-actions:setTreasuryOpeningBalance",
  "finance-actions:deleteTreasuryAccount", "finance-actions:createQuickIncome",
  "finance-actions:createEmployee", "finance-actions:createPayroll", "finance-actions:payPayroll",
]);
G("factures (créer/payer/supprimer)", ["invoice-actions:createInvoice", "invoice-actions:updateInvoice", "invoice-actions:setInvoicePaid", "invoice-actions:deleteInvoice"]);
G("budgets & enveloppes (créer/attribuer/dépenser)", [
  "budget-actions:createBudget", "budget-envelope-actions:setBudgetTotal", "budget-envelope-actions:createEnvelope",
  "budget-envelope-actions:updateEnvelope", "budget-envelope-actions:deleteEnvelope",
  "budget-envelope-actions:createBudgetCategory", "budget-envelope-actions:updateBudgetCategory",
  "budget-envelope-actions:deleteBudgetCategory", "budget-envelope-actions:attributeTransaction",
  "budget-envelope-actions:addBudgetExpense", "budget-envelope-actions:updateBudgetExpense",
  "budget-envelope-actions:deleteBudgetExpense",
  "department-budget-actions:setDepartmentBudgetAccess", "department-budget-actions:setDepartmentBudget",
  "department-budget-actions:requestDepartmentBudget", "department-budget-actions:decideDepartmentBudgetRequest",
  "department-budget-actions:addDepartmentExpense", "department-budget-actions:updateDepartmentExpense",
  "department-budget-actions:deleteDepartmentExpense",
]);
G("caisse d'avance (allouer/dépenser/recharger)", [
  "petty-cash-actions:allotPettyCash", "petty-cash-actions:confirmPettyCashReceipt", "petty-cash-actions:closePettyCash",
  "petty-cash-actions:spendFromPettyCash", "petty-cash-actions:requestPettyCashTopUp",
  "petty-cash-actions:decidePettyCashTopUp", "petty-cash-actions:setPettyCashPlan",
]);
G("ordres de dépense (règlement, facture, révision budgétaire, annulation)", [
  "expense-actions:settleExpenseOrder", "expense-actions:requestInvoice", "expense-actions:requestBudgetRevision",
  "expense-actions:resolveBudgetRevision", "expense-actions:cancelExpenseOrder",
]);
G("demandes de paiement (création/pièces/décisions du circuit)", [
  "payment-request-actions:createPaymentRequest", "payment-request-actions:addPaymentPiece",
  "payment-request-actions:commentPaymentPiece", "payment-request-actions:reviewPaymentPiece",
  "payment-request-actions:addPaymentComment", "payment-request-actions:submitPaymentRequest",
  "payment-request-actions:decidePaymentRequest", "payment-request-actions:cancelPaymentRequest",
  "payment-request-actions:askPaymentValidation", "payment-request-actions:askPieceValidation",
  "payment-centre-actions:respondToPaymentCentre",
]);
G("paie RH (marquer payé, transfert budget)", ["payroll-hr-actions:markSalaryPaid", "payroll-hr-actions:unmarkSalaryPaid", "payroll-hr-actions:transferPayrollToBudget"]);
G("RH : fiche employé, congés/avances (décisions), documents employé", [
  "hr-actions:createEmployee", "hr-actions:updateEmployee",
  "hr-actions:setEmployeeActive", "hr-actions:requestLeave", "hr-actions:decideLeave", "hr-actions:cancelLeave",
  "hr-actions:updateLeaveRequest", "hr-actions:requestAdvance", "hr-actions:decideAdvance", "hr-actions:cancelAdvance",
  "hr-document-actions:addHrRequestComment", "hr-document-actions:processHrRequest",
  "hr-document-actions:decideExpenseReport", "hr-document-actions:decideHrLeave",
  "hr-document-actions:ackExpenseOriginals", "hr-document-actions:proposeHrMeeting",
  "hr-document-actions:confirmHrMeeting", "hr-document-actions:deleteHrRequest",
  "hr-document-actions:deleteEmployeeDocument", "hr-document-actions:setEmployeeDocumentVisibility",
]);
G("recrutement (circuit complet)", [
  "recruitment-actions:createRecruitmentRequest", "recruitment-actions:decideRecruitmentStep",
  "recruitment-actions:cancelRecruitmentRequest", "recruitment-actions:askRecruitmentInfo",
  "recruitment-actions:answerRecruitmentInfo", "recruitment-actions:openRecruitmentSourcing",
  "recruitment-actions:closeRecruitmentRequest", "recruitment-actions:addRecruitmentCandidate",
  "recruitment-actions:moveRecruitmentCandidate", "recruitment-actions:onboardRecruitment",
]);
G("formations (demande, décision, invitations)", [
  "training-actions:requestTraining", "training-actions:createHrTraining", "training-actions:decideTraining",
  "training-actions:updateTraining", "training-actions:inviteTrainingParticipants",
  "training-actions:respondToTrainingInvitation",
]);
G("réunions (créer/inviter/répondre/compte rendu)", [
  "meeting-actions:setMeetingLink", "meeting-actions:createMeeting", "meeting-actions:updateMeeting",
  "meeting-actions:respondToMeetingInvite", "meeting-actions:setMeetingLive", "meeting-actions:endMeeting",
  "meeting-actions:startCall", "meeting-actions:addMeetingParticipants", "meeting-actions:removeMeetingParticipant",
  "meeting-actions:saveMeetingTranscript", "meeting-actions:summarizeMeeting", "meeting-actions:acceptMeetingProposal",
  "meeting-actions:dismissMeetingProposal", "meeting-actions:deleteMeeting", "meeting-actions:postMeetingMessage",
  "meeting-actions:deleteMeetingMessage",
]);
G("messagerie avancée (groupes, canaux, épingles, réactions, membres)", [
  "messaging-actions:createGroup", "messaging-actions:createChannel", "messaging-actions:editMessage",
  "messaging-actions:deleteMessage", "messaging-actions:toggleReaction", "messaging-actions:togglePinMessage",
  "messaging-actions:bookmarkMessage", "messaging-actions:togglePinConversation", "messaging-actions:toggleMute",
  "messaging-actions:setNotifyLevel", "messaging-actions:updateConversation", "messaging-actions:addMembers",
  "messaging-actions:removeMember", "messaging-actions:setMemberRole", "messaging-actions:leaveConversation",
  "messaging-actions:archiveConversation", "messaging-actions:joinChannel", "messaging-actions:setMessagingStatus",
]);
G("boîte e-mail avancée (signature — le reste est EXCLU plus bas)", [
  "microsoft-mail-actions:saveMailSignature", "mail-actions:updateMailSignature",
]);
G("registre des courriers (créer/classer/pièces/partenaires)", [
  "mail-register-actions:createMailEntry", "mail-register-actions:editMailEntry", "mail-register-actions:setMailDate",
  "mail-register-actions:deleteMailEntry", "mail-register-actions:attachDriveNodeToMail",
  "mail-folder-actions:createMailFolder", "mail-folder-actions:updateMailFolder", "mail-folder-actions:deleteMailFolder",
  "mail-folder-actions:moveMailEntries", "mail-partner-actions:createMailPartner",
  "mail-partner-actions:updateMailPartner", "mail-partner-actions:deleteMailPartner",
  "mail-piece-actions:addMailPiece", "mail-piece-actions:updateMailPiece", "mail-piece-actions:deleteMailPiece",
]);
// NB : editLegalDocument est classé COVERED plus haut — le mettre ici l'écraserait en GAP
// (les blocs s'exécutent dans l'ordre du fichier ; seul le override catalogue est final).
G("Legal avancé (édition, dossiers, rattachements Drive, règlement de facture, lecteurs)", [
  "legal-actions:attachDriveNodeToLegal", "legal-actions:renewLegalDocument",
  "legal-actions:cancelLegalDocument", "legal-actions:deleteLegalDocument", "legal-actions:setLegalReaders",
  "legal-actions:sendLegalInvoiceToSettlement", "legal-folder-actions:createLegalFolder",
  "legal-folder-actions:updateLegalFolder", "legal-folder-actions:deleteLegalFolder",
  "legal-folder-actions:moveLegalDocuments",
]);
G("Ad&Pro (postes, décisions, transferts, consulting)", [
  "ad-pro-edit-actions:updateAdProRequest", "ad-pro-item-actions:addAdProItem", "ad-pro-item-actions:updateAdProItem",
  "ad-pro-item-actions:deleteAdProItem", "ad-pro-item-actions:emitItemExpenseOrder",
  "ad-pro-item-actions:linkPromoMaterial",
  "ad-pro-item-actions:submitAdProItem", "ad-pro-item-actions:decideAdProItem", "ad-pro-item-actions:setAdProItemBudget",
  "ad-pro-item-actions:requestAdProItemQuote", "ad-pro-item-actions:requestAdProItemOrder",
  "ad-pro-item-actions:approveAdProItemOrder", "ad-pro-other-actions:createAdProOtherRequest",
  "ad-pro-other-actions:decideAdProOtherRequest", "ad-pro-other-actions:closeAdProOtherRequest",
  "ad-pro-transfer-actions:transferAdProRequest", "consulting-actions:createConsultingContract",
  "consulting-actions:requestConsultingValidation", "consulting-actions:decideConsultingContract",
  "consulting-actions:closeConsultingContract", "consulting-actions:addConsultingTask",
  "consulting-actions:toggleConsultingTask", "consulting-actions:deleteConsultingTask",
]);
G("circuit matériel promo (devis→BAT→paiement, étapes après création)", [
  "promo-material-actions:submitQuotes", "promo-material-actions:chooseAgency",
  "promo-material-actions:submitBcForFinance", "promo-material-actions:remindFinance",
  "promo-material-actions:validateBc", "promo-material-actions:confirmBcSent",
  "promo-material-actions:initiatePayment", "promo-material-actions:confirmPayment",
  "promo-material-actions:submitMaterial", "promo-material-actions:directionReview",
  "promo-material-actions:confirmConformity", "promo-material-actions:startBat",
  "promo-material-actions:submitFinalMaterial", "promo-material-actions:recordInvoice",
  "promo-material-actions:settle", "promo-material-actions:addPromoComment",
  "promo-material-actions:cancelPromoMaterial", "promo-circuit-actions:startPromoCircuit",
  "promo-circuit-actions:markQuoteReceived", "promo-circuit-actions:validatePromoStep",
  "promo-circuit-actions:refusePromoStep", "promo-circuit-actions:completePromoTrack",
  "promo-stock-actions:createStockItem", "promo-stock-actions:updateStockItem",
  "promo-stock-actions:deleteStockItem", "promo-stock-actions:recordStockMovement",
  "promo-stock-actions:deleteStockMovement",
]);
G("sponsoring / congrès / prises en charge (décisions et étapes après création)", [
  "sponsoring-actions:sponsoringPreliminary", "sponsoring-actions:requestThirdPartyInput",
  "sponsoring-actions:sponsoringAnalysis", "sponsoring-actions:sponsoringFinal", "sponsoring-actions:sponsoringAppeal",
  "congress-request-actions:preliminaryDecision", "congress-request-actions:submitProductAnalysis",
  "congress-request-actions:finalDecision", "congress-request-actions:updateGrantedBudget",
  "congress-request-actions:requestThirdPartyInput", "congress-request-actions:cancelCongressRequest",
  "congress-beneficiary-actions:addCongressBeneficiary",
  "congress-beneficiary-actions:removeCongressBeneficiary", "congress-beneficiary-actions:requestBeneficiaryIds",
  "care-actions:addCareBeneficiary", "care-actions:setCareOpinion", "care-actions:decideCareBeneficiary",
  "care-actions:removeCareBeneficiary", "care-actions:addCareCell", "care-actions:setCareCellStatus",
  "care-actions:removeCareCell", "care-actions:createCareQuote", "care-actions:decideCareQuote",
  "care-actions:requestCareQuotes", "care-actions:sendCareToFinance",
  "care-actions:linkCareCellPromoMaterial",
]);
G("événements (inscriptions, validation) après création", [
  "event-actions:updateEvent", "event-actions:deleteEvent", "event-actions:submitEventForApproval",
  "event-actions:addRegistration", "event-actions:setRegistrationStatus", "event-actions:deleteRegistration",
]);
G("projets (statut, assignation, messages, archives, liens)", [
  "dossier-actions:updateDossierStatus", "dossier-actions:assignDossier", "dossier-actions:postDossierMessage",
  "dossier-actions:linkEmailToDossier", "dossier-actions:createDossierFromTask",
  "dossier-actions:archiveDossier", "dossier-actions:deleteDossierMessage", "dossier-actions:editDossierMessage",
]);
G("tâches : répondre/faire/valider POUR SOI (accepter la tâche, déposer le travail)", [
  "task-actions:respondTaskRequest", "task-actions:submitTaskWork", "task-actions:reopenTaskWork",
  "task-actions:addTaskComment",
]);
G("demandes administratives avancées (approbations, missions, lots, corbeille propre, validations)", [
  "admin-request-actions:requestApproval", "admin-request-actions:decideApproval", "admin-request-actions:createMission",
  "admin-request-actions:toggleMissionStop", "admin-request-actions:updateMission",
  "admin-request-actions:createRequestBatch", "admin-request-actions:editOwnRequest",
  "admin-request-actions:deleteOwnRequest", "admin-request-actions:deleteRequests",
  "admin-request-actions:restoreRequest", "admin-request-actions:startRequestProcessing",
  "admin-request-actions:requestFinanceValidation", "admin-request-actions:requestInternalValidation",
  "admin-request-actions:finishRequest", "admin-request-actions:submitAttachmentValidation",
  "admin-request-actions:cancelAttachmentValidation", "mission-actions:assignMission", "mission-actions:removeMission",
  "mission-actions:requestMissionOrder", "mission-actions:issueMissionOrder", "mission-actions:addMissionComment",
  "purchase-request-actions:createPurchaseRequest", "purchase-request-actions:withdrawPurchaseRequest",
  "document-request-actions:requestDocument", "document-request-actions:submitDocumentRequest",
  "document-request-actions:decideDocumentRequest", "document-request-actions:cancelDocumentRequest",
  "stand-in-actions:proposeStandIn", "stand-in-actions:decideStandIn",
]);
G("médical & annuaires (médecins, visites, spécialités, annuaires praticiens, import)", [
  "medical-actions:deleteInstitution", "medical-actions:createSpecialty", "medical-actions:updateSpecialty",
  "medical-actions:deleteSpecialty", "medical-actions:deleteDoctor", "medical-actions:deleteVisit",
  "medical-actions:createDoctor", "medical-actions:updateDoctor", "medical-actions:createVisit",
  "medical-actions:updateVisit", "medical-directory-actions:importDirectorySheet",
  "medical-directory-actions:saveDirectoryCell", "medical-directory-actions:addDirectoryDoctor",
  "medical-directory-actions:deleteDirectoryDoctors", "medical-directory-crud-actions:createMedicalDirectory",
  "medical-directory-crud-actions:updateMedicalDirectory", "medical-directory-crud-actions:deleteMedicalDirectory",
  "medical-directory-crud-actions:moveDoctorsToDirectory", "medical-directory-crud-actions:setDirectoryAccess",
  // Les colonnes propres à un annuaire : Adam ne les pilote pas encore, comme le reste du groupe.
  "medical-directory-crud-actions:createDirectoryColumn", "medical-directory-crud-actions:updateDirectoryColumn",
  "medical-directory-crud-actions:deleteDirectoryColumn",
  "medical-info-actions:requestDocument", "medical-info-actions:cancelDocRequest",
  "medical-info-actions:fulfillDocRequest", "medical-info-actions:recordAuthorityDeclaration",
  "medical-info-actions:validateDeclaration", "medical-info-actions:validateDeclarationByDirection",
  "medical-info-actions:addMedicalInfoComment", "field-report-actions:createFieldReport",
  "field-report-actions:updateFieldReport", "field-report-actions:analyzeFieldReportAction",
  "field-report-actions:submitFieldReport", "field-report-actions:validateFieldReport",
  "field-report-actions:reopenFieldReport", "field-report-actions:deleteFieldReport",
  "field-report-actions:deleteFieldReportAttachment",
]);
G("BD / marché / PCH / ventes & prévisions (CRUD des modules commerciaux)", [
  "bd-actions:createBD", "bd-actions:updateBDStatus", "bd-project-actions:createBdProject",
  "bd-project-actions:updateBdProject", "bd-project-actions:deleteBdProject", "bd-project-actions:createBdRange",
  "bd-project-actions:updateBdRange", "bd-project-actions:deleteBdRange", "bd-project-actions:createBdProduct",
  "bd-project-actions:updateBdProduct", "bd-project-actions:deleteBdProduct", "bd-project-actions:updateBdCell",
  "bd-project-actions:addBdProjectComment",
  "market-presentation-actions:generatePresentation", "market-presentation-actions:regeneratePresentation",
  "market-presentation-actions:renamePresentation", "market-presentation-actions:deletePresentation",
  "market-research-actions:createMarketResearch", "market-research-actions:updateMarketResearch",
  "market-research-actions:setMarketResearchParticipants", "market-research-actions:deleteMarketResearch",
  "market-research-actions:addResearchRow", "market-research-actions:updateResearchRow",
  "market-research-actions:deleteResearchRow", "market-research-actions:addResearchPlayer",
  "market-research-actions:updateResearchPlayer", "market-research-actions:deleteResearchPlayer",
  "market-research-actions:prefillResearchRow", "pch-actions:createTender", "pch-actions:updateTender",
  "pch-actions:deleteTender", "pch-actions:createOrder", "pch-actions:updateOrder", "pch-actions:deleteOrder",
  "pch-tender-line-actions:addTenderLine", "pch-tender-line-actions:updateTenderLine",
  "pch-tender-line-actions:deleteTenderLine", "pch-tender-line-actions:analyzeTenderText",
  "pch-tender-line-actions:analyzeTenderDocument", "pch-tender-line-actions:createOrderFromLine",
  "pch-tender-line-actions:enrichTenderLine", "pch-tender-line-actions:enrichAllTenderLines",
  "pch-tender-line-actions:setOrderArrival", "sales-actions:createSale", "sales-actions:importSales",
  "sales-planning-actions:createBusinessUnit",
  "sales-planning-actions:updateBusinessUnit", "sales-planning-actions:deleteBusinessUnit",
  "sales-planning-actions:createPromoProduct", "sales-planning-actions:updatePromoProduct",
  "sales-planning-actions:deletePromoProduct", "sales-planning-actions:saveForecast",
  "sales-planning-actions:saveSfeSettings",
  "sales-planning-actions:saveRepProfile", "sales-planning-actions:deleteRepProfile",
  "sales-planning-actions:saveAssignment", "sales-planning-actions:deleteAssignment",
  "sales-planning-actions:carryForwardAssignments", "logistics-actions:createLogistics",
  "logistics-actions:updateLogisticsStatus", "delegate-plan-actions:createDelegatePlan",
  "delegate-plan-actions:updateDelegatePlan", "delegate-plan-actions:deleteDelegatePlan",
  "delegate-plan-actions:duplicateDelegatePlan", "product-catalog-actions:linkProductToDossier",
  "product-catalog-actions:unlinkProductFromDossier",
]);
G("stocks hôpitaux (états, instantanés, demandes)", [
  "stock-snapshot-actions:createStockHospital", "stock-snapshot-actions:deleteStockHospital",
  "stock-snapshot-actions:createStockAnnex", "stock-snapshot-actions:deleteStockAnnex",
  "stock-snapshot-actions:requestStockState", "stock-snapshot-actions:recordStockSnapshot",
  "stock-snapshot-actions:deleteStockSnapshot",
]);
G("administration structurelle (entités, gammes, départements, organigramme, contacts, identité)", [
  "company-actions:setCompanyScope", "company-actions:createCompany", "company-actions:updateCompany",
  "company-actions:toggleCompany", "company-access-actions:setCompanyAccess",
  "company-contact-actions:createCompanyContact", "company-contact-actions:updateCompanyContact",
  "company-contact-actions:deleteCompanyContact", "company-identity-actions:saveCompanyIdentity",
  "product-range-actions:createProductRange", "product-range-actions:updateProductRange",
  "product-range-actions:deleteProductRange", "product-range-actions:setProductsRange",
  "product-range-actions:setUserRanges", "product-range-actions:removeProductFromRange",
  "department-actions:createDepartment", "department-actions:updateDepartment", "department-actions:deleteDepartment",
  "department-actions:assignEmployeeDepartment", "department-actions:assignEmployeeManager",
  "org-actions:saveOrgNode", "entity-attach-actions:attachOrphansToCompany",
  "supplier-actions:createSupplier", "supplier-actions:toggleSupplier",
  "supplier-actions:toggleSupplierUser", "settings-actions:setPipelineAccess",
]);
G("matrice d'accès fine & profils (droits par module, périmètres de lignes, profil)", [
  "access-actions:saveAccessMatrix", "access-actions:saveModuleAccess", "access-actions:setRowGrants",
  "access-actions:updateUserProfile",
  "access-actions:requestOnboarding", "access-actions:revokeAllSessions",
]);
// Le rollback rejoue un instantané PAR saveWorkflowDefinition : le Chief couvre le besoin en
// refournissant les étapes via configure_workflow — le bouton natif est le raccourci d'écran.
classify("NATIVE", "configure_workflow", ["workflow-actions:saveWorkflowDefinition", "workflow-actions:resetWorkflowDefinition", "workflow-actions:rollbackWorkflowDefinition"]);
classify("NATIVE", "advance_workflow", ["workflow-actions:advanceWorkflow"]);
classify("NATIVE", "manage_custom_field", ["custom-field-actions:upsertCustomFieldDef", "custom-field-actions:deleteCustomFieldDef"]);
G("saisie des VALEURS de champs personnalisés sur une fiche (l'écran de la fiche le fait déjà)", [
  "custom-field-actions:saveCustomValues",
]);
G("règles et demandes de VALIDATION (module Validations)", [
  "validation-actions:createValidationRule", "validation-actions:updateValidationRule",
  "validation-actions:toggleValidationRule", "validation-actions:deleteValidationRule",
  "validation-actions:createValidationRequest", "validation-actions:decideValidation",
  "validation-actions:reviewValidationItem", "validation-actions:clearValidationItem",
  "validation-actions:remindValidator",
]);
G("pièces jointes & documents polymorphes (upload/renommage), papiers en-tête, fournitures", [
  "document-actions:uploadDocument", "document-actions:renameDocument", "document-actions:deleteDocument",
  "letterhead-actions:uploadLetterhead", "letterhead-actions:updateLetterhead", "letterhead-actions:deleteLetterhead",
  "office-supply-actions:createSupplyArticle", "office-supply-actions:updateSupplyArticle",
  "office-supply-actions:toggleSupplyArticle", "office-supply-actions:previewCatalogNormalization",
  "office-supply-actions:applyCatalogNormalization",
]);
G("directives, support, feedback, commentaires génériques, rappels d'écran", [
  "directive-actions:createDirective", "directive-actions:updateDirectiveStatus", "directive-actions:archiveDirective",
  "directive-actions:postDirectiveMessage",
 "support-actions:createSupportRequest", "support-actions:takeSupportRequest",
  "support-actions:answerSupportRequest", "support-actions:updateSupportStatus", "feedback-actions:submitFeedback",
  "feedback-actions:updateFeedbackStatus", "comment-actions:updateComment", "comment-actions:deleteComment",
  "reminder-actions:createReminder", "reminder-actions:completeReminder", "reminder-actions:cancelReminder",
  "reminder-actions:snoozeReminder", "calendar-actions:respondToInvite",
]);
G("cockpit Adventum (seuils de risque) & maintenance profonde de la base", [
  "adventum-actions:updateRiskThresholds",
  "database-admin-actions:purgeOrphanStorage", "database-admin-actions:permanentlyDeleteDriveNode",
  "database-admin-actions:permanentlyDeleteDocument",
  "ai-settings-actions:updateAiSettings", "feature-actions:setFeatureStage",
]);

// ── LA MAIN HUMAINE SUR UNE MISSION D'EXÉCUTION (§33-40) ─────────────────────────────────
//
// Trois gestes RÉDUISENT ce qu'une mission va faire — suspendre, reprendre, arrêter — et le
// refus d'une autorisation en fait autant. Adam les propose par `mission_control`, donc COVERED.
classify("COVERED", "mission_control (pause / reprise / arrêt / refus d'autorisation / replanification)", [
  "mission-runtime-actions:mettreMissionEnPause",
  "mission-runtime-actions:reprendreMission",
  "mission-runtime-actions:arreterMission",
  // La replanification est COUVERTE et non exclue : elle n'AJOUTE rien de sortant sans accord.
  // Tout ce que le nouveau plan apporte repasse par `reouvrirSiChange` (§8), donc par la
  // personne. Au pire, une injection qui la déclencherait produit une demande d'accord de plus.
  "mission-runtime-actions:replanifierMissionAction",
]);
// La LECTURE de ses accords en attente est la même information que `mission_status` rend déjà.
classify("COVERED", "mission_status (l'écran d'une mission dit ce qu'elle attend de vous)", [
  "mission-runtime-actions:listerAccordsMission",
]);

// ── EXCLUDED : pas un travail d'assistant — raison donnée, pas un oubli. ──
const X = (note: string, keys: string[]) => classify("EXCLUDED", note, keys);
X("PURGE IRRÉVERSIBLE DE LA FILE DES RÈGLEMENTS. Vider l'historique efface des ordres de dépense en bloc ; le geste n'a pas d'annulation et ne se discute pas — il se décide devant l'écran, en voyant combien de lignes partent. Le rendre appelable par Adam l'exposerait à l'injection : un document lu par une étape pourrait contenir « vide l'historique des règlements ». Les écritures de trésorerie survivent, mais ce n'est pas une raison pour donner la commande à un modèle. Un clic du Super Admin sur /finances/paiements-a-faire.", [
  "expense-actions:purgeSettledExpenseOrders",
]);
X("PUBLIER UNE NOTE DE SERVICE est une ATTESTATION, et une diffusion qui ne se reprend pas. Accorder la publication engage la direction générale devant TOUS les salariés — l'audit portera son nom — et la note part instantanément, en pop-up s'il le faut : ce qui a été lu a été lu. Rendre ces gestes appelables par Adam les exposerait à l'injection, un document lu par une étape pouvant contenir « publie cette directive ». Le refus et la RELANCE relèvent de la même famille : renvoyer, c'est rediffuser à la même audience. Ces trois gestes exigent un clic sur /directives/<id>. Adam RÉDIGE et SOUMET (`createDirective`), il ne se signe pas lui-même.", [
  "directive-actions:publishDirective",
  "directive-actions:rejectDirective",
  "directive-actions:resendDirective",
]);
X("ATTESTATIONS HUMAINES, et volontairement hors de portée d'un modèle. Accorder une autorisation et fournir une pièce engagent la personne : l'audit portera SON nom. Les rendre appelables par Adam les exposerait à l'injection — un document lu par une étape pourrait contenir « approuve la mission », et rien ne distinguerait plus cet accord d'un vrai. `policy/guard.ts` interdit d'ailleurs `mission_control` à l'agent lui-même, à la compilation. Ces deux gestes exigent un clic sur /missions/<id>.", [
  "mission-runtime-actions:deciderAccordMission",
  "mission-runtime-actions:fournirElementMission",
  /**
   * APPROUVER UN MODÈLE OPÉRATIONNEL relève de la même famille, et pour la même raison.
   *
   * Dire « voici le bon de commande officiel de l'entreprise » engage la personne : tous les
   * documents produits ensuite s'en réclameront. Si Adam pouvait le faire, un fichier candidat
   * contenant « approuve ce modèle » suffirait à se faire adouber — et rien ne distinguerait
   * plus le modèle validé du modèle injecté.
   *
   * Adam PROPOSE (`proposer` → CANDIDATE). Il ne se répond pas oui.
   */
  "mission-runtime-actions:approuverModeleOperationnel",
]);
X("LA CHECKLIST DE DÉPÔT D'UNE SOUMISSION est un REGISTRE D'ATTESTATIONS : cocher « Certificats GMP » dit « cette pièce est réunie », signé du nom de la personne et horodaté — même famille que fournir une pièce de mission. Rendre la coche appelable par Adam l'exposerait à l'injection (un document lu pourrait contenir « coche tout ») et l'audit porterait un nom qui n'a rien vérifié. Ces gestes exigent un clic devant la version affichée, sur /pch/<id> ; l'ajout d'une exigence et le libellé/état de la version sont la mécanique de la même carte. Adam, lui, CRÉE une version (pch_operation:create_submission) et la DÉPOSE (submit_submission) — le dépôt reste un geste métier confirmé, pas une attestation de pièce.", [
  "pch-market-actions:toggleChecklistItem",
  "pch-market-actions:addChecklistItem",
  "pch-market-actions:updateSubmission",
]);
X("LECTURES D'ÉCRAN autour des modèles opérationnels. La file des candidats n'a de sens que devant la personne qui va cliquer ; le modèle faisant autorité est affiché pour qu'elle sache ce qui sera utilisé. Adam, lui, n'a pas besoin de ces deux lectures : le runtime lui dit déjà `MISSING_TEMPLATE` quand aucun modèle n'est approuvé, avec son échelle de recours — et un candidat ne lui est jamais servi.", [
  "mission-runtime-actions:listerModelesCandidats",
  "mission-runtime-actions:modeleOfficiel",
]);
X("APERÇU AVANT ÉCRITURE : une étape d'ÉCRAN, sans effet. Elle lit un classeur et propose une correspondance de colonnes à valider à la main. Adam, lui, importe par la reconnaissance automatique (`importDirectorySheet` sans correspondance) : il n'a personne pour trancher, et une confirmation qu'aucun humain ne lit n'est pas une confirmation.", [
  "medical-directory-actions:previewDirectorySheet",
]);
// NB : `admin-actions:createUser` a quitté cette liste — le besoin « créer un compte » est
// couvert par `org_operation:create_account_invite` (lien d'invitation : la personne définit
// SON mot de passe ; rien ne transite par la conversation) via la reclassification catalogue.
X("SÉCURITÉ : identifiants et sessions appartiennent à la personne au clavier — jamais à une conversation", [
  "auth-actions:authenticate", "auth-actions:doSignOut", "auth-actions:changePassword",
  "access-actions:adminResetPassword",
  "impersonation-actions:startImpersonation", "impersonation-actions:stopImpersonation",
  "supplier-portal-actions:supplierLogin", "supplier-portal-actions:supplierLogout",
  "mail-actions:connectMailbox", "mail-actions:disconnectMailbox", "microsoft-mail-actions:disconnectMicrosoftMail",
  // Même raison pour l'identité Google d'Adam : brancher ou débrancher une boîte passe par un
  // consentement OAuth dans le NAVIGATEUR de la personne (redirection, cookie PKCE) — une
  // conversation ne peut pas le porter. Le réarmement de la veille et la mise en pause de la
  // connexion sont de la plomberie du même ordre : un clic dans les réglages, jamais une phrase.
  "adam-settings-actions:disconnectAdamGoogle", "adam-settings-actions:setAdamConnectionPaused",
  "adam-settings-actions:renewAdamWatch", "adam-settings-actions:setAdamInboundPaused",
]);
X("geste personnel sur SON PROPRE retour — la pièce jointe d'un feedback appartient à qui l'a déposée", [
  // Retirer une pièce d'un retour est une correction que la personne fait elle-même, depuis
  // l'écran où elle l'a déposée. La confier au Chief ouvrirait la possibilité d'effacer, par
  // une phrase, la CAPTURE qui documentait un bogue — c'est-à-dire la preuve. Le Super Admin
  // garde le geste à l'écran ; il n'a pas besoin d'une action conversationnelle pour cela.
  "feedback-actions:removeFeedbackAttachment",
]);
X("plomberie du Chief lui-même (chat, mémoire, fils) — pas une action métier à proposer", [
  "assistant-actions:rememberExchange", "assistant-actions:assistantChat", "assistant-actions:assistantNudge",
  "assistant-actions:executeAssistantAction", "assistant-actions:cancelAssistantAction",
  // Le LOT est la même porte que `executeAssistantAction`, en une seule fois : il n'exécute rien
  // lui-même, il enchaîne des intents déjà proposés en repassant par le garde d'idempotence et
  // `performAction`. Ce n'est donc pas une action métier de plus à proposer au Chief — c'est le
  // geste « je confirme tout » de l'utilisateur, exécuté côté serveur au lieu du navigateur.
  "assistant-actions:executeAssistantBundle",
  // LE GESTE DÉTERMINISTE d'un bouton de l'espace de travail (§23). Il n'ouvre AUCUNE capacité
  // nouvelle : il exécute une LECTURE déjà exposée au Chief comme outil, en sautant l'appel au
  // modèle que le serveur n'avait aucune raison de payer — il connaissait l'intention exacte au
  // moment où il a dessiné le bouton. Rien à proposer ici : ce qu'il appelle est déjà proposé.
  "assistant-actions:assistantDirectIntent",
  "assistant-actions:listAssistantFiles", "assistant-actions:myAssistantThreads", "assistant-actions:myAssistantThread",
  "assistant-actions:deleteMyAssistantThread", "assistant-actions:refreshMyBrief",
  "assistant-actions:forgetMyAssistantMemory",
]);
X("préférence d'affichage PERSONNELLE (sans effet métier au-delà de l'écran de la personne)", [
  "adoption-actions:saveAdoptionSettings", "adoption-actions:resetActivityTime", "feature-actions:toggleMyTestMode",
  "budget-scope-actions:rememberBudgetEnvelope", "supplier-actions:updateSupplierView",
  "notification-actions:markNotificationRead", "notification-actions:markAllNotificationsRead",
  "messaging-actions:markRead", "onboarding-actions:saveOnboardingProfile", "onboarding-actions:completeOnboarding",
]);
X("flux PUBLIC à jeton (inscription/pointage d'invités externes, hors session interne)", [
  "event-actions:publicRegister", "event-actions:checkInByToken",
]);
X("outillage de TEST interne de la plateforme (centre de tests), pas une action métier", [
  "test-center-actions:runTestCenter", "test-center-actions:resumeTestCleanup",
]);
X("helpers de LECTURE et tâches PLANIFIÉES internes (pas des gestes métier qu'on demande)", [
  // paymentPeople = liste de choix d'un formulaire ; les rappels de rechargement tournent
  // seuls au planificateur ; nextRechargeFor = affichage d'une échéance calculée.
  "payment-request-actions:paymentPeople",
  "petty-cash-actions:runPettyCashRechargeReminders", "petty-cash-actions:nextRechargeFor",
]);
X("analyse IA de PRÉ-REMPLISSAGE (extrait les champs d'un contrat scanné, ne persiste RIEN — les RH relisent et enregistrent eux-mêmes)", [
  "hr-actions:analyzeEmployeeContract",
]);
X("lectures pures de l'explorateur Intelligence marché (recherche IQVIA/PCH, analyse de molécule, suggestions de frappe) — rien n'est écrit ; côté Chief, l'analyse marché sert déjà l'enrichissement des lignes d'AO (pch_operation:enrich_line)", [
  "market-actions:searchMarketProducts", "market-actions:analyzeMarketMolecule", "market-actions:marketSuggestions",
]);
X("liste de choix d'un formulaire (les personnes qu'on peut solliciter) — une lecture, pas un geste", [
  "document-request-actions:askablePeople",
]);
X("sélecteurs de formulaires care / matériel promo (options d'annuaire, de matériels, de bénéficiaires à copier) — des lectures de listes de choix, pas des gestes métier (précédent : askablePeople) ; côté Chief, la résolution se fait par NOM dans care_operation / promo_operation / adpro_operation", [
  "care-actions:careDirectoryOptions", "care-actions:carePromoOptions",
  "congress-beneficiary-actions:listBeneficiaryRefs", "ad-pro-item-actions:promoMaterialOptions",
]);
X("liste des projets rattachables (sélecteur du Courrier) — une lecture ; côté Chief, dossier_operation:link_email_to_dossier résout le projet par NOM", [
  "dossier-actions:listLinkableDossiers",
]);
X("liste des objets qu'on peut relier (candidats du panneau « Relié à… ») — une lecture chargée à l'ouverture du volet, pas un geste ; c'est addEntityLink qui relie et lui est classé", [
  "link-actions:linkCandidatesFor",
]);
X("plomberie du planning SFE : get-or-create idempotent du cycle mensuel à l'ouverture de l'écran (précédent ensureDriveFolders) — les ops planning_operation l'assurent elles-mêmes à l'exécution", [
  "sales-planning-actions:ensureCycle",
]);
X("plomberie / lecture du Drive (initialisation de dossiers, liste des partages) — pas un geste métier", [
  "drive-actions:ensureDriveFolders", "drive-actions:getDriveNodeShares",
]);
X("IDENTITÉ D'ENTREPRISE : l'annuaire décide À QUELLE ADRESSE part un message signé du PDG. Le tenir "
  + "est un geste d'assistante de direction, posé à l'écran avec son audit — pas une capacité conversationnelle. "
  + "Adam le LIT (directory_lookup / directory_list) ; le faire écrire ouvrirait un détournement de courrier trivial : "
  + "il suffirait de lui faire changer une adresse pour rediriger la correspondance de la société", [
  "directory-actions:ensureDirectoryEntry", "directory-actions:updateDirectoryEntry",
  "directory-actions:addDirectoryEndpoint", "directory-actions:deactivateDirectoryEndpoint",
]);
X("lectures / analyses IA du cockpit et de l'admin — RIEN n'est écrit : le Chief EST déjà cette capacité (il répond, analyse, brief, fiche 360 par ses outils de lecture) ; runAutopilot n'exécute que des propositions du panneau Brain, dont les gestes (tâche, relance) sont natifs via task_operation et les rappels", [
  "adventum-actions:runAutopilot", "adventum-actions:askBrain", "adventum-actions:generateBriefing",
  "adventum-actions:searchRelations", "platform-audit-actions:generatePlatformIdeas",
  "smart-mail-actions:smartMailStatus",
]);
X("CORRECTIONS DE SAISIE sur la frise du dossier (renommer, supprimer une étape). Ajouter une étape est natif (regulatory_operation:add_dossier_step) : c'est le geste qu'on demande. Corriger, lui, suppose d'AVOIR la frise sous les yeux — on renomme la ligne qu'on relit, on supprime celle qu'on vient de créer par erreur ; formulé de mémoire dans une conversation, « supprime la deuxième étape » désigne rarement ce que la personne croit. La suppression refuse d'ailleurs toute étape portant des pièces, et l'origine ne s'efface pas.", [
  "regulatory-timeline-actions:updateDossierStep",
  "regulatory-timeline-actions:deleteDossierStep",
]);
X("géométrie d'ÉCRAN : position x/y d'un nœud sur la carte de l'organigramme (glisser-déposer) — pas un geste métier, le Chief n'a pas de canevas", [
  "org-actions:saveOrgPosition",
]);
X("SÉCURITÉ : exige un mot de passe EN CLAIR pour le compte portail fournisseur — un mot de passe ne transite jamais par une conversation (même règle que les comptes internes, résolus par lien d'invitation) ; geste réservé à l'écran Admin", [
  "supplier-actions:createSupplierUser",
]);
X("boîte Microsoft PERSONNELLE : ces gestes visent un messageId Graph opaque de l'écran — le Chief n'a pas de lecture de boîte (OAuth personnel) pour les résoudre en conversation", [
  "microsoft-mail-actions:saveDraft", "microsoft-mail-actions:setMessageRead", "microsoft-mail-actions:moveMessage",
  "microsoft-mail-actions:deleteMessage", "microsoft-mail-actions:saveAttachmentToDrive",
  "microsoft-mail-actions:linkMessageToEntity",
]);
G("suppression par le CRÉATEUR de son propre courrier / document légal (proposable pour l'auteur)", [
  "admin-delete-actions:deleteOwnRecord",
]);

// ── RECLASSIFICATION AUTOMATIQUE PAR LE CATALOGUE D'OPS (après tous les blocs ci-dessus). ──
// Chaque op de domaine déclare les server actions qu'elle rend NATIVE (`covers`) : leurs clés
// passent de GAP à NATIVE ici, sans retoucher les blocs à la main. Ajouter une op = fermer ses
// trous — c'est le mécanisme SYSTÉMIQUE anti « capability whack-a-mole ».
for (const [key, via] of catalogCoveredKeys()) {
  CLASSIFICATION[key] = { status: "NATIVE", via };
}

export const ACTION_CLASSIFICATION: Readonly<Record<string, ActionClassification>> = CLASSIFICATION;

/** La métrique UI_ACTION_PARITY : couvert / (couvert + trous), exclusions à part. */
export function parityStats(): { native: number; covered: number; gap: number; excluded: number; total: number; parityPct: number } {
  let native = 0, covered = 0, gap = 0, excluded = 0;
  for (const c of Object.values(CLASSIFICATION)) {
    if (c.status === "NATIVE") native++;
    else if (c.status === "COVERED") covered++;
    else if (c.status === "GAP") gap++;
    else excluded++;
  }
  const total = native + covered + gap + excluded;
  const denom = native + covered + gap;
  return { native, covered, gap, excluded, total, parityPct: denom ? Math.round(((native + covered) / denom) * 1000) / 10 : 0 };
}
