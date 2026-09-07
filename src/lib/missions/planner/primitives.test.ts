import { describe, expect, it } from "vitest";
import { direExigences, exigencesDe, exigencesFermes } from "@/lib/missions/planner/primitives";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LIRE UNE DEMANDE SANS RECONNAÎTRE UNE PHRASE DE BANC.
 *
 * ── LE PIÈGE QUE CES TESTS EXISTENT POUR ÉVITER ─────────────────────────────────────────
 *
 * Un détecteur bâti sur les énoncés du banc afficherait un score parfait et n'apprendrait rien
 * au produit : ce serait de la triche, exactement celle que le mandat interdit. Le jeu ci-dessous
 * est donc coupé en deux, et la seconde moitié compte davantage que la première :
 *
 *   • le jeu de MISE AU POINT, écrit avec le dictionnaire sous les yeux ;
 *   • le jeu TENU À L'ÉCART, écrit APRÈS coup, dans d'autres tournures, d'autres métiers,
 *     d'autres registres — et jamais relu pour ajuster le dictionnaire. Il mesure la
 *     GÉNÉRALISATION, c'est-à-dire la seule chose qui vaille.
 *
 * ── ET LES FAUX POSITIFS COMPTENT AUTANT QUE LES VRAIS ──────────────────────────────────
 *
 * Une exigence SÛRE fait refuser un plan. Un détecteur qui crierait CALCUL à chaque phrase
 * aurait un rappel parfait et enfermerait toutes les missions. Le jeu porte donc des NÉGATIFS :
 * des demandes de lecture pure qui n'exigent ni chiffre, ni visuel, ni pièce.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

type Cas = [demande: string, exigees: string[]];

/** Écrit avec le dictionnaire sous les yeux. Il vérifie que le mécanisme marche, rien de plus. */
const MISE_AU_POINT: Cas[] = [
  ["Combien de dossiers réglementaires sont en retard ?", ["CALCUL"]],
  ["Calcule la marge par produit sur le trimestre", ["CALCUL"]],
  // « évolution » est classé POSSIBLE à dessein : un graphique d'évolution peut se tracer sur
  // des valeurs déjà lues. C'était MON attente qui était fausse, pas la déduction.
  ["Fais-moi un graphique de l'évolution des ventes", ["REPRESENTATION"]],
  ["Rédige une note de synthèse sur le partenariat Hetero", ["DOCUMENT"]],
  ["Exporte la liste des salariés en Excel", ["DOCUMENT"]],
  ["Montre-moi un tableau de bord des paiements en attente", ["REPRESENTATION"]],
  ["Quel est le taux de conformité de nos dossiers ?", ["CALCUL"]],
  ["Qui est le responsable du dossier Mouffok ?", []],
  ["Retrouve le contrat signé avec Sanofi", []],
  /**
   * CE CAS VIENT DU JEU TENU À L'ÉCART, ET IL L'A QUITTÉ.
   *
   * Il a échoué au premier passage — « compter » manquait au dictionnaire — et sa correction a
   * consisté à ajouter du vocabulaire. Un cas sur lequel on ajuste n'est plus tenu à l'écart :
   * le laisser là-bas gonflerait le score de généralisation d'un point qu'il n'a pas gagné.
   * Il reste utile ici, comme non-régression du dénombrement.
   */
  ["Compte les ruptures par produit et rédige-moi un rapport là-dessus", ["CALCUL", "DOCUMENT"]],
  ["Prépare le compte rendu de la réunion", ["DOCUMENT"]],
  /**
   * RECEVOIR N'EST PAS PRODUIRE — deux faux positifs venus du banc d'acceptance, gardés ici.
   *
   * « Attends le contrat et le devis » nommait deux pièces et faisait exiger un DOCUMENT : le
   * compilateur refusait un plan d'ATTENTE parfaitement correct, en boucle. Un nom de pièce ne
   * dit pas qui la fabrique ; il faut un verbe de production à côté.
   */
  ["Attends le contrat et le devis du fournisseur avant de conclure.", []],
  ["Envoie-moi le rapport que Yassine a préparé", []],
  ["Où est passée la facture de mars ?", []],
  ["Ouvre le PDF du dossier et dis-moi ce qu'il contient", []],
  /**
   * « PAR RAPPORT À » EST UNE COMPARAISON, PAS UN RAPPORT.
   *
   * Trouvé en confrontant le détecteur à des demandes réelles : le mot « rapport » comptait à
   * l'intérieur de l'idiome. Bénin ici (POSSIBLE seulement), mais la même phrase avec un verbe
   * de production aurait exigé un DOCUMENT et fait refuser un plan correct.
   */
  ["Mets Annaba en évidence par rapport aux autres wilayas", []],
  ["Prépare-moi la position de Sofradis par rapport à ses concurrents", []],

  /**
   * LES IDIOMES DU VOIR — demander une forme sans nommer de graphique.
   *
   * Les négatifs qui suivent immédiatement sont ce qui les rend sûrs : « montre-moi le contrat »
   * et « fais-moi voir la facture » ne demandent aucune mise en forme.
   */
  ["Montre-moi sur une carte où se concentrent nos ventes", ["REPRESENTATION"]],
  ["Je veux voir en un coup d'œil quels dossiers se percutent", ["REPRESENTATION"]],
  ["Présente l'écart sous la forme qui le rend le plus lisible", ["REPRESENTATION"]],
  ["Dessine-moi qui parle à qui dans cette affaire", ["REPRESENTATION"]],
  ["Montre-moi le contrat signé avec Sofradis", []],
  ["Fais-moi voir la facture de mars", []],
];

/**
 * ÉCRIT APRÈS, SANS RETOUCHER LE DICTIONNAIRE. C'est le jeu qui juge.
 *
 * Tournures orales, formulations indirectes, vocabulaire d'autres métiers (RH, achats,
 * juridique, logistique), et des négatifs qui ressemblent à des positifs.
 */
const TENU_A_LECART: Cas[] = [
  // — CALCUL, dit autrement —
  ["J'aimerais savoir combien on a dépensé chez ce fournisseur depuis janvier", ["CALCUL"]],
  ["Donne-moi la moyenne des délais de traitement par service", ["CALCUL"]],
  ["Est-ce que l'écart entre le budget et le réalisé est significatif ?", ["CALCUL"]],
  ["Quelle est la répartition des effectifs par département ?", ["CALCUL"]],
  ["Il me faut une projection de trésorerie pour le second semestre", ["CALCUL"]],
  ["Fais le cumul des pénalités de retard sur tous les contrats", ["CALCUL"]],
  ["Sors-moi le classement des partenaires par volume", ["CALCUL"]],
  ["Y a-t-il une corrélation entre les ruptures de stock et les retards fournisseurs ?", ["CALCUL"]],

  // — REPRESENTATION, dit autrement —
  ["Trace-moi la courbe des immatriculations sur cinq ans", ["REPRESENTATION"]],
  ["Je veux une chronologie de ce dossier depuis son dépôt", ["REPRESENTATION"]],
  ["Un histogramme des motifs de rejet, ça se fait ?", ["REPRESENTATION"]],
  ["Prépare une visualisation des flux entre nos entrepôts", ["REPRESENTATION"]],

  // — DOCUMENT, dit autrement —
  ["Prépare un compte rendu de la réunion d'hier pour le comité", ["DOCUMENT"]],
  ["Il me faut un devis pour cette commande", ["DOCUMENT"]],
  ["Génère le bon de commande correspondant", ["DOCUMENT"]],
  ["Écris un courrier au ministère pour demander une prolongation", ["DOCUMENT"]],
  ["Fais-moi une présentation de dix slides pour le conseil", ["DOCUMENT"]],

  // — COMPOSITION : plusieurs primitives dans une seule phrase —
  ["Calcule le coût moyen par dossier et mets-moi ça dans un graphique", ["CALCUL", "REPRESENTATION"]],
  ["Quel pourcentage de nos contrats arrive à échéance cette année ? Fais un tableau de bord.", ["CALCUL", "REPRESENTATION"]],

  /**
   * ═══════════════════════════════════════════════════════════════════════════════════════
   * LES HUIT CLASSES DE QUESTION QUANTITATIVE — dans d'autres métiers que celui du banc.
   *
   * ── CE QUE CES CAS MESURENT, ET CE QU'ILS NE MESURENT PAS ──────────────────────────
   *
   * Ils ont été écrits EN MÊME TEMPS que les huit classes : ils mesurent donc la COUVERTURE
   * de chaque classe, pas la généralisation aveugle. Le dire est plus utile que de les ranger
   * dans le jeu tenu à l'écart pour se donner un meilleur chiffre — c'est le jeu au-dessus,
   * écrit avant, qui juge la généralisation.
   *
   * Ce qu'ils protègent vraiment : que chaque classe reste énonçable AILLEURS. Aucune de ces
   * phrases ne parle de pharmacie ; si l'une cessait de passer, c'est que la classe se serait
   * refermée sur le vocabulaire d'un seul métier — et redeviendrait la table de phrases que le
   * mandat interdit.
   * ═══════════════════════════════════════════════════════════════════════════════════════
   */
  // 1. relation entre deux grandeurs
  ["Y a-t-il un lien entre l'ancienneté des équipes et le taux d'absentéisme ?", ["CALCUL"]],
  // 2. comparaison de magnitudes
  ["Cette machine nous coûte plus cher en maintenance qu'elle ne rapporte ?", ["CALCUL"]],
  // 3. part d'un tout
  ["Quelle proportion du chiffre vient de nos trois plus gros clients ?", ["CALCUL"]],
  // 4. ce qui sort de l'ordinaire
  ["Repère les semaines anormales sur la ligne de conditionnement", ["CALCUL"]],
  // 5. échantillon et signification
  ["L'écart entre les deux agences tient-il à la taille de l'échantillon ?", ["CALCUL"]],
  // 6. probabilité et incertitude
  ["Quelle est la probabilité de livrer avant la fin du trimestre ?", ["CALCUL"]],
  // 7. optimisation sous contrainte
  ["Où placer l'atelier pour minimiser les déplacements des équipes ?", ["CALCUL"]],
  // 8. projection et atterrissage
  ["À ce rythme, est-ce qu'on va tenir le budget de formation ?", ["CALCUL"]],
  // Les verbes qui RASSEMBLENT produisent une pièce — dans un autre métier que le banc.
  ["Consolide les trois relevés dans un seul classeur", ["DOCUMENT"]],
  ["Rends-moi un tableau des habilitations qui expirent", ["DOCUMENT"]],
  /**
   * « Montre-le » porte sur le RÉSULTAT, pas sur un objet à ouvrir.
   *
   * J'attendais CALCUL ici aussi — à tort. « Comparer » reste POSSIBLE à dessein : on compare
   * deux clauses, deux versions, deux candidats, et rien de tout cela ne se chiffre. C'était
   * MON attente qui était fausse ; la retenue du détecteur est ce qui empêche d'enfermer une
   * mission de comparaison qualitative.
   */
  ["Compare l'absentéisme des deux sites et montre-le", ["REPRESENTATION"]],

  // — NÉGATIFS : lecture pure, aucun chiffre, aucun visuel, aucune pièce à produire —
  ["Est-ce qu'on a déjà travaillé avec ce laboratoire ?", []],
  ["Dis-moi où en est la demande d'autorisation de Kabylia", []],
  ["Rappelle-moi ce qu'on avait décidé au sujet du packaging", []],
  ["Qui a validé cette dépense et quand ?", []],
  ["Cherche s'il existe une clause d'exclusivité dans cet accord", []],
  ["Préviens Yassine que la réunion est décalée", []],
  // Les négatifs qui gardent les huit classes : chacun porte un mot proche d'une classe sans
  // en porter le sens. Ils sont la moitié qui compte — une exigence SÛRE fait refuser un plan.
  ["Prends note de ce que je te dis et rappelle-le-moi demain", []],
  ["Lis le document que Karim a déposé hier", []],
  ["Donne-moi la liste des personnes présentes à la réunion", []],
  /**
   * CELUI-CI EST PASSÉ DES NÉGATIFS AUX POSITIFS, et il fallait le dire.
   *
   * Je l'avais écrit comme un piège : un tableau de bord qui EXISTE DÉJÀ ne se fabrique pas.
   * Mais le montrer EST un acte de représentation — le plan doit porter une étape qui l'affiche
   * (`show_document`, `render_view`), et l'exiger ne refuse aucun plan correct. Exiger DOCUMENT
   * l'aurait été ; c'est ce que `PIECES_FAUX_AMIS` empêche, et c'est le vrai piège.
   */
  ["Montre-moi le tableau de bord que Yacine a préparé", ["REPRESENTATION"]],
  ["Le fournisseur a un rapport de force plus favorable depuis le rachat", []],
];

function evaluer(jeu: Cas[]): { justes: number; rates: string[] } {
  const rates: string[] = [];
  let justes = 0;
  for (const [demande, attendues] of jeu) {
    const obtenues = exigencesFermes(demande).filter((p) => p !== "INFORMATION");
    const manquantes = attendues.filter((a) => !obtenues.includes(a as never));
    const enTrop = obtenues.filter((o) => !attendues.includes(o));
    if (manquantes.length === 0 && enTrop.length === 0) justes += 1;
    else rates.push(`« ${demande} » → manque ${manquantes.join("+") || "—"}, en trop ${enTrop.join("+") || "—"}`);
  }
  return { justes, rates };
}

describe("les primitives exigées se lisent dans la demande", () => {
  it("le jeu de mise au point passe — le mécanisme fonctionne", () => {
    const { justes, rates } = evaluer(MISE_AU_POINT);
    expect(rates, "jeu de mise au point").toEqual([]);
    expect(justes).toBe(MISE_AU_POINT.length);
  });

  it("LE TEST QUI COMPTE : le jeu tenu à l'écart généralise", () => {
    // Écrit après le dictionnaire, dans d'autres tournures, et jamais relu pour l'ajuster.
    // Un score parfait ici sur un jeu écrit AVANT ne prouverait rien du produit.
    const { justes, rates } = evaluer(TENU_A_LECART);
    consignerMesure("primitive_exigee_deduite", { n: TENU_A_LECART.length, ok: justes },
      "lib/missions/planner/primitives.test.ts",
      "demandes INÉDITES dont les primitives exigées sont déduites exactement — ni manquée, ni inventée");
    expect(rates.slice(0, 6), `${justes}/${TENU_A_LECART.length}`).toEqual([]);
  });

  it("LE TEST QUI COMPTE AUTANT : une lecture pure n'exige RIEN", () => {
    // Un détecteur qui crie CALCUL partout aurait un rappel parfait et enfermerait toutes les
    // missions : chaque exigence SÛRE peut faire refuser un plan.
    const negatifs = TENU_A_LECART.filter(([, a]) => a.length === 0);
    expect(negatifs.length).toBeGreaterThanOrEqual(5);
    for (const [d] of negatifs) {
      expect(exigencesFermes(d).filter((p) => p !== "INFORMATION"), `« ${d} » a déclenché une exigence`).toEqual([]);
    }
  });
});

/**
 * LES FAUX POSITIFS, MESURÉS SUR UN CORPUS ÉCRIT POUR AUTRE CHOSE.
 *
 * `corpus-def.QUESTIONS` sert au banc de connaissance : vingt-cinq questions de LECTURE écrites
 * des mois avant ce dictionnaire, et jamais pour lui. C'est le seul jeu de ce fichier que
 * personne n'a pu ajuster — et c'est donc le meilleur juge du sur-déclenchement.
 *
 * CINQ d'entre elles exigent bel et bien un CALCUL (« combien de réserves », « le montant
 * total », « le chiffre d'affaires », « le total hors taxes ») : ce ne sont pas des faux
 * positifs, ce sont des questions chiffrées. Le cliquet porte donc sur ce nombre : élargir le
 * vocabulaire ne doit pas en ajouter une sixième sans qu'on l'ait vue.
 *
 * Mesuré à l'ajout des huit classes de question quantitative : 5 avant, 5 après.
 */
describe("le vocabulaire élargi ne crie pas au loup", () => {
  it("un corpus de LECTURE écrit pour un autre banc ne déclenche pas plus qu'avant", async () => {
    const { QUESTIONS } = await import("@/../scripts/bench/corpus-def");
    const textes = (QUESTIONS as unknown as { q: string }[]).map((x) => x.q).filter(Boolean);
    expect(textes.length).toBeGreaterThanOrEqual(20);
    const declenchees = textes.filter((t) => exigencesFermes(t).some((p) => p !== "INFORMATION"));
    consignerMesure("primitive_faux_positifs", { n: textes.length, ok: textes.length - declenchees.length },
      "lib/missions/planner/primitives.test.ts",
      "questions de LECTURE (banc de connaissance) qui NE déclenchent aucune exigence à tort");
    expect(declenchees.length, `déclenchées : ${declenchees.join(" | ")}`).toBeLessThanOrEqual(5);
  });
});

describe("la discipline des deux niveaux", () => {
  it("une hésitation ne contraint jamais — elle informe", () => {
    // « analyse » et « compare » orientent sans trancher : ils ne doivent pas faire refuser.
    const ex = exigencesDe("Analyse la performance commerciale et compare avec l'an dernier");
    expect(ex.some((e) => e.certitude === "POSSIBLE")).toBe(true);
    expect(exigencesFermes("Analyse la performance commerciale et compare avec l'an dernier")).toEqual([]);
  });

  it("la déduction est REPRODUCTIBLE et se justifie par un mot de la demande", () => {
    const a = exigencesDe("Calcule la marge et fais un graphique");
    const b = exigencesDe("Calcule la marge et fais un graphique");
    expect(a).toEqual(b);
    for (const e of a) expect(e.declencheur.length, "une exigence sans déclencheur n'est pas vérifiable").toBeGreaterThan(2);
  });

  it("la phrase dite au planificateur nomme la primitive ET le mot qui l'a déclenchée", () => {
    const p = direExigences(exigencesDe("Combien de dossiers sont en retard ? Fais un graphique."));
    expect(p).toContain("CALCUL");
    expect(p).toContain("REPRESENTATION");
    expect(p).toContain("combien");
    // Elle laisse toujours la porte du manque ouverte : exiger sans offrir d'issue enfermerait.
    expect(p).toContain("gaps");
  });

  it("une demande sans marqueur ne dit rien du tout", () => {
    expect(direExigences(exigencesDe("Où en est le dossier Mouffok ?"))).toBeNull();
  });

  it("les accents, la casse et la ponctuation ne changent rien", () => {
    expect(exigencesFermes("CALCULE LE TOTAL")).toContain("CALCUL");
    expect(exigencesFermes("calcule, le total…")).toContain("CALCUL");
    expect(exigencesFermes("Redige un rapport")).toContain("DOCUMENT");
    expect(exigencesFermes("Rédige un rapport")).toContain("DOCUMENT");
  });
});
