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

  // — NÉGATIFS : lecture pure, aucun chiffre, aucun visuel, aucune pièce à produire —
  ["Est-ce qu'on a déjà travaillé avec ce laboratoire ?", []],
  ["Dis-moi où en est la demande d'autorisation de Kabylia", []],
  ["Rappelle-moi ce qu'on avait décidé au sujet du packaging", []],
  ["Qui a validé cette dépense et quand ?", []],
  ["Cherche s'il existe une clause d'exclusivité dans cet accord", []],
  ["Préviens Yassine que la réunion est décalée", []],
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
