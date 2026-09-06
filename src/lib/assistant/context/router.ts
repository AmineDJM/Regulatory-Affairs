import { CALCUL_EXPLICITE, RESEAU_EXPLICITE, routeVoiceUtterance, normalizeUtterance, isOutboundMail, type VoiceContext, type VoiceRouteKind } from "@/lib/assistant/voice/fast-path";
import type { BudgetTier } from "./budget";

/**
 * LE ROUTEUR DE REQUÊTE — décider CE QUE COÛTE une question avant de la payer.
 *
 * LE DÉFAUT QU'ON FERME. Aujourd'hui, « Des mails ? » et « Pourquoi Nintedanib est-il en retard ? »
 * empruntent le même chemin : le même prompt de plusieurs milliers de tokens, la même liste
 * complète d'outils, la même boucle d'agent. La seconde question le mérite. La première paie une
 * à trois secondes et quelques milliers de tokens pour un fait que l'ERP rend en une requête.
 *
 * LES QUATRE ROUTES de la mission, plus une.
 *
 *   FAST_DETERMINISTIC — le code répond. Zéro appel de modèle.
 *   STRUCTURED_QUERY   — la réponse est une ligne de base : on la lit, on ne la « retrouve » pas.
 *   HYBRID_RETRIEVAL   — la réponse est dans du non structuré : lexical + vecteurs + reranking.
 *   DEEP_REASONING     — causalité, synthèse, contradiction, stratégie. Le modèle fort.
 *   ACTION             — ← l'ajout, et il est assumé.
 *
 * POURQUOI ACTION EXISTE ALORS QUE LA MISSION N'EN CITE QUE QUATRE. « Assigne les Nintedanib à
 * Raihana » n'est aucune des quatre : ce n'est ni une lecture rapide, ni une requête, ni une
 * recherche, ni un raisonnement — c'est une écriture, et l'architecture cible se termine
 * précisément sur un ACTION ENGINE. Sans cette cinquième voie, toutes les écritures tomberaient
 * dans DEEP_REASONING et gonfleraient artificiellement la part de « raisonnement profond » —
 * exactement le chiffre que §28 demande de mesurer sans le forcer. Mieux vaut une catégorie de
 * plus qu'une statistique fausse.
 *
 * LE ROUTEUR NE DEVINE PAS. Ce qu'il ne reconnaît pas part en HYBRID_RETRIEVAL, budget NORMAL :
 * le chemin généraliste, celui d'aujourd'hui. Se tromper vers le chemin cher coûte des tokens ;
 * se tromper vers le chemin rapide coûte une réponse fausse dite avec aplomb.
 */

export type RouteClass =
  | "FAST_DETERMINISTIC"
  | "STRUCTURED_QUERY"
  | "HYBRID_RETRIEVAL"
  | "DEEP_REASONING"
  | "ACTION";

/** Le domaine métier — il sert à ne charger QUE les outils de ce domaine (§23, §24). */
export type Domain =
  | "MAIL" | "CALENDAR" | "REGULATORY" | "FINANCE" | "HR"
  | "DRIVE" | "LEGAL" | "MISSION" | "DIRECTORY" | "ADMIN" | "TEACH" | "SOURCES" | "QUALITE" | "DATA" | "GENERAL";

export interface QueryRoute {
  route: RouteClass;
  domain: Domain;
  /** Le budget de contexte que cette route mérite. */
  tier: BudgetTier;
  /** L'outil canonique quand la route est déterministe ; `null` sinon. */
  tool: string | null;
  args: Record<string, string>;
  /** La forme rapide reconnue, quand il y en a une — utile au journal de débogage. */
  fastKind: VoiceRouteKind | null;
  /** 0..1. En dessous de 0,5, le routeur dit qu'il ne sait pas plutôt que d'inventer. */
  confidence: number;
  reason: string;
  /**
   * Les domaines OUVERTS EN PLUS du principal — sans le détrôner. « Analyse les dépenses par
   * mois » reste une question de finance ; elle ouvre AUSSI le bac à sable (DATA), pour que le
   * calcul se fasse par le code et non de tête. Absent = rien de plus.
   */
  secondaires?: Domain[];
}

export interface RouterContext extends VoiceContext {
  /** L'écran ouvert, quand il y en a un — il désambiguïse « et celui-là ? ». */
  screen?: string | null;
  /** La modalité : la voix privilégie le déterministe, l'écrit tolère mieux l'attente. */
  modality?: "voice" | "text";
  /**
   * LES ENTITÉS QUE L'ENTREPRISE CONNAÎT VRAIMENT (§14) — noms de produits, de partenaires, de
   * personnes, avec le domaine dont ils relèvent. Elles viennent de la base (CompanyState), pas
   * d'une liste écrite en dur : c'est le seul moyen qu'« ASARI » ou « SD » soient reconnus sans
   * qu'un développeur les ait prévus. Le routeur reste synchrone ; c'est l'appelant qui résout.
   */
  knownEntities?: { name: string; domain: Domain }[];
}

// ── LES SIGNAUX ──────────────────────────────────────────────────────────────────────────────

/**
 * LES PRÉAMBULES QUI NE PORTENT RIEN. « Peux-tu envoyer le mail à Deepak ? » est un ordre ; sans
 * décapage, le verbe n'est plus en tête et l'ordre devient invisible. On retire donc la politesse
 * et les marqueurs de discours AVANT d'analyser.
 *
 * DEUX MOTS SONT DÉLIBÉRÉMENT ÉPARGNÉS. « et » porte le suivi elliptique (« Et Raihana ? » reprend
 * l'intention précédente) et « alors » porte la relance (« Alors ? » réclame un résultat) : les
 * retirer effacerait précisément le sens de la phrase. Le décapage se fait sur le texte BRUT, la
 * casse préservée, parce que la majuscule des noms propres sert encore en aval.
 */
const POLITE_PREFIX = /^(?:\s*(?:adam|bonjour|salut|s'?il\s+te\s+pla[iî]t|s'?il\s+vous\s+pla[iî]t|stp|svp|dis[-\s]moi|est[-\s]ce\s+que\s+tu\s+peux|est[-\s]ce\s+qu[e']?|tu\s+peux|peux[-\s]tu|pourrais[-\s]tu|tu\s+pourrais|j'?aimerais\s+savoir|je\s+voudrais\s+savoir|je\s+veux\s+savoir|merci\s+de|oui|non|ok|d'?accord|bon|mais|donc)\s*[,;:]?\s*)+/i;

function stripPreamble(raw: string): string {
  const cleaned = (raw ?? "").replace(POLITE_PREFIX, "").trim();
  // Une phrase entièrement faite de politesse (« Oui. », « Adam ? ») garde son texte d'origine :
  // elle veut dire quelque chose, même si ce n'est pas une demande.
  return cleaned.length > 0 ? cleaned : (raw ?? "").trim();
}

/**
 * Causalité, synthèse, arbitrage : ce que seul un raisonnement cher sait faire.
 *
 * « CE QUI BLOQUE » MANQUAIT, et c'est la façon la plus courante de demander une cause. La liste
 * connaissait « pourquoi », « diagnostique », « remonte la piste » — mais « dis-moi ce qui bloque »
 * n'était reconnu par AUCUNE porte : la phrase tombait jusqu'au chemin généraliste. Mesuré sur le
 * scénario transverse (« Regarde les derniers mails, les dossiers Regulatory et les tâches de
 * Raihana, et dis-moi ce qui bloque ») : classée en lecture, alors que rapprocher trois sources
 * pour trouver un point d'arrêt est la définition même du C dans `triage.ts`.
 *
 * La porte 3 (l'ordre qui mute) reste AVANT celle-ci : « débloque le dossier » est un geste, pas
 * une question. Seule la forme interrogative « ce qui bloque » arrive jusqu'ici.
 */
const DEEP = /\b(pourquoi|comment ca se fait|comment on en est|explique moi pourquoi|analyse|analyser|compare|comparer|synthese|synthetise|strategie|strategique|recommande|recommandation|que penses tu|ton avis|si on|et si|scenario|simule|arbitre|contradiction|risque|risques|impact|consequences|qu est ce que j ai rate|ce que j ai rate|qu est ce qui m echappe|ce qui bloque|ce qui coince|ce qui cloche|ce qui traine|ce qui ne va pas|ou ca bloque|ou ca coince|point de blocage|points de blocage|bilan|fais le point|faut il|fais le tour|audite|audit complet|passe en revue|tour d horizon|etat des lieux|panorama|vue d ensemble|creuse|investigue|enquete|diagnostique|remonte la piste)\b/;

/**
 * L'IMPÉRATIF DE RECHERCHE — testé AVANT le raisonnement.
 *
 * « Retrouve le rapport d'analyse CTD » contient « analyse », qui est un mot de raisonnement…
 * mais ici c'est un NOM dans un titre de document, et la phrase commence par un ordre de
 * recherche. Quand le premier mot dit « va chercher », il tranche.
 */
const RETRIEVE_IMPERATIVE = /^(retrouve|retrouver|cherche|chercher|recherche|trouve|trouver|ou est|ou sont|sors moi)\b/;
/** « Prépare(-moi) le comité / la réunion / mon point / le brief » — sans mail ni document à produire. */
const MEETING_PREP = /^(?:prepare|preparez|preparer|briefe|brief)(?: moi)?\b(?!.*\b(?:mail|mails|message|courrier|lettre|reponse|convocation|invitation|powerpoint|pptx|slides|presentation|rapport|compte rendu|note de service|excel|tableau)\b).{0,40}\b(?:comite|codir|conseil|reunion|reunions|point|brief|entretien|rendez vous|rdv|seance|assemblee)\b/;

/** Chercher dans du non structuré : documents, fils, archives. */
const RETRIEVE = /\b(retrouve|retrouver|cherche|chercher|recherche|ou est|ou sont|le document|le contrat|le fichier|la piece|le rapport|la presentation|le pdf|dont|parlait|evoquait|mentionnait|version|archive)\b/;

/**
 * UN FAIT QUI EXISTE EN BASE (§10) : un responsable, un statut, un montant, une date, un compte.
 *
 * Trois familles, et la première est la plus rentable : en français, une demande de fait commence
 * presque toujours par un interrogatif (« Quel… », « Qui… », « Combien… »). C'est ce motif qui
 * manquait le plus au premier passage du banc — quinze demandes canoniques partaient en recherche
 * documentaire faute de le reconnaître.
 */
const INTERROGATIVE = /^(quel|quelle|quels|quelles|qui|combien|quand|qu est ce qui|qu est ce que)\b/;
/** L'impératif de LECTURE — il ordonne, mais il n'écrit rien. */
const READ_IMPERATIVE = /^(donne|donnez|montre|montrez|liste|lister|affiche|affichez|sors|resume|resumez|rappelle moi)\b/;
const STRUCTURED = /\b(qui gere|qui s occupe|qui est|qui sont|qui a|qui travaille|qui m a|responsable de|charge de|montant|solde|total|statut de|statut du|etat de|etat des|etat du|date de|echeance|assigne a|affecte a|appartient|rattache|adresse de|numero de|telephone de|coordonnees de|creneau|disponibilite)\b/;

/**
 * LES VERBES QUI MUTENT — et pourquoi « donne » n'en fait pas partie.
 *
 * ACTION ne veut pas dire « à l'impératif », il veut dire « ça change quelque chose ». « Donne-moi
 * les salariés et leurs e-mails » est un ordre grammatical, mais c'est une LECTURE : rien n'est
 * créé, rien n'est modifié, rien n'est envoyé. Le classer comme action gonflerait la part
 * d'écriture et, pire, ferait passer une simple consultation par les gardes de confirmation.
 * La liste ci-dessous ne contient donc que des gestes qui laissent une trace.
 */
const VERBES_D_ECRITURE = "surveille|surveilles|surveillez|surveiller|demande|demandez|demander|dis|dites|ecris|ecrivez|ecrire|envoie|envoyez|envoyer|transmets|transmet|transmettre|transfere|transferer|relance|relancer|appelle|appelez|appeler|assigne|assignes|assigner|attribue|attribuer|confie|confier|reassigne|prepare|prepares|preparer|redige|rediger|ajoute|ajouter|cree|creer|planifie|planifier|programme|programmer|invite|inviter|reponds|repondez|repondre|rappelle|note|noter|marque|marquer|change|changer|modifie|modifier|mets|met|mettre|deplace|deplacer|renomme|renommer|masque|masquer|reserve|reserver|commande|commander|valide|valider|approuve|approuver|refuse|refuser|rejette|rejeter|annule|annuler|supprime|supprimer|efface|effacer|detruis|detruire|archive|archiver|paie|payer|regle|regler|rembourse|rembourser|augmente|augmenter|active|activer|desactive|desactiver|exporte|exporter|genere|generer|construis|construire|construisez|generez|produis|produire|batis|batir|exportez";
const ACTION = new RegExp(`^(${VERBES_D_ECRITURE})\\b`);
/**
 * LA PHRASE NOMME-T-ELLE UN GESTE QUI LAISSE UNE TRACE — n'importe où, pas seulement en tête ?
 *
 * `ACTION` décide de la ROUTE et ne regarde que le premier mot : « Pourquoi le dossier est-il en
 * retard, et relance les hôpitaux » reste une question de fond. Ici on répond à une autre question,
 * posée par le résolveur d'outils : faut-il envoyer les schémas d'ÉCRITURE ? Mesuré sur le banc :
 * pour une question causale (niveau C), les écritures pesaient 17 outils et 16 800 jetons sur 28 000
 * — pour un tour qui, dans l'immense majorité des cas, lit, diagnostique et propose. Quand la
 * phrase nomme un geste, elles reviennent ; sinon `list_more_tools` reste le filet.
 */
export function nommeUnGeste(texteNormalise: string): boolean {
  return new RegExp(`\\b(${VERBES_D_ECRITURE})\\b`).test(texteNormalise);
}

/** Les questions sur Adam lui-même — jamais une lecture de la boîte du PDG. */
const SELF = /\b(tu t appelles|tu es qui|qui es tu|comment tu t appelles|ton nom|ton adresse|tu as une adresse|ton e mail|ton email|tu es quoi)\b/;

const DOMAIN_SIGNALS: [Domain, RegExp][] = [
  // Les FAITS EXTERNES (§37) : ce qu'un webhook ou un connecteur a poussé — jamais du courrier, même si « arrivé » et « reçu » s'y disent aussi.
  ["SOURCES", /\b(webhook|webhooks|faits? externes?|evenements? (externes?|recus?|entrants?)|docusign|hubspot|iqvia|e ?signature|signature electronique|enveloppe (signee|completee)|ingestion)\b/],
  ["MAIL", /\b(mail|mails|email|emails|e mail|courriel|courriels|boite|messagerie|repondu|repond|repondre|a ecrit|ecrit|expediteur|destinataire|fil|thread)\b/],
  ["CALENDAR", /\b(rendez vous|rdv|agenda|calendrier|reunion|reunions|planning|creneau|disponibilite|dispo)\b/],
  // « L'appel d'offres PCH » : les outils du PCH (`pch_operation`, `pch_market_status`) sont classés
  // REGULATORY, mais la phrase ne menait qu'à DRIVE (l'appel d'offres comme DOCUMENT). Mesuré au
  // banc : le modèle demandait la liste complète à chaque question sur un appel d'offres.
  ["REGULATORY", /\b(dossier|dossiers|regulatory|reglementaire|anpp|amm|ctd|enregistrement|soumission|presoumission|dci|molecule|produit|produits|laboratoire|fabricant|concurrent|concurrents|pch|appel d offres|appels d offres)\b/],
  ["FINANCE", /\b(paiement|paiements|facture|factures|budget|tresorerie|solde|depense|depenses|encaissement|encaissements|decaissement|decaissements|reglement|ordre de depense|banque)\b/],
  // « la paie » est un nom, « paie la facture » est un verbe : sans l'article, le domaine RH
  // s'emparait d'un ordre de paiement. Le banc l'a montré sur « Paie la facture de Pharmagene ».
  ["HR", /\b(salarie|salaries|employe|employes|conge|conges|la paie|fiche de paie|bulletin de paie|salaire|recrute|recruter|recrutement|embauche|embaucher|effectif|equipe|departement|contrat de travail)\b/],
  ["DRIVE", /\b(drive|document|documents|fichier|fichiers|piece jointe|dossier partage|pdf|excel|word|powerpoint|presentation|appel d offres)\b/],
  // « Fais-moi un devis » : la fabrique documentaire (`document_build`) est classée LEGAL et
  // FINANCE, mais « devis » ne figurait dans aucun signal — le tour partait sans elle. Mesuré au
  // banc des défis : Adam calculait le TTC de tête et n'émettait rien.
  ["LEGAL", /\b(contrat|contrats|bon de commande|bons de commande|juridique|legal|clause|avenant|renouvele|renouvellement|courrier|courriers|devis|charte|charte graphique|logo|registre de marque|mentions legales|signataire|signataires|papier en-tete|papier a en-tete|profil documentaire|numerotation)\b/],
  // « TÂCHE » MANQUAIT, et c'est le mot le plus courant pour la chose. `create_task`,
  // `list_my_tasks`, `update_task` et `task_operation` sont tous classés MISSION — mais la
  // phrase « les tâches de Raihana » ne menait à AUCUN domaine, donc à aucun de ces outils.
  // Trouvé en mesurant le scénario transverse : sur trois sources demandées, deux étaient
  // reliées et les tâches manquaient. Une omission de vocabulaire, pas de conception.
  // « Rappelle-moi demain à 8h de valider le budget » : le rappel est un engagement planifié,
  // donc MISSION (`plan_reminder`). Sans ce marqueur, la phrase partait avec les seuls outils
  // FINANCE (à cause de « budget »), le modèle demandait la liste complète, et le tour coûtait
  // deux appels et 64 000 jetons au lieu d'un — mesuré au banc, pas supposé.
  ["MISSION", /\b(mission|missions|tache|taches|todo|to do|a faire|engagement|engagements|promesse|en attente de|waiting|relance|suivi|rappel|rappels|rappelle|rappeler|pense bete)\b/],
  ["DIRECTORY", /\b(annuaire|coordonnees|adresse de|numero de|telephone de|contact|contacts|joindre|joins|contacter)\b/],
  ["ADMIN", /\b(compte|comptes|role|roles|droit|droits|permission|permissions|parametre|parametres|module|modules|circuit|circuits)\b/],
  // TEACH ADAM (§119). Les outils `teach_adam` / `list_rules` / … étaient classés GENERAL, et
  // GENERAL n'est JAMAIS servi : ni quand un autre domaine est reconnu, ni dans le repli « tous
  // les domaines », qui l'exclut. « Règle pour toute la société : … » partait donc sans aucun
  // moyen d'enregistrer la règle, et Adam répondait « trou de capacité ». Le banc des défis l'a
  // montré ; les tests sur base, qui appelaient l'outil directement, ne pouvaient pas le voir
  // (§14 : partir du vrai point d'entrée). Un domaine à eux, déclenché par le vocabulaire de
  // la consigne durable — jamais par « toujours » ou « jamais » seuls, trop courants.
  ["TEACH", /\b(regle|regles|desormais|dorenavant|retiens|retenir|retenez|a partir de maintenant|a l avenir|standard|standards|convention|conventions|politique interne|enseigne|enseigner|enseignee|enseignees|apprends|apprendre|consigne permanente|consigne durable|pour toute la societe|pour toute l entreprise|pour tout le groupe|a l echelle de la societe|a l echelle du groupe|au niveau de la societe|au niveau du groupe)\b/],
  // LES SOURCES ET LEUR FRAÎCHEUR (F8). `source_map` était classé GENERAL — donc jamais servi,
  // comme les outils Teach avant lui : « où pourrait vivre X ? », « tes données datent de quand ? »,
  // « c'est fiable ? » n'atteignaient jamais la carte des sources.
  ["SOURCES", /\b(source|sources|provenance|fiable|fiabilite|synchronise|synchronisee|synchronisees|fraicheur|datent|preuve negative|ou chercher|ou pourrait vivre|ou pourrait se trouver)\b/],
  // LA QUALITÉ DES DONNÉES (mandat 4 §23) : « qu'est-ce qui cloche dans nos données ? », « des doublons ? »
  ["QUALITE", /\b(anomalie|anomalies|doublon|doublons|incoherence|incoherences|incoherent|incoherents|qualite des donnees|qualite de donnees|donnees perimees|donnee perimee|champ manquant|champs manquants|orphelin|orphelins|aberrant|aberrante|aberrants|aberrantes|nettoyage des donnees|fiches incompletes|fiche incomplete)\b/],
  // LE BAC À SABLE (mandat 4 §25) : SQL, graphiques, code, statistique NOMMÉE. Seul le vocabulaire
  // sans ambiguïté fait de DATA le domaine PRINCIPAL ; « analyse », « calcule », « tendance »,
  // « par mois » sont des mots de toute question métier — ils ouvrent DATA en domaine SECONDAIRE
  // (voir `DATA_SECONDAIRE`), sans détourner la question de son domaine (finance, tâches…).
  ["DATA", /\b(requete sql|requetes sql|en sql|sql|graphique|graphiques|camembert|histogramme|nuage de points|visualisation|visualise|visualiser|tableau croise|pivot|cohorte|cohortes|mediane|moyenne mobile|correlation|regression|serie temporelle|series temporelles|percentile|ecart type|python|javascript|bac a sable|scenario|scenarios|simule|simuler|simulation|monte.?carlo|tirages|percentile|percentiles|probabilite de perte|optimisation|optimiser|optimal|optimale|maximiser|minimiser|programmation lineaire|prix marginal|chemin critique|ordonnancement|ordonnancer|diagramme de gantt|gantt|clustering|segmentation|segmenter|classification|composantes principales|test statistique|significativite|intervalle de confiance|saisonnalite|previsionnel|reseau|graphe|chemin le plus court|relations indirectes|centralite|intermediaire|communautes|carte|cartographie|geographique|distance|kilometres|tournee|itineraire|territoire|territoires|implantation|depot|wilaya|wilayas|densite|proximite geographique)\b/],
];

/**
 * LES DÉNOMINATIONS COMMUNES INTERNATIONALES, reconnues à leur TERMINAISON.
 *
 * « Raltegravir », « Nintedanib » : le routeur les classait en GENERAL, faute de savoir que ce
 * sont des médicaments — c'était, de loin, la première cause d'erreur de domaine du banc. Les
 * lister en dur serait absurde (le catalogue en compte des dizaines et il bouge) ; en revanche
 * l'OMS attribue aux DCI des SEGMENTS-CLÉS qui disent la classe pharmacologique : -vir pour les
 * antiviraux, -nib pour les inhibiteurs de kinase, -mab pour les anticorps monoclonaux…
 *
 * Ce n'est pas une heuristique de fortune : c'est la nomenclature officielle. Elle attrape aussi
 * les molécules que ce dépôt ne connaît pas encore, ce qu'aucune liste ne ferait. Les entités
 * réellement présentes en base (`ctx.knownEntities`) restent prioritaires — elles, elles savent.
 */
const DCI_STEM = /\b[a-z]{4,}(vir|nib|mab|ximab|zumab|prazole|sartan|statine|statin|cycline|micine|oxacine|floxacine|pril|olol|azepam|parine|tidine|triptan|cilline|penem|conazole|caine|dipine|glitazone|gliptine|setron)\b/;

/**
 * TOUS LES DOMAINES QUE LA PHRASE TOUCHE, dans l'ordre où ils apparaissent.
 *
 * `detectDomain` (au singulier, ci-dessous) réduit ce même calcul à UN domaine parce que le
 * routage doit trancher. Le résolveur d'outils, lui, a besoin de la liste entière : « le contrat
 * Sofradis et le budget qui va avec » touche LEGAL et FINANCE, et ne charger que le premier
 * rendrait la moitié de la demande impossible à servir.
 *
 * L'ordre est celui de la phrase, et il est significatif : en français le sujet précède ses
 * compléments, donc le premier domaine est le domaine PRINCIPAL. Le résolveur s'en sert pour
 * décider ce qu'il garde en premier quand le budget serre.
 */
export function detectDomains(text: string, known: RouterContext["knownEntities"] = []): Domain[] {
  const hits: { domain: Domain; at: number }[] = DOMAIN_SIGNALS
    .map(([domain, re]) => ({ domain, at: text.search(re) }))
    .filter((h) => h.at >= 0);
  for (const e of known ?? []) {
    const at = text.indexOf(normalizeUtterance(e.name));
    if (at >= 0 && normalizeUtterance(e.name).length >= 3) hits.push({ domain: e.domain, at });
  }
  const dci = text.search(DCI_STEM);
  if (dci >= 0) hits.push({ domain: "REGULATORY" as Domain, at: dci });

  const vus = new Set<Domain>();
  return hits
    .sort((a, b) => a.at - b.at)
    .filter((h) => (vus.has(h.domain) ? false : (vus.add(h.domain), true)))
    .map((h) => h.domain);
}

function detectDomain(text: string, known: RouterContext["knownEntities"] = []): { domain: Domain; confidence: number } {
  const hits = DOMAIN_SIGNALS
    .map(([domain, re]) => ({ domain, at: text.search(re) }))
    .filter((h) => h.at >= 0);

  // Les entités que la base connaît passent AVANT toute heuristique : si l'entreprise sait que
  // « ASARI » est un partenaire, aucune terminaison n'a son mot à dire.
  for (const e of known ?? []) {
    const at = text.indexOf(normalizeUtterance(e.name));
    if (at >= 0 && normalizeUtterance(e.name).length >= 3) hits.push({ domain: e.domain, at });
  }
  const dci = text.search(DCI_STEM);
  if (dci >= 0) hits.push({ domain: "REGULATORY" as Domain, at: dci });
  if (hits.length === 0) return { domain: "GENERAL", confidence: 0.3 };
  if (hits.length === 1) return { domain: hits[0].domain, confidence: 0.9 };
  // PLUSIEURS DOMAINES : on prend celui dont le mot arrive le PREMIER. En français, le sujet de
  // la demande précède ses compléments — « les salariés et leurs e-mails » parle du registre RH,
  // pas de la messagerie. Prendre le premier de la liste des signaux donnerait l'inverse, et
  // c'est exactement l'erreur que le banc a montrée.
  const first = hits.reduce((best, h) => (h.at < best.at ? h : best));
  return { domain: first.domain, confidence: 0.55 };
}

/** Le budget que mérite chaque route. */
const TIER_OF: Record<RouteClass, BudgetTier> = {
  FAST_DETERMINISTIC: "FAST",
  // Une requête canonique n'a pas besoin de doctrine : elle a besoin d'une ligne de base.
  STRUCTURED_QUERY: "FAST",
  HYBRID_RETRIEVAL: "NORMAL",
  DEEP_REASONING: "DEEP",
  // Une écriture exige les règles (droits, politique d'envoi, confirmation) — pas l'archive.
  ACTION: "NORMAL",
};

/**
 * L'AIGUILLAGE.
 *
 * L'ordre des portes est la décision d'ingénierie : l'ACTION se teste tôt (une écriture ne doit
 * jamais tomber dans une lecture rapide), le RAISONNEMENT avant la RECHERCHE (« pourquoi le
 * contrat indien a-t-il traîné ? » est une question causale, pas une chasse au document), et le
 * DÉTERMINISTE en premier parce qu'il est le seul à être PROUVÉ par un banc.
 */
/**
 * LE VOCABULAIRE DU CALCUL, large : il n'emporte pas le domaine (une question de finance reste une
 * question de finance) mais ouvre le bac à sable EN PLUS. C'est ce qui évite le choix impossible
 * entre « router toute analyse vers DATA » (et perdre les lectures du métier) et « ne jamais
 * ouvrir DATA » (et laisser le modèle faire l'arithmétique de tête).
 */
const DATA_SECONDAIRE = /\b(analyse|analyser|analyses|analytique|statistique|statistiques|tendance|tendances|croissance|evolution|evolue|par mois|mensuel|mensuelle|par trimestre|par an|annuel|calcule|calculer|calcul|recalcule|projection|projette|prevision|previsions|distribution|agrege|agreger|regroupe par|regrouper par|top \d+|classement|moyenne|total par|somme par|repartition|comparaison|compare|simule|simuler|simulation|scenario|scenarios|courbe|courbes|barres|graphique|graphiques|serie|series|anomalie|anomalies|aberrant|aberrantes)\b/;

// LA SURVEILLANCE se demande dans le vocabulaire de sa cible — « surveille le contrat Sofradis »
// est LEGAL, « préviens-moi si le dossier bloque » est REGULATORY — et l'outil qui la crée
// (`watch_entity`) vit dans MISSION. Sans ce second domaine, le modèle improvisait : une règle
// enseignée (« préviens-moi » pris pour une consigne durable) au lieu d'une ligne de surveillance.
// Le banc l'a montré ; on ouvre MISSION en plus, sans détourner la question de sa cible.
const SURVEILLANCE_SECONDAIRE = /\b(surveille|surveiller|surveillance|surveilles|previens[- ]moi|previens[- ]moi|prevenir|alerte[- ]moi|alertez[- ]moi|tiens[- ]moi au courant|tenez[- ]moi au courant|s.?il y a un probleme|des qu.?(il|elle|ca|cela|le|la|les|un|une) .{0,40}\b(arrive|arrivera|change|changera|repond|repondra|bouge|tombe|passe))\b/;

/** Une DEMANDE DE SURVEILLANCE (« surveille… », « préviens-moi quand… ») — le geste est `watch_entity`, quel que soit le domaine de la cible. */
export function estDemandeDeSurveillance(texteNormalise: string): boolean {
  return SURVEILLANCE_SECONDAIRE.test(texteNormalise);
}

/** Les domaines à ouvrir EN PLUS pour cette phrase (déjà normalisée). Vide le plus souvent. */
export function domainesSecondaires(texteNormalise: string): Domain[] {
  const out: Domain[] = [];
  // Le GESTE d'abord : « surveille… » ouvre MISSION avant DATA — au plafond du niveau, le dernier
  // domaine secondaire tombe le premier, et c'est l'outil du geste qui tombait.
  if (SURVEILLANCE_SECONDAIRE.test(texteNormalise)) out.push("MISSION");
  if (DATA_SECONDAIRE.test(texteNormalise)) out.push("DATA");
  return out;
}

/**
 * LA CONSIGNE DE CALCUL — injectée dans le contexte du tour quand la question demande un chiffre
 * DÉRIVÉ. Le banc l'a montré : sans elle, « simule +8 % » se résout par une lecture canonique et
 * une multiplication de tête. Un modèle qui calcule de tête se trompe en silence ; un outil
 * rend un résultat, une provenance et un tableau. `null` quand la question ne calcule rien.
 */
export function consigneCalcul(raw: string): string | null {
  const texte = normalizeUtterance(stripPreamble(raw));
  const signal = DOMAIN_SIGNALS.find(([d]) => d === "DATA")?.[1];
  if (!(signal && signal.test(texte)) && !DATA_SECONDAIRE.test(texte) && !CALCUL_EXPLICITE.test(texte) && !RESEAU_EXPLICITE.test(texte)) return null;
  return "CALCUL PAR LE CODE : cette question demande un chiffre DÉRIVÉ (total, écart, variation, tendance, série, scénario, médiane, part, classement) "
    + "ou un graphique. Tout chiffre dérivé sort d'un outil du bac à sable — sql_query (vue globale, jointures/agrégats à la source), "
    + "run_analysis (étapes vérifiées : filtrer, regrouper, série, croissance, tendance, scénario, anomalies, cohortes), run_code (JS/Python isolé) — "
    + "JAMAIS de tête, même pour une multiplication. "
    + "MOTEURS DE CALCUL quand la question le demande : calcul_montecarlo (une décision dépend de quantités INCERTAINES : percentiles, probabilité de perte, leviers — ne jamais raisonner sur des moyennes), "
    + "calcul_optimisation (allouer, mélanger, affecter sous contraintes : optimum ET prix marginaux ; ou un planning sous règles logiques), "
    + "calcul_ordonnancement (chemin critique, marges, ressources, échéance), calcul_statistiques (régression, test, corrélation, segmentation, ACP, anomalies, prévision validée hors échantillon) — "
    + "chacun rend sa RIGUEUR (hypothèses, limites, avertissements) : la REPRENDRE dans la réponse, un chiffre livré sans elle se lit comme une certitude qu'il n'est pas. "
    + "RÉSEAU ET CARTE : « comment X est-il relié à Y », « qui est le point de passage », « qu'est-ce qui tombe si ceci disparaît » se répondent par reseau_entreprise (un CHEMIN nommé, pas une recherche documentaire — l'absence de lien enregistré n'est jamais l'absence de relation) ; « dans quel ordre visiter », « comment découper les territoires », « où poser le dépôt » par carte_territoire. "
    + "Pour « quel graphique ? », appelle chart_advice. Pour MONTRER (graphique, évolution, répartition, tableau de bord, Gantt, réseau, carte), appelle render_view : le code compose la figure sous la réponse — ne dessine jamais un graphique en texte, ne recopie pas ses chiffres. Cite le résultat rendu par l'outil, avec sa source, "
    + "et dis quand une hypothèse a été appliquée.";
}

const ETAT_SIGNAUX = /\b(en retard|retards?|bloques?|bloquees?|blocages?|pieces? manquantes?|manquant|manquantes?|manque|echeances?|arrive a echeance|arrivent a echeance|expire|expirent|justificatifs?|depasse|depassement|depassements|qu.?est.?ce qui cloche|cloche|signaux|signal|alertes?|a risque|risques?|rythme|denonc\w*|reconduction|tacite|penalites?|obligations?|bloqueurs?|reserves?|relanc\w*)\b/;
const CIBLES_METIER = /\b(dossiers? reglementaires?|dossiers?|regulatory|anpp|ctd|contrats?|avenants?|factures?|bons? de commande|bc|budgets?|enveloppes?|paiements?|demandes? de paiement|ordres? de depense|tresorerie|finances?|legal|juridique)\b/;

/**
 * LA CONSIGNE « SIGNAUX PAR LE CODE » (mandat 4 §27), jumelle de `consigneCalcul` : l'ÉTAT des
 * dossiers, contrats et budgets — retards, blocages, pièces manquantes, échéances, dépassements —
 * se lit dans les règles de l'intelligence métier, jamais dans un document retrouvé ni de mémoire.
 * Le banc l'a montré : une note de portefeuille indexée au Drive répondait à la place des signaux,
 * avec des dossiers d'hier et sans le dossier en retard d'aujourd'hui. Un document est une photo
 * datée ; un signal est calculé maintenant, avec son calcul. `null` hors sujet.
 */
export function consigneSignaux(raw: string): string | null {
  const texte = normalizeUtterance(stripPreamble(raw));
  if (SURVEILLANCE_SECONDAIRE.test(texte)) {
    return "SURVEILLANCE : « surveille… », « préviens-moi si / quand… », « alerte-moi… » demandent une SURVEILLANCE DURABLE — appelle watch_entity "
      + "(ou expected_document pour un document attendu). Ce n'est ni une alerte immédiate à rédiger, ni une règle à enseigner : sans watch_entity, rien ne surveille.";
  }
  if (!(ETAT_SIGNAUX.test(texte) && CIBLES_METIER.test(texte))) return null;
  return "SIGNAUX PAR LE CODE : l'état des dossiers réglementaires, des contrats et des budgets (retards en jours, blocages, pièces manquantes, "
    + "échéances, dénonciation, dépassements, justificatifs, factures sans BC) se lit dans regulatory_intelligence / legal_intelligence / "
    + "finance_intelligence — calculé maintenant, avec son calcul — JAMAIS dans un document retrouvé (une note est une photo datée) ni de mémoire. "
    + "Cite chaque référence et chaque chiffre tels que l'outil les rend ; lis parEntite pour n'oublier aucun dossier.";
}

export function routeQuery(raw: string, ctx: RouterContext = {}): QueryRoute {
  const base = routerPrincipal(raw, ctx);
  if (base.route === "FAST_DETERMINISTIC" || base.domain === "DATA") return base;
  const secondaires = domainesSecondaires(normalizeUtterance(stripPreamble(raw)));
  return secondaires.length ? { ...base, secondaires } : base;
}

function routerPrincipal(raw: string, ctx: RouterContext = {}): QueryRoute {
  // Le décapage sert TOUT ce qui suit, mais l'accord se juge sur la phrase brute : « Oui. » est
  // une réponse entière, pas un préambule.
  const clean = stripPreamble(raw);
  const text = normalizeUtterance(clean);
  const { domain, confidence: domainConfidence } = detectDomain(text, ctx.knownEntities);

  const build = (
    route: RouteClass,
    reason: string,
    over: Partial<QueryRoute> = {},
  ): QueryRoute => ({
    route, domain, tier: TIER_OF[route], tool: null, args: {}, fastKind: null,
    confidence: domainConfidence, reason, ...over,
  });

  if (!text) return build("HYBRID_RETRIEVAL", "énoncé vide", { confidence: 0 });

  // ── 1. L'ACCORD ET LA RELANCE — sur la phrase BRUTE ─────────────────────────────────────
  // « Envoie-le » quand une intention attend est une approbation, pas un ordre neuf ; « Alors ? »
  // réclame un résultat en cours. Ces deux-là passent avant tout le reste, sinon la porte
  // suivante (l'ordre) les avalerait.
  const rawFast = routeVoiceUtterance(raw, ctx);
  if (rawFast.fast && (rawFast.kind === "APPROVE_PENDING" || rawFast.kind === "RESUME_DELIVERY" || rawFast.kind === "PROVENANCE")) {
    return build("FAST_DETERMINISTIC", rawFast.reason, { fastKind: rawFast.kind, confidence: 0.95 });
  }

  // ── 2. LES QUESTIONS SUR ADAM ───────────────────────────────────────────────────────────
  // « Tu as une adresse e-mail ? » n'est pas une lecture de la boîte du PDG. C'est le défaut
  // d'identité constaté en production, et il se ferme ici.
  if (SELF.test(text)) {
    return build("HYBRID_RETRIEVAL", "question sur l'identité d'Adam", { confidence: 0.9 });
  }

  // ── 2 bis. PRÉPARER UNE RÉUNION EST UNE SYNTHÈSE, PAS UNE MUTATION ────────────────────
  // « Prépare-moi le comité de demain » commence par un verbe d'action, mais rien n'est à
  // écrire : il faut LIRE (agenda, dossiers, engagements) et synthétiser. Classée ACTION, la
  // demande partait sur le chemin des mutations avec la totalité des outils — mesuré au banc :
  // dix appels, cinquante-sept secondes, 0,54 $. Un mail ou un document à PRÉPARER reste un
  // ordre (l'exclusion le garde).
  if (MEETING_PREP.test(text)) {
    return build("DEEP_REASONING", "préparation de réunion — lire et synthétiser ce qui attend", {
      domain: "CALENDAR", confidence: 0.85,
    });
  }

  // ── 2 ter. UN PROBLÈME À CALCULER EST UN PROBLÈME À CALCULER (mandat 5 §39) ────────────
  // Mesuré au banc : « Dossier ANPP, planning : la rédaction prend 6 jours… en combien de jours
  // le dossier part-il ? » partait en lecture d'agenda et répondait « aucune donnée sur le
  // planning » — alors que la phrase contenait TOUTES ses données. Le décor (« dossier »,
  // « planning », « produits ») nomme un domaine ; « chemin critique », « loi triangulaire »,
  // « prix marginal » nomment une MÉTHODE, et la méthode décide. DATA en domaine principal :
  // c'est là que vivent les moteurs de calcul.
  if (CALCUL_EXPLICITE.test(text)) {
    return build("DEEP_REASONING", "problème à calculer — les moteurs de calcul avant toute lecture", {
      domain: "DATA", confidence: 0.9,
    });
  }

  // ── 2 quater. UNE RELATION SE PARCOURT, ELLE NE SE CHERCHE PAS (mandat 5 §40) ───────────
  // « Comment X est-il relié à Y ? » partait en recherche documentaire et répondait « aucune
  // chaîne enregistrée » — faux, et sûr de soi : le lien existait, à un intermédiaire près.
  // Un chemin se calcule dans le graphe des relations, il ne se trouve pas dans un document.
  if (RESEAU_EXPLICITE.test(text)) {
    return build("DEEP_REASONING", "question de relation — le graphe des liens avant toute recherche", {
      domain: "DATA", confidence: 0.9,
    });
  }

  // ── 3. L'ORDRE QUI MUTE — avant toute lecture ───────────────────────────────────────────
  if (ACTION.test(text)) {
    return build("ACTION", "verbe de mutation en tête — le moteur d'action prend la main", {
      args: rawFast.args, confidence: 0.85,
    });
  }
  // Un courrier ADRESSÉ est un ordre, même quand le verbe n'ouvre pas la phrase et même quand il
  // est écrit au participe (« tu peux envoyé un mail à Khaled ? »). Sans cette ligne, la phrase
  // atteignait le raccourci « état de la boîte » : Adam lisait la messagerie au lieu d'écrire.
  if (isOutboundMail(text)) {
    return build("ACTION", "courrier adressé à quelqu'un — le moteur d'action prend la main", {
      args: rawFast.args, confidence: 0.85,
    });
  }

  // ── 4. « VA CHERCHER » — avant le raisonnement ──────────────────────────────────────────
  // Un ordre de recherche explicite tranche même quand la phrase contient des mots d'analyse :
  // « Retrouve le rapport d'analyse CTD » veut le document, pas une réflexion sur le document.
  if (RETRIEVE_IMPERATIVE.test(text)) {
    return build("HYBRID_RETRIEVAL", "ordre de recherche documentaire", { confidence: 0.85 });
  }

  // ── 5. LE RAISONNEMENT — avant les raccourcis de lecture ────────────────────────────────
  // C'EST LA PORTE QUI A LE PLUS RAPPORTÉ AU BANC. « Pourquoi Deepak ne répond pas ? » partait
  // lire la boîte (le mot « répond »), « Compare l'avancement de X et Y » ouvrait la fiche de X.
  // Une question causale ou comparative n'a jamais de réponse en une ligne de base.
  if (DEEP.test(text)) {
    return build("DEEP_REASONING", "question causale ou de synthèse", { confidence: 0.8 });
  }

  // ── 6. LE DÉTERMINISTE ──────────────────────────────────────────────────────────────────
  // On délègue au routeur vocal : c'est le même jeu de formes, et il est le seul de ce système
  // dont la justesse est mesurée énoncé par énoncé sur un banc.
  const fast = routeVoiceUtterance(clean, ctx);
  if (fast.fast) {
    return build("FAST_DETERMINISTIC", fast.reason, {
      tool: fast.tool, args: fast.args, fastKind: fast.kind, confidence: 0.95,
    });
  }

  // ── 7. LE FAIT STRUCTURÉ AVANT LA RECHERCHE (§10) ───────────────────────────────────────
  // Si l'information existe canoniquement, on l'INTERROGE. Chercher par similarité une phrase
  // qui décrit un fait déjà stocké est le gaspillage que la mission nomme explicitement.
  const asksFact = INTERROGATIVE.test(text) || READ_IMPERATIVE.test(text) || STRUCTURED.test(text);
  if (asksFact && !RETRIEVE.test(text)) {
    return build("STRUCTURED_QUERY", "fait canonique — requête, pas recherche", {
      confidence: Math.max(0.7, domainConfidence),
    });
  }

  // ── 8. LA RECHERCHE NON STRUCTURÉE ──────────────────────────────────────────────────────
  if (RETRIEVE.test(text)) {
    return build("HYBRID_RETRIEVAL", "preuve non structurée à retrouver", { confidence: 0.75 });
  }

  // ── 9. L'INCONNU prend le chemin généraliste, et le dit ─────────────────────────────────
  return build("HYBRID_RETRIEVAL", "hors des formes reconnues — chemin généraliste", {
    confidence: 0.35,
  });
}

/** Le routeur sait-il ce qu'il fait ? En dessous, on n'invoque aucun raccourci. */
export const ROUTER_CONFIDENCE_FLOOR = 0.5;

export const isConfident = (r: QueryRoute): boolean => r.confidence >= ROUTER_CONFIDENCE_FLOOR;
