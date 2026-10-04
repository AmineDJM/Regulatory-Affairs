/**
 * LA POLITIQUE DE TÉLÉVERSEMENT — une seule liste, lue par le serveur ET par le navigateur.
 *
 * Il y en avait deux (audit du 04/10, constat 9) : une liste BLANCHE de quinze extensions pour
 * les pièces jointes métier, une liste NOIRE d'exécutables pour le Drive et les Documents. Un
 * `.rar`, un `.7z`, un `.msg` passaient d'un côté et étaient refusés de l'autre — la même pièce,
 * déposée à deux endroits, recevait deux réponses. Le moteur d'audit de la plateforme le
 * signalait déjà (« aligner sur la stratégie blocklist »).
 *
 * La règle retenue est celle qui protège sans refuser à tort : on bloque ce qui S'EXÉCUTE
 * (programmes, scripts, raccourcis), on accepte le reste. Seule la TAILLE varie selon l'endroit,
 * et elle se lit dans les réglages.
 *
 * Module PUR, sans import : le navigateur s'en sert pour refuser AVANT l'envoi (constat 11) avec
 * exactement la phrase que le serveur aurait rendue.
 */

export const EXTENSIONS_BLOQUEES: ReadonlySet<string> = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "cpl", "jar", "js", "mjs", "cjs",
  "vbs", "vbe", "ws", "wsf", "wsh", "ps1", "psm1", "sh", "bash", "app", "dmg",
  "deb", "rpm", "apk", "dll", "sys", "scf", "lnk", "reg", "hta", "jse", "msc", "gadget",
]);

const MO = 1024 * 1024;

export function extensionDe(nom: string): string {
  const i = nom.lastIndexOf(".");
  return i > 0 ? nom.slice(i + 1).toLowerCase() : "";
}

/** « 25 Mo », « 1,5 Go » — la taille dite comme une personne la lit. */
export function tailleLisible(octets: number): string {
  if (octets >= 1024 * MO) return `${(octets / (1024 * MO)).toFixed(1).replace(".", ",")} Go`;
  if (octets >= MO) return `${Math.round(octets / MO)} Mo`;
  return `${Math.max(1, Math.ceil(octets / 1024))} Ko`;
}

/**
 * Pourquoi ce fichier est refusé, ou `null`. `maxMo` est la limite de l'endroit (réglage).
 * Les phrases sont celles que la personne lit : elles disent la taille du fichier ET la limite.
 */
export function refusTeleversement(nom: string, octets: number, maxMo: number): string | null {
  const ext = extensionDe(nom);
  if (ext && EXTENSIONS_BLOQUEES.has(ext)) {
    return `Type de fichier non autorisé (.${ext}) : les programmes et scripts sont refusés pour des raisons de sécurité.`;
  }
  if (octets <= 0) return "Fichier vide (0 octet).";
  if (octets > maxMo * MO) {
    return `Fichier trop volumineux (${tailleLisible(octets)} pour un maximum de ${maxMo} Mo).`;
  }
  return null;
}
