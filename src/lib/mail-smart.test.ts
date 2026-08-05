import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildProviderCall, cleanRecipients, normalizeInbound, verifyInboundSignature } from "./mail-smart";

/**
 * COURRIER « SMART ». Deux exigences, testées sans réseau ni compte fournisseur :
 *   • l'envoi part sur le port 443 (API HTTPS), quel que soit le fournisseur choisi ;
 *   • la réception n'accepte QUE ce qui est signé — un webhook ouvert serait une boîte
 *     aux lettres publique dans laquelle n'importe qui déposerait de faux messages.
 */

const KEY = "clef-de-test";
const FROM = "no-reply@adventum.dz";
const INPUT = { to: ["a@b.dz"], subject: "Objet", text: "Corps" };

describe("Courrier smart — envoi par API HTTPS (fin du SMTP bloqué)", () => {
  it("chaque fournisseur est appelé en HTTPS, jamais sur un port SMTP", () => {
    for (const p of ["resend", "postmark", "brevo"] as const) {
      const call = buildProviderCall(p, FROM, KEY, INPUT);
      expect(call.url.startsWith("https://")).toBe(true);
      expect(call.url).not.toMatch(/:(25|465|587)\b/);
    }
  });

  it("la clé d'API voyage dans l'en-tête attendu par chaque fournisseur", () => {
    expect(buildProviderCall("resend", FROM, KEY, INPUT).headers.authorization).toBe(`Bearer ${KEY}`);
    expect(buildProviderCall("postmark", FROM, KEY, INPUT).headers["X-Postmark-Server-Token"]).toBe(KEY);
    expect(buildProviderCall("brevo", FROM, KEY, INPUT).headers["api-key"]).toBe(KEY);
  });

  it("le corps est traduit dans la forme propre à chaque fournisseur", () => {
    const resend = buildProviderCall("resend", FROM, KEY, INPUT).body as Record<string, unknown>;
    expect(resend).toMatchObject({ from: FROM, to: ["a@b.dz"], subject: "Objet", text: "Corps" });

    const postmark = buildProviderCall("postmark", FROM, KEY, INPUT).body as Record<string, unknown>;
    expect(postmark).toMatchObject({ From: FROM, To: "a@b.dz", Subject: "Objet", TextBody: "Corps" });

    const brevo = buildProviderCall("brevo", FROM, KEY, INPUT).body as Record<string, unknown>;
    expect(brevo).toMatchObject({ sender: { email: FROM }, to: [{ email: "a@b.dz" }], subject: "Objet", textContent: "Corps" });
  });

  it("les destinataires sont nettoyés, dédoublonnés, et les saisies fausses écartées", () => {
    expect(cleanRecipients([" A@B.DZ ", "a@b.dz", "pas-une-adresse", "", "c@d.dz"])).toEqual(["a@b.dz", "c@d.dz"]);
  });
});

describe("Courrier smart — réception : rien n'entre sans signature valide", () => {
  const body = JSON.stringify({ From: "x@y.dz", To: "contact@adventum.dz", Subject: "Bonjour", TextBody: "Salut" });
  const sign = (b: string, secret: string) => createHmac("sha256", secret).update(b, "utf8").digest("hex");

  it("accepte une signature juste (avec ou sans préfixe « sha256= »)", () => {
    const sig = sign(body, "secret");
    expect(verifyInboundSignature(body, sig, "secret")).toBe(true);
    expect(verifyInboundSignature(body, `sha256=${sig}`, "secret")).toBe(true);
  });

  it("refuse une signature fausse, absente, ou calculée avec un autre secret", () => {
    expect(verifyInboundSignature(body, sign(body, "autre-secret"), "secret")).toBe(false);
    expect(verifyInboundSignature(body, null, "secret")).toBe(false);
    expect(verifyInboundSignature(body, "zzzz", "secret")).toBe(false);
    expect(verifyInboundSignature(body, sign(body, "secret"), "")).toBe(false);
  });

  it("refuse un corps modifié après signature (falsification du contenu)", () => {
    const sig = sign(body, "secret");
    const tampered = body.replace("Salut", "Virement urgent");
    expect(verifyInboundSignature(tampered, sig, "secret")).toBe(false);
  });
});

describe("Courrier smart — un message entrant, trois dialectes, une seule forme", () => {
  it("Postmark", () => {
    const m = normalizeInbound("postmark", {
      MessageID: "pm-1", From: "Ali <ali@ext.dz>", FromFull: { Name: "Ali" },
      ToFull: [{ Email: "Contact@Adventum.dz" }], Subject: "Devis", TextBody: "Bonjour",
    });
    expect(m).toEqual({
      messageId: "pm-1", fromAddress: "ali@ext.dz", fromName: "Ali",
      toAddress: "contact@adventum.dz", subject: "Devis", text: "Bonjour",
    });
  });

  it("Brevo", () => {
    const m = normalizeInbound("brevo", {
      "message-id": "bv-1", from: { address: "ali@ext.dz", name: "Ali" },
      to: [{ address: "contact@adventum.dz" }], subject: "Devis", text: "Bonjour",
    });
    expect(m?.fromAddress).toBe("ali@ext.dz");
    expect(m?.toAddress).toBe("contact@adventum.dz");
    expect(m?.messageId).toBe("bv-1");
  });

  it("Resend", () => {
    const m = normalizeInbound("resend", {
      data: { email_id: "rs-1", from: "ali@ext.dz", to: ["contact@adventum.dz"], subject: "Devis", text: "Bonjour" },
    });
    expect(m?.fromAddress).toBe("ali@ext.dz");
    expect(m?.toAddress).toBe("contact@adventum.dz");
  });

  it("un message sans expéditeur ou sans destinataire est écarté", () => {
    expect(normalizeInbound("postmark", { Subject: "Vide" })).toBeNull();
    expect(normalizeInbound("postmark", { From: "a@b.dz" })).toBeNull();
    expect(normalizeInbound("resend", null)).toBeNull();
  });
});
