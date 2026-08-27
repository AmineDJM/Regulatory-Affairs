import { describe, expect, it } from "vitest";
import { fanOut, batchStreams, summarizeFanOut, DEFAULT_CONCURRENCY, type Workstream } from "./workstreams";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES CHANTIERS PARALLÈLES — l'ORCHESTRATION, pas les modèles.
 *
 * Ces tests tournent SANS clé d'API : chaque chantier échoue donc à l'appel, ce qui est
 * exactement le terrain qui compte. Ce qu'on éprouve n'est pas « le modèle répond bien » — cela
 * ne se teste pas hors ligne — mais les propriétés du FRONT, qui doivent tenir précisément quand
 * les choses se passent mal :
 *
 *   • un chantier qui tombe n'annule pas les autres ;
 *   • l'ordre des résultats suit l'ordre des chantiers, jamais l'ordre d'arrivée ;
 *   • un résultat partiel est ANNONCÉ comme partiel, jamais présenté comme complet ;
 *   • un échec porte un motif, jamais un silence.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const stream = (id: string): Workstream => ({ id, prompt: `travail ${id}` });

describe("le front", () => {
  it("lance TOUS les chantiers, même quand ils échouent tous", async () => {
    const r = await fanOut([stream("a"), stream("b"), stream("c")], { timeoutMs: 5_000 });
    expect(r.results).toHaveLength(3);
    // Aucun n'est resté à l'état non lancé : un chantier oublié est pire qu'un chantier échoué,
    // parce qu'il ne laisse aucune trace de son absence.
    expect(r.results.every((x) => x !== undefined)).toBe(true);
  });

  it("garde l'ORDRE DES CHANTIERS, pas l'ordre d'arrivée", async () => {
    // Sans cela, deux exécutions de la même mission rendraient deux rapports dans un ordre
    // différent, et personne ne pourrait les comparer.
    const ids = ["premier", "deuxieme", "troisieme", "quatrieme"];
    const r = await fanOut(ids.map(stream), { timeoutMs: 5_000 });
    expect(r.results.map((x) => x.id)).toEqual(ids);
  });

  it("nomme le motif de chaque échec — jamais un silence", async () => {
    const r = await fanOut([stream("a")], { timeoutMs: 5_000 });
    expect(r.results[0].ok).toBe(false);
    expect(r.results[0].error).toBeTruthy();
  });

  it("annonce un résultat PARTIEL comme partiel", async () => {
    const r = await fanOut([stream("a"), stream("b")], { timeoutMs: 5_000 });
    expect(r.complete).toBe(false);
    const text = summarizeFanOut(r);
    // L'orchestrateur doit LIRE que des pièces manquent, sinon il conclut sur des données
    // incomplètes en croyant les avoir toutes.
    expect(text).toContain("PARTIEL");
    expect(text).toContain("ÉCHEC");
  });

  it("un front vide n'est pas « complet » — il n'a rien fait", async () => {
    const r = await fanOut([]);
    expect(r.complete).toBe(false);
    expect(r.results).toHaveLength(0);
  });

  it("mesure la durée du FRONT, pas la somme des chantiers", async () => {
    const r = await fanOut([stream("a"), stream("b"), stream("c")], { timeoutMs: 5_000 });
    const sum = r.results.reduce((n, x) => n + x.ms, 0);
    // C'est ce que l'utilisateur ressent. Rapporter la somme ferait passer une parallélisation
    // réussie pour une lenteur.
    expect(r.ms).toBeLessThanOrEqual(sum + 50);
  });

  it("prévient à chaque copie rendue, et un appelant qui lève ne casse rien", async () => {
    const seen: string[] = [];
    const r = await fanOut([stream("a"), stream("b")], {
      timeoutMs: 5_000,
      onResult: (x) => { seen.push(x.id); throw new Error("l'affichage a planté"); },
    });
    expect(seen).toHaveLength(2);
    expect(r.results).toHaveLength(2);
  });

  it("respecte le délai maximal d'un chantier", async () => {
    const t0 = Date.now();
    await fanOut([stream("lent")], { timeoutMs: 60 });
    // La borne est là pour que les autres n'attendent pas indéfiniment ; on vérifie surtout
    // qu'elle n'ajoute pas d'attente quand l'appel échoue plus vite qu'elle.
    expect(Date.now() - t0).toBeLessThan(5_000);
  });

  it("la concurrence par défaut reste raisonnable", async () => {
    // Trop haute, on se fait limiter par le fournisseur et la « parallélisation » coûte des
    // réessais ; trop basse, on n'a rien parallélisé.
    expect(DEFAULT_CONCURRENCY).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_CONCURRENCY).toBeLessThanOrEqual(8);
  });
});

describe("découpage d'un lot", () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  it("répartit tout, sans perdre ni dupliquer un élément", () => {
    const streams = batchStreams(items, { batchSize: 10, prompt: (b) => b.join(",") });
    expect(streams).toHaveLength(3);
    const covered = streams.map((s) => s.prompt).join(",").split(",").map(Number);
    expect(covered).toEqual(items);
  });

  it("part sur `bulk` par défaut — la répétition n'est pas de la complexité", () => {
    // « Résume ces 40 dossiers » est la même sous-tâche répétée : Luna-none suffit, et
    // l'orchestrateur n'a rien à y faire.
    const [s] = batchStreams(items, { prompt: (b) => b.join(",") });
    expect(s.role).toBe("bulk");
  });

  it("chaque chantier sait quelle tranche il porte", () => {
    const streams = batchStreams(items, { batchSize: 10, prompt: (b) => b.join(",") });
    expect(streams[0].meta).toEqual({ from: 0, to: 9 });
    expect(streams[2].meta).toEqual({ from: 20, to: 24 });
  });

  it("une taille de lot absurde ne casse rien", () => {
    expect(batchStreams(items, { batchSize: 0, prompt: (b) => b.join(",") })).toHaveLength(25);
  });

  it("un lot vide ne produit aucun chantier", () => {
    expect(batchStreams([], { prompt: () => "x" })).toHaveLength(0);
  });
});
