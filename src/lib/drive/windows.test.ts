import { describe, it, expect } from "vitest";
import { cascade, clampToBounds, focus, toggleMaximize, tileRects, moveBy, resizeTo, topZ, MIN_W, MIN_H, type WinState, type Rect } from "./windows";

const BOUNDS = { w: 1400, h: 800 };
const win = (id: string, z: number, rect: Rect, over: Partial<WinState> = {}): WinState =>
  ({ id, z, rect, minimized: false, restore: null, ...over });

describe("Où s'ouvre une fenêtre", () => {
  it("la deuxième ne se cache pas derrière la première", () => {
    // Deux fenêtres exactement superposées donnent l'impression que le second clic n'a rien fait.
    const a = cascade(0, BOUNDS);
    const b = cascade(1, BOUNDS);
    expect([b.x, b.y]).not.toEqual([a.x, a.y]);
  });

  it("la dixième reste DANS l'écran — le décalage revient à zéro", () => {
    for (let i = 0; i < 40; i += 1) {
      const r = cascade(i, BOUNDS);
      expect(r.x + r.w, `fenêtre ${i}`).toBeLessThanOrEqual(BOUNDS.w);
      expect(r.y + r.h, `fenêtre ${i}`).toBeLessThanOrEqual(BOUNDS.h);
    }
  });

  it("sur un cadre minuscule, la fenêtre garde une taille lisible", () => {
    const r = cascade(0, { w: 200, h: 120 });
    expect(r.w).toBeGreaterThanOrEqual(MIN_W);
    expect(r.h).toBeGreaterThanOrEqual(MIN_H);
  });
});

describe("Une fenêtre reste toujours rattrapable", () => {
  it("poussée loin à droite, il en reste de quoi la saisir", () => {
    const r = clampToBounds({ x: 99_999, y: 10, w: 600, h: 400 }, BOUNDS);
    expect(r.x).toBeLessThan(BOUNDS.w);
    expect(BOUNDS.w - r.x).toBeGreaterThan(0);
  });

  it("poussée à gauche, sa barre de titre ne disparaît pas entièrement", () => {
    const r = clampToBounds({ x: -99_999, y: 10, w: 600, h: 400 }, BOUNDS);
    expect(r.x + r.w).toBeGreaterThan(0);
  });

  it("ne remonte JAMAIS au-dessus du bord haut", () => {
    // Vers le haut, une barre de titre passée sous l'en-tête ne se rattrape plus du tout.
    expect(clampToBounds({ x: 10, y: -500, w: 600, h: 400 }, BOUNDS).y).toBe(0);
  });

  it("ne descend pas sous le bas du cadre", () => {
    expect(clampToBounds({ x: 10, y: 99_999, w: 600, h: 400 }, BOUNDS).y).toBeLessThanOrEqual(BOUNDS.h);
  });

  it("on peut la pousser volontairement à moitié hors champ", () => {
    // Dégager la place est un geste légitime : on ne recentre pas de force.
    const r = clampToBounds({ x: BOUNDS.w - 100, y: 10, w: 600, h: 400 }, BOUNDS);
    expect(r.x).toBe(BOUNDS.w - 100);
  });

  it("un déplacement passe par la même garde", () => {
    const r = moveBy({ x: 10, y: 10, w: 600, h: 400 }, -99_999, -99_999, BOUNDS);
    expect(r.y).toBe(0);
    expect(r.x + r.w).toBeGreaterThan(0);
  });
});

describe("Qui passe devant qui", () => {
  const wins = [win("a", 1, { x: 0, y: 0, w: 400, h: 300 }), win("b", 2, { x: 20, y: 20, w: 400, h: 300 }), win("c", 3, { x: 40, y: 40, w: 400, h: 300 })];

  it("la fenêtre touchée passe devant toutes les autres", () => {
    const next = focus(wins, "a");
    expect(next.find((w) => w.id === "a")!.z).toBe(topZ(next));
  });

  it("les autres gardent leur ordre relatif", () => {
    const next = focus(wins, "a");
    const b = next.find((w) => w.id === "b")!.z;
    const c = next.find((w) => w.id === "c")!.z;
    expect(b).toBeLessThan(c);
  });

  it("cliquer sur celle qui est déjà devant ne change rien", () => {
    expect(focus(wins, "c").map((w) => w.z)).toEqual([1, 2, 3]);
  });

  it("réveiller une fenêtre réduite la remonte ET la déploie", () => {
    const list = [win("a", 1, { x: 0, y: 0, w: 400, h: 300 }, { minimized: true }), win("b", 5, { x: 0, y: 0, w: 400, h: 300 })];
    const next = focus(list, "a");
    expect(next[0].minimized).toBe(false);
    expect(next[0].z).toBeGreaterThan(next[1].z);
  });

  it("une fenêtre inconnue ne casse rien", () => {
    expect(focus(wins, "fantome")).toEqual(wins);
  });
});

describe("Agrandir et revenir", () => {
  it("agrandir occupe tout le bureau", () => {
    const w = toggleMaximize(win("a", 1, { x: 30, y: 40, w: 500, h: 300 }), BOUNDS);
    expect(w.rect).toEqual({ x: 0, y: 0, w: BOUNDS.w, h: BOUNDS.h });
  });

  it("restaurer rend EXACTEMENT la place d'avant", () => {
    // Retrouver une fenêtre ailleurs qu'où on l'avait laissée, c'est devoir la replacer.
    const before = { x: 30, y: 40, w: 500, h: 300 };
    const big = toggleMaximize(win("a", 1, before), BOUNDS);
    expect(toggleMaximize(big, BOUNDS).rect).toEqual(before);
  });

  it("l'aller-retour est stable, même répété", () => {
    let w = win("a", 1, { x: 30, y: 40, w: 500, h: 300 });
    for (let i = 0; i < 4; i += 1) w = toggleMaximize(w, BOUNDS);
    expect(w.rect).toEqual({ x: 30, y: 40, w: 500, h: 300 });
  });
});

describe("La mosaïque", () => {
  it("à deux documents, deux colonnes — la comparaison qu'on venait chercher", () => {
    const [a, b] = tileRects(2, BOUNDS);
    expect(a.y).toBe(b.y);
    expect(b.x).toBeGreaterThan(a.x);
  });

  it("aucune fenêtre n'en recouvre une autre", () => {
    const rects = tileRects(4, BOUNDS);
    const overlap = (p: Rect, q: Rect) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
    for (let i = 0; i < rects.length; i += 1)
      for (let j = i + 1; j < rects.length; j += 1)
        expect(overlap(rects[i], rects[j]), `${i}/${j}`).toBe(false);
  });

  it("une seule fenêtre prend tout", () => {
    expect(tileRects(1, BOUNDS)).toEqual([{ x: 0, y: 0, w: BOUNDS.w, h: BOUNDS.h }]);
  });

  it("aucune fenêtre à ranger : aucune position", () => {
    expect(tileRects(0, BOUNDS)).toEqual([]);
  });
});

describe("Redimensionner", () => {
  it("ne descend jamais sous la taille lisible", () => {
    const r = resizeTo({ x: 0, y: 0, w: 600, h: 400 }, 10, 10, BOUNDS);
    expect(r.w).toBe(MIN_W);
    expect(r.h).toBe(MIN_H);
  });

  it("ne dépasse pas le bureau", () => {
    const r = resizeTo({ x: 0, y: 0, w: 600, h: 400 }, 99_999, 99_999, BOUNDS);
    expect(r.w).toBe(BOUNDS.w);
    expect(r.h).toBe(BOUNDS.h);
  });

  it("ne déplace pas la fenêtre au passage", () => {
    const r = resizeTo({ x: 120, y: 90, w: 600, h: 400 }, 700, 500, BOUNDS);
    expect([r.x, r.y]).toEqual([120, 90]);
  });
});
