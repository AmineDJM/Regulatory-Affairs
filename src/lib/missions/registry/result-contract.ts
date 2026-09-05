/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA FRONTIÈRE ENTRE « L'APPEL A RÉUSSI » ET « LA CAPACITÉ A RÉPONDU ».
 *
 * ── LE DÉFAUT MESURÉ, ET IL A L'AIR D'UN SUCCÈS ─────────────────────────────────────────
 *
 * Run Render, scénario SATISFIABLE. `list_artifacts` retrouve la synthèse. `read_document` est
 * appelée dessus. Elle rend la phrase :
 *
 *     "Pièce introuvable ou sans fichier."
 *
 * Le transport ne lève rien. Le texte n'est pas vide. L'exécutant l'emballe en `{ texte: … }`,
 * rend `ok: true`, et l'étape passe **DONE**. Le juge d'objectif reçoit alors, comme preuve de
 * lecture, une phrase disant que la lecture n'a pas eu lieu.
 *
 * ── QUATRE NIVEAUX QUE PERSONNE NE DISTINGUAIT ──────────────────────────────────────────
 *
 *   1. SUCCÈS DE TRANSPORT      le handler n'a pas levé d'exception.
 *   2. SUCCÈS DE CAPACITÉ       elle n'a pas déclaré d'échec.
 *   3. SUCCÈS SÉMANTIQUE        ce qu'elle rend SATISFAIT ce qu'elle promet.
 *   4. RÉSULTAT STRUCTURÉ VALIDE il a la forme que l'étape attendait (`spec.attendu`).
 *
 * Le runtime tenait 1 (le `try`), 4 (`recovery/evaluate.ts`, et seulement quand le plan avait
 * écrit `attendu`). Entre les deux, RIEN. Ce fichier tient 3.
 *
 * ── LA RÈGLE QUI ÉVITE DE DEVINER — et c'est la même qu'ailleurs ────────────────────────
 *
 * On ne reconnaît PAS « introuvable », « aucun », « indisponible ». `empty-result.ts` explique
 * pourquoi : déduire un fait d'une tournure française, c'est fabriquer une preuve, et le jour où
 * une capacité écrit « aucun filtre appliqué » on signerait une absence qui n'existe pas.
 *
 * Ce qu'on mesure est de nature tout autre, et c'est un FAIT, pas une interprétation :
 * **la capacité a-t-elle rendu une STRUCTURE, ou une phrase ?** Une capacité sous contrat
 * répond en JSON quand elle réussit — c'est son contrat. Une phrase nue signifie donc qu'elle
 * n'a pas suivi son contrat, quel que soit le sens de la phrase, et même si la phrase est en
 * arabe, en anglais, ou vide de tout mot-clé.
 *
 * ── POURQUOI UN CONTRAT DÉCLARÉ, ET PAS UNE RÈGLE GLOBALE ───────────────────────────────
 *
 * Cent quarante capacités rendent aujourd'hui de la prose en toute légitimité. Leur imposer la
 * structure d'un coup ferait échouer des missions parfaitement valides pour un défaut qui n'est
 * pas le leur. Le contrat est donc DÉCLARÉ, capacité par capacité, et le défaut est `LIBRE` —
 * qui ne contrôle rien. Une capacité gagne son contrôle le jour où quelqu'un a vérifié sa forme.
 *
 * C'est l'inverse du défaut prudent de `capability-meta.ts`, et c'est voulu : là-bas, ne pas
 * savoir peut faire AGIR à tort, donc on serre ; ici, ne pas savoir ne peut que faire ÉCHOUER à
 * tort, donc on se tait. Dans les deux cas, l'ignorance choisit le côté qui ne ment pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { cheminsDeListes } from "@/lib/missions/runtime/collection";
import type { ErrorKind } from "@/lib/missions/recovery/strategy";

/**
 * CE QU'UNE CAPACITÉ PROMET DE RENDRE.
 *
 * Volontairement grossier : quatre formes suffisent à attraper la classe de défaut visée, et un
 * vocabulaire plus fin serait un schéma par capacité — donc cent soixante-cinq schémas à tenir.
 */
export const CONTRATS = [
  /** Du CONTENU à lire : un texte extrait, un corps de document. Vide ⇒ la lecture n'a pas eu lieu. */
  "CONTENU",
  /** Une COLLECTION dénombrable : `items` + `count`. Zéro est un succès — mesuré, pas deviné. */
  "COLLECTION",
  /** Une FICHE : un objet identifié, avec au moins un champ d'identité. */
  "FICHE",
  /** Rien de promis, donc rien de vérifié. Le défaut. */
  "LIBRE",
] as const;
export type Contrat = (typeof CONTRATS)[number];

/**
 * L'ÉTAT D'UN RÉSULTAT — la taxonomie que le lot réclame, et elle se traduit en cause §75.
 *
 * `PARTIAL` n'est pas produit par le contrôle de forme (il vient de `recovery/evaluate.ts`, qui
 * sait ce que l'étape attendait) mais il fait partie du vocabulaire : un appelant qui compose
 * les deux verdicts doit pouvoir les ranger sur la même échelle.
 */
export const ETATS_RESULTAT = ["SUCCESS", "PARTIAL", "NOT_FOUND", "INCOMPATIBLE_RESULT", "FAILED"] as const;
export type EtatResultat = (typeof ETATS_RESULTAT)[number];

export interface VerdictContrat {
  etat: EtatResultat;
  /** La cause §75 correspondante — `null` quand l'état est `SUCCESS`. */
  kind: ErrorKind | null;
  /** Pourquoi, en français : c'est ce que le journal et le recours liront. */
  raison: string;
}

const SUCCES: VerdictContrat = { etat: "SUCCESS", kind: null, raison: "" };

/** Les noms sous lesquels une capacité rend du CONTENU lisible. Fermé, donc prévisible. */
const CHAMPS_CONTENU = ["texte", "text", "contenu", "content", "corps", "body", "extrait"];

/** Les noms sous lesquels une FICHE porte son identité. */
const CHAMPS_IDENTITE = ["id", "reference", "nom", "name", "titre", "title", "artifact_id", "driveNodeId", "intentId"];

function champTexte(o: Record<string, unknown>, noms: readonly string[]): string | null {
  for (const c of noms) {
    const v = o[c];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
}

/**
 * VÉRIFIE QU'UN RÉSULTAT TECHNIQUEMENT RÉUSSI HONORE LE CONTRAT DE SA CAPACITÉ.
 *
 * `structure` dit si la capacité a rendu du JSON (`true`) ou une phrase nue (`false`). C'est
 * l'exécutant qui le sait — lui seul a vu le texte brut avant de l'emballer — et c'est pour cela
 * qu'il le transporte au lieu de le laisser deviner ici. `undefined` signifie « non mesuré » :
 * on ne s'en sert alors pas, plutôt que de le lire comme un `false` qui condamnerait à tort.
 */
export function verifierContrat(
  contrat: Contrat,
  sortie: unknown,
  structure?: boolean,
): VerdictContrat {
  // RIEN N'EST PROMIS ⇒ RIEN N'EST VÉRIFIÉ. Ce n'est pas une tolérance, c'est l'honnêteté :
  // contrôler une forme que personne n'a déclarée reviendrait à l'inventer.
  if (contrat === "LIBRE") return SUCCES;

  /**
   * ── LA PHRASE NUE — le cas de `read_document`, et il se voit sans être lu ──────────────
   *
   * Une capacité sous contrat répond en structure. Qu'elle ait rendu une phrase est un constat
   * de FORME : on ne l'ouvre pas, on ne cherche pas « introuvable » dedans, on ne la traduit
   * pas. Elle est citée dans la raison pour l'humain, et c'est tout ce qu'on en fait.
   */
  if (structure === false) {
    const phrase = typeof sortie === "object" && sortie !== null
      ? (champTexte(sortie as Record<string, unknown>, CHAMPS_CONTENU) ?? "")
      : String(sortie ?? "");
    return {
      etat: "INCOMPATIBLE_RESULT",
      kind: "INCOMPATIBLE_RESULT",
      raison: `la capacité s'engage à rendre une structure (${contrat}) et a rendu une phrase`
        + (phrase ? ` : « ${phrase.slice(0, 200)} »` : " vide")
        + " — l'appel a abouti, la réponse n'honore pas le contrat.",
    };
  }

  if (sortie === null || sortie === undefined) {
    return { etat: "INCOMPATIBLE_RESULT", kind: "INCOMPATIBLE_RESULT", raison: "la capacité n'a rien rendu du tout." };
  }

  switch (contrat) {
    case "CONTENU": {
      if (typeof sortie === "string") {
        return sortie.trim() === ""
          ? { etat: "INCOMPATIBLE_RESULT", kind: "INCOMPATIBLE_RESULT", raison: "contenu vide." }
          : SUCCES;
      }
      if (typeof sortie !== "object") {
        return { etat: "INCOMPATIBLE_RESULT", kind: "INCOMPATIBLE_RESULT", raison: `contenu attendu, ${typeof sortie} reçu.` };
      }
      const texte = champTexte(sortie as Record<string, unknown>, CHAMPS_CONTENU);
      if (texte === null) {
        return {
          etat: "INCOMPATIBLE_RESULT",
          kind: "INCOMPATIBLE_RESULT",
          raison: `aucun contenu lisible dans la réponse (attendus : ${CHAMPS_CONTENU.slice(0, 4).join(", ")}…) `
            + "— la capacité a répondu sans avoir lu.",
        };
      }
      return SUCCES;
    }

    case "COLLECTION": {
      /**
       * ── ZÉRO EST UN SUCCÈS, ET C'EST TOUT L'INTÉRÊT ─────────────────────────────────
       *
       * Une recherche qui rend `items: []` et `count: 0` a parfaitement fonctionné : elle a
       * MESURÉ une absence, et c'est cette mesure qui devient une preuve négative citable
       * (`runtime/receipt.ts`). Ce qui n'est pas un succès, c'est de rendre une prose à la
       * place du compte — parce qu'alors personne n'a compté.
       */
      const chemins = cheminsDeListes(sortie);
      if (chemins.length === 0 && !Array.isArray(sortie)) {
        return {
          etat: "INCOMPATIBLE_RESULT",
          kind: "INCOMPATIBLE_RESULT",
          raison: "collection attendue, aucun tableau dénombrable dans la réponse — "
            + "sans compte mesuré, une absence ne peut pas servir de preuve.",
        };
      }
      return SUCCES;
    }

    case "FICHE": {
      if (typeof sortie !== "object" || Array.isArray(sortie)) {
        return { etat: "INCOMPATIBLE_RESULT", kind: "INCOMPATIBLE_RESULT", raison: "fiche attendue, forme reçue incompatible." };
      }
      if (champTexte(sortie as Record<string, unknown>, CHAMPS_IDENTITE) === null) {
        return {
          etat: "INCOMPATIBLE_RESULT",
          kind: "INCOMPATIBLE_RESULT",
          raison: "fiche sans identité — rien dans la réponse ne désigne CE qui a été trouvé.",
        };
      }
      return SUCCES;
    }
  }
}
