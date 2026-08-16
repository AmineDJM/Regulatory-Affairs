/**
 * LES TROIS APPLICATIONS BUREAUTIQUES, COMME UN MENU DÉMARRER.
 *
 * Word, Excel, PowerPoint. Les documents vivent dans le Drive de l'ERP — donc sous ses droits,
 * son cloisonnement par entité, son journal d'audit et son chiffrement — et s'ouvrent dans
 * l'éditeur intégré, qui lit et écrit les VRAIS formats (`.docx`, `.xlsx`, `.pptx`).
 *
 * ⚠️ Ce n'est pas Microsoft Office lui-même : Microsoft ne permet d'embarquer Word/Excel/
 * PowerPoint « pour le web » que sur des fichiers hébergés chez lui (OneDrive/SharePoint), via un
 * programme partenaire fermé. Nos fichiers sont chiffrés dans NOTRE stockage, sous NOS
 * permissions — c'est incompatible, et y renoncer signifierait déplacer les dossiers
 * réglementaires et les contrats RH chez un tiers. L'éditeur intégré donne les mêmes formats et
 * l'édition collaborative, sans cette concession.
 *
 * Module PUR — testé.
 */

export type OfficeAppKey = "word" | "cell" | "slide";

export interface OfficeApp {
  key: OfficeAppKey;
  /** Nom de l'application, tel qu'on le dit à l'oral. */
  label: string;
  /** Ce qu'on vient y faire — pas la définition du format. */
  hint: string;
  icon: string;
  ext: string;
  /** Teinte de la vignette (classes Tailwind), une par application, comme les vraies icônes. */
  tone: string;
  /** Nom donné par défaut à un document neuf. */
  defaultName: string;
}

export const OFFICE_APPS: OfficeApp[] = [
  {
    key: "word", label: "Word", hint: "Rédiger une note, un compte rendu, un courrier.",
    icon: "FileText", ext: "docx", tone: "text-blue-600 dark:text-blue-400", defaultName: "Document sans titre",
  },
  {
    key: "cell", label: "Excel", hint: "Un tableau, des calculs, un suivi chiffré.",
    icon: "FileSpreadsheet", ext: "xlsx", tone: "text-emerald-600 dark:text-emerald-400", defaultName: "Classeur sans titre",
  },
  {
    key: "slide", label: "PowerPoint", hint: "Une présentation à projeter ou à envoyer.",
    icon: "Presentation", ext: "pptx", tone: "text-orange-600 dark:text-orange-400", defaultName: "Présentation sans titre",
  },
];

export function officeApp(key: string): OfficeApp | undefined {
  return OFFICE_APPS.find((a) => a.key === key);
}

/** L'application correspondant à un nom de fichier, s'il en existe une. */
export function appOfFile(name: string): OfficeApp | undefined {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return OFFICE_APPS.find((a) => a.ext === ext);
}

/**
 * LES ÉPINGLES — chacun met dans son menu les applications qu'il utilise.
 *
 * La préférence est locale au navigateur : elle ne concerne QUE l'affichage, ne donne aucun droit,
 * et n'a donc pas à voyager en base ni à traverser le réseau à chaque page. Une valeur abîmée
 * (édition à la main, ancienne version) est ignorée plutôt que de casser le menu.
 */
export const OFFICE_PINS_KEY = "amd-office-pins";

export function parsePinned(raw: string | null | undefined): OfficeAppKey[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const known = v.filter((k): k is OfficeAppKey => typeof k === "string" && OFFICE_APPS.some((a) => a.key === k));
    return [...new Set(known)];
  } catch {
    return [];
  }
}

/** Épingle / retire, en conservant l'ordre d'ajout — le menu ne se réorganise pas tout seul. */
export function togglePinned(current: readonly OfficeAppKey[], key: OfficeAppKey): OfficeAppKey[] {
  return current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
}

/** Les applications épinglées, dans l'ordre choisi — prêtes à devenir des entrées de menu. */
export function pinnedApps(keys: readonly OfficeAppKey[]): OfficeApp[] {
  return keys.map((k) => officeApp(k)).filter((a): a is OfficeApp => Boolean(a));
}

/** Lien d'ouverture d'une application : l'écran Office, centré sur elle. */
export function officeHref(key: OfficeAppKey): string {
  return `/office?app=${key}`;
}
