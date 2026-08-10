/**
 * EXPORT DE L'ORGANIGRAMME EN CARTE IMPRIMABLE (PDF paysage).
 *
 * Un organigramme se lit à plat, sur une table, en réunion — pas dans un conteneur qui défile.
 * L'écran savait le dessiner mais pas le SORTIR : « imprimer la page » produisait le menu, la
 * barre et un cadre coupé au premier tiers.
 *
 * On reconstruit donc un document AUTONOME : un SVG de la carte (boîtes + liens), posé dans une
 * page dont `@page { size: landscape }` impose l'orientation, et mis à l'échelle pour tenir sur
 * la feuille. Le navigateur fait le reste — « Enregistrer en PDF » donne le fichier attendu,
 * sans bibliothèque à embarquer.
 *
 * Module PUR (aucun DOM) : ce qui est délicat ici, c'est l'échappement et la géométrie, et ça
 * se teste.
 */

export interface PrintNode {
  id: string;
  fullName: string;
  position: string | null;
  entity: string | null;
  color: string | null;
  managerId: string | null;
}

export interface PrintPoint {
  x: number;
  y: number;
}

export const PRINT_BOX_W = 190;
export const PRINT_BOX_H = 64;
const PRINT_PAD = 40;

/**
 * Échappe le texte inséré dans le SVG. Un nom qui contient « & » ou « < » — rare mais réel dans
 * les raisons sociales — casserait le document sans cela, et un document cassé ne s'imprime pas.
 */
export function escapeXml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Tronque proprement à la largeur d'une boîte — un nom qui déborde recouvre son voisin. */
export function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, Math.max(1, max - 1))}…`;
}

/** Une couleur d'entité venue de la base ne doit pas pouvoir injecter d'attribut SVG. */
function safeColor(c: string | null): string | null {
  return c && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : null;
}

export interface OrgSvg {
  svg: string;
  width: number;
  height: number;
}

/**
 * Dessine la carte : les liens d'abord (ils passent DERRIÈRE les boîtes), les boîtes ensuite.
 * Un lien n'est tracé que si le responsable est lui aussi affiché — sinon on relierait une
 * boîte à un point vide, ce qui se lit comme une erreur de structure.
 */
export function buildOrgChartSvg(nodes: PrintNode[], positions: Map<string, PrintPoint>): OrgSvg {
  const pts = nodes.map((n) => positions.get(n.id)).filter((p): p is PrintPoint => Boolean(p));
  const width = Math.max(640, ...pts.map((p) => p.x + PRINT_BOX_W + PRINT_PAD));
  const height = Math.max(420, ...pts.map((p) => p.y + PRINT_BOX_H + PRINT_PAD));
  const shown = new Set(nodes.map((n) => n.id));

  const links = nodes
    .map((n) => {
      if (!n.managerId || !shown.has(n.managerId)) return null;
      const c = positions.get(n.id);
      const p = positions.get(n.managerId);
      if (!c || !p) return null;
      const x1 = p.x + PRINT_BOX_W / 2, y1 = p.y + PRINT_BOX_H;
      const x2 = c.x + PRINT_BOX_W / 2, y2 = c.y;
      const my = (y1 + y2) / 2;
      return `<path d="M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}" fill="none" stroke="#94a3b8" stroke-width="1.5"/>`;
    })
    .filter(Boolean)
    .join("");

  const boxes = nodes
    .map((n) => {
      const p = positions.get(n.id);
      if (!p) return "";
      const color = safeColor(n.color);
      const dot = color
        ? `<circle cx="${p.x + 14}" cy="${p.y + 18}" r="4" fill="${color}"/>`
        : "";
      const nameX = p.x + (color ? 24 : 12);
      const sub = [n.position, n.entity].filter(Boolean).join(" · ");
      return (
        `<g>` +
        `<rect x="${p.x}" y="${p.y}" width="${PRINT_BOX_W}" height="${PRINT_BOX_H}" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>` +
        dot +
        `<text x="${nameX}" y="${p.y + 23}" font-size="12" font-weight="600" fill="#0f172a">${escapeXml(clip(n.fullName, 24))}</text>` +
        `<text x="${p.x + 12}" y="${p.y + 40}" font-size="10" fill="#475569">${escapeXml(clip(n.position ?? "Poste non défini", 30))}</text>` +
        (sub && n.entity ? `<text x="${p.x + 12}" y="${p.y + 54}" font-size="9" fill="#64748b">${escapeXml(clip(n.entity, 32))}</text>` : "") +
        `</g>`
      );
    })
    .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>${links}${boxes}</svg>`;
  return { svg, width, height };
}

/**
 * Le document imprimable complet. `@page { size: A4 landscape }` fixe l'orientation dans la
 * boîte de dialogue elle-même : sans cette règle, l'utilisateur doit penser à basculer en
 * paysage à chaque export, et une carte imprimée en portrait est illisible.
 *
 * Le SVG est mis à l'échelle par `width:100%` + `height:auto` : une carte large se réduit pour
 * tenir sur la feuille au lieu d'être tronquée.
 */
export function buildPrintDocument(chart: OrgSvg, title: string, subtitle: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escapeXml(title)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; background: #fff; }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 0 0 6px; border-bottom: 1px solid #cbd5e1; margin-bottom: 8px; }
  h1 { font-size: 14px; margin: 0; }
  p { font-size: 10px; margin: 0; color: #475569; }
  svg { width: 100%; height: auto; }
  @media print { .no-print { display: none; } }
</style></head>
<body>
  <header><h1>${escapeXml(title)}</h1><p>${escapeXml(subtitle)}</p></header>
  ${chart.svg}
</body></html>`;
}
