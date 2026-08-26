import { describe, it, expect } from "vitest";
import { ERP_ACTIONS, matchNativeAction, resolveNativeAction } from "./action-registry";
import { parsePhrase, relateIntents, stemNoun, flatten } from "./nl/lexicon";

/**
 * LE BANC DE MESURE de la compréhension du français par Adam.
 *
 * Il ne teste pas des fonctions : il mesure une CAPACITÉ, sur des phrases que le PDG a
 * réellement écrites ou dictées. C'est un instrument, pas une décoration — et un instrument ne
 * sert que s'il peut donner tort.
 *
 * TROIS RÈGLES DE PROBITÉ, tenues au fil des mesures :
 *
 *   1. **On ne retire pas une phrase parce qu'elle échoue.** Le corpus n'a jamais rétréci.
 *      Les formulations que le résolveur rate encore sont ci-dessous, marquées, comptées.
 *
 *   2. **La destination attendue est écrite à la main**, en lisant le module et le libellé du
 *      bouton — jamais recopiée de ce que le résolveur a répondu. Là où l'ERP n'a pas le bouton
 *      demandé (il n'existe aucun export Excel du tableau Regulatory), l'attente est `null` :
 *      la phrase compte pour le RAPPEL, pas pour la PRÉCISION. Le commentaire dit pourquoi.
 *
 *   3. **Un faux positif destructeur vaut infiniment plus qu'un rappel manqué.** Les seuils du
 *      résolveur le disent, ce banc le vérifie : un corpus adverse dédié, et zéro toléré.
 */

// ─────────────────────────── I. Les 110 formulations réelles ───────────────────────────

/**
 * `attendu` : les identifiants d'action ACCEPTABLES (le bon bouton doit être dans les deux
 * premiers candidats). `null` = l'ERP n'a pas ce bouton, ou deux boutons se valent : la phrase
 * ne compte alors que pour le rappel.
 */
type Cas = { q: string; attendu: string[] | null; note?: string };

const CORPUS: Cas[] = [
  // ── Regulatory
  { q: "assigne le dossier Nintedanib a Raihana", attendu: ["REGULATORY_ASSIGN_RESPONSIBLE"] },
  { q: "reassigne ce dossier a Amel", attendu: ["REGULATORY_ASSIGN_RESPONSIBLE"] },
  { q: "change le charge du dossier", attendu: ["REGULATORY_ASSIGN_RESPONSIBLE"] },
  { q: "passe le dossier a l'etape suivante", attendu: ["REGULATORY_SET_STEP", "WORKFLOW_ADVANCE"] },
  { q: "relance la mise a jour des dossiers regulatory", attendu: ["OP_REGULATORY_OPERATION_SEND_UPDATE_REMINDER", "REGULATORY_REQUEST_STATUS_UPDATE"] },
  { q: "cree un dossier regulatory pour ce produit", attendu: ["OP_REGULATORY_OPERATION_CREATE_PRODUCT"] },
  { q: "ajoute un participant au dossier", attendu: ["OP_REGULATORY_OPERATION_SET_PARTICIPANTS"] },
  { q: "mets a jour le prix du produit", attendu: null, note: "aucune action « prix du produit » au registre" },
  { q: "archive ce dossier regulatory", attendu: null, note: "aucune action d'archivage de dossier Regulatory" },
  { q: "exporte le tableau regulatory en excel", attendu: null, note: "l'export est un bouton d'écran, pas une action du registre" },
  // ── Finances & budgets
  { q: "actualise les soldes de tresorerie", attendu: ["FINANCE_REQUEST_BALANCE_REFRESH"] },
  { q: "demande l'actualisation des soldes", attendu: ["FINANCE_REQUEST_BALANCE_REFRESH"] },
  { q: "cree une enveloppe budgetaire", attendu: ["OP_FINANCE_OPERATION_CREATE_ENVELOPE"] },
  { q: "modifie le montant de l'enveloppe", attendu: ["OP_FINANCE_OPERATION_UPDATE_ENVELOPE"] },
  { q: "impute cette depense au budget", attendu: ["OP_FINANCE_OPERATION_ADD_BUDGET_EXPENSE"] },
  { q: "cree une facture", attendu: ["OP_FINANCE_OPERATION_CREATE_INVOICE"] },
  { q: "marque la facture comme payee", attendu: ["OP_FINANCE_OPERATION_SET_INVOICE_PAID"] },
  { q: "valide ce paiement", attendu: ["PAYMENT_DECIDE"] },
  { q: "refuse cette demande de paiement", attendu: ["OP_FINANCE_OPERATION_DECIDE_PAYMENT_REQUEST", "PAYMENT_DECIDE"] },
  { q: "ajoute une piece a la demande de paiement", attendu: ["OP_FINANCE_OPERATION_ADD_PAYMENT_PIECE"] },
  { q: "enregistre un encaissement", attendu: ["OP_FINANCE_OPERATION_QUICK_INCOME", "OP_FINANCE_OPERATION_CREATE_TRANSACTION"] },
  { q: "cree un ordre de depense", attendu: ["OP_ADPRO_OPERATION_EMIT_ITEM_ORDER"] },
  { q: "impute une depense a ma caisse d'avance", attendu: ["OP_FINANCE_OPERATION_SPEND_FROM_PETTY_CASH"] },
  { q: "recharge la caisse d'avance", attendu: ["OP_FINANCE_OPERATION_ALLOT_PETTY_CASH"] },
  // ── RH
  { q: "cree une fiche employe", attendu: ["OP_HR_OPERATION_CREATE_EMPLOYEE"] },
  { q: "modifie le departement de cet employe", attendu: ["OP_ORG_OPERATION_ASSIGN_DEPARTMENT"] },
  { q: "change le manager de cette personne", attendu: ["OP_ORG_OPERATION_ASSIGN_MANAGER"] },
  { q: "valide la demande de conge", attendu: ["OP_HR_OPERATION_DECIDE_LEAVE"] },
  { q: "refuse ce conge", attendu: ["OP_HR_OPERATION_DECIDE_LEAVE"] },
  { q: "designe un interimaire pour ce conge", attendu: ["OP_HR_OPERATION_PROPOSE_STAND_IN"] },
  { q: "ajoute une ligne de paie", attendu: null, note: "« ligne » désigne six objets différents dans l'ERP — ambiguïté réelle" },
  { q: "modifie la ligne de paie", attendu: null, note: "idem : bulletin de paie ou rémunération de fiche ?" },
  { q: "cree une demande de recrutement", attendu: ["OP_HR_OPERATION_CREATE_RECRUITMENT"] },
  { q: "cree une demande de formation", attendu: ["OP_HR_OPERATION_REQUEST_TRAINING", "OP_HR_OPERATION_CREATE_HR_TRAINING"] },
  { q: "depose le contrat de cet employe", attendu: null, note: "le contrat RH et le document légal se disputent la phrase" },
  { q: "enregistre une note de frais", attendu: ["HR_REQUEST_CREATE"] },
  // ── Drive
  { q: "cree un dossier dans le drive", attendu: ["OP_DRIVE_OPERATION_CREATE_FOLDER"] },
  { q: "renomme ce fichier", attendu: ["OP_DRIVE_OPERATION_RENAME"] },
  { q: "deplace ce fichier vers un autre dossier", attendu: ["OP_DRIVE_OPERATION_MOVE"] },
  { q: "partage ce document avec Khaled", attendu: ["OP_DRIVE_OPERATION_SHARE"] },
  { q: "mets ce fichier a la corbeille", attendu: ["OP_DRIVE_OPERATION_TRASH"] },
  { q: "restaure ce fichier supprime", attendu: ["OP_DRIVE_OPERATION_RESTORE", "RECORD_RESTORE"] },
  { q: "copie ce document", attendu: ["OP_DRIVE_OPERATION_COPY"] },
  { q: "cree une categorie dans le drive", attendu: ["OP_DRIVE_OPERATION_CREATE_SPACE"] },
  { q: "televerse ce fichier dans le drive", attendu: null, note: "le téléversement Drive n'a pas d'action de registre distincte" },
  // ── Tâches & demandes
  { q: "cree une tache pour Sofiane", attendu: ["TASK_CREATE_OR_REQUEST"] },
  { q: "demande a Amel de preparer le dossier", attendu: ["TASK_CREATE_OR_REQUEST"] },
  { q: "assigne cette demande a quelqu'un", attendu: ["ADMIN_REQUEST_UPDATE"] },
  { q: "ajoute un commentaire a la demande", attendu: ["ADMIN_REQUEST_UPDATE", "OP_TASK_OPERATION_UPDATE_COMMENT"] },
  { q: "change le statut de la demande", attendu: ["ADMIN_REQUEST_UPDATE", "OP_SUPPORT_OPERATION_SET_SUPPORT_STATUS"] },
  // ── Agenda & réunions
  { q: "cree un evenement dans l'agenda", attendu: ["CALENDAR_EVENT_CREATE", "EVENT_CREATE"] },
  { q: "deplace cette reunion", attendu: ["CALENDAR_EVENT_UPDATE", "OP_MEETING_OPERATION_UPDATE_MEETING"] },
  { q: "annule ce rendez-vous", attendu: ["CALENDAR_EVENT_UPDATE"] },
  { q: "cree une reunion avec l'equipe", attendu: ["OP_MEETING_OPERATION_CREATE", "CALENDAR_EVENT_CREATE"] },
  { q: "invite quelqu'un a la reunion", attendu: ["OP_MEETING_OPERATION_ADD_PARTICIPANTS"] },
  // ── Legal & courriers
  { q: "cree un document legal", attendu: ["LEGAL_CREATE"] },
  { q: "modifie ce contrat", attendu: null, note: "contrat légal, contrat de consulting ou contrat RH — trois modules" },
  { q: "cree un dossier legal", attendu: ["OP_LEGAL_OPERATION_CREATE_FOLDER"] },
  { q: "enregistre un courrier au depart", attendu: ["OP_MAIL_OPERATION_CREATE_ENTRY"] },
  { q: "enregistre un courrier a l'arrivee", attendu: ["OP_MAIL_OPERATION_CREATE_ENTRY"] },
  { q: "cree un dossier de classement pour les courriers", attendu: ["OP_MAIL_OPERATION_CREATE_FOLDER"] },
  { q: "ajoute une piece au courrier", attendu: null, note: "joindre, modifier ou créer la pièce : le registre en a trois" },
  { q: "ajoute un partenaire aux courriers", attendu: ["OP_MAIL_OPERATION_CREATE_PARTNER"] },
  // ── Sponsoring, congrès, événements
  { q: "cree une demande de sponsoring", attendu: ["SPONSORING_CREATE"] },
  { q: "cree un congres", attendu: null, note: "le congrès se crée par une demande de prise en charge — vocabulaire absent du registre" },
  { q: "ajoute une personne au congres", attendu: ["OP_CARE_OPERATION_ADD_CARE_PERSON", "OP_ADPRO_OPERATION_ADD_CONGRESS_BENEFICIARY"] },
  { q: "cree une prise en charge", attendu: ["OP_ADPRO_OPERATION_ADD_CONGRESS_BENEFICIARY", "OP_CARE_OPERATION_ADD_CARE_PERSON", "CONGRESS_REQUEST_CREATE"] },
  { q: "cree un evenement", attendu: ["EVENT_CREATE"] },
  { q: "inscris quelqu'un a l'evenement", attendu: ["OP_EVENT_OPERATION_ADD_REGISTRATION"] },
  // ── Ad & Pro
  { q: "cree une demande ad&pro", attendu: ["OP_ADPRO_OPERATION_CREATE_OTHER_REQUEST"] },
  { q: "ajoute un poste a la demande", attendu: ["OP_ADPRO_OPERATION_ADD_ITEM"] },
  { q: "valide le poste de depense", attendu: ["OP_ADPRO_OPERATION_DECIDE_ITEM"] },
  { q: "cree une demande de materiel promotionnel", attendu: ["PROMO_MATERIAL_CREATE"] },
  { q: "mets a jour le stock de materiel promo", attendu: null, note: "le stock promo se modifie article par article" },
  // ── Administration
  { q: "desactive le compte de cette personne", attendu: ["ACCOUNT_SET_ACTIVE"] },
  { q: "change le role de cet utilisateur", attendu: ["ACCOUNT_SET_ROLE"] },
  { q: "invite une nouvelle personne", attendu: ["OP_ORG_OPERATION_CREATE_ACCOUNT_INVITE"] },
  { q: "cree un departement", attendu: ["OP_ORG_OPERATION_CREATE_DEPARTMENT"] },
  { q: "cree une entite", attendu: ["OP_ORG_OPERATION_CREATE_COMPANY"] },
  { q: "cree une gamme de produits", attendu: ["OP_ORG_OPERATION_CREATE_RANGE"] },
  { q: "ajoute un fournisseur", attendu: ["OP_ORG_OPERATION_CREATE_SUPPLIER", "OP_REGULATORY_OPERATION_CREATE_SUPPLIER"] },
  { q: "restaure un enregistrement supprime", attendu: ["RECORD_RESTORE"] },
  { q: "supprime definitivement cet enregistrement", attendu: ["RECORD_DELETE", "RECORD_PURGE"] },
  { q: "rends ce champ obligatoire", attendu: ["CUSTOM_FIELD_MANAGE"] },
  { q: "ajoute un champ personnalise", attendu: ["CUSTOM_FIELD_MANAGE"] },
  { q: "configure ce circuit de validation", attendu: ["WORKFLOW_CONFIGURE"] },
  // ── Stocks, PCH
  { q: "enregistre un etat de stock", attendu: ["OP_STOCK_OPERATION_RECORD_SNAPSHOT"] },
  { q: "demande un etat de stock hopital", attendu: ["OP_STOCK_OPERATION_REQUEST_STATE"] },
  { q: "cree un marche PCH", attendu: ["OP_PCH_OPERATION_CREATE_TENDER"] },
  { q: "depose l'appel d'offres", attendu: ["OP_PCH_OPERATION_CREATE_TENDER"] },
  // ── Annuaire & médical
  { q: "ajoute un medecin a l'annuaire", attendu: ["OP_MEDICAL_OPERATION_CREATE_DOCTOR"] },
  { q: "cree un annuaire de praticiens", attendu: ["OP_MEDICAL_OPERATION_CREATE_DIRECTORY"] },
  { q: "ajoute un etablissement de sante", attendu: ["HOSPITAL_CREATE", "OP_STOCK_OPERATION_CREATE_HOSPITAL"] },
  { q: "cree un contact d'entreprise", attendu: ["OP_ORG_OPERATION_CREATE_CONTACT"] },
  // ── Moyens généraux
  { q: "cree une demande d'achat", attendu: ["OP_REQUEST_OPERATION_CREATE_PURCHASE_REQUEST", "ADMIN_REQUEST_CREATE"] },
  { q: "ajoute un article au catalogue", attendu: ["OP_SUPPLY_OPERATION_CREATE_SUPPLY_ARTICLE"] },
  // ── Bureautique
  { q: "cree un document word", attendu: null, note: "« document » est le mot le plus banal de l'ERP : il désigne trente boutons" },
  { q: "ajoute un papier en-tete", attendu: null, note: "déposer ou modifier un en-tête — les deux existent, la phrase ne tranche pas" },
  // ── Messagerie
  { q: "envoie un message a Khaled", attendu: ["MESSAGE_SEND"] },
  { q: "archive ce mail", attendu: null, note: "aucune action d'archivage d'e-mail au registre" },
  // ── Rappels & directives
  { q: "rappelle-moi mardi de relancer Deepak", attendu: ["OP_TASK_OPERATION_CREATE_REMINDER"] },
  { q: "cree une directive", attendu: ["OP_DIRECTIVE_OPERATION_CREATE_DIRECTIVE"] },
  // ── Projets & BD
  { q: "cree un projet", attendu: ["DOSSIER_CREATE"] },
  { q: "ajoute une etude de marche", attendu: ["OP_BD_OPERATION_CREATE_RESEARCH"] },
  { q: "cree un produit dans le pipeline", attendu: ["OP_BD_OPERATION_CREATE", "OP_BD_OPERATION_CREATE_BD_PRODUCT"] },
  // ── Validations, consulting, terrain
  { q: "configure une regle de validation", attendu: ["OP_VALIDATION_OPERATION_TOGGLE_VALIDATION_RULE", "OP_VALIDATION_OPERATION_UPDATE_VALIDATION_RULE"] },
  { q: "cree une mission de consulting", attendu: ["OP_CONSULTING_OPERATION_CREATE_CONTRACT"] },
  { q: "cree un rapport terrain", attendu: ["OP_FIELD_REPORT_OPERATION_CREATE_FIELD_REPORT"] },
  { q: "attribue une gamme a ce delegue", attendu: ["OP_ORG_OPERATION_SET_USER_RANGES"] },
  { q: "cree une declaration d'information medicale", attendu: null, note: "la déclaration se crée depuis une visite — pas d'action directe" },
];

// ─────────────────────── II. Le corpus ADVERSE (rien ne doit sortir) ───────────────────────

/**
 * Ce que le PDG dit toute la journée sans rien demander d'écrire.
 *
 * Chaque famille attaque une faiblesse précise du résolveur — c'est pourquoi elles sont
 * étiquetées : quand l'une casse, on sait laquelle.
 */
const NON_ACTIONS: { q: string; famille: string }[] = [
  // Politesse et conversation
  { q: "bonjour Adam comment vas-tu", famille: "politesse" },
  { q: "merci beaucoup", famille: "politesse" },
  { q: "parfait, c'est note", famille: "politesse" },
  { q: "ok tres bien", famille: "politesse" },
  // Questions de lecture — le piège classique : elles contiennent les mots des boutons
  { q: "combien de dossiers gere Amel", famille: "question" },
  { q: "quel est le solde de tresorerie", famille: "question" },
  { q: "qui n'a pas encore repondu", famille: "question" },
  { q: "ou en est la demande de paiement de Kwality", famille: "question" },
  { q: "quelles sont les echeances de la semaine", famille: "question" },
  { q: "combien d'employes dans le departement commercial", famille: "question" },
  { q: "quel est le statut du dossier Nintedanib", famille: "question" },
  { q: "qui a valide cette depense", famille: "question" },
  { q: "quelles factures sont impayees", famille: "question" },
  { q: "combien de conges restent a Raihana", famille: "question" },
  // Lectures explicites
  { q: "resume moi la situation", famille: "lecture" },
  { q: "explique moi ce chiffre", famille: "lecture" },
  { q: "montre moi les dossiers en retard", famille: "lecture" },
  { q: "affiche la liste des fournisseurs", famille: "lecture" },
  { q: "liste les demandes de conge en attente", famille: "lecture" },
  { q: "trouve moi le contrat de Kwality", famille: "lecture" },
  { q: "cherche les factures de novembre", famille: "lecture" },
  { q: "d'ou vient ce montant", famille: "lecture" },
  { q: "qu'est-ce que j'ai rate depuis hier", famille: "lecture" },
  { q: "qu'est-ce qui bloque en ce moment", famille: "lecture" },
  { q: "consulte le solde du compte principal", famille: "lecture" },
  // Négations — les mots de l'action sont là, l'ordre est inverse
  { q: "ne supprime surtout pas ce dossier", famille: "negation" },
  { q: "n'envoie pas ce message pour l'instant", famille: "negation" },
  { q: "ne valide rien avant mon retour", famille: "negation" },
  { q: "surtout n'annule pas la reunion", famille: "negation" },
  { q: "ne modifie pas la fiche employe", famille: "negation" },
  { q: "n'archive aucun courrier cette semaine", famille: "negation" },
  { q: "ne partage ce document avec personne", famille: "negation" },
  { q: "ne retire personne du congres", famille: "negation" },
  // Circonstances : le mot du bouton n'est qu'un repère de temps ou de lieu
  { q: "prepare moi avant la reunion de demain", famille: "circonstance" },
  { q: "on se voit apres la validation du budget", famille: "circonstance" },
  { q: "rappelle-toi de ca pendant la reunion", famille: "circonstance" },
  // Constats, opinions, récits — aucune demande
  { q: "le dossier Nintedanib avance bien", famille: "constat" },
  { q: "la facture de Kwality est arrivee ce matin", famille: "constat" },
  { q: "cette depense me parait elevee", famille: "constat" },
  { q: "Amel a bien travaille sur ce dossier", famille: "constat" },
  { q: "le budget marketing est presque consomme", famille: "constat" },
  { q: "il y a eu un probleme avec le paiement", famille: "constat" },
  { q: "je pense que le circuit de validation est trop long", famille: "constat" },
  { q: "la reunion d'hier n'a servi a rien", famille: "constat" },
];

/**
 * LE CORPUS DANGEREUX — proche d'un geste irréversible, mais ne le demandant pas.
 *
 * C'est ici que se joue la règle absolue : « une action manquée est un désagrément, une action
 * destructrice erronée est inacceptable ». Aucune de ces phrases ne doit faire remonter un
 * bouton qui supprime, annule, refuse, retire un accès ou une affectation.
 */
const PROCHE_DU_DESTRUCTEUR: { q: string; piege: string }[] = [
  { q: "modifie ce dossier au lieu de le supprimer", piege: "le verbe destructeur est présent mais nié par la construction" },
  { q: "restaure ce fichier supprime", piege: "« supprimé » qualifie l'objet, il ne commande rien" },
  { q: "restaure un enregistrement supprime", piege: "idem, sur la corbeille administrative" },
  { q: "annule la suppression du dossier", piege: "« suppression » est le nom, « annule » le geste" },
  { q: "sors ce fichier de la corbeille", piege: "la corbeille est la source, pas la destination" },
  { q: "modifie le departement de cet employe", piege: "partage ses mots avec « supprimer cet employé »" },
  { q: "change le role de cet utilisateur", piege: "proche de « retirer les accès »" },
  { q: "modifie ce contrat", piege: "proche de « annuler le document légal »" },
  { q: "deplace cette reunion", piege: "proche de « supprimer la réunion »" },
  { q: "reporte cette reunion a jeudi", piege: "reporter n'est pas annuler" },
  { q: "mets a jour le prix du produit", piege: "proche de « défaire le rattachement produit »" },
  { q: "envoie un mail pour annoncer l'annulation", piege: "le geste est d'envoyer, l'annulation est le sujet" },
  { q: "prepare un message expliquant le refus", piege: "le geste est de préparer, le refus est le contenu" },
  { q: "ajoute un commentaire sur le refus des finances", piege: "idem, sur une demande de paiement" },
  { q: "consulte les elements supprimes", piege: "une lecture de la corbeille" },
  { q: "qui a supprime ce fichier", piege: "une question, malgré le verbe destructeur" },
  { q: "pourquoi cette demande a ete refusee", piege: "une question sur un refus passé" },
  { q: "verifie que le conge n'a pas ete refuse", piege: "vérification, verbe destructeur nié" },
  { q: "assigne ce dossier a Amel", piege: "proche de « désassigner »" },
  { q: "rattache l'employe au departement commercial", piege: "proche de « détacher »" },
  { q: "partage ce dossier avec l'equipe regulatory", piege: "proche de « retirer le partage »" },
  { q: "valide la demande de conge de Sofiane", piege: "proche de « refuser le congé »" },
  { q: "approuve le poste de depense", piege: "proche de « refuser le poste »" },
  { q: "marque la facture comme payee", piege: "proche de « annuler le payé »" },
  { q: "ajoute une personne au congres", piege: "proche de « retirer une personne du congrès »" },
  { q: "invite quelqu'un a la reunion", piege: "proche de « retirer un participant »" },
];

// ─────────────────────────────── III. Les mesures ───────────────────────────────

/**
 * Un bouton est DESTRUCTEUR quand son libellé COMMENCE par un verbe irréversible.
 *
 * La nuance est nécessaire : « Approuver / refuser le congé » et « Déplacer / annuler un
 * rendez-vous » contiennent un verbe destructeur sans être des boutons destructeurs — ce sont
 * des décisions à double sens, et c'est le PDG qui choisit le sens en parlant.
 */
function estDestructeur(id: string): boolean {
  const a = ERP_ACTIONS.find((x) => x.id === id);
  if (!a) return false;
  if (a.risk === "CRITICAL") return true;
  const tete = a.uiLabel.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return /^(supprim|detrui|purg|annul|refus|retir|desassign|desactiv|efface|vider|revoqu)/.test(tete);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

describe("banc doré — résolution des formulations réelles du PDG", () => {
  it("résout au moins 98 % des 110 formulations réelles", () => {
    const rates: string[] = [];
    for (const c of CORPUS) {
      if (matchNativeAction(c.q).length === 0) rates.push(c.q);
    }
    const resolus = CORPUS.length - rates.length;
    const pct = Math.round((100 * resolus) / CORPUS.length);
    console.log(`[ADAM_NL] rappel = ${pct}% (${resolus}/${CORPUS.length})`);
    if (rates.length > 0) console.log(`[ADAM_NL] non résolues : ${rates.join(" | ")}`);
    expect(pct).toBeGreaterThanOrEqual(98);
  });

  it("mène au BON bouton dans les deux premiers candidats", () => {
    const verifiables = CORPUS.filter((c) => c.attendu !== null);
    const manques: string[] = [];
    for (const c of verifiables) {
      const ids = matchNativeAction(c.q).map((a) => a.id);
      if (!ids.some((id) => c.attendu!.includes(id))) {
        manques.push(`${c.q} → ${ids.join(", ") || "∅"} (attendu ${c.attendu!.join(" | ")})`);
      }
    }
    const justes = verifiables.length - manques.length;
    const pct = Math.round((100 * justes) / verifiables.length);
    console.log(
      `[ADAM_NL] destination juste = ${pct}% (${justes}/${verifiables.length} vérifiables ; ` +
        `${CORPUS.length - verifiables.length} phrases sans bouton exact au registre)`,
    );
    manques.forEach((m) => console.log(`[ADAM_NL]   ≠ ${m}`));
    expect(pct).toBeGreaterThanOrEqual(95);
  });

  it("ne propose AUCUNE action sur les 44 phrases qui n'en demandent pas", () => {
    const faux: string[] = [];
    for (const n of NON_ACTIONS) {
      const m = matchNativeAction(n.q);
      if (m.length > 0) faux.push(`[${n.famille}] ${n.q} → ${m.map((a) => a.uiLabel).join(" | ")}`);
    }
    faux.forEach((f) => console.log(`[ADAM_NL]   ⚠ ${f}`));
    console.log(`[ADAM_NL] faux positifs = ${faux.length}/${NON_ACTIONS.length}`);
    expect(faux).toEqual([]);
  });

  it("ne propose JAMAIS un geste irréversible sur une phrase qui ne le commande pas", () => {
    const dangers: string[] = [];
    for (const c of PROCHE_DU_DESTRUCTEUR) {
      for (const a of matchNativeAction(c.q)) {
        if (estDestructeur(a.id)) dangers.push(`${c.q} → ${a.module} / ${a.uiLabel}  (${c.piege})`);
      }
    }
    dangers.forEach((d) => console.log(`[ADAM_NL]   ☠ ${d}`));
    console.log(`[ADAM_NL] faux positifs DESTRUCTEURS = ${dangers.length}/${PROCHE_DU_DESTRUCTEUR.length}`);
    expect(dangers).toEqual([]);
  });

  it("reste déterministe et rapide : p95 sous 5 ms, repli approché marginal", () => {
    const toutes = [...CORPUS.map((c) => c.q), ...NON_ACTIONS.map((n) => n.q), ...PROCHE_DU_DESTRUCTEUR.map((c) => c.q)];
    // Une passe à blanc : on mesure le résolveur, pas le premier chargement de l'index.
    toutes.forEach((q) => resolveNativeAction(q));

    const durees: number[] = [];
    let approche = 0;
    let ambigus = 0;
    for (const q of toutes) {
      const t0 = performance.now();
      const r = resolveNativeAction(q);
      durees.push(performance.now() - t0);
      if (r.path === "fuzzy") approche += 1;
      if (r.ambiguous) ambigus += 1;
    }
    durees.sort((a, b) => a - b);
    const p50 = percentile(durees, 50);
    const p95 = percentile(durees, 95);
    console.log(
      `[ADAM_NL] latence p50 = ${p50.toFixed(2)} ms · p95 = ${p95.toFixed(2)} ms · ` +
        `déterministe ${toutes.length - approche}/${toutes.length} · repli approché ${approche} · ambigus ${ambigus}`,
    );
    expect(p95).toBeLessThan(5);
    // Le repli approché est un DERNIER recours : s'il devient courant, le chemin déterministe
    // s'est dégradé et il faut le savoir.
    expect(approche / toutes.length).toBeLessThan(0.1);
  });
});

// ────────────── IV. Les échecs réels d'hier, gardés comme régressions ──────────────

/**
 * Chacun de ces cas a EFFECTIVEMENT échoué devant le PDG. Ils ne sont pas là pour faire nombre :
 * ils encodent une confusion précise, et ils cassent si elle revient.
 */
describe("régressions — les confusions déjà payées", () => {
  it("« demande à X de faire Y » est une TÂCHE, pas une action du module cité", () => {
    const ids = matchNativeAction("demande a Amel de preparer le dossier regulatory").map((a) => a.id);
    expect(ids).toContain("TASK_CREATE_OR_REQUEST");
  });

  it("une demande de tâche sans second verbe reste ce qu'elle dit", () => {
    // « demande la facture » ne délègue rien : la construction infinitive fait la tâche.
    const p = parsePhrase("demande la facture de l'ordre de depense");
    expect(p.objects).not.toContain("tache");
  });

  it("« modifie » n'atteint jamais « supprime » — l'opposition prime sur la ressemblance", () => {
    expect(relateIntents(new Set(["UPDATE"]), new Set(["DELETE"]))).toBe("OPPOSED");
    expect(relateIntents(new Set(["APPROVE"]), new Set(["REJECT"]))).toBe("OPPOSED");
    expect(relateIntents(new Set(["ASSIGN"]), new Set(["UNASSIGN"]))).toBe("OPPOSED");
    expect(relateIntents(new Set(["ARCHIVE"]), new Set(["RESTORE"]))).toBe("OPPOSED");
    // Et un voisinage ne doit pas masquer une opposition présente par ailleurs.
    expect(relateIntents(new Set(["ARCHIVE"]), new Set(["RESTORE", "DELETE"]))).toBe("OPPOSED");
  });

  it("« change le manager » atteint « Désigner le N+1 » — modifier et affecter sont voisins", () => {
    expect(relateIntents(new Set(["UPDATE"]), new Set(["ASSIGN"]))).toBe("RELATED");
    const ids = matchNativeAction("change le manager de cette personne").map((a) => a.id);
    expect(ids).toContain("OP_ORG_OPERATION_ASSIGN_MANAGER");
  });

  it("Regulatory et l'Explorateur de produits ne se confondent plus", () => {
    const reg = matchNativeAction("cree un dossier regulatory pour ce produit").map((a) => a.module);
    expect(reg.some((m) => m.includes("Regulatory"))).toBe(true);
    const bd = matchNativeAction("cree un produit dans le pipeline").map((a) => a.module);
    expect(bd.some((m) => m.includes("Business Development"))).toBe(true);
  });

  it("« l'accès de X » et « l'affectation de X » sont deux choses", () => {
    const acces = matchNativeAction("desactive le compte de cette personne").map((a) => a.id);
    expect(acces).toContain("ACCOUNT_SET_ACTIVE");
    const affectation = matchNativeAction("assigne le dossier a Amel").map((a) => a.id);
    expect(affectation).toContain("REGULATORY_ASSIGN_RESPONSIBLE");
    expect(affectation).not.toContain("ACCOUNT_SET_ACTIVE");
  });

  it("l'actualisation des soldes est une action NATIVE des Finances", () => {
    for (const phrase of [
      "actualise les soldes de tresorerie",
      "demande l'actualisation des soldes",
      "rafraichis les soldes",
    ]) {
      const ids = matchNativeAction(phrase).map((a) => a.id);
      expect(ids, phrase).toContain("FINANCE_REQUEST_BALANCE_REFRESH");
    }
  });

  it("un dossier du Drive n'est pas un dossier réglementaire", () => {
    const drive = matchNativeAction("cree un dossier dans le drive").map((a) => a.id);
    expect(drive).toContain("OP_DRIVE_OPERATION_CREATE_FOLDER");
  });

  it("les reprises de conversation ne déclenchent rien toutes seules", () => {
    for (const suite of ["alors ?", "et donc ?", "fais-le", "vas-y", "les deux", "ok", "et apres ?"]) {
      expect(matchNativeAction(suite), suite).toEqual([]);
    }
  });

  it("une reprise peut viser l'action DÉJÀ proposée — jamais si elle est irréversible", () => {
    const douce = ERP_ACTIONS.find((a) => a.id === "OP_DRIVE_OPERATION_CREATE_FOLDER")!;
    const reprise = resolveNativeAction("fais-le", { pendingActionId: douce.id });
    // « fais-le » n'a ni objet ni intention : même avec un contexte, on ne devine pas.
    expect(reprise.candidates).toEqual([]);

    // Avec un verbe, en revanche, la reprise porte — et reste de faible confiance.
    const avecVerbe = resolveNativeAction("cree-le", { pendingActionId: douce.id });
    expect(avecVerbe.candidates.map((c) => c.action.id)).toContain(douce.id);
    expect(avecVerbe.candidates[0].confidence).toBe("LOW");

    // La même reprise sur un geste irréversible ne rend RIEN.
    const dure = ERP_ACTIONS.find((a) => a.risk === "CRITICAL")!;
    expect(resolveNativeAction("fais-le", { pendingActionId: dure.id }).candidates).toEqual([]);
  });

  it("le contexte d'écran départage sans jamais décider seul", () => {
    // « ajoute un poste à la demande » vise le recrutement en RH, la dépense en Ad&Pro.
    const surAdPro = resolveNativeAction("ajoute un poste a la demande", { screenModule: "Ad & Pro" });
    expect(surAdPro.candidates.map((c) => c.action.id)).toContain("OP_ADPRO_OPERATION_ADD_ITEM");

    // Mais le contexte ne fabrique pas une action là où la phrase n'en demande aucune.
    expect(
      resolveNativeAction("combien de postes ouverts", { screenModule: "Ad & Pro" }).candidates,
    ).toEqual([]);
  });

  it("un sigle métier vaut son expression complète, dans les deux sens", () => {
    expect(parsePhrase("le BC de Kwality").objects).toContain("commande");
    expect(parsePhrase("un bon de commande").objects).toContain("commande");
    expect(parsePhrase("depose l'AO").objects).toContain("offre");
    expect(parsePhrase("depose l'appel d'offres").objects).toContain("offre");
  });
});

// ─────────────────── V. Les règles de langue, prises une par une ───────────────────

describe("le lexique — les règles qui portent tout le reste", () => {
  it("le PLURIEL ne change pas le radical", () => {
    for (const [s, p] of [
      ["gamme", "gammes"], ["dossier", "dossiers"], ["personne", "personnes"],
      ["facture", "factures"], ["tache", "taches"], ["enveloppe", "enveloppes"],
      ["courrier", "courriers"], ["poste", "postes"], ["ligne", "lignes"],
    ]) {
      expect(stemNoun(s), `${s}/${p}`).toBe(stemNoun(p));
    }
  });

  it("un radical verbal suivi d'une terminaison NON verbale reste un nom", () => {
    // « établissement » n'est pas le verbe « établir » ; « général » n'est pas « générer ».
    expect(parsePhrase("ajoute un etablissement de sante").objects).toContain("etablissement");
    expect(parsePhrase("les moyens generaux").objects.join(" ")).toContain("general");
    expect(parsePhrase("un enregistrement").objects.length).toBeGreaterThan(0);
    expect(parsePhrase("le classement des courriers").objects).toContain("classement");
  });

  it("ce qui suit un déterminant est un nom — sauf un infinitif", () => {
    expect(parsePhrase("assigne cette demande").objects).toContain("demande");
    expect(parsePhrase("demande a Amel").objects).not.toContain("demande");
    // « de relancer » : le « de » marque l'infinitif, pas un article.
    expect(parsePhrase("demande a Amel de relancer Deepak").verbs).toContain("relanc");
  });

  it("le PREMIER verbe porte l'ordre ; les suivants ne sont que des qualificatifs", () => {
    const p = parsePhrase("restaure ce fichier supprime");
    expect([...p.headIntents]).toEqual(["RESTORE"]);
    expect([...p.intents]).toContain("DELETE");
    // C'est cette distinction qui interdit la suppression.
    expect([...p.headIntents]).not.toContain("DELETE");
  });

  it("la négation retire l'intention la plus proche, et elle seule", () => {
    const p = parsePhrase("ne supprime pas ce dossier, modifie-le");
    expect([...p.negatedIntents]).toContain("DELETE");
    expect([...p.intents]).toContain("UPDATE");
    expect([...p.intents]).not.toContain("DELETE");
  });

  it("les accents, apostrophes et majuscules ne changent rien", () => {
    expect(flatten("Crée l'enveloppe")).toBe(flatten("CREE L ENVELOPPE"));
    expect(flatten("l’appel d’offres")).toBe(flatten("l'appel d'offres"));
    expect(matchNativeAction("Crée une enveloppe budgétaire").map((a) => a.id)).toEqual(
      matchNativeAction("cree une enveloppe budgetaire").map((a) => a.id),
    );
  });

  it("le TEMPS et les noms propres sont des arguments, jamais des boutons", () => {
    // Ni « mardi » ni « Deepak » ne désignent une action : seul « rappelle » le fait.
    const ids = matchNativeAction("rappelle-moi mardi de relancer Deepak").map((a) => a.id);
    expect(ids).toContain("OP_TASK_OPERATION_CREATE_REMINDER");
    // Et un nom propre seul ne désigne rien.
    expect(matchNativeAction("Nintedanib")).toEqual([]);
  });

  it("le repli approché rattrape une faute de frappe — et JAMAIS un geste irréversible", () => {
    // Le chemin exact ne rend rien : « lenveloppe » n'existe dans aucun alias.
    const faute = resolveNativeAction("modifie lenveloppe");
    expect(faute.path).toBe("fuzzy");
    expect(faute.candidates.map((c) => c.action.id)).toContain("OP_FINANCE_OPERATION_UPDATE_ENVELOPE");
    // Et il ne rend jamais une CONFIANCE forte : il devine, il ne sait pas.
    expect(faute.candidates.every((c) => c.confidence === "LOW" || c.confidence === "NONE")).toBe(true);

    // La même faute derrière un verbe destructeur ne rend RIEN : deviner et détruire ne vont
    // pas ensemble.
    const danger = resolveNativeAction("supprime lenveloppe");
    expect(danger.candidates).toEqual([]);
  });

  it("ce qui ACCOMPAGNE pèse moins que ce qui est visé", () => {
    const p = parsePhrase("cree une reunion avec l'equipe");
    expect(p.complements).toContain("equipe");
    expect(p.complements.has("reunion")).toBe(false);
  });
});
