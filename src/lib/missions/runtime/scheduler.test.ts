import { describe, expect, it } from "vitest";
import {
  CLASSES_RESSOURCE, classeDe, limitesDe, ordonnancer, pouvoirsDeblocage,
  type ClasseRessource, type EtapeOrdonnancable, type ProfilCapacite,
} from "@/lib/missions/runtime/scheduler";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ORDONNANCEUR — et la propriété qu'il doit garantir.
 *
 * ── CE QUI EST EN JEU ────────────────────────────────────────────────────────────────────
 *
 * « Une mission de 2 000 opérations indépendantes ne doit jamais prendre un temps proche de
 * 2 000 × la durée d'une opération. » Cette phrase n'est pas un vœu : elle se vérifie, et elle
 * se vérifie ICI, parce que c'est ici que l'ordre et le nombre sont décidés.
 *
 * Les tests qui comptent sont donc ceux qui mesurent des TOURS. Un tour, c'est une vague
 * d'exécution parallèle ; le nombre de tours est la mesure du chemin critique, et c'est le seul
 * chiffre que l'architecture peut réduire — la durée d'une opération, elle, ne nous appartient
 * pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const PROFILS: Record<string, ProfilCapacite> = {
  lire_base: { domain: "platform", latency: "LOW" },
  lire_hr: { domain: "hr", latency: "LOW" },
  envoyer_mail: { domain: "mail", latency: "MEDIUM" },
  lire_drive: { domain: "drive", latency: "MEDIUM" },
};
const profil = (id: string): ProfilCapacite => PROFILS[id] ?? { domain: "platform", latency: "MEDIUM" };

const cap = (key: string, capability = "lire_base", dependsOn: string[] = []): EtapeOrdonnancable =>
  ({ key, nodeType: "CAPABILITY", capability, dependsOn });
const worker = (key: string, dependsOn: string[] = []): EtapeOrdonnancable =>
  ({ key, nodeType: "WORKER", capability: null, dependsOn });
const jonction = (key: string, dependsOn: string[] = []): EtapeOrdonnancable =>
  ({ key, nodeType: "JOIN", capability: null, dependsOn });

describe("les classes de ressource — ce qui sature ensemble, et ce qui ne sature pas", () => {
  it("un nœud de CONTRÔLE ne consomme aucune ressource", () => {
    // C'est le défaut le plus silencieux de l'ancienne ligne : une jonction, qui ne fait que
    // constater que ses dépendances sont finies, prenait une des huit places d'exécution.
    for (const t of ["JOIN", "QA", "WAIT_EVENT", "WAIT_INPUT", "APPROVAL"]) {
      expect(classeDe({ key: "k", nodeType: t, capability: null, dependsOn: [] }, profil), t).toBe("LIBRE");
    }
  });

  it("un WORKER est borné par le FOURNISSEUR, pas par son domaine", () => {
    expect(classeDe(worker("w"), profil)).toBe("MODELE");
    expect(classeDe({ key: "a", nodeType: "ARTIFACT", capability: null, dependsOn: [] }, profil)).toBe("MODELE");
  });

  it("une capacité qui SORT DE LA MAISON est bornée séparément", () => {
    expect(classeDe(cap("m", "envoyer_mail"), profil)).toBe("EXTERNE");
    expect(classeDe(cap("d", "lire_drive"), profil)).toBe("EXTERNE");
    // …et une lecture locale ne l'est pas : c'est tout l'intérêt de la distinction.
    expect(classeDe(cap("b", "lire_base"), profil)).toBe("BASE");
  });

  it("les plafonds portent leur raison : la base tient plus que le fournisseur, le tiers moins", () => {
    const l = limitesDe(8);
    expect(l.parClasse.MODELE).toBe(8);
    expect(l.parClasse.BASE).toBeGreaterThan(l.parClasse.MODELE);
    expect(l.parClasse.EXTERNE).toBeLessThan(l.parClasse.MODELE);
    // LE FILET NE MORD JAMAIS AVANT LES FILES. C'est le correctif qu'un banc a imposé : un
    // global plus bas que la somme rendait les plafonds par classe inatteignables, donc faux.
    expect(l.global).toBe(l.parClasse.MODELE + l.parClasse.BASE + l.parClasse.EXTERNE);
    // Aucun plafond ne peut valoir zéro : une mission de petite échelle doit rester exécutable.
    for (const c of CLASSES_RESSOURCE) expect(l.parClasse[c], c).toBeGreaterThanOrEqual(1);
    expect(limitesDe(1).parClasse.MODELE).toBeGreaterThanOrEqual(1);
  });
});

describe("le pouvoir de déblocage — pourquoi l'ORDRE change la durée", () => {
  it("compte les descendants TRANSITIFS, pas les enfants directs", () => {
    // a → b → c → d : `a` en débloque trois, pas un. Ne compter que les enfants directs
    // ferait passer une feuille large devant une chaîne profonde, qui est le vrai goulot.
    const p = pouvoirsDeblocage([cap("a"), cap("b", "lire_base", ["a"]), cap("c", "lire_base", ["b"]), cap("d", "lire_base", ["c"])]);
    expect(p.get("a")).toBe(3);
    expect(p.get("d")).toBe(0);
  });

  it("L'ÉTAPE QUI DÉBLOQUE LE PLUS PART LA PREMIÈRE — même si la base la rend en dernier", () => {
    // Le scénario exact du défaut : `zzz` débloque quarante descendants, `aaa`..`aay` n'en
    // débloquent aucun. Avec un `slice`, `zzz` arrive après — et les quarante attendent un tour.
    const feuilles = Array.from({ length: 25 }, (_, i) => cap(`aa${String.fromCharCode(97 + i)}`));
    const descendants = Array.from({ length: 40 }, (_, i) => cap(`suite-${i}`, "lire_base", ["zzz"]));
    const toutes = [...feuilles, cap("zzz"), ...descendants];

    const o = ordonnancer([...feuilles, cap("zzz")], toutes, limitesDe(4), profil);
    expect(o.lot[0].key, "la débloquante doit partir en premier").toBe("zzz");
  });

  it("un CYCLE ne fait pas boucler le tri — il ralentit, il ne pend pas", () => {
    // Le compilateur refuse les cycles ; c'est exactement pourquoi la garde existe. Le jour où
    // l'un passe, l'ordonnanceur doit rendre un ordre médiocre, pas geler le processus.
    const p = pouvoirsDeblocage([cap("a", "lire_base", ["b"]), cap("b", "lire_base", ["a"])]);
    expect(p.get("a")).toBeGreaterThanOrEqual(0);
  });

  it("l'ordre est TOTAL : deux tours identiques décident identiquement", () => {
    // Sans troisième clé de tri, deux étapes de même pouvoir se départageraient par l'ordre
    // d'entrée — et un banc deviendrait instable un jour sur deux sans qu'aucun code ait bougé.
    const etapes = [cap("b"), cap("a"), cap("c")];
    const un = ordonnancer(etapes, etapes, limitesDe(3), profil).lot.map((s) => s.key);
    const deux = ordonnancer([...etapes].reverse(), etapes, limitesDe(3), profil).lot.map((s) => s.key);
    expect(un).toEqual(deux);
  });
});

describe("les plafonds mordent PAR CLASSE, et la contre-pression se mesure", () => {
  it("dix lectures locales et dix envois ne se disputent pas les mêmes places", () => {
    const lectures = Array.from({ length: 10 }, (_, i) => cap(`lit-${i}`, "lire_base"));
    const envois = Array.from({ length: 10 }, (_, i) => cap(`mail-${i}`, "envoyer_mail"));
    const toutes = [...lectures, ...envois];
    const l = limitesDe(6);

    const o = ordonnancer(toutes, toutes, l, profil);
    const classes = o.lot.map((s) => classeDe(s, profil));
    // Le plafond des tiers est plus bas que celui de la base : les dix envois ne peuvent pas
    // tous partir, alors que les dix lectures le peuvent. C'est toute la démonstration.
    expect(classes.filter((c) => c === "EXTERNE").length).toBe(l.parClasse.EXTERNE);
    expect(classes.filter((c) => c === "BASE").length).toBe(10);
    expect(o.differees.length).toBe(toutes.length - o.lot.length);
  });

  it("LES NŒUDS LIBRES PASSENT TOUS, SANS PRENDRE DE PLACE", () => {
    // Vingt jonctions et six lectures, plafond six. Si les jonctions consommaient une place,
    // aucune lecture ne partirait — c'est le défaut, rendu visible.
    const jonctions = Array.from({ length: 20 }, (_, i) => jonction(`j-${i}`));
    const lectures = Array.from({ length: 6 }, (_, i) => cap(`l-${i}`));
    const toutes = [...jonctions, ...lectures];

    const o = ordonnancer(toutes, toutes, limitesDe(6), profil);
    expect(o.lot.filter((s) => s.nodeType === "JOIN")).toHaveLength(20);
    expect(o.lot.filter((s) => s.nodeType === "CAPABILITY")).toHaveLength(6);
    expect(o.differees).toHaveLength(0);
  });

  it("la CONCURRENCE VOULUE et la CONCURRENCE OBTENUE sont rendues séparément", () => {
    // C'est la contre-pression du §4 : sans l'écart, on ne sait pas si l'on est limité par le
    // graphe (rien à gagner) ou par les quotas (il y a à gagner). Les deux appellent des
    // corrections opposées.
    const trente = Array.from({ length: 30 }, (_, i) => cap(`c-${i}`));
    const l = limitesDe(4);
    const o = ordonnancer(trente, trente, l, profil);
    expect(o.desiree).toBe(30);
    expect(o.effective).toBe(l.parClasse.BASE);
    expect(o.differees).toHaveLength(30 - l.parClasse.BASE);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CRITÈRE ULTIME, SIMULÉ SUR LE GRAPHE
 *
 * On ne mesure pas des millisecondes ici — elles dépendraient de la machine du jour. On mesure
 * le nombre de VAGUES, qui est la grandeur que l'architecture contrôle : combien de fois faut-il
 * repasser pour tout exécuter. Deux mille opérations indépendantes doivent tenir en
 * `2000 / concurrence` vagues, jamais en deux mille.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("le critère ultime : 2 000 opérations indépendantes ≠ 2 000 fois une opération", () => {
  /** Rejoue l'ordonnancement jusqu'à épuisement et compte les vagues. Pur, donc instantané. */
  const vagues = (toutes: EtapeOrdonnancable[], global: number): number => {
    const restantes = new Map(toutes.map((s) => [s.key, s]));
    const finies = new Set<string>();
    let n = 0;
    while (restantes.size > 0 && n < 10_000) {
      const pretes = [...restantes.values()].filter((s) => s.dependsOn.every((d) => finies.has(d)));
      if (pretes.length === 0) break;
      const o = ordonnancer(pretes, toutes, limitesDe(global), profil);
      for (const s of o.lot) { finies.add(s.key); restantes.delete(s.key); }
      n += 1;
    }
    return n;
  };

  it("2 000 lectures indépendantes tiennent en ~125 vagues à plafond 8, pas 2 000", () => {
    const mille = Array.from({ length: 2000 }, (_, i) => cap(`doc-${i}`, "lire_base"));
    const n = vagues(mille, 8);
    // Le plafond de classe BASE vaut 2 × global, soit 16 : 2 000 / 16 = 125.
    expect(n).toBeLessThanOrEqual(130);
    expect(n).toBeGreaterThan(1); // et il ne s'en va pas magiquement en une seule vague
  });

  it("une CHAÎNE de 50 étapes prend 50 vagues — le graphe décide, et c'est correct", () => {
    // Le contre-exemple indispensable. Si ce test passait à moins de 50, l'ordonnanceur
    // violerait les dépendances : il irait vite en faisant faux, ce qui est le pire résultat.
    const chaine = Array.from({ length: 50 }, (_, i) => cap(`c-${i}`, "lire_base", i === 0 ? [] : [`c-${i - 1}`]));
    expect(vagues(chaine, 8)).toBe(50);
  });

  it("un ÉVENTAIL large sous une racine : 1 vague pour la racine, puis le volume divisé", () => {
    const racine = cap("racine", "lire_base");
    const filles = Array.from({ length: 400 }, (_, i) => cap(`f-${i}`, "lire_base", ["racine"]));
    const n = vagues([racine, ...filles], 8);
    expect(n).toBeLessThanOrEqual(1 + Math.ceil(400 / 16) + 1);
  });

  it("LES TROIS FILES AVANCENT ENSEMBLE — un envoi lent ne bloque pas les lectures", () => {
    // Cent lectures locales et huit envois. Sous un plafond unique, les envois occuperaient
    // une part des places et rallongeraient les lectures ; avec des files séparées, non.
    const lectures = Array.from({ length: 100 }, (_, i) => cap(`l-${i}`, "lire_base"));
    const envois = Array.from({ length: 8 }, (_, i) => cap(`m-${i}`, "envoyer_mail"));
    const avecEnvois = vagues([...lectures, ...envois], 8);
    const sansEnvois = vagues(lectures, 8);
    // Les envois ne coûtent QUE leurs propres vagues, pas une pénalité sur les lectures.
    expect(avecEnvois - sansEnvois).toBeLessThanOrEqual(2);
  });
});

describe("ce que l'ordonnanceur ne fait PAS", () => {
  it("il ne rend jamais une étape dont une dépendance n'est pas finie — il n'en juge même pas", () => {
    // La garde des dépendances est AILLEURS (`etapesPretes`), et c'est voulu : mélanger « qui a
    // le droit de partir » et « qui part maintenant » ferait de l'ordonnanceur une seconde
    // autorité sur le graphe, qui divergerait de la première.
    const o = ordonnancer([cap("a")], [cap("a"), cap("b", "lire_base", ["a"])], limitesDe(4), profil);
    expect(o.lot.map((s) => s.key)).toEqual(["a"]);
  });

  it("il ne rend jamais plus que ce qu'on lui donne", () => {
    const o = ordonnancer([cap("a")], [cap("a")], limitesDe(100), profil);
    expect(o.lot).toHaveLength(1);
    expect(o.differees).toHaveLength(0);
  });

  it("un lot vide ne produit ni erreur ni concurrence fantôme", () => {
    const o = ordonnancer([], [], limitesDe(4), profil);
    expect(o.lot).toHaveLength(0);
    expect(o.effective).toBe(0);
    expect(o.desiree).toBe(0);
    const restantes: Record<ClasseRessource, number> = o.restantes;
    expect(restantes.MODELE).toBeGreaterThan(0);
  });
});
