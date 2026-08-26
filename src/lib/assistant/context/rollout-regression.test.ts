import { describe, it, expect } from "vitest";
import { routeQuery } from "./router";
import { routeVoiceUtterance } from "@/lib/assistant/voice/fast-path";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CAS DE RÉGRESSION D'APPRENTISSAGE — §11 de la mission d'activation.
 *
 * ⚠ CE FICHIER EST UN JEU D'APPRENTISSAGE. Le routeur a été corrigé pour le faire passer.
 * Son score n'est PAS une mesure de généralisation et ne doit jamais être présenté comme telle.
 *
 * LA SÉPARATION DES TROIS CORPUS, qui est la seule chose qui rende les chiffres honnêtes :
 *
 *   • TRAIN / GOLDEN   → `golden-corpus.ts` + CE FICHIER. On règle le code dessus.
 *   • HELD-OUT         → `holdout-corpus.ts`. Écrit après le gel, passé UNE fois (85 %),
 *                        jamais retouché. C'est lui qui mesure.
 *   • PRODUCTION SHADOW→ `shadow.ts`. La seule vérité à venir.
 *
 * Ajouter ces cas au jeu réservé aurait remonté son score sans rien prouver. Ils vivent donc
 * ici, et le rapport les compte séparément.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

describe("§11 — les neuf cas exigés", () => {
  it("« Donne-moi tous les salariés et leurs mails. » → directory_list", () => {
    const r = routeQuery("Donne-moi tous les salariés et leurs mails.");
    expect(r.route).toBe("FAST_DETERMINISTIC");
    expect(r.tool).toBe("directory_list");
    // Et surtout : PAS la recherche fédérée, qui rendait zéro et faisait renoncer Adam.
    expect(r.tool).not.toBe("search_everything");
  });

  it("« Quel est l'email de Raihana ? » → directory_lookup", () => {
    const r = routeQuery("Quel est l'email de Raihana ?");
    expect(r.route).toBe("FAST_DETERMINISTIC");
    expect(r.tool).toBe("directory_lookup");
    expect(r.args.name).toContain("raihana");
  });

  it("« J'ai reçu quoi aujourd'hui ? » → Gmail", () => {
    const r = routeQuery("J'ai reçu quoi aujourd'hui ?");
    expect(r.route).toBe("FAST_DETERMINISTIC");
    expect(r.tool).toBe("gmail_search");
  });

  it("« Deepak a répondu ? » → Gmail / communication", () => {
    const r = routeQuery("Deepak a répondu ?");
    expect(r.route).toBe("FAST_DETERMINISTIC");
    expect(r.tool).toBe("gmail_search");
    expect(r.args.from).toBe("deepak");
  });

  it("« Combien de paiements sont en attente ? » → Finance, PAS la file de décisions", () => {
    // Le mot « attente » attirait la file de décisions du PDG. Ce sont deux objets différents.
    const r = routeQuery("Combien de paiements sont en attente ?");
    expect(r.domain).toBe("FINANCE");
    expect(r.fastKind).not.toBe("PENDING_DECISIONS");
  });

  it("« Paie la facture. » → mutation Finance, PAS RH", () => {
    // « la paie » (le nom) et « paie » (le verbe) sont le même mot en français.
    const r = routeQuery("Paie la facture.");
    expect(r.route).toBe("ACTION");
    expect(r.domain).toBe("FINANCE");
  });

  it("« Pourquoi Deepak ne répond pas ? » → contexte, pas un piège de mot-clé", () => {
    const r = routeQuery("Pourquoi Deepak ne répond pas ?");
    expect(r.route).toBe("DEEP_REASONING");
    expect(r.route).not.toBe("FAST_DETERMINISTIC");
  });

  it("« Où en est Nintedanib ? » → Regulatory", () => {
    const r = routeQuery("Où en est Nintedanib ?");
    expect(r.route).toBe("FAST_DETERMINISTIC");
    expect(r.domain).toBe("REGULATORY");
    expect(r.tool).toBe("inspect_record");
  });

  it("« Donne-moi les salariés. » → LECTURE, pas ACTION", () => {
    const r = routeQuery("Donne-moi les salariés.");
    expect(r.route).not.toBe("ACTION");
    expect(r.tool).toBe("directory_list");
  });
});

describe("§1 — les autres lectures sûres nommées par la mission", () => {
  const lectures: [string, string][] = [
    ["Quels mails aujourd'hui ?", "gmail_search"],
    ["Des mails de Deepak ?", "gmail_search"],
    ["Mon prochain rendez-vous ?", "read_calendar"],
    ["C'est quoi mon agenda ?", "read_calendar"],
    ["Où en est Raltegravir ?", "inspect_record"],
    ["L'adresse de Khaled ?", "directory_lookup"],
    ["Le numéro de l'imprimeur ?", "directory_lookup"],
    ["Comment je joins Deepak ?", "directory_lookup"],
    ["La liste des contacts ?", "directory_list"],
    ["Montre-moi l'annuaire.", "directory_list"],
  ];

  it.each(lectures)("« %s » → %s, sans modèle pour choisir", (utterance, tool) => {
    const r = routeQuery(utterance);
    expect(r.route).toBe("FAST_DETERMINISTIC");
    expect(r.tool).toBe(tool);
  });

  it("« Qui travaille au service réglementaire ? » filtre le registre", () => {
    const r = routeQuery("Qui travaille au service réglementaire ?");
    expect(r.tool).toBe("directory_list");
    expect(r.args.department).toContain("reglementaire");
  });
});

/**
 * L'ORDRE DES PORTES EST LA PARTIE FRAGILE. Ces cas le verrouillent : ils échoueraient si
 * quelqu'un déplaçait la porte de l'annuaire APRÈS celle de la boîte mail.
 */
describe("§10 — structuré d'abord, et l'ordre des portes le garantit", () => {
  it("« l'email de Raihana » ouvre l'ANNUAIRE, pas la messagerie du PDG", () => {
    // Le mot « email » est présent dans les deux familles. Seul l'ordre tranche.
    expect(routeVoiceUtterance("Quel est l'email de Raihana ?").kind).toBe("DIRECTORY_LOOKUP");
    expect(routeVoiceUtterance("Quel est l'email de Raihana ?").kind).not.toBe("GMAIL_INBOX");
  });

  it("« les adresses mail des salariés » ouvre le REGISTRE, pas la messagerie", () => {
    expect(routeVoiceUtterance("Est-ce que tu as les adresses mail des salariés ?").kind).toBe("DIRECTORY_LIST");
  });

  it("mais « des mails aujourd'hui ? » reste bien la messagerie", () => {
    expect(routeVoiceUtterance("Des mails aujourd'hui ?").kind).toBe("GMAIL_INBOX");
  });

  it("et « tu as une adresse e-mail ? » reste une question sur Adam", () => {
    // Trois familles se disputent le mot « adresse ». La porte de l'identité passe avant.
    expect(routeVoiceUtterance("Tu as une adresse e-mail ?").kind).toBe("DELEGATE");
  });

  it("un mot de coordonnées SANS cible ne prend aucun raccourci", () => {
    // Interroger l'annuaire sur rien ne vaut pas mieux que la recherche fédérée sur rien.
    expect(routeVoiceUtterance("C'est quoi cette adresse ?").kind).toBe("DELEGATE");
  });
});

describe("§3 — les mutations sensibles ne prennent AUCUN raccourci", () => {
  const sensibles = [
    "Supprime le dossier Raltegravir.",
    "Paie la facture de Pharmagene.",
    "Augmente le salaire de Raihana.",
    "Change les droits de Khaled.",
    "Désactive le compte de Khaled.",
    "Envoie le mail à Deepak.",
  ];

  it.each(sensibles)("« %s » reste ACTION — chemin canonique", (phrase) => {
    const r = routeQuery(phrase, { hasPendingMail: false });
    expect(r.route).toBe("ACTION");
    expect(r.tool).toBeNull();
  });
});
