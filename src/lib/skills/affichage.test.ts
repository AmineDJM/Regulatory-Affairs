import { describe, expect, it } from "vitest";
import { lignesDeclarees, suivreChemin } from "./affichage";

/**
 * OÙ SONT LES LIGNES D'UNE CAPACITÉ QU'ON N'A PAS ÉCRITE.
 *
 * Chaque cas ci-dessous nomme la situation qui le ferait tomber — une assertion dont on ne sait
 * pas nommer ce cas n'est pas une assertion (§118.17).
 */
describe("affichage d'une capacité dynamique — la déclaration, jamais la devinette", () => {
  const trois = [{ reference: "AO-1", objet: "Oncologie" }, { reference: "AO-2", objet: "Antibio" }, { reference: "AO-3", objet: "Vaccins" }];

  it("une clé DÉCLARÉE qui porte des lignes rend son chemin — c'est le cas de `pch_appels_d_offres`", () => {
    const a = lignesDeclarees({ titre: "Appels d'offres PCH", clesDeclarees: ["items"], sortie: { ok: true, resultat: { items: trois } } });
    expect(a.lignes).toEqual({ titre: "Appels d'offres PCH", chemin: "resultat.items" });
    expect(a.manque).toBeNull();
    expect(suivreChemin({ ok: true, resultat: { items: trois } }, "resultat.items")).toEqual(trois);
  });

  it("le RÉSULTAT est lui-même la liste : aucune clé à nommer, rien à deviner", () => {
    const a = lignesDeclarees({ titre: "Ventes", sortie: { ok: true, resultat: trois } });
    expect(a.lignes).toEqual({ titre: "Ventes", chemin: "resultat" });
  });

  it("UNE seule ligne n'est pas un tableau — et le seuil est celui de `tableFromRows`, pas un réglage local", () => {
    // Ce qui le ferait tomber : déclarer un chemin que l'écran écartera ensuite en silence, donc
    // une capacité qui « devrait » afficher et n'affiche rien, sans aucune cause visible.
    expect(lignesDeclarees({ titre: "T", clesDeclarees: ["items"], sortie: { ok: true, resultat: { items: [trois[0]] } } }).lignes).toBeNull();
  });

  it("des lignes SONT là, aucune clé déclarée ne les nomme : on ne choisit pas la clé — on DIT le geste qui lève la limite", () => {
    const a = lignesDeclarees({ titre: "Contacts HubSpot", clesDeclarees: ["contacts"], sortie: { ok: true, resultat: { results: trois } } });
    expect(a.lignes).toBeNull();
    expect(a.manque).toContain("« results »");
    expect(a.manque).toContain("sorties.cles");
    // La phrase doit dire que la DONNÉE est là : sans cela, le modèle conclut à une
    // impossibilité et répond « je ne peux pas afficher de tableau » (§118.63).
    expect(a.manque).toMatch(/données SONT là/);
  });

  it("DEUX listes voisines : on n'en choisit aucune — la collapser afficherait la mauvaise", () => {
    const a = lignesDeclarees({ titre: "T", sortie: { ok: true, resultat: { gauche: trois, droite: trois } } });
    expect(a.lignes).toBeNull();
    expect(a.manque).toContain("« gauche »");
    expect(a.manque).toContain("« droite »");
    expect(a.manque).not.toMatch(/doit nommer « /); // pas de clé désignée quand il y en a deux
  });

  it("un ÉCHEC annoncé n'affiche rien : ce qu'il porte est un motif, pas un résultat", () => {
    expect(lignesDeclarees({ titre: "T", clesDeclarees: ["items"], sortie: { ok: false, resultat: { items: trois } } })).toEqual({ lignes: null, manque: null });
  });

  it("on ne FOUILLE pas l'arbre : ni le journal d'un playbook ni les étapes d'une porte de qualité ne sont un résultat", () => {
    // Ce qui le ferait tomber : présenter de la comptabilité de moteur comme le travail demandé.
    const a = lignesDeclarees({
      titre: "T",
      sortie: { ok: true, resultat: { valeur: 42 }, etapes: [{ alias: "a", ms: 3 }, { alias: "b", ms: 4 }] },
    });
    expect(a).toEqual({ lignes: null, manque: null });
  });

  it("ce qui ne se lit pas à coup sûr ne dit RIEN — un `manque` permanent devient du bruit (§118.32)", () => {
    expect(lignesDeclarees({ titre: "T", sortie: "du texte" })).toEqual({ lignes: null, manque: null });
    expect(lignesDeclarees({ titre: "", sortie: { ok: true, resultat: trois } })).toEqual({ lignes: null, manque: null });
    expect(lignesDeclarees({ titre: "T", sortie: { ok: true, resultat: { total: 3 } } })).toEqual({ lignes: null, manque: null });
    expect(lignesDeclarees({ titre: "T", clesDeclarees: ["items"], sortie: { ok: true, resultat: { items: ["a", "b"] } } }).manque).toBeNull();
  });

  it("un chemin qui ne mène nulle part rend `undefined`, jamais une exception", () => {
    expect(suivreChemin({ a: 1 }, "a.b.c")).toBeUndefined();
    expect(suivreChemin(null, "a")).toBeUndefined();
    expect(suivreChemin({ resultat: { items: [] } }, "resultat.items")).toEqual([]);
  });
});
