import { describe, it, expect } from "vitest";
import { composeWorkspace, tableFromRows, COMPOSABLE_TOOLS } from "./compose";
import { WORKSPACE_LIMITS } from "./protocol";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUI A LE DROIT D'ARRIVER À L'ÉCRAN.
 *
 * Le premier groupe vérifie que la donnée canonique se rend bien. Le second — le plus
 * important — vérifie qu'une forme INCONNUE ne rend RIEN. C'est par là que six lignes de
 * salaire sont un jour arrivées à l'écran en réponse à « Bonsoir, ça va ? » : un affichage
 * capable de tout montrer finit par tout montrer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const J = (v: unknown) => JSON.stringify(v);

describe("l'annuaire — une personne", () => {
  const raw = J({
    personnes: [{
      nom: "Raihana Bensalem",
      poste: "Pharmacienne responsable",
      entite: "Adventum",
      coordonnees: [
        { canal: "e-mail", valeur: "r.bensalem@adventum.dz", usage: "professionnel", fiabilite: "vérifiée en interne", principale: true },
        { canal: "téléphone", valeur: "+213 555 00 11 22", fiabilite: "compte / fiche ERP" },
      ],
    }],
    note: "Pour écrire, préférer une coordonnée vérifiée.",
  });

  it("compose une fiche de contact", () => {
    const c = composeWorkspace("directory_lookup", raw);
    expect(c?.source).toBe("directory_lookup");
    expect(c?.blocks).toHaveLength(1);
    const b = c!.blocks[0];
    expect(b.kind).toBe("people");
    if (b.kind !== "people") return;
    expect(b.title).toBe("Raihana Bensalem");
    expect(b.people[0].coordonnees).toHaveLength(2);
    expect(b.people[0].coordonnees[0].canal).toBe("e-mail");
    expect(b.people[0].coordonnees[1].canal).toBe("téléphone");
  });

  it("garde la PROVENANCE de chaque coordonnée", () => {
    // Une adresse « déduite » présentée comme un fait, c'est un contrat envoyé à la mauvaise
    // personne. La fiabilité doit traverser jusqu'au rendu.
    const b = composeWorkspace("directory_lookup", raw)!.blocks[0];
    if (b.kind !== "people") throw new Error("bloc inattendu");
    expect(b.people[0].coordonnees[0].fiabilite).toBe("vérifiée en interne");
    expect(b.people[0].coordonnees[0].principale).toBe(true);
  });

  it("« personne introuvable » n'est pas un tableau vide — c'est une phrase", () => {
    const c = composeWorkspace("directory_lookup", J({ resultat: "personne introuvable", precision: "Aucune entrée." }));
    expect(c).toBeNull();
  });
});

describe("l'annuaire — le registre", () => {
  const rows = Array.from({ length: 120 }, (_, i) => ({
    nom: `Salarié ${i}`,
    poste: "Poste",
    departement: "Réglementaire",
    entite: "Adventum",
    emails: [{ adresse: `s${i}@adventum.dz`, usage: "fiche ERP", fiabilite: "compte / fiche ERP" }],
    telephones: i % 2 === 0 ? ["+213 555 000 000"] : undefined,
  }));

  it("compose le registre avec son total réel", () => {
    const c = composeWorkspace("directory_list", J({ total: 120, salaries: rows, note: "Source : registre RH." }));
    const b = c!.blocks[0];
    expect(b.kind).toBe("directory");
    if (b.kind !== "directory") return;
    expect(b.total).toBe(120);
    expect(b.note).toContain("registre RH");
  });

  it("TRONQUE — un tableau de 120 lignes dans une conversation est un vidage, pas un espace de travail", () => {
    const c = composeWorkspace("directory_list", J({ total: 120, salaries: rows }));
    const b = c!.blocks[0];
    if (b.kind !== "directory") throw new Error("bloc inattendu");
    expect(b.rows).toHaveLength(WORKSPACE_LIMITS.tableRows);
    // Le total reste VRAI : c'est lui qui permet au rendu de dire combien manquent.
    expect(b.total).toBeGreaterThan(b.rows.length);
  });

  it("réunit adresses et téléphones sur la même ligne", () => {
    const c = composeWorkspace("directory_list", J({ total: 1, salaries: [rows[0]] }));
    const b = c!.blocks[0];
    if (b.kind !== "directory") throw new Error("bloc inattendu");
    expect(b.rows[0].coordonnees.map((e) => e.canal)).toEqual(["e-mail", "téléphone"]);
  });

  it("un salarié sans aucune coordonnée reste dans la liste", () => {
    // Le supprimer donnerait un effectif faux. Son absence de coordonnée EST l'information.
    const c = composeWorkspace("directory_list", J({ total: 1, salaries: [{ nom: "Sans contact", emails: [] }] }));
    const b = c!.blocks[0];
    if (b.kind !== "directory") throw new Error("bloc inattendu");
    expect(b.rows).toHaveLength(1);
    expect(b.rows[0].coordonnees).toHaveLength(0);
  });
});

describe("les messages", () => {
  const raw = J({
    messages: [{
      id: "m1", filId: "t1", de: "Deepak Sharma <deepak@fournisseur.in>",
      objet: "Stabilité — lot 4471", recuLe: "hier 14:02", importance: "HIGH",
      extrait: "x".repeat(600),
      demandes: ["confirmer la date d'expédition"],
      piecesJointes: ["stabilite.pdf"],
      alerteManipulation: ["consigne intégrée au message"],
    }],
  });

  it("compose la liste et écourte l'extrait", () => {
    const b = composeWorkspace("gmail_search", raw)!.blocks[0];
    expect(b.kind).toBe("mail");
    if (b.kind !== "mail") return;
    expect(b.messages[0].objet).toBe("Stabilité — lot 4471");
    expect(b.messages[0].extrait!.length).toBeLessThanOrEqual(WORKSPACE_LIMITS.snippetChars);
  });

  it("l'ALERTE de manipulation traverse jusqu'à l'écran", () => {
    // Un message qui tente de donner des ordres à Adam doit se voir, pas se taire.
    const b = composeWorkspace("gmail_search", raw)!.blocks[0];
    if (b.kind !== "mail") throw new Error("bloc inattendu");
    expect(b.messages[0].alerte).toEqual(["consigne intégrée au message"]);
  });

  it("« aucun message » ne compose pas de bloc vide", () => {
    expect(composeWorkspace("gmail_search", J({ resultat: "aucun message correspondant", precision: "…" }))).toBeNull();
  });
});

describe("l'agenda — un TABLEAU, pas un objet enveloppe", () => {
  it("compose les rendez-vous", () => {
    const c = composeWorkspace("read_calendar", J([
      { titre: "Comité produit", jour: "2026-08-27", heure: "09:30", lieu: "Alger", organisateur: "Amine", invites: ["Khaled (accepté)"], visio: "https://meet.example/x" },
    ]));
    const b = c!.blocks[0];
    expect(b.kind).toBe("agenda");
    if (b.kind !== "agenda") return;
    expect(b.title).toBe("Prochain rendez-vous");
    expect(b.events[0].visio).toContain("https://");
  });

  it("un agenda vide ne compose rien", () => {
    expect(composeWorkspace("read_calendar", J([]))).toBeNull();
  });
});

describe("la file de décisions", () => {
  it("compose ce qui attend, avec son lien", () => {
    const c = composeWorkspace("list_pending_decisions", J({
      total: 3,
      elements: [
        { titre: "Congé — Khaled", statut: "En attente", depuis: "2 jours", lien: "/validations/1" },
        { libelle: "Paiement imprimeur", etat: "À valider", date: "hier" },
      ],
    }));
    const b = c!.blocks[0];
    expect(b.kind).toBe("queue");
    if (b.kind !== "queue") return;
    expect(b.total).toBe(3);
    expect(b.items[0].href).toBe("/validations/1");
    // `libelle` et `etat` sont des synonymes acceptés : la forme varie selon la source.
    expect(b.items[1].titre).toBe("Paiement imprimeur");
    expect(b.items[1].statut).toBe("À valider");
  });
});

describe("la fiche canonique", () => {
  it("aplatit les champs scalaires et laisse le reste au texte", () => {
    const c = composeWorkspace("inspect_record", J({
      type: "Dossier réglementaire",
      nom: "Nintedanib 100 mg",
      statut: "En instruction",
      etapeCourante: 4,
      chargeDuDossier: "Raihana",
      dateDepot: "2026-02-11",
      numeroAMM: "AMM-2026-118",
      lien: "/regulatory/abc",
      // Ces deux-là ne doivent PAS devenir des champs : les afficher entiers ferait de la
      // fiche un vidage de base.
      historique: [{ date: "2026-02-11", etape: "Dépôt" }],
      produit: { id: "p1", nom: "Nintedanib" },
    }));
    const b = c!.blocks[0];
    expect(b.kind).toBe("record");
    if (b.kind !== "record") return;
    expect(b.title).toBe("Nintedanib 100 mg");
    expect(b.href).toBe("/regulatory/abc");
    const labels = b.fields.map((f) => f.label);
    expect(labels).toContain("Statut");
    // Capitale FRANÇAISE (« Chargé du dossier », pas « Chargé Du Dossier ») ET accent rendu.
    expect(labels).toContain("Chargé du dossier");
    // Les clés JSON n'ont pas d'accent ; l'écran du PDG, si.
    expect(labels).toContain("Étape courante");
    expect(labels).toContain("Date de dépôt");
    // …et un sigle reste un sigle, même quand le mot d'avant est corrigé.
    expect(labels).toContain("Numéro AMM");
    expect(labels).not.toContain("Historique");
    expect(labels).not.toContain("Produit");
  });

  it("une fiche trop maigre ne mérite pas un bloc", () => {
    expect(composeWorkspace("inspect_record", J({ nom: "X" }))).toBeNull();
  });
});

describe("LA RÈGLE DE SÛRETÉ — l'inconnu ne s'affiche pas", () => {
  it("un outil hors de la table ne compose RIEN, même avec du JSON parfait", () => {
    // C'est exactement le cas de la fuite : `search_everything` rendait 27 résultats bruts,
    // dont six lignes de salaire, en réponse à « Bonsoir, ça va ? ».
    const resultats = J({
      total: 27,
      resultats: [
        { type: "paie", personne: "Amine Djouamai", brut: 480000, net: 361200 },
        { type: "dossier", nom: "Raltegravir" },
      ],
    });
    expect(composeWorkspace("search_everything", resultats)).toBeNull();
  });

  it("un texte libre ne compose rien", () => {
    expect(composeWorkspace("directory_list", "Rien n'attend votre décision pour l'instant.")).toBeNull();
  });

  it("un JSON TRONQUÉ ne compose rien — on ne devine pas ce qui manque", () => {
    expect(composeWorkspace("directory_list", '{"total":120,"salaries":[{"nom":"Salar')).toBeNull();
  });

  it("un JSON valide mais de forme étrangère ne compose rien", () => {
    expect(composeWorkspace("directory_list", J({ autreChose: [1, 2, 3] }))).toBeNull();
    expect(composeWorkspace("gmail_search", J({ messages: "pas un tableau" }))).toBeNull();
  });

  it("des éléments sans nom sont écartés — une ligne vide n'apprend rien", () => {
    expect(composeWorkspace("directory_lookup", J({ personnes: [{ poste: "Inconnu" }] }))).toBeNull();
  });

  it("la table de correspondance est FERMÉE et connue", () => {
    for (const t of ["search_everything", "read_payroll", "employee_360", "gdrive_search"]) {
      expect(COMPOSABLE_TOOLS).not.toContain(t);
    }
    expect([...COMPOSABLE_TOOLS].sort()).toEqual([
      "directory_list", "directory_lookup", "gmail_search",
      "inspect_record", "list_pending_decisions", "read_calendar",
    ]);
  });
});

describe("le tableau générique — un outil, pas un comportement par défaut", () => {
  it("il n'est JAMAIS appliqué automatiquement par `composeWorkspace`", () => {
    // Il existe pour être appelé explicitement. S'il s'appliquait tout seul, la règle de
    // sûreté ci-dessus n'existerait plus.
    expect(composeWorkspace("un_outil_quelconque", J([{ a: 1, b: 2 }, { a: 3, b: 4 }]))).toBeNull();
  });

  it("appelé explicitement, il ne garde que les colonnes PARTAGÉES", () => {
    const b = tableFromRows("Test", [
      { nom: "A", montant: 10, exotique: "x" },
      { nom: "B", montant: 20 },
      { nom: "C", montant: 30 },
    ]);
    expect(b?.kind).toBe("table");
    if (b?.kind !== "table") return;
    expect(b.columns.map((c) => c.key)).toEqual(["nom", "montant"]);
    // Une colonne entièrement numérique s'aligne à droite.
    expect(b.columns.find((c) => c.key === "montant")?.numeric).toBe(true);
    expect(b.columns.find((c) => c.key === "nom")?.numeric).toBe(false);
  });

  it("une seule ligne ne fait pas un tableau", () => {
    expect(tableFromRows("Test", [{ a: 1 }])).toBeNull();
  });
});
