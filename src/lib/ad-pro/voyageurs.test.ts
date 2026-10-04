import { describe, it, expect } from "vitest";
import {
  lireVoyageur, manquesPourReserver, ligneVoyageur, changementsVoyageur, porteDesVoyageurs, NATURES_A_VOYAGEURS,
  prochainGesteVoyageur, depassementDevisRetenus,
  type SaisieVoyageur, type VoyageurLu,
} from "@/lib/ad-pro/voyageurs";

/**
 * LES VOYAGEURS D'UNE BILLETTERIE (§118.175) — « donner de la flexibilité si on modifie les dates
 * ultérieurement ou quand on n'a pas les infos à l'avance ».
 */
const saisie = (s: Partial<SaisieVoyageur> = {}): SaisieVoyageur => ({
  nom: "Dr Amel Haddad", villeDepart: null, villeArrivee: null, dateDepart: null, dateRetour: null, notes: null, ...s,
});
const lu = (v: Partial<VoyageurLu> = {}): VoyageurLu => ({
  nom: "Dr Amel Haddad", villeDepart: "Alger", villeArrivee: "Paris", dateDepart: new Date("2026-11-12T00:00:00Z"), dateRetour: null, notes: null, trajet: "ALLER_RETOUR", transport: null, ...v,
});

describe("un voyageur de la billetterie", () => {
  it("seule la billetterie porte des voyageurs — l'étendre est une décision, écrite en une ligne", () => {
    expect([...NATURES_A_VOYAGEURS]).toEqual(["TICKETING"]);
    expect(porteDesVoyageurs("TICKETING")).toBe(true);
    // Sans ce cas, une règle qui répondrait « oui » à tout passerait : un stand n'a pas de voyageurs.
    expect(porteDesVoyageurs("STAND")).toBe(false);
    expect(porteDesVoyageurs("ACCOMMODATION")).toBe(false);
  });

  it("un NOM suffit à l'enregistrer — on prend en charge un médecin avant de savoir quand il part", () => {
    const r = lireVoyageur(saisie());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.voyageur).toMatchObject({ nom: "Dr Amel Haddad", dateDepart: null, dateRetour: null });
  });

  it("sans nom, il n'existe pas ; une date illisible ou impossible se dit — et tout est dit en une fois", () => {
    const r = lireVoyageur(saisie({ nom: "  ", dateDepart: "31/02/2026", dateRetour: "2026-02-31" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/nom de la personne/);
    expect(r.error).toMatch(/date de départ lisible/);
    // « 2026-02-31 » a la bonne forme mais n'existe pas : l'écrire donnerait le 3 mars.
    expect(r.error).toMatch(/date de retour lisible/);
  });

  it("le retour ne précède pas le départ — mais le même jour est permis", () => {
    expect(lireVoyageur(saisie({ dateDepart: "2026-11-12", dateRetour: "2026-11-10" })).ok).toBe(false);
    expect(lireVoyageur(saisie({ dateDepart: "2026-11-12", dateRetour: "2026-11-12" })).ok).toBe(true);
  });

  it("ce qui manque pour RÉSERVER est nommé — et ne bloque pas l'enregistrement", () => {
    const v = { nom: "Dr Amel Haddad", villeDepart: "Alger", villeArrivee: null, dateDepart: null, dateRetour: null, passeport: false, notes: null };
    expect(manquesPourReserver(v)).toEqual(["date de départ", "trajet", "passeport"]);
    expect(manquesPourReserver({ ...v, villeArrivee: "Paris", dateDepart: new Date("2026-11-12T00:00:00Z"), passeport: true })).toEqual([]);
  });

  it("la ligne que l'assistante lit dit ce qu'on sait ET ce qui manque", () => {
    const l = ligneVoyageur({ nom: "Dr Amel Haddad", villeDepart: "Alger", villeArrivee: "Paris", dateDepart: new Date("2026-11-12T00:00:00Z"), dateRetour: null, passeport: false, notes: "Classe éco" });
    expect(l).toBe("• Dr Amel Haddad — Alger → Paris — aller 12/11/2026, retour à confirmer (manque : passeport) — Classe éco");
  });

  it("une date décalée se dit dans le sujet — et un enregistrement à l'identique ne dérange personne", () => {
    expect(changementsVoyageur(lu(), lu())).toEqual([]);
    expect(changementsVoyageur(lu(), lu({ dateDepart: new Date("2026-11-14T00:00:00Z"), dateRetour: new Date("2026-11-20T00:00:00Z") })))
      .toEqual(["aller : 12/11/2026 → 14/11/2026", "retour : à confirmer → 20/11/2026"]);
    expect(changementsVoyageur(lu(), lu({ villeArrivee: "Lyon" }))).toEqual(["trajet : Alger → Paris devient Alger → Lyon"]);
    expect(changementsVoyageur(lu({ notes: "Classe éco" }), lu())).toEqual(["précisions : retirées"]);
  });
});

describe("trajet, transport, devis par voyageur (§118.205)", () => {
  it("en ALLER SIMPLE la date de retour est vidée et jamais exigée — même illisible", () => {
    const r = lireVoyageur(saisie({ trajet: "ALLER_SIMPLE", dateDepart: "2026-11-12", dateRetour: "pas une date" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.voyageur).toMatchObject({ trajet: "ALLER_SIMPLE", dateRetour: null });
    // Témoin : en aller-retour, la même date illisible est refusée.
    expect(lireVoyageur(saisie({ trajet: "ALLER_RETOUR", dateRetour: "pas une date" })).ok).toBe(false);
  });

  it("un trajet ou un mode inconnus sont refusés, jamais devinés ; vides, ils valent aller-retour et « à préciser »", () => {
    const r = lireVoyageur(saisie({ trajet: "ALLER_TOUT_COURT", transport: "FUSEE" }));
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error).toMatch(/trajet reconnu/); expect(r.error).toMatch(/mode de transport reconnu/); }
    const v = lireVoyageur(saisie({ transport: "TRAIN" }));
    expect(v.ok && v.voyageur).toMatchObject({ trajet: "ALLER_RETOUR", transport: "TRAIN" });
    const vide = lireVoyageur(saisie());
    expect(vide.ok && vide.voyageur).toMatchObject({ trajet: "ALLER_RETOUR", transport: null });
  });

  it("la ligne de l'assistante dit l'aller simple et le mode ; un changement de trajet se dit", () => {
    const l = ligneVoyageur({ ...lu({ trajet: "ALLER_SIMPLE", transport: "BUS" }), passeport: true });
    expect(l).toMatch(/aller simple 12\/11\/2026/);
    expect(l).not.toMatch(/retour/);
    expect(l).toMatch(/— bus —/);
    expect(changementsVoyageur(lu(), lu({ trajet: "ALLER_SIMPLE", transport: "TAXI" }))).toEqual([
      "trajet : aller-retour → aller simple", "transport : — → taxi",
    ]);
    expect(manquesPourReserver({ ...lu({ transport: null }), passeport: true })).toContain("mode de transport");
  });

  it("UN seul geste visible, dans l'ordre : passeport, puis devis, puis valider ; rien une fois retenu", () => {
    expect(prochainGesteVoyageur({ passeport: false, devis: [] }, true)).toBe("PASSEPORT");
    expect(prochainGesteVoyageur({ passeport: true, devis: [] }, true)).toBe("DEVIS");
    // Un devis ANNULÉ au registre ne compte pas : on en redemande un.
    expect(prochainGesteVoyageur({ passeport: true, devis: [{ montant: 10, retenu: false, annule: true }] }, true)).toBe("DEVIS");
    expect(prochainGesteVoyageur({ passeport: true, devis: [{ montant: 10, retenu: false }] }, true)).toBe("VALIDER");
    expect(prochainGesteVoyageur({ passeport: true, devis: [{ montant: 10, retenu: true }, { montant: 9, retenu: false }] }, true)).toBeNull();
    expect(prochainGesteVoyageur({ passeport: false, devis: [] }, false)).toBeNull();
  });

  it("un dépassement du montant accordé se DIT, au centime ; égalité, inconnu ou montant manquant : rien", () => {
    expect(depassementDevisRetenus([60000, 50000.01], 110000)?.replace(/\s/g, " ")).toMatch(/110 000,01 DZD.*110 000 DZD.*\+0,01 DZD/);
    expect(depassementDevisRetenus([60000, 50000], 110000)).toBeNull();
    expect(depassementDevisRetenus([60000, null], 1)).toBeNull();
    expect(depassementDevisRetenus([60000], null)).toBeNull();
  });
});
