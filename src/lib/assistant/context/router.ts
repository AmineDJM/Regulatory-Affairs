import { routeVoiceUtterance, normalizeUtterance, isOutboundMail, type VoiceContext, type VoiceRouteKind } from "@/lib/assistant/voice/fast-path";
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
  | "DRIVE" | "LEGAL" | "MISSION" | "DIRECTORY" | "ADMIN" | "GENERAL";

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

/** Causalité, synthèse, arbitrage : ce que seul un raisonnement cher sait faire. */
const DEEP = /\b(pourquoi|comment ca se fait|comment on en est|explique moi pourquoi|analyse|analyser|compare|comparer|synthese|synthetise|strategie|strategique|recommande|recommandation|que penses tu|ton avis|si on|et si|scenario|simule|arbitre|contradiction|risque|risques|impact|consequences|qu est ce que j ai rate|ce que j ai rate|qu est ce qui m echappe|bilan|fais le point|faut il)\b/;

/**
 * L'IMPÉRATIF DE RECHERCHE — testé AVANT le raisonnement.
 *
 * « Retrouve le rapport d'analyse CTD » contient « analyse », qui est un mot de raisonnement…
 * mais ici c'est un NOM dans un titre de document, et la phrase commence par un ordre de
 * recherche. Quand le premier mot dit « va chercher », il tranche.
 */
const RETRIEVE_IMPERATIVE = /^(retrouve|retrouver|cherche|chercher|recherche|trouve|trouver|ou est|ou sont|sors moi)\b/;

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
const ACTION = /^(demande|demandez|demander|dis|dites|ecris|ecrivez|ecrire|envoie|envoyez|envoyer|transmets|transmet|transmettre|transfere|transferer|relance|relancer|appelle|appelez|appeler|assigne|assignes|assigner|attribue|attribuer|confie|confier|reassigne|prepare|prepares|preparer|redige|rediger|ajoute|ajouter|cree|creer|planifie|planifier|programme|programmer|invite|inviter|reponds|repondez|repondre|rappelle|note|noter|marque|marquer|change|changer|modifie|modifier|mets|met|mettre|deplace|deplacer|renomme|renommer|masque|masquer|reserve|reserver|commande|commander|valide|valider|approuve|approuver|refuse|refuser|rejette|rejeter|annule|annuler|supprime|supprimer|efface|effacer|detruis|detruire|archive|archiver|paie|payer|regle|regler|rembourse|rembourser|augmente|augmenter|active|activer|desactive|desactiver|exporte|exporter|genere|generer)\b/;

/** Les questions sur Adam lui-même — jamais une lecture de la boîte du PDG. */
const SELF = /\b(tu t appelles|tu es qui|qui es tu|comment tu t appelles|ton nom|ton adresse|tu as une adresse|ton e mail|ton email|tu es quoi)\b/;

const DOMAIN_SIGNALS: [Domain, RegExp][] = [
  ["MAIL", /\b(mail|mails|email|emails|e mail|courriel|courriels|boite|messagerie|repondu|repond|repondre|a ecrit|ecrit|expediteur|destinataire|fil|thread)\b/],
  ["CALENDAR", /\b(rendez vous|rdv|agenda|calendrier|reunion|reunions|planning|creneau|disponibilite|dispo)\b/],
  ["REGULATORY", /\b(dossier|dossiers|regulatory|reglementaire|anpp|amm|ctd|enregistrement|soumission|presoumission|dci|molecule|produit|produits|laboratoire|fabricant|concurrent|concurrents)\b/],
  ["FINANCE", /\b(paiement|paiements|facture|factures|budget|tresorerie|solde|depense|depenses|encaissement|encaissements|decaissement|decaissements|reglement|ordre de depense|banque)\b/],
  // « la paie » est un nom, « paie la facture » est un verbe : sans l'article, le domaine RH
  // s'emparait d'un ordre de paiement. Le banc l'a montré sur « Paie la facture de Pharmagene ».
  ["HR", /\b(salarie|salaries|employe|employes|conge|conges|la paie|fiche de paie|bulletin de paie|salaire|recrute|recruter|recrutement|embauche|embaucher|effectif|equipe|departement|contrat de travail)\b/],
  ["DRIVE", /\b(drive|document|documents|fichier|fichiers|piece jointe|dossier partage|pdf|excel|word|powerpoint|presentation|appel d offres)\b/],
  ["LEGAL", /\b(contrat|contrats|bon de commande|bons de commande|juridique|legal|clause|avenant|renouvele|renouvellement|courrier|courriers)\b/],
  ["MISSION", /\b(mission|missions|engagement|engagements|promesse|en attente de|waiting|relance|suivi)\b/],
  ["DIRECTORY", /\b(annuaire|coordonnees|adresse de|numero de|telephone de|contact|contacts|joindre|joins|contacter)\b/],
  ["ADMIN", /\b(compte|comptes|role|roles|droit|droits|permission|permissions|parametre|parametres|module|modules|circuit|circuits)\b/],
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
export function routeQuery(raw: string, ctx: RouterContext = {}): QueryRoute {
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
  if (rawFast.fast && (rawFast.kind === "APPROVE_PENDING" || rawFast.kind === "RESUME_DELIVERY")) {
    return build("FAST_DETERMINISTIC", rawFast.reason, { fastKind: rawFast.kind, confidence: 0.95 });
  }

  // ── 2. LES QUESTIONS SUR ADAM ───────────────────────────────────────────────────────────
  // « Tu as une adresse e-mail ? » n'est pas une lecture de la boîte du PDG. C'est le défaut
  // d'identité constaté en production, et il se ferme ici.
  if (SELF.test(text)) {
    return build("HYBRID_RETRIEVAL", "question sur l'identité d'Adam", { confidence: 0.9 });
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
