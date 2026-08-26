import { describe, expect, it } from "vitest";
import { matchNativeAction, ERP_ACTIONS } from "./action-registry";

/**
 * BANC GOLDEN — 110 FORMULATIONS RÉELLES DE PDG, ET CE QU'ELLES ATTEIGNENT.
 *
 * Le langage naturel est l'API primaire d'Adam. Un bouton existe peut-être dans le registre :
 * s'il n'est atteint par aucune façon HUMAINE de le demander, il n'existe pas pour le PDG.
 *
 * Le banc mesure `matchNativeAction`, qui est PUR — aucun appel de modèle, donc un résultat
 * identique à chaque exécution. C'est ce qui en fait une mesure et non une impression : on peut
 * comparer deux versions du code sur le même corpus.
 *
 * Trois propriétés, et la troisième est la plus importante :
 *   1. RAPPEL — quelle proportion des demandes atteint une action native (cliquet : jamais moins) ;
 *   2. PRÉCISION — une question qui n'appelle aucune écriture ne doit RIEN déclencher ;
 *   3. SÛRETÉ — une demande bénigne ne doit jamais désigner une action IRRÉVERSIBLE.
 *
 * Un indice FAUX est pire qu'un silence : il pousse le modèle vers le mauvais bouton, alors que
 * l'absence d'indice le laisse chercher. D'où des seuils séparés — on ne troque pas l'un
 * contre l'autre sans le voir.
 *
 * Mesure de référence (avant racinisation + correspondance partielle) : 54 % de rappel.
 */

/** Les demandes d'ÉCRITURE : chacune doit atteindre au moins une action native. */
const REQUESTS: string[] = [
  // Regulatory
  "assigne le dossier Nintedanib a Raihana",
  "reassigne ce dossier a Amel",
  "change le charge du dossier",
  "relance la mise a jour des dossiers regulatory",
  "ajoute un participant au dossier",
  // Finances & budgets
  "actualise les soldes de tresorerie",
  "demande l'actualisation des soldes",
  "cree une enveloppe budgetaire",
  "modifie le montant de l'enveloppe",
  "impute cette depense au budget",
  "marque la facture comme payee",
  "refuse cette demande de paiement",
  "enregistre un encaissement",
  "impute une depense a ma caisse d'avance",
  "recharge la caisse d'avance",
  // RH
  "cree une fiche employe",
  "modifie le departement de cet employe",
  "change le manager de cette personne",
  "valide la demande de conge",
  "refuse ce conge",
  "designe un interimaire pour ce conge",
  "cree une demande de recrutement",
  "cree une demande de formation",
  "enregistre une note de frais",
  // Drive
  "cree un dossier dans le drive",
  "renomme ce fichier",
  "deplace ce fichier vers un autre dossier",
  "partage ce document avec Khaled",
  "mets ce fichier a la corbeille",
  "restaure ce fichier supprime",
  "cree une categorie dans le drive",
  // Tâches & demandes
  "cree une tache pour Sofiane",
  "assigne cette demande a quelqu'un",
  "change le statut de la demande",
  // Agenda & réunions
  "cree un evenement dans l'agenda",
  "annule ce rendez-vous",
  "invite quelqu'un a la reunion",
  // Legal & courriers
  "cree un document legal",
  "cree un dossier legal",
  "enregistre un courrier au depart",
  "enregistre un courrier a l'arrivee",
  "cree un dossier de classement pour les courriers",
  "ajoute un partenaire aux courriers",
  // Sponsoring, congrès, événements
  "cree une demande de sponsoring",
  "ajoute une personne au congres",
  "cree une prise en charge",
  "cree un evenement",
  // Ad & Pro
  "cree une demande ad&pro",
  "valide le poste de depense",
  "cree une demande de materiel promotionnel",
  // Administration
  "desactive le compte de cette personne",
  "change le role de cet utilisateur",
  "invite une nouvelle personne",
  "cree un departement",
  "cree une entite",
  "cree une gamme de produits",
  "restaure un enregistrement supprime",
  "supprime definitivement cet enregistrement",
  "rends ce champ obligatoire",
  "ajoute un champ personnalise",
  "configure ce circuit de validation",
  // Stocks & PCH
  "enregistre un etat de stock",
  "demande un etat de stock hopital",
  "depose l'appel d'offres",
  // Annuaire & médical
  "ajoute un medecin a l'annuaire",
  "cree un annuaire de praticiens",
  "cree un contact d'entreprise",
  // Moyens généraux
  "cree une demande d'achat",
  "ajoute un article au catalogue",
  // Bureautique
  "cree un document word",
  "ajoute un papier en-tete",
  // Messagerie & rappels
  "envoie un message a Khaled",
  "rappelle-moi mardi de relancer Deepak",
  // Projets & BD
  "cree un projet",
  "ajoute une etude de marche",
  // Validations, consulting, terrain
  "configure une regle de validation",
  "cree une mission de consulting",
  "cree un rapport terrain",
  "cree une declaration d'information medicale",
  // ── Formulations qui NE résolvent PAS aujourd'hui.
  //
  // Elles restent dans le corpus VOLONTAIREMENT. Les retirer ferait grimper le score sans que
  // rien ne s'améliore pour le PDG : un banc qu'on nettoie de ses échecs ne mesure plus que
  // l'habileté de celui qui l'écrit. Chacune est une façon normale de demander la chose ;
  // qu'elles manquent est un constat, pas un défaut du test.
  "passe le dossier a l'etape suivante",
  "exporte le tableau regulatory en excel",
  "cree une facture",
  "ajoute une ligne de paie",
  "modifie la ligne de paie",
  "copie ce document",
  "televerse ce fichier dans le drive",
  "demande a Amel de preparer le dossier",
  "ajoute un commentaire a la demande",
  "deplace cette reunion",
  "modifie ce contrat",
  "cree un congres",
  "ajoute un poste a la demande",
  "ajoute un fournisseur",
  "ajoute un etablissement de sante",
  "archive ce mail",
  "cree une directive",
  "cree un produit dans le pipeline",
  "attribue une gamme a ce delegue",
];

/**
 * CONTRÔLE DE PRÉCISION — des QUESTIONS, des politesses, des demandes d'analyse.
 * Aucune ne doit désigner un bouton d'écriture : ce sont des lectures ou du dialogue.
 */
const NON_ACTIONS: string[] = [
  "bonjour Adam comment vas-tu",
  "merci beaucoup",
  "qu'est-ce que j'ai rate depuis hier",
  "combien de dossiers gere Amel",
  "quel est le solde de tresorerie",
  "qui n'a pas encore repondu",
  "resume moi la situation",
  "explique moi ce chiffre",
  "d'ou vient ce montant",
  "qu'est-ce qui bloque en ce moment",
  "prepare moi avant la reunion de demain",
  "quelles sont les echeances de la semaine",
];

/**
 * SÛRETÉ — des demandes BÉNIGNES qui ressemblent à des gestes destructeurs par leurs mots.
 * Aucune ne doit faire remonter une action IRRÉVERSIBLE : suggérer « Supprimer définitivement »
 * à qui demande une modification est le pire faux positif que ce résolveur puisse produire.
 */
const BENIGN_NEAR_DESTRUCTIVE: string[] = [
  "modifie le departement de cet employe",
  "depose le contrat de cet employe",
  "mets a jour le dossier de cet employe",
  "corrige le telephone de ce contact",
  "change le statut de ce courrier",
];

describe("banc golden ADAM — le langage du PDG atteint-il les vrais boutons ?", () => {
  it("RAPPEL : au moins 80 % des demandes atteignent une action native (cliquet)", () => {
    const resolved = REQUESTS.filter((q) => matchNativeAction(q).length > 0);
    const pct = Math.round((100 * resolved.length) / REQUESTS.length);

    const misses = REQUESTS.filter((q) => matchNativeAction(q).length === 0);
    // Le détail sort dans le rapport de test : une régression doit se lire, pas se deviner.
    console.log(`[ADAM_GOLDEN] rappel=${pct}% (${resolved.length}/${REQUESTS.length})`);
    if (misses.length) console.log(`[ADAM_GOLDEN] sans correspondance :\n  - ${misses.join("\n  - ")}`);

    // Cliquet : ce seuil ne descend jamais. Le relever quand la mesure progresse.
    expect(pct).toBeGreaterThanOrEqual(80);
  });

  it("PRÉCISION : une question ou une politesse ne déclenche AUCUNE action", () => {
    const faux = NON_ACTIONS.filter((q) => matchNativeAction(q).length > 0)
      .map((q) => `${q} → ${matchNativeAction(q).map((a) => a.uiLabel).join(" / ")}`);
    expect(faux).toEqual([]);
  });

  it("SÛRETÉ : une demande bénigne ne propose JAMAIS une action irréversible", () => {
    const dangereux: string[] = [];
    for (const q of BENIGN_NEAR_DESTRUCTIVE) {
      for (const a of matchNativeAction(q)) {
        if (a.risk === "CRITICAL") dangereux.push(`${q} → ${a.uiLabel} [${a.module}]`);
      }
    }
    expect(dangereux).toEqual([]);
  });

  it("le corpus couvre largement l'ERP — au moins 20 modules distincts atteints", () => {
    const modules = new Set<string>();
    for (const q of REQUESTS) for (const a of matchNativeAction(q)) modules.add(a.module);
    expect(modules.size).toBeGreaterThanOrEqual(20);
  });

  it("le banc reste représentatif : au moins 75 demandes et 10 contrôles", () => {
    // Sans ce garde-fou, on pourrait « améliorer » le rappel en retirant les cas difficiles.
    expect(REQUESTS.length).toBeGreaterThanOrEqual(75);
    expect(NON_ACTIONS.length).toBeGreaterThanOrEqual(10);
  });

  it("chaque action native porte au moins un alias — sinon elle est inatteignable", () => {
    const muettes = ERP_ACTIONS.filter((a) => a.aliases.length === 0).map((a) => a.id);
    expect(muettes).toEqual([]);
  });
});
