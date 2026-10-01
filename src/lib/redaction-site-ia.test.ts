import { describe, expect, it } from "vitest";
import type { AiUsageInput } from "./ai-settings";
import { phraseIaNonConfiguree } from "./ia/cle-manquante";
import type { ModelReply } from "./models/contract";
import { disponibiliteRedaction, redigerArticle, redigerOffre, type DependancesRedaction } from "./redaction-site-ia";
import { refusConsigne, SCHEMA_ARTICLE, SCHEMA_OFFRE, type EntreeOffre } from "./site-web/redaction";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « RÉDIGER AVEC L'IA » — L'APPEL AU MODÈLE, dépendances injectées (§118.160, §118.132).
 *
 * La bascule du Centre de contrôle IA est une ligne GLOBALE : la poser pour de vrai dans un banc
 * ferait tomber les autres processus de la suite. Le cœur reçoit donc ses quatre gestes du monde
 * (bascule, configuration, appel, journal) ; un cliquet de `site-web-redaction-actions.test.ts`
 * exige que l'action, elle, n'injecte RIEN.
 *
 * Ce banc tient l'ORDRE (rien ne part chez le fournisseur tant qu'une porte de notre côté peut
 * refuser), le JOURNAL (un appel, un enregistrement, et un échec compté comme un échec) et la
 * PHRASE (chaque refus dit le geste qui le lève).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const ARTICLE = { title: "Sérialisation : ce qui change", description: "", body: "Intro.\n\n## Calendrier", category: "Secteur", tags: ["ANPP"] };
const OFFRE = {
  title: "Délégué médical", department: "", location: "Constantine", contractLabel: "CDI", experience: "",
  summary: "Deux phrases.", mission: ["Visiter les CHU"], profile: ["Pharmacien"], offer: ["Véhicule"],
};
const CONSIGNE = "Un article sur la sérialisation des médicaments en Algérie";

function reponse(over: Partial<ModelReply> = {}): ModelReply {
  return {
    ok: true, configured: true, stop: "end", blocks: [],
    usage: {
      role: "worker", model: "modele-du-banc", provider: "openai", inputTokens: 1200, outputTokens: 800,
      cachedInputTokens: 100, costUsd: 0.0123, ms: 900, attempts: 1, reasoningTokens: 0,
    },
    ...over,
  };
}

interface Banc {
  deps: DependancesRedaction;
  appels: { role: string; prompt: string; schema: { name: string }; opts: { system: string; maxOutputTokens: number } }[];
  journal: AiUsageInput[];
  lectures: { bascule: number };
}

function banc(o: {
  active?: boolean; configure?: boolean; cle?: string | null;
  data?: unknown; reply?: Partial<ModelReply>; jette?: Error;
} = {}): Banc {
  const appels: Banc["appels"] = [];
  const journal: AiUsageInput[] = [];
  const lectures = { bascule: 0 };
  const deps: DependancesRedaction = {
    fonctionActive: async () => { lectures.bascule += 1; return o.active ?? true; },
    configure: () => o.configure ?? true,
    cle: () => (o.cle === undefined ? "OPENAI_API_KEY" : o.cle),
    appeler: (async (role: string, prompt: string, schema: { name: string }, opts: { system: string; maxOutputTokens: number }) => {
      appels.push({ role, prompt, schema, opts });
      if (o.jette) throw o.jette;
      return { data: "data" in o ? o.data : ARTICLE, reply: reponse(o.reply) };
    }) as DependancesRedaction["appeler"],
    journaliser: async (u) => { journal.push(u); },
  };
  return { deps, appels, journal, lectures };
}

describe("La disponibilité — ce que l'écran annonce avant tout clic", () => {
  it("bascule coupée : indisponible, et la raison nomme l'écran qui la rallume", async () => {
    const b = banc({ active: false });
    expect(await disponibiliteRedaction(b.deps)).toEqual({
      disponible: false,
      raison: expect.stringContaining("Administration › Centre de contrôle IA"),
    });
  });

  it("fournisseur non configuré : la phrase canonique, avec le nom de la clé que le registre lit (§118.128)", async () => {
    const b = banc({ configure: false, cle: "OPENAI_API_KEY" });
    const d = await disponibiliteRedaction(b.deps);
    expect(d).toEqual({ disponible: false, raison: phraseIaNonConfiguree("OPENAI_API_KEY", "la rédaction par l'IA") });
    expect(d.raison).toContain("OPENAI_API_KEY");
  });

  it("tout est en place : disponible, sans raison", async () => {
    expect(await disponibiliteRedaction(banc().deps)).toEqual({ disponible: true, raison: null });
  });
});

describe("L'ORDRE : rien ne part chez le fournisseur tant qu'une porte de notre côté peut refuser", () => {
  it("une consigne inutilisable est refusée AVANT même de lire la bascule — aucun appel, aucun journal", async () => {
    const b = banc();
    const r = await redigerArticle("u-banc", { consigne: "court" }, b.deps);
    expect(r).toEqual({ ok: false, error: refusConsigne("court") });
    expect(b.lectures.bascule).toBe(0);
    expect(b.appels).toHaveLength(0);
    expect(b.journal).toHaveLength(0);
  });

  it("bascule coupée : refus, aucun appel — et rien au journal, puisque rien n'a été appelé", async () => {
    const b = banc({ active: false });
    const r = await redigerArticle("u-banc", { consigne: CONSIGNE }, b.deps);
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("Centre de contrôle IA") });
    expect(b.appels).toHaveLength(0);
    expect(b.journal).toHaveLength(0);
  });

  it("non configuré : la phrase qui nomme la clé, aucun appel", async () => {
    const b = banc({ configure: false, cle: "ANTHROPIC_API_KEY" });
    const r = await redigerOffre("u-banc", { consigne: CONSIGNE }, b.deps);
    expect(r).toEqual({ ok: false, error: phraseIaNonConfiguree("ANTHROPIC_API_KEY", "la rédaction par l'IA") });
    expect(b.appels).toHaveLength(0);
  });
});

describe("L'appel, la relecture et le journal", () => {
  it("un article : le rôle de travail, le schéma imposé, la consigne — puis UN enregistrement fidèle de l'usage", async () => {
    const b = banc();
    const r = await redigerArticle("u-banc", { consigne: CONSIGNE, titre: "Ancien titre" }, b.deps);
    expect(r).toEqual({ ok: true, champs: { ...ARTICLE, tags: "ANPP" }, avertissements: [] });
    expect(b.appels).toHaveLength(1);
    const a = b.appels[0]!;
    expect(a.role).toBe("worker");
    expect(a.schema).toBe(SCHEMA_ARTICLE);
    expect(a.prompt).toContain(CONSIGNE);
    expect(a.prompt).toContain("Ancien titre");
    expect(a.opts.system).toContain("ARTICLE DE BLOG");
    expect(a.opts.maxOutputTokens).toBe(6_000);
    expect(b.journal).toEqual([expect.objectContaining({
      feature: "site_web", userId: "u-banc", ok: true, errorCode: null, llmCalls: 1, provider: "openai", model: "modele-du-banc",
      inputTokens: 1200, outputTokens: 800, cachedInputTokens: 100, costUsd: 0.0123,
    })]);
  });

  it("une offre portant à l'exécution la rémunération et la justification : le modèle n'en reçoit RIEN", async () => {
    const e = {
      consigne: "Délégué médical oncologie pour Constantine", titre: "Délégué médical",
      salary: "SECRET-185000", justification: "SECRET-remplacement",
    } as EntreeOffre;
    const b = banc({ data: OFFRE });
    const r = await redigerOffre("u-banc", e, b.deps);
    expect(r.ok).toBe(true);
    const a = b.appels[0]!;
    expect(a.schema).toBe(SCHEMA_OFFRE);
    expect(`${a.opts.system}\n${a.prompt}`).not.toMatch(/SECRET-/);
  });

  it("une réponse sans données (JSON invalide) : refus lisible, journal en échec « invalid_json »", async () => {
    const b = banc({ data: null });
    const r = await redigerArticle("u-banc", { consigne: CONSIGNE }, b.deps);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/forme attendue/) });
    expect(b.journal).toEqual([expect.objectContaining({ ok: false, errorCode: "invalid_json" })]);
  });

  it("une réponse INCOMPLÈTE : refus — et le journal la compte comme un ÉCHEC de la fonction, pas comme un succès (§118.51)", async () => {
    const b = banc({ data: { ...ARTICLE, body: "  " } });
    const r = await redigerArticle("u-banc", { consigne: CONSIGNE }, b.deps);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/incomplète/) });
    expect(b.journal).toEqual([expect.objectContaining({ ok: false, errorCode: "relecture" })]);
  });

  it("le fournisseur dit « non configuré » au moment de l'appel : la phrase canonique, pas un refus vague", async () => {
    const b = banc({ reply: { ok: false, configured: false, error: "no_key" } });
    const r = await redigerArticle("u-banc", { consigne: CONSIGNE }, b.deps);
    expect(r).toEqual({ ok: false, error: phraseIaNonConfiguree("OPENAI_API_KEY", "la rédaction par l'IA") });
    expect(b.journal).toEqual([expect.objectContaining({ ok: false, errorCode: "no_key" })]);
  });

  it("le fournisseur refuse : rien n'est modifié, et la phrase propose de reformuler", async () => {
    const b = banc({ reply: { ok: false, configured: true, error: "refusal" } });
    const r = await redigerArticle("u-banc", { consigne: CONSIGNE }, b.deps);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/refusé la demande.*rien n'a été modifié/) });
    expect(b.journal).toEqual([expect.objectContaining({ ok: false, errorCode: "refusal" })]);
  });

  it("une exception : « n'a pas répondu », journal « exception » — au nom du fournisseur que la clé désigne", async () => {
    for (const [cle, fournisseur] of [["OPENAI_API_KEY", "openai"], ["ANTHROPIC_API_KEY", "anthropic"]] as const) {
      const b = banc({ jette: new Error("ECONNRESET"), cle });
      const r = await redigerArticle("u-banc", { consigne: CONSIGNE }, b.deps);
      expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/n'a pas répondu/) });
      expect(b.journal).toEqual([expect.objectContaining({ ok: false, errorCode: "exception", provider: fournisseur })]);
    }
  });
});
