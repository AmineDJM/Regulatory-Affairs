import { describe, expect, it } from "vitest";
import { entreeIteration, identiteIteration } from "@/lib/missions/runtime/interpolate";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ÉLÉMENT D'UNE ITÉRATION — traduire quand il n'y a qu'une lecture, DIRE quand il n'y en a
 * aucune (§118.71).
 *
 * MESURÉ LIVE, mission `cmttukkqf…`. L'étape amont rend
 * `destinataires: ["Amel Haddad", "Raihana Cherif"]` — des CHAÎNES. Le plan écrit
 * `recipientName: "{{regulatory.recipient}}"`, un CHAMP de l'élément.
 *
 * Avant : `lire` descend dans un scalaire → `undefined` → `JSON.stringify` EFFACE la clé →
 * `send_message` reçoit une entrée amputée et refuse « Destinataire « (rien) » introuvable »
 * sur une itération dont la clé d'étape s'appelle `#Amel Haddad`. Le moteur tenait la personne
 * et l'a perdue entre deux lignes de code. Deux collègues n'ont jamais reçu leur demande.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("un élément SCALAIRE est sa propre valeur", () => {
  it("LE CAS MESURÉ : « {{regulatory.recipient}} » sur « Amel Haddad » rend « Amel Haddad »", () => {
    const r = entreeIteration(
      { body: "Bonjour", recipientName: "{{regulatory.recipient}}" },
      "regulatory",
      "Amel Haddad",
    );
    expect(r.entree.recipientName).toBe("Amel Haddad");
    expect(r.manquantes).toEqual([]);
    // ET LA CLÉ EXISTE : c'est sa DISPARITION qui produisait « (rien) », pas sa valeur vide.
    expect(Object.keys(r.entree).sort()).toEqual(["body", "recipientName"]);
  });

  it("le moteur lisait DÉJÀ cette personne pour nommer la fille — les deux lectures concordent", () => {
    // Sans cette concordance, la clé dirait « #Amel Haddad » et l'entrée dirait autre chose :
    // exactement la contradiction que le run live a produite.
    expect(identiteIteration("Amel Haddad", 0)).toBe("Amel Haddad");
    expect(entreeIteration({ to: "{{p.email}}" }, "p", "Amel Haddad").entree.to).toBe("Amel Haddad");
  });

  it("un nombre reste un NOMBRE — la référence seule ne convertit pas en texte", () => {
    const r = entreeIteration({ montant: "{{ligne.total}}" }, "ligne", 4200);
    expect(r.entree.montant).toBe(4200);
  });

  it("l'élément entier se référence sans point, et c'est le geste que le refus recommande", () => {
    expect(entreeIteration({ to: "{{p}}" }, "p", "Amel Haddad").entree.to).toBe("Amel Haddad");
  });
});

describe("un élément OBJET ne se devine JAMAIS", () => {
  it("un champ PRÉSENT se lit normalement", () => {
    const r = entreeIteration(
      { to: "{{e.email}}", nom: "{{e.nom}}" },
      "e",
      { nom: "Amel Haddad", email: "amel@adventum.dz" },
    );
    expect(r.entree).toEqual({ to: "amel@adventum.dz", nom: "Amel Haddad" });
    expect(r.manquantes).toEqual([]);
  });

  /**
   * CE QUI FERAIT TOMBER CE TEST : étendre la traduction aux objets. `{"nom":…,"email":…}`
   * atterrirait dans un destinataire — un chiffre faux muni d'une formule (§118.59), version
   * personne. Un objet qui porte des champs et pas CELUI-LÀ est une vraie erreur de chemin.
   */
  it("un champ ABSENT d'un objet est CONSIGNÉ avec ce que l'élément porte vraiment", () => {
    const r = entreeIteration(
      { to: "{{e.recipient}}" },
      "e",
      { nom: "Amel Haddad", email: "amel@adventum.dz" },
    );
    expect(r.manquantes).toEqual([{ reference: "e.recipient", disponibles: ["nom", "email"] }]);
    // La clé reste absente de l'entrée : on ne fabrique pas une valeur que l'élément n'a pas.
    expect(r.entree.to).toBeUndefined();
  });

  it("une référence à une AUTRE étape n'est pas de l'affaire de l'éventail", () => {
    // `{{lecture:dossier.titre}}` a déjà été résolue en amont ; ce qui reste ici ne doit ni
    // être traduit ni être consigné comme un manque de l'élément.
    const r = entreeIteration({ to: "{{e.email}}", ref: "REG-2026-9011" }, "e", { email: "a@x.dz" });
    expect(r.manquantes).toEqual([]);
    expect(r.entree.ref).toBe("REG-2026-9011");
  });

  it("plusieurs champs absents sont TOUS nommés, sans doublon", () => {
    const r = entreeIteration(
      { to: "{{e.recipient}}", cc: "{{e.recipient}}", objet: "{{e.sujet}}" },
      "e",
      { nom: "X" },
    );
    expect(r.manquantes.map((m) => m.reference)).toEqual(["e.recipient", "e.sujet"]);
  });

  it("un élément NUL n'a aucun champ, et le refus le dit ainsi", () => {
    const r = entreeIteration({ to: "{{e.email}}" }, "e", null);
    // `null` est un scalaire : il rend l'élément, donc `null` — la capacité refusera, mais
    // aucune clé n'aura disparu en silence.
    expect(r.entree.to).toBeNull();
    expect(r.manquantes).toEqual([]);
  });
});
