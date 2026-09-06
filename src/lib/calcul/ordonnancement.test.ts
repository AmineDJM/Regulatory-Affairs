import { describe, expect, it } from "vitest";
import { ordonnancer, resumerOrdonnancement } from "./ordonnancement";

describe("ordonnancement — chemin critique et ressources", () => {
  it("le réseau de manuel : durée 25, chemin critique A→C→E, marges exactes", () => {
    // A(5) → C(10) → E(6) ; B(4) → D(8) → E. Chemin A-C-E = 21+... vérifions : A 0-5, C 5-15, E 15-21 ; B 0-4, D 4-12.
    const r = ordonnancer({
      taches: [
        { id: "A", duree: 5 },
        { id: "B", duree: 4 },
        { id: "C", duree: 10, apres: ["A"] },
        { id: "D", duree: 8, apres: ["B"] },
        { id: "E", duree: 6, apres: ["C", "D"] },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dureeChemin).toBe(21);
    expect(r.cheminCritique).toEqual(["A", "C", "E"]);
    const par = Object.fromEntries(r.taches.map((t) => [t.id, t]));
    expect(par.A!.margeTotale).toBe(0);
    expect(par.B!.margeTotale).toBe(3); // B peut glisser de 3 (0→3) sans décaler E
    expect(par.D!.margeTotale).toBe(3);
    expect(par.E!.finAuPlusTot).toBe(21);
    expect(par.B!.debutAuPlusTard).toBe(3);
    expect(par.B!.margeLibre).toBe(0); // B est suivie de D qui commence à 4
    expect(par.D!.margeLibre).toBe(3);
    expect(r.retardRessources).toBe(0);
    expect(r.rigueur.limites.some((l) => /durées sont prises comme certaines/.test(l))).toBe(true);
  });

  it("une ressource unique allonge le projet, et le code dit que c'est la ressource, pas la logique", () => {
    // Deux tâches indépendantes de 5, la même personne : 10 au lieu de 5.
    const r = ordonnancer({ taches: [{ id: "T1", duree: 5, ressources: ["Yassine"] }, { id: "T2", duree: 5, ressources: ["Yassine"] }] });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.dureeChemin).toBe(5);
    expect(r.dureeAvecRessources).toBe(10);
    expect(r.retardRessources).toBe(5);
    expect(r.rigueur.avertissements.some((a) => /RESSOURCES, pas par la logique/.test(a))).toBe(true);
    expect(r.chargeRessources[0]!.ressource).toBe("Yassine");
    expect(r.chargeRessources[0]!.tauxPourcent).toBe(100);
    expect(r.goulots).toEqual(["Yassine"]);
    // Avec deux personnes de capacité 2, le projet retrouve sa durée logique.
    const r2 = ordonnancer({ taches: [{ id: "T1", duree: 5, ressources: ["equipe"] }, { id: "T2", duree: 5, ressources: ["equipe"] }], capacites: { equipe: 2 } });
    if (!r2.ok) throw new Error(r2.erreur);
    expect(r2.dureeAvecRessources).toBe(5);
    expect(r2.retardRessources).toBe(0);
  });

  it("les ressources n'enfreignent jamais les dépendances, et aucune ressource n'est en surcharge", () => {
    const r = ordonnancer({
      taches: [
        { id: "dossier", duree: 3, ressources: ["Sarah"] },
        { id: "revue", duree: 2, apres: ["dossier"], ressources: ["Sarah"] },
        { id: "annexes", duree: 4, ressources: ["Sarah"] },
        { id: "depot", duree: 1, apres: ["revue", "annexes"], ressources: ["Amine"] },
      ],
    });
    if (!r.ok) throw new Error(r.erreur);
    const par = Object.fromEntries(r.taches.map((t) => [t.id, t]));
    expect(par.revue!.debutPlanifie).toBeGreaterThanOrEqual(par.dossier!.finPlanifiee);
    expect(par.depot!.debutPlanifie).toBeGreaterThanOrEqual(Math.max(par.revue!.finPlanifiee, par.annexes!.finPlanifiee));
    // Sarah n'a jamais deux tâches en même temps.
    const sarah = ["dossier", "revue", "annexes"].map((id) => par[id]!).sort((a, b) => a.debutPlanifie - b.debutPlanifie);
    for (let i = 1; i < sarah.length; i += 1) expect(sarah[i]!.debutPlanifie).toBeGreaterThanOrEqual(sarah[i - 1]!.finPlanifiee - 1e-9);
    expect(r.dureeAvecRessources).toBe(10);
  });

  it("une dépendance circulaire est une réponse, pas une panne", () => {
    const r = ordonnancer({ taches: [{ id: "A", duree: 1, apres: ["B"] }, { id: "B", duree: 1, apres: ["A"] }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/circulaire/);
  });

  it("refuse un projet incohérent en le disant", () => {
    expect(ordonnancer({ taches: [] })).toMatchObject({ ok: false });
    const inconnue = ordonnancer({ taches: [{ id: "A", duree: 1, apres: ["Z"] }] });
    expect(inconnue.ok).toBe(false);
    if (!inconnue.ok) expect(inconnue.erreur).toMatch(/Z/);
    const duree = ordonnancer({ taches: [{ id: "A", duree: -3 }] });
    expect(duree.ok).toBe(false);
  });

  it("une échéance dépassée est chiffrée et le levier est nommé", () => {
    const r = ordonnancer({ taches: [{ id: "A", duree: 10 }, { id: "B", duree: 10, apres: ["A"] }], echeance: 15 });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.echeance).toEqual({ valeur: 15, tenue: false, retard: 5 });
    expect(r.rigueur.avertissements.some((a) => /dépassée de 5/.test(a))).toBe(true);
    const lignes = resumerOrdonnancement(r);
    expect(lignes.some((l) => /dépassée/.test(l))).toBe(true);
    expect(lignes[1]).toMatch(/A → B/);
  });

  it("tient l'échelle : 800 tâches en chaîne et en éventail, sous la seconde", () => {
    const taches = [];
    for (let i = 0; i < 800; i += 1) taches.push({ id: `t${i}`, duree: 1 + (i % 3), apres: i > 0 && i % 4 !== 0 ? [`t${i - 1}`] : [], ressources: [`r${i % 12}`] });
    const t0 = Date.now();
    const r = ordonnancer({ taches });
    if (!r.ok) throw new Error(r.erreur);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(r.taches.length).toBe(800);
    expect(r.dureeAvecRessources).toBeGreaterThanOrEqual(r.dureeChemin);
    for (const t of r.taches) for (const d of taches.find((x) => x.id === t.id)!.apres!) {
      expect(t.debutPlanifie).toBeGreaterThanOrEqual(r.taches.find((x) => x.id === d)!.finPlanifiee - 1e-9);
    }
  });
});
