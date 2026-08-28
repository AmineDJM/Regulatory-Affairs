/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'IDENTITÉ D'UN LIVRABLE — la même, de sa fabrication à sa relecture.
 *
 * ── LA CHAÎNE, ET L'ENDROIT EXACT OÙ ELLE SE ROMPAIT ────────────────────────────────────
 *
 *     draft_deliverable  →  AssistantArtifact(id)  →  list_artifacts  →  read_document
 *
 * Trois ruptures, toutes de la même nature : une identité créée puis NON PUBLIÉE, ou publiée
 * sous une forme que le maillon suivant ne sait pas consommer.
 *
 *   1. `draft_deliverable` créait l'artefact avec son `id` et rendait `{ livrable, version,
 *      fichiers }` — SANS l'id. L'étape qui vient de fabriquer le document ne pouvait donc pas
 *      dire lequel elle avait fabriqué.
 *   2. `list_artifacts` publiait `artifact_id`, mais l'identifiant dont `read_document` a besoin
 *      — le `driveNodeId` — n'existait que caché dans une chaîne d'URL (`/drive/<id>`). Le
 *      récupérer supposait qu'un modèle découpe une URL. Une identité qu'il faut extraire d'un
 *      chemin n'est pas une identité : c'est une convention d'affichage.
 *   3. `read_document` n'acceptait ni l'un ni l'autre : `driveNodeId` ou `documentId`. Passer un
 *      `artifact_id` — le seul identifiant que `list_artifacts` publiait — tombait donc dans le
 *      `prisma.document.findUnique` du second, ne trouvait rien, et rendait « Pièce introuvable
 *      ou sans fichier ». Sur un run réel : `list_artifacts` retrouve la synthèse,
 *      `read_document` échoue, et l'étape passe DONE.
 *
 * ── POURQUOI UNE FONCTION PARTAGÉE, ET PAS DEUX SÉRIALISATIONS ──────────────────────────
 *
 * Les deux outils construisaient chacun leur vue des fichiers, avec les mêmes trois lignes
 * recopiées. Deux copies identiques le jour où on les écrit sont deux vues divergentes le jour
 * où l'une gagne un champ. `referenceLivrable` est la SEULE forme sous laquelle un livrable est
 * publié — celui qui le crée et celui qui le liste rendent, littéralement, le même objet.
 *
 * ── CE QUI EST STABLE, ET CE QUI NE L'EST PAS ───────────────────────────────────────────
 *
 * `artifactId` survit aux versions : une v2 réécrit la ligne, pas son identité. `driveNodeId`
 * change à chaque version — c'est un fichier différent. La résolution critique passe donc par
 * `artifactId`, jamais par le titre : deux livrables peuvent porter le même nom, et un rapport
 * « Vérification Zorbamyxine-K7 » ressemble énormément à un autre rapport du même nom.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Un fichier produit, tel qu'il est rangé dans `AssistantArtifact.files`. */
export interface FichierLivrable {
  format: string;
  filename: string;
  nodeId: string;
}

/** La référence PUBLIÉE d'un livrable — ce que voient `draft_deliverable` et `list_artifacts`. */
export interface ReferenceLivrable {
  artifact_id: string;
  titre: string;
  version: number;
  formats: string;
  fichiers: {
    format: string;
    nom: string;
    /** L'IDENTIFIANT, en clair. C'est lui que `read_document` consomme — pas un fragment d'URL. */
    driveNodeId: string;
    lien: string;
    telechargement: string;
  }[];
}

/** Lit `AssistantArtifact.files` sans faire confiance à sa forme — c'est du JSON en base. */
export function fichiersDe(brut: unknown): FichierLivrable[] {
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((f) => {
    if (!f || typeof f !== "object") return [];
    const o = f as Record<string, unknown>;
    const nodeId = typeof o.nodeId === "string" ? o.nodeId : "";
    if (!nodeId) return [];
    return [{
      format: typeof o.format === "string" ? o.format : "?",
      filename: typeof o.filename === "string" ? o.filename : nodeId,
      nodeId,
    }];
  });
}

/**
 * LA RÉFÉRENCE D'UN LIVRABLE — une seule construction, deux appelants.
 *
 * `lien` et `telechargement` restent : ils servent à l'humain et à l'interface. `driveNodeId`
 * s'ajoute à côté, et c'est LUI le contrat machine.
 */
export function referenceLivrable(a: {
  id: string;
  title: string;
  version: number;
  formats: string;
  files: unknown;
}): ReferenceLivrable {
  return {
    artifact_id: a.id,
    titre: a.title,
    version: a.version,
    formats: a.formats,
    fichiers: fichiersDe(a.files).map((f) => ({
      format: f.format,
      nom: f.filename,
      driveNodeId: f.nodeId,
      lien: `/drive/${f.nodeId}`,
      telechargement: `/api/drive/${f.nodeId}/raw`,
    })),
  };
}

/**
 * QUEL FICHIER LIRE QUAND ON DEMANDE « LE » LIVRABLE ?
 *
 * Un livrable au format `ALL` porte trois fichiers issus de LA MÊME spec. Pour une LECTURE, le
 * DOCX est celui qui rend le texte le plus fidèlement ; le XLSX rend des cellules, le PPTX des
 * puces tronquées. L'ordre est donc une préférence de lisibilité, pas une hiérarchie de vérité.
 *
 * Rend `null` plutôt qu'un premier arbitraire quand la liste est vide — un livrable sans fichier
 * existe (une écriture interrompue), et lire « le premier de zéro » est le genre de repli qui
 * fait annoncer une lecture qui n'a pas eu lieu.
 */
export function fichierALire(fichiers: FichierLivrable[]): FichierLivrable | null {
  const ordre = ["DOCX", "XLSX", "PPTX"];
  for (const f of ordre) {
    const trouve = fichiers.find((x) => x.format.toUpperCase() === f);
    if (trouve) return trouve;
  }
  return fichiers[0] ?? null;
}
