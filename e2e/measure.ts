/**
 * LA MESURE D'UN ÉCRAN — partagée entre le crawler d'audit (`scripts/ui-audit/run.ts`) et la
 * spec E2E (`e2e/ui-audit.spec.ts`), pour qu'ils ne divergent jamais sur ce qu'est « déborder ».
 *
 * Ce fichier n'importe RIEN : la spec Playwright et le script `tsx` le chargent chacun par un
 * chemin relatif, et le premier n'honore pas les alias `@/`.
 */

/**
 * Exécuté DANS la page : les éléments les plus EXTÉRIEURS qui sortent du viewport.
 *
 * Pourquoi la boîte de chaque élément et non `document.scrollWidth` : la coque de l'application
 * (`<main overflow-x-hidden>`) CLIPPE ce qui dépasse au lieu de faire défiler la page — la page
 * n'est jamais « plus large », c'est le contenu qui est coupé. Un ancêtre qui défile
 * horizontalement (`overflow-x: auto|scroll`) est légitime : un tableau large DOIT défiler chez
 * lui, et ses cellules ne sont pas un débordement.
 */
export const MESURE_DEBORDEMENTS = `(() => {
  const W = window.innerWidth;
  const out = [];
  const scrollable = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    return false;
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const marked = new Set();
  for (const el of document.body.querySelectorAll("*")) {
    if (marked.has(el)) continue;
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (!(r.right > W + 1 || r.left < -1)) continue;
    if (scrollable(el)) continue;
    let anc = el.parentElement, skip = false;
    while (anc) { if (marked.has(anc)) { skip = true; break; } anc = anc.parentElement; }
    if (skip) continue;
    marked.add(el);
    for (const d of el.querySelectorAll("*")) marked.add(d);
    let depth = 0; for (let p = el; p; p = p.parentElement) depth++;
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: (typeof el.className === "string" ? el.className : "").slice(0, 120),
      text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 70),
      right: Math.round(r.right), left: Math.round(r.left), width: Math.round(r.width), depth,
    });
  }
  return out.slice(0, 12);
})()`;

/** Les textes qui trahissent une page cassée — ceux de Next, et les nôtres. */
export const ERREURS: RegExp[] = [
  /This page could not be found/i,
  /Application error: a client-side exception/i,
  /Internal Server Error/i,
  /Something went wrong/i,
  /Page introuvable/i,
  /Cette page n'a pas pu s'afficher/i,
];

export interface Overflow { tag: string; cls: string; text: string; right: number; left: number; width: number; depth: number }
