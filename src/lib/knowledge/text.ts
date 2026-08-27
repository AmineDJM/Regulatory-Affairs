import { createHash } from "node:crypto";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE TEXTE, TEL QUE LA COUCHE DE CONNAISSANCE LE MANIPULE.
 *
 * Module PUR (hors `node:crypto`) : aucune dépendance au produit, donc testable sans base et
 * réutilisable par n'importe quel module de l'ERP.
 *
 * `fold` reprend EXACTEMENT la normalisation déjà en service dans l'index Drive
 * (`assistant/memory-context.ts`) : décomposition NFD, accents retirés, minuscules. Deux
 * normalisations différentes dans le même produit, ce serait deux index qui ne trouvent pas les
 * mêmes choses — et personne pour dire lequel a raison.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LE REPLI DE RECHERCHE — « reglement » doit trouver « Règlement ».
 *
 * On ne retire QUE les accents et la casse. Retirer aussi la ponctuation détruirait des
 * références comme « REG-2026-041 », qui sont précisément ce qu'on cherche le plus souvent.
 */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * L'EMPREINTE DU CONTENU — la réponse à « est-ce que je connais déjà ça ? ».
 *
 * Elle porte sur le CONTENU, jamais sur les métadonnées : renommer un fichier, le déplacer ou
 * changer son propriétaire ne doit pas déclencher une réextraction. C'est ce qui fait la
 * différence entre une couche qui coûte une fois et une couche qui coûte à chaque sauvegarde.
 */
export function contentHash(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * L'empreinte d'un enregistrement STRUCTURÉ (une tâche, un dossier). Les clés sont triées :
 * sans cela, deux sérialisations du même objet donneraient deux empreintes, et tout serait
 * retraité à chaque passage.
 */
export function recordHash(fields: Record<string, unknown>): string {
  const stable = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${JSON.stringify(fields[k] ?? null)}`)
    .join("\n");
  return contentHash(stable);
}

/**
 * LE TEXTE EST-IL EXPLOITABLE ? Question centrale du routage : c'est elle qui décide si on
 * regarde le document avec un modèle ou si le parsing a suffi.
 *
 * Le critère n'est pas la longueur seule. Un PDF scanné rend souvent quelques dizaines de
 * caractères de bruit — assez pour paraître non vide, pas assez pour dire quoi que ce soit.
 * On regarde donc la DENSITÉ de caractères alphabétiques : un texte fait de symboles et
 * d'espaces n'est pas un texte, c'est un artefact d'extraction.
 */
export function textLooksUsable(text: string, opts: { minChars?: number } = {}): boolean {
  const t = (text ?? "").trim();
  if (t.length < (opts.minChars ?? 80)) return false;
  const letters = (t.match(/[a-zà-öø-ÿA-ZÀ-ÖØ-Þ؀-ۿ]/g) ?? []).length;
  return letters / t.length >= 0.35;
}

/**
 * L'OCR A-T-IL RENDU DU CHARABIA ? Un signe fiable et bon marché : une proportion anormale de
 * mots d'une seule lettre, ou de suites sans voyelle. On ne juge JAMAIS un texte arabe avec
 * cette heuristique — l'alphabet latin appliqué à l'arabe produit exactement ces motifs, et on
 * accuserait une lecture correcte.
 */
export function ocrLooksBroken(text: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < 200) return false;
  if (/[؀-ۿ]/.test(t)) return false; // arabe présent : on ne juge pas
  const words = t.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 40) return false;
  const singles = words.filter((w) => w.length === 1 && /[a-zà-ÿ]/i.test(w)).length;
  const voiceless = words.filter((w) => w.length >= 4 && !/[aeiouyàâäéèêëïîôöùûü]/i.test(w)).length;
  return singles / words.length > 0.25 || voiceless / words.length > 0.3;
}

/** Coupe sans casser un mot — ce qui est stocké doit rester lisible et citable. */
export function clip(text: string, max: number): string {
  const t = (text ?? "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.8 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * EST-CE DU TEXTE BRUT ? — la question que la détection par signature ne peut pas poser.
 *
 * ── LE DÉFAUT QUE CETTE FONCTION CORRIGE ─────────────────────────────────────────────────
 *
 * Un PDF commence par `%PDF`, un ZIP par `PK`, un PNG par son entête. Le texte brut, lui, n'a
 * AUCUNE signature — il commence par son premier mot. `detectMime` le range donc, à juste titre,
 * dans `unknown`. Mais l'adaptateur Drive ne testait que `mime.startsWith("text/")` : un
 * `.txt`, un `.csv` ou un `.md` ne produisait aucun texte, et le routage — voyant un document
 * sans texte — l'envoyait à la VISION.
 *
 * C'est-à-dire : payer un modèle multimodal pour lire un fichier que `Buffer.toString()` lit
 * parfaitement. L'exact contraire de la doctrine §2. Le défaut a été trouvé en mesurant
 * l'ingestion réelle, pas en relisant le code — d'où le banc.
 *
 * ── COMMENT ON TRANCHE ───────────────────────────────────────────────────────────────────
 *
 * Un OCTET NUL suffit à dire non : aucun encodage textuel utilisé ici n'en produit, et tous les
 * formats binaires en sont truffés. Ensuite on décode en UTF-8 et on compte les caractères de
 * remplacement : un binaire mal décodé en produit massivement, un texte accentué français aucun.
 * Deux tests, aucun réglage arbitraire, et un verdict reproductible.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function looksLikePlainText(buffer: Buffer, sampleBytes = 4096): boolean {
  if (buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(sampleBytes, buffer.length));

  // 1. L'octet nul — le test le plus court et le plus sûr.
  if (sample.includes(0)) return false;

  // 2. Les caractères de contrôle qui n'existent pas dans un texte (on garde \t, \n, \r, \f).
  let control = 0;
  for (const b of sample) {
    if (b < 0x09 || (b > 0x0d && b < 0x20)) control += 1;
  }
  if (control > sample.length * 0.01) return false;

  // 3. Le décodage UTF-8. Un binaire produit des « caractères de remplacement » en quantité ; un
  //    texte français accentué n'en produit aucun. On tolère un résidu, car la fenêtre peut
  //    couper un caractère multi-octets en deux — sur exactement une frontière, jamais partout.
  const decoded = sample.toString("utf8");
  const replacements = (decoded.match(/�/g) ?? []).length;
  return replacements <= 2;
}
