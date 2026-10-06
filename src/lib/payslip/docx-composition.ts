import { formaterNombre, type Ancre, type Bande, type Bloc, type Bordure, type DocumentDocx, type ElementGraphique, type Etiquette, type ImageDocx, type Paragraphe, type PositionAncre, type ProprietesTexte, type Rognage, type Section, type Tableau, type Tabulation, type Cellule } from "./docx-lecture";
import { columnWidths } from "./layout";

/**
 * LA MISE EN PAGE D'UN DOCUMENT WORD — ce que Word calcule avant d'imprimer, refait ici.
 *
 * On part du modèle lu (`docx-lecture.ts`) et l'on produit des PAGES de tracés absolus (texte à une
 * position de ligne de base, images, filets, aplats) que `to-pdf.ts` n'a plus qu'à dessiner. Toute
 * la décision est ici, et elle est pure : la seule chose qu'elle demande au monde extérieur est la
 * LARGEUR d'une chaîne dans une police (`Mesureur`), pour couper les lignes au même mot que Word.
 *
 * Ce qui est reproduit, dans l'ordre où Word le fait :
 *   • la coupure des lignes au mot (et au trait d'union), les espaces de fin de ligne qui pendent ;
 *   • les TABULATIONS : taquets gauche / centré / droit / décimal, points de suite, taquets par
 *     défaut (`w:defaultTabStop`), taquet implicite du retrait suspendu, tabulations de position ;
 *   • l'alignement (gauche, centré, droite, JUSTIFIÉ — l'espace est réparti après le dernier taquet,
 *     la dernière ligne et les lignes forcées ne sont pas étirées) ;
 *   • la hauteur des lignes depuis les métriques de la police (interligne simple de Word), la marque
 *     de paragraphe comprise, les règles « multiple », « exactement », « au moins » ;
 *   • les espacements avant / après, l'espacement automatique « HTML » (fusion des marges), les
 *     paragraphes de même style à espacement contextuel ;
 *   • la PAGINATION : sauts de page, « saut de page avant », lignes solidaires, paragraphe lié au
 *     suivant, veuves et orphelines ; les lignes d'en-tête de tableau répétées sur chaque page ;
 *   • les en-têtes et pieds de page de chaque page (première page, pages paires), qui REPOUSSENT le
 *     corps quand ils sont plus hauts que la marge, et dont les images habillées le limitent ;
 *   • les objets ancrés (images, formes, zones de texte) positionnés par rapport à la page, à la
 *     marge ou au paragraphe, devant ou derrière le texte.
 */

// ─────────────────────────── Contrats ───────────────────────────

export interface PoliceRendu {
  /** Le nom sous lequel la police est connue du moteur PDF. */
  cle: string;
  /** Compression horizontale qui rend la chasse de la police d'origine (1 = aucune). */
  echelle: number;
  interligne: number;
  ascent: number;
  /** Police standard du PDF (WinAnsi) — le texte doit y être ramené. */
  standard: boolean;
  /** Variante absente du système : graisse ou pente simulées au tracé. */
  faux: { gras: boolean; italique: boolean };
}

export interface Mesureur {
  police(p: ProprietesTexte): PoliceRendu;
  largeur(police: PoliceRendu, texte: string, taille: number): number;
  nettoyer(police: PoliceRendu, texte: string): string;
}

interface Abs { ax?: boolean; ay?: boolean }
export type Trace =
  | ({ t: "texte"; x: number; y: number; texte: string; police: PoliceRendu; taille: number; couleur: string; espacement: number; champ?: "PAGE" | "NUMPAGES" } & Abs)
  | ({ t: "image"; x: number; y: number; largeur: number; hauteur: number; image: ImageDocx; rognage: Rognage | null } & Abs)
  | ({ t: "rect"; x: number; y: number; largeur: number; hauteur: number; fond: string | null; trait: { couleur: string; epaisseur: number } | null; forme: "rect" | "roundRect" | "ellipse" } & Abs)
  | ({ t: "ligne"; x1: number; y1: number; x2: number; y2: number; couleur: string; epaisseur: number; style: Bordure["style"] } & Abs)
  | ({ t: "puce"; forme: NonNullable<Etiquette["puce"]>; x: number; y: number; taille: number; couleur: string } & Abs)
  | ({ t: "lien"; x: number; y: number; largeur: number; hauteur: number; url: string } & Abs);

export interface PageComposee {
  largeur: number;
  hauteur: number;
  numero: number;
  formatNumero: string;
  /** Les objets du corps placés DERRIÈRE le texte. */
  derriere: Trace[];
  /** En-tête et pied — sous le corps, comme dans Word. */
  bandes: Trace[];
  corps: Trace[];
  devant: Trace[];
}

/**
 * La géométrie de la page courante. `texte` est la zone de texte EFFECTIVE — repoussée par un
 * en-tête plus haut que la marge : c'est elle, et non la marge déclarée, que Word prend pour
 * « marge » quand il positionne un objet ancré (mesuré : le logo de l'ordre de mission, ancré à
 * −71,6 pt « de la marge », tombe à 36,6 pt du haut de la feuille, soit 108,2 − 71,6).
 */
interface Geo { largeur: number; hauteur: number; marges: Section["marges"]; texte: { haut: number; bas: number } }

interface Ctx {
  mes: Mesureur;
  tabDefaut: number;
  geo: Geo;
  paragraphes: WeakMap<Paragraphe, Map<number, LigneComposee[]>>;
  tableaux: WeakMap<Tableau, Map<number, TableauCompose>>;
}

const NOIR = "000000";
const borne = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function numeroDePage(n: number, format: string): string {
  return formaterNombre(n, format === "decimal" || !format ? "decimal" : format);
}

// ─────────────────────────── Déplacer des tracés ───────────────────────────

/** Translate des tracés composés « en relatif » ; ceux déjà ABSOLUS sur un axe ne bougent pas sur cet axe. */
function deplacer(traces: readonly Trace[], dx: number, dy: number, force?: Abs): Trace[] {
  return traces.map((t) => {
    const mx = t.ax ? 0 : dx;
    const my = t.ay ? 0 : dy;
    const flags = force ? { ax: force.ax || t.ax, ay: force.ay || t.ay } : {};
    if (t.t === "ligne") return { ...t, x1: t.x1 + mx, x2: t.x2 + mx, y1: t.y1 + my, y2: t.y2 + my, ...flags };
    return { ...t, x: t.x + mx, y: t.y + my, ...flags } as Trace;
  });
}

// ─────────────────────────── Les boîtes d'un paragraphe ───────────────────────────

type TypeBoite = "mot" | "espace" | "tab" | "saut" | "dessin" | "champ" | "puce";
interface Boite {
  type: TypeBoite;
  texte: string;
  p: ProprietesTexte;
  police: PoliceRendu;
  taille: number;
  decalage: number;
  largeur: number;
  asc: number;
  desc: number;
  coupureAvant: boolean;
  x: number;
  etiree?: boolean;
  ptab?: "left" | "center" | "right";
  saut?: "ligne" | "page" | "colonne";
  dessin?: { largeur: number; hauteur: number; contenu: ElementGraphique[] };
  champ?: "PAGE" | "NUMPAGES";
  puce?: NonNullable<Etiquette["puce"]>;
  points?: Tabulation["points"];
}

function metriques(p: ProprietesTexte, mes: Mesureur): { police: PoliceRendu; taille: number; asc: number; desc: number } {
  const police = mes.police(p);
  const taille = borne(p.taillePt, 1, 400);
  return { police, taille, asc: taille * police.ascent, desc: taille * (police.interligne - police.ascent) };
}

function boites(par: Paragraphe, ctx: Ctx): Boite[] {
  const { mes } = ctx;
  const out: Boite[] = [];
  let coupe = true;
  const vide = (type: TypeBoite, p: ProprietesTexte): Boite => {
    const m = metriques(p, mes);
    return { type, texte: "", p, police: m.police, taille: m.taille, decalage: 0, largeur: 0, asc: m.asc, desc: m.desc, coupureAvant: true, x: 0 };
  };
  const ajouterTexte = (brut: string, p: ProprietesTexte) => {
    const m = metriques(p, mes);
    const texte = p.majuscules ? brut.toUpperCase() : brut;
    // Petites majuscules : les minuscules passent en capitales, à 80 % de la taille.
    const segments: { s: string; petit: boolean }[] = [];
    if (p.petitesMajuscules) {
      for (const c of texte) {
        const petit = c !== c.toUpperCase();
        const dernier = segments[segments.length - 1];
        if (dernier && dernier.petit === petit) dernier.s += petit ? c.toUpperCase() : c;
        else segments.push({ s: petit ? c.toUpperCase() : c, petit });
      }
    } else segments.push({ s: texte, petit: false });
    const reduit = p.position !== "normal" ? 0.65 : 1;
    const decalage = p.position === "exposant" ? -m.taille * 0.33 : p.position === "indice" ? m.taille * 0.14 : 0;
    for (const seg of segments) {
      const taille = m.taille * reduit * (seg.petit ? 0.8 : 1);
      for (const tok of seg.s.split(/( +)/)) {
        if (!tok) continue;
        const espace = /^ +$/.test(tok);
        const parts = espace ? [tok] : tok.split(/(?<=[-–—])(?=[^\s\-–—])/);
        for (const part of parts) {
          const t = mes.nettoyer(m.police, part);
          const largeur = mes.largeur(m.police, t, taille) + p.espacementPt * [...t].length;
          out.push({ type: espace ? "espace" : "mot", texte: t, p, police: m.police, taille, decalage, largeur, asc: m.asc, desc: m.desc, coupureAvant: espace || coupe, x: 0 });
          coupe = espace || /[-–—]$/.test(part);
        }
      }
    }
  };

  const e = par.etiquette;
  if (e) {
    if (e.puce) {
      const b = vide("puce", e.p);
      b.puce = e.puce;
      b.largeur = Math.max(b.taille * 0.45, mes.largeur(b.police, "•", b.taille));
      if (e.symbole) {
        // Mesuré contre Word : une ligne qui porte une puce Symbol est plus haute (15,0 pt au lieu
        // de 14,5 pour du Calibri 11 en interligne 1,08) — ce sont les métriques de Symbol.
        b.asc = Math.max(b.asc, b.taille * 1.005);
        b.desc = Math.max(b.desc, b.taille * 0.259);
      }
      out.push(b);
    } else if (e.texte) ajouterTexte(e.texte, e.p);
    if (e.suffixe === "tab") out.push(vide("tab", e.p));
    else if (e.suffixe === "space") ajouterTexte(" ", e.p);
    coupe = true;
  }
  for (const it of par.contenu) {
    switch (it.k) {
      case "texte":
        ajouterTexte(it.texte, it.p);
        break;
      case "tab":
      case "ptab": {
        const b = vide("tab", it.p);
        if (it.k === "ptab") b.ptab = it.alignement;
        out.push(b);
        coupe = true;
        break;
      }
      case "saut": {
        const b = vide("saut", it.p);
        b.saut = it.type;
        out.push(b);
        coupe = true;
        break;
      }
      case "dessin": {
        const b = vide("dessin", it.p);
        b.dessin = { largeur: it.largeur, hauteur: it.hauteur, contenu: it.contenu };
        b.largeur = it.largeur;
        b.asc = it.hauteur;
        b.desc = 0;
        out.push(b);
        coupe = true;
        break;
      }
      case "champ": {
        const b = vide("champ", it.p);
        b.champ = it.code;
        b.texte = it.repli || "1";
        b.largeur = mes.largeur(b.police, b.texte, b.taille);
        b.coupureAvant = coupe;
        out.push(b);
        coupe = false;
        break;
      }
    }
  }
  return out;
}

// ─────────────────────────── Les lignes d'un paragraphe ───────────────────────────

export interface LigneComposee {
  hauteur: number;
  /** x depuis le bord gauche de la zone de texte, y depuis le HAUT de la ligne. */
  traces: Trace[];
  sautPage: boolean;
  vide: boolean;
}

interface LigneEnCours {
  boites: Boite[];
  x: number;
  debut: number;
  attente: { tab: Boite; pos: number; type: string; x0: number } | null;
}

function composerParagraphe(par: Paragraphe, largeur: number, ctx: Ctx): LigneComposee[] {
  let parLargeur = ctx.paragraphes.get(par);
  if (!parLargeur) { parLargeur = new Map(); ctx.paragraphes.set(par, parLargeur); }
  const cle = Math.round(largeur * 100);
  const deja = parLargeur.get(cle);
  if (deja) return deja;

  const { mes } = ctx;
  const pp = par.pp;
  const bs = boites(par, ctx);
  const limite = largeur - pp.retraitDroit;
  const lignes: LigneComposee[] = [];
  const nouvelle = (premiere: boolean): LigneEnCours => {
    const d = pp.retraitGauche + (premiere ? pp.retraitPremiere : 0);
    return { boites: [], x: d, debut: d, attente: null };
  };
  let L = nouvelle(true);
  const poser = (b: Boite) => { b.x = L.x; L.x += b.largeur; L.boites.push(b); };

  const trouverTab = (x: number): { pos: number; type: string; points: Tabulation["points"] } => {
    const perso = pp.tabulations.find((t) => t.type !== "bar" && t.type !== "clear" && t.pos > x + 0.05);
    const suspendu = pp.retraitPremiere < 0 && x < pp.retraitGauche - 0.05 ? pp.retraitGauche : null;
    if (perso && (suspendu == null || perso.pos <= suspendu)) return perso;
    if (suspendu != null) return { pos: suspendu, type: "left", points: null };
    // Les taquets par défaut ne valent qu'APRÈS le dernier taquet personnalisé.
    const d = ctx.tabDefaut > 1 ? ctx.tabDefaut : 36;
    return { pos: (Math.floor((x + 0.05) / d) + 1) * d, type: "left", points: null };
  };

  const resoudre = () => {
    const a = L.attente;
    if (!a) return;
    L.attente = null;
    const apres = L.boites.slice(L.boites.indexOf(a.tab) + 1);
    let fin = a.x0;
    for (const b of apres) if (b.type !== "espace") fin = b.x + b.largeur;
    const seg = fin - a.x0;
    let avantDecimal = seg;
    if (a.type === "decimal") {
      for (const b of apres) {
        if (b.type !== "mot") continue;
        const k = b.texte.search(/[.,]/);
        if (k >= 0) { avantDecimal = b.x - a.x0 + mes.largeur(b.police, b.texte.slice(0, k), b.taille); break; }
      }
    }
    let gap = a.type === "center" ? a.pos - a.x0 - seg / 2 : a.type === "decimal" ? a.pos - a.x0 - avantDecimal : a.pos - a.x0 - seg;
    gap = Math.max(0, Math.min(gap, Math.max(0, Math.max(limite, a.pos) - a.x0 - seg)));
    a.tab.largeur = gap;
    for (const b of apres) b.x += gap;
    L.x += gap;
  };

  const terminer = (raison: "auto" | "saut" | "fin") => {
    resoudre();
    lignes.push(finaliserLigne(L, raison, par, limite, ctx));
  };

  for (let i = 0; i < bs.length; ) {
    const b = bs[i]!;
    if (b.type === "espace") { poser(b); i += 1; continue; }
    if (b.type === "saut") {
      poser(b);
      terminer("saut");
      L = nouvelle(false);
      i += 1;
      continue;
    }
    if (b.type === "tab") {
      resoudre();
      const stop = b.ptab
        ? { pos: b.ptab === "center" ? largeur / 2 : b.ptab === "right" ? largeur : 0, type: b.ptab, points: null }
        : trouverTab(L.x);
      b.points = stop.points;
      if (stop.type === "left") {
        if (stop.pos > limite + 0.5 && L.boites.length > 0 && !b.ptab) {
          // Le taquet tombe au-delà de la marge : Word passe à la ligne.
          terminer("auto");
          L = nouvelle(false);
          b.largeur = 0;
          poser(b);
        } else {
          b.largeur = Math.max(0, stop.pos - L.x);
          poser(b);
        }
      } else {
        b.largeur = 0;
        poser(b);
        L.attente = { tab: b, pos: stop.pos, type: stop.type, x0: L.x };
      }
      i += 1;
      continue;
    }
    // Un AMAS insécable : des mots collés (changement de graisse au milieu d'un mot), une image…
    let j = i;
    let w = 0;
    while (j < bs.length) {
      const c = bs[j]!;
      if (c.type === "espace" || c.type === "tab" || c.type === "saut") break;
      if (j > i && c.coupureAvant) break;
      w += c.largeur;
      j += 1;
    }
    if (L.x + w > limite + 0.01 && L.boites.length > 0) {
      terminer("auto");
      L = nouvelle(false);
    }
    if (L.x + w > limite + 0.01) {
      // Plus large qu'une ligne entière : on coupe au caractère, comme Word.
      for (let k = i; k < j; k++) {
        let c = bs[k]!;
        while (c.type === "mot" && L.x + c.largeur > limite + 0.01 && [...c.texte].length > 1) {
          const chars = [...c.texte];
          let n = 0;
          while (n < chars.length && L.x + mes.largeur(c.police, chars.slice(0, n + 1).join(""), c.taille) <= limite + 0.01) n += 1;
          if (n === 0 && L.boites.length > 0) { terminer("auto"); L = nouvelle(false); continue; }
          n = Math.max(1, n);
          const tete = chars.slice(0, n).join("");
          const reste = chars.slice(n).join("");
          poser({ ...c, texte: tete, largeur: mes.largeur(c.police, tete, c.taille) });
          if (!reste) { c = { ...c, texte: "", largeur: 0 }; break; }
          terminer("auto");
          L = nouvelle(false);
          c = { ...c, texte: reste, largeur: mes.largeur(c.police, reste, c.taille) };
        }
        if (c.texte || c.type !== "mot") poser(c);
      }
    } else {
      for (let k = i; k < j; k++) poser(bs[k]!);
    }
    i = j;
  }
  terminer("fin");
  // Un saut de page en FIN de paragraphe garde la marque avec lui, sur la page qu'il termine :
  // Word ne repousse pas une ligne vide en tête de la page suivante.
  if (lignes.length >= 2 && lignes[lignes.length - 1]!.vide && lignes[lignes.length - 2]!.sautPage) lignes.pop();
  parLargeur.set(cle, lignes);
  return lignes;
}

function finaliserLigne(L: LigneEnCours, raison: "auto" | "saut" | "fin", par: Paragraphe, limite: number, ctx: Ctx): LigneComposee {
  const pp = par.pp;
  const { mes } = ctx;
  let A = 0, At = 0, Dt = 0;
  let texte = false;
  for (const b of L.boites) {
    if (b.type === "dessin") A = Math.max(A, b.asc);
    else { At = Math.max(At, b.asc); Dt = Math.max(Dt, b.desc); texte = true; }
  }
  // La MARQUE de paragraphe ne donne sa hauteur qu'à une ligne SANS texte (paragraphe vide, ligne
  // laissée vide par un saut final). Mesuré contre Word sur l'ordre de mission : une marque en
  // 13,5 pt derrière une ligne de texte en 12 pt ne la rehausse pas, mais elle fait la hauteur de
  // la ligne vide qui suit un `w:br` final.
  if (!texte) {
    const m = metriques(par.marque, mes);
    At = Math.max(At, m.asc);
    Dt = Math.max(Dt, m.desc);
  }
  // Une ligne faite d'une image seule n'a pas de jambage : l'image pose sur la ligne de base.
  const imageSeule = !texte && A > 0;
  A = Math.max(A, At);
  const D = imageSeule ? 0 : Dt;
  const naturel = A + D;
  const ligneTexte = At + Dt;
  const il = pp.interligne;
  const hauteur = il.regle === "exact" ? il.valeur : il.regle === "atLeast" ? Math.max(naturel, il.valeur) : Math.max(1, naturel + ligneTexte * (il.valeur - 1));
  // Interligne « multiple » : le supplément va SOUS le texte (mesuré contre Word : un en-tête en
  // interligne 1,08 garde sa ligne de base à distance d'en-tête + jambage haut). « Exactement » et
  // « au moins » posent le texte en bas de la ligne.
  const base = il.regle === "auto" ? A : hauteur - D;

  // Ce que la ligne contient vraiment : les espaces et sauts de fin ne comptent pas.
  let dernierUtile = -1;
  let fin = L.debut;
  L.boites.forEach((b, i) => { if (b.type !== "espace" && b.type !== "saut") { dernierUtile = i; fin = b.x + b.largeur; } });
  const libre = limite - fin;
  let dx = 0;
  if (pp.alignement === "center") dx = Math.max(0, libre / 2);
  else if (pp.alignement === "right") dx = Math.max(0, libre);
  else if (pp.alignement === "justify" && raison === "auto" && libre > 0) {
    let dernierTab = -1;
    L.boites.forEach((b, i) => { if (b.type === "tab" && i <= dernierUtile) dernierTab = i; });
    const espaces = L.boites.filter((b, i) => b.type === "espace" && i > dernierTab && i < dernierUtile);
    const nb = espaces.reduce((s, b) => s + b.texte.length, 0);
    if (nb > 0) {
      const parEspace = libre / nb;
      let cumul = 0;
      L.boites.forEach((b, i) => {
        b.x += cumul;
        if (b.type === "espace" && i > dernierTab && i < dernierUtile) {
          const extra = parEspace * b.texte.length;
          b.largeur += extra;
          b.etiree = true;
          cumul += extra;
        }
      });
    }
  }

  const fonds: Trace[] = [];
  const textes: Trace[] = [];
  const decors: Trace[] = [];
  const traits: Trace[] = [];
  const liens: Trace[] = [];
  let run: { cle: string; xFin: number; trace: Extract<Trace, { t: "texte" }> } | null = null;
  const vider = () => { if (run) { textes.push(run.trace); run = null; } };
  const couleur = (p: ProprietesTexte) => p.couleur ?? NOIR;

  L.boites.forEach((b, i) => {
    const x = b.x + dx;
    const y = base + b.decalage;
    const finale = i > dernierUtile;
    if (!finale && (b.p.surlignage || b.p.fond) && b.largeur > 0 && b.type !== "saut") {
      fonds.push({ t: "rect", x, y: base - b.asc, largeur: b.largeur, hauteur: b.asc + b.desc, fond: b.p.surlignage ?? b.p.fond, trait: null, forme: "rect" });
    }
    switch (b.type) {
      case "mot":
      case "espace": {
        if (b.type === "espace" && (finale || b.etiree)) { vider(); break; }
        const cle = `${b.police.cle}|${b.taille}|${couleur(b.p)}|${b.decalage}|${b.p.espacementPt}`;
        if (run && run.cle === cle && Math.abs(run.xFin - x) < 0.05) {
          run.trace.texte += b.texte;
          run.xFin = x + b.largeur;
        } else {
          vider();
          run = { cle, xFin: x + b.largeur, trace: { t: "texte", x, y, texte: b.texte, police: b.police, taille: b.taille, couleur: couleur(b.p), espacement: b.p.espacementPt } };
        }
        break;
      }
      case "champ":
        vider();
        textes.push({ t: "texte", x, y, texte: b.texte, police: b.police, taille: b.taille, couleur: couleur(b.p), espacement: b.p.espacementPt, champ: b.champ });
        break;
      case "puce":
        vider();
        decors.push({ t: "puce", forme: b.puce!, x: x + b.largeur / 2, y: base - b.taille * 0.3, taille: b.taille, couleur: couleur(b.p) });
        break;
      case "tab": {
        vider();
        if (b.points && b.largeur > b.taille) {
          const c = b.points === "dot" ? "." : b.points === "hyphen" ? "-" : b.points === "underscore" ? "_" : "·";
          const t = mes.nettoyer(b.police, c);
          const wc = mes.largeur(b.police, t, b.taille);
          const n = wc > 0 ? Math.floor((b.largeur - b.taille * 0.4) / wc) : 0;
          if (n > 0) textes.push({ t: "texte", x: x + b.largeur - n * wc - b.taille * 0.15, y: base, texte: t.repeat(n), police: b.police, taille: b.taille, couleur: couleur(b.p), espacement: 0 });
        }
        break;
      }
      case "dessin":
        vider();
        textes.push(...tracesGraphiques(b.dessin!.contenu, x, base - b.dessin!.hauteur, ctx, {}));
        break;
      case "saut":
        vider();
        break;
    }
    // Soulignement, barré, lien — continus d'une boîte à l'autre quand rien ne change.
    if (!finale && b.largeur > 0 && b.type !== "saut" && b.type !== "dessin" && b.type !== "puce") {
      const prolonger = (liste: Trace[], tr: Extract<Trace, { t: "ligne" }>) => {
        const d = liste[liste.length - 1];
        if (d && d.t === "ligne" && Math.abs(d.y1 - tr.y1) < 0.01 && d.couleur === tr.couleur && Math.abs(d.x2 - tr.x1) < 0.6 && d.epaisseur === tr.epaisseur) d.x2 = tr.x2;
        else liste.push(tr);
      };
      const tp = borne(b.p.taillePt, 1, 400);
      if (b.p.souligne) {
        const ep = Math.max(0.5, tp * 0.055);
        const yU = base + tp * 0.11;
        prolonger(traits, { t: "ligne", x1: x, x2: x + b.largeur, y1: yU, y2: yU, couleur: couleur(b.p), epaisseur: ep, style: "simple" });
        if (b.p.souligne === "double") prolonger(traits, { t: "ligne", x1: x, x2: x + b.largeur, y1: yU + ep * 2, y2: yU + ep * 2, couleur: couleur(b.p), epaisseur: ep, style: "simple" });
      }
      if (b.p.barre && b.type !== "tab") {
        const yB = y - b.taille * 0.28;
        prolonger(traits, { t: "ligne", x1: x, x2: x + b.largeur, y1: yB, y2: yB, couleur: couleur(b.p), epaisseur: Math.max(0.5, tp * 0.05), style: "simple" });
      }
      if (b.p.lien) {
        const d = liens[liens.length - 1];
        if (d && d.t === "lien" && d.url === b.p.lien && Math.abs(d.x + d.largeur - x) < 0.6) d.largeur = x + b.largeur - d.x;
        else liens.push({ t: "lien", x, y: base - b.asc, largeur: b.largeur, hauteur: b.asc + b.desc, url: b.p.lien });
      }
    }
  });
  vider();
  const sautPage = raison === "saut" && L.boites.some((b) => b.type === "saut" && (b.saut === "page" || b.saut === "colonne"));
  return { hauteur, traces: [...fonds, ...textes, ...decors, ...traits, ...liens], sautPage, vide: L.boites.length === 0 };
}

// ─────────────────────────── Dessins : images, formes, zones de texte ───────────────────────────

function tracesGraphiques(contenu: readonly ElementGraphique[], x0: number, y0: number, ctx: Ctx, abs: Abs): Trace[] {
  const out: Trace[] = [];
  for (const el of contenu) {
    const x = x0 + el.x;
    const y = y0 + el.y;
    if (el.type === "image") {
      out.push({ t: "image", x, y, largeur: el.largeur, hauteur: el.hauteur, image: el.image, rognage: el.rognage, ...abs });
      continue;
    }
    if (el.geometrie === "ligne") {
      const t = el.trait ?? { couleur: NOIR, epaisseur: 0.75 };
      out.push({ t: "ligne", x1: el.retourneH ? x + el.largeur : x, y1: el.retourneV ? y + el.hauteur : y, x2: el.retourneH ? x : x + el.largeur, y2: el.retourneV ? y : y + el.hauteur, couleur: t.couleur, epaisseur: t.epaisseur, style: "simple", ...abs });
    } else if (el.fond || el.trait) {
      out.push({ t: "rect", x, y, largeur: el.largeur, hauteur: el.hauteur, fond: el.fond, trait: el.trait, forme: el.geometrie, ...abs });
    }
    if (el.texte) {
      const m = el.texte.marges;
      const inner = composerBlocsFixe(el.texte.blocs, Math.max(1, el.largeur - m.gauche - m.droite), ctx, false);
      const libre = el.hauteur - m.haut - m.bas - inner.hauteur;
      const oy = libre > 0 ? (el.texte.ancrageV === "centre" ? libre / 2 : el.texte.ancrageV === "bas" ? libre : 0) : 0;
      out.push(...deplacer([...inner.derriere, ...inner.corps, ...inner.devant], x + m.gauche, y + m.haut + oy, abs));
    }
  }
  return out;
}

/** Où se pose un objet ancré. Un axe rapporté à la page ou à la marge est ABSOLU ; au paragraphe, relatif. */
function positionner(a: Ancre, geo: Geo, zone: { gauche: number; largeur: number }, yParagraphe: number): { x: number; y: number; ax: boolean; ay: boolean } {
  const regionH = (rel: string): [number, number, boolean] => {
    switch (rel) {
      case "page": return [0, geo.largeur, true];
      case "leftMargin": case "insideMargin": return [0, geo.marges.gauche, true];
      case "rightMargin": case "outsideMargin": return [geo.largeur - geo.marges.droite, geo.marges.droite, true];
      case "margin": return [geo.marges.gauche, geo.largeur - geo.marges.gauche - geo.marges.droite, true];
      default: return [zone.gauche, zone.largeur, false];
    }
  };
  const regionV = (rel: string): [number, number, boolean] => {
    switch (rel) {
      case "page": return [0, geo.hauteur, true];
      case "margin": return [geo.texte.haut, geo.texte.bas - geo.texte.haut, true];
      case "topMargin": case "insideMargin": return [0, geo.texte.haut, true];
      case "bottomMargin": case "outsideMargin": return [geo.texte.bas, geo.hauteur - geo.texte.bas, true];
      default: return [yParagraphe, 0, false];
    }
  };
  const place = (pos: PositionAncre, region: [number, number, boolean], taille: number): number => {
    const [o, l] = region;
    if (pos.align) {
      if (pos.align === "center") return o + (l - taille) / 2;
      if (pos.align === "right" || pos.align === "bottom" || pos.align === "outside") return o + l - taille;
      return o;
    }
    if (pos.pct != null) return o + pos.pct * l;
    return o + (pos.decalage ?? 0);
  };
  const rh = regionH(a.h.rel);
  const rv = regionV(a.v.rel);
  return { x: place(a.h, rh, a.largeur), y: place(a.v, rv, a.hauteur), ax: rh[2], ay: rv[2] };
}

// ─────────────────────────── Les tableaux ───────────────────────────

interface CelluleComposee {
  cellule: Cellule;
  x: number;
  largeur: number;
  contenu: BoiteFixe;
  /** Nombre de rangées couvertes (fusion verticale). */
  rangs: number;
  suite: boolean;
  bas: Bordure | null;
}
interface TableauCompose {
  decalage: number;
  rangees: { hauteur: number; filetHaut: number; entete: boolean; cellules: CelluleComposee[] }[];
  /** Vrai quand la rangée continue une fusion commencée plus haut : on ne coupe pas la page devant elle. */
  soudee: boolean[];
}

function composerTableau(t: Tableau, largeur: number, ctx: Ctx): TableauCompose {
  let parLargeur = ctx.tableaux.get(t);
  if (!parLargeur) { parLargeur = new Map(); ctx.tableaux.set(t, parLargeur); }
  const cle = Math.round(largeur * 100);
  const deja = parLargeur.get(cle);
  if (deja) return deja;

  const nbCols = Math.max(1, ...t.rangees.map((r) => r.cellules.reduce((m, c) => Math.max(m, c.colonne + c.span), 0)));
  let grille = t.grille.slice(0, Math.max(nbCols, t.grille.length));
  if (grille.length < nbCols || grille.some((w) => !(w > 0))) {
    const simple = t.rangees.every((r) => r.cellules.every((c) => c.span === 1) && r.cellules.length === nbCols);
    grille = simple
      ? columnWidths(t.rangees.map((r) => r.cellules.map((c) => texteBrut(c.blocs))), largeur)
      : Array.from({ length: nbCols }, () => largeur / nbCols);
  }
  let total = grille.reduce((a, b) => a + b, 0);
  // Un tableau un peu plus large que la zone de texte déborde dans la marge, comme dans Word ;
  // un tableau taillé pour une autre page est ramené à la largeur disponible.
  if (total > largeur + 24) {
    const k = largeur / total;
    grille = grille.map((w) => w * k);
    total = largeur;
  }
  const decalage = t.alignement === "center" ? (largeur - total) / 2 : t.alignement === "right" ? largeur - total : t.retrait;
  const debutCol = (c: number) => grille.slice(0, c).reduce((a, b) => a + b, 0);
  const largeurCols = (c: number, n: number) => grille.slice(c, c + n).reduce((a, b) => a + b, 0);

  const rangees: TableauCompose["rangees"] = t.rangees.map((r) => ({
    hauteur: 0,
    filetHaut: 0,
    entete: r.entete,
    cellules: r.cellules.map((c) => {
      const w = largeurCols(c.colonne, c.span);
      const contenu = c.fusionV === "suite"
        ? { hauteur: 0, corps: [], derriere: [], devant: [] }
        : composerBlocsFixe(c.blocs, Math.max(1, w - c.marges.gauche - c.marges.droite), ctx, true);
      return { cellule: c, x: debutCol(c.colonne), largeur: w, contenu, rangs: 1, suite: c.fusionV === "suite", bas: c.bordures.bas };
    }),
  }));
  // Les fusions verticales : une cellule « début » couvre les « suite » de même colonne en dessous.
  rangees.forEach((rg, r) => {
    for (const cc of rg.cellules) {
      if (cc.cellule.fusionV !== "debut") continue;
      let k = 1;
      while (r + k < rangees.length) {
        const sous = rangees[r + k]!.cellules.find((x) => x.cellule.colonne === cc.cellule.colonne && x.suite);
        if (!sous) break;
        cc.bas = sous.cellule.bordures.bas;
        k += 1;
      }
      cc.rangs = k;
    }
  });
  // Le filet du HAUT de chaque rangée (et celui du bas de la dernière) prend sa place dans la
  // hauteur, comme dans Word : mesuré, une rangée d'une ligne en 11 pt sous un filet de ½ pt
  // fait 13,9 pt, pas 13,4.
  const epaisseur = (b: Bordure | null) => (b ? (b.style === "double" ? b.epaisseurPt * 3 : b.epaisseurPt) : 0);
  t.rangees.forEach((r, i) => {
    const rg = rangees[i]!;
    rg.filetHaut = Math.max(0, ...rg.cellules.filter((c) => !c.suite).map((c) => epaisseur(c.cellule.bordures.haut)));
    const filetBas = i === t.rangees.length - 1 ? Math.max(0, ...rg.cellules.map((c) => epaisseur(c.bas))) : 0;
    let h = 0;
    for (const cc of rg.cellules) {
      if (cc.suite || cc.rangs > 1) continue;
      h = Math.max(h, cc.contenu.hauteur + cc.cellule.marges.haut + cc.cellule.marges.bas);
    }
    h += rg.filetHaut + filetBas;
    if (r.hauteur?.regle === "exact") h = r.hauteur.valeur;
    else if (r.hauteur) h = Math.max(h, r.hauteur.valeur);
    rg.hauteur = Math.max(h, 1);
  });
  // Une cellule fusionnée plus haute que ses rangées agrandit la DERNIÈRE de ces rangées.
  rangees.forEach((rg, r) => {
    for (const cc of rg.cellules) {
      if (cc.rangs <= 1) continue;
      const besoin = cc.contenu.hauteur + cc.cellule.marges.haut + cc.cellule.marges.bas + rg.filetHaut;
      const dispo = rangees.slice(r, r + cc.rangs).reduce((s, x) => s + x.hauteur, 0);
      if (besoin > dispo) rangees[r + cc.rangs - 1]!.hauteur += besoin - dispo;
    }
  });
  const soudee = rangees.map(() => false);
  rangees.forEach((rg, r) => { for (const cc of rg.cellules) for (let k = 1; k < cc.rangs; k++) soudee[r + k] = true; });
  const res = { decalage, rangees, soudee };
  parLargeur.set(cle, res);
  return res;
}

function texteBrut(blocs: readonly Bloc[]): string {
  return blocs.map((b) => (b.type === "paragraphe" ? b.contenu.map((c) => (c.k === "texte" ? c.texte : c.k === "tab" ? " " : "")).join("") : "")).join(" ");
}

// ─────────────────────────── Le flux ───────────────────────────

interface Cible { corps: Trace[]; derriere: Trace[]; devant: Trace[] }
interface Zone { gauche: number; largeur: number; haut: number; bas: number }
interface Precedent { apres: number; apresAuto: boolean; styleId: string | null; contextuel: boolean }
export interface BoiteFixe extends Cible { hauteur: number; ancres?: { x: number; y: number; largeur: number; hauteur: number; ax: boolean; ay: boolean; ancre: Ancre }[] }

/**
 * LE FLUX : il pose les blocs les uns sous les autres. Paginé (le corps du document), il change de
 * page quand la place manque ; fixe (une cellule, un en-tête, une zone de texte), il ne fait que
 * mesurer et empiler, à partir de (0, 0).
 */
class Flux {
  y: number;
  surPage = false;
  precedent: Precedent | null = null;
  ancres: NonNullable<BoiteFixe["ancres"]> = [];

  /** La page courante ouvre une section (ou le document) : l'espace avant y est conservé. */
  debutSection = true;

  constructor(
    private readonly ctx: Ctx,
    public zone: Zone,
    public cible: Cible,
    private readonly changer: (() => { zone: Zone; cible: Cible; debutSection: boolean }) | null,
  ) {
    this.y = zone.haut;
  }

  get pagine(): boolean { return this.changer !== null; }

  nouvellePage(): void {
    if (!this.changer) return;
    const n = this.changer();
    this.zone = n.zone;
    this.cible = n.cible;
    this.debutSection = n.debutSection;
    this.y = n.zone.haut;
    this.surPage = false;
    this.precedent = null;
  }

  placerBlocs(blocs: readonly Bloc[], cellule: boolean): void {
    blocs.forEach((b, k) => {
      if (b.type === "paragraphe") this.placerParagraphe(b, blocs[k + 1], cellule && k === 0, cellule && k === blocs.length - 1);
      else this.placerTableau(b);
    });
  }

  private espaceAvant(p: Paragraphe, premierDeCellule: boolean): number {
    // En tête d'une page ouverte par un saut (manuel ou naturel), Word SUPPRIME l'espace avant —
    // mesuré : le titre de la page 2 d'un rapport tombe sur la marge haute, pas 12 pt plus bas.
    if (this.pagine && !this.surPage && !this.debutSection) return 0;
    let avant = premierDeCellule && p.pp.avantAuto ? 0 : p.pp.avant;
    const prec = this.precedent;
    if (!prec) return avant;
    let apres = prec.apres;
    if (p.pp.espacementContextuel && prec.styleId === p.pp.styleId) avant = 0;
    if (prec.contextuel && prec.styleId === p.pp.styleId) apres = 0;
    // L'espacement automatique se comporte comme les marges HTML : il FUSIONNE.
    if (prec.apresAuto && p.pp.avantAuto) return Math.max(apres, avant);
    return apres + avant;
  }

  /** La hauteur à garder avec un paragraphe « lié au suivant » : le début du bloc suivant. */
  private hauteurDebut(b: Bloc | undefined, profondeur = 0): number {
    if (!b || profondeur > 3) return 0;
    if (b.type === "tableau") {
      const t = composerTableau(b, this.zone.largeur, this.ctx);
      return t.rangees[0]?.hauteur ?? 0;
    }
    const l = composerParagraphe(b, this.zone.largeur, this.ctx);
    return b.pp.avant + (l[0]?.hauteur ?? 0);
  }

  private placerParagraphe(p: Paragraphe, suivant: Bloc | undefined, premierDeCellule: boolean, dernierDeCellule: boolean): void {
    let lignes = composerParagraphe(p, this.zone.largeur, this.ctx);
    // Les filets haut et bas d'un paragraphe prennent leur place (épaisseur + `w:space`) : on
    // l'ajoute à la première et à la dernière ligne, la pagination en tient compte d'elle-même.
    const { haut: bh, bas: bb } = p.pp.bordures;
    const extraHaut = bh ? bh.epaisseurPt + bh.espacePt : 0;
    const extraBas = bb ? bb.epaisseurPt + bb.espacePt : 0;
    if (extraHaut || extraBas) {
      lignes = lignes.map((l, i) => {
        let hauteur = l.hauteur;
        let traces = l.traces;
        if (i === 0 && extraHaut) { hauteur += extraHaut; traces = deplacer(traces, 0, extraHaut); }
        if (i === lignes.length - 1 && extraBas) hauteur += extraBas;
        return { ...l, hauteur, traces };
      });
    }
    if (this.pagine && p.pp.sautAvant && this.surPage) this.nouvellePage();
    let avant = this.espaceAvant(p, premierDeCellule);
    const total = lignes.reduce((s, l) => s + l.hauteur, 0);
    const hauteurPage = this.zone.bas - this.zone.haut;
    if (this.pagine && this.surPage) {
      let besoin = 0;
      if (p.pp.garderAvecSuivant && lignes.length <= 3) besoin = avant + total + this.hauteurDebut(suivant);
      else if (p.pp.garderLignes) besoin = avant + total;
      if (besoin > 0 && this.y + besoin > this.zone.bas + 0.01 && besoin <= hauteurPage) {
        this.nouvellePage();
        avant = this.espaceAvant(p, premierDeCellule);
      }
    }
    this.y += avant;

    // Les objets ancrés suivent la page où tombe la première ligne.
    const poserAncres = (yPara: number) => {
      for (const a of p.ancres) {
        const pos = positionner(a, this.ctx.geo, this.zone, yPara);
        const tr = tracesGraphiques(a.contenu, pos.x, pos.y, this.ctx, { ax: pos.ax, ay: pos.ay });
        (a.derriere ? this.cible.derriere : this.cible.devant).push(...tr);
        this.ancres.push({ x: pos.x, y: pos.y, largeur: a.largeur, hauteur: a.hauteur, ax: pos.ax, ay: pos.ay, ancre: a });
      }
    };

    let i = 0;
    let premiereSurPage = true;
    while (i < lignes.length) {
      let k = lignes.length - i;
      if (this.pagine) {
        k = 0;
        let yy = this.y;
        while (i + k < lignes.length && yy + lignes[i + k]!.hauteur <= this.zone.bas + 0.01) {
          yy += lignes[i + k]!.hauteur;
          k += 1;
          if (lignes[i + k - 1]!.sautPage) break;
        }
        const force = k > 0 && lignes[i + k - 1]!.sautPage;
        if (!force && i + k < lignes.length && p.pp.veuves && lignes.length >= 2) {
          if (i === 0 && k === 1 && this.surPage) k = 0; // orpheline : la première ligne seule en bas de page
          else if (lignes.length - (i + k) === 1 && k >= 2) k -= 1; // veuve : la dernière ligne seule en haut
        }
        if (k === 0 && !this.surPage) k = 1; // une ligne plus haute que la page : posée quand même
        if (k === 0) {
          this.nouvellePage();
          continue;
        }
      }
      const debutSegment = this.cible.corps.length;
      const ySegment = this.y;
      if (i === 0 && premiereSurPage) poserAncres(ySegment);
      premiereSurPage = false;
      for (let n = 0; n < k; n++) {
        const l = lignes[i + n]!;
        this.cible.corps.push(...deplacer(l.traces, this.zone.gauche, this.y));
        this.y += l.hauteur;
      }
      this.surPage = true;
      this.decorer(p, debutSegment, ySegment, this.y, i === 0, i + k === lignes.length);
      i += k;
      const dernierePosee = lignes[i - 1]!;
      if (i <= lignes.length && dernierePosee.sautPage && this.pagine) this.nouvellePage();
      else if (i < lignes.length && this.pagine) this.nouvellePage();
    }
    this.precedent = {
      apres: dernierDeCellule && p.pp.apresAuto ? 0 : p.pp.apres,
      apresAuto: p.pp.apresAuto,
      styleId: p.pp.styleId,
      contextuel: p.pp.espacementContextuel,
    };
  }

  /** La trame et les bordures d'un paragraphe, sur le morceau posé dans cette page. */
  private decorer(p: Paragraphe, debut: number, y0: number, y1: number, premier: boolean, dernier: boolean): void {
    const pp = p.pp;
    const x0 = this.zone.gauche + pp.retraitGauche;
    const x1 = this.zone.gauche + this.zone.largeur - pp.retraitDroit;
    if (pp.fond) this.cible.corps.splice(debut, 0, { t: "rect", x: x0, y: y0, largeur: x1 - x0, hauteur: y1 - y0, fond: pp.fond, trait: null, forme: "rect" });
    const b = pp.bordures;
    const ligne = (bd: Bordure, xa: number, ya: number, xb: number, yb: number) => this.cible.corps.push({ t: "ligne", x1: xa, y1: ya, x2: xb, y2: yb, couleur: bd.couleur, epaisseur: bd.epaisseurPt, style: bd.style });
    if (b.haut && premier) ligne(b.haut, x0, y0 + b.haut.epaisseurPt / 2, x1, y0 + b.haut.epaisseurPt / 2);
    if (b.bas && dernier) ligne(b.bas, x0, y1 - b.bas.epaisseurPt / 2, x1, y1 - b.bas.epaisseurPt / 2);
    if (b.gauche) ligne(b.gauche, x0 - b.gauche.espacePt - b.gauche.epaisseurPt / 2, y0, x0 - b.gauche.espacePt - b.gauche.epaisseurPt / 2, y1);
    if (b.droite) ligne(b.droite, x1 + b.droite.espacePt + b.droite.epaisseurPt / 2, y0, x1 + b.droite.espacePt + b.droite.epaisseurPt / 2, y1);
  }

  private placerTableau(t: Tableau): void {
    const tc = composerTableau(t, this.zone.largeur, this.ctx);
    if (this.precedent) this.y += this.precedent.apres;
    this.precedent = null;
    const nbEntetes = (() => { let n = 0; while (n < tc.rangees.length && tc.rangees[n]!.entete) n += 1; return n; })();
    for (let r = 0; r < tc.rangees.length; r++) {
      if (this.pagine && this.surPage && !tc.soudee[r]) {
        let fin = r;
        for (let k = r; k <= fin && k < tc.rangees.length; k++) for (const cc of tc.rangees[k]!.cellules) fin = Math.max(fin, k + cc.rangs - 1);
        const besoin = tc.rangees.slice(r, fin + 1).reduce((s, x) => s + x.hauteur, 0);
        if (this.y + besoin > this.zone.bas + 0.01) {
          this.nouvellePage();
          if (r >= nbEntetes) for (let e = 0; e < nbEntetes; e++) this.dessinerRangee(tc, e);
        }
      }
      this.dessinerRangee(tc, r);
    }
  }

  private dessinerRangee(tc: TableauCompose, r: number): void {
    const rg = tc.rangees[r]!;
    const x0 = this.zone.gauche + tc.decalage;
    const y = this.y;
    const cellules = rg.cellules.filter((c) => !c.suite);
    const hauteurDe = (cc: CelluleComposee) => tc.rangees.slice(r, r + cc.rangs).reduce((s, x) => s + x.hauteur, 0);
    for (const cc of cellules) {
      if (cc.cellule.fond) this.cible.corps.push({ t: "rect", x: x0 + cc.x, y, largeur: cc.largeur, hauteur: hauteurDe(cc), fond: cc.cellule.fond, trait: null, forme: "rect" });
    }
    for (const cc of cellules) {
      const c = cc.cellule;
      const h = hauteurDe(cc);
      const libre = h - rg.filetHaut - c.marges.haut - c.marges.bas - cc.contenu.hauteur;
      const oy = libre > 0 ? (c.alignV === "centre" ? libre / 2 : c.alignV === "bas" ? libre : 0) : 0;
      const dx = x0 + cc.x + c.marges.gauche;
      const dy = y + rg.filetHaut + c.marges.haut + oy;
      this.cible.derriere.push(...deplacer(cc.contenu.derriere, dx, dy));
      this.cible.corps.push(...deplacer(cc.contenu.corps, dx, dy));
      this.cible.devant.push(...deplacer(cc.contenu.devant, dx, dy));
    }
    for (const cc of cellules) {
      const b = cc.cellule.bordures;
      const x = x0 + cc.x;
      const h = hauteurDe(cc);
      const ligne = (bd: Bordure | null, xa: number, ya: number, xb: number, yb: number) => {
        if (bd) this.cible.corps.push({ t: "ligne", x1: xa, y1: ya, x2: xb, y2: yb, couleur: bd.couleur, epaisseur: bd.epaisseurPt, style: bd.style });
      };
      ligne(b.haut, x, y, x + cc.largeur, y);
      ligne(cc.bas, x, y + h, x + cc.largeur, y + h);
      ligne(b.gauche, x, y, x, y + h);
      ligne(b.droite, x + cc.largeur, y, x + cc.largeur, y + h);
    }
    this.y += rg.hauteur;
    this.surPage = true;
  }
}

/** Compose des blocs HORS pagination (cellule, bande, zone de texte), à partir de (0, 0). */
function composerBlocsFixe(blocs: readonly Bloc[], largeur: number, ctx: Ctx, cellule: boolean): BoiteFixe {
  const cible: Cible = { corps: [], derriere: [], devant: [] };
  const f = new Flux(ctx, { gauche: 0, largeur, haut: 0, bas: Number.POSITIVE_INFINITY }, cible, null);
  f.placerBlocs(blocs, cellule);
  return { hauteur: f.y + (f.precedent?.apres ?? 0), ...cible, ancres: f.ancres };
}

// ─────────────────────────── Le document ───────────────────────────

/**
 * LES PAGES DU DOCUMENT. Chaque page reçoit son en-tête et son pied (première page, pages paires
 * selon la section), et la zone du corps se règle sur eux.
 */
export function composerDocument(d: DocumentDocx, mes: Mesureur): PageComposee[] {
  const premiere = d.sections[0]!.section;
  const geoDe = (s: Section, haut = s.marges.haut, bas = s.hauteur - s.marges.bas): Geo => ({ largeur: s.largeur, hauteur: s.hauteur, marges: s.marges, texte: { haut, bas } });
  const ctx: Ctx = {
    mes,
    tabDefaut: d.tabDefaut,
    geo: geoDe(premiere),
    paragraphes: new WeakMap(),
    tableaux: new WeakMap(),
  };
  const pages: PageComposee[] = [];
  let section = premiere;
  let indexDansSection = 0;
  let numero = 1;
  // Une bande se compose pour une géométrie donnée : ses objets ancrés « à la marge » dépendent de
  // la zone de texte effective, qui dépend elle-même de la hauteur des bandes de la page.
  const bandes = new WeakMap<Bande, Map<string, BoiteFixe>>();
  const composerBande = (b: Bande, s: Section, largeur: number): BoiteFixe => {
    let m = bandes.get(b);
    if (!m) { m = new Map(); bandes.set(b, m); }
    const cle = `${s.largeur}|${s.hauteur}|${largeur}|${ctx.geo.texte.haut}|${ctx.geo.texte.bas}`;
    const deja = m.get(cle);
    if (deja) return deja;
    const c = composerBlocsFixe(b.blocs, largeur, ctx, false);
    m.set(cle, c);
    return c;
  };

  const ouvrirPage = (): { zone: Zone; cible: Cible; debutSection: boolean } => {
    const s = section;
    const debutSection = indexDansSection === 0;
    if (indexDansSection === 0 && s.debutNumero != null) numero = s.debutNumero;
    const choisir = (v: Section["entetes"]): Bande | null =>
      s.titrePage && indexDansSection === 0 ? v.premiere ?? null : d.pairesImpaires && numero % 2 === 0 ? v.paire ?? null : v.defaut ?? null;
    const largeurTexte = s.largeur - s.marges.gauche - s.marges.droite;
    const page: PageComposee = { largeur: s.largeur, hauteur: s.hauteur, numero, formatNumero: s.formatNumero, derriere: [], bandes: [], corps: [], devant: [] };
    const entete = choisir(s.entetes);
    const pied = choisir(s.pieds);
    // 1. La hauteur des bandes (elle ne dépend pas de la géométrie) → la zone de texte effective.
    ctx.geo = geoDe(s);
    const hEntete = entete ? composerBande(entete, s, largeurTexte).hauteur : 0;
    const hPied = pied ? composerBande(pied, s, largeurTexte).hauteur : 0;
    let haut = s.marges.haut;
    let bas = s.hauteur - s.marges.bas;
    if (entete && !s.hautExact && hEntete > 0) haut = Math.max(haut, s.marges.entete + hEntete);
    if (pied && !s.basExact && hPied > 0) bas = Math.min(bas, s.hauteur - s.marges.pied - hPied);
    if (bas - haut < 72) { haut = s.marges.haut; bas = s.hauteur - s.marges.bas; }
    // 2. Les bandes composées dans CETTE géométrie, posées sur la page.
    ctx.geo = geoDe(s, haut, bas);
    const habillages: { x: number; y: number; largeur: number; hauteur: number }[] = [];
    const poserBande = (b: Bande | null, genre: "entete" | "pied") => {
      if (!b) return;
      const c = composerBande(b, s, largeurTexte);
      const oy = genre === "entete" ? s.marges.entete : s.hauteur - s.marges.pied - c.hauteur;
      page.bandes.push(...deplacer(c.derriere, s.marges.gauche, oy), ...deplacer(c.corps, s.marges.gauche, oy), ...deplacer(c.devant, s.marges.gauche, oy));
      for (const a of c.ancres ?? []) {
        if (a.ancre.derriere || a.ancre.habillage === "none") continue;
        habillages.push({ x: a.ax ? a.x : a.x + s.marges.gauche, y: a.ay ? a.y : a.y + oy, largeur: a.largeur, hauteur: a.hauteur });
      }
    };
    poserBande(entete, "entete");
    poserBande(pied, "pied");
    // Une image d'en-tête ou de pied HABILLÉE qui couvre la zone de texte la limite (Word renvoie
    // le texte autour) ; un objet « derrière le texte » ou sans habillage ne la touche pas.
    const [hautTexte, basTexte] = [haut, bas];
    for (const h of habillages) {
      const recouvre = Math.min(h.x + h.largeur, s.largeur - s.marges.droite) - Math.max(h.x, s.marges.gauche);
      if (recouvre < largeurTexte * 0.5) continue;
      if (h.y + h.hauteur / 2 < s.hauteur / 2) haut = Math.max(haut, h.y + h.hauteur);
      else bas = Math.min(bas, h.y);
    }
    if (bas - haut < 72) { haut = hautTexte; bas = basTexte; }
    pages.push(page);
    indexDansSection += 1;
    numero += 1;
    return { zone: { gauche: s.marges.gauche, largeur: largeurTexte, haut, bas }, cible: { corps: page.corps, derriere: page.derriere, devant: page.devant }, debutSection };
  };

  let flux: Flux | null = null;
  for (const { section: s, blocs } of d.sections) {
    const changement = section !== s;
    section = s;
    if (!flux) {
      indexDansSection = 0;
      const p = ouvrirPage();
      flux = new Flux(ctx, p.zone, p.cible, () => ouvrirPage());
    } else if (changement && s.type !== "continuous") {
      indexDansSection = 0;
      flux.nouvellePage();
    } else if (changement) {
      ctx.geo = geoDe(s, ctx.geo.texte.haut, ctx.geo.texte.bas);
      flux.zone = { ...flux.zone, gauche: s.marges.gauche, largeur: s.largeur - s.marges.gauche - s.marges.droite };
    }
    flux.placerBlocs(blocs, false);
  }
  return pages;
}
