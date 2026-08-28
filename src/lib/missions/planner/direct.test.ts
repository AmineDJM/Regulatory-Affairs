import { describe, expect, it } from "vitest";
import type { CapabilityBrief } from "@/lib/missions/ports";
import { cheminDirect, PLANCHER_DOMINANCE } from "@/lib/missions/planner/direct";
import { trier } from "@/lib/missions/planner/triage";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CHEMIN DIRECT — et surtout, TOUT CE QU'IL DOIT REFUSER.
 *
 * ── CE QUE CE FICHIER GARDE ──────────────────────────────────────────────────────────────
 *
 * Un chemin qui court-circuite le planificateur est une bonne idée exactement tant qu'il ne se
 * déclenche jamais à tort. Le risque n'est pas de rater une occasion — c'est de répondre depuis
 * la mauvaise source EN ANNONÇANT que c'est la bonne, ce que la doctrine Live Office nomme
 * « le défaut le plus coûteux de tout ce système » (§7).
 *
 * Les tests de REFUS sont donc les vrais tests. Celui d'acceptation ne fait que prouver que le
 * mécanisme existe ; ceux qui suivent prouvent qu'il est cerné.
 *
 * ── POURQUOI DES CAPACITÉS FICTIVES ──────────────────────────────────────────────────────
 *
 * Le catalogue réel bouge à chaque lot. Un test qui s'appuierait sur `list_tasks` deviendrait
 * rouge le jour où quelqu'un renomme un outil — et il ne dirait rien du mécanisme. Ce qu'on
 * éprouve ici, c'est la RÈGLE : la dominance, le plancher, la lecture nue, l'effet, le droit.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const cap = (id: string, domain: string, summary: string, effect: CapabilityBrief["effect"] = "READ"): CapabilityBrief =>
  ({ id, domain, effect, batchable: false, summary });

/**
 * UN CATALOGUE MINUSCULE MAIS RÉALISTE : une lecture nue qui domine, une recherche voisine, et
 * du bruit d'autres domaines. C'est la forme exacte que prend le catalogue résolu en production.
 */
const CATALOGUE = [
  cap("list_conges", "hr", "Liste les demandes de congés en cours."),
  cap("search_documents", "drive", "Cherche un document par son contenu."),
  cap("send_message", "mail", "Envoie un message à une personne.", "EXTERNAL_COMMUNICATION"),
  cap("read_hr_overview", "hr", "Donne l'effectif et sa répartition."),
  cap("directory_lookup", "directory", "Retrouve une personne par son nom."),
];

const ctx = (capacites: readonly CapabilityBrief[] = CATALOGUE, autorisee = () => true) =>
  ({ capacites, autorisee });

const essai = (demande: string, c = ctx()) => cheminDirect(demande, trier(demande), c);

describe("le chemin direct — ce qu'il accepte", () => {
  it("une lecture nue qui DOMINE produit un plan, sans aucun appel de modèle", () => {
    const v = essai("Liste les congés en cours");
    expect(v.refus, "aucun verrou ne devrait avoir cédé").toBeNull();
    expect(v.capacite).toBe("list_conges");
    expect(v.plan?.steps.map((s) => s.nodeType)).toEqual(["CAPABILITY", "WORKER"]);
  });

  it("le plan porte des critères d'acceptation QUI NOMMENT LA SOURCE", () => {
    // Sans cela le juge n'aurait rien à vérifier et conclurait sur « la mission a fini de
    // tourner » — la faute que le runtime entier existe pour éviter (§10).
    const v = essai("Liste les congés en cours");
    expect(v.plan?.acceptance.length).toBeGreaterThan(0);
    expect(v.plan?.acceptance.join(" ")).toContain("list_conges");
  });

  it("l'étape de lecture N'INVENTE AUCUN PARAMÈTRE", () => {
    // C'est le verrou 3 rendu littéral. Un `query` fabriqué à partir de la phrase française
    // serait une devinette présentée comme une recherche.
    const v = essai("Liste les congés en cours");
    expect(v.plan?.steps[0].input).toEqual({});
  });
});

describe("le chemin direct — ce qu'il REFUSE, et c'est là qu'il vaut quelque chose", () => {
  it("une ÉCRITURE ne passe jamais, même formulée en trois mots", () => {
    const v = essai("Envoie le message");
    expect(v.plan).toBeNull();
    expect(v.refus).toMatch(/profil/);
  });

  it("un ÉVENTAIL ne passe pas — « à chacun » est une exécution, pas une lecture", () => {
    const v = essai("le point pour chacun des salaries");
    expect(v.plan).toBeNull();
  });

  it("un ARBITRAGE ne passe pas : « lequel » se juge, il ne se lit pas", () => {
    const v = essai("Lequel des congés est le plus long");
    expect(v.plan).toBeNull();
    expect(v.refus).toContain("SIMPLE");
  });

  it("une CIBLE AMBIGUË rend des candidats, jamais « la première des deux »", () => {
    // Deux capacités du même domaine qui marquent pareil : c'est exactement la situation où
    // choisir serait deviner. Le refus NOMME les deux, pour que la trace soit lisible.
    const jumelles = [
      cap("list_dossiers", "dossiers", "Les dossiers en cours."),
      cap("read_dossiers", "dossiers", "Les dossiers en cours."),
    ];
    const v = essai("les dossiers en cours", ctx(jumelles));
    expect(v.plan).toBeNull();
    expect(v.refus).toContain("ambiguë");
    expect(v.candidats).toHaveLength(2);
  });

  it("une RECHERCHE ne passe pas — elle attend une requête que nous n'avons pas", () => {
    const v = essai("documents", ctx([cap("search_documents", "drive", "Cherche un document par contenu.")]));
    expect(v.plan).toBeNull();
    // Le refus dit POURQUOI : ce n'est pas « pas assez sûr », c'est « il faudrait deviner ».
    expect(v.refus).toMatch(/lecture nue|domine/);
  });

  it("un EFFET au-dessus d'ANALYZE ne passe pas, quel que soit le score", () => {
    const v = essai("message", ctx([cap("read_message", "mail", "Lit un message.", "EXTERNAL_COMMUNICATION")]));
    expect(v.plan).toBeNull();
  });

  it("une capacité NON OUVERTE à l'acteur ne passe pas — le droit est relu ici", () => {
    // Le catalogue a déjà filtré, et pourtant on redemande. Deux vérifications valent mieux
    // qu'une quand la seconde coûte un appel de fonction et garde une porte.
    const v = essai("Liste les congés en cours", ctx(CATALOGUE, () => false));
    expect(v.plan).toBeNull();
    expect(v.refus).toContain("ouverte");
  });

  it("un score FAIBLE ne passe pas, même sans concurrent — dominer le vide n'est pas dominer", () => {
    // Une seule capacité au catalogue : elle est première par défaut. Le plancher est ce qui
    // empêche « il n'y avait qu'elle » de valoir « c'était elle ».
    const v = essai("bonjour", ctx([cap("list_conges", "hr", "Liste les congés.")]));
    expect(v.plan).toBeNull();
    expect(v.refus).toContain(String(PLANCHER_DOMINANCE));
  });

  it("un catalogue VIDE ne produit pas un plan vide", () => {
    const v = essai("Liste les congés", ctx([]));
    expect(v.plan).toBeNull();
    expect(v.refus).toContain("aucune capacité");
  });
});

describe("les demandes réelles du banc de fumée n'empruntent PAS le chemin direct", () => {
  /**
   * Ce test vaut mesure. Les trois scénarios du banc fournisseur sont des enquêtes multi-sources
   * avec arbitrage — précisément ce que le chemin direct doit laisser au planificateur. S'ils
   * commençaient à passer, la comparaison avant/après deviendrait fausse SANS que rien ne casse,
   * et c'est le pire genre de régression.
   */
  const DEMANDES = [
    "Fais le point sur les dossiers réglementaires en cours : liste-les avec leur statut, "
      + "et dis-moi lequel demande le plus d'attention et pourquoi. "
      + "Si une information manque pour trancher, dis-le explicitement. Ne contacte personne et ne modifie rien.",
    "Vérifie si nous avons quoi que ce soit sur la molécule « Zorbamyxine-K7 » : produit, dossier "
      + "réglementaire, marché, document. L'objectif de cette mission est de TRANCHER la question.",
    "Retrouve le document contractuel le plus récent qui engage l'entreprise. Commence par le Drive ; "
      + "si tu n'y trouves pas de quoi conclure, va chercher dans les autres sources disponibles.",
  ];

  for (const d of DEMANDES) {
    it(`« ${d.slice(0, 48)}… » reste au planificateur`, () => {
      expect(essai(d).plan).toBeNull();
    });
  }
});
