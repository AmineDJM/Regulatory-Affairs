import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  onlyofficeConfigured, onlyofficeDocType, onlyofficeEditable, fileExt,
  signJwt, verifyJwt, makeEditToken, readEditToken, makeDocEditToken, readDocEditToken,
} from "./onlyoffice";

const PREV = { url: process.env.ONLYOFFICE_URL, secret: process.env.ONLYOFFICE_JWT_SECRET };

beforeAll(() => {
  process.env.ONLYOFFICE_URL = "https://office.example.com";
  process.env.ONLYOFFICE_JWT_SECRET = "test-secret-123";
});
afterAll(() => {
  process.env.ONLYOFFICE_URL = PREV.url;
  process.env.ONLYOFFICE_JWT_SECRET = PREV.secret;
});

describe("OnlyOffice — configuration & types de documents", () => {
  it("est configuré quand l'URL et le secret sont définis", () => {
    expect(onlyofficeConfigured()).toBe(true);
  });
  it("détecte le type d'éditeur selon l'extension", () => {
    expect(onlyofficeDocType("Rapport.docx")).toBe("word");
    expect(onlyofficeDocType("Budget.XLSX")).toBe("cell");
    expect(onlyofficeDocType("Deck.pptx")).toBe("slide");
    expect(onlyofficeDocType("scan.pdf")).toBeNull();
    expect(onlyofficeEditable("note.txt")).toBe(true);
    expect(onlyofficeEditable("image.png")).toBe(false);
    expect(fileExt("a.b.docx")).toBe("docx");
  });
});

describe("OnlyOffice — JWT HS256", () => {
  it("signe et vérifie un payload (aller-retour)", () => {
    const t = signJwt({ a: 1, b: "x" });
    const p = verifyJwt<{ a: number; b: string }>(t);
    expect(p?.a).toBe(1);
    expect(p?.b).toBe("x");
  });
  it("rejette un jeton falsifié", () => {
    const t = signJwt({ a: 1 });
    const tampered = t.slice(0, -2) + (t.endsWith("aa") ? "bb" : "aa");
    expect(verifyJwt(tampered)).toBeNull();
  });
  it("rejette un jeton expiré", () => {
    const t = signJwt({ a: 1 }, -10); // déjà expiré
    expect(verifyJwt(t)).toBeNull();
  });
  it("rejette un jeton signé avec un autre secret", () => {
    const t = signJwt({ a: 1 });
    process.env.ONLYOFFICE_JWT_SECRET = "autre-secret";
    expect(verifyJwt(t)).toBeNull();
    process.env.ONLYOFFICE_JWT_SECRET = "test-secret-123";
  });
  it("jeton d'édition : aller-retour + rejet d'un jeton de mauvais type", () => {
    const t = makeEditToken("node-1", "user-9");
    const p = readEditToken(t);
    expect(p?.nodeId).toBe("node-1");
    expect(p?.userId).toBe("user-9");
    expect(p?.kind).toBe("edit");
    // Un jeton sans kind:"edit" est refusé par readEditToken.
    expect(readEditToken(signJwt({ nodeId: "x", userId: "y" }))).toBeNull();
  });
  it("jeton d'édition de document : aller-retour + isolation des types de jetons", () => {
    const t = makeDocEditToken("doc-7", "user-3");
    const p = readDocEditToken(t);
    expect(p?.docId).toBe("doc-7");
    expect(p?.userId).toBe("user-3");
    expect(p?.kind).toBe("docedit");
    // Un jeton Drive (kind:"edit") n'est pas accepté comme jeton de document, et vice-versa.
    expect(readDocEditToken(makeEditToken("node-1", "user-9"))).toBeNull();
    expect(readEditToken(makeDocEditToken("doc-7", "user-3"))).toBeNull();
  });
});
