import { describe, expect, it } from "vitest";
import {
  faitDeStock, lireConfirmation, manqueMaterielReserve, peutConfirmerMateriel, refusArgentSurPosteStock,
  refusChangementNature, refusReservation, repartirRetour, NATURE_MATERIEL_STOCK, STATUT_LIGNE_LABEL,
} from "./reservations";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE MATÉRIEL DU STOCK D'UN ÉVÉNEMENT AD & PRO (§118.167) — la règle pure.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

describe("la confirmation d'une ligne — un consommable se remet, un durable se rend", () => {
  it("CONSOMMABLE : ce qui n'a pas été remis revient au magasin", () => {
    const r = lireConfirmation("CONSOMMABLE", 200, { utilisee: "150" }, "Brochure");
    expect(r).toEqual({ ok: true, confirmation: { utilisee: 150, rendue: 50, abimee: null, perdue: null, retour: 50 } });
  });

  it("CONSOMMABLE : « 0 » est une réponse (tout revient) ; RIEN n'en est pas une", () => {
    expect(lireConfirmation("CONSOMMABLE", 40, { utilisee: "0" }, "Stylo")).toMatchObject({ ok: true, confirmation: { retour: 40 } });
    // Ce qui le ferait tomber : lire un champ vide comme « 0 remis » — tout reviendrait au magasin
    // sur une ligne dont personne n'a rien dit, et le registre compterait des unités distribuées.
    const vide = lireConfirmation("CONSOMMABLE", 40, { utilisee: "" }, "Stylo");
    expect(vide.ok).toBe(false);
    expect(vide.ok ? "" : vide.faute).toMatch(/dites combien ont été remis/);
  });

  it("CONSOMMABLE : remettre plus qu'on n'a réservé n'existe pas", () => {
    const r = lireConfirmation("CONSOMMABLE", 100, { utilisee: "120" }, "Fiche posologique");
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.faute).toMatch(/120 remis, mais 100 seulement étaient réservés/);
  });

  it("une quantité négative ou illisible est refusée — jamais retournée en positif", () => {
    expect(lireConfirmation("CONSOMMABLE", 10, { utilisee: "-3" }, "X").ok).toBe(false);
    expect(lireConfirmation("CONSOMMABLE", 10, { utilisee: "abc" }, "X").ok).toBe(false);
    expect(lireConfirmation("DURABLE", 2, { rendue: "-1", abimee: "3" }, "Kakémono").ok).toBe(false);
  });

  it("DURABLE : il est PRÊTÉ — rendus + abîmés + perdus doivent faire le compte, et seuls les rendus reviennent", () => {
    const r = lireConfirmation("DURABLE", 3, { rendue: "2", abimee: "1", perdue: "0" }, "Kakémono");
    expect(r).toEqual({ ok: true, confirmation: { utilisee: null, rendue: 2, abimee: 1, perdue: 0, retour: 2 } });
  });

  it("DURABLE : un kakémono dont on ne dit rien n'est ni rentré ni perdu — refusé", () => {
    const r = lireConfirmation("DURABLE", 3, { rendue: "2" }, "Kakémono");
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.faute).toMatch(/3 réservée\(s\), 2 déclarée\(s\)/);
  });

  it("les quantités françaises se lisent (« 1 200,5 »)", () => {
    expect(lireConfirmation("CONSOMMABLE", 2000, { utilisee: "1 200,5" }, "X")).toMatchObject({ ok: true, confirmation: { utilisee: 1200.5, retour: 799.5 } });
  });
});

describe("le retour dans les lots — le plus tard périmé d'abord", () => {
  const t = (lotId: string, quantite: number, fin: string | null, recu: string, numero = 1) =>
    ({ lotId, quantite, valableJusquau: fin ? new Date(fin) : null, recuLe: new Date(recu), numero });

  it("ce qui revient rentre d'abord dans le lot qui expire le plus TARD : on a remis les unités qui expiraient le plus tôt", () => {
    const r = repartirRetour([t("tot", 50, "2026-12-01", "2026-01-01"), t("tard", 50, "2027-06-01", "2026-02-01")], 70);
    expect(r).toEqual([{ lotId: "tard", quantite: 50 }, { lotId: "tot", quantite: 20 }]);
  });

  it("un lot SANS date de validité passe en premier (il n'expire jamais)", () => {
    const r = repartirRetour([t("date", 10, "2027-01-01", "2026-01-01"), t("sans", 10, null, "2026-01-01")], 5);
    expect(r).toEqual([{ lotId: "sans", quantite: 5 }]);
  });

  it("un retour ne dépasse jamais ce qu'une tranche a fait sortir — le surplus n'est attribué à personne", () => {
    const r = repartirRetour([t("a", 10, null, "2026-01-01")], 25);
    expect(r).toEqual([{ lotId: "a", quantite: 10 }]);
  });

  it("rien ne revient : aucune ligne", () => {
    expect(repartirRetour([t("a", 10, null, "2026-01-01")], 0)).toEqual([]);
  });
});

describe("l'accord refusé, la clôture refusée — des phrases qui nomment le remède", () => {
  it("l'accord refusé dit l'article, la quantité, ce qui manque, et les deux gestes", () => {
    const p = refusReservation("Kakémono — Nivolex", 5, "Le magasin n'en a que 2.");
    expect(p).toMatch(/5 « Kakémono — Nivolex » à réserver/);
    expect(p).toMatch(/Le magasin n'en a que 2/);
    expect(p).toMatch(/Réduisez la quantité du poste|faites d'abord entrer du stock/);
    expect(p).not.toMatch(/\.\. /);
  });

  it("une ligne RÉSERVÉE bloque la clôture ; demandée ou confirmée, non", () => {
    expect(manqueMaterielReserve([{ libelle: "A", statut: "DEMANDEE" }, { libelle: "B", statut: "CONFIRMEE" }])).toBeNull();
    const m = manqueMaterielReserve([{ libelle: "Kakémono", statut: "RESERVEE" }, { libelle: "Brochure", statut: "CONFIRMEE" }]);
    expect(m).toMatch(/1 article\(s\) du stock réservé\(s\).*« Kakémono »/);
    expect(m).not.toMatch(/Brochure/);
  });

  it("au-delà de trois lignes, la phrase compte les autres au lieu de les taire", () => {
    const m = manqueMaterielReserve(["A", "B", "C", "D", "E"].map((libelle) => ({ libelle, statut: "RESERVEE" })));
    expect(m).toMatch(/5 article\(s\)/);
    expect(m).toMatch(/et 2 autre\(s\)/);
  });

  it("les libellés de statut couvrent les trois états", () => {
    expect(Object.keys(STATUT_LIGNE_LABEL).sort()).toEqual(["CONFIRMEE", "DEMANDEE", "RESERVEE"]);
  });
});

describe("un poste « Matériel du stock » n'engage pas d'argent", () => {
  it("un geste d'argent y est refusé, ailleurs il passe", () => {
    expect(refusArgentSurPosteStock(NATURE_MATERIEL_STOCK, "un budget")).toMatch(/n'engage pas d'argent : un budget n'y a pas d'objet/);
    expect(refusArgentSurPosteStock("STAND", "un budget")).toBeNull();
  });

  it("la nature « Matériel du stock » ne se gagne ni ne se perd hors d'un brouillon vierge", () => {
    const vierge = { statut: "DRAFT", lignesStock: 0, argentEngage: false };
    expect(refusChangementNature("STAND", "CATERING", { ...vierge, statut: "APPROVED" }), "aucun passage par le stock").toBeNull();
    expect(refusChangementNature("STAND", NATURE_MATERIEL_STOCK, vierge), "brouillon vierge : permis").toBeNull();
    expect(refusChangementNature(NATURE_MATERIEL_STOCK, "STAND", vierge), "sans ligne : permis").toBeNull();
    expect(refusChangementNature("STAND", NATURE_MATERIEL_STOCK, { ...vierge, statut: "PENDING" })).toMatch(/se choisit sur un brouillon/);
    expect(refusChangementNature(NATURE_MATERIEL_STOCK, "STAND", { ...vierge, lignesStock: 2 })).toMatch(/retirez-les d'abord/);
    expect(refusChangementNature("STAND", NATURE_MATERIEL_STOCK, { ...vierge, argentEngage: true })).toMatch(/porte déjà une dépense/);
  });

  it("le brouillon ne suffit pas quand l'autre fait manque — les deux gardes sont lues, chacune avec son cas", () => {
    // Le cas qui fait tomber une garde sans l'autre : DRAFT mais lignes présentes, DRAFT mais argent engagé.
    expect(refusChangementNature(NATURE_MATERIEL_STOCK, "OTHER", { statut: "DRAFT", lignesStock: 1, argentEngage: false })).not.toBeNull();
    expect(refusChangementNature("OTHER", NATURE_MATERIEL_STOCK, { statut: "DRAFT", lignesStock: 0, argentEngage: true })).not.toBeNull();
  });
});

describe("ce qu'une ligne a fait au stock — et qui interdit d'effacer ce qui la porte", () => {
  it("RÉSERVÉE : le matériel est dehors", () => {
    expect(faitDeStock({ statut: "RESERVEE" })).toMatch(/réservé pour cet événement et n'a pas été confirmé/);
  });

  it("CONFIRMÉE avec du remis, de l'abîmé ou du perdu : le stock a réellement diminué", () => {
    expect(faitDeStock({ statut: "CONFIRMEE", utilisee: "12" })).toMatch(/remis, abîmé ou perdu/);
    expect(faitDeStock({ statut: "CONFIRMEE", utilisee: null, abimee: 0, perdue: 1 })).toMatch(/remis, abîmé ou perdu/);
  });

  it("CONFIRMÉE sans rien de sorti, ou réservation rendue : rien ne justifie de refuser", () => {
    expect(faitDeStock({ statut: "CONFIRMEE", utilisee: 0 })).toBeNull();
    expect(faitDeStock({ statut: "CONFIRMEE", utilisee: null, abimee: "0", perdue: "0" })).toBeNull();
    expect(faitDeStock({ statut: "DEMANDEE" })).toBeNull();
  });

  it("une quantité décimale de Prisma (objet) se lit comme un nombre", () => {
    const decimal = { valueOf: () => "3", toString: () => "3" };
    expect(faitDeStock({ statut: "CONFIRMEE", perdue: decimal })).not.toBeNull();
  });
});

describe("qui confirme le matériel après l'événement", () => {
  const aucun = { superAdmin: false, estLeDemandeur: false, gereLeMagasin: false, decideLesPostes: false };
  it("chacun des quatre suffit — et personne d'autre", () => {
    expect(peutConfirmerMateriel(aucun)).toBe(false);
    for (const k of ["superAdmin", "estLeDemandeur", "gereLeMagasin", "decideLesPostes"] as const) {
      expect(peutConfirmerMateriel({ ...aucun, [k]: true }), k).toBe(true);
    }
  });
});
