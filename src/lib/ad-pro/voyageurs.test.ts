import { describe, it, expect } from "vitest";
import {
  lireVoyageur, manquesPourReserver, ligneVoyageur, changementsVoyageur, porteDesVoyageurs, NATURES_A_VOYAGEURS,
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
  nom: "Dr Amel Haddad", villeDepart: "Alger", villeArrivee: "Paris", dateDepart: new Date("2026-11-12T00:00:00Z"), dateRetour: null, notes: null, ...v,
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
