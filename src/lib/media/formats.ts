/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * RECONNAÎTRE UN MÉDIA À SON NOM — module PUR, au socle, sans un seul import.
 *
 * ── POURQUOI IL EXISTE ──────────────────────────────────────────────────────────────────
 *
 * « Ce fichier est-il un audio ou une vidéo ? » est une question de NOM, pas de moteur de
 * parole. Trois couches se la posent et aucune n'a le droit d'importer les deux autres :
 * l'indexation du Drive (pour router vers le transcripteur au lieu de lire des octets),
 * l'adaptateur de média (pour choisir sa route), et le client du moteur de reconnaissance.
 *
 * Le vocabulaire vivait dans `media/stt.ts`, qui importe le normaliseur de segments : un
 * `import` d'Adam vers ce fichier a fait passer `boundary.test.ts` de 428 à 429 franchissements
 * et le cliquet a refusé, à juste titre. La réponse de la doctrine n'est pas de relever le
 * plafond mais de SCINDER : la part pure descend au socle, et le module serveur la RÉEXPORTE
 * pour ses appelants existants (§118.72, §118.97).
 *
 * Deux tables auraient divergé au premier format ajouté : le Drive verrait un `.opus` comme un
 * fichier quelconque pendant que le transcripteur saurait le lire.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Extension → type MIME. La liste FAIT FOI : ce qui n'y est pas n'est pas un média. */
export const MIMES_MEDIA: Readonly<Record<string, string>> = {
  mp3: "audio/mpeg", mpga: "audio/mpeg", mpeg: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", flac: "audio/flac", aac: "audio/aac", opus: "audio/ogg",
  webm: "video/webm", mp4: "video/mp4", mov: "video/quicktime", m4v: "video/mp4", mkv: "video/x-matroska",
};

export const EXTENSIONS_VIDEO: ReadonlySet<string> = new Set(["webm", "mp4", "mov", "m4v", "mkv"]);

export const extensionDe = (nom: string): string => (nom.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");
export const estMedia = (nom: string): boolean => Boolean(MIMES_MEDIA[extensionDe(nom)]);
export const estVideo = (nom: string): boolean => EXTENSIONS_VIDEO.has(extensionDe(nom));
