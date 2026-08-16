import { describe, it, expect } from "vitest";
import { toAddress, toAddressList, toFolder, toSummary, toMessage, toAttachmentMeta, skipToken, deltaToken, isRemoved } from "./map";

describe("Les adresses", () => {
  it("lit la forme imbriquée de Graph", () => {
    expect(toAddress({ emailAddress: { name: "Laila", address: "laila@x.dz" } }))
      .toEqual({ name: "Laila", address: "laila@x.dz" });
  });

  it("n'invente pas un libellé quand il répète l'adresse", () => {
    // Graph renvoie souvent `name === address` : afficher « a@b.fr <a@b.fr> » est du bruit.
    expect(toAddress({ emailAddress: { name: "a@b.fr", address: "a@b.fr" } })?.name).toBeNull();
  });

  it("écarte une entrée sans adresse plutôt que d'afficher un vide", () => {
    expect(toAddress({ emailAddress: { name: "Sans adresse" } })).toBeNull();
    expect(toAddress(null)).toBeNull();
    expect(toAddressList("pas un tableau")).toEqual([]);
  });
});

describe("Les dossiers", () => {
  it("reconnaît les dossiers connus par leur nom Graph", () => {
    expect(toFolder({ id: "1", wellKnownName: "inbox" }).wellKnown).toBe("inbox");
    expect(toFolder({ id: "2", wellKnownName: "deleteditems" }).wellKnown).toBe("trash");
    expect(toFolder({ id: "3", wellKnownName: "sentitems" }).wellKnown).toBe("sent");
  });

  it("retombe sur le nom affiché quand Graph n'envoie pas wellKnownName", () => {
    // `wellKnownName` n'est rendu que sur demande : sans ce repli, Réception et Corbeille
    // perdraient leur rôle et se retrouveraient rangées avec les dossiers personnels.
    expect(toFolder({ id: "1", displayName: "Inbox" }).wellKnown).toBe("inbox");
  });

  it("un dossier personnel n'a pas de rôle, et garde son nom", () => {
    const f = toFolder({ id: "9", displayName: "ANPP 2026", unreadItemCount: 3, totalItemCount: 12 });
    expect(f.wellKnown).toBeNull();
    expect(f.name).toBe("ANPP 2026");
    expect(f.unread).toBe(3);
    expect(f.total).toBe(12);
  });
});

describe("Les messages", () => {
  const raw = {
    id: "m1", conversationId: "c1", subject: "Dossier",
    from: { emailAddress: { name: "Laila", address: "laila@x.dz" } },
    toRecipients: [{ emailAddress: { address: "amine@adventumdz.com" } }],
    bodyPreview: "  Bonjour  \n  Amine ", receivedDateTime: "2026-08-16T09:00:00Z",
    isRead: false, hasAttachments: true, isDraft: false, parentFolderId: "inbox",
  };

  it("ramène une ligne de liste complète", () => {
    const s = toSummary(raw);
    expect(s.subject).toBe("Dossier");
    expect(s.from?.address).toBe("laila@x.dz");
    expect(s.isRead).toBe(false);
    expect(s.folderId).toBe("inbox");
  });

  it("resserre l'aperçu sur une seule ligne", () => {
    expect(toSummary(raw).preview).toBe("Bonjour Amine");
  });

  it("un message sans objet reste identifiable", () => {
    expect(toSummary({ id: "x", subject: "   " }).subject).toBe("(sans objet)");
  });

  it("ASSAINIT le corps à la conversion, pas à l'affichage", () => {
    // Un écran qui doit penser à assainir finira par oublier ; un type qui arrive déjà propre
    // ne le peut pas.
    const m = toMessage({ ...raw, body: { contentType: "html", content: '<p>ok</p><script>vol()</script>' } });
    expect(m.bodyHtml).toContain("ok");
    expect(m.bodyHtml).not.toContain("script");
  });

  it("un corps en TEXTE brut est échappé, pas interprété", () => {
    const m = toMessage({ ...raw, body: { contentType: "text", content: "1 < 2 & <b>gras</b>" } });
    expect(m.bodyHtml).toContain("&lt;b&gt;");
    expect(m.bodyHtml).not.toContain("<b>");
  });

  it("écarte les images intégrées de la liste des pièces jointes", () => {
    // Un trombone affiché pour le logo de la signature use le signal jusqu'à ce qu'on l'ignore.
    const m = toMessage(raw, [
      { id: "a1", name: "devis.pdf", contentType: "application/pdf", size: 1024, isInline: false },
      { id: "a2", name: "logo.png", contentType: "image/png", size: 10, isInline: true },
    ]);
    expect(m.attachments.map((a) => a.name)).toEqual(["devis.pdf"]);
  });

  it("une pièce jointe sans nom ni type garde des valeurs exploitables", () => {
    const a = toAttachmentMeta({ id: "x" });
    expect(a.name).toBe("piece-jointe");
    expect(a.contentType).toBe("application/octet-stream");
  });
});

describe("Pagination et delta", () => {
  it("extrait le jeton de page, pas l'URL complète", () => {
    // L'URL porte l'adresse de la boîte : la rendre au navigateur la ferait voyager d'un onglet
    // à l'autre. Le jeton seul ne désigne rien.
    const link = "https://graph.microsoft.com/v1.0/me/messages?$skiptoken=ABC123&$top=25";
    expect(skipToken(link)).toBe("ABC123");
    expect(skipToken(link)).not.toContain("graph.microsoft.com");
  });

  it("extrait le jeton de delta", () => {
    expect(deltaToken("https://graph…/delta?$deltatoken=XYZ")).toBe("XYZ");
  });

  it("absence de lien = fin de liste, pas une erreur", () => {
    expect(skipToken(null)).toBeNull();
    expect(deltaToken(undefined)).toBeNull();
  });

  it("reconnaît une entrée supprimée d'un delta", () => {
    expect(isRemoved({ id: "m1", "@removed": { reason: "deleted" } })).toBe(true);
    expect(isRemoved({ id: "m1" })).toBe(false);
  });
});
