import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REFUS_IA_COUPEE, remplacerLecteurInterrupteurIaPourTests } from "@/lib/ai-settings";
import { callLuna, lunaEmbed, submitBatch } from "@/lib/openai-luna";
import { transcrireAvecSegments } from "@/lib/media/stt";

/**
 * ═════════════════════════════════════════════════════════════════
 * L'INTERRUPTEUR GÉNÉRAL TIENT AUSSI CE QUI NE PASSE PAS PAR `lib/ai.ts` (§118.196, lot D1 — audit 360°, F3).
 *
 * Le lot avait branché l'interrupteur sur `lib/ai.ts` et sur l'OCR, et écrit honnêtement ce qui
 * restait dehors : le client Luna de l'intelligence réglementaire (lecture visuelle, réserves,
 * revue, corpus, plongements, lots) et la transcription des médias du Drive. Sous un interrupteur
 * coupé — « Toute l'IA est coupée », dit l'écran —, ces deux portes envoyaient encore des documents
 * et des enregistrements chez le fournisseur. Ce banc l'exige dans les DEUX sens : coupé, aucun
 * octet ne part ; rallumé, l'appel part comme avant (sans la seconde moitié, une porte qui
 * refuserait tout passerait pour juste, §118.17).
 *
 * La ligne `AiSetting` n'est jamais touchée (globale, partagée par la suite, §118.132) : le lecteur
 * s'injecte, et `fetch` est remplacé — aucun appel réseau ne part de ce banc.
 * ═════════════════════════════════════════════════════════════════
 */

let coupe = false;
let lectures = 0;
const reseau = vi.fn(async () => new Response(JSON.stringify({ error: { message: "banc" } }), { status: 400 }));
const cleAvant = process.env.OPENAI_API_KEY;

beforeEach(() => {
  coupe = false;
  lectures = 0;
  reseau.mockClear();
  remplacerLecteurInterrupteurIaPourTests(async () => { lectures += 1; return coupe; });
  vi.stubGlobal("fetch", reseau);
  process.env.OPENAI_API_KEY = "cle-de-banc";
});
afterEach(() => {
  remplacerLecteurInterrupteurIaPourTests(null);
  vi.unstubAllGlobals();
  if (cleAvant === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = cleAvant;
});

const enregistrement = Buffer.from("ID3 faux enregistrement de banc");

describe("coupé : le client Luna et la transcription n'envoient RIEN", () => {
  it("callLuna rend le refus de l'interrupteur — `configured: true`, la clé n'est pas en cause — et le réseau n'est jamais appelé", async () => {
    coupe = true;
    const r = await callLuna({ user: "Résume ce dossier." });
    expect(r).toMatchObject({ ok: false, configured: true, error: REFUS_IA_COUPEE });
    expect(reseau).not.toHaveBeenCalled();
    expect(lectures).toBe(1);
  });

  it("coupé ET sans clé : la réponse vraie est « coupé », pas « posez la clé » — l'interrupteur se lit AVANT la clé", async () => {
    coupe = true;
    delete process.env.OPENAI_API_KEY;
    expect((await callLuna({ user: "x" })).error).toBe(REFUS_IA_COUPEE);
    expect((await submitBatch([])).error).toBe(REFUS_IA_COUPEE);
    expect(reseau).not.toHaveBeenCalled();
  });

  it("submitBatch ne dépose aucun lot ; lunaEmbed rend `null` (l'appelant reste en lexical pur)", async () => {
    coupe = true;
    expect(await submitBatch([{ customId: "a", input: { user: "x" } }])).toEqual({ ok: false, error: REFUS_IA_COUPEE });
    expect(await lunaEmbed(["durée de conservation"])).toBeNull();
    expect(reseau).not.toHaveBeenCalled();
  });

  it("la transcription d'un média du Drive n'envoie pas l'enregistrement, et dit pourquoi", async () => {
    coupe = true;
    const moteur = vi.fn(reseau);
    const r = await transcrireAvecSegments(enregistrement, "reunion.mp3", { fetchImpl: moteur as unknown as typeof fetch, env: { OPENAI_API_KEY: "cle-de-banc" } });
    expect(r).toEqual({ ok: false, configured: true, erreur: REFUS_IA_COUPEE });
    expect(moteur).not.toHaveBeenCalled();
  });
});

describe("rallumé : tout part comme avant — et l'interrupteur a bien été LU", () => {
  it("callLuna, submitBatch et lunaEmbed atteignent le fournisseur", async () => {
    await callLuna({ user: "Résume ce dossier." });
    await submitBatch([{ customId: "a", input: { user: "x" } }]);
    await lunaEmbed(["durée de conservation"]);
    const urls = reseau.mock.calls.map((c) => String((c as unknown[])[0]));
    // « chat/completions » sans son préfixe de version : ce banc ne NOMME pas la porte d'un fournisseur
    // (`models/passerelle-unique.test.ts` refuse ce nom hors de la passerelle) — il lit l'adresse qui est partie.
    expect(urls.some((u) => u.endsWith("/chat/completions"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/v1/files"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/v1/embeddings"))).toBe(true);
    expect(lectures).toBe(3);
  });

  it("la transcription envoie l'enregistrement au moteur", async () => {
    const moteur = vi.fn(reseau);
    await transcrireAvecSegments(enregistrement, "reunion.mp3", { fetchImpl: moteur as unknown as typeof fetch, env: { OPENAI_API_KEY: "cle-de-banc" } });
    expect(moteur).toHaveBeenCalled();
    expect(lectures).toBe(1);
  });
});

/**
 * LE CLIQUET, DANS LE CODE : une fonction ajoutée demain au client Luna qui ENVOIE quelque chose au
 * fournisseur doit lire l'interrupteur avant son premier `fetch`. Deux lectures restent ouvertes, nommées
 * avec leur raison : l'état d'un lot déjà déposé et sa sortie — rien n'y part, et les couper ferait
 * perdre un travail déjà payé.
 */
describe("le cliquet : chaque envoi du client Luna lit l'interrupteur avant son premier appel réseau", () => {
  const OUVERTES = new Set(["getBatchStatus", "fetchBatchOutput"]);
  const src = readFileSync(join(process.cwd(), "src/lib/openai-luna.ts"), "utf8");
  const fonctions = [...src.matchAll(/export async function (\w+)[\s\S]*?\n}\n/g)].map((m) => ({ nom: m[1], corps: m[0] }));
  const envoyeurs = fonctions.filter((f) => f.corps.includes("fetch("));

  it("la prémisse : les envois du client sont lus (au moins callLuna, submitBatch, lunaEmbed)", () => {
    expect(envoyeurs.map((f) => f.nom)).toEqual(expect.arrayContaining(["callLuna", "submitBatch", "lunaEmbed"]));
  });

  it("aucun envoi sans l'interrupteur AVANT son premier fetch — hors des deux lectures nommées", () => {
    const fautifs = envoyeurs
      .filter((f) => !OUVERTES.has(f.nom))
      .filter((f) => {
        const garde = f.corps.indexOf("interrupteurIaCoupe()");
        return garde === -1 || garde > f.corps.indexOf("fetch(");
      })
      .map((f) => f.nom);
    expect(fautifs).toEqual([]);
  });

  it("la transcription lit l'interrupteur avant d'appeler le moteur", () => {
    const stt = readFileSync(join(process.cwd(), "src/lib/media/stt.ts"), "utf8");
    const corps = stt.slice(stt.indexOf("export async function transcrireAvecSegments"));
    expect(corps.indexOf("interrupteurIaCoupe()")).toBeGreaterThan(-1);
    expect(corps.indexOf("interrupteurIaCoupe()")).toBeLessThan(corps.indexOf("const f = opts.fetchImpl"));
  });
});
