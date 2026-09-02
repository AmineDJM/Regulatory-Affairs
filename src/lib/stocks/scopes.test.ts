import { describe, it, expect } from "vitest";
import {
  visibleStockScopes, canSeeStockScope, canRequestStockState, keepVisibleSnapshots,
  STOCK_SCOPE_LABEL, type StockViewer,
} from "./scopes";

/** Un délégué médical : il relève le terrain, il ne pilote pas la chaîne d'approvisionnement. */
const kam: StockViewer = { canSeeSupplyChain: false };
/** Logistique, opérations, marchés PCH. */
const supply: StockViewer = { canSeeSupplyChain: true };
/** Direction, Super Admin. */
const direction: StockViewer = { canSeeSupplyChain: false, hasGlobalView: true };

describe("les onglets de stock auxquels on a droit", () => {
  it("LE TERRAIN NE VOIT QUE LES HÔPITAUX — ceux qu'il visite", () => {
    // PCH et ses annexes sont la chaîne d'approvisionnement : la position de la centrale d'achat
    // n'est pas le métier d'un KAM, et elle lui était pourtant ouverte.
    expect(visibleStockScopes(kam)).toEqual(["HOSPITAL"]);
    expect(canSeeStockScope(kam, "PCH")).toBe(false);
    expect(canSeeStockScope(kam, "ANNEX")).toBe(false);
    expect(canSeeStockScope(kam, "HOSPITAL")).toBe(true);
  });

  it("la chaîne d'approvisionnement voit les trois", () => {
    expect(visibleStockScopes(supply)).toEqual(["PCH", "HOSPITAL", "ANNEX"]);
  });

  it("la vue globale voit tout, sans avoir le module PCH", () => {
    expect(visibleStockScopes(direction)).toEqual(["PCH", "HOSPITAL", "ANNEX"]);
  });

  it("JAMAIS VIDE — un écran qui s'ouvre sur rien fait chercher la panne", () => {
    for (const v of [kam, supply, direction]) expect(visibleStockScopes(v).length).toBeGreaterThan(0);
  });

  it("la règle ne nomme aucun rôle : c'est l'accès à la chaîne qui décide", () => {
    // Écrire « sauf MEDICAL_DELEGATE » aurait tenu jusqu'à la première nomination d'un rôle
    // terrain qu'on aurait oublié d'ajouter à la liste.
    expect(visibleStockScopes({ canSeeSupplyChain: false })).toEqual(visibleStockScopes(kam));
    expect(visibleStockScopes({ canSeeSupplyChain: true })).toEqual(visibleStockScopes(supply));
  });
});

describe("demander un état de stock", () => {
  it("REFUSÉ au terrain — c'est une réquisition adressée à quelqu'un, pas une lecture", () => {
    expect(canRequestStockState(kam)).toBe(false);
  });

  it("ouvert à la chaîne d'approvisionnement, à la direction et au Super Admin", () => {
    expect(canRequestStockState(supply)).toBe(true);
    expect(canRequestStockState(direction)).toBe(true);
    expect(canRequestStockState({ canSeeSupplyChain: false, isSuperAdmin: true })).toBe(true);
  });
});

describe("les relevés envoyés à l'écran", () => {
  const rows = [
    { id: "a", scope: "PCH" },
    { id: "b", scope: "HOSPITAL" },
    { id: "c", scope: "ANNEX" },
  ];

  it("LE FILTRE S'APPLIQUE AUX DONNÉES, pas seulement aux onglets", () => {
    // Masquer un onglet dont les chiffres partent quand même dans la page n'est pas une
    // restriction, c'est une décoration : ils se lisent dans la charge utile.
    expect(keepVisibleSnapshots(kam, rows).map((r) => r.id)).toEqual(["b"]);
  });

  it("la chaîne reçoit tout", () => {
    expect(keepVisibleSnapshots(supply, rows)).toHaveLength(3);
  });

  it("un `scope` inconnu est ÉCARTÉ pour le terrain — le doute referme", () => {
    expect(keepVisibleSnapshots(kam, [{ id: "x", scope: "AUTRE" }])).toEqual([]);
    expect(keepVisibleSnapshots(supply, [{ id: "x", scope: "AUTRE" }])).toHaveLength(1);
  });

  it("ne modifie pas le tableau reçu", () => {
    const copie = rows.map((r) => r.id);
    keepVisibleSnapshots(kam, rows);
    expect(rows.map((r) => r.id)).toEqual(copie);
  });
});

describe("les libellés", () => {
  it("nomment les trois portées en français", () => {
    expect(STOCK_SCOPE_LABEL.PCH).toBe("Stock PCH");
    expect(STOCK_SCOPE_LABEL.HOSPITAL).toBe("Stock hôpitaux");
    expect(STOCK_SCOPE_LABEL.ANNEX).toBe("Stock annexes PCH");
  });
});
