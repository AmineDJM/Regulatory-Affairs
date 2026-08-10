import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { appendThreadMessage, clearThread, loadThread, loadThreadMemory, threadMemory } from "./dossier-thread";

/**
 * Messagerie persistante du dossier : le fil survit à la sortie de l'app (round-trip base), les
 * pièces soumises restent visibles pour l'agent aux tours suivants (mémoire), chaque utilisateur
 * a SON fil, et l'OCR le plus hostile (caractères de contrôle, NUL) ne casse pas l'écriture.
 */

const TAG = `test-thread-${Date.now()}`;
let companyId = "";
let dossierId = "";
const USER_A = `${TAG}-alice`;
const USER_B = `${TAG}-bob`;

describe("dossier-thread — mémoire pure (threadMemory)", () => {
  const row = (role: string, content: string, extra?: { attachments?: unknown; error?: boolean }) => ({
    role,
    content,
    attachments: extra?.attachments ?? null,
    error: extra?.error ?? false,
  });

  it("borne l'historique aux 8 derniers tours, écarte les messages en erreur et tronque le texte", () => {
    const rows = [
      row("assistant", "panne réseau", { error: true }),
      ...Array.from({ length: 12 }, (_, i) => row(i % 2 === 0 ? "user" : "assistant", `tour ${i} ${"x".repeat(3000)}`)),
    ];
    const { history } = threadMemory(rows);
    expect(history).toHaveLength(8);
    expect(history[0].content.startsWith("tour 4")).toBe(true);
    expect(history.every((t) => t.content.length <= 2000)).toBe(true);
    expect(history.some((t) => t.content.includes("panne réseau"))).toBe(false);
  });

  it("re-présente les pièces déjà soumises : dédupliquées par nom (la plus récente gagne), illisibles exclues, 6 max", () => {
    const rows = [
      row("user", "voici la lettre", { attachments: [{ filename: "COURRIER ANPP.pdf", text: "version 1 de la lettre" }] }),
      row("assistant", "je lis"),
      row("user", "re-voici", {
        attachments: [
          { filename: "courrier anpp.pdf", text: "version 2 de la lettre" },
          { filename: "scan-vide.pdf", error: "aucun texte exploitable" },
          { filename: "certif.pdf", text: "certificat GMP" },
        ],
      }),
      row("user", "et ceci", {
        attachments: [
          { filename: "a.pdf", text: "A" },
          { filename: "b.pdf", text: "B" },
          { filename: "c.pdf", text: "C" },
          { filename: "d.pdf", text: "D" },
          { filename: "e.pdf", text: "E" },
        ],
      }),
    ];
    const { priorAttachments } = threadMemory(rows);
    expect(priorAttachments).toHaveLength(6); // plafond (7 pièces lisibles uniques soumises)
    const names = priorAttachments.map((a) => a.filename);
    expect(names).toContain("a.pdf");
    expect(names).not.toContain("scan-vide.pdf"); // illisible → rien à re-présenter
    // La re-soumission du même nom (casse différente) ne compte qu'une fois, version la plus récente.
    const courrier = priorAttachments.find((a) => a.filename.toLowerCase() === "courrier anpp.pdf");
    expect(courrier?.text).toBe("version 2 de la lettre");
  });
});

describe("dossier-thread — persistance (round-trip base)", () => {
  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `${TAG}-co` }, select: { id: true } })).id;
    dossierId = (await prisma.regulatoryDossier.create({
      data: { companyId, reference: `${TAG}-ref`, title: "Triumeq", createdById: "u" },
      select: { id: true },
    })).id;
  });

  afterAll(async () => {
    await prisma.regulatoryDossier.deleteMany({ where: { companyId } }).catch(() => undefined);
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
  });

  it("le fil survit : messages, pièces (lisible ET illisible avec motif), citations, PDF, erreurs", async () => {
    await appendThreadMessage(dossierId, USER_A, {
      role: "user",
      content: "On a reçu ce courrier, réponds point par point.",
      attachments: [
        { filename: "COURRIER ANPP.pdf", text: "Réserve 1 : validation analytique incomplète. Réserve 2 : stabilité." },
        { filename: "scan-brouille.pdf", error: "aucun texte exploitable, même après OCR" },
      ],
    });
    await appendThreadMessage(dossierId, USER_A, {
      role: "assistant",
      content: "La lettre comporte 2 réserves [1].",
      citations: [{ n: 1, documentId: "d1", filename: "COURRIER ANPP.pdf", ctdSection: null, page: 1, snippet: "Réserve 1" }],
      files: [{ name: "projet-reponse.pdf", url: "/api/x/1" }],
    });
    await appendThreadMessage(dossierId, USER_A, { role: "assistant", content: "panne", error: true });

    const thread = await loadThread(dossierId, USER_A);
    expect(thread).toHaveLength(3);
    expect(thread[0].role).toBe("user");
    expect(thread[0].attachedNames).toEqual(["COURRIER ANPP.pdf", "scan-brouille.pdf"]);
    expect(thread[1].citations?.[0].filename).toBe("COURRIER ANPP.pdf");
    expect(thread[1].files?.[0].name).toBe("projet-reponse.pdf");
    expect(thread[2].error).toBe(true);

    // La mémoire de l'agent : l'historique saute l'erreur, la pièce lisible est re-présentée.
    const memory = await loadThreadMemory(dossierId, USER_A);
    expect(memory.history).toHaveLength(2);
    expect(memory.priorAttachments).toHaveLength(1);
    expect(memory.priorAttachments[0].filename).toBe("COURRIER ANPP.pdf");
    expect(memory.priorAttachments[0].text).toContain("validation analytique");
  });

  it("chaque utilisateur a SON fil ; l'effacement ne touche que le sien", async () => {
    await appendThreadMessage(dossierId, USER_B, { role: "user", content: "question de Bob" });
    expect((await loadThread(dossierId, USER_B)).map((m) => m.text)).toEqual(["question de Bob"]);
    expect((await loadThread(dossierId, USER_A)).some((m) => m.text === "question de Bob")).toBe(false);

    await clearThread(dossierId, USER_B);
    expect(await loadThread(dossierId, USER_B)).toHaveLength(0);
    expect((await loadThread(dossierId, USER_A)).length).toBeGreaterThan(0);
  });

  it("un texte OCR hostile (NUL, caractères de contrôle) s'enregistre sans exploser (JSONB refuse le NUL brut)", async () => {
    await appendThreadMessage(dossierId, USER_A, {
      role: "user",
      content: "avant \u0000après\u0007fin",
      attachments: [{ filename: "scan.pdf", text: "l\u0000igne ocr" }],
    });
    const thread = await loadThread(dossierId, USER_A);
    const last = thread[thread.length - 1];
    expect(last.text).toContain("avant");
    expect(last.text).toContain("fin");
    expect(last.text.includes("\u0000")).toBe(false);
    expect(last.text.includes("\u0007")).toBe(false);
    expect(last.attachedNames).toEqual(["scan.pdf"]);
  });
});
