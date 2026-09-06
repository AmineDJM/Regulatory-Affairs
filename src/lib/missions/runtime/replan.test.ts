import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ECHELLE, ERROR_KINDS, prochaineStrategie, type ErrorKind, type Strategy } from "@/lib/missions/recovery/strategy";
import { criteresQuiSurvivent } from "@/lib/missions/goal/rules";
import { ETATS_REPLANIFIABLES, PLANS_MAX, estReplanifiable } from "@/lib/missions/runtime/replan";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA BOUCLE « ÇA N'A PAS MARCHÉ → NOUVEAU PLAN » EXISTAIT, ET N'ÉTAIT PAS FERMÉE.
 *
 * Trois ruptures indépendantes, chacune suffisante à elle seule pour qu'une mission de
 * composition meure sans jamais revoir le planificateur :
 *
 *   1. LA TAXINOMIE. `tenterRecours` commence par « ce motif est-il dans ERROR_KINDS ? ».
 *      Onze motifs réellement écrits par le runtime n'y étaient pas — dont `INVALID_STEP`
 *      (la référence morte) et `ARTIFACT_QA_FAILED` (« un classeur sans feuille exploitable »).
 *      Pour eux, la persévérance §9 était intégralement inopérante.
 *   2. L'ÉCHELLE. Un barreau que le moteur n'exécute pas n'était pas INSCRIT à l'historique,
 *      donc `prochaineStrategie` le reproposait indéfiniment : l'échelle bouclait sur son
 *      troisième barreau et les suivants étaient inatteignables.
 *   3. LA SÉLECTION DU BATTEMENT. Elle exigeait une étape PENDING ou FAILED. Une mission dont
 *      TOUTES les étapes ont abouti mais que le juge refuse n'en a aucune : elle n'était
 *      jamais candidate, donc jamais conduite, donc jamais replanifiée — alors que
 *      `replanifierMission` prévoit explicitement ce cas.
 *
 * Ces tests tiennent les trois, et le quatrième invariant qui les accompagne : un replan
 * n'abaisse pas la barre, mais ne reporte pas non plus une règle devenue insatisfiable.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Tous les `errorKind: "…"` littéraux écrits dans le code de production. */
function motifsEmisParLeCode(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const racine = join(process.cwd(), "src");
  const visiter = (dir: string): void => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { visiter(p); continue; }
      if (!p.endsWith(".ts") || p.endsWith(".test.ts")) continue;
      const texte = readFileSync(p, "utf8");
      for (const m of texte.matchAll(/errorKind:\s*"([A-Z_]+)"/g)) {
        const k = m[1]!;
        out.set(k, [...(out.get(k) ?? []), p.slice(racine.length + 1)]);
      }
    }
  };
  visiter(racine);
  return out;
}

describe("la taxinomie des échecs est EXHAUSTIVE — recensée par le code, pas de mémoire", () => {
  it("LE TEST QUI COMPTE : tout motif émis par le runtime a un barreau d'échelle", () => {
    // Le recensement se fait en relisant les sources. Un motif ajouté demain sans son barreau
    // fait tomber CE test, au lieu de désarmer silencieusement la persévérance pour lui.
    const emis = motifsEmisParLeCode();
    const connus = new Set<string>(ERROR_KINDS);
    const orphelins = [...emis.entries()].filter(([k]) => !connus.has(k));
    expect(
      orphelins.map(([k, ou]) => `${k} (émis dans ${ou[0]})`),
      "des motifs d'échec sont émis sans figurer dans ERROR_KINDS : `tenterRecours` les rejette "
      + "d'entrée, donc AUCUN recours n'est tenté pour eux",
    ).toEqual([]);
    consignerMesure("motif_echec_avec_recours", { n: emis.size, ok: emis.size - orphelins.length },
      "lib/missions/runtime/replan.test.ts",
      "motifs d'échec réellement émis par le runtime qui ont une échelle de recours");
  });

  it("chaque cause a une échelle non vide, et son dernier barreau est terminal", () => {
    const TERMINAUX: readonly Strategy[] = ["DECLARER_INCONNU", "ESCALADER", "DEMANDER_HUMAIN"];
    for (const k of ERROR_KINDS) {
      const e = ECHELLE[k];
      expect(e, `« ${k} » n'a aucune échelle`).toBeDefined();
      expect(e.length, `« ${k} » a une échelle vide`).toBeGreaterThan(0);
      // Sans barreau terminal, `prochaineStrategie` rendrait null par épuisement muet plutôt
      // que par un geste HONNÊTE — « je ne sais pas, voici ce que j'ai tenté » (§9).
      expect(TERMINAUX, `« ${k} » finit sur ${e[e.length - 1]} : personne ne DIT que ça s'arrête`)
        .toContain(e[e.length - 1]);
    }
  });

  it("un refus humain ne se réessaie pas et ne se contourne pas (§108)", () => {
    // Redemander serait faire pression ; replanifier pour obtenir le même effet autrement serait
    // le contournement interdit. La seule suite honnête est de dire que ce n'a pas été fait.
    expect(ECHELLE.APPROVAL_REFUSED).toEqual(["DECLARER_INCONNU"]);
    expect(ECHELLE.MISSING_PERMISSION).toEqual(["ESCALADER"]);
  });

  it("le livrable vide n'est pas rejoué à l'identique : il manque de la MATIÈRE", () => {
    // Mesuré : `ARTIFACT_QA_FAILED` était `retryable: true` sans échelle, donc rejoué trois fois
    // exactement pareil avant de mourir. Le premier barreau doit chercher de la matière.
    expect(ECHELLE.ARTIFACT_QA_FAILED[0]).toBe("ELARGIR");
    expect(ECHELLE.ARTIFACT_QA_FAILED).toContain("REPLANIFIER");
  });

  it("l'échelle est MONOTONE : un barreau tenté ne revient jamais", () => {
    // C'est la propriété que la non-inscription cassait. On la vérifie ici sur la fonction
    // pure ; `engine.ts` doit l'alimenter en inscrivant même les barreaux qu'il n'exécute pas.
    for (const k of ERROR_KINDS) {
      const tentees: Strategy[] = [];
      const vues = new Set<Strategy>();
      for (let i = 0; i < ECHELLE[k].length + 2; i += 1) {
        const s = prochaineStrategie(k as ErrorKind, tentees);
        if (s === null) break;
        expect(vues.has(s), `« ${k} » repropose « ${s} »`).toBe(false);
        vues.add(s); tentees.push(s);
      }
      expect(prochaineStrategie(k as ErrorKind, tentees)).toBeNull();
    }
  });
});

describe("les états qui méritent un plan de plus, et le plafond qui arrête la boucle", () => {
  it("PARTIAL est replanifiable — c'est l'état d'une composition à moitié faite", () => {
    expect(estReplanifiable("PARTIAL")).toBe(true);
    expect(estReplanifiable("BLOCKED")).toBe(true);
    expect(estReplanifiable("FAILED")).toBe(true);
    expect(estReplanifiable("COMPLETED")).toBe(false);
    expect(estReplanifiable("RUNNING")).toBe(false);
    expect([...ETATS_REPLANIFIABLES]).toEqual(["FAILED", "BLOCKED", "PARTIAL"]);
  });

  it("le plafond de plans est fini : la boucle s'arrête par construction", () => {
    expect(PLANS_MAX).toBeGreaterThan(1);
    expect(Number.isFinite(PLANS_MAX)).toBe(true);
  });
});

describe("un replan n'abaisse pas la barre — et ne reporte pas une règle devenue impossible", () => {
  const RECHERCHES = "[REGLE:RECHERCHES_AVEC_REQUETE:recherche-drive,recherche-legal] Chaque étape citée a interrogé sa source.";
  const SORTIE = "[REGLE:SORTIE_STRUCTUREE:conclure:trouve,conclusion] L'étape « conclure » tranche.";
  const ECRITURE = "[REGLE:AUCUNE_ECRITURE] La mission n'a rien écrit.";
  const SEMANTIQUE = "l'absence est démontrée, sources citées";

  it("un critère SÉMANTIQUE survit toujours : c'est la barre elle-même", () => {
    expect(criteresQuiSurvivent([SEMANTIQUE], new Set(["autre-etape"]))).toEqual([SEMANTIQUE]);
  });

  it("une règle SANS cible survit : elle porte sur la mission, pas sur une étape", () => {
    expect(criteresQuiSurvivent([ECRITURE], new Set())).toEqual([ECRITURE]);
  });

  it("une règle qui nomme une étape ENCORE LÀ survit", () => {
    expect(criteresQuiSurvivent([RECHERCHES], new Set(["recherche-legal", "x"]))).toEqual([RECHERCHES]);
    expect(criteresQuiSurvivent([SORTIE], new Set(["conclure"]))).toEqual([SORTIE]);
  });

  it("LE TEST QUI COMPTE : une règle dont AUCUNE étape ne survit est écartée", () => {
    // Mesuré : reportée telle quelle dans un plan qui n'a plus ces étapes, elle est
    // INSATISFIABLE PAR CONSTRUCTION — la mission passait de COMPLETED à BLOCKED, et le
    // scénario anti-triche du banc d'acceptance le voyait comme une divergence de verdict.
    expect(criteresQuiSurvivent([RECHERCHES, SORTIE], new Set(["tout-autre-chose"]))).toEqual([]);
  });

  it("le tri ne perd pas la barre en écartant la tuyauterie", () => {
    const anciens = [RECHERCHES, ECRITURE, SORTIE, SEMANTIQUE];
    expect(criteresQuiSurvivent(anciens, new Set(["plan-v2-etape"]))).toEqual([ECRITURE, SEMANTIQUE]);
  });
});
