import { describe, expect, it } from "vitest";
import { TAILLE_MAX_STT, estMedia, estVideo, transcrireAvecSegments } from "./stt";

/**
 * LE CLIENT DE RECONNAISSANCE (§38) — le contrat tenu sans réseau : le formulaire envoyé, les
 * segments relus, la taille bornée, la clé absente dite, le débit réessayé.
 */
const reponse = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { "content-type": "application/json" } });

describe("transcrireAvecSegments", () => {
  it("reconnaît les formats médias ; sans clé, dit que c'est non configuré ; au-delà de 25 Mo, dit la limite de ressource", async () => {
    expect(estMedia("reunion.m4a")).toBe(true); expect(estVideo("demo.mp4")).toBe(true); expect(estMedia("contrat.pdf")).toBe(false);
    const sansCle = await transcrireAvecSegments(Buffer.from("x"), "a.mp3", { env: {} });
    expect(sansCle).toMatchObject({ ok: false, configured: false });
    const gros = await transcrireAvecSegments(Buffer.alloc(TAILLE_MAX_STT + 1), "a.mp3", { env: { OPENAI_API_KEY: "k" }, fetchImpl: async () => reponse({}) });
    expect(gros).toMatchObject({ ok: false, limite: "RESSOURCE" });
    expect(await transcrireAvecSegments(Buffer.from("x"), "a.xyz", { env: { OPENAI_API_KEY: "k" } })).toMatchObject({ ok: false, configured: true });
  });

  it("envoie verbose_json + segments, la langue et l'indice ; relit les segments horodatés, la langue et la durée", async () => {
    const appels: { url: string; champs: Record<string, string>; fichier: { nom: string; type: string } | null }[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      const form = init?.body as FormData;
      const champs: Record<string, string> = {}; let fichier: { nom: string; type: string } | null = null;
      form.forEach((v, k) => { if (v instanceof Blob) fichier = { nom: (v as File).name, type: v.type }; else champs[k] = String(v); });
      appels.push({ url: String(url), champs, fichier });
      return reponse({ text: "Bonjour. Passons au budget.", language: "french", duration: 12.4, segments: [{ id: 0, start: 0, end: 2.5, text: " Bonjour." }, { id: 1, start: 2.5, end: 12.4, text: " Passons au budget." }] });
    };
    const r = await transcrireAvecSegments(Buffer.from("audio"), "reunion.m4a", { env: { OPENAI_API_KEY: "k", OPENAI_BASE_URL: "https://ia.test/v1/" }, fetchImpl, indice: "Yassine, Raihana, Trastuzex" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.segments).toEqual([{ debut: 0, fin: 2.5, texte: "Bonjour.", locuteur: null }, { debut: 2.5, fin: 12.4, texte: "Passons au budget.", locuteur: null }]);
    expect(r).toMatchObject({ langue: "french", dureeS: 12, modele: "whisper-1", horodate: true });
    expect(appels[0]!.url).toBe("https://ia.test/v1/audio/transcriptions");
    expect(appels[0]!.champs).toMatchObject({ model: "whisper-1", language: "fr", response_format: "verbose_json", "timestamp_granularities[]": "segment", prompt: "Yassine, Raihana, Trastuzex" });
    expect(appels[0]!.fichier).toEqual({ nom: "reunion.m4a", type: "audio/mp4" });
  });

  it("un modèle sans segments rend un seul segment et le DIT (horodate: false) ; un 429 transitoire est réessayé ; un quota épuisé est une limite de ressource", async () => {
    let n = 0;
    const fetchImpl: typeof fetch = async () => { n += 1; return n === 1 ? new Response("rate limited", { status: 429 }) : reponse({ text: "Texte plat.", duration: 30 }); };
    const r = await transcrireAvecSegments(Buffer.from("a"), "note.mp3", { env: { OPENAI_API_KEY: "k", STT_MODEL: "gpt-4o-transcribe" }, fetchImpl });
    expect(n).toBe(2);
    expect(r).toMatchObject({ ok: true, horodate: false, modele: "gpt-4o-transcribe" });
    if (r.ok) expect(r.segments).toEqual([{ debut: 0, fin: 30, texte: "Texte plat.", locuteur: null }]);
    const quota = await transcrireAvecSegments(Buffer.from("a"), "note.mp3", { env: { OPENAI_API_KEY: "k" }, fetchImpl: async () => new Response("insufficient_quota", { status: 429 }) });
    expect(quota).toMatchObject({ ok: false, limite: "RESSOURCE" });
    const refus = await transcrireAvecSegments(Buffer.from("a"), "note.mp3", { env: { OPENAI_API_KEY: "k" }, fetchImpl: async () => new Response("bad", { status: 400 }) });
    expect(refus).toMatchObject({ ok: false, configured: true });
  });
});
