import { makeTextPdf, makeScannedPdf, makeDocx, makeXlsx, makePptx, makeCsv, makePhoto, makeEml } from "./corpus-lib";
import { CORPUS, type CorpusPiece } from "./corpus-def";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONSTRUCTEUR — la définition devient des octets.
 *
 * Séparé de la définition pour une raison précise : les attentes du banc (§ `corpus-def`) sont
 * lisibles sans rien exécuter, et le jour où l'on remplace un générateur — une vraie
 * bibliothèque PDF, des documents Adventum réels — c'est CE fichier seul qui change. Les
 * attentes, elles, restent ce qu'elles étaient, donc la comparaison avant/après tient.
 *
 * ── LE DOUBLON EST CONSTRUIT, PAS RE-GÉNÉRÉ ─────────────────────────────────────────────
 *
 * Il réutilise le buffer de sa source. Deux appels au même générateur donneraient deux fichiers
 * *presque* identiques — un horodatage, un identifiant de zip — et l'empreinte différerait. On
 * mesurerait alors la stabilité du générateur au lieu de la déduplication.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface CorpusFile {
  piece: CorpusPiece;
  buffer: Buffer;
  /** Ce que le Drive verra ; l'extension départage les archives ZIP Office. */
  nom: string;
}

async function buildOne(p: CorpusPiece, deja: Map<string, Buffer>): Promise<Buffer> {
  const c = p.contenu;
  switch (p.format) {
    case "pdf": {
      if (c.k !== "pages") throw new Error(`${p.id} : un pdf attend des pages`);
      return makeTextPdf(c.pages);
    }
    case "pdf-scan": {
      if (c.k !== "image") throw new Error(`${p.id} : un scan attend une image`);
      const { jpeg, largeur, hauteur } = await makePhoto(c.lignes, { largeur: 595, hauteur: 842 });
      return makeScannedPdf(jpeg, largeur, hauteur);
    }
    case "photo": {
      if (c.k !== "image") throw new Error(`${p.id} : une photo attend une image`);
      return (await makePhoto(c.lignes)).jpeg;
    }
    case "docx": {
      if (c.k !== "paras") throw new Error(`${p.id} : un docx attend des paragraphes`);
      return makeDocx(c.paras);
    }
    case "pptx": {
      if (c.k !== "slides") throw new Error(`${p.id} : un pptx attend des diapositives`);
      return makePptx(c.slides);
    }
    case "xlsx": {
      if (c.k !== "feuilles") throw new Error(`${p.id} : un xlsx attend des feuilles`);
      return makeXlsx(c.feuilles);
    }
    case "csv": {
      if (c.k !== "csv") throw new Error(`${p.id} : un csv attend un en-tête et des lignes`);
      return makeCsv(c.entete, c.lignes);
    }
    case "eml": {
      if (c.k !== "mail") throw new Error(`${p.id} : un eml attend un courriel`);
      return makeEml({ de: c.de, a: c.a, objet: c.objet, date: c.date, corps: c.corps, piece: c.piece });
    }
    case "txt":
    case "json": {
      if (c.k !== "brut") throw new Error(`${p.id} : un fichier brut attend du texte`);
      return Buffer.from(c.texte, "utf8");
    }
  }
  // Exhaustif par construction ; le `never` fait échouer la compilation si un format est ajouté.
  return ((k: never) => { throw new Error(`format inconnu ${String(k)}`); })(p.format);
}

/** Construit tout le corpus, dans l'ordre — les doublons après leur source. */
export async function buildCorpus(): Promise<CorpusFile[]> {
  const deja = new Map<string, Buffer>();
  const out: CorpusFile[] = [];
  for (const p of CORPUS) {
    let buffer: Buffer;
    if (p.lien?.type === "doublon") {
      const src = deja.get(p.lien.de);
      if (!src) throw new Error(`${p.id} : doublon de « ${p.lien.de} », qui n'a pas encore été construit`);
      buffer = src; // MÊME buffer : c'est la définition d'un doublon.
    } else {
      buffer = await buildOne(p, deja);
    }
    deja.set(p.id, buffer);
    out.push({ piece: p, buffer, nom: p.nom });
  }
  return out;
}

/** Exécution directe : `npx tsx scripts/bench/corpus-build.ts [dossier]` — écrit les fichiers sur disque. */
async function main(): Promise<void> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const crypto = await import("node:crypto");
  const racine = process.argv[2] ?? "/tmp/corpus-essai";

  const files = await buildCorpus();
  const empreintes = new Map<string, string[]>();
  let total = 0;

  for (const f of files) {
    const dir = path.join(racine, f.piece.dossier);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, f.nom), f.buffer);
    const h = crypto.createHash("sha256").update(f.buffer).digest("hex").slice(0, 12);
    empreintes.set(h, [...(empreintes.get(h) ?? []), f.piece.id]);
    total += f.buffer.length;
    console.log(
      `${f.piece.format.padEnd(9)} ${String(f.buffer.length).padStart(8)} o  ${h}  ${f.piece.dossier}/${f.nom}`,
    );
  }

  const collisions = [...empreintes.entries()].filter(([, ids]) => ids.length > 1);
  console.log(`\n${files.length} fichiers · ${(total / 1024).toFixed(0)} Ko · ${empreintes.size} empreintes distinctes`);
  for (const [h, ids] of collisions) console.log(`  empreinte partagée ${h} : ${ids.join(", ")}`);
  console.log(`\nécrits dans ${racine}`);
}

if (process.argv[1]?.endsWith("corpus-build.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
