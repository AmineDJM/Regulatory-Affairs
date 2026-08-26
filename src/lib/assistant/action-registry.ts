import type { CurrentUser } from "@/lib/session";
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
]);

/** Repli : accents, apostrophes, ponctuation — jetons ≥ 2 lettres hors mots-outils, dé-pluralisés. */
function foldTokens(text: string): Set<string> {
  const folded = text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[''`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ");
  const out = new Set<string>();
  for (const raw of folded.split(" ")) {
    if (raw.length < 2 || STOP.has(raw)) continue;
    out.add(raw.replace(/[sx]$/, ""));
  }
  return out;
}

interface AliasIndexEntry { action: NativeAction; tokens: string[] }
const ALIAS_INDEX: AliasIndexEntry[] = ERP_ACTIONS.flatMap((action) =>
  action.aliases.map((a) => ({ action, tokens: [...foldTokens(a)] })).filter((e) => e.tokens.length > 0),
);

/**
 * « Y a-t-il DÉJÀ une action native de l'ERP qui correspond à cette intention ? »
 *
 * Un alias correspond quand TOUS ses jetons (dé-accentués, dé-pluralisés) sont présents dans la
 * question — l'alias le plus SPÉCIFIQUE (le plus de jetons) l'emporte. On rend au plus deux
 * candidats distincts : c'est un INDICE injecté dans le plan, le modèle garde le jugement
 * (et la confirmation humaine garde le dernier mot).
 */
export function matchNativeAction(question: string): NativeAction[] {
  const q = foldTokens(question);
  if (q.size === 0) return [];
  const hits = ALIAS_INDEX
    .filter((e) => e.tokens.every((t) => q.has(t)))
    .sort((a, b) => b.tokens.length - a.tokens.length);
  const seen = new Set<string>();
  const out: NativeAction[] = [];
  for (const h of hits) {
    if (seen.has(h.action.id)) continue;
    seen.add(h.action.id);
    out.push(h.action);
    if (out.length === 2) break;
  }
  return out;
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
  "settings-actions:setOrgChartViewers", "settings-actions:saveDriveStorageSettings",
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
  "payment-request-actions:askPaymentValidation",
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
  "sales-planning-actions:saveSfeSettings", "sales-planning-actions:createSalesTeam",
  "sales-planning-actions:updateSalesTeam", "sales-planning-actions:deleteSalesTeam",
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
  "org-actions:saveOrgNode", "org-actions:saveOrgPosition", "entity-attach-actions:attachOrphansToCompany",
  "supplier-actions:createSupplier", "supplier-actions:createSupplierUser", "supplier-actions:toggleSupplier",
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
  "directive-actions:postDirectiveMessage", "support-actions:createSupportRequest", "support-actions:takeSupportRequest",
  "support-actions:answerSupportRequest", "support-actions:updateSupportStatus", "feedback-actions:submitFeedback",
  "feedback-actions:updateFeedbackStatus", "comment-actions:updateComment", "comment-actions:deleteComment",
  "reminder-actions:createReminder", "reminder-actions:completeReminder", "reminder-actions:cancelReminder",
  "reminder-actions:snoozeReminder", "calendar-actions:respondToInvite",
]);
G("cockpit Adventum (autopilote, brain, seuils de risque) & maintenance profonde de la base", [
  "adventum-actions:runAutopilot", "adventum-actions:askBrain", "adventum-actions:generateBriefing",
  "adventum-actions:searchRelations", "adventum-actions:updateRiskThresholds",
  "database-admin-actions:purgeOrphanStorage", "database-admin-actions:permanentlyDeleteDriveNode",
  "database-admin-actions:permanentlyDeleteDocument", "platform-audit-actions:generatePlatformIdeas",
  "ai-settings-actions:updateAiSettings", "feature-actions:setFeatureStage", "smart-mail-actions:smartMailStatus",
]);

// ── EXCLUDED : pas un travail d'assistant — raison donnée, pas un oubli. ──
const X = (note: string, keys: string[]) => classify("EXCLUDED", note, keys);
// NB : `admin-actions:createUser` a quitté cette liste — le besoin « créer un compte » est
// couvert par `org_operation:create_account_invite` (lien d'invitation : la personne définit
// SON mot de passe ; rien ne transite par la conversation) via la reclassification catalogue.
X("SÉCURITÉ : identifiants et sessions appartiennent à la personne au clavier — jamais à une conversation", [
  "auth-actions:authenticate", "auth-actions:doSignOut", "auth-actions:changePassword",
  "access-actions:adminResetPassword",
  "impersonation-actions:startImpersonation", "impersonation-actions:stopImpersonation",
  "supplier-portal-actions:supplierLogin", "supplier-portal-actions:supplierLogout",
  "mail-actions:connectMailbox", "mail-actions:disconnectMailbox", "microsoft-mail-actions:disconnectMicrosoftMail",
]);
X("plomberie du Chief lui-même (chat, mémoire, fils) — pas une action métier à proposer", [
  "assistant-actions:rememberExchange", "assistant-actions:assistantChat", "assistant-actions:assistantNudge",
  "assistant-actions:executeAssistantAction", "assistant-actions:cancelAssistantAction",
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
X("plomberie du planning SFE : get-or-create idempotent du cycle mensuel à l'ouverture de l'écran (précédent ensureDriveFolders) — les ops planning_operation l'assurent elles-mêmes à l'exécution", [
  "sales-planning-actions:ensureCycle",
]);
X("plomberie / lecture du Drive (initialisation de dossiers, liste des partages) — pas un geste métier", [
  "drive-actions:ensureDriveFolders", "drive-actions:getDriveNodeShares",
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
