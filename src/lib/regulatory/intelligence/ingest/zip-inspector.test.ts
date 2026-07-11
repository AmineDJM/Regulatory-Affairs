import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { createHash } from "crypto";
import { inspectZip, unsafePath } from "./zip-inspector";

async function makeZip(files: Record<string, Buffer | string>): Promise<Buffer> {
  const z = new JSZip();
  for (const [name, content] of Object.entries(files)) z.file(name, content);
  return z.generateAsync({ type: "nodebuffer" });
}

describe("inspectZip — ingestion CTD sécurisée", () => {
  it("accepte une archive saine et calcule le SHA-256 exact", async () => {
    const content = Buffer.from("Rapport de stabilité — données");
    const buf = await makeZip({ "m3/3.2.p.8-stabilite.pdf": content, "m1/1.2-formulaire.docx": Buffer.from("form") });
    const res = await inspectZip(buf);
    expect(res.ok).toBe(true);
    expect(res.entries).toHaveLength(2);
    const stab = res.entries.find((e) => e.filename.startsWith("3.2.p.8"))!;
    expect(stab.securityStatus).toBe("SAFE");
    expect(stab.sha256).toBe(createHash("sha256").update(content).digest("hex"));
  });

  it("bloque le path traversal (vecteurs préservés par JSZip : absolu + backslash)", async () => {
    // NB : JSZip normalise `../a` → `a` à la génération/lecture ; on teste donc les
    // vecteurs qu'il PRÉSERVE et que notre garde doit intercepter (chemin absolu, backslash).
    const buf = await makeZip({ "/etc/passwd": Buffer.from("x"), "..\\..\\evil": Buffer.from("w"), "ok.pdf": Buffer.from("y") });
    const res = await inspectZip(buf);
    expect(res.ok).toBe(true);
    const blocked = res.entries.filter((e) => e.securityStatus === "BLOCKED_PATH");
    expect(blocked.length).toBeGreaterThanOrEqual(2);
    // Le fichier sain reste SAFE et n'est pas emporté par le blocage.
    expect(res.entries.find((e) => e.filename === "ok.pdf")?.securityStatus).toBe("SAFE");
  });

  it("refuse les exécutables / scripts / macros (jamais matérialisés)", async () => {
    const buf = await makeZip({ "setup.exe": Buffer.from("MZ"), "macro.xlsm": Buffer.from("x"), "doc.pdf": Buffer.from("z") });
    const res = await inspectZip(buf);
    const exe = res.entries.find((e) => e.ext === "exe")!;
    const mac = res.entries.find((e) => e.ext === "xlsm")!;
    expect(exe.securityStatus).toBe("BLOCKED_EXECUTABLE");
    expect(mac.securityStatus).toBe("BLOCKED_EXECUTABLE");
    expect(exe.sha256).toBe("");
  });

  it("bloque une profondeur d'arborescence excessive", async () => {
    const buf = await makeZip({ "a/b/c/d/e/deep.pdf": Buffer.from("x") });
    const res = await inspectZip(buf, { maxDepth: 2 });
    expect(res.entries[0].securityStatus).toBe("BLOCKED_PATH");
  });

  it("rejette une archive avec trop de fichiers", async () => {
    const buf = await makeZip({ "a.pdf": "1", "b.pdf": "2", "c.pdf": "3", "d.pdf": "4" });
    const res = await inspectZip(buf, { maxEntries: 3 });
    expect(res.ok).toBe(false);
    expect(res.rejection?.code).toBe("TOO_MANY_FILES");
  });

  it("rejette une archive plus grande que la limite", async () => {
    const buf = await makeZip({ "a.pdf": Buffer.alloc(2000, 1) });
    const res = await inspectZip(buf, { maxArchiveBytes: 10 });
    expect(res.ok).toBe(false);
    expect(res.rejection?.code).toBe("ARCHIVE_TOO_LARGE");
  });

  it("rejette une archive vide", async () => {
    const buf = await makeZip({});
    const res = await inspectZip(buf);
    expect(res.ok).toBe(false);
    expect(res.rejection?.code).toBe("EMPTY");
  });

  it("rejette une ZIP bomb (volume total dépassé)", async () => {
    const buf = await makeZip({ "zeros.bin": Buffer.alloc(500 * 1024, 0) });
    const res = await inspectZip(buf, { maxTotalUncompressed: 100 * 1024 });
    expect(res.ok).toBe(false);
    expect(["TOTAL_TOO_LARGE", "RATIO_EXCEEDED"]).toContain(res.rejection?.code);
  });
});

describe("unsafePath — prédicat de sécurité pur (indépendant de JSZip)", () => {
  it("intercepte tous les vecteurs dangereux", () => {
    for (const p of [
      "../../etc/passwd",       // traversal relatif
      "a/b/../../../secret",    // traversal enfoui
      "/etc/passwd",            // absolu POSIX
      "..\\..\\windows\\system32", // backslash + traversal
      "dir\\file",              // backslash Windows
      "C:\\Users\\x",           // lecteur Windows
      "d:relatif",              // lecteur Windows (minuscule)
      "~/.ssh/id_rsa",          // home tilde
      "bon\0nul.pdf",           // octet nul
      "",                       // vide
    ]) {
      expect(unsafePath(p)).toBe(true);
    }
  });

  it("laisse passer les chemins CTD légitimes", () => {
    for (const p of [
      "m3/3.2.p.8-stabilite.pdf",
      "m1/1.2-formulaire.docx",
      "module 2/2.3 résumé qualité.pdf",
      "a.pdf",
    ]) {
      expect(unsafePath(p)).toBe(false);
    }
  });
});
