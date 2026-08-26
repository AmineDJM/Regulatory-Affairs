import type { RouteClass, Domain, RouterContext } from "./router";

/**
 * LE BANC DE ROUTAGE — les demandes du PDG, et ce que chacune DEVRAIT coûter.
 *
 * D'OÙ VIENNENT CES PHRASES, EXACTEMENT. La question mérite une réponse franche, parce qu'un banc
 * dont on ignore la provenance ne mesure rien :
 *
 *   • `source: "transcript"` — VERBATIM. Ces phrases ont réellement été dites ou écrites par le
 *     PDG dans les transcriptions de ce projet (sessions vocales, corrections de bogues,
 *     énoncés cités dans les missions). Ce sont elles qui font foi.
 *   • `source: "composed"` — ÉCRITES ICI, pour couvrir des domaines que les transcriptions
 *     disponibles n'atteignent pas (paie, factures, congés, Drive…). Elles suivent les tournures
 *     observées, mais ce sont des cas construits, et le rapport le dit.
 *
 * POURQUOI PAS 130 PHRASES RÉELLES. La base de développement de ce dépôt ne contient aucun
 * historique de conversation (`AssistantMessage` : 0 ligne) — les vraies conversations vivent en
 * production, où l'on ne touche pas aux données. `scripts/harvest-corpus.ts` existe pour faire
 * grossir ce banc à partir des vrais messages le jour où on le lance là-bas ; d'ici là, la part
 * composée est étiquetée comme telle et se compte séparément dans le rapport.
 *
 * CE QUE MESURE CE BANC : la ROUTE et le DOMAINE. Pas la qualité de la réponse — celle-là dépend
 * des données de production. Mais router « Combien de mails aujourd'hui ? » vers un raisonnement
 * profond est un défaut mesurable sans aucune donnée, et c'est ce défaut-là qui coûte les
 * secondes et les tokens.
 *
 * LES CAS DIFFICILES SONT DÉLIBÉRÉS. Ce banc contient des pièges que le routeur a le droit de
 * rater — mais alors le chiffre doit le dire :
 *   • « Demande à Regulatory ce qu'ils attendent » (un ordre déguisé en question sur l'attente) ;
 *   • « Pourquoi le contrat indien a-t-il traîné ? » (une question causale pleine de mots de
 *     recherche documentaire) ;
 *   • « Retrouve le contrat indien dont Khaled parlait avant l'IAS » (recherche, pas raisonnement).
 */

export interface GoldenCase {
  id: string;
  utterance: string;
  expectedRoute: RouteClass;
  expectedDomain: Domain;
  /** VERBATIM du PDG, ou cas construit pour couvrir un domaine. */
  source: "transcript" | "composed";
  /** Le contexte conversationnel au moment où la phrase est dite. */
  ctx?: RouterContext;
  /** Pourquoi ce cas est là — surtout quand il est piégeux. */
  note?: string;
}

const T = "transcript" as const;
const C = "composed" as const;

export const GOLDEN_CORPUS: GoldenCase[] = [
  // ── MAIL — les formes rapides, celles que la mission nomme ────────────────────────────────
  { id: "mail-01", utterance: "Des mails aujourd'hui ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: T },
  { id: "mail-02", utterance: "Tu as reçu des mails aujourd'hui ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: T },
  { id: "mail-03", utterance: "Deepak a répondu ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: T },
  { id: "mail-04", utterance: "Combien de mails aujourd'hui ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: T },
  { id: "mail-05", utterance: "J'ai du nouveau dans ma boîte ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C },
  { id: "mail-06", utterance: "Un mail de Deepak ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C },
  { id: "mail-07", utterance: "Raihana a écrit ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C },
  { id: "mail-08", utterance: "Des mails de Pharmagene ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C },
  { id: "mail-09", utterance: "Quelque chose de nouveau dans la boîte ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C, note: "Le « de » n'introduit pas un expéditeur — piège de filtrage." },
  { id: "mail-10", utterance: "Elle a répondu ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C, ctx: { lastPerson: "raihana" }, note: "Le pronom se résout sur le tour précédent (§15)." },
  { id: "mail-11", utterance: "Le dernier mail de Khaled ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C },
  { id: "mail-12", utterance: "Qui m'a écrit ce matin ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C, note: "Gmail EST la source canonique : la lecture déterministe répond." },
  { id: "mail-13", utterance: "Il reste des mails sans réponse ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C },
  { id: "mail-14", utterance: "Et Raihana ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: T, ctx: { lastKind: "GMAIL_FROM" }, note: "Suivi elliptique : même intention, entité substituée." },
  { id: "mail-15", utterance: "Pourquoi Deepak ne répond pas ?", expectedRoute: "DEEP_REASONING", expectedDomain: "MAIL", source: C },

  // ── AGENDA ───────────────────────────────────────────────────────────────────────────────
  { id: "cal-01", utterance: "Mon prochain rendez-vous ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "CALENDAR", source: T },
  { id: "cal-02", utterance: "C'est quoi mon agenda ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "CALENDAR", source: C },
  { id: "cal-03", utterance: "J'ai quoi demain ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C, note: "Aucun mot d'agenda : le routeur n'a pas de quoi trancher." },
  { id: "cal-04", utterance: "Mes réunions de demain ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "CALENDAR", source: C },
  { id: "cal-05", utterance: "Un créneau libre jeudi ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "CALENDAR", source: C },
  { id: "cal-06", utterance: "Le planning de la semaine ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "CALENDAR", source: C },
  { id: "cal-07", utterance: "Raconte-moi la réunion d'hier.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "CALENDAR", source: C, note: "« réunion » sans repère de temps futur : compte rendu, pas agenda." },
  { id: "cal-08", utterance: "Planifie une réunion avec Raihana jeudi.", expectedRoute: "ACTION", expectedDomain: "CALENDAR", source: C },

  // ── REGULATORY — le cœur métier ──────────────────────────────────────────────────────────
  { id: "reg-01", utterance: "Où en est Raltegravir ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "REGULATORY", source: T },
  { id: "reg-02", utterance: "Qui gère Nintedanib ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "REGULATORY", source: T },
  { id: "reg-03", utterance: "Pourquoi Nintedanib est en retard ?", expectedRoute: "DEEP_REASONING", expectedDomain: "REGULATORY", source: T },
  { id: "reg-04", utterance: "Statut du dossier Raltegravir ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "REGULATORY", source: C },
  { id: "reg-05", utterance: "Où en sont les dossiers ANPP ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "REGULATORY", source: C },
  { id: "reg-06", utterance: "Quels dossiers sont bloqués ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "REGULATORY", source: C },
  { id: "reg-07", utterance: "Combien de dossiers en présoumission ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "REGULATORY", source: C },
  { id: "reg-08", utterance: "Assigne les Nintedanib à Raihana.", expectedRoute: "ACTION", expectedDomain: "REGULATORY", source: T },
  { id: "reg-09", utterance: "Qui est responsable de la soumission Raltegravir ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "REGULATORY", source: C },
  { id: "reg-10", utterance: "Quelle est l'échéance du dossier Nintedanib ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "REGULATORY", source: C },
  { id: "reg-11", utterance: "Analyse le retard des dossiers du trimestre.", expectedRoute: "DEEP_REASONING", expectedDomain: "REGULATORY", source: C },
  { id: "reg-12", utterance: "Compare l'avancement de Raltegravir et de Nintedanib.", expectedRoute: "DEEP_REASONING", expectedDomain: "REGULATORY", source: C },
  { id: "reg-13", utterance: "Et Nintedanib ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "REGULATORY", source: C, ctx: { lastKind: "RECORD_STATUS" }, note: "La DCI se reconnaît à sa terminaison, même seule dans la phrase." },
  { id: "reg-14", utterance: "Change le statut de Raltegravir en soumis.", expectedRoute: "ACTION", expectedDomain: "REGULATORY", source: C },
  { id: "reg-15", utterance: "Le laboratoire du dossier Raltegravir ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "REGULATORY", source: C },
  { id: "reg-16", utterance: "Retrouve le rapport d'analyse CTD de Nintedanib.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "REGULATORY", source: C },
  { id: "reg-17", utterance: "Quel est le risque sur la soumission de janvier ?", expectedRoute: "DEEP_REASONING", expectedDomain: "REGULATORY", source: C },
  { id: "reg-18", utterance: "Liste les dossiers de Fatma Zahra.", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "REGULATORY", source: C },

  // ── FINANCE ──────────────────────────────────────────────────────────────────────────────
  { id: "fin-01", utterance: "Le solde de trésorerie ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "FINANCE", source: C },
  { id: "fin-02", utterance: "Combien de paiements en attente ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "FINANCE", source: C },
  { id: "fin-03", utterance: "Quel est le montant de la facture Pharmagene ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "FINANCE", source: C },
  { id: "fin-04", utterance: "Où en est le budget des moyens généraux ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "FINANCE", source: C },
  { id: "fin-05", utterance: "Pourquoi le budget marketing a explosé ?", expectedRoute: "DEEP_REASONING", expectedDomain: "FINANCE", source: C },
  { id: "fin-06", utterance: "Retrouve la facture de l'imprimeur de mars.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "FINANCE", source: C },
  { id: "fin-07", utterance: "Valide le paiement de l'imprimeur.", expectedRoute: "ACTION", expectedDomain: "FINANCE", source: C },
  { id: "fin-08", utterance: "Les décaissements à venir ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "FINANCE", source: C },
  { id: "fin-09", utterance: "Combien on a dépensé en congrès cette année ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "FINANCE", source: C },
  { id: "fin-10", utterance: "Analyse nos dépenses par département.", expectedRoute: "DEEP_REASONING", expectedDomain: "FINANCE", source: C },
  { id: "fin-11", utterance: "Quelles factures sont impayées ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "FINANCE", source: C },
  { id: "fin-12", utterance: "Paie la facture de Pharmagene.", expectedRoute: "ACTION", expectedDomain: "FINANCE", source: C, note: "Irréversible : jamais un raccourci (§5 vocal)." },

  // ── RH ───────────────────────────────────────────────────────────────────────────────────
  { id: "hr-01", utterance: "Combien de salariés dans le département réglementaire ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "HR", source: C },
  { id: "hr-02", utterance: "Qui est en congé cette semaine ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "HR", source: C },
  { id: "hr-03", utterance: "Quel est le salaire de Raihana ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "HR", source: C },
  { id: "hr-04", utterance: "Augmente le salaire de Raihana.", expectedRoute: "ACTION", expectedDomain: "HR", source: C, note: "Sensible : jamais un raccourci." },
  { id: "hr-05", utterance: "Où en est le recrutement du chargé de dossiers ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "HR", source: C },
  { id: "hr-06", utterance: "Donne-moi les salariés et leurs e-mails.", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "HR", source: T, note: "Impératif de LECTURE : rien n'est muté. Deux domaines cités — le premier nommé gagne." },
  { id: "hr-07", utterance: "Analyse la charge de l'équipe réglementaire.", expectedRoute: "DEEP_REASONING", expectedDomain: "HR", source: C, note: "« équipe » avant « réglementaire » : c'est une question de charge humaine." },
  { id: "hr-08", utterance: "Le contrat de travail de Khaled ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "HR", source: C, note: "« contrat de travail » est RH, pas juridique — le mot composé tranche." },
  { id: "hr-09", utterance: "Combien de demandes de congés en attente ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "HR", source: C },
  { id: "hr-10", utterance: "Faut-il recruter au réglementaire ?", expectedRoute: "DEEP_REASONING", expectedDomain: "HR", source: C, note: "« Faut-il… » demande un jugement, pas un fait." },

  // ── DRIVE / DOCUMENTS — le terrain de la recherche hybride ───────────────────────────────
  { id: "drv-01", utterance: "Retrouve le contrat indien dont Khaled parlait avant l'IAS.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "LEGAL", source: T, note: "Le cas emblématique de §14 : personne + type + pays + borne temporelle." },
  { id: "drv-02", utterance: "Où est le dossier de réponse ANPP ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "REGULATORY", source: C },
  { id: "drv-03", utterance: "Cherche la présentation du congrès de mai.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "DRIVE", source: C },
  { id: "drv-04", utterance: "La dernière version du contrat Pharmagene ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "LEGAL", source: C },
  { id: "drv-05", utterance: "Retrouve le PDF que Raihana a déposé hier.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "DRIVE", source: C },
  { id: "drv-06", utterance: "Quels documents sont arrivés cette semaine ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "DRIVE", source: C },
  { id: "drv-07", utterance: "Le fichier Excel des stocks hôpitaux ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "DRIVE", source: C },
  { id: "drv-08", utterance: "Cherche tout ce qui parle de l'appel d'offres PCH.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "DRIVE", source: C },
  { id: "drv-09", utterance: "Exporte les dossiers réglementaires en Excel.", expectedRoute: "ACTION", expectedDomain: "REGULATORY", source: C },

  // ── MISSIONS & ENGAGEMENTS ───────────────────────────────────────────────────────────────
  { id: "mis-01", utterance: "Alors ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: T, ctx: { hasOpenDelivery: true }, note: "Réclamer un résultat en cours — jamais une nouvelle recherche." },
  { id: "mis-02", utterance: "Ça donne quoi ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: C, ctx: { hasOpenDelivery: true } },
  { id: "mis-03", utterance: "J'attends quoi de qui ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: C },
  { id: "mis-04", utterance: "Quelles missions sont ouvertes ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "MISSION", source: C },
  { id: "mis-05", utterance: "Qu'est-ce qui m'attend ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: C },
  { id: "mis-06", utterance: "Combien de validations en attente ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: C },
  { id: "mis-07", utterance: "Qu'est-ce que j'ai raté cette semaine ?", expectedRoute: "DEEP_REASONING", expectedDomain: "GENERAL", source: T, note: "« What am I missing ? » de §32." },
  { id: "mis-08", utterance: "Pourquoi il n'a toujours pas livré ?", expectedRoute: "DEEP_REASONING", expectedDomain: "GENERAL", source: T, ctx: { lastPerson: "Deepak" } },
  { id: "mis-09", utterance: "Relance-la.", expectedRoute: "ACTION", expectedDomain: "MISSION", source: T, ctx: { lastPerson: "Raihana" }, note: "Le pronom doit se résoudre AVANT de partir au moteur d'action." },
  { id: "mis-10", utterance: "Où en est la mission Nintedanib ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MISSION", source: C },
  { id: "mis-11", utterance: "Quels engagements arrivent à échéance ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "MISSION", source: C },
  { id: "mis-12", utterance: "Fais le point sur mes engagements.", expectedRoute: "DEEP_REASONING", expectedDomain: "MISSION", source: C, note: "Une synthèse n'écrit rien — ce n'est pas une action." },

  // ── ENVOI & APPROBATION — la zone la plus dangereuse ─────────────────────────────────────
  { id: "snd-01", utterance: "Envoie-le.", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: T, ctx: { hasPendingMail: true }, note: "Approbation d'une intention DÉJÀ préparée." },
  { id: "snd-02", utterance: "Envoie.", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: T, ctx: { hasPendingMail: true } },
  { id: "snd-03", utterance: "Vas-y.", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: C, ctx: { hasPendingMail: true } },
  { id: "snd-04", utterance: "Je confirme.", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: T, ctx: { hasPendingMail: true } },
  { id: "snd-05", utterance: "Envoie-le.", expectedRoute: "ACTION", expectedDomain: "GENERAL", source: C, ctx: { hasPendingMail: false }, note: "SANS intention en attente, « envoie » commande, il n'approuve pas." },
  { id: "snd-06", utterance: "Non, celui de Pharmagene.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: T, ctx: { hasPendingMail: true }, note: "Un refus + une précision : ni accord, ni ordre." },
  { id: "snd-07", utterance: "Oui mais change l'objet.", expectedRoute: "ACTION", expectedDomain: "GENERAL", source: C, ctx: { hasPendingMail: true } },
  { id: "snd-08", utterance: "Écris à Deepak pour lui demander le certificat d'analyse.", expectedRoute: "ACTION", expectedDomain: "GENERAL", source: T },
  { id: "snd-09", utterance: "Transmets-les à Raihana.", expectedRoute: "ACTION", expectedDomain: "GENERAL", source: T, ctx: { lastPerson: "Deepak" } },
  { id: "snd-10", utterance: "Demande à Regulatory ce qu'ils attendent.", expectedRoute: "ACTION", expectedDomain: "REGULATORY", source: T, note: "PIÈGE : « attendent » attire la file de décisions. C'est un ordre." },
  { id: "snd-11", utterance: "Réponds-lui que c'est d'accord.", expectedRoute: "ACTION", expectedDomain: "GENERAL", source: C, ctx: { lastPerson: "Deepak" } },
  { id: "snd-12", utterance: "Prépare un mail pour l'ANPP.", expectedRoute: "ACTION", expectedDomain: "MAIL", source: C },

  // ── ANNUAIRE / IDENTITÉ — le bogue « je n'ai pas son adresse » ────────────────────────────
  { id: "dir-01", utterance: "L'adresse de Raihana ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "DIRECTORY", source: T },
  { id: "dir-02", utterance: "Comment je joins Deepak ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "DIRECTORY", source: C },
  { id: "dir-03", utterance: "Le numéro de l'imprimeur ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "DIRECTORY", source: T },
  { id: "dir-04", utterance: "Tu t'appelles comment ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: T, note: "Adam a répondu « Assistant IA » en production — le défaut d'identité." },
  { id: "dir-05", utterance: "Tu as une adresse e-mail ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "MAIL", source: T },
  { id: "dir-06", utterance: "Qui travaille au service réglementaire ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "REGULATORY", source: T },
  { id: "dir-07", utterance: "Ajoute l'adresse personnelle de Raihana à l'annuaire.", expectedRoute: "ACTION", expectedDomain: "DIRECTORY", source: C },

  // ── ADMINISTRATION ───────────────────────────────────────────────────────────────────────
  { id: "adm-01", utterance: "Quels comptes sont actifs ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "ADMIN", source: C },
  { id: "adm-02", utterance: "Change les droits de Khaled.", expectedRoute: "ACTION", expectedDomain: "ADMIN", source: C, note: "Permissions : sensible." },
  { id: "adm-03", utterance: "Désactive le compte de Khaled.", expectedRoute: "ACTION", expectedDomain: "ADMIN", source: C },
  { id: "adm-04", utterance: "Quel est le circuit de validation des événements ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "ADMIN", source: C },
  { id: "adm-05", utterance: "Masque le module Pipeline.", expectedRoute: "ACTION", expectedDomain: "ADMIN", source: C },
  { id: "adm-06", utterance: "Supprime le dossier Raltegravir.", expectedRoute: "ACTION", expectedDomain: "REGULATORY", source: C, note: "Irréversible." },

  // ── RAISONNEMENT PROFOND — ce qui mérite vraiment le modèle fort ─────────────────────────
  { id: "deep-01", utterance: "Pourquoi on en est arrivé là sur Nintedanib ?", expectedRoute: "DEEP_REASONING", expectedDomain: "REGULATORY", source: C },
  { id: "deep-02", utterance: "Que penses-tu de l'offre de Pharmagene ?", expectedRoute: "DEEP_REASONING", expectedDomain: "GENERAL", source: C },
  { id: "deep-03", utterance: "Et si on décalait la soumission de deux mois ?", expectedRoute: "DEEP_REASONING", expectedDomain: "REGULATORY", source: C },
  { id: "deep-04", utterance: "Quelle est notre stratégie sur les hôpitaux ?", expectedRoute: "DEEP_REASONING", expectedDomain: "GENERAL", source: C },
  { id: "deep-05", utterance: "Compare nos délais avec ceux de l'an dernier.", expectedRoute: "DEEP_REASONING", expectedDomain: "GENERAL", source: C },
  { id: "deep-06", utterance: "Y a-t-il une contradiction entre le mail de Deepak et le dossier ?", expectedRoute: "DEEP_REASONING", expectedDomain: "MAIL", source: C, note: "§18 : une déclaration de mail est une preuve, pas la vérité ERP." },
  { id: "deep-07", utterance: "Fais-moi une synthèse exécutive de la semaine.", expectedRoute: "DEEP_REASONING", expectedDomain: "GENERAL", source: C },
  { id: "deep-08", utterance: "Quel est l'impact d'un retard ANPP sur le chiffre ?", expectedRoute: "DEEP_REASONING", expectedDomain: "REGULATORY", source: C },
  { id: "deep-09", utterance: "Recommande-moi une priorité pour la semaine.", expectedRoute: "DEEP_REASONING", expectedDomain: "GENERAL", source: C },
  { id: "deep-10", utterance: "Pourquoi le contrat indien a-t-il traîné ?", expectedRoute: "DEEP_REASONING", expectedDomain: "LEGAL", source: C, note: "PIÈGE : plein de mots de recherche documentaire, mais c'est une question causale." },

  // ── SUIVI DE CONVERSATION — branches et reprises (§16) ───────────────────────────────────
  { id: "ctx-01", utterance: "Revenons à Deepak.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: T, note: "Restauration de branche — pas une recherche." },
  { id: "ctx-02", utterance: "Et pour Nintedanib ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "REGULATORY", source: C, ctx: { lastKind: "RECORD_STATUS" } },
  { id: "ctx-03", utterance: "Celui-là.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C },
  { id: "ctx-04", utterance: "Le deuxième.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C },
  { id: "ctx-05", utterance: "Non, l'autre.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C },
  { id: "ctx-06", utterance: "Oui.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C, note: "Un « oui » sans intention en attente ne décide de rien." },
  { id: "ctx-07", utterance: "Merci.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C },

  // ── VENTES / MARCHÉS / STOCKS ────────────────────────────────────────────────────────────
  { id: "biz-01", utterance: "Combien de marchés PCH en cours ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "GENERAL", source: C },
  { id: "biz-02", utterance: "Quel est l'état des stocks hôpitaux ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "GENERAL", source: C },
  { id: "biz-03", utterance: "Retrouve l'appel d'offres de la PCH de mars.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "DRIVE", source: C },
  { id: "biz-04", utterance: "Analyse le marché du Raltegravir en Algérie.", expectedRoute: "DEEP_REASONING", expectedDomain: "REGULATORY", source: C },
  { id: "biz-05", utterance: "Qui sont nos concurrents sur Nintedanib ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "REGULATORY", source: C },

  // ── AD & PRO / ÉVÉNEMENTS ────────────────────────────────────────────────────────────────
  { id: "adp-01", utterance: "Combien de demandes de sponsoring en attente ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "GENERAL", source: C },
  { id: "adp-02", utterance: "Où en est la prise en charge du congrès de Paris ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "GENERAL", source: C },
  { id: "adp-03", utterance: "Valide la demande de sponsoring de Khaled.", expectedRoute: "ACTION", expectedDomain: "GENERAL", source: C },
  { id: "adp-04", utterance: "Quels événements sont prévus ce trimestre ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "GENERAL", source: C },

  // ── COURRIERS / LEGAL ────────────────────────────────────────────────────────────────────
  { id: "leg-01", utterance: "Quels contrats arrivent à échéance ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "LEGAL", source: C },
  { id: "leg-02", utterance: "Retrouve le bon de commande de l'imprimeur.", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "LEGAL", source: C },
  { id: "leg-03", utterance: "Combien de courriers sont partis cette semaine ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "LEGAL", source: C },
  { id: "leg-04", utterance: "Le contrat Pharmagene est-il renouvelé ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "LEGAL", source: C },

  // ── ÉNONCÉS DÉGRADÉS — ce que rend vraiment une transcription vocale ─────────────────────
  { id: "deg-01", utterance: "euh", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C },
  { id: "deg-02", utterance: "", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C },
  { id: "deg-03", utterance: "Adam ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C },
  { id: "deg-04", utterance: "attends", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C },
  { id: "deg-05", utterance: "des mails", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C, note: "Sans point d'interrogation — la transcription n'en met pas toujours." },
  { id: "deg-06", utterance: "ou en est raltegravir", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "REGULATORY", source: C, note: "Sans accents — certaines transcriptions les perdent." },
  { id: "deg-07", utterance: "DEEPAK A RÉPONDU", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C, note: "Tout en majuscules." },

  // ── POLITESSE ET TOURNURES INDIRECTES ────────────────────────────────────────────────────
  { id: "pol-01", utterance: "Peux-tu envoyer le mail à Deepak ?", expectedRoute: "ACTION", expectedDomain: "MAIL", source: C, note: "Un ordre poli reste un ordre." },
  { id: "pol-02", utterance: "Tu peux me dire où en est Raltegravir ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "REGULATORY", source: C },
  { id: "pol-03", utterance: "S'il te plaît, relance Raihana.", expectedRoute: "ACTION", expectedDomain: "MISSION", source: C },
  { id: "pol-04", utterance: "Adam, des mails aujourd'hui ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C },
  { id: "pol-05", utterance: "Est-ce que tu peux assigner Nintedanib à Raihana ?", expectedRoute: "ACTION", expectedDomain: "REGULATORY", source: C },
  { id: "pol-06", utterance: "J'aimerais savoir qui gère Nintedanib.", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "REGULATORY", source: C },

  // ── TEMPOREL (§13) — la borne de temps doit contraindre, pas décorer ─────────────────────
  { id: "tmp-01", utterance: "Qu'est-ce qui a changé depuis hier ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "GENERAL", source: C },
  { id: "tmp-02", utterance: "Les mails de la semaine dernière ?", expectedRoute: "FAST_DETERMINISTIC", expectedDomain: "MAIL", source: C },
  { id: "tmp-03", utterance: "Ce qui s'est passé pendant mon absence ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "GENERAL", source: C },
  { id: "tmp-04", utterance: "La version précédente du contrat ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "LEGAL", source: C },
  { id: "tmp-05", utterance: "Le dernier document déposé sur Raltegravir ?", expectedRoute: "HYBRID_RETRIEVAL", expectedDomain: "DRIVE", source: C, note: "La demande porte sur un document — le mot qui vient en premier gagne." },
  { id: "tmp-06", utterance: "Qu'est-ce qui a bougé sur Nintedanib depuis la réunion ?", expectedRoute: "STRUCTURED_QUERY", expectedDomain: "REGULATORY", source: C },
];

/** Combien viennent VRAIMENT du PDG — le chiffre qui qualifie la valeur du banc. */
export const CORPUS_PROVENANCE = {
  total: GOLDEN_CORPUS.length,
  transcript: GOLDEN_CORPUS.filter((c) => c.source === "transcript").length,
  composed: GOLDEN_CORPUS.filter((c) => c.source === "composed").length,
};
