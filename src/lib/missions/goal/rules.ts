import type { EtapeObservee } from "@/lib/missions/goal/evaluate";
import { effetDuNoeud } from "@/lib/missions/registry/node-effect";
import { EFFECT_RANK, type Effect } from "@/lib/missions/registry/capability-meta";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES RÈGLES — les critères d'acceptation que le CODE vérifie, reçus en main (chantier latence).
 *
 * ── LE COÛT QUE CE MODULE SUPPRIME ───────────────────────────────────────────────────────
 *
 * Un run réel a payé 8,9 s et 1 983 jetons pour qu'un juge LLM vérifie « les recherches ont
 * été exécutées avec la chaîne exacte X » et « aucune écriture n'a eu lieu » — deux énoncés
 * que les REÇUS STRUCTURÉS prouvent mieux qu'aucune prose : la requête partie et l'effet
 * déclaré y sont écrits par l'exécutant, pas affirmés par un modèle. Demander à un modèle de
 * relire un fait que le code détient est exactement ce que §5 interdit (models decide WHAT,
 * code does HOW).
 *
 * ── CE QUE CE MODULE N'EST PAS ───────────────────────────────────────────────────────────
 *
 * Ce n'est PAS la disparition du juge : c'est le juge devenu ARITHMÉTIQUE là où les critères
 * le sont. Un critère sémantique (« la synthèse répond à la question ») garde son juge LLM —
 * qui ne reçoit plus QUE ces critères-là. Et la doctrine ne bouge pas d'un cran : une mission
 * dont aucun critère n'est vérifiable ne conclut toujours pas ; l'arithmétique garde le
 * dernier mot dans le sens NÉGATIF (un seul FAIL refuse, sans appel) ; le sens POSITIF exige
 * que CHAQUE critère ait son vérificateur — règle prouvée ou juge sémantique, jamais
 * « toutes les étapes ont tourné ».
 *
 * ── LA GRAMMAIRE, STRICTE — le décodeur ne devine jamais ────────────────────────────────
 *
 * Un critère est une RÈGLE s'il commence par `[REGLE:CODE]` ou `[REGLE:CODE:args]`, avec un
 * CODE du registre ci-dessous. Tout le reste — y compris un `[REGLE:...]` au code inconnu —
 * est SÉMANTIQUE et va au juge : une règle mal orthographiée coûte un appel de juge, jamais
 * une conclusion fausse (doctrine `commands/nl.ts` : attraper ce qu'on comprend mal est pire
 * que ne rien attraper).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type VerificationRegle = {
  /** Le critère tel qu'il figure au plan — c'est lui que le verdict cite. */
  critere: string;
  code: string;
  verdict: "PASS" | "FAIL";
  /** La preuve (PASS) ou le manquement (FAIL), nommés — jamais « vérifié » tout court. */
  preuve: string;
};

export interface Partition {
  regles: VerificationRegle[];
  /** Les critères que seul un juge sémantique peut évaluer. */
  semantiques: string[];
}

const GRAMMAIRE = /^\[REGLE:([A-Z_]+)(?::([^\]]*))?\]\s*(.*)$/s;

const LECTURES: ReadonlySet<Effect> = new Set(["READ", "ANALYZE"] as Effect[]);

/** Le terme cité dans le texte du critère — la référence des règles à requête. */
const termeDuCritere = (texte: string): string | null => {
  const m = texte.match(/«\s*([^«»]+?)\s*»/);
  return m ? m[1].trim() : null;
};

type Verificateur = (args: string, texte: string, steps: readonly EtapeObservee[]) => Omit<VerificationRegle, "critere" | "code">;

/**
 * L'ARGUMENT de SORTIE_STRUCTUREE — `cle:champ1,champ2` — se découpe au DERNIER deux-points,
 * jamais au premier : les clés d'étapes des plans de modèle en CONTIENNENT
 * (« analyse:priorisation »), et un run Render a produit un FAUX refus déterministe
 * (« étape « analyse » absente ») sur une mission dont le travail était fait — la grammaire
 * tronquait la clé au premier « : ». Les champs, eux, ne portent jamais de deux-points.
 */
export function argsSortieStructuree(args: string): { cle: string; champs: string[] } {
  const idx = args.lastIndexOf(":");
  const cle = (idx === -1 ? "" : args.slice(0, idx)).trim();
  const champs = (idx === -1 ? "" : args.slice(idx + 1)).split(",").map((s) => s.trim()).filter(Boolean);
  return { cle, champs };
}

/**
 * LE REGISTRE DES CODES. Chaque vérificateur rend sa PREUVE en français : le verdict final
 * les cite telles quelles, et c'est ce qui rend un refus déterministe aussi lisible qu'un
 * refus de juge — étape nommée, fait constaté, rien d'autre.
 */
const REGLES: Record<string, Verificateur> = {
  /**
   * Chaque étape citée (clés en args) est DONE et son reçu porte la requête attendue —
   * le terme « cité » dans le texte du critère. C'est l'énoncé qu'un run Render a vu un juge
   * refuser « faute de preuve » alors que la preuve existait, structurée, dans les reçus.
   */
  RECHERCHES_AVEC_REQUETE: (args, texte, steps) => {
    const terme = termeDuCritere(texte);
    if (!terme) return { verdict: "FAIL", preuve: "le critère ne cite aucun terme entre guillemets : rien à vérifier" };
    const cles = args.split(",").map((s) => s.trim()).filter(Boolean);
    if (cles.length === 0) return { verdict: "FAIL", preuve: "le critère ne cite aucune étape" };
    const manques: string[] = [];
    for (const cle of cles) {
      const s = steps.find((x) => x.key === cle);
      if (!s) { manques.push(`${cle} : étape absente`); continue; }
      if (s.status !== "DONE") { manques.push(`${cle} : ${s.status}`); continue; }
      const requete = s.recu?.query ?? null;
      if (!requete || !requete.toLowerCase().includes(terme.toLowerCase())) {
        manques.push(`${cle} : le reçu ne porte pas « ${terme} » (requête : ${requete ?? "absente"})`);
      }
    }
    return manques.length === 0
      ? { verdict: "PASS", preuve: `${cles.length} recherche(s) DONE, chaque reçu porte « ${terme} » (${cles.join(", ")})` }
      : { verdict: "FAIL", preuve: manques.join(" ; ") };
  },

  /**
   * Aucun effet au-delà d'ANALYZE : chaque reçu présent le déclare, et les étapes SANS reçu
   * sont jugées par l'effet STRUCTUREL de leur type de nœud (la même table que le compilateur
   * — jamais une copie). Un reçu manquant sur une CAPABILITY aboutie est un FAIL, pas un
   * bénéfice du doute : §78, l'absence de mesure n'est pas une mesure.
   */
  AUCUNE_ECRITURE: (_args, _texte, steps) => {
    const ecritures: string[] = [];
    for (const s of steps) {
      if (s.recu) {
        if (!LECTURES.has(s.recu.effect)) ecritures.push(`${s.key} : effet ${s.recu.effect} au reçu`);
        continue;
      }
      if (s.nodeType === "CAPABILITY" && s.status === "DONE") {
        ecritures.push(`${s.key} : capacité aboutie SANS reçu — effet invérifiable`);
        continue;
      }
      const structurel = effetDuNoeud(s.nodeType, null);
      if (EFFECT_RANK[structurel] > EFFECT_RANK.ANALYZE) {
        ecritures.push(`${s.key} : nœud ${s.nodeType} d'effet structurel ${structurel}`);
      }
    }
    return ecritures.length === 0
      ? { verdict: "PASS", preuve: `${steps.length} étape(s), aucun effet au-delà d'ANALYZE (reçus et types de nœud)` }
      : { verdict: "FAIL", preuve: ecritures.join(" ; ") };
  },

  /**
   * L'étape citée a rendu une SORTIE STRUCTURÉE portant chaque champ requis, non vide.
   * C'est le schéma imposé au worker qui rend cette vérification possible — la qualité de la
   * prose reste l'affaire d'un juge sémantique quand le plan en demande un ; la PRÉSENCE
   * d'une conclusion qui tranche, elle, se vérifie ici.
   */
  SORTIE_STRUCTUREE: (args, _texte, steps) => {
    const { cle, champs } = argsSortieStructuree(args);
    if (!cle || champs.length === 0) return { verdict: "FAIL", preuve: "règle incomplète : étape ou champs absents" };
    const s = steps.find((x) => x.key === cle);
    if (!s) return { verdict: "FAIL", preuve: `étape « ${cle} » absente` };
    if (s.status !== "DONE") return { verdict: "FAIL", preuve: `étape « ${cle} » : ${s.status}` };
    const r = s.result;
    if (!r || typeof r !== "object" || Array.isArray(r)) {
      return { verdict: "FAIL", preuve: `étape « ${cle} » : pas de sortie structurée` };
    }
    const objet = r as Record<string, unknown>;
    const manquants = champs.filter((c) => {
      const v = objet[c];
      return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    });
    return manquants.length === 0
      ? { verdict: "PASS", preuve: `« ${cle} » DONE, sortie structurée complète (${champs.join(", ")})` }
      : { verdict: "FAIL", preuve: `« ${cle} » : champ(s) manquant(s) ou vide(s) : ${manquants.join(", ")}` };
  },
};

/** Les codes connus — exportés pour que les tests et le chemin direct restent alignés. */
export const CODES_REGLES = Object.keys(REGLES);

/**
 * VALIDE les références des règles À LA COMPILATION — le refus qui économise un faux refus.
 *
 * Un run Render a montré la séquence : le planificateur adopte la grammaire (bien), cite une
 * étape qui n'existe pas dans son propre plan (mal), la mission tourne ENTIÈREMENT, et le
 * refus déterministe tombe à la FIN — travail fait, mission bloquée. La place de ce contrôle
 * est celle de tous les contrôles de FORME : le compilateur, qui refuse AVANT d'exécuter, et
 * dont le refus repart au planificateur avec le problème nommé (la retouche existe déjà).
 *
 * Un code INCONNU ne produit aucun problème : c'est un critère sémantique, il ira au juge —
 * la dégradation sûre ne change pas.
 */
export function validerReglesDacceptation(
  criteres: readonly string[],
  clesEtapes: ReadonlySet<string>,
): string[] {
  const problemes: string[] = [];
  const disponibles = (): string => [...clesEtapes].slice(0, 12).join(", ");
  for (const critere of criteres) {
    const m = critere.match(GRAMMAIRE);
    if (!m || !REGLES[m[1]]) continue;
    const code = m[1];
    const args = m[2] ?? "";
    if (code === "RECHERCHES_AVEC_REQUETE") {
      if (!termeDuCritere(m[3] ?? critere)) {
        problemes.push(`[REGLE:${code}] : le texte du critère doit citer le terme entre « » — sans lui, rien à vérifier.`);
      }
      for (const cle of args.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (!clesEtapes.has(cle)) {
          problemes.push(`[REGLE:${code}] cite l'étape « ${cle} », absente du plan — clés disponibles : ${disponibles()}.`);
        }
      }
    }
    if (code === "SORTIE_STRUCTUREE") {
      const { cle, champs } = argsSortieStructuree(args);
      if (!cle || champs.length === 0) {
        problemes.push(`[REGLE:${code}] : forme attendue « cléEtape:champ1,champ2 » — étape ou champs absents.`);
      } else if (!clesEtapes.has(cle)) {
        problemes.push(`[REGLE:${code}] cite l'étape « ${cle} », absente du plan — clés disponibles : ${disponibles()}.`);
      }
    }
  }
  return problemes;
}

/**
 * PARTITIONNE les critères : règles vérifiées sur-le-champ, sémantiques rendus au juge.
 * Pure — steps observés en entrée, verdicts en sortie, aucun appel de rien.
 */
export function partitionnerCriteres(
  criteres: readonly string[],
  steps: readonly EtapeObservee[],
): Partition {
  const regles: VerificationRegle[] = [];
  const semantiques: string[] = [];
  for (const critere of criteres) {
    const m = critere.match(GRAMMAIRE);
    const verificateur = m ? REGLES[m[1]] : undefined;
    if (!m || !verificateur) {
      semantiques.push(critere);
      continue;
    }
    const { verdict, preuve } = verificateur(m[2] ?? "", m[3] ?? critere, steps);
    regles.push({ critere, code: m[1], verdict, preuve });
  }
  return { regles, semantiques };
}
