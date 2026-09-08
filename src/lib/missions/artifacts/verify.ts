import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { ArtefactSpec } from "@/lib/missions/artifacts/spec";
import type { ArtifactModel } from "@/lib/artifact/object-model/model";
import { adaptateurPour } from "@/lib/artifact/adapters/registry";
import { controlerAvantLivraison } from "@/lib/artifact/qa/checks";
import { direEcart } from "@/lib/missions/artifacts/totaux";
import { lireClasseur } from "@/lib/artifact/sheets/reader";
import { construireGraphe, idDe } from "@/lib/artifact/sheets/graph";
import { recalculer } from "@/lib/artifact/sheets/evaluate";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONTRÔLE D'UN LIVRABLE (§21) — on RELIT le fichier produit, on ne croit pas le producteur.
 *
 * ── POURQUOI RELIRE PLUTÔT QUE FAIRE CONFIANCE ──────────────────────────────────────────
 *
 * Le constructeur a rendu un tampon d'octets sans lever d'exception. Cela prouve qu'il n'a pas
 * planté ; cela ne prouve pas qu'Excel ouvrira le fichier. Les trois pannes réelles de ce genre
 * de code sont invisibles côté producteur :
 *
 *   • une archive incohérente (une relation qui pointe vers une partie absente) → « fichier
 *     endommagé, voulez-vous le réparer ? » chez le destinataire ;
 *   • une formule dont la plage est fausse → `#REF!` dans un classeur envoyé à la direction ;
 *   • un total qui ne correspond pas aux lignes → un chiffre faux, et personne ne le voit.
 *
 * On rouvre donc l'archive et on relit le classeur. Ce contrôle est ce qui fait passer
 * l'artefact de BUILT à VERIFIED — et seul VERIFIED compte comme preuve d'achèvement.
 *
 * ── CE QUE CE CONTRÔLE NE PEUT PAS FAIRE, ET LE DIT ─────────────────────────────────────
 *
 * Il ne CALCULE pas les formules : aucune bibliothèque du dépôt n'a de moteur de calcul Excel.
 * Il vérifie donc la STRUCTURE d'un total (la plage couvre exactement les lignes de données,
 * la fonction est celle demandée) et il RECALCULE la somme attendue à partir des lignes de la
 * spec. Ce qu'il ne peut pas affirmer, il le range dans `nonVerifie` — jamais dans « réussi ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface ControleArtefact {
  ok: boolean;
  /** Chaque point contrôlé, avec son verdict — c'est le rapport stocké sur l'artefact. */
  points: { nom: string; ok: boolean; detail: string }[];
  /** Ce qu'on n'a PAS pu vérifier. Dit, jamais compté comme réussi. */
  nonVerifie: string[];
  /**
   * Ce qu'on a VU sans que cela bloque : une diapo trop chargée, une numérotation d'articles
   * qui saute. Facultatif — un contrôle qui n'en produit pas n'a pas à écrire un tableau vide.
   */
  avertissements?: string[];
}

const point = (nom: string, ok: boolean, detail: string) => ({ nom, ok, detail });

/**
 * CONTRÔLE UN CLASSEUR PRODUIT.
 *
 * `spec` sert de référence : c'est elle qui dit combien de lignes on attendait et quels totaux.
 * Contrôler un fichier sans référence reviendrait à vérifier qu'il est cohérent avec lui-même.
 */
export async function controlerClasseur(buffer: Buffer, spec: ArtefactSpec): Promise<ControleArtefact> {
  const points: ControleArtefact["points"] = [];
  const nonVerifie: string[] = [];
  const avertissements: string[] = [];

  if (buffer.length === 0) {
    return { ok: false, points: [point("fichier", false, "le fichier produit est vide")], nonVerifie };
  }

  // ── 1. L'ARCHIVE S'OUVRE-T-ELLE, ET SES PARTIES SE RÉPONDENT-ELLES ? ────────────────
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    return {
      ok: false,
      points: [point("archive", false, `l'archive ne s'ouvre pas : ${e instanceof Error ? e.message : "erreur"}`)],
      nonVerifie,
    };
  }
  points.push(point("archive", true, `${Object.keys(zip.files).length} parties, ${buffer.length} octets`));

  const manquantes = await relationsCassees(zip);
  points.push(point(
    "relations",
    manquantes.length === 0,
    manquantes.length === 0
      ? "toutes les relations pointent vers une partie existante"
      : `${manquantes.length} relation(s) pointent dans le vide : ${manquantes.slice(0, 4).join(", ")}`,
  ));

  // ── 2. LE CLASSEUR SE RELIT-IL ? ────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch (e) {
    points.push(point("lecture", false, `le classeur ne se relit pas : ${e instanceof Error ? e.message : "erreur"}`));
    return { ok: false, points, nonVerifie };
  }
  const noms = wb.worksheets.map((w) => w.name);
  points.push(point("lecture", true, `${noms.length} feuille(s) : ${noms.join(", ")}`));

  // ── 3. LES FEUILLES ANNONCÉES SONT-ELLES LÀ, AVEC LE BON NOMBRE DE LIGNES ? ─────────
  for (const f of spec.sheets ?? []) {
    const ws = wb.getWorksheet(f.name);
    if (!ws) {
      points.push(point(`feuille:${f.name}`, false, "feuille absente du classeur produit"));
      continue;
    }
    const attendues = f.rows.length;
    const totaux = f.totals && f.rows.length > 0 ? 1 : 0;
    const note = f.note ? 2 : 0;
    // `rowCount` compte l'en-tête, les données, la ligne de totaux et, le cas échéant, la note
    // précédée d'une ligne vide. On vérifie la borne basse : ce qui compte est qu'AUCUNE ligne
    // de données ne manque.
    const minimum = 1 + attendues + totaux;
    points.push(point(
      `feuille:${f.name}`,
      ws.rowCount >= minimum && ws.columnCount >= f.columns.length,
      `${ws.rowCount} lignes (≥ ${minimum} attendu), ${ws.columnCount} colonnes (≥ ${f.columns.length})`
      + (note ? " ; note incluse" : ""),
    ));
  }

  // ── 4. AUCUNE FORMULE CASSÉE ────────────────────────────────────────────────────────
  const cassees: string[] = [];
  let nbFormules = 0;
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        const v = cell.value as unknown;
        if (v && typeof v === "object" && "formula" in (v as Record<string, unknown>)) {
          nbFormules += 1;
          const f = String((v as Record<string, unknown>).formula ?? "");
          if (/#REF|#NAME|#VALUE|#DIV\/0/.test(f)) cassees.push(`${ws.name}!${cell.address ?? `${r}:${c}`}`);
        }
        if (typeof v === "string" && /^#(REF|NAME|VALUE|DIV\/0|N\/A)/.test(v)) {
          cassees.push(`${ws.name}!${cell.address ?? `${r}:${c}`}`);
        }
      });
    });
  }
  points.push(point(
    "formules",
    cassees.length === 0,
    cassees.length === 0
      ? `${nbFormules} formule(s), aucune erreur de référence`
      : `${cassees.length} cellule(s) en erreur : ${cassees.slice(0, 5).join(", ")}`,
  ));

  // ── 5. LES TOTAUX SE RÉCONCILIENT-ILS AVEC LES DONNÉES ? ────────────────────────────
  for (const f of spec.sheets ?? []) {
    if (!f.totals || f.rows.length === 0) continue;
    const ws = wb.getWorksheet(f.name);
    if (!ws) continue;
    const cles = [...f.columns.map((c) => c.key), ...(f.computed ?? []).map((c) => c.key)];
    const ligneTotaux = 1 + f.rows.length + 1;

    for (const [cle, agregat] of Object.entries(f.totals)) {
      const colIdx = cles.indexOf(cle) + 1;
      if (colIdx <= 0) continue;
      const cell = ws.getCell(ligneTotaux, colIdx);
      const v = cell.value as unknown;
      const formule = v && typeof v === "object" && "formula" in (v as Record<string, unknown>)
        ? String((v as Record<string, unknown>).formula)
        : "";
      const fn = agregat === "AVG" ? "AVERAGE" : agregat;
      // LA PLAGE DOIT COUVRIR EXACTEMENT LES LIGNES 2 À N+1 : une plage plus courte oublie des
      // lignes, une plage plus longue inclut la note et fausse la moyenne.
      const attendue = new RegExp(`^${fn}\\([A-Z]+2:[A-Z]+${f.rows.length + 1}\\)$`);
      const ok = attendue.test(formule);
      points.push(point(
        `total:${f.name}.${cle}`,
        ok,
        ok
          ? `${formule} couvre les ${f.rows.length} lignes de données`
          : `formule « ${formule || "absente"} » : elle ne couvre pas exactement les ${f.rows.length} lignes`,
      ));

      // LA RÉCONCILIATION EST PLUS BAS, et c'est tout le changement : celle qui vivait ici
      // s'écrivait `point(..., true, ...)` — un verdict qui ne pouvait pas échouer, donc qui ne
      // protégeait de rien (§118.17). Elle compare maintenant la valeur RECALCULÉE du classeur
      // à la somme refaite depuis la spec, et elle peut tomber.
      if ((agregat === "SUM" || agregat === "AVG")
        && f.rows.map((r) => r[cle]).filter((x) => typeof x === "number").length !== f.rows.length) {
        nonVerifie.push(
          `Le total « ${cle} » de « ${f.name} » ne peut pas être réconcilié : la colonne contient des valeurs non numériques.`,
        );
      }
    }
  }
  // ── 5 ter. ON ÉVALUE LES FORMULES. Pour de bon (§118.59). ──────────────────────────
  //
  // Cette ligne disait, jusqu'à ce jour : « les formules ne sont pas ÉVALUÉES (aucun moteur de
  // calcul Excel dans le dépôt) ». C'était FAUX, et c'est le genre de fausseté qui coûte le
  // plus cher : `artifact/sheets/` porte un lexeur, un parseur, un graphe de dépendances et
  // `recalculer()`, éprouvés sur des classeurs de 50 000 formules. Le contrôle qui décide de
  // VERIFIED déclarait une impossibilité que le dépôt d'à côté démentait — un « je ne peux
  // pas » artificiel, écrit dans le code plutôt que dans une phrase de modèle.
  //
  // On rouvre donc le classeur PRODUIT avec notre propre lecteur, on recalcule ses formules, et
  // on compare le résultat à la somme refaite depuis les lignes de la spec. Deux chemins
  // indépendants — le classeur d'un côté, la spec de l'autre — qui doivent tomber sur le même
  // nombre. C'est ce qui fait la différence entre « la formule a la bonne PLAGE » et « le
  // classeur AFFICHERA le bon chiffre ».
  const evaluation = await evaluerLeClasseur(buffer, spec);
  points.push(...evaluation.points);
  nonVerifie.push(...evaluation.nonVerifie);

  // ── 5 bis. CE QUE LE PARSEUR A DÛ REMETTRE D'APLOMB (§118.59) ───────────────────────
  //
  // Un total annoncé par le modèle qui ne tombe pas sur ses propres lignes est une erreur
  // ARITHMÉTIQUE mesurée : soit un chiffre est faux, soit une ligne manque. Le classeur porte
  // maintenant la formule, donc il AFFICHERA le bon total — et c'est précisément pourquoi il
  // faut le dire ici : sans cette ligne, la correction effacerait la trace de la faute, et le
  // classeur repartirait VERIFIED avec, peut-être, une ligne de données en moins.
  for (const e of spec.constats?.ecarts ?? []) {
    points.push(point(`arithmetique:${e.feuille}.${e.colonne}`, false, direEcart(e)));
  }
  for (const s of spec.constats?.suspectes ?? []) avertissements.push(s);

  // ── 6. LES GRAPHIQUES SONT-ILS COMPLETS ? ───────────────────────────────────────────
  const attendus = (spec.charts ?? []).length;
  if (attendus > 0) {
    const partsChart = Object.keys(zip.files).filter((n) => /^xl\/charts\/chart\d+\.xml$/.test(n));
    const partsDrawing = Object.keys(zip.files).filter((n) => /^xl\/drawings\/drawing\d+\.xml$/.test(n));
    const ct = await zip.file("[Content_Types].xml")?.async("string") ?? "";
    const declares = partsChart.every((p) => ct.includes(`/${p}`)) && partsDrawing.every((p) => ct.includes(`/${p}`));

    let sansSerie = 0;
    for (const p of partsChart) {
      const xml = await zip.file(p)?.async("string") ?? "";
      if (!/<c:ser>/.test(xml) || !/<c:val>/.test(xml)) sansSerie += 1;
    }
    points.push(point(
      "graphiques",
      partsChart.length === attendus && partsDrawing.length > 0 && declares && sansSerie === 0,
      `${partsChart.length}/${attendus} graphique(s) écrits, ${partsDrawing.length} dessin(s), `
      + `types ${declares ? "déclarés" : "NON déclarés"}, ${sansSerie} sans série`,
    ));
  }

  return {
    ok: points.every((p) => p.ok), points, nonVerifie,
    ...(avertissements.length > 0 ? { avertissements } : {}),
  };
}

/**
 * ÉVALUE LES FORMULES DU CLASSEUR PRODUIT, avec le moteur de `artifact/sheets/`.
 *
 * Ce que ce contrôle peut affirmer et ce qu'il ne peut pas est tenu par le moteur lui-même :
 * `recalculer` range dans `nonVerifiees` toute formule dont il ne connaît pas une fonction, et
 * `fonctionsInconnues` les nomme. On recopie cette limite dans `nonVerifie` plutôt que de la
 * lisser — un contrôle qui compte pour réussi ce qu'il n'a pas su calculer est précisément le
 * genre de vert qui ne protège de rien (§118.17).
 */
async function evaluerLeClasseur(
  buffer: Buffer, spec: ArtefactSpec,
): Promise<{ points: ControleArtefact["points"]; nonVerifie: string[] }> {
  const points: ControleArtefact["points"] = [];
  const nonVerifie: string[] = [];

  let classeur;
  try {
    classeur = await lireClasseur(buffer);
  } catch (e) {
    nonVerifie.push(`Les formules n'ont pas pu être recalculées : ${e instanceof Error ? e.message : "erreur de lecture"}.`);
    return { points, nonVerifie };
  }
  const graphe = construireGraphe(classeur);
  if (graphe.ordre.length === 0) return { points, nonVerifie };
  const recalcul = recalculer(classeur, graphe);

  points.push(point(
    "recalcul",
    recalcul.circulaires.length === 0,
    recalcul.circulaires.length === 0
      ? `${recalcul.metriques.formules} formule(s) recalculées en ${recalcul.metriques.ms} ms, aucune référence circulaire`
      : `${recalcul.circulaires.length} cellule(s) en référence circulaire : Excel refusera de les calculer`,
  ));
  if (recalcul.fonctionsInconnues.length > 0) {
    nonVerifie.push(
      `${recalcul.nonVerifiees.length} formule(s) n'ont pas pu être recalculées ici : `
      + `fonction(s) ${recalcul.fonctionsInconnues.slice(0, 6).join(", ")} hors du moteur. Excel les calculera.`,
    );
  }

  // LE TOTAL, VALEUR CONTRE VALEUR. La spec dit ce que les lignes contiennent ; le classeur dit
  // ce que sa formule produit. Deux chemins indépendants, un seul nombre attendu.
  for (const f of spec.sheets ?? []) {
    if (!f.totals || f.rows.length === 0) continue;
    const feuille = classeur.feuilles.find((x) => x.nom === f.name);
    if (!feuille) continue;
    const cles = [...f.columns.map((c) => c.key), ...(f.computed ?? []).map((c) => c.key)];
    const ligneTotaux = 1 + f.rows.length + 1;

    for (const [cle, agregat] of Object.entries(f.totals)) {
      if (agregat !== "SUM" && agregat !== "AVG") continue;
      const colIdx = cles.indexOf(cle) + 1;
      if (colIdx <= 0) continue;
      const nombres = f.rows.map((r) => r[cle]).filter((x): x is number => typeof x === "number");
      if (nombres.length !== f.rows.length || nombres.length === 0) continue;

      const somme = nombres.reduce((s, n) => s + n, 0);
      const attendu = agregat === "SUM" ? somme : somme / nombres.length;
      const calcule = recalcul.valeurs.get(idDe(feuille.index, ligneTotaux, colIdx));
      if (typeof calcule !== "number") {
        nonVerifie.push(`Le total « ${cle} » de « ${f.name} » n'a pas pu être recalculé ici.`);
        continue;
      }
      const ok = Math.abs(calcule - attendu) <= Math.max(1e-6, Math.abs(attendu) * 1e-9);
      points.push(point(
        `reconciliation:${f.name}.${cle}`,
        ok,
        ok
          ? `la formule donne ${Math.round(calcule * 100) / 100}, les ${nombres.length} lignes donnent la même chose`
          : `la formule donne ${Math.round(calcule * 100) / 100}, les ${nombres.length} lignes de la spec donnent ${Math.round(attendu * 100) / 100}`,
      ));
    }
  }

  return { points, nonVerifie };
}

/**
 * LES RELATIONS QUI POINTENT DANS LE VIDE.
 *
 * C'est le contrôle qui attrape l'injection de graphique ratée : une relation vers
 * `../charts/chart1.xml` alors que la partie n'a pas été écrite produit exactement le message
 * « fichier endommagé » qu'on veut ne jamais envoyer.
 */
async function relationsCassees(zip: JSZip): Promise<string[]> {
  const manquantes: string[] = [];
  const fichiers = new Set(Object.keys(zip.files));

  for (const nom of Object.keys(zip.files)) {
    if (!nom.endsWith(".rels")) continue;
    const xml = await zip.file(nom)?.async("string");
    if (!xml) continue;
    const base = nom.replace(/_rels\/[^/]+$/, "");
    for (const m of xml.matchAll(/Target="([^"]+)"[^>]*?(TargetMode="External")?\s*\/?>/g)) {
      const cible = m[1];
      if (m[2] || /^https?:/i.test(cible) || cible.startsWith("#")) continue;
      const resolu = normaliserChemin(base + cible);
      if (!fichiers.has(resolu)) manquantes.push(`${nom} → ${cible}`);
    }
  }
  return manquantes;
}

/** Résout `xl/drawings/../charts/chart1.xml` en `xl/charts/chart1.xml`. */
function normaliserChemin(p: string): string {
  const out: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return out.join("/");
}


/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ON OUVRE LE LIVRABLE — comme le destinataire l'ouvrira.
 *
 * ── CE QUI TENAIT LIEU DE CONTRÔLE AVANT, ET CE QUE ÇA LAISSAIT PASSER ──────────────────
 *
 * Un Word, un PowerPoint ou un PDF produit par une mission était contrôlé ainsi : plus de
 * 200 octets, et les quatre premiers octets valent `PK\x03\x04` (ou `%PDF`). C'est vrai d'une
 * archive vide. Passaient donc en VERIFIED — le seul statut qui compte comme preuve
 * d'achèvement (§118.10) :
 *
 *   • un document sans un seul paragraphe ;
 *   • une présentation sans une seule diapositive ;
 *   • un PDF sans page ;
 *   • un contrat qui porte encore « [à compléter] », « XXX » ou « {{client}} ».
 *
 * Les quatre sont des livraisons faites à quelqu'un. Le dernier est le pire : il est plausible,
 * il s'ouvre, il s'imprime, et il part chez un tiers avec le trou dedans.
 *
 * ── POURQUOI CE CONTRÔLE-CI ET PAS UN AUTRE ─────────────────────────────────────────────
 *
 * `controlerAvantLivraison` existe déjà, il est éprouvé, et c'est LUI qui répond à la question
 * « est-ce que je peux l'envoyer ? » quand une personne édite un document dans le Live Office.
 * Un livrable de mission pose exactement la même question — la seule différence est que
 * personne ne le relit avant qu'il parte. En écrire un second donnerait deux exigences de
 * qualité selon l'origine du fichier, et celle des missions prendrait du retard (§118.5).
 *
 * L'ADAPTATEUR de production ouvre les octets. C'est ce qui rend le contrôle honnête : si le
 * fichier ne se modélise pas ici, il ne s'ouvrira pas non plus dans le workspace ni chez le
 * destinataire.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function ouvrirEtControler(
  buffer: Buffer, format: ArtefactSpec["format"], detail: Record<string, unknown> = {},
): Promise<ControleArtefact> {
  const points: ControleArtefact["points"] = [];
  const nonVerifie: string[] = [];

  // ── 1. LES OCTETS. Nommer une signature fausse évite de faire porter le refus à
  //       l'adaptateur, dont le message parlerait d'XML là où le fichier n'est pas un zip.
  const SIGNATURES: Record<string, Buffer> = {
    DOCX: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    PPTX: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    XLSX: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    ZIP: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    PDF: Buffer.from("%PDF"),
  };
  points.push(point("taille", buffer.length > 200, `${buffer.length} octets`));
  const attendue = SIGNATURES[format];
  if (attendue) {
    const tete = buffer.subarray(0, attendue.length);
    points.push(point("signature", tete.equals(attendue),
      tete.equals(attendue)
        ? `signature ${format} correcte`
        : `signature inattendue (${tete.toString("hex")}) : le fichier n'est pas un ${format} valide`));
  }
  if (!points.every((p) => p.ok)) {
    return { ok: false, points, nonVerifie };
  }

  // ── 2. LE FICHIER S'OUVRE-T-IL VRAIMENT ? ───────────────────────────────────────────
  const lisible = format === "DOCX" || format === "PPTX" || format === "XLSX" || format === "PDF";
  if (!lisible) {
    // ZIP, CSV… : on ne prétend pas les modéliser. La limite est DITE (§34), pas maquillée
    // en réussite.
    points.push(point("contenu", true, JSON.stringify(detail)));
    return {
      ok: true, points,
      nonVerifie: [`Le format ${format} n'est pas ouvert : seules sa signature et sa taille sont vérifiées.`],
    };
  }

  let modele;
  try {
    const doc = await adaptateurPour(format).ouvrir(buffer);
    const v = await doc.valider();
    points.push(point("relecture", v.ok, v.ok ? "le fichier se rouvre et se relit" : v.problemes.join(" ; ")));
    if (!v.ok) return { ok: false, points, nonVerifie };
    modele = doc.modele();
  } catch (e) {
    points.push(point("ouverture", false,
      `le fichier ne s'ouvre pas : ${e instanceof Error ? e.message : "erreur"} — le destinataire verrait « fichier endommagé »`));
    return { ok: false, points, nonVerifie };
  }

  // ── 3. EST-IL LIVRABLE ? Le même contrôle que pour un document qu'une personne envoie.
  const livraison = controlerAvantLivraison(modele);
  points.push(point("livrable", livraison.ok,
    livraison.ok
      ? "aucun reste de brouillon, aucune section vide, rien qui bloque l'envoi"
      : livraison.bloquants.join(" ; ")));

  points.push(point("contenu", true, `${resumerModele(modele)} — ${JSON.stringify(detail)}`));

  return {
    ok: points.every((p) => p.ok),
    points,
    nonVerifie,
    avertissements: livraison.avertissements,
  };
}

/** Ce que le fichier contient VRAIMENT, en une ligne — le rapport doit pouvoir se lire. */
function resumerModele(m: ArtifactModel): string {
  if (m.kind === "DOCX") {
    const paras = m.paragraphs.filter((p) => p.text.trim()).length;
    return `${paras} paragraphe(s) non vides, ${m.tables.length} tableau(x), ${m.images.length} image(s), ${m.pages} page(s)`;
  }
  if (m.kind === "PPTX") return `${m.slides.length} diapositive(s)`;
  if (m.kind === "PDF") return `${m.pages.length} page(s)`;
  return `${m.sheets.length} feuille(s), ${m.sheets.reduce((n, s) => n + s.cells.length, 0)} cellule(s) remplies`;
}
