/**
 * LE PRESSE-PAPIERS DU DRIVE — Ctrl+C, Ctrl+X, Ctrl+V.
 *
 * Personne n'a appris à copier un fichier : on le sait. Reproduire ce geste-là coûte moins cher
 * que d'enseigner une barre d'outils, et surtout il TRAVERSE les dossiers — on copie ici, on
 * navigue là, on colle. C'est précisément ce qu'un glisser-déposer ne sait pas faire : il faut
 * que la source et la destination soient visibles en même temps.
 *
 * D'où le stockage dans le navigateur plutôt qu'en mémoire : une sélection copiée doit survivre
 * au changement de dossier, sinon le geste ne sert à rien.
 *
 * Module PUR — testé. Il ne touche pas au stockage lui-même : il sait seulement l'écrire et le
 * relire sans jamais faire tomber l'écran sur une valeur abîmée.
 */

export type ClipMode = "copy" | "cut";

export interface Clipboard {
  mode: ClipMode;
  ids: string[];
  /** Noms retenus pour l'affichage — « 3 éléments » ne dit pas lesquels. */
  names: string[];
  /** Dossier d'origine : coller au même endroit n'a de sens qu'en copie. */
  fromFolderId: string | null;
}

export const CLIPBOARD_KEY = "amd-drive-clipboard";

/** Au-delà, la barre d'état devient illisible — on garde les noms utiles, pas tous. */
const NAMES_SHOWN = 3;

export function serializeClipboard(clip: Clipboard): string {
  return JSON.stringify(clip);
}

/**
 * Relit le presse-papiers. Toute valeur douteuse rend `null` plutôt que de lever : un
 * presse-papiers abîmé (autre version de l'app, écriture concurrente) ne doit pas empêcher
 * d'ouvrir le Drive.
 */
export function parseClipboard(raw: string | null): Clipboard | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Clipboard>;
    const ids = Array.isArray(v.ids) ? v.ids.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
    if (ids.length === 0) return null;
    if (v.mode !== "copy" && v.mode !== "cut") return null;
    return {
      mode: v.mode,
      ids,
      names: Array.isArray(v.names) ? v.names.filter((x): x is string => typeof x === "string") : [],
      fromFolderId: typeof v.fromFolderId === "string" ? v.fromFolderId : null,
    };
  } catch {
    return null;
  }
}

/** Ce que la barre d'état écrit — les premiers noms, puis le reste compté. */
export function clipboardLabel(clip: Clipboard): string {
  const verb = clip.mode === "cut" ? "à déplacer" : "à copier";
  if (clip.names.length === 0) return `${clip.ids.length} élément(s) ${verb}`;
  const shown = clip.names.slice(0, NAMES_SHOWN).join(", ");
  const rest = clip.ids.length - Math.min(clip.names.length, NAMES_SHOWN);
  return rest > 0 ? `${shown} + ${rest} autre(s) ${verb}` : `${shown} ${verb}`;
}

/**
 * Peut-on coller ICI ?
 *
 * Deux refus, et ils sont différents :
 *   • **couper puis coller au même endroit** ne ferait rien — autant le dire plutôt que de
 *     lancer un déplacement qui n'aboutit à aucun changement visible ;
 *   • **coller un dossier dans lui-même ou dans ce qu'il contient** boucle sans fin. Le serveur
 *     le refuse aussi, mais l'annoncer avant évite un aller-retour pour rien.
 */
export function canPasteInto(
  clip: Clipboard | null,
  target: { folderId: string | null; ancestorIds: readonly string[] },
): { ok: boolean; reason?: string } {
  if (!clip) return { ok: false, reason: "Rien dans le presse-papiers." };
  if (clip.mode === "cut" && clip.fromFolderId === target.folderId) {
    return { ok: false, reason: "Ces éléments sont déjà ici." };
  }
  if (target.folderId && clip.ids.includes(target.folderId)) {
    return { ok: false, reason: "On ne colle pas un dossier dans lui-même." };
  }
  if (target.ancestorIds.some((a) => clip.ids.includes(a))) {
    return { ok: false, reason: "On ne colle pas un dossier dans un de ses sous-dossiers." };
  }
  return { ok: true };
}

/** La combinaison frappée, ramenée à un geste — `null` quand ce n'en est pas un. */
export function clipShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean }): "copy" | "cut" | "paste" | null {
  if (!e.ctrlKey && !e.metaKey) return null;
  const k = e.key.toLowerCase();
  if (k === "c") return "copy";
  if (k === "x") return "cut";
  if (k === "v") return "paste";
  return null;
}
