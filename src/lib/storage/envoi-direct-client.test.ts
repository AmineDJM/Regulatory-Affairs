import { describe, it, expect } from "vitest";
import {
  envoyerParties, EnvoiAnnule, AdresseExpiree, Debitmetre, resteLisible, debitLisible,
  type PlanClient, type Progres,
} from "./envoi-direct-client";

/**
 * ENVOI DIRECT, CÔTÉ NAVIGATEUR — sur un envoi simulé (aucun réseau).
 *
 *   • seules les parties du plan partent (celles que le bucket a déjà ne repartent pas) ;
 *   • une partie qui échoue se retente ; une adresse expirée fait demander un plan neuf ;
 *   • la progression ne recule jamais ; « Annuler » coupe et lève `EnvoiAnnule`.
 */

const fichier = (n: number) => new Blob([new Uint8Array(n)]);
const plan = (nb: number, taille: number, recues: number[] = []): PlanClient => {
  const urls: Record<number, string> = {};
  for (let i = 1; i <= nb; i++) if (!recues.includes(i)) urls[i] = `u${i}`;
  return { taillePartie: taille, nbParties: nb, recues, urls, enParallele: 3 };
};

describe("envoyerParties", () => {
  it("n'envoie QUE les parties manquantes, avec la bonne tranche du fichier", async () => {
    const envoyees: { url: string; taille: number }[] = [];
    await envoyerParties({
      fichier: fichier(25), plan: plan(3, 10, [2]), signal: new AbortController().signal, onProgres: () => {},
      putPartie: async (url, corps, onCharge) => { onCharge(corps.size); envoyees.push({ url, taille: corps.size }); },
    });
    expect(envoyees.sort((a, b) => a.url.localeCompare(b.url))).toEqual([{ url: "u1", taille: 10 }, { url: "u3", taille: 5 }]);
  });

  it("rend les EMPREINTES reçues pour chaque partie, cumulées avec celles d'un envoi précédent", async () => {
    const etags = await envoyerParties({
      fichier: fichier(25), plan: plan(3, 10, [2]), signal: new AbortController().signal, onProgres: () => {},
      etags: { 2: '"deja"' },
      putPartie: async (url, corps, onCharge) => { onCharge(corps.size); return `"${url}"`; },
    });
    expect(etags).toEqual({ 1: '"u1"', 2: '"deja"', 3: '"u3"' });
  });

  it("retente une partie en échec, et la barre ne recule JAMAIS", async () => {
    let echecs = 0;
    const vus: Progres[] = [];
    await envoyerParties({
      fichier: fichier(20), plan: plan(2, 10), signal: new AbortController().signal, onProgres: (p) => vus.push(p),
      putPartie: async (url, corps, onCharge) => {
        onCharge(corps.size / 2);
        if (url === "u1" && echecs++ === 0) throw new Error("réseau");
        onCharge(corps.size);
      },
    });
    expect(echecs).toBe(2); // un échec, puis un succès
    const suite = vus.map((v) => v.envoyes);
    expect(suite).toEqual([...suite].sort((a, b) => a - b));
    expect(suite[suite.length - 1]).toBe(20);
  }, 10_000);

  it("une adresse EXPIRÉE fait demander un plan neuf, sans échouer", async () => {
    let renouvele = 0;
    const urls: string[] = [];
    await envoyerParties({
      fichier: fichier(10), plan: plan(1, 10), signal: new AbortController().signal, onProgres: () => {},
      renouveler: async () => { renouvele++; return { ...plan(1, 10), urls: { 1: "u1-neuve" } }; },
      putPartie: async (url) => { urls.push(url); if (url === "u1") throw new AdresseExpiree(1); },
    });
    expect(renouvele).toBe(1);
    expect(urls).toEqual(["u1", "u1-neuve"]);
  });

  it("« Annuler » coupe les envois en vol et lève EnvoiAnnule", async () => {
    const ctrl = new AbortController();
    const p = envoyerParties({
      fichier: fichier(30), plan: plan(3, 10), signal: ctrl.signal, onProgres: () => {},
      putPartie: (_u, _c, _o, signal) => new Promise((_r, rej) => signal.addEventListener("abort", () => rej(new EnvoiAnnule()))),
    });
    setTimeout(() => ctrl.abort(), 10);
    await expect(p).rejects.toBeInstanceOf(EnvoiAnnule);
  });

  it("une erreur définitive est rendue, nommant la partie", async () => {
    await expect(envoyerParties({
      fichier: fichier(10), plan: plan(1, 10), signal: new AbortController().signal, onProgres: () => {},
      putPartie: async () => { throw new Error("le stockage a répondu 500"); },
    })).rejects.toThrow(/Partie 1\/1 : le stockage a répondu 500/);
  }, 40_000);
});

describe("débit et temps restant", () => {
  it("mesure sur une fenêtre glissante, pas depuis le début", () => {
    const m = new Debitmetre(8000);
    m.noter(0, 0);
    m.noter(1000, 10 * 1024 * 1024); // 10 Mo/s au début
    m.noter(20_000, 10 * 1024 * 1024 + 1024 * 1024); // puis la liaison chute
    m.noter(21_000, 10 * 1024 * 1024 + 2 * 1024 * 1024);
    expect(m.debit()).toBeLessThan(2 * 1024 * 1024);
  });
  it("dit le temps restant et le débit en français", () => {
    expect(resteLisible(null)).toBe("estimation…");
    expect(resteLisible(150)).toBe("~2 min 30 s restantes");
    expect(resteLisible(3 * 3600 + 600)).toBe("~3 h 10 min restantes");
    expect(debitLisible(12.4 * 1024 * 1024)).toBe("12,4 Mo/s");
  });
});
