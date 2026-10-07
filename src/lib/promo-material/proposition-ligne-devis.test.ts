import { describe, expect, it } from "vitest";
import { devinerAction, proposerLigne, rapprocherArticle, type ArticlePourRapprochement } from "@/lib/promo-material/proposition-ligne-devis";

const article = (id: string, nom: string, quantite: number | null, actions: ArticlePourRapprochement["actions"] = [], promus: string[] = []): ArticlePourRapprochement =>
  ({ id, reference: `CAT-${id}`, nom, quantite, actions, promus });

describe("l'action d'une ligne lue se propose depuis sa désignation (Direction, 07/10)", () => {
  it("le verbe imprimé d'abord — le premier qui apparaît", () => {
    expect(devinerAction("Impression fiche posologique A4 recto verso")).toBe("IMPRESSION");
    expect(devinerAction("Conception et impression de dépliants")).toBe("CONCEPTION");
    expect(devinerAction("Création graphique — maquette du kakémono")).toBe("CONCEPTION");
    expect(devinerAction("Frais de livraison Alger")).toBe("LIVRAISON");
    expect(devinerAction("Transport et montage du stand")).toBe("LIVRAISON");
    expect(devinerAction("Montage et démontage du stand")).toBe("INSTALLATION");
    expect(devinerAction("Location stand 3x3 (2 jours)")).toBe("LOCATION");
    expect(devinerAction("Fabrication présentoir comptoir")).toBe("FABRICATION");
  });

  it("sinon la nature de l'objet ; rien quand rien ne la dit", () => {
    expect(devinerAction("Dépliant 3 volets 135 g")).toBe("IMPRESSION");
    expect(devinerAction("Présentoir de comptoir en PVC")).toBe("FABRICATION");
    expect(devinerAction("Kakémono 80x200")).toBe("FABRICATION");
    expect(devinerAction("Stylos personnalisés logo")).toBe("ACHAT");
    expect(devinerAction("Clé USB 16 Go")).toBe("ACHAT");
    expect(devinerAction("Divers")).toBeNull();
    expect(devinerAction("")).toBeNull();
  });
});

describe("l'article demandé se rapproche — un ex æquo ne choisit pas", () => {
  const articles = [
    article("k1", "Fiche posologique", 5000, ["CONCEPTION", "IMPRESSION"], ["Nivolex"]),
    article("k2", "Présentoir de comptoir", 20, ["FABRICATION"]),
    article("k3", "Stylo", 1000, ["ACHAT"]),
  ];

  it("par les mots partagés avec le nom (ou ce qu'il promeut)", () => {
    expect(rapprocherArticle({ designation: "Impression fiches posologiques A4", quantite: 2000 }, articles)).toBe("k1");
    expect(rapprocherArticle({ designation: "Présentoir comptoir PVC", quantite: 10 }, articles)).toBe("k2");
    expect(rapprocherArticle({ designation: "Dépliant Nivolex", quantite: 300 }, articles)).toBe("k1");
  });

  it("par la référence catalogue citée, ou une quantité égale à la quantité demandée", () => {
    expect(rapprocherArticle({ designation: "Article CAT-k3 personnalisé", quantite: 5 }, articles)).toBe("k3");
    expect(rapprocherArticle({ designation: "Objet publicitaire", quantite: 1000 }, articles)).toBe("k3");
  });

  it("rien de reconnaissable, ou deux articles à égalité : la ligne reste « en plus »", () => {
    expect(rapprocherArticle({ designation: "Frais de dossier", quantite: 1 }, articles)).toBeNull();
    const jumeaux = [article("x", "Affiche A3", 100), article("y", "Affiche A2", 100)];
    expect(rapprocherArticle({ designation: "Affiche", quantite: 100 }, jumeaux)).toBeNull();
    expect(rapprocherArticle({ designation: "Frais de dossier", quantite: 1 }, [])).toBeNull();
  });

  it("un seul article demandé sur le dossier : toute ligne le chiffre", () => {
    expect(rapprocherArticle({ designation: "Livraison", quantite: 1 }, [articles[0]])).toBe("k1");
  });

  it("sans verbe ni objet reconnu, l'action UNIQUE que l'article demande", () => {
    expect(proposerLigne({ designation: "Présentoir comptoir", quantite: 20 }, articles)).toEqual({ action: "FABRICATION", articleId: "k2" });
    expect(proposerLigne({ designation: "Article CAT-k3", quantite: 1000 }, articles)).toEqual({ action: "ACHAT", articleId: "k3" });
    expect(proposerLigne({ designation: "Article CAT-k1", quantite: 5000 }, articles)).toEqual({ action: null, articleId: "k1" });
  });
});
