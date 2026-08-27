import { describe, it, expect } from "vitest";
import { composeWorkspace } from "./compose";
import { GODMODE_LIMITS, readEntityRef, readMeta } from "./compose-godmode";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LES BLOCS RICHES ONT LE DROIT D'AFFICHER.
 *
 * Ces tests passent par `composeWorkspace` plutôt que par les relecteurs directement : c'est le
 * chemin RÉEL — outil canonique → `_blocs` → relecture → bloc — et un test qui court-circuite
 * la porte d'entrée ne prouve pas que la porte est fermée.
 *
 * Le second groupe est le plus important : il vérifie ce qui est REFUSÉ. Une story qui affiche
 * « fait » sur un état qu'elle n'a pas compris, une comparaison décalée d'une colonne, une
 * alerte rouge sur un ton inconnu — chacune est un mensonge à l'écran, pas un défaut de style.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const J = (v: unknown) => JSON.stringify(v);

/** Un outil quelconque qui déclare ses blocs — c'est le seul chemin d'entrée. */
function bloc(b: unknown) {
  const c = composeWorkspace("inspect_record", J({ _blocs: [b], id: "x" }));
  return c?.blocks[0] ?? null;
}

const EVT = {
  id: "attribution", date: "2024-03-12", kind: "attribution",
  titre: "Marché attribué", etat: "fait",
};

describe("la story — la frise se lit telle qu'elle est en base", () => {
  it("rend les jalons, les KPI, les fils et les limites", () => {
    const b = bloc({
      kind: "story", title: "Marché AONIO 2024", subtitle: "PCH · 8 lots",
      kpis: [{ valeur: "1,24 Md", label: "Attribué" }, { valeur: "612 M", label: "Encaissé" }],
      events: [
        { ...EVT, metriques: [{ valeur: "8", label: "lots" }], provenance: "PchTender", certitude: "fait" },
        { id: "bc:1", date: "2024-05-02", kind: "commande", titre: "BC n° 1", etat: "fait", parent: "attribution", fils: ["famille:commandes"] },
        { id: "paiement:1", date: null, kind: "paiement", titre: "Paiement du BC n° 1", etat: "manque", parent: "bc:1", retardJours: 94 },
      ],
      threads: [{ id: "famille:commandes", label: "Commandes", count: 1, genre: "famille" }],
      limites: ["La date de soumission est déduite de la date de publication."],
    });
    expect(b?.kind).toBe("story");
    if (b?.kind !== "story") return;
    expect(b.events).toHaveLength(3);
    expect(b.kpis).toHaveLength(2);
    expect(b.threads?.[0].count).toBe(1);
    expect(b.limites).toHaveLength(1);
    // `manque` est l'état le plus utile de la frise : il DOIT survivre à la relecture.
    expect(b.events[2].etat).toBe("manque");
    expect(b.events[2].retardJours).toBe(94);
    expect(b.events[2].date).toBeNull();
  });

  it("porte l'identité de l'entité, pas un titre à relire", () => {
    const b = bloc({
      kind: "story", title: "T", entityRef: { type: "PCH_TENDER", id: "t1", label: "AONIO 2024" },
      blockId: "story:t1", version: 2, freshness: "il y a 3 min", state: "complete",
      events: [EVT],
    });
    expect(b?.entityRef).toEqual({ type: "PCH_TENDER", id: "t1", label: "AONIO 2024" });
    expect(b?.blockId).toBe("story:t1");
    expect(b?.version).toBe(2);
    expect(b?.state).toBe("complete");
  });

  it("un jalon dont le parent a été tronqué remonte au premier rang au lieu de disparaître", () => {
    const b = bloc({
      kind: "story", title: "T",
      events: [{ id: "enfant", date: null, kind: "facture", titre: "Facture", etat: "fait", parent: "pere-absent" }],
    });
    if (b?.kind !== "story") throw new Error("story attendue");
    expect(b.events[0].parent).toBeNull();
  });

  it("écarte un fil qui n'est déclaré nulle part — sinon le jalon serait invisible dans tous les filtres", () => {
    const b = bloc({
      kind: "story", title: "T",
      events: [{ ...EVT, fils: ["famille:commandes", "fil:inconnu"] }],
      threads: [{ id: "famille:commandes", label: "Commandes", count: 1 }],
    });
    if (b?.kind !== "story") throw new Error("story attendue");
    expect(b.events[0].fils).toEqual(["famille:commandes"]);
  });

  it("un état de jalon inconnu retombe sur « à venir », JAMAIS sur « fait »", () => {
    // Se tromper vers « pas encore » est réparable. Afficher « fait » sur un jalon dont on ne
    // sait rien fait croire qu'une livraison a eu lieu — et ce mensonge-là ne se rattrape pas.
    const b = bloc({
      kind: "story", title: "T",
      events: [{ id: "e", date: null, kind: "livraison", titre: "Livraison", etat: "peut-être" }],
    });
    if (b?.kind !== "story") throw new Error("story attendue");
    expect(b.events[0].etat).toBe("a-venir");
  });

  it("ne propose pas un fil vide", () => {
    const b = bloc({
      kind: "story", title: "T", events: [EVT],
      threads: [{ id: "a", label: "Plein", count: 2 }, { id: "b", label: "Vide", count: 0 }],
    });
    if (b?.kind !== "story") throw new Error("story attendue");
    expect(b.threads?.map((t) => t.id)).toEqual(["a"]);
  });

  it("dédoublonne les jalons de même identité", () => {
    const b = bloc({ kind: "story", title: "T", events: [EVT, { ...EVT, titre: "Doublon" }] });
    if (b?.kind !== "story") throw new Error("story attendue");
    expect(b.events).toHaveLength(1);
    expect(b.events[0].titre).toBe("Marché attribué");
  });

  it("borne la frise", () => {
    const events = Array.from({ length: GODMODE_LIMITS.storyEvents + 25 }, (_, i) => ({
      ...EVT, id: `e${i}`,
    }));
    const b = bloc({ kind: "story", title: "T", events });
    if (b?.kind !== "story") throw new Error("story attendue");
    expect(b.events).toHaveLength(GODMODE_LIMITS.storyEvents);
  });
});

describe("la vue 360 — divulgation progressive", () => {
  const section = (id: string, ouvert = false) => ({
    id, label: `Section ${id}`, ouvert,
    fields: [{ label: "Statut", value: "En cours" }],
  });

  it("rend l'en-tête, les KPI et les sections", () => {
    const b = bloc({
      kind: "entity360", title: "Nivolumab 10 mg", subtitle: "Oncologie",
      badges: [{ label: "Enregistré", ton: "succes" }],
      kpis: [{ valeur: "412 M", label: "Livré" }],
      sections: [section("reg", true), section("ventes")],
      limites: ["Coût employeur absent sur 2 assignations."],
      href: "/regulatory/produits/p1",
    });
    expect(b?.kind).toBe("entity360");
    if (b?.kind !== "entity360") return;
    expect(b.sections).toHaveLength(2);
    expect(b.sections[0].ouvert).toBe(true);
    expect(b.sections[1].ouvert).toBeUndefined();
    expect(b.badges?.[0].ton).toBe("succes");
    expect(b.href).toBe("/regulatory/produits/p1");
  });

  it("n'ouvre jamais plus de deux sections, même si le serveur en demande cinq", () => {
    const b = bloc({
      kind: "entity360", title: "P",
      sections: ["a", "b", "c", "d", "e"].map((id) => section(id, true)),
    });
    if (b?.kind !== "entity360") throw new Error("entity360 attendue");
    expect(b.sections.filter((s) => s.ouvert).length).toBe(2);
  });

  it("écarte une section vide qui ne dit pas pourquoi, garde celle qui l'explique", () => {
    const b = bloc({
      kind: "entity360", title: "P",
      sections: [
        { id: "vide", label: "Ventes" },
        { id: "explique", label: "Ad&Pro", note: "Aucune dépense imputée à ce produit cette année." },
      ],
    });
    if (b?.kind !== "entity360") throw new Error("entity360 attendue");
    expect(b.sections.map((s) => s.id)).toEqual(["explique"]);
  });

  it("sans aucune section, aucun bloc — un en-tête seul promet une profondeur qui n'existe pas", () => {
    expect(bloc({ kind: "entity360", title: "P", sections: [] })).toBeNull();
  });

  it("refuse une photo externe", () => {
    const b = bloc({
      kind: "entity360", title: "P", photo: "https://tiers.example/visage.jpg",
      sections: [section("a")],
    });
    if (b?.kind !== "entity360") throw new Error("entity360 attendue");
    expect(b.photo).toBeUndefined();
  });
});

describe("la comparaison — l'alignement des colonnes", () => {
  it("complète une ligne trop courte plutôt que de décaler les valeurs", () => {
    const b = bloc({
      kind: "comparison", title: "AONIO 2023 vs 2024",
      sujets: [{ id: "a", label: "2023" }, { id: "b", label: "2024" }, { id: "c", label: "2025" }],
      lignes: [{ dimension: "Attribué", valeurs: ["980 M"], delta: "+26 %", deltaTon: "succes" }],
    });
    if (b?.kind !== "comparison") throw new Error("comparison attendue");
    expect(b.lignes[0].valeurs).toEqual(["980 M", null, null]);
  });

  it("tronque une ligne trop longue à la largeur des sujets", () => {
    const b = bloc({
      kind: "comparison", title: "T",
      sujets: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
      lignes: [{ dimension: "D", valeurs: ["1", "2", "3", "4"] }],
    });
    if (b?.kind !== "comparison") throw new Error("comparison attendue");
    expect(b.lignes[0].valeurs).toEqual(["1", "2"]);
  });

  it("un seul sujet n'est pas une comparaison", () => {
    expect(bloc({
      kind: "comparison", title: "T",
      sujets: [{ id: "a", label: "A" }],
      lignes: [{ dimension: "D", valeurs: ["1"] }],
    })).toBeNull();
  });
});

describe("la mission — plusieurs gestes, une confirmation", () => {
  it("rend les étapes et la confirmation unique", () => {
    const b = bloc({
      kind: "mission", title: "Relancer la PCH",
      etapes: [
        { id: "1", label: "Écrire à la PCH", etat: "a-faire" },
        { id: "2", label: "Créer la tâche de suivi", etat: "a-faire" },
      ],
      confirmation: { libelle: "Tout exécuter", phrase: "Exécute la mission M-12", ton: "primaire" },
    });
    if (b?.kind !== "mission") throw new Error("mission attendue");
    expect(b.etapes).toHaveLength(2);
    expect(b.confirmation?.phrase).toBe("Exécute la mission M-12");
  });

  it("un état d'étape inconnu retombe sur « à faire », jamais sur « fait »", () => {
    const b = bloc({
      kind: "mission", title: "M",
      etapes: [{ id: "1", label: "Envoyer", etat: "peut-être" }],
    });
    if (b?.kind !== "mission") throw new Error("mission attendue");
    expect(b.etapes[0].etat).toBe("a-faire");
  });

  it("porte l'erreur actionnable d'une étape échouée", () => {
    const b = bloc({
      kind: "mission", title: "M", state: "failed",
      etapes: [{ id: "1", label: "Envoyer", etat: "echec", erreur: "Adresse rejetée par gmail.com — corriger le destinataire." }],
    });
    if (b?.kind !== "mission") throw new Error("mission attendue");
    expect(b.etapes[0].erreur).toContain("corriger le destinataire");
    expect(b.state).toBe("failed");
  });
});

describe("l'alerte proactive", () => {
  it("rend le ton, le message et l'origine", () => {
    const b = bloc({
      kind: "alerte", title: "Message non délivré", ton: "alerte",
      message: "Le message à la PCH est revenu en erreur.",
      origine: "NDR reçu de pch.dz",
      actions: [{ libelle: "Corriger", phrase: "Corrige l'adresse du message MSG-3" }],
    });
    if (b?.kind !== "alerte") throw new Error("alerte attendue");
    expect(b.ton).toBe("alerte");
    expect(b.actions).toHaveLength(1);
  });

  it("un ton inconnu ne devient pas rouge", () => {
    const b = bloc({ kind: "alerte", title: "T", ton: "critique", message: "M" });
    if (b?.kind !== "alerte") throw new Error("alerte attendue");
    expect(b.ton).toBe("info");
  });

  it("sans message, pas d'alerte", () => {
    expect(bloc({ kind: "alerte", title: "T", ton: "alerte" })).toBeNull();
  });
});

describe("les métadonnées — ce qui n'est pas une identité valable est écarté", () => {
  it("refuse une référence d'entité incomplète", () => {
    expect(readEntityRef({ type: "PRODUCT" })).toBeNull();
    expect(readEntityRef({ id: "p1" })).toBeNull();
    expect(readEntityRef({ type: "PRODUCT", id: "p1" })).toEqual({ type: "PRODUCT", id: "p1" });
  });

  it("refuse une version qui n'en est pas une", () => {
    expect(readMeta({ version: -1 }).version).toBeUndefined();
    expect(readMeta({ version: 1.5 }).version).toBeUndefined();
    expect(readMeta({ version: 3 }).version).toBe(3);
  });

  it("refuse un état de bloc inventé", () => {
    expect(readMeta({ state: "presque" }).state).toBeUndefined();
    expect(readMeta({ state: "sending" }).state).toBe("sending");
  });

  it("refuse une certitude inventée", () => {
    expect(readMeta({ certitude: "sûr" }).certitude).toBeUndefined();
    expect(readMeta({ certitude: "estime" }).certitude).toBe("estime");
  });
});

describe("ce qui ne s'affiche pas", () => {
  it("un genre de bloc inconnu ne rend rien", () => {
    expect(bloc({ kind: "dashboard", title: "T", widgets: [] })).toBeNull();
  });

  it("une story sans jalon ne rend rien", () => {
    expect(bloc({ kind: "story", title: "T", events: [] })).toBeNull();
  });

  it("un jalon sans genre reconnu est écarté, la story survit avec le reste", () => {
    const b = bloc({
      kind: "story", title: "T",
      events: [EVT, { id: "z", date: null, kind: "réunion", titre: "Point", etat: "fait" }],
    });
    if (b?.kind !== "story") throw new Error("story attendue");
    expect(b.events.map((e) => e.id)).toEqual(["attribution"]);
  });

  it("un document externe est écarté d'un jalon", () => {
    const b = bloc({
      kind: "story", title: "T",
      events: [{ ...EVT, docs: [
        { nom: "Contrat", href: "https://tiers.example/c.pdf", type: "pdf" },
        { nom: "PV", href: "/api/drive/file/9", type: "pdf" },
      ] }],
    });
    if (b?.kind !== "story") throw new Error("story attendue");
    expect(b.events[0].docs?.map((d) => d.nom)).toEqual(["PV"]);
  });
});
