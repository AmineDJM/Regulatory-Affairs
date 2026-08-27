import { depositBufferToDrive } from "@/lib/assistant/exports";
import type { ArtifactSink } from "@/lib/missions/artifacts/build";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * OÙ ATTERRIT UN LIVRABLE — le port `ArtifactSink`, rempli par le dépôt Drive qui existe déjà.
 *
 * ── POURQUOI CE FICHIER FAIT SIX LIGNES ─────────────────────────────────────────────────
 *
 * Parce que le travail était déjà fait. `depositBufferToDrive` sait créer le dossier personnel,
 * stocker le blob, versionner un fichier de même nom et rendre son nœud. En réécrire une
 * variante « pour les missions » aurait produit deux façons de ranger un fichier — et un jour,
 * deux comportements différents sur le versionnement.
 *
 * Le port existe pour une seule raison : `depositBufferToDrive` vit du côté ADAM de la
 * frontière, et le moteur d'artefacts est une façade de l'ERP. Le port est le passage, ce
 * fichier est son unique implémentation, et le composeur la branche.
 *
 * ── LE DOSSIER, ET POURQUOI IL EST NOMMÉ PAR LA MISSION ─────────────────────────────────
 *
 * Tous les livrables d'une mission vont dans le même dossier, nommé de façon lisible. Les
 * éparpiller par date obligerait à chercher ; les mettre à la racine noierait le Drive de la
 * personne sous des fichiers dont elle ne se souvient plus.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const depotDrive: ArtifactSink = {
  async deposer(input) {
    return depositBufferToDrive(input.ownerId, {
      folder: input.folder,
      filename: input.fileName,
      data: input.data,
      mime: input.mime,
      category: "Livrable de mission",
    });
  },
};
