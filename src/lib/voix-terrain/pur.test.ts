import { describe, it, expect } from "vitest";
import {
  categoriesParMotsCles, estVerbatim, extraitCourt, lireReponseVoix, regrouperParMotsCles, texteDuRapport, trouverVerbatim,
  type RapportTerrain,
} from "./pur";

const T = new Date("2026-10-09T10:00:00Z");
const r = (id: string, texte: string, delegateId: string | null = "k1"): RapportTerrain => ({ id, texte: texteDuRapport(texte), delegateId });

const RAPPORTS = [
  r("v:1", "Le service préfère la forme 1 prise par jour. Il trouve aussi le prix trop élevé pour l'appel d'offres."),
  r("v:2", "Rupture en septembre, les patients ont été switchés vers un autre traitement.", "k2"),
  r("v:3", "Demande d'une journée de formation pour les résidents.", "k2"),
  r("v:4", "Visite cordiale, rien à signaler."),
];

describe("la voix du terrain — le repli par mots-clés", () => {
  it("range chaque rapport dans les familles que ses mots évoquent (sans accents ni casse)", () => {
    expect(categoriesParMotsCles("Le service PRÉFÈRE la forme 1 prise par jour")).toContain("OBJECTION");
    expect(categoriesParMotsCles("Rupture de stock au CHU")).toContain("APPROVISIONNEMENT");
    expect(categoriesParMotsCles("Patient avec éruption cutanée sous traitement")).toContain("PHARMACOVIGILANCE");
    expect(categoriesParMotsCles("Le concurrent propose des formations en service")).toContain("CONCURRENCE");
    expect(categoriesParMotsCles("Visite cordiale, rien à signaler.")).toEqual([]);
  });

  it("compte rapports et délégués, cite une phrase MOT POUR MOT, compte les objections « prix / AO »", () => {
    const v = regrouperParMotsCles(RAPPORTS, 30, T);
    expect(v.parLuna).toBe(false);
    expect(v.rapports).toBe(4);
    const obj = v.groupes.find((g) => g.categorie === "OBJECTION")!;
    expect(obj.rapports).toBe(1);
    expect(obj.citation?.texte).toBe("Le service préfère la forme 1 prise par jour.");
    expect(v.objectionsPrixAo).toBe(1);
    const appro = v.groupes.find((g) => g.categorie === "APPROVISIONNEMENT")!;
    expect(appro.delegues).toBe(1);
    for (const g of v.groupes) if (g.citation) expect(estVerbatim(g.citation.texte, RAPPORTS.find((x) => x.id === g.citation!.rapportId)!.texte)).toBe(true);
  });

  it("un extrait trop long est coupé à un mot — il reste un début de phrase écrit tel quel", () => {
    const long = `${"Le chef de service explique longuement ".repeat(6)}fin.`;
    const e = extraitCourt(long);
    expect(e.coupe).toBe(true);
    expect(e.texte.length).toBeLessThanOrEqual(160);
    expect(long.startsWith(e.texte)).toBe(true);
  });
});

describe("la voix du terrain — la relecture stricte de Luna", () => {
  it("garde les familles et identifiants connus, et ne garde qu'une citation retrouvée MOT POUR MOT", () => {
    const data = {
      groupes: [
        { categorie: "OBJECTION", rapportIds: ["v:1", "inconnu"], citation: { rapportId: "v:1", extrait: "« le service préfère la forme 1 prise par jour »" } },
        // Citation INVENTÉE : refusée, la citation de repli est prise dans le rapport du groupe.
        { categorie: "APPROVISIONNEMENT", rapportIds: ["v:2"], citation: { rapportId: "v:2", extrait: "Le CHU manque gravement de produit." } },
        { categorie: "INVENTEE", rapportIds: ["v:3"], citation: { rapportId: "v:3", extrait: "Demande d'une journée" } },
        { categorie: "OPPORTUNITE", rapportIds: [], citation: { rapportId: "v:3", extrait: "Demande d'une journée" } },
      ],
    };
    const v = lireReponseVoix(data, RAPPORTS, 30, T)!;
    expect(v.parLuna).toBe(true);
    // À égalité de rapports, l'ordre des familles.
    expect(v.groupes.map((g) => g.categorie)).toEqual(["OBJECTION", "APPROVISIONNEMENT"]);
    const obj = v.groupes.find((g) => g.categorie === "OBJECTION")!;
    // Le texte cité est celui du RAPPORT (sa casse), pas la copie du modèle.
    expect(obj.citation?.texte).toBe("Le service préfère la forme 1 prise par jour");
    const appro = v.groupes.find((g) => g.categorie === "APPROVISIONNEMENT")!;
    expect(appro.citation?.texte).toBe("Rupture en septembre, les patients ont été switchés vers un autre traitement.");
  });

  it("une réponse hors forme → null (le repli prend la main)", () => {
    expect(lireReponseVoix(null, RAPPORTS, 30, T)).toBeNull();
    expect(lireReponseVoix({ autre: 1 }, RAPPORTS, 30, T)).toBeNull();
  });

  it("trouverVerbatim rend la portion du texte source, ou null", () => {
    expect(trouverVerbatim("RUPTURE EN SEPTEMBRE", RAPPORTS[1].texte)).toBe("Rupture en septembre");
    expect(trouverVerbatim("rupture en octobre", RAPPORTS[1].texte)).toBeNull();
    expect(trouverVerbatim("court", RAPPORTS[1].texte)).toBeNull();
  });
});
