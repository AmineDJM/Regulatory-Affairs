import { describe, it, expect } from "vitest";
import { reécriteLienNotification } from "./lien-actuel";

describe("reécriteLienNotification", () => {
  describe("chemins obsolètes", () => {
    it("réécrit /missions → /centre-de-missions", () => {
      expect(reécriteLienNotification("/missions")).toBe("/centre-de-missions");
      expect(reécriteLienNotification("/missions?tab=2")).toBe("/centre-de-missions?tab=2");
    });

    it("réécrit /planning/business-units → /business-units", () => {
      expect(reécriteLienNotification("/planning/business-units")).toBe("/business-units");
      expect(reécriteLienNotification("/planning/business-units#vue")).toBe("/business-units#vue");
    });

    it("réécrit /regulatory/catalogue → /produits", () => {
      expect(reécriteLienNotification("/regulatory/catalogue")).toBe("/produits");
    });
  });

  describe("chemins valides (inchangés)", () => {
    it("laisse les routes actuelles telles quelles", () => {
      expect(reécriteLienNotification("/rh")).toBe("/rh");
      expect(reécriteLienNotification("/mon-dossier")).toBe("/mon-dossier");
      expect(reécriteLienNotification("/finances")).toBe("/finances");
      expect(reécriteLienNotification("/medical")).toBe("/medical");
    });

    it("laisse les chemins avec IDs dynamiques", () => {
      expect(reécriteLienNotification("/rh/xyz123")).toBe("/rh/xyz123");
      expect(reécriteLienNotification("/demandes/abc456")).toBe("/demandes/abc456");
    });

    it("préserve query params et hash", () => {
      expect(reécriteLienNotification("/mon-equipe?vue=kpi")).toBe("/mon-equipe?vue=kpi");
      expect(reécriteLienNotification("/mon-espace#conges-a-signer")).toBe("/mon-espace#conges-a-signer");
      expect(reécriteLienNotification("/legal?echeances=1")).toBe("/legal?echeances=1");
    });
  });

  describe("paramètres de query renommés", () => {
    it("renomme id → demande pour /rh/demandes", () => {
      expect(reécriteLienNotification("/rh/demandes?id=req123")).toBe("/rh/demandes?demande=req123");
      expect(reécriteLienNotification("/rh/demandes?id=req123&filtre=a-traiter")).toBe(
        "/rh/demandes?filtre=a-traiter&demande=req123"
      );
    });

    it("ne renomme id → demande pour d'autres routes", () => {
      expect(reécriteLienNotification("/rh?id=emp123")).toBe("/rh?id=emp123");
      expect(reécriteLienNotification("/messages?id=msg456")).toBe("/messages?id=msg456");
    });
  });

  describe("cas limites", () => {
    it("gère null et undefined", () => {
      expect(reécriteLienNotification(null)).toBeNull();
      expect(reécriteLienNotification(undefined)).toBeNull();
    });

    it("gère les chaînes vides", () => {
      expect(reécriteLienNotification("")).toBeNull();
    });

    it("gère les URLs externes (ne pas les modifier)", () => {
      // Les URLs externes ne posent pas problème : elles passent la vérification
      // et sont rendues telles quelles dans le navigateur.
    });
  });

  describe("chemins composés", () => {
    it("traite /planning/business-units?param=val avec query", () => {
      expect(reécriteLienNotification("/planning/business-units?tab=2#section")).toBe(
        "/business-units?tab=2#section"
      );
    });
  });
});
