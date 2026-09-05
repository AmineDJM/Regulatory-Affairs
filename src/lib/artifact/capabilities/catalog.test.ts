/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE CAPACITÉ DÉCLARÉE DOIT AVOIR UN POINT D'ENTRÉE (§56, et §14 de CLAUDE.md).
 *
 * ── POURQUOI CE TEST EXISTE ─────────────────────────────────────────────────────────────
 *
 * Une liste de capacités est le genre de fichier qui vieillit mal : on y ajoute une ligne en
 * écrivant le code, on renomme la fonction trois semaines plus tard, et la liste continue
 * d'annoncer quelque chose que plus rien n'exécute. Personne ne s'en aperçoit — jusqu'à ce
 * qu'on la lise pour savoir ce que le système sait faire.
 *
 * Le recensement du projet avait déjà trouvé des exports sans aucun appelant. Ici, la règle
 * est rendue mécanique : chaque entrée de `CAPACITES_ARTEFACT` doit nommer une fonction
 * réellement exportée par le moteur ou par la façade. Retirer la fonction sans retirer la
 * ligne fait échouer la suite, et l'inverse aussi.
 *
 * ── CE QUE CE TEST NE PRÉTEND PAS ───────────────────────────────────────────────────────
 *
 * Il vérifie qu'un point d'entrée EXISTE, pas qu'il fonctionne : c'est le rôle de
 * `runtime/engine.test.ts`, qui joue la conversation de référence de bout en bout. Les deux
 * sont nécessaires — l'un dit « c'est branché », l'autre « ça marche ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from "vitest";
import { CAPACITES_ARTEFACT, LIBELLE_CAPACITE, type CapaciteArtefact } from "@/lib/artifact/capabilities/catalog";
import * as moteurLiveOffice from "@/lib/artifact/runtime/engine";
import * as moteurExcel from "@/lib/artifact/sheets/analyse";
import * as constructeurExcel from "@/lib/artifact/sheets/build";
import * as lecteurPdf from "@/lib/artifact/pdf/read";
import * as constructeurDeck from "@/lib/artifact/decks/build";
import * as controle from "@/lib/artifact/qa/checks";

/** Les moteurs et les constructeurs, réunis : une capacité nomme une fonction de l'un d'eux. */
const moteur = { ...moteurLiveOffice, ...moteurExcel, ...constructeurExcel, ...lecteurPdf, ...constructeurDeck, ...controle };

/**
 * La fonction qui RÉALISE chaque capacité. `save` et `save_as` partagent `sauvegarder` — c'est
 * la même écriture, avec ou sans nouveau nom ; les séparer aurait dupliqué le verrou optimiste.
 */
const POINT_D_ENTREE: Record<CapaciteArtefact, keyof typeof moteur> = {
  "artifact.open": "ouvrir",
  "artifact.inspect": "vueDeSession",
  "artifact.edit": "editer",
  "artifact.undo": "annuler",
  "artifact.redo": "retablir",
  "artifact.save": "sauvegarder",
  "artifact.save_as": "sauvegarder",
  "artifact.compare": "comparerDepuis",
  "artifact.close": "fermer",
  "artifact.sheet_audit": "analyserClasseur",
  "artifact.sheet_trace": "tracerCellule",
  "artifact.sheet_diff": "comparerFichiersXlsx",
  "artifact.sheet_read": "lirePlage",
  "artifact.sheet_build": "construireClasseurVerifie",
  "artifact.pdf_read": "lireTextePdf",
  "artifact.pdf_search": "chercherDansPdf",
  "artifact.deck_build": "construireDeckVerifie",
  "artifact.qa": "controlerAvantLivraison",
};

describe("le catalogue des capacités", () => {
  it("nomme, pour chaque capacité, une fonction RÉELLEMENT exportée par le moteur", () => {
    for (const capacite of CAPACITES_ARTEFACT) {
      const nom = POINT_D_ENTREE[capacite];
      expect(nom, `${capacite} n'a pas de point d'entrée déclaré`).toBeTruthy();
      expect(typeof moteur[nom], `${capacite} → ${String(nom)} n'est pas une fonction du moteur`).toBe("function");
    }
  });

  it("ne déclare aucune capacité sans libellé, ni aucun libellé sans capacité", () => {
    expect(Object.keys(LIBELLE_CAPACITE).sort()).toEqual([...CAPACITES_ARTEFACT].sort());
  });

  it("n'annonce PAS l'export : sans moteur de rendu bureautique, il ne serait pas tenu", () => {
    // Le jour où la conversion existera pour de vrai, ce test tombera — et c'est le bon moment
    // pour remettre la capacité dans la liste, pas avant.
    expect(CAPACITES_ARTEFACT).not.toContain("artifact.export");
  });
});
