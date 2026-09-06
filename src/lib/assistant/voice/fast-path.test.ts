import { describe, it, expect } from "vitest";
import { normalizeUtterance, routeVoiceUtterance, type VoiceContext } from "./fast-path";

/**
 * LE BANC DU ROUTEUR VOCAL — il mesure la JUSTESSE D'AIGUILLAGE, pas la qualité d'une réponse.
 *
 * Trois familles d'assertions, et elles n'ont pas le même poids :
 *
 *  1. LES FORMES RAPIDES doivent partir vite. Un « des mails ? » qui traverse la planification
 *     générique coûte une à trois secondes — c'est exactement l'intervalle pendant lequel une
 *     conversation cesse d'en être une.
 *  2. LE CONTEXTE doit survivre. « Relance-la » sans « la » résolue, c'est une conversation qui
 *     redémarre à zéro à chaque tour.
 *  3. LE RISQUE NE PREND JAMAIS DE RACCOURCI. Cette famille-là n'est pas une optimisation : une
 *     phrase mal comprise qui déclenche une suppression ou un paiement ne se rattrape pas. Un
 *     aiguillage manqué coûte une seconde ; un aiguillage sensible erroné coûte l'irréversible.
 *
 * Les énoncés sont écrits comme le PDG les DIT, avec accents, apostrophes et traits d'union —
 * c'est ce que la transcription rend, et c'est donc ce que le routeur doit encaisser.
 */

const route = (utterance: string, ctx: VoiceContext = {}) => routeVoiceUtterance(utterance, ctx);

describe("normalizeUtterance", () => {
  it("efface les accents — la classe de diacritiques doit être écrite échappée", () => {
    // Ce test est la sentinelle du piège /[̀-ͯ]/ : écrits en caractères combinants
    // littéraux, les bornes se recollent au crochet et la classe cesse silencieusement de
    // couvrir quoi que ce soit. Le dépôt s'est déjà fait prendre deux fois.
    expect(normalizeUtterance("Où en est Raltegravir ?")).toBe("ou en est raltegravir");
    expect(normalizeUtterance("Tu as reçu des e-mails ?")).toBe("tu as recu des e mails");
    expect(normalizeUtterance("À très bientôt, Adam")).toBe("a tres bientot adam");
  });

  it("ramène apostrophes droites et courbes au même mot", () => {
    expect(normalizeUtterance("Des mails aujourd'hui ?")).toBe(normalizeUtterance("Des mails aujourd’hui ?"));
  });

  it("ne rend rien sur du vide ou du bruit pur", () => {
    expect(normalizeUtterance("   ")).toBe("");
    expect(normalizeUtterance("... ?!")).toBe("");
  });
});

/** §7 — LES CHEMINS RAPIDES, énoncé par énoncé, tels que la mission les nomme. */
describe("§7 chemins rapides — les six formes nommées par la mission", () => {
  it("« Des mails aujourd'hui ? » → Gmail, sans planification", () => {
    const r = route("Des mails aujourd'hui ?");
    expect(r.kind).toBe("GMAIL_INBOX");
    expect(r.tool).toBe("gmail_search");
    expect(r.fast).toBe(true);
  });

  it("« Quels faits externes sont arrivés par webhook dans la dernière heure ? » → PAS la boîte : un webhook n'est pas du courrier (§37)", () => {
    const r = routeVoiceUtterance("Quels faits externes sont arrivés par webhook dans la dernière heure ?");
    expect(r.fast).toBe(false);
    expect(routeVoiceUtterance("Qu'est-ce qu'on a reçu de DocuSign ce matin ?").fast).toBe(false);
    expect(routeVoiceUtterance("Une enveloppe signée est-elle arrivée ?").fast).toBe(false);
  });

  it("« Tu as reçu des mails aujourd'hui ? » → même route (la tournure ne change rien)", () => {
    expect(route("Tu as reçu des mails aujourd'hui ?").kind).toBe("GMAIL_INBOX");
    expect(route("J'ai du courriel ?").kind).toBe("GMAIL_INBOX");
    expect(route("Quelque chose de nouveau dans la boîte ?").kind).toBe("GMAIL_INBOX");
  });

  it("« Mon prochain rendez-vous ? » → Calendar, les prochains événements (aucun jour imposé)", () => {
    const r = route("Mon prochain rendez-vous ?");
    expect(r.kind).toBe("CALENDAR_NEXT");
    expect(r.tool).toBe("read_calendar");
    // L'outil lit `date` et `limit` — rien d'autre. « prochain » = les prochains événements.
    expect(r.args).toEqual({});
    expect(r.fast).toBe(true);
  });

  it("« Mes réunions de demain ? » → Calendar, le JOUR devient l'argument que l'outil lit", () => {
    const r = route("Mes réunions de demain ?");
    expect(r.kind).toBe("CALENDAR_NEXT");
    expect(r.args.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(route("Qu'est-ce que j'ai à l'agenda aujourd'hui ?").args.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("« C'est quoi mon agenda ? » → Calendar sans horizon imposé", () => {
    const r = route("C'est quoi mon agenda ?");
    expect(r.kind).toBe("CALENDAR_NEXT");
    expect(r.args.horizon).toBeUndefined();
  });

  it("« Où en est Raltegravir ? » → la fiche canonique, pas une recherche libre", () => {
    const r = route("Où en est Raltegravir ?");
    expect(r.kind).toBe("RECORD_STATUS");
    expect(r.tool).toBe("inspect_record");
    expect(r.args.reference).toBe("raltegravir");
    expect(r.fast).toBe(true);
  });

  it("« Où en est le dossier Nintedanib ? » — l'article ne fait pas partie du sujet", () => {
    expect(route("Où en est le dossier Nintedanib ?").args.reference).toBe("nintedanib");
    expect(route("Statut du Raltegravir ?").args.reference).toBe("raltegravir");
  });

  it("« Deepak a répondu ? » → la boîte filtrée sur Deepak, sans qu'on prononce « mail »", () => {
    const r = route("Deepak a répondu ?");
    expect(r.kind).toBe("GMAIL_FROM");
    expect(r.tool).toBe("gmail_search");
    expect(r.args.from).toBe("deepak");
    expect(r.fast).toBe(true);
  });

  it("« Envoie-le. » → approbation de l'intention en attente, JAMAIS une nouvelle rédaction", () => {
    const r = route("Envoie-le.", { hasPendingMail: true });
    expect(r.kind).toBe("APPROVE_PENDING");
    expect(r.tool).toBeNull();
    expect(r.fast).toBe(true);
  });

  it("« Alors ? » → le résultat en cours, pas une nouvelle recherche", () => {
    const r = route("Alors ?", { hasOpenDelivery: true });
    expect(r.kind).toBe("RESUME_DELIVERY");
    expect(r.fast).toBe(true);
    expect(route("Ça donne quoi ?", { hasOpenDelivery: true }).kind).toBe("RESUME_DELIVERY");
    expect(route("Et donc ?", { hasOpenDelivery: true }).kind).toBe("RESUME_DELIVERY");
  });
});

/**
 * §7 — LES RACCOURCIS SONT CONDITIONNELS.
 *
 * Un raccourci qui se déclenche sans son objet est pire que pas de raccourci : « envoie » sans
 * intention en attente n'approuve rien, il COMMANDE — et confondre les deux expédie le mauvais
 * message. « Alors ? » sans travail en cours ne réclame rien : il ouvre une conversation.
 */
describe("§7 les raccourcis exigent leur objet", () => {
  it("« Envoie-le. » sans intention en attente n'approuve rien", () => {
    const r = route("Envoie-le.", { hasPendingMail: false });
    expect(r.kind).not.toBe("APPROVE_PENDING");
    expect(r.kind).toBe("DELEGATE");
  });

  it("« Non, celui de Pharmagene. » n'est pas un accord même avec une intention en attente", () => {
    const r = route("Non, celui de Pharmagene.", { hasPendingMail: true });
    expect(r.kind).not.toBe("APPROVE_PENDING");
  });

  it("« Oui mais change l'objet » n'est pas un accord", () => {
    expect(route("Oui mais change l'objet", { hasPendingMail: true }).kind).not.toBe("APPROVE_PENDING");
  });

  it("« Alors ? » sans travail en cours rend la main au modèle", () => {
    const r = route("Alors ?", { hasOpenDelivery: false });
    expect(r.kind).toBe("DELEGATE");
    expect(r.fast).toBe(false);
  });

  it("« Où en est… » sans sujet identifiable ne devine pas de dossier", () => {
    const r = route("Où en est-ce ?");
    expect(r.kind).toBe("DELEGATE");
    expect(r.args.reference).toBeUndefined();
  });
});

/** §8 — LE CONTEXTE SURVIT : « la », « et X ? », « elle » doivent se résoudre. */
describe("§8 survie du contexte", () => {
  it("« Relance-la. » résout « la » vers la dernière personne nommée", () => {
    const r = route("Relance-la.", { lastPerson: "Raihana" });
    expect(r.args.resolvedPerson).toBe("Raihana");
  });

  it("« Relance-la. » sans contexte ne fabrique personne", () => {
    expect(route("Relance-la.").args.resolvedPerson).toBeUndefined();
  });

  it("« Et Raihana ? » reprend l'intention du tour précédent (boîte)", () => {
    const r = route("Et Raihana ?", { lastKind: "GMAIL_FROM" });
    expect(r.kind).toBe("GMAIL_FROM");
    expect(r.args.from).toBe("raihana");
    expect(r.fast).toBe(true);
  });

  it("« Et Nintedanib ? » reprend l'intention du tour précédent (dossier)", () => {
    const r = route("Et Nintedanib ?", { lastKind: "RECORD_STATUS" });
    expect(r.kind).toBe("RECORD_STATUS");
    expect(r.args.reference).toBe("nintedanib");
  });

  it("« Et Raihana ? » sans tour précédent ne s'invente pas d'intention", () => {
    expect(route("Et Raihana ?").kind).toBe("DELEGATE");
    expect(route("Et Raihana ?", { lastKind: "DELEGATE" }).kind).toBe("DELEGATE");
  });

  it("« Elle a répondu ? » vise la personne du tour précédent, pas le mot « elle »", () => {
    const r = route("Elle a répondu ?", { lastPerson: "raihana" });
    expect(r.kind).toBe("GMAIL_FROM");
    expect(r.args.from).toBe("raihana");
  });

  it("« Elle a répondu ? » sans contexte rend la boîte entière plutôt qu'un filtre vide", () => {
    const r = route("Elle a répondu ?");
    expect(r.kind).toBe("GMAIL_INBOX");
    expect(r.args.from).toBeUndefined();
  });

  it("« Un mail de Deepak ? » filtre sur la personne citée", () => {
    expect(route("J'ai un mail de Deepak ?").args.from).toBe("deepak");
  });

  it("« Des mails de moi ? » ne prend pas un pronom pour un expéditeur", () => {
    expect(route("Des mails de moi ?").kind).toBe("GMAIL_INBOX");
  });
});

/**
 * §5 — AUCUN RACCOURCI SUR LE SENSIBLE.
 *
 * La règle de la mission est nette : « Never transform uncertain audio into: delete / payment /
 * salary change / permission change / irreversible mutation. » Le routeur est le premier endroit
 * où un mot mal entendu peut devenir un geste : il ne doit JAMAIS y avoir de chemin court entre
 * une phrase qui parle d'argent, de droits ou de suppression et un outil.
 */
describe("§5 le vocabulaire sensible ferme tous les raccourcis", () => {
  const sensibles = [
    "Supprime le dossier Raltegravir.",
    "Efface les mails de Deepak.",
    "Paie la facture de Pharmagene.",
    "Fais le virement à l'imprimeur.",
    "Augmente le salaire de Raihana.",
    "Change ses droits d'accès.",
    "Annule la commande.",
    "Désactive le compte de Khaled.",
  ];

  it.each(sensibles)("« %s » part au modèle, sans outil ni raccourci", (phrase) => {
    const r = route(phrase, { lastPerson: "Raihana", lastKind: "GMAIL_FROM", hasPendingMail: true, hasOpenDelivery: true });
    expect(r.kind).toBe("DELEGATE");
    expect(r.tool).toBeNull();
    expect(r.fast).toBe(false);
  });

  it("le contexte le plus riche ne rouvre pas un raccourci sensible", () => {
    // Toutes les portes ouvertes en même temps : intention en attente, résultat en cours,
    // personne connue. Aucune ne doit servir de passe-droit.
    const r = route("Supprime-le.", { hasPendingMail: true, hasOpenDelivery: true, lastPerson: "Raihana" });
    expect(r.kind).toBe("DELEGATE");
    expect(r.reason).toMatch(/sensible/);
  });
});

/**
 * L'ERREUR LA PLUS CHÈRE DU ROUTEUR : répondre à côté avec aplomb.
 *
 * « Demande à Regulatory ce qu'ils attendent » contient le mot « attendent ». Sans garde, la
 * file de décisions du PDG s'ouvrait — alors qu'il demandait qu'on écrive à un service. Ce n'est
 * pas une seconde perdue, c'est une réponse fausse. Un ordre n'est pas une question.
 */
describe("un ordre n'emprunte jamais un raccourci de lecture", () => {
  it("« Demande à Regulatory ce qu'ils attendent. » n'ouvre pas la file de décisions", () => {
    const r = route("Demande à Regulatory ce qu'ils attendent.");
    expect(r.kind).not.toBe("PENDING_DECISIONS");
    expect(r.kind).toBe("DELEGATE");
    expect(r.tool).toBeNull();
  });

  it("« Assigne les Nintedanib à Raihana. » reste une action", () => {
    const r = route("Assigne les Nintedanib à Raihana.");
    expect(r.kind).toBe("DELEGATE");
    expect(r.fast).toBe(false);
  });

  it("« Écris à Deepak. » ne se transforme pas en lecture de la boîte", () => {
    expect(route("Écris à Deepak.").kind).toBe("DELEGATE");
    expect(route("Réponds-lui.").kind).toBe("DELEGATE");
  });

  it("« Transmets-les à Raihana. » reste une action, avec le pronom résolu", () => {
    const r = route("Transmets-les à Raihana.", { lastPerson: "Deepak" });
    expect(r.kind).toBe("DELEGATE");
  });

  it("mais « Envoie-le. » reste une approbation quand une intention attend", () => {
    // L'ordre des gardes compte : l'accord se teste AVANT le filtre des verbes d'ordre.
    expect(route("Envoie-le.", { hasPendingMail: true }).kind).toBe("APPROVE_PENDING");
  });
});

/** §7 — la file de décisions, qui est bien une QUESTION celle-là. */
describe("la file de décisions", () => {
  it("« Qu'est-ce qui m'attend ? » ouvre la file", () => {
    const r = route("Qu'est-ce qui m'attend ?");
    expect(r.kind).toBe("PENDING_DECISIONS");
    expect(r.tool).toBe("list_pending_decisions");
  });

  it("« Combien de validations en attente ? » aussi", () => {
    expect(route("Combien de validations en attente ?").kind).toBe("PENDING_DECISIONS");
  });
});

/**
 * §16 — CE QUI N'EST PAS UNE FORME RAPIDE DOIT ÊTRE DÉLÉGUÉ, PAS DEVINÉ.
 *
 * La mission juge un tour réussi seulement s'il a utilisé LA BONNE source. Un routeur qui force
 * une route sur une phrase qu'il ne reconnaît pas fabrique précisément le contraire : un outil
 * appelé avec assurance sur une question qu'il ne traite pas.
 */
describe("§16 le doute délègue", () => {
  const horsForme = [
    "Prépare-moi un point sur la trésorerie du trimestre.",
    "Qu'est-ce que tu penses de l'offre de Pharmagene ?",
    "Raconte-moi la réunion d'hier.",
    "",
    "euh",
  ];

  it.each(horsForme)("« %s » → le modèle décide", (phrase) => {
    const r = route(phrase);
    expect(r.kind).toBe("DELEGATE");
    expect(r.fast).toBe(false);
  });

  it("chaque route porte une raison lisible dans le journal de débogage", () => {
    for (const phrase of ["Des mails ?", "Mon prochain rendez-vous ?", "Où en est Raltegravir ?", "Supprime ça."]) {
      expect(route(phrase).reason.length).toBeGreaterThan(3);
    }
  });
});

describe("« d'où tu tiens ça ? » — la provenance est une forme déterministe (F8)", () => {
  it("reconnaît les demandes de source, à l'écrit comme à l'oral", () => {
    for (const q of [
      "D'où tu tiens ça ?", "D'où tu sors ce chiffre ?", "D'où vient ce montant ?", "Ta source ?", "Tes sources ?",
      "Quelle est ta source ?", "Cite tes sources.", "Sur quoi tu te bases ?", "Comment tu sais ça ?",
      "Tu es sûr de ce chiffre ?", "C'est fiable ?", "Prouve-le.", "Qui te l'a dit ?", "Dis-moi d'où ça vient.",
      "D'où vous tenez cette information ?",
    ]) {
      const r = routeVoiceUtterance(q);
      expect(r.kind, q).toBe("PROVENANCE");
      expect(r.fast, q).toBe(true);
      expect(r.tool, q).toBeNull();
    }
  });

  it("ne confond ni une question causale, ni le budget, ni une lecture, ni un mot sensible", () => {
    expect(routeVoiceUtterance("D'où vient ce retard ?").kind).not.toBe("PROVENANCE");
    expect(routeVoiceUtterance("Quelle est la source du budget 2026 ?").kind).not.toBe("PROVENANCE");
    expect(routeVoiceUtterance("Où en est Lenvatinib ?").kind).not.toBe("PROVENANCE");
    expect(routeVoiceUtterance("Pourquoi Deepak ne répond pas ?").kind).not.toBe("PROVENANCE");
    // ── LE DÉFAUT MESURÉ AU BANC (§44) ────────────────────────────────────────────────────
    //
    // « Qu'est-ce que tu sais faire en simulation, et sur quoi t'appuies-tu pour dire que c'est
    // fiable ? » posait DEUX questions. Les trois mots « c'est fiable » suffisaient à la faire
    // happer par la provenance : Adam récitait les sources du tour précédent, en zéro appel de
    // modèle, à côté du sujet — et rien ne le signalait. Une question sur ce qu'Adam SAIT FAIRE
    // part au modèle, qui a le registre des capacités au socle de sa liste courte.
    expect(routeVoiceUtterance("Qu'est-ce que tu sais faire en matière de simulation, et sur quoi t'appuies-tu pour dire que c'est fiable ?").kind).not.toBe("PROVENANCE");
    expect(routeVoiceUtterance("De quoi tu es capable exactement ? C'est fiable ?").kind).not.toBe("PROVENANCE");
    // Et la provenance seule reste attrapée : la garde ne l'a pas désarmée.
    expect(routeVoiceUtterance("C'est fiable ce chiffre ?").kind).toBe("PROVENANCE");
    // « salaire » ferme tous les raccourcis, provenance comprise : le chemin complet garde ses gardes.
    expect(routeVoiceUtterance("D'où tu tiens ce chiffre de salaire ?").kind).toBe("DELEGATE");
  });
});
