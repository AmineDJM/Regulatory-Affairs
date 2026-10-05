import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'INTERRUPTEUR GÉNÉRAL DE L'IA, ÉPROUVÉ PAR LES VRAIES PORTES DE `lib/ai.ts` (audit 360°, F3).
 *
 * L'écran « Contrôle de l'IA » promet, interrupteur coupé : « Toute l'IA est coupée, quelles que
 * soient les bascules ci-dessous ». `lib/ai.ts` ne le lisait pas : l'analyse d'un AO PCH ou d'un
 * contrat RH partait chez le fournisseur sous un interrupteur coupé. Ce banc l'exige dans les DEUX
 * sens — coupé, la passerelle n'est JAMAIS appelée ; rallumé, tout passe comme avant (sans la
 * seconde moitié, une porte qui refuserait tout passerait pour juste, §118.17).
 *
 * ── CE QUE CE BANC NE FAIT JAMAIS : TOUCHER À LA LIGNE `AiSetting` ─────────────────────────
 *
 * Elle est GLOBALE, partagée par toute la suite qui tourne en parallèle : la couper le temps d'un
 * cas couperait l'IA des bancs voisins (§118.132). Les cas de porte INJECTENT le lecteur ; les cas
 * du VRAI lecteur lisent un client de base simulé (`@/lib/prisma` remplacé ci-dessous) — la ligne
 * réelle n'est ni lue ni écrite. Et la passerelle est remplacée : aucun appel réseau ne part.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const passerelle = vi.hoisted(() => ({
  askModel: vi.fn(),
  callModel: vi.fn(),
  streamModel: vi.fn(),
}));
vi.mock("@/lib/models/gateway", () => ({
  askModel: passerelle.askModel,
  callModel: passerelle.callModel,
  streamModel: passerelle.streamModel,
}));

// La clé du fournisseur n'existe pas dans ce conteneur : sans ce remplacement, « rallumé » rendrait
// « clé non configurée » et ne prouverait rien sur le passage par la passerelle. Le fait reste
// pilotable : un cas éprouve « coupé ET sans clé ».
const registre = vi.hoisted(() => ({ cle: true }));
vi.mock("@/lib/models/registry", async (orig) => ({
  ...(await orig<typeof import("@/lib/models/registry")>()),
  roleConfigured: () => registre.cle,
}));

const base = vi.hoisted(() => ({ aiSetting: { findUnique: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: base }));

import { askClaude, askClaudeCheap, callClaude, callClaudeStream, transcribeAudio, type ClaudeMessage } from "@/lib/ai";
import { REFUS_IA_COUPEE, iaCoupeeGlobalement, remplacerLecteurInterrupteurIaPourTests } from "@/lib/ai-settings";

const REFUS = { ok: false, configured: true, error: REFUS_IA_COUPEE };
const MESSAGES: ClaudeMessage[] = [{ role: "user", content: "Extrais les lignes de cet appel d'offres." }];

/** Une ligne `AiSetting` complète, telle que `getAiSettings` la lit — toutes bascules actives. */
function ligne(masterEnabled: boolean) {
  return {
    id: "global", masterEnabled, assistantEnabled: true, proactiveNudgesEnabled: true, brainEnabled: true,
    processIntelEnabled: true, fieldReportAiEnabled: true, voiceTranscriptEnabled: true, siteWebAiEnabled: true,
  };
}

beforeEach(() => {
  passerelle.askModel.mockReset().mockResolvedValue({
    text: " Réponse du banc. ",
    reply: { ok: true, configured: true, stop: "end", blocks: [] },
  });
  passerelle.callModel.mockReset().mockResolvedValue({
    ok: true, configured: true, stop: "end", blocks: [{ type: "text", text: "Réponse avec outils." }],
  });
  passerelle.streamModel.mockReset().mockImplementation(
    async (_role: string, _turns: unknown, _opts: unknown, onText: (c: string) => void) => {
      onText("fragment");
      return { ok: true, configured: true, stop: "end", blocks: [{ type: "text", text: "fragment" }] };
    },
  );
  base.aiSetting.findUnique.mockReset();
  registre.cle = true;
});

afterEach(() => {
  remplacerLecteurInterrupteurIaPourTests(null);
});

describe("lib/ai.ts lit l'interrupteur général AVANT tout appel", () => {
  it("la phrase du refus est celle que l'écran et l'audit attendent — nommée une fois", () => {
    expect(REFUS_IA_COUPEE).toBe(
      "L'IA est coupée par l'interrupteur général (Administration › Contrôle de l'IA) : aucun appel n'est parti.",
    );
  });

  it("coupé : askClaude et askClaudeCheap rendent le refus, et la passerelle n'est JAMAIS appelée", async () => {
    remplacerLecteurInterrupteurIaPourTests(async () => true);
    expect(await askClaude("Analyse ce contrat de travail.")).toEqual(REFUS);
    expect(await askClaudeCheap("Résume cette réunion.", { maxTokens: 200 })).toEqual(REFUS);
    expect(passerelle.askModel).not.toHaveBeenCalled();
  });

  it("coupé ET sans clé : la réponse vraie est « coupé », pas « posez la clé » — l'interrupteur se lit AVANT la clé", async () => {
    registre.cle = false;
    remplacerLecteurInterrupteurIaPourTests(async () => true);
    expect(await askClaude("Analyse ce contrat de travail.")).toEqual(REFUS);
    // Rallumé sans clé, la personne apprend ENSUITE ce qui manque encore — l'ordre inverse lui
    // ferait poser une variable d'environnement pour une IA que l'administrateur a coupée.
    remplacerLecteurInterrupteurIaPourTests(async () => false);
    const sansCle = await askClaude("Analyse ce contrat de travail.");
    expect(sansCle.configured).toBe(false);
    expect(sansCle.error).toMatch(/non configurée/);
    expect(passerelle.askModel).not.toHaveBeenCalled();
  });

  it("rallumé : les deux paliers passent par la passerelle comme avant, et l'interrupteur a bien été LU", async () => {
    const lecteur = vi.fn(async () => false);
    remplacerLecteurInterrupteurIaPourTests(lecteur);
    expect(await askClaude("Analyse ce contrat de travail.")).toEqual({ ok: true, configured: true, text: "Réponse du banc." });
    expect(await askClaudeCheap("Résume cette réunion.")).toEqual({ ok: true, configured: true, text: "Réponse du banc." });
    expect(passerelle.askModel.mock.calls.map((c) => c[0])).toEqual(["worker", "bulk"]);
    // Sans cette ligne, une porte qui ne consulterait plus RIEN passerait ce cas au vert.
    expect(lecteur).toHaveBeenCalledTimes(2);
  });

  it("coupé : callClaude et callClaudeStream ne partent pas, et aucun fragment ne s'écrit à l'écran", async () => {
    remplacerLecteurInterrupteurIaPourTests(async () => true);
    expect(await callClaude(MESSAGES, { maxTokens: 300 })).toEqual(REFUS);
    const fragments: string[] = [];
    expect(await callClaudeStream(MESSAGES, (c) => fragments.push(c))).toEqual(REFUS);
    expect(fragments).toEqual([]);
    expect(passerelle.callModel).not.toHaveBeenCalled();
    expect(passerelle.streamModel).not.toHaveBeenCalled();
  });

  it("rallumé : callClaude et callClaudeStream passent par la passerelle, au palier qualité", async () => {
    remplacerLecteurInterrupteurIaPourTests(async () => false);
    const r = await callClaude(MESSAGES);
    expect(r.ok).toBe(true);
    expect(r.content).toEqual([{ type: "text", text: "Réponse avec outils." }]);
    const fragments: string[] = [];
    const flux = await callClaudeStream(MESSAGES, (c) => fragments.push(c));
    expect(flux.ok).toBe(true);
    expect(fragments).toEqual(["fragment"]);
    expect(passerelle.callModel.mock.calls.map((c) => c[0])).toEqual(["worker"]);
    expect(passerelle.streamModel.mock.calls.map((c) => c[0])).toEqual(["worker"]);
  });

  it("coupé : transcribeAudio n'envoie rien à Whisper ; rallumé, l'enregistrement part comme avant", async () => {
    const cleAvant = process.env.OPENAI_API_KEY;
    const fetchAvant = global.fetch;
    const fetchBanc = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ text: " bonjour " }), text: async () => "" }));
    process.env.OPENAI_API_KEY = "cle-du-banc";
    global.fetch = fetchBanc as unknown as typeof fetch;
    try {
      remplacerLecteurInterrupteurIaPourTests(async () => true);
      expect(await transcribeAudio(Buffer.from("audio"), "note.webm", "audio/webm")).toEqual(REFUS);
      expect(fetchBanc).not.toHaveBeenCalled();

      remplacerLecteurInterrupteurIaPourTests(async () => false);
      expect(await transcribeAudio(Buffer.from("audio"), "note.webm", "audio/webm")).toEqual({ ok: true, configured: true, text: "bonjour" });
      expect(fetchBanc).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = fetchAvant;
      if (cleAvant === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = cleAvant;
    }
  });
});

describe("le VRAI lecteur — la ligne enregistrée, sans jamais l'écrire", () => {
  it("coupé seulement quand la ligne dit masterEnabled = false ; sans ligne ou base injoignable, l'IA reste active", async () => {
    base.aiSetting.findUnique.mockResolvedValueOnce(null);
    expect(await iaCoupeeGlobalement()).toBe(false);
    base.aiSetting.findUnique.mockResolvedValueOnce(ligne(true));
    expect(await iaCoupeeGlobalement()).toBe(false);
    // Une bascule de FONCTION coupée ne coupe pas tout : seul l'interrupteur général le fait.
    base.aiSetting.findUnique.mockResolvedValueOnce({ ...ligne(true), assistantEnabled: false, brainEnabled: false });
    expect(await iaCoupeeGlobalement()).toBe(false);
    base.aiSetting.findUnique.mockResolvedValueOnce(ligne(false));
    expect(await iaCoupeeGlobalement()).toBe(true);
    // La sémantique d'`aiFeatureEnabled` depuis toujours : une base qui ne répond pas ne coupe rien.
    base.aiSetting.findUnique.mockRejectedValueOnce(new Error("base injoignable"));
    expect(await iaCoupeeGlobalement()).toBe(false);
  });

  it("le lecteur par DÉFAUT est le vrai : une ligne coupée arrête askClaude sans aucune injection", async () => {
    // Des modules NEUFS : les cas précédents ont remplacé puis remis le lecteur, et un défaut qui
    // ne tiendrait qu'à la valeur INITIALE de la liaison (ou à un appel de production au
    // remplaçant, posé au chargement) serait masqué par cette remise. Ici, personne n'y a touché.
    vi.resetModules();
    const ai = await import("@/lib/ai");
    const reglages = await import("@/lib/ai-settings");

    base.aiSetting.findUnique.mockResolvedValue(ligne(false));
    expect(await reglages.interrupteurIaCoupe()).toBe(true);
    expect(await ai.askClaude("Analyse ce contrat de travail.")).toEqual({ ok: false, configured: true, error: reglages.REFUS_IA_COUPEE });
    expect(passerelle.askModel).not.toHaveBeenCalled();

    base.aiSetting.findUnique.mockResolvedValue(ligne(true));
    expect((await ai.askClaude("Analyse ce contrat de travail.")).ok).toBe(true);
    expect(passerelle.askModel).toHaveBeenCalledTimes(1);
    // On lit la ligne `global`, et rien d'autre n'est demandé au client de base.
    expect(base.aiSetting.findUnique.mock.calls.every((c) => c[0]?.where?.id === "global")).toBe(true);
  });
});

/**
 * ── LES CLIQUETS : ce qu'un comportement vérifié aujourd'hui ne garantit pas demain ──────────
 */

const NOM_DU_REMPLACANT = "remplacerLecteurInterrupteurIaPourTests";

/** Le CODE seul : un commentaire qui cite le nom ne l'appelle pas (§118.79d — le piège de la prose). */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Combien de fois ce source nomme le remplaçant HORS de sa propre définition. */
function usagesDuRemplacant(src: string, estLeModuleDesReglages: boolean): number {
  let code = sansCommentaires(src);
  if (estLeModuleDesReglages) code = code.replace(new RegExp(`export\\s+function\\s+${NOM_DU_REMPLACANT}\\b`), "");
  return (code.match(new RegExp(`\\b${NOM_DU_REMPLACANT}\\b`, "g")) ?? []).length;
}

function fichiersDeProduction(racine: string): string[] {
  const out: string[] = [];
  if (!existsSync(racine)) return out;
  const marcher = (d: string) => {
    for (const e of readdirSync(d)) {
      if (e === "node_modules" || e === ".next") continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) marcher(p);
      else if (/\.(tsx?|mjs|cjs|js)$/.test(e) && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(e)) out.push(p);
    }
  };
  marcher(racine);
  return out;
}

/**
 * Les fonctions de `lib/ai.ts` qui parlent à un fournisseur SANS avoir lu l'interrupteur avant.
 * La sonde de santé est la seule exception, et elle est NOMMÉE (son commentaire dit pourquoi).
 */
const EXCEPTIONS_NOMMEES = new Set(["aiSelfTest"]);
const APPEL_FOURNISSEUR = /\b(askModel|appelPasserelle|fluxPasserelle|fetch)\s*\(/;

function portesSansInterrupteur(src: string): string[] {
  const code = sansCommentaires(src);
  const debuts = [...code.matchAll(/(?:^|\n)\s*(?:export\s+)?async\s+function\s+(\w+)\s*\(/g)];
  const fautes: string[] = [];
  debuts.forEach((m, i) => {
    const nom = m[1];
    const corps = code.slice(m.index ?? 0, i + 1 < debuts.length ? debuts[i + 1].index : code.length);
    const appel = corps.search(APPEL_FOURNISSEUR);
    if (appel < 0 || EXCEPTIONS_NOMMEES.has(nom)) return;
    const garde = corps.indexOf("interrupteurIaCoupe()");
    if (garde < 0 || garde > appel) fautes.push(nom);
  });
  return fautes;
}

describe("cliquets de l'interrupteur général", () => {
  it("aucun fichier de PRODUCTION n'appelle le remplaçant du lecteur — sinon l'interrupteur serait désarmé en ayant l'air armé", () => {
    const tous = [...fichiersDeProduction("src"), ...fichiersDeProduction("scripts")];
    // Plancher : un parcours cassé ne lirait rien et rendrait ce cliquet vert sans rien garder (§118.17).
    expect(tous.length).toBeGreaterThan(1500);
    const fautifs = tous.filter((f) => {
      const estLeModule = f.split("\\").join("/") === "src/lib/ai-settings.ts";
      return usagesDuRemplacant(readFileSync(f, "utf8"), estLeModule) > 0;
    });
    expect(fautifs, `ces fichiers de production appellent ${NOM_DU_REMPLACANT}`).toEqual([]);
  });

  it("témoins du détecteur : il voit un appel, ignore un commentaire, et tolère la seule définition", () => {
    const appel = `import { ${NOM_DU_REMPLACANT} } from "@/lib/ai-settings";\n${NOM_DU_REMPLACANT}(async () => false);\n`;
    expect(usagesDuRemplacant(appel, false)).toBeGreaterThan(0);
    expect(usagesDuRemplacant(`// ${NOM_DU_REMPLACANT}(async () => false)\n/* ${NOM_DU_REMPLACANT} */\n`, false)).toBe(0);
    expect(usagesDuRemplacant(readFileSync("src/lib/ai-settings.ts", "utf8"), true)).toBe(0);
    // La définition n'est tolérée QUE dans le module des réglages.
    expect(usagesDuRemplacant(`export function ${NOM_DU_REMPLACANT}() {}\n`, false)).toBe(1);
  });

  it("dans lib/ai.ts, chaque fonction qui parle à un fournisseur lit l'interrupteur AVANT — la seule exception est nommée", () => {
    const src = readFileSync("src/lib/ai.ts", "utf8");
    expect(portesSansInterrupteur(src), "porte vers un fournisseur ouverte sans lire l'interrupteur général").toEqual([]);
    // La prémisse : le détecteur trouve bien les portes qu'il doit garder (sinon il ne garde rien).
    const code = sansCommentaires(src);
    for (const porte of ["demander", "callClaude", "callClaudeStream", "transcribeAudio"]) {
      expect(code, `la porte ${porte} a disparu de lib/ai.ts`).toMatch(new RegExp(`async\\s+function\\s+${porte}\\s*\\(`));
    }
  });

  it("témoins du détecteur de portes : appel sans garde, garde APRÈS l'appel, garde avant", () => {
    expect(portesSansInterrupteur(`export async function nouvelle() {\n  return askModel("bulk", "x");\n}\n`)).toEqual(["nouvelle"]);
    expect(portesSansInterrupteur(`async function tard() {\n  await fetch("u");\n  if (await interrupteurIaCoupe()) return;\n}\n`)).toEqual(["tard"]);
    expect(portesSansInterrupteur(`export async function bonne() {\n  if (await interrupteurIaCoupe()) return X;\n  return appelPasserelle(m, {});\n}\n`)).toEqual([]);
    expect(portesSansInterrupteur(`export async function aiSelfTest() {\n  return askModel("bulk", "ping");\n}\n`)).toEqual([]);
  });
});
