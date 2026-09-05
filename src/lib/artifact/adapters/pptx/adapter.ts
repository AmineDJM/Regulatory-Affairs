/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ADAPTATEUR POWERPOINT (§14) — texte, mise en forme, position, taille, diapositives.
 *
 * ── CE QUI SURVIT, ET POURQUOI C'EST LE SUJET ──────────────────────────────────────────
 *
 * Un `.pptx` d'entreprise porte un MASQUE (`slideMaster`) et des DISPOSITIONS (`slideLayout`)
 * qui définissent la charte : logo, couleurs, polices, pied de page. Une bibliothèque qui
 * regénère la présentation (pptxgenjs, par exemple) écrit ses propres masques — et la
 * présentation revient aux couleurs de la bibliothèque. Personne ne demande jamais cela.
 *
 * On modifie donc `ppt/slides/slideN.xml` en place, et tout le reste — masques, dispositions,
 * thèmes, médias, animations, notes — est recopié sans être lu.
 *
 * ── LES UNITÉS ─────────────────────────────────────────────────────────────────────────
 *
 * PowerPoint place tout en EMU. « Décale le titre d'un centimètre vers la gauche » se traduit
 * par `x -= 360 000`. La conversion est dans `object-model/model.ts`, en un seul endroit, et
 * l'adaptateur ne manipule jamais un EMU nu venu d'ailleurs.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import PizZip from "pizzip";
import type { Alignment, PptxModel, ShapeNode, SlideNode, TextStyle } from "@/lib/artifact/object-model/model";
import { STYLE_NEUTRE, cmEnEmu, emuEnCm } from "@/lib/artifact/object-model/model";
import { abreger } from "@/lib/artifact/object-model/text";
import type { CommandeArtefact } from "@/lib/artifact/commands/ir";
import { resoudre } from "@/lib/artifact/commands/resolve";
import type { AdaptateurArtefact, DocumentOuvert, EffetCommande, Validation } from "@/lib/artifact/adapters/contract";
import { effetEchec, effetOk } from "@/lib/artifact/adapters/contract";
import type { XmlNode } from "@/lib/artifact/object-model/xml";
import {
  attr, child, children, cloneNode, descendants, element, ensureChild, firstDescendant,
  markDirty, parseXml, removeChild, serializeXml, setAttr, textNode, textOf,
} from "@/lib/artifact/object-model/xml";

export const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const ALIGN_PPTX: Record<Alignment, string> = { left: "l", center: "ctr", right: "r", justify: "just" };
const ALIGN_MODELE: Record<string, Alignment> = { l: "left", ctr: "center", r: "right", just: "justify", dist: "justify" };

/** Ordre imposé pour les enfants de `a:rPr` — le violer rend la diapositive illisible. */
const ORDRE_RPR = ["a:ln", "a:noFill", "a:solidFill", "a:gradFill", "a:effectLst", "a:latin", "a:ea", "a:cs"];

interface Diapo {
  chemin: string;
  racine: XmlNode;
  /** L'arbre des formes (`p:spTree`) — tout ce qui est visible en descend. */
  spTree: XmlNode;
}

/** Le rôle d'une forme, tel qu'un humain le nommerait. */
function roleDeForme(sp: XmlNode): ShapeNode["role"] {
  if (sp.name === "p:pic") return "picture";
  if (sp.name === "p:graphicFrame") {
    const uri = firstDescendant(sp, "a:graphicData");
    const u = uri ? attr(uri, "uri") ?? "" : "";
    if (u.includes("table")) return "table";
    if (u.includes("chart")) return "chart";
    return "other";
  }
  if (sp.name === "p:sp") return "text";
  return "other";
}

function lireStyleForme(sp: XmlNode): { style: TextStyle; align: Alignment | null } {
  // Le premier `a:rPr` non vide donne le ton de la forme — c'est ce qu'on affiche et ce qu'on
  // rapporte à la personne quand elle demande « il est en quelle taille, ce titre ? ».
  const rPr = descendants(sp, "a:rPr")[0] ?? null;
  const style: TextStyle = { ...STYLE_NEUTRE };
  if (rPr) {
    style.bold = attr(rPr, "b") === "1";
    style.italic = attr(rPr, "i") === "1";
    style.underline = Boolean(attr(rPr, "u") && attr(rPr, "u") !== "none");
    const sz = Number(attr(rPr, "sz"));
    // PowerPoint compte les tailles en CENTIÈMES de point : `sz="1600"` vaut 16 pt.
    style.sizePt = Number.isFinite(sz) && sz > 0 ? sz / 100 : null;
    const latin = child(rPr, "a:latin");
    style.font = latin ? attr(latin, "typeface") : null;
    const srgb = firstDescendant(rPr, "a:srgbClr");
    style.color = srgb ? (attr(srgb, "val") ?? "").toUpperCase() || null : null;
  }
  const pPr = descendants(sp, "a:pPr")[0] ?? null;
  const algn = pPr ? attr(pPr, "algn") : null;
  return { style, align: algn ? ALIGN_MODELE[algn] ?? null : null };
}

function lireForme(sp: XmlNode, slide: number, index: number): ShapeNode {
  const xfrm = firstDescendant(sp, "a:xfrm");
  const off = xfrm ? child(xfrm, "a:off") : null;
  const ext = xfrm ? child(xfrm, "a:ext") : null;
  const nv = firstDescendant(sp, "p:cNvPr");
  const { style, align } = lireStyleForme(sp);
  const nombre = (el: XmlNode | null, a: string): number => {
    if (!el) return 0;
    const v = Number(attr(el, a));
    return Number.isFinite(v) ? emuEnCm(v) : 0;
  };
  // Les `a:t` sont les fragments de texte ; on insère un saut par paragraphe.
  const texte = children(firstDescendant(sp, "p:txBody") ?? element("x"), "a:p")
    .map((p) => descendants(p, "a:t").map(textOf).join(""))
    .join("\n")
    .trim();
  return {
    id: `s${slide}.sh${index}`,
    index,
    name: nv ? attr(nv, "name") ?? `Forme ${index}` : `Forme ${index}`,
    xCm: nombre(off, "x"), yCm: nombre(off, "y"),
    widthCm: nombre(ext, "cx"), heightCm: nombre(ext, "cy"),
    text: texte, style, alignment: align, role: roleDeForme(sp),
  };
}

/** Une forme de TITRE se reconnaît à son `p:ph type="title"` (ou `ctrTitle`). */
function estTitre(sp: XmlNode): boolean {
  const ph = firstDescendant(sp, "p:ph");
  const t = ph ? attr(ph, "type") : null;
  return t === "title" || t === "ctrTitle";
}

class PptxOuvert implements DocumentOuvert {
  format = "PPTX" as const;
  private modeleCache: PptxModel | null = null;

  constructor(
    private zip: PizZip,
    private presentation: XmlNode,
    private diapos: Diapo[],
    private largeurCm: number,
    private hauteurCm: number,
  ) {}

  /** Les formes d'une diapositive, dans l'ordre de dessin (l'ordre où PowerPoint les empile). */
  private formesXml(d: Diapo): XmlNode[] {
    return d.spTree.children.filter(
      (c) => c.type === "element" && ["p:sp", "p:pic", "p:graphicFrame", "p:grpSp", "p:cxnSp"].includes(c.name),
    );
  }

  modele(): PptxModel {
    if (this.modeleCache) return this.modeleCache;
    const slides: SlideNode[] = this.diapos.map((d, i) => {
      const shapes = this.formesXml(d).map((sp, k) => lireForme(sp, i + 1, k + 1));
      const titre = this.formesXml(d).findIndex(estTitre);
      return {
        id: `s${i + 1}`,
        index: i + 1,
        title: (titre >= 0 ? shapes[titre]?.text : shapes.find((s) => s.text)?.text) ?? "",
        shapes,
      };
    });
    this.modeleCache = { kind: "PPTX", slides, slideWidthCm: this.largeurCm, slideHeightCm: this.hauteurCm };
    return this.modeleCache;
  }

  appliquer(c: CommandeArtefact): EffetCommande {
    const effet = this.executer(c);
    if (effet.ok) this.modeleCache = null;
    return effet;
  }

  private executer(c: CommandeArtefact): EffetCommande {
    const n = this.diapos.length;
    if (c.diapo !== null && (c.diapo < 1 || c.diapo > n)) {
      return effetEchec(`cette présentation a ${n} diapositive${n > 1 ? "s" : ""} ; il n'y a pas de diapositive ${c.diapo}`);
    }
    switch (c.op) {
      case "pptx.texte": return this.texte(c);
      case "pptx.format_texte": return this.formatTexte(c);
      case "pptx.deplacer": return this.geometrie(c, "relatif");
      case "pptx.position": return this.geometrie(c, "absolu");
      case "pptx.taille": return this.geometrie(c, "taille");
      case "pptx.supprimer_forme": return this.supprimerForme(c);
      case "pptx.supprimer_diapo": return this.supprimerDiapo(c);
      case "pptx.deplacer_diapo": return this.deplacerDiapo(c);
      case "pptx.dupliquer_diapo": return this.dupliquerDiapo(c);
      case "pptx.ajouter_diapo": return this.ajouterDiapo(c);
      default: return effetEchec(`opération « ${c.op} » non gérée par l'adaptateur PowerPoint`);
    }
  }

  /** Résout une forme sur la diapositive visée. */
  private ciblerForme(c: CommandeArtefact) {
    const i = (c.diapo ?? 1) - 1;
    const d = this.diapos[i];
    if (!d) return { ok: false as const, echec: effetEchec(`il n'y a pas de diapositive ${c.diapo}`) };
    const xml = this.formesXml(d);
    const modeles = this.modele().slides[i]?.shapes ?? [];
    const designables = xml.map((sp, k) => ({
      id: modeles[k]?.id ?? `s${i + 1}.sh${k + 1}`,
      index: k + 1,
      texte: `${modeles[k]?.name ?? ""} ${modeles[k]?.text ?? ""}`.trim(),
      noeud: sp,
      modele: modeles[k],
    }));
    const r = resoudre(c.cible, designables, { libelle: "forme", estTitre: (x) => estTitre(x.noeud) });
    if (r.etat === "TROUVE") return { ok: true as const, d, forme: r.objet };
    const candidats = r.etat === "AMBIGU"
      ? r.candidats.map((x) => ({ id: x.id, libelle: `${x.modele?.name ?? `forme ${x.index}`} — ${abreger(x.modele?.text ?? "", 30)}` }))
      : [];
    return { ok: false as const, echec: effetEchec(r.motif, candidats) };
  }

  private texte(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerForme(c);
    if (!t.ok) return t.echec;
    const body = firstDescendant(t.forme.noeud, "p:txBody");
    if (!body) return effetEchec("cette forme ne contient pas de texte modifiable");
    const paras = children(body, "a:p");
    if (paras.length === 0) return effetEchec("cette forme n'a aucun paragraphe");
    // On garde le PREMIER paragraphe comme gabarit — il porte la mise en forme de la forme — et
    // on en clone un par ligne du nouveau texte. Le style survit ; le contenu change.
    const gabarit = cloneNode(paras[0]);
    for (const p of paras.slice(1)) removeChild(body, p);
    const lignes = (c.texte ?? "").split("\n");
    ecrireTexteParagraphe(paras[0], lignes[0] ?? "");
    let precedent = paras[0];
    for (const ligne of lignes.slice(1)) {
      const copie = cloneNode(gabarit, body);
      copie.raw = null;
      ecrireTexteParagraphe(copie, ligne);
      const i = body.children.indexOf(precedent);
      body.children.splice(i + 1, 0, copie);
      markDirty(body);
      precedent = copie;
    }
    return effetOk(`Diapo ${c.diapo}, ${t.forme.modele?.name ?? "forme"} → « ${abreger(c.texte ?? "", 40)} ».`, [t.forme.id]);
  }

  private formatTexte(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerForme(c);
    if (!t.ok) return t.echec;
    const body = firstDescendant(t.forme.noeud, "p:txBody");
    if (!body) return effetEchec("cette forme ne contient pas de texte");
    for (const p of children(body, "a:p")) {
      if (c.alignement !== null) {
        setAttr(ensureChild(p, "a:pPr", []), "algn", ALIGN_PPTX[c.alignement as Alignment]);
      }
      const runs = children(p, "a:r");
      // Sur un paragraphe vide, `a:endParaRPr` gouverne ce qu'on tapera ensuite : le styler aussi
      // évite qu'une ligne ajoutée après coup revienne à la police du masque.
      const cibles = runs.length ? runs.map((r) => ensureChild(r, "a:rPr", [])) : [ensureChild(p, "a:endParaRPr", [])];
      for (const rPr of cibles) appliquerStyleRun(rPr, c);
    }
    const dits = [
      c.taillePt !== null ? `${c.taillePt} pt` : "",
      c.police ?? "",
      c.gras === true ? "gras" : c.gras === false ? "sans gras" : "",
      c.italique === true ? "italique" : "",
      c.couleur !== null ? `#${c.couleur}` : "",
      c.alignement !== null ? c.alignement : "",
    ].filter(Boolean).join(", ");
    return effetOk(`Diapo ${c.diapo}, ${t.forme.modele?.name ?? "forme"} → ${dits}.`, [t.forme.id]);
  }

  private geometrie(c: CommandeArtefact, mode: "relatif" | "absolu" | "taille"): EffetCommande {
    const t = this.ciblerForme(c);
    if (!t.ok) return t.echec;
    const sp = t.forme.noeud;
    let xfrm = firstDescendant(sp, "a:xfrm");
    if (!xfrm) {
      // Une forme placée par sa DISPOSITION n'a pas de `a:xfrm` propre : on en crée un aux
      // coordonnées que le modèle a lues, sans quoi la déplacer la renverrait en (0,0).
      const spPr = firstDescendant(sp, "p:spPr") ?? firstDescendant(sp, "p:grpSpPr");
      if (!spPr) return effetEchec("cette forme n'a pas de géométrie modifiable");
      xfrm = element("a:xfrm", {}, [
        element("a:off", { x: String(cmEnEmu(t.forme.modele?.xCm ?? 0)), y: String(cmEnEmu(t.forme.modele?.yCm ?? 0)) }),
        element("a:ext", { cx: String(cmEnEmu(t.forme.modele?.widthCm ?? 5)), cy: String(cmEnEmu(t.forme.modele?.heightCm ?? 2)) }),
      ]);
      xfrm.parent = spPr;
      spPr.children.unshift(xfrm);
      markDirty(spPr);
    }
    const off = ensureChild(xfrm, "a:off", []);
    const ext = ensureChild(xfrm, "a:ext", []);
    const lireEmu = (el: XmlNode, a: string, defaut = 0): number => {
      const v = Number(attr(el, a));
      return Number.isFinite(v) ? v : defaut;
    };

    if (mode === "taille") {
      if (c.largeurCm !== null) setAttr(ext, "cx", String(Math.max(1, cmEnEmu(c.largeurCm))));
      if (c.hauteurCm !== null) setAttr(ext, "cy", String(Math.max(1, cmEnEmu(c.hauteurCm))));
      return effetOk(`Diapo ${c.diapo}, ${t.forme.modele?.name ?? "forme"} redimensionnée.`, [t.forme.id]);
    }

    const x0 = lireEmu(off, "x");
    const y0 = lireEmu(off, "y");
    const x = mode === "relatif" ? x0 + cmEnEmu(c.dxCm ?? 0) : (c.xCm !== null ? cmEnEmu(c.xCm) : x0);
    const y = mode === "relatif" ? y0 + cmEnEmu(c.dyCm ?? 0) : (c.yCm !== null ? cmEnEmu(c.yCm) : y0);
    // On BORNE à la diapositive : une forme poussée hors du cadre disparaît sans message, et la
    // personne conclut qu'Adam l'a supprimée. Mieux vaut la coller au bord et le dire.
    const largeur = lireEmu(ext, "cx", cmEnEmu(5));
    const hauteur = lireEmu(ext, "cy", cmEnEmu(2));
    const maxX = cmEnEmu(this.largeurCm) - largeur;
    const maxY = cmEnEmu(this.hauteurCm) - hauteur;
    const xb = Math.max(0, Math.min(Math.max(0, maxX), x));
    const yb = Math.max(0, Math.min(Math.max(0, maxY), y));
    setAttr(off, "x", String(xb));
    setAttr(off, "y", String(yb));
    const borne = xb !== x || yb !== y ? " (bord de la diapositive atteint)" : "";
    return effetOk(`Diapo ${c.diapo}, ${t.forme.modele?.name ?? "forme"} → ${emuEnCm(xb)} ; ${emuEnCm(yb)} cm${borne}.`, [t.forme.id]);
  }

  private supprimerForme(c: CommandeArtefact): EffetCommande {
    const t = this.ciblerForme(c);
    if (!t.ok) return t.echec;
    removeChild(t.d.spTree, t.forme.noeud);
    return effetOk(`Diapo ${c.diapo} : ${t.forme.modele?.name ?? "forme"} supprimée.`, []);
  }

  private supprimerDiapo(c: CommandeArtefact): EffetCommande {
    if (this.diapos.length <= 1) return effetEchec("une présentation doit garder au moins une diapositive");
    const i = (c.diapo ?? 1) - 1;
    const cible = this.diapos[i];
    const liste = this.listeDiapos();
    if (!liste) return effetEchec("présentation illisible : liste des diapositives introuvable");
    const ids = children(liste, "p:sldId");
    if (ids[i]) removeChild(liste, ids[i]);
    this.diapos.splice(i, 1);
    void cible;
    return effetOk(`Diapositive ${c.diapo} supprimée — il en reste ${this.diapos.length}.`, []);
  }

  private deplacerDiapo(c: CommandeArtefact): EffetCommande {
    const de = (c.diapo ?? 1) - 1;
    const vers = Math.min(this.diapos.length - 1, Math.max(0, (c.versIndex ?? 1) - 1));
    if (de === vers) return effetEchec("cette diapositive est déjà à cette place");
    const liste = this.listeDiapos();
    if (!liste) return effetEchec("présentation illisible");
    const ids = children(liste, "p:sldId");
    const idNoeud = ids[de];
    if (!idNoeud) return effetEchec(`il n'y a pas de diapositive ${c.diapo}`);
    removeChild(liste, idNoeud);
    // Après retrait, on ré-indexe : insérer à la position VUE par la personne, pas à un rang
    // décalé par notre propre suppression.
    const restants = children(liste, "p:sldId");
    const ref = restants[vers];
    idNoeud.parent = liste;
    if (ref) liste.children.splice(liste.children.indexOf(ref), 0, idNoeud);
    else liste.children.push(idNoeud);
    markDirty(liste);
    const [d] = this.diapos.splice(de, 1);
    this.diapos.splice(vers, 0, d);
    return effetOk(`Diapositive ${c.diapo} déplacée en position ${vers + 1}.`, []);
  }

  private dupliquerDiapo(c: CommandeArtefact): EffetCommande {
    const i = (c.diapo ?? 1) - 1;
    const source = this.diapos[i];
    if (!source) return effetEchec(`il n'y a pas de diapositive ${c.diapo}`);
    const liste = this.listeDiapos();
    if (!liste) return effetEchec("présentation illisible");

    // Nouvelle pièce + nouvelle relation + déclaration de type : les trois sont nécessaires,
    // en oublier une donne un fichier que PowerPoint dit « endommagé ».
    const numeros = Object.keys(this.zip.files)
      .map((f) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(f))
      .filter(Boolean).map((m) => Number(m![1]));
    const num = (numeros.length ? Math.max(...numeros) : 0) + 1;
    const chemin = `ppt/slides/slide${num}.xml`;
    this.zip.file(chemin, serializeXml(source.racine));

    const relsSource = this.zip.file(`ppt/slides/_rels/${source.chemin.split("/").pop()}.rels`);
    if (relsSource) this.zip.file(`ppt/slides/_rels/slide${num}.xml.rels`, relsSource.asText());

    const relsFichier = this.zip.file("ppt/_rels/presentation.xml.rels");
    if (!relsFichier) return effetEchec("présentation illisible : relations introuvables");
    const relsRacine = parseXml(relsFichier.asText());
    const relsEl = child(relsRacine, "Relationships");
    if (!relsEl) return effetEchec("présentation illisible : relations vides");
    const ids = children(relsEl, "Relationship").map((r) => Number((attr(r, "Id") ?? "").replace(/\D/g, "")) || 0);
    const rId = `rId${(ids.length ? Math.max(...ids) : 0) + 1}`;
    const rel = element("Relationship", {
      Id: rId,
      Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
      Target: `slides/slide${num}.xml`,
    });
    rel.parent = relsEl;
    relsEl.children.push(rel);
    markDirty(relsEl);
    this.zip.file("ppt/_rels/presentation.xml.rels", serializeXml(relsRacine));

    const ct = this.zip.file("[Content_Types].xml");
    if (ct) {
      const ctRacine = parseXml(ct.asText());
      const types = child(ctRacine, "Types");
      if (types) {
        const o = element("Override", {
          PartName: `/${chemin}`,
          ContentType: "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
        });
        o.parent = types;
        types.children.push(o);
        markDirty(types);
        this.zip.file("[Content_Types].xml", serializeXml(ctRacine));
      }
    }

    const sldIds = children(liste, "p:sldId").map((s) => Number(attr(s, "id")) || 0);
    const sldId = element("p:sldId", { id: String(Math.max(255, ...sldIds) + 1), "r:id": rId });
    sldId.parent = liste;
    const ref = children(liste, "p:sldId")[i];
    if (ref) liste.children.splice(liste.children.indexOf(ref) + 1, 0, sldId);
    else liste.children.push(sldId);
    markDirty(liste);

    const racine = parseXml(serializeXml(source.racine));
    const spTree = firstDescendant(racine, "p:spTree");
    if (spTree) this.diapos.splice(i + 1, 0, { chemin, racine, spTree });
    return effetOk(`Diapositive ${c.diapo} dupliquée.`, []);
  }

  /**
   * ENREGISTRE une nouvelle pièce de diapositive dans le paquet : la pièce, ses relations, sa
   * déclaration de type et son entrée dans la liste — les quatre, sinon PowerPoint dit
   * « endommagé ». Partagé par la duplication et l'ajout.
   */
  private enregistrerDiapo(xml: string, rels: string | null, apresIndex: number): { chemin: string; num: number } | null {
    const liste = this.listeDiapos();
    if (!liste) return null;
    const numeros = Object.keys(this.zip.files)
      .map((f) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(f))
      .filter(Boolean).map((m) => Number(m![1]));
    const num = (numeros.length ? Math.max(...numeros) : 0) + 1;
    const chemin = `ppt/slides/slide${num}.xml`;
    this.zip.file(chemin, xml);
    if (rels) this.zip.file(`ppt/slides/_rels/slide${num}.xml.rels`, rels);

    const relsFichier = this.zip.file("ppt/_rels/presentation.xml.rels");
    if (!relsFichier) return null;
    const relsRacine = parseXml(relsFichier.asText());
    const relsEl = child(relsRacine, "Relationships");
    if (!relsEl) return null;
    const ids = children(relsEl, "Relationship").map((r) => Number((attr(r, "Id") ?? "").replace(/\D/g, "")) || 0);
    const rId = `rId${(ids.length ? Math.max(...ids) : 0) + 1}`;
    const rel = element("Relationship", {
      Id: rId,
      Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
      Target: `slides/slide${num}.xml`,
    });
    rel.parent = relsEl;
    relsEl.children.push(rel);
    markDirty(relsEl);
    this.zip.file("ppt/_rels/presentation.xml.rels", serializeXml(relsRacine));

    const ct = this.zip.file("[Content_Types].xml");
    if (ct) {
      const ctRacine = parseXml(ct.asText());
      const types = child(ctRacine, "Types");
      if (types) {
        const o = element("Override", { PartName: `/${chemin}`, ContentType: "application/vnd.openxmlformats-officedocument.presentationml.slide+xml" });
        o.parent = types;
        types.children.push(o);
        markDirty(types);
        this.zip.file("[Content_Types].xml", serializeXml(ctRacine));
      }
    }
    const sldIds = children(liste, "p:sldId").map((x) => Number(attr(x, "id")) || 0);
    const sldId = element("p:sldId", { id: String(Math.max(255, ...sldIds) + 1), "r:id": rId });
    sldId.parent = liste;
    const ref = children(liste, "p:sldId")[apresIndex];
    if (ref) liste.children.splice(liste.children.indexOf(ref) + 1, 0, sldId);
    else if (apresIndex < 0) liste.children.unshift(sldId);
    else liste.children.push(sldId);
    markDirty(liste);
    return { chemin, num };
  }

  /**
   * AJOUTE UNE DIAPOSITIVE « une idée » : un titre, des puces — dans la DISPOSITION de la
   * diapositive de référence (celle après laquelle on insère, sinon la dernière), donc avec la
   * charte du masque. Les deux formes créées sont des ESPACES RÉSERVÉS (`p:ph`) : sans
   * géométrie propre, elles héritent position et taille de la disposition, exactement comme
   * une diapositive créée dans PowerPoint. Quand la diapositive de référence porte elle-même un
   * titre ou un corps positionné, on recopie sa géométrie pour rester aligné sur ses voisines.
   */
  private ajouterDiapo(c: CommandeArtefact): EffetCommande {
    const n = this.diapos.length;
    const refIndex = c.diapo !== null ? c.diapo - 1 : n - 1;
    const reference = this.diapos[refIndex];
    if (!reference) return effetEchec(`il n'y a pas de diapositive ${c.diapo}`);
    const apres = c.position === "avant" ? refIndex - 1 : refIndex;

    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const xfrmDe = (predicat: (sp: XmlNode) => boolean): string => {
      const sp = this.formesXml(reference).find(predicat);
      const xfrm = sp ? firstDescendant(sp, "a:xfrm") : null;
      const off = xfrm ? child(xfrm, "a:off") : null;
      const ext = xfrm ? child(xfrm, "a:ext") : null;
      if (!off || !ext) return "";
      return `<a:xfrm><a:off x="${attr(off, "x") ?? "0"}" y="${attr(off, "y") ?? "0"}"/><a:ext cx="${attr(ext, "cx") ?? "0"}" cy="${attr(ext, "cy") ?? "0"}"/></a:xfrm>`;
    };
    const estCorps = (sp: XmlNode): boolean => {
      const ph = firstDescendant(sp, "p:ph");
      if (!ph) return false;
      const type = attr(ph, "type");
      return type === "body" || type === "obj" || (type === null && attr(ph, "idx") !== null);
    };
    const xfrmTitre = xfrmDe(estTitre);
    const xfrmCorps = xfrmDe(estCorps) || xfrmDe((sp) => sp.name === "p:sp" && !estTitre(sp) && Boolean(firstDescendant(sp, "p:txBody")));
    const titre = (c.nom ?? "").trim();
    const puces = (c.texte ?? "").split("\n").map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
    const paragraphes = puces.length
      ? puces.map((t) => `<a:p><a:r><a:rPr lang="fr-FR" dirty="0"/><a:t>${esc(t)}</a:t></a:r></a:p>`).join("")
      : `<a:p><a:endParaRPr lang="fr-FR" dirty="0"/></a:p>`;
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Titre 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr>${xfrmTitre}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" dirty="0"/><a:t>${esc(titre)}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Contenu 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr>${xfrmCorps}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${paragraphes}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

    // Les relations : la DISPOSITION de la diapositive de référence, et elle seule (pas ses
    // notes, pas ses images — elles appartiennent à l'autre diapositive).
    const relsSource = this.zip.file(`ppt/slides/_rels/${reference.chemin.split("/").pop()}.rels`);
    let rels: string | null = null;
    if (relsSource) {
      const racine = parseXml(relsSource.asText());
      const relsEl = child(racine, "Relationships");
      const layout = relsEl ? children(relsEl, "Relationship").find((r) => (attr(r, "Type") ?? "").endsWith("/slideLayout")) : null;
      if (layout) {
        rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="${attr(layout, "Target") ?? "../slideLayouts/slideLayout2.xml"}"/></Relationships>`;
      }
    }
    if (!rels) {
      const layouts = Object.keys(this.zip.files).filter((f) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(f)).sort();
      if (layouts.length === 0) return effetEchec("cette présentation n'a aucune disposition : impossible d'y ajouter une diapositive");
      rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../${layouts[Math.min(1, layouts.length - 1)].slice(4)}"/></Relationships>`;
    }
    const piece = this.enregistrerDiapo(xml, rels, apres);
    if (!piece) return effetEchec("présentation illisible : relations introuvables");
    const racine = parseXml(xml);
    const spTree = firstDescendant(racine, "p:spTree");
    if (!spTree) return effetEchec("la diapositive créée est illisible");
    this.diapos.splice(apres + 1, 0, { chemin: piece.chemin, racine, spTree });
    const position = apres + 2;
    return effetOk(`Diapositive « ${abreger(titre || puces[0] || "", 40)} » ajoutée en position ${position}${puces.length ? ` (${puces.length} puce${puces.length > 1 ? "s" : ""})` : ""}.`, [`s${position}`]);
  }

  private listeDiapos(): XmlNode | null {
    const pres = child(this.presentation, "p:presentation");
    return pres ? child(pres, "p:sldIdLst") : null;
  }

  async serialiser(): Promise<Buffer> {
    this.zip.file("ppt/presentation.xml", serializeXml(this.presentation));
    for (const d of this.diapos) this.zip.file(d.chemin, serializeXml(d.racine));
    return this.zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
  }

  async valider(): Promise<Validation> {
    const problemes: string[] = [];
    try {
      const octets = await this.serialiser();
      const relu = new PizZip(octets);
      for (const requis of ["[Content_Types].xml", "ppt/presentation.xml"]) {
        if (!relu.file(requis)) problemes.push(`pièce obligatoire perdue : ${requis}`);
      }
      for (const d of this.diapos) {
        const f = relu.file(d.chemin);
        if (!f) { problemes.push(`diapositive perdue : ${d.chemin}`); continue; }
        if (!f.asText().includes("<p:spTree")) problemes.push(`${d.chemin} : arbre de formes absent`);
      }
      // Le masque est la charte : sa disparition serait la régression la plus visible (§44).
      if (!Object.keys(relu.files).some((f) => /^ppt\/slideMasters\//.test(f))) {
        problemes.push("le masque de la présentation a disparu");
      }
    } catch (e) {
      problemes.push(`la présentation produite ne se relit pas : ${(e as Error).message}`);
    }
    return { ok: problemes.length === 0, problemes };
  }
}

/** Écrit le texte d'un `a:p` en gardant le style de son premier fragment. */
function ecrireTexteParagraphe(p: XmlNode, texte: string): void {
  const runs = children(p, "a:r");
  const gabarit = runs[0] ? cloneNode(runs[0]) : null;
  for (const r of runs) removeChild(p, r);
  for (const b of children(p, "a:br")) removeChild(p, b);
  if (!texte) { markDirty(p); return; }
  const run = gabarit ?? element("a:r", {}, [element("a:rPr", { lang: "fr-FR", dirty: "0" })]);
  run.raw = null;
  const t = child(run, "a:t");
  if (t) { t.children = [textNode(texte)]; t.children[0].parent = t; t.selfClosing = false; markDirty(t); }
  else {
    const nouveau = element("a:t", {}, [textNode(texte)]);
    nouveau.parent = run;
    run.children.push(nouveau);
    run.selfClosing = false;
  }
  run.parent = p;
  // Après `a:pPr` s'il existe : le schéma exige que les propriétés ouvrent le paragraphe.
  const pPr = child(p, "a:pPr");
  const i = pPr ? p.children.indexOf(pPr) + 1 : 0;
  p.children.splice(i, 0, run);
  markDirty(p);
}

function appliquerStyleRun(rPr: XmlNode, c: CommandeArtefact): void {
  if (c.gras !== null) setAttr(rPr, "b", c.gras ? "1" : "0");
  if (c.italique !== null) setAttr(rPr, "i", c.italique ? "1" : "0");
  if (c.souligne !== null) setAttr(rPr, "u", c.souligne ? "sng" : "none");
  if (c.taillePt !== null) setAttr(rPr, "sz", String(Math.round(c.taillePt * 100)));
  if (c.police !== null) {
    for (const balise of ["a:latin", "a:cs"]) {
      setAttr(ensureChild(rPr, balise, ORDRE_RPR.slice(0, ORDRE_RPR.indexOf(balise))), "typeface", c.police);
    }
  }
  if (c.couleur !== null) {
    const fill = ensureChild(rPr, "a:solidFill", ORDRE_RPR.slice(0, ORDRE_RPR.indexOf("a:solidFill")));
    // On REMPLACE le contenu du remplissage : y laisser un `a:schemeClr` ferait gagner le thème.
    fill.children = [];
    const clr = element("a:srgbClr", { val: c.couleur.toUpperCase() });
    clr.parent = fill;
    fill.children.push(clr);
    fill.selfClosing = false;
    markDirty(fill);
  }
}

export const adaptateurPptx: AdaptateurArtefact = {
  format: "PPTX",
  mimes: [MIME_PPTX],
  extensions: [".pptx"],
  async ouvrir(octets: Buffer): Promise<DocumentOuvert> {
    const zip = new PizZip(octets);
    const presFichier = zip.file("ppt/presentation.xml");
    if (!presFichier) throw new Error("Ce fichier .pptx ne contient pas ppt/presentation.xml — il est probablement endommagé.");
    const presentation = parseXml(presFichier.asText());
    const pres = child(presentation, "p:presentation");
    const liste = pres ? child(pres, "p:sldIdLst") : null;

    const relsFichier = zip.file("ppt/_rels/presentation.xml.rels");
    const cheminParId = new Map<string, string>();
    if (relsFichier) {
      const relsRacine = parseXml(relsFichier.asText());
      const relsEl = child(relsRacine, "Relationships");
      for (const r of relsEl ? children(relsEl, "Relationship") : []) {
        const id = attr(r, "Id");
        const cible = attr(r, "Target");
        if (id && cible) cheminParId.set(id, cible.startsWith("/") ? cible.slice(1) : `ppt/${cible.replace(/^\.\//, "")}`);
      }
    }

    const diapos: Diapo[] = [];
    for (const s of liste ? children(liste, "p:sldId") : []) {
      const rid = attr(s, "r:id") ?? attr(s, "id") ?? "";
      const chemin = cheminParId.get(rid);
      if (!chemin) continue;
      const fichier = zip.file(chemin);
      if (!fichier) continue;
      const racine = parseXml(fichier.asText());
      const spTree = firstDescendant(racine, "p:spTree");
      if (spTree) diapos.push({ chemin, racine, spTree });
    }
    if (diapos.length === 0) throw new Error("Cette présentation ne contient aucune diapositive lisible.");

    const sldSz = pres ? child(pres, "p:sldSz") : null;
    const cx = sldSz ? Number(attr(sldSz, "cx")) : NaN;
    const cy = sldSz ? Number(attr(sldSz, "cy")) : NaN;
    return new PptxOuvert(
      zip, presentation, diapos,
      Number.isFinite(cx) ? emuEnCm(cx) : 33.87,
      Number.isFinite(cy) ? emuEnCm(cy) : 19.05,
    );
  },
};
