import { describe, it, expect } from "vitest";
import { detectMime } from "./mime";

const buf = (...bytes: number[]) => Buffer.from(bytes);

describe("detectMime — octets magiques + détection d'extension usurpée", () => {
  it("PDF réel avec extension .pdf", () => {
    const r = detectMime(buf(0x25, 0x50, 0x44, 0x46, 0x2d), "pdf");
    expect(r.family).toBe("pdf");
    expect(r.matchesExt).toBe(true);
  });

  it("archive OOXML (PK) avec .docx = cohérent", () => {
    const r = detectMime(buf(0x50, 0x4b, 0x03, 0x04), "docx");
    expect(r.family).toBe("zip-office");
    expect(r.matchesExt).toBe(true);
  });

  it("EXÉCUTABLE déguisé en .pdf → détecté (famille executable, incohérent)", () => {
    const r = detectMime(buf(0x4d, 0x5a, 0x90, 0x00), "pdf");
    expect(r.family).toBe("executable");
    expect(r.matchesExt).toBe(false);
  });

  it("ZIP déguisé en .pdf → incohérence signalée", () => {
    const r = detectMime(buf(0x50, 0x4b, 0x03, 0x04), "pdf");
    expect(r.matchesExt).toBe(false);
  });

  it("PNG réel", () => {
    const r = detectMime(buf(0x89, 0x50, 0x4e, 0x47), "png");
    expect(r.mime).toBe("image/png");
    expect(r.matchesExt).toBe(true);
  });
});
