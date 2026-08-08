import { describe, it, expect } from "vitest";
import { buildLunaBody, lunaErrorMessage, mentionsUnsupportedTemperature } from "./openai-luna";

/**
 * LA VOIE RÉELLEMENT EMPRUNTÉE PAR LA REVUE CTD.
 *
 * `reviewDocumentText` a Claude pour valeur PAR DÉFAUT, mais le runner lui passe la fonction Luna
 * tracée : c'est ici que passe l'analyse de fond en production. Un correctif appliqué à l'autre
 * fournisseur n'y change donc rien — ces tests existent pour que la voie de production soit
 * couverte, et pas seulement celle qu'on lit dans une signature.
 */
describe("buildLunaBody — assainissement du texte envoyé", () => {
  it("retire les caractères invalides de l'invite ET du message système", () => {
    const body = buildLunaBody({
      system: "Tu es un\uD800 évaluateur",
      user: "Teneur \u0000 95,0 %",
    }) as { messages: { role: string; content: string }[] };

    expect(body.messages[0].content).toBe("Tu es un évaluateur");
    expect(body.messages[1].content).toBe("Teneur   95,0 %");
  });

  it("laisse intact un texte réglementaire ordinaire", () => {
    const user = "Spécification : teneur 95,0 – 105,0 % (CLHP). Conservation < 25 °C.";
    const body = buildLunaBody({ user }) as { messages: { role: string; content: string }[] };
    expect(body.messages[0].content).toBe(user);
  });

  it("assainit aussi la partie texte quand des images accompagnent l'invite", () => {
    const body = buildLunaBody({
      user: "Figure \u001F 1",
      images: [{ buffer: Buffer.from("x"), mime: "image/png" }],
    }) as { messages: { role: string; content: { type: string; text?: string }[] }[] };
    expect(body.messages[0].content[0].text).toBe("Figure   1");
  });
});

describe("mentionsUnsupportedTemperature — porte de sortie d'une panne TOTALE", () => {
  /**
   * Un paramètre refusé par le modèle produit un 400 DÉTERMINISTE : envoyé à chaque part, il fait
   * échouer la revue du dossier entier, à chaque tentative. Le reconnaître permet de le retirer
   * et de continuer, plutôt que de rendre un dossier non analysé.
   */
  it("reconnaît les formulations usuelles des fournisseurs", () => {
    expect(mentionsUnsupportedTemperature('{"error":{"message":"Unsupported value: \'temperature\' does not support 0.2 with this model. Only the default (1) is supported."}}')).toBe(true);
    expect(mentionsUnsupportedTemperature('{"error":{"message":"temperature is not supported for this model"}}')).toBe(true);
    expect(mentionsUnsupportedTemperature('{"error":{"message":"Unknown parameter: temperature."}}')).toBe(true);
  });

  it("ne se déclenche pas sur un autre refus (on ne retire pas un paramètre au hasard)", () => {
    expect(mentionsUnsupportedTemperature('{"error":{"message":"maximum context length exceeded"}}')).toBe(false);
    expect(mentionsUnsupportedTemperature('{"error":{"message":"invalid api key"}}')).toBe(false);
    expect(mentionsUnsupportedTemperature("")).toBe(false);
  });
});

describe("lunaErrorMessage — une panne doit se NOMMER", () => {
  it("remonte le message exact de l'API plutôt qu'un code nu", () => {
    const msg = lunaErrorMessage(400, '{"error":{"message":"maximum context length is 1050000 tokens"}}');
    expect(msg).toContain("HTTP 400");
    expect(msg).toContain("maximum context length");
  });

  it("se rabat sur un extrait lisible quand le corps n'est pas du JSON", () => {
    expect(lunaErrorMessage(502, "<html>Bad Gateway</html>")).toContain("Bad Gateway");
  });

  it("reste utilisable quand le corps est vide", () => {
    expect(lunaErrorMessage(500, "")).toBe("Erreur IA (HTTP 500).");
  });
});
