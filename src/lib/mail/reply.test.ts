import { describe, it, expect } from "vitest";
import {
  buildReplyDraft, dedupeAddresses, replySubject, forwardSubject, parseAddressList, formatAddress, previewOf,
} from "./reply";
import type { MailMessage } from "./provider";

const ME = "amine.djouamai@adventumdz.com";
const addr = (address: string, name: string | null = null) => ({ name, address });

const msg = (over: Partial<MailMessage> = {}): MailMessage => ({
  id: "msg-1", conversationId: "conv-1", subject: "Dossier ANPP",
  from: addr("laila@fournisseur.dz", "Laila"),
  to: [addr(ME, "Amine"), addr("karim@adventumdz.com", "Karim")],
  cc: [addr("direction@adventumdz.com")],
  bcc: [], replyTo: [],
  preview: "", receivedAt: "2026-08-16T09:00:00.000Z",
  isRead: true, hasAttachments: false, isDraft: false, folderId: "inbox",
  bodyHtml: "<p>Bonjour</p>", bodyText: "Bonjour", attachments: [], webLink: null,
  ...over,
});

describe("Répondre", () => {
  it("répond à l'expéditeur", () => {
    const d = buildReplyDraft(msg(), "reply", ME);
    expect(d.to.map((a) => a.address)).toEqual(["laila@fournisseur.dz"]);
    expect(d.cc ?? []).toEqual([]);
  });

  it("suit reply-to quand il existe — c'est l'adresse qui LIT", () => {
    // Listes de diffusion et boîtes partagées posent cet en-tête ; l'ignorer envoie la réponse
    // à une adresse que personne ne relève.
    const d = buildReplyDraft(msg({ replyTo: [addr("support@fournisseur.dz")] }), "reply", ME);
    expect(d.to.map((a) => a.address)).toEqual(["support@fournisseur.dz"]);
  });

  it("préfixe « Re: » une seule fois", () => {
    expect(replySubject("Dossier")).toBe("Re: Dossier");
    expect(replySubject("Re: Dossier")).toBe("Re: Dossier");
    expect(replySubject("RE: Dossier")).toBe("RE: Dossier");
  });

  it("cite le message d'origine sous la réponse", () => {
    const d = buildReplyDraft(msg(), "reply", ME);
    expect(d.bodyHtml).toContain("blockquote");
    expect(d.bodyHtml).toContain("Bonjour");
  });
});

describe("Répondre à tous", () => {
  it("garde tout le monde SAUF soi-même", () => {
    // Se remettre dans ses propres destinataires, c'est se noyer dans ses propres réponses.
    const d = buildReplyDraft(msg(), "replyAll", ME);
    const all = [...d.to, ...(d.cc ?? [])].map((a) => a.address);
    expect(all).not.toContain(ME);
    expect(all).toContain("laila@fournisseur.dz");
    expect(all).toContain("karim@adventumdz.com");
    expect(all).toContain("direction@adventumdz.com");
  });

  it("n'oublie pas le Cc — sinon la moitié du fil décroche", () => {
    const d = buildReplyDraft(msg(), "replyAll", ME);
    expect((d.cc ?? []).map((a) => a.address)).toContain("direction@adventumdz.com");
  });

  it("ne met personne deux fois", () => {
    const d = buildReplyDraft(msg({ cc: [addr("laila@fournisseur.dz")] }), "replyAll", ME);
    const all = [...d.to, ...(d.cc ?? [])].map((a) => a.address.toLowerCase());
    expect(new Set(all).size).toBe(all.length);
  });

  it("ignore la casse de sa propre adresse", () => {
    const d = buildReplyDraft(msg({ to: [addr("AMINE.DJOUAMAI@ADVENTUMDZ.COM")] }), "replyAll", ME);
    expect([...d.to, ...(d.cc ?? [])].map((a) => a.address.toLowerCase())).not.toContain(ME);
  });

  it("répondre à un message qu'on s'est envoyé à soi-même reste possible", () => {
    const d = buildReplyDraft(msg({ from: addr(ME), to: [addr(ME)], cc: [] }), "reply", ME);
    expect(d.to.map((a) => a.address)).toEqual([ME]);
  });
});

describe("Transférer", () => {
  it("part SANS destinataire — c'est à l'humain de choisir", () => {
    // Pré-remplir ici serait le meilleur moyen d'envoyer un fil interne au mauvais correspondant.
    const d = buildReplyDraft(msg(), "forward", ME);
    expect(d.to).toEqual([]);
  });

  it("préfixe « Tr: » une seule fois, et reconnaît « Fwd: »", () => {
    expect(forwardSubject("Dossier")).toBe("Tr: Dossier");
    expect(forwardSubject("Tr: Dossier")).toBe("Tr: Dossier");
    expect(forwardSubject("Fwd: Dossier")).toBe("Fwd: Dossier");
  });

  it("emporte le message d'origine", () => {
    expect(buildReplyDraft(msg(), "forward", ME).bodyHtml).toContain("Bonjour");
  });
});

describe("Lire une saisie libre de destinataires", () => {
  it("accepte virgules, points-virgules et retours ligne", () => {
    const list = parseAddressList("a@b.fr, c@d.fr; e@f.fr\ng@h.fr");
    expect(list.map((a) => a.address)).toEqual(["a@b.fr", "c@d.fr", "e@f.fr", "g@h.fr"]);
  });

  it("comprend la forme « Nom <adresse> »", () => {
    const [one] = parseAddressList("Amine Djouamai <amine@adventumdz.com>");
    expect(one).toEqual({ name: "Amine Djouamai", address: "amine@adventumdz.com" });
  });

  it("écarte une saisie qui n'est pas une adresse, sans faire échouer le reste", () => {
    // Mieux vaut ignorer une faute de frappe que refuser tout l'envoi au dernier moment.
    expect(parseAddressList("bonjour, a@b.fr").map((a) => a.address)).toEqual(["a@b.fr"]);
    expect(parseAddressList("")).toEqual([]);
  });

  it("dédoublonne", () => {
    expect(parseAddressList("a@b.fr, A@B.FR")).toHaveLength(1);
  });

  it("réécrit une adresse comme on l'écrit dans un client mail", () => {
    expect(formatAddress(addr("a@b.fr", "Alice"))).toBe("Alice <a@b.fr>");
    expect(formatAddress(addr("a@b.fr"))).toBe("a@b.fr");
  });
});

describe("Aperçu de ligne", () => {
  it("réduit le corps à une ligne", () => {
    expect(previewOf("<p>Bonjour</p><p>Voici le dossier</p>")).toBe("Bonjour Voici le dossier");
  });

  it("coupe proprement au-delà de la longueur voulue", () => {
    const p = previewOf(`<p>${"a".repeat(300)}</p>`, 50);
    expect(p).toHaveLength(50);
    expect(p.endsWith("…")).toBe(true);
  });
});

describe("Dédoublonnage d'adresses", () => {
  it("garde le premier libellé rencontré", () => {
    const out = dedupeAddresses([addr("a@b.fr", "Alice"), addr("a@b.fr", "A.")]);
    expect(out).toEqual([{ name: "Alice", address: "a@b.fr" }]);
  });

  it("écarte les entrées vides sans lever", () => {
    expect(dedupeAddresses([{ name: null, address: "" }])).toEqual([]);
  });
});
