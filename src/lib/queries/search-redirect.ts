/**
 * QUAND LA RECHERCHE FÉDÉRÉE NE TROUVE RIEN, DIRE OÙ CHERCHER.
 *
 * LE BOGUE QUE CE MODULE FERME, observé en production, mot pour mot :
 *
 *   PDG    — « est-ce que tu as les adresses mail des salariés ? »
 *   Adam   — « je ne peux pas confirmer une liste complète… »
 *   PDG    — « Non, non, je veux que tu les tires tous, dans un tableau. »
 *   Adam   — appelle `search_everything`… deux fois… zéro résultat… puis abandonne.
 *
 * DEUX FAUTES, ET LA SECONDE EST CELLE QU'ON RÉPARE ICI.
 *
 * La première : `search_everything` était présenté au modèle comme LE réflexe, à appeler en
 * premier pour tout. Un annuaire d'entreprise n'est pas « quelque part dans l'ERP » : c'est une
 * table, avec un outil dédié. (Corrigé dans le briefing des outils.)
 *
 * La seconde, plus insidieuse : quand la recherche ne trouvait rien, elle répondait « essayer un
 * synonyme (nom commercial ↔ DCI) » — un conseil sur les NOMS DE MOLÉCULES, servi à une question
 * sur des adresses e-mail. Cette note n'est pas seulement inutile : elle est une IMPASSE. Elle
 * dit au modèle « réessaie la même chose autrement », alors que la bonne réponse était « ce n'est
 * pas le bon outil ». D'où les deux appels identiques, puis le renoncement.
 *
 * UN OUTIL QUI ÉCHOUE DOIT INDIQUER LA SORTIE. C'est tout ce que fait ce module : à partir de ce
 * qui a été cherché, il nomme l'outil qui, lui, saurait répondre. Zéro résultat cesse d'être un
 * cul-de-sac pour devenir un aiguillage.
 *
 * Pur, sans base ni réseau : il ne lit que la requête.
 */

const norm = (s: string): string =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * LES FAMILLES QUI ONT UN OUTIL DÉDIÉ, dans l'ordre où on les teste.
 *
 * L'ordre compte : « les adresses mail des salariés » touche à la fois les coordonnées et les
 * ressources humaines. L'annuaire passe en premier parce que c'est lui qui porte les ADRESSES —
 * l'outil RH donnerait un effectif, pas des e-mails.
 */
const REDIRECTS: { when: RegExp; hint: string }[] = [
  {
    // Coordonnées de personnes — le cas exact du bogue.
    when: /\b(adresse|adresses|mail|mails|e mail|e mails|email|emails|courriel|courriels|telephone|telephones|numero|numeros|contact|contacts|coordonnees|joindre|whatsapp)\b/,
    hint: "Pour des COORDONNÉES de personnes (adresse e-mail, téléphone, WhatsApp), la recherche "
      + "fédérée n'est pas la bonne porte : appeler `directory_list` pour la LISTE (salariés, "
      + "contacts) ou `directory_lookup` pour UNE personne. Ils rendent un tableau avec la "
      + "provenance de chaque coordonnée.",
  },
  {
    // Les gens eux-mêmes, sans mention de coordonnées.
    when: /\b(salarie|salaries|employe|employes|personnel|effectif|equipe|equipes|collegue|collegues|collaborateur|collaborateurs)\b/,
    hint: "Pour les PERSONNES de l'entreprise : `directory_list` (annuaire avec coordonnées) ou "
      + "`read_hr_overview` (effectif, départements). La recherche fédérée ne remplace pas le registre RH.",
  },
  {
    when: /\b(mail|mails|boite|messagerie|fil|thread|expediteur|destinataire|repondu)\b/,
    hint: "Pour la BOÎTE MAIL du dirigeant : `gmail_search`, puis `gmail_read_thread` pour un fil précis.",
  },
  {
    when: /\b(document|documents|fichier|fichiers|pdf|excel|word|contrat|contrats|piece|pieces)\b/,
    hint: "Pour un DOCUMENT : `find_documents` (recherche sémantique du Drive) ou `gdrive_search`.",
  },
  {
    when: /\b(rendez vous|rdv|agenda|calendrier|reunion|reunions|creneau)\b/,
    hint: "Pour l'AGENDA : `read_calendar` ou `gcal_search`.",
  },
  {
    when: /\b(dossier|dossiers|produit|produits|molecule|dci|anpp|amm|soumission|presoumission)\b/,
    // Ici seulement, le conseil sur les dénominations a un sens : c'est bien de pharmacie qu'on parle.
    hint: "Pour un DOSSIER RÉGLEMENTAIRE ou un produit : `regulatory_portfolio`, ou `inspect_record` "
      + "avec la référence exacte. Un même médicament peut être cité par son nom commercial ou par "
      + "sa DCI — essayer l'autre dénomination, ou un fragment plus court.",
  },
  {
    when: /\b(paiement|paiements|facture|factures|budget|tresorerie|depense|depenses|solde)\b/,
    hint: "Pour les CHIFFRES financiers : `read_finances`, `read_budget` ou `finance_totals`.",
  },
];

/** Le conseil par défaut — utile, et sans supposer que tout est un médicament. */
const GENERIC =
  "Essayer un fragment plus court, une autre orthographe, ou un outil spécialisé "
  + "(`directory_lookup` pour une personne, `find_documents` pour un fichier, "
  + "`regulatory_portfolio` pour un dossier).";

/**
 * L'AIGUILLAGE. Rend la sortie à prendre, jamais `null` : un outil qui échoue doit TOUJOURS dire
 * quelque chose d'actionnable, sinon le modèle se contente de retenter la même chose.
 */
export function emptySearchHint(query: string): string {
  const q = norm(query);
  if (!q) return GENERIC;
  for (const r of REDIRECTS) {
    if (r.when.test(q)) return r.hint;
  }
  return GENERIC;
}

/** La note complète déposée dans le résultat vide. */
export function emptySearchNote(query: string): string {
  return `Aucun résultat dans la recherche fédérée. ${emptySearchHint(query)}`;
}
