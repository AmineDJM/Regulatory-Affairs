import { describe, it, expect } from "vitest";
import { routeQuery } from "./router";
import { shortlistNames } from "./tool-shortlist";
import { isOutboundMail, normalizeUtterance, routeVoiceUtterance } from "@/lib/assistant/voice/fast-path";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « TU PEUX ENVOYÉ UN MAIL À KHALED ? » — et Adam a lu la boîte.
 *
 * Le transcript de production, mot pour mot :
 *
 *   PDG   — Bref, tu peux envoyé un mail à Khaled ?
 *   Adam  — Je n'ai pas l'adresse e-mail de Khaled.
 *
 * L'annuaire l'avait. La description de `directory_lookup` interdit même textuellement cette
 * phrase (« Ne JAMAIS répondre "je n'ai pas son adresse" sans avoir appelé cet outil »). Mais
 * l'outil n'a jamais été proposé : la phrase avait pris le raccourci « état de la boîte », qui
 * n'envoie AUCUN schéma d'outil. Adam ne pouvait rien faire d'autre que lire ce qu'on lui avait
 * mis sous les yeux — des messages reçus, où aucun Khaled ne figurait.
 *
 * La cause tient dans le participe passé : `envoyé` normalisé donne `envoye`, absent des deux
 * listes d'impératifs qui devaient arrêter la phrase. Le remède ne rattrape pas l'orthographe,
 * il change le CRITÈRE : ce qui distingue écrire de lire, c'est le destinataire.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const n = normalizeUtterance;

describe("un courrier adressé est une écriture", () => {
  it("la phrase exacte du transcript", () => {
    expect(isOutboundMail(n("tu peux envoyé un mail à Khaled ?"))).toBe(true);
  });

  it("quelle que soit l'orthographe du verbe", () => {
    for (const v of ["envoie", "envoi", "envoye", "envoyer", "envoyez", "renvoie", "transmets", "adresse"]) {
      expect(isOutboundMail(n(`${v} un mail à Khaled`)), v).toBe(true);
    }
  });

  it("quel que soit le nom du courrier", () => {
    for (const objet of ["mail", "e-mail", "courriel", "message", "courrier", "mot", "note"]) {
      expect(isOutboundMail(n(`envoie un ${objet} à Deepak`)), objet).toBe(true);
    }
  });
});

describe("ce qui reste une LECTURE — l'erreur symétrique", () => {
  it("une boîte qu'on interroge n'adresse rien à personne", () => {
    for (const q of [
      "des mails ?",
      "j'ai reçu quelque chose ?",
      "Deepak a répondu ?",
      "quoi de neuf dans la boîte ?",
    ]) {
      expect(isOutboundMail(n(q)), q).toBe(false);
    }
  });

  it("« des mails à traiter » : ce qui suit « à » est un infinitif, pas un destinataire", () => {
    for (const q of ["j'ai des mails à traiter ?", "combien de messages à lire ?", "des courriers à signer ?"]) {
      expect(isOutboundMail(n(q)), q).toBe(false);
    }
  });

  it("« On a envoyé des courriers cette semaine ? » — un CONSTAT, pas un ordre", () => {
    // Verbatim du même transcript, quatre tours plus loin. Aucun destinataire n'y est nommé :
    // le confondre avec un ordre ferait proposer un envoi à qui n'en demandait pas.
    const q = "On a envoyé des courriers cette semaine ?";
    expect(isOutboundMail(n(q))).toBe(false);
    expect(routeQuery(q).route).not.toBe("ACTION");
  });

  it("« Envoyé ? » seul reste une question", () => {
    // Le piège de la correction naïve : ajouter `envoye` à la liste des impératifs aurait fait
    // de cette question — parfaitement légitime après une carte d'envoi — un ordre neuf.
    expect(isOutboundMail(n("Envoyé ?"))).toBe(false);
    expect(routeQuery("Envoyé ?").route).not.toBe("ACTION");
  });
});

describe("le routage, bout en bout", () => {
  const PHRASE = "tu peux envoyé un mail à Khaled ?";

  it("AVANT : le raccourci de lecture l'avalait — plus maintenant", () => {
    const voice = routeVoiceUtterance(PHRASE);
    expect(voice.kind).not.toBe("GMAIL_INBOX");
    expect(voice.tool).not.toBe("gmail_search");
    expect(voice.fast).toBe(false);
  });

  it("la phrase est classée ACTION — donc chemin canonique, carte d'approbation", () => {
    const r = routeQuery(PHRASE);
    expect(r.route).toBe("ACTION");
    expect(r.domain).toBe("MAIL");
    // FAST_DETERMINISTIC n'envoie aucun outil : c'est précisément ce qui rendait la réponse
    // « je n'ai pas son adresse » inévitable.
    expect(r.route).not.toBe("FAST_DETERMINISTIC");
  });
});

describe("l'annuaire appartient aussi à la messagerie", () => {
  it("une liste courte « messagerie » propose de quoi trouver le destinataire", () => {
    const names = shortlistNames({ route: "STRUCTURED_QUERY", domain: "MAIL" });
    expect(names).toContain("directory_lookup");
    expect(names).toContain("gmail_prepare_mail");
  });

  it("l'annuaire n'a pas quitté son domaine d'origine", () => {
    expect(shortlistNames({ route: "STRUCTURED_QUERY", domain: "DIRECTORY" })).toContain("directory_lookup");
  });
});
