import { describe, expect, it } from "vitest";
import { collecterLiensInternes, reparerLiensInternes } from "./link-repair";

/**
 * LA RÉPARATION DES LIENS TRONQUÉS — golden sur le défaut mesuré en conversation réelle :
 * « [Ouvrir le dossier](/regulatory/) » alors que l'outil venait de rendre
 * `"lien": "/regulatory/cmw4abc"`. Le clic menait au tableau générique.
 */

describe("collecterLiensInternes — ce que les outils ont RÉELLEMENT rendu", () => {
  it("extrait les champs lien/href/url, même imbriqués, et ignore le reste", () => {
    const sortie = JSON.stringify({
      type: "Dossier Regulatory",
      lien: "/regulatory/cmw4abc",
      documentsJoints: [{ nom: "x.pdf", href: "/api/documents/doc1" }],
      commentaire: "voir /pas-un-lien-declare",
      externe: { url: "https://exemple.com/page" },
    });
    const liens = collecterLiensInternes([sortie]);
    expect(liens).toContain("/regulatory/cmw4abc");
    expect(liens).toContain("/api/documents/doc1");
    // Un lien EXTERNE n'est jamais matière à réparation interne.
    expect(liens).not.toContain("https://exemple.com/page");
    // Une chaîne libre qui ressemble à un chemin n'est pas un lien déclaré.
    expect(liens).not.toContain("/pas-un-lien-declare");
  });

  it("une sortie non-JSON (message d'erreur, texte) ne rend rien et ne casse rien", () => {
    expect(collecterLiensInternes(["Erreur lors de la lecture des données.", "{pas du json"])).toEqual([]);
  });
});

describe("reparerLiensInternes — compléter sans jamais deviner", () => {
  it("GOLDEN conversation réelle : « /regulatory/ » est complété avec le lien exact du tour", () => {
    const { texte, repares } = reparerLiensInternes(
      "FAIT VÉRIFIÉ — Pembrolizumab : REG-2026-009. [Ouvrir le dossier](/regulatory/)",
      ["/regulatory/cmw4abc"],
    );
    expect(texte).toContain("[Ouvrir le dossier](/regulatory/cmw4abc)");
    expect(repares).toBe(1);
  });

  it("racine SANS barre finale : « /sponsoring » se complète aussi", () => {
    const { texte } = reparerLiensInternes("[Fiche ASARI](/sponsoring)", ["/sponsoring/spo4"]);
    expect(texte).toBe("[Fiche ASARI](/sponsoring/spo4)");
  });

  it("DEUX dossiers lus dans le tour → ambigu → le lien reste tel quel (jamais le mauvais dossier)", () => {
    const { texte, repares } = reparerLiensInternes(
      "[Ouvrir](/regulatory/)",
      ["/regulatory/cmA", "/regulatory/cmB"],
    );
    expect(texte).toBe("[Ouvrir](/regulatory/)");
    expect(repares).toBe(0);
  });

  it("un lien de MODULE légitime (l'outil rend lui-même « /courriers ») n'est pas touché", () => {
    const { texte } = reparerLiensInternes("[Registre](/courriers)", ["/courriers"]);
    expect(texte).toBe("[Registre](/courriers)");
  });

  it("un lien déjà PROFOND n'est jamais réécrit — même si un autre dossier a été lu", () => {
    const { texte } = reparerLiensInternes("[Voir](/regulatory/cmAncien)", ["/regulatory/cmNouveau"]);
    expect(texte).toBe("[Voir](/regulatory/cmAncien)");
  });

  it("plusieurs liens tronqués de modules DIFFÉRENTS se réparent dans la même réponse", () => {
    const { texte, repares } = reparerLiensInternes(
      "[Dossier](/regulatory/) et [Fichier](/drive/)",
      ["/regulatory/cmA", "/drive/fichier9"],
    );
    expect(texte).toBe("[Dossier](/regulatory/cmA) et [Fichier](/drive/fichier9)");
    expect(repares).toBe(2);
  });

  it("sans lien collecté ou sans lien markdown interne : le texte ressort intact", () => {
    expect(reparerLiensInternes("Aucun lien ici.", ["/x/y"]).texte).toBe("Aucun lien ici.");
    expect(reparerLiensInternes("[a](/regulatory/)", []).texte).toBe("[a](/regulatory/)");
  });
});
