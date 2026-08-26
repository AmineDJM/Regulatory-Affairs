/**
 * LE STYLE DU CHEF DE CABINET — court, décidé, sans cérémonie.
 *
 * LE DÉFAUT QUE CE MODULE CORRIGE. Adam se comportait en agent conversationnel : il annonçait ce
 * qu'il allait faire, demandait si la formulation convenait, proposait de chercher au lieu de
 * chercher, et terminait chaque réponse par une question. Résultat mesuré sur un vrai échange :
 * huit tours pour envoyer un message de deux lignes. Le PDG se retrouvait à piloter le workflow
 * de son assistant — exactement l'inverse du service rendu.
 *
 * LA RÈGLE. Un chef de cabinet expérimenté ne demande pas quel objet mettre à un mail de prise de
 * nouvelles : il l'écrit, le montre, et attend le feu vert. Une question qu'on peut trancher soi
 * même sans risque est une question qu'on ne pose pas. Celles qu'on pose encore — « Pharmagene ou
 * Gmail ? » — sont celles où se tromper coûte vraiment quelque chose.
 *
 * On ne cherche pas la politesse conversationnelle : on cherche le DÉBIT EXÉCUTIF.
 */

/** Le style, dit une seule fois pour le texte et pour la voix. */
export const CHIEF_STYLE_RULES = `STYLE — TAC AU TAC (impératif) :
- RÉSULTAT ou ACTION D'ABORD. L'explication seulement si elle change quelque chose. Par défaut :
  1 à 3 phrases courtes. Une réponse d'une ligne est une bonne réponse.
- NE TERMINE PAS par une question ou une suggestion. Réponds, agis, arrête-toi. La carte d'action
  pose déjà la seule question qui compte.
- N'ANNONCE PAS ce que tu vas faire (« je vais regarder… », « laisse-moi vérifier… ») : fais-le,
  puis donne le résultat. Ne décris jamais tes outils, tes fonctions, tes API ni ta mécanique
  interne — sauf si on te le demande explicitement.
- TRANCHE CE QUI PEUT L'ÊTRE. Bannis « je peux… », « souhaites-tu… », « tu veux que… », « ça te
  convient ? », « j'ai besoin d'un peu plus d'informations » quand la réponse se déduit sans
  risque. Choisis un objet, rédige un corps, retrouve une adresse — et MONTRE le résultat.
- NE POSE UNE QUESTION QUE SI L'AMBIGUÏTÉ EMPÊCHE D'AGIR SANS RISQUE, et alors une seule, courte
  (« Amine : Pharmagene ou Gmail ? »). Rien de plus.
- NE DIS JAMAIS qu'une carte « devrait apparaître », ni « clique sur Envoyer ». Si tu prépares un
  envoi, la carte EST là ; et si le PDG répond « envoie », le message part — il n'a rien à cliquer.
- NE PROPOSE PAS DE CHERCHER : cherche. « Je peux essayer de retrouver son adresse » est une
  non-réponse ; l'adresse, ou son absence constatée, en est une.
- RÉPONDS À LA QUESTION POSÉE, ET RIEN DE PLUS. « Il reste combien sur Ad & Pro ? » appelle UN
  montant, pas la ventilation par poste, ni le taux de consommation, ni les dépenses du mois.
  Tu as lu tout cela : garde-le. Si le PDG veut le détail, il le demandera.
- UN AGRÉGAT SE DONNE AVEC SON PÉRIMÈTRE. Un effectif, une masse salariale, un total qui couvre
  PLUSIEURS entités ne s'annonce jamais au nom d'une seule. Les lectures rendent un champ
  « perimetre » et une ventilation : cite le périmètre en une incise (« 18 sur tout le groupe »),
  et si l'on t'a nommé une société, donne LE chiffre de cette société.
- « T'ES SÛR ? » N'EST PAS UNE DEMANDE DE RÉPÉTITION. Une contestation te fait RELIRE la source —
  au bon périmètre, avec le bon filtre — puis dire ce que tu trouves. Ne réaffirme jamais un
  chiffre en le décorant d'assurance (« oui, bonne pioche ») : si après relecture il ne bouge
  pas, dis ce qu'il COUVRE, car c'est presque toujours là qu'est le malentendu.`;

/**
 * Ce qu'on écrit quand le PDG n'a rien dicté — des valeurs par défaut ASSUMÉES, pas des trous.
 *
 * Demander « quel objet ? » pour un message de prise de nouvelles fait perdre un tour et
 * n'améliore rien : l'objet est évident, et la carte permet de le corriger d'un geste avant
 * l'envoi. Le défaut n'est donc pas un pari — c'est une proposition VISIBLE et rectifiable.
 */
export const DEFAULT_MAIL_SUBJECT = "Prise de nouvelles";

/**
 * Un objet inféré à partir de l'intention, quand le PDG en a dit assez pour qu'on devine.
 *
 * Fonction PURE et volontairement modeste : quelques intentions très courantes, et sinon le
 * défaut. Elle n'essaie pas d'être maligne — elle essaie de ne pas poser une question inutile.
 */
export function inferMailSubject(body: string): string {
  const t = body.toLowerCase();
  if (/\brelance|\brappel|\bmerci de revenir|\bsans réponse/.test(t)) return "Relance";
  if (/\bfactur|\bpaiement|\brèglement|\bvirement/.test(t)) return "Facturation";
  if (/\bréunion|\brendez-?vous|\bdisponibilit|\bcréneau/.test(t)) return "Organisation d'un point";
  if (/\bcommande|\bbon de commande|\blivraison/.test(t)) return "Commande";
  if (/\bdossier|\banpp|\bréglementaire|\bctd/.test(t)) return "Dossier réglementaire";
  if (/\bcontrat|\bavenant|\bsignature/.test(t)) return "Contrat";
  return DEFAULT_MAIL_SUBJECT;
}

/**
 * Le corps par défaut d'une prise de nouvelles — la demande la plus fréquente, et celle où
 * l'aller-retour « quel contenu ? » est le plus absurde.
 */
export function defaultMailBody(recipientFirstName: string | null): string {
  const bonjour = recipientFirstName ? `Bonjour ${recipientFirstName}` : "Bonjour";
  return `${bonjour}, j'espère que tu vas bien.`;
}

/** Le prénom d'usage, tiré d'un nom complet ou d'une adresse — pour tutoyer correctement. */
export function firstNameOf(nameOrEmail: string): string | null {
  const raw = (nameOrEmail ?? "").trim();
  if (!raw) return null;
  const base = raw.includes("@") ? raw.split("@")[0] : raw;
  const first = base.split(/[\s._-]+/).filter(Boolean)[0];
  if (!first || first.length < 2) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
