import { describe, expect, it } from "vitest";
import { attribuerLocuteurs, chercher, decouperEnChapitres, fenetre, formatHorodatage, instantsAregarder, lireHorodatage, locuteursDe, motsCles, normaliserSegments, statistiques, texteHorodate, type Segment } from "./transcription";

/**
 * LA TRANSCRIPTION COMME CONNAISSANCE (§38) : l'instant exact, le locuteur, la structure — tenus à la seconde.
 */
const REUNION: Segment[] = normaliserSegments([
  { start: 0, end: 4, text: "Bonjour à tous, on commence par le point réglementaire." },
  { start: 4, end: 11, text: "Le dossier Trastuzex est complet, il part à l'ANPP lundi." },
  { start: 11, end: 17, text: "Il reste la traduction arabe de la notice, Raihana s'en occupe." },
  { start: 24, end: 31, text: "Passons au budget. Le budget marketing 2027 doit baisser de dix pour cent." },
  { start: 31, end: 38, text: "Je propose de couper le congrès de Marseille et de garder Alger." },
  { start: 38, end: 44, text: "D'accord, décision prise : on garde Alger, on coupe Marseille." },
  { start: 52, end: 58, text: "Dernier point, le recrutement du délégué de Constantine." },
  { start: 58, end: 66, text: "Yassine, tu envoies la fiche de poste à la DRH avant vendredi." },
]);

describe("segments et horodatages", () => {
  it("normalise ce que le moteur rend (start/end/text), écarte le vide, trie ; formate et relit un horodatage", () => {
    expect(REUNION).toHaveLength(8);
    expect(normaliserSegments({ segments: [{ start: "3", end: "2", text: "x" }, { start: 1, end: 2, text: "   " }, { start: 0, end: 1, text: "a" }] })).toEqual([{ debut: 0, fin: 1, texte: "a", locuteur: null }, { debut: 3, fin: 3, texte: "x", locuteur: null }]);
    expect(formatHorodatage(58)).toBe("00:58");
    expect(formatHorodatage(3_725)).toBe("1:02:05");
    expect(lireHorodatage("1:02:05")).toBe(3_725);
    expect(lireHorodatage("12:34")).toBe(754);
    expect(lireHorodatage("754")).toBe(754);
    expect(lireHorodatage("hier")).toBeNull();
  });
});

describe("chercher — « où exactement Yassine a-t-il parlé du budget ? »", () => {
  const avecLocuteurs = attribuerLocuteurs(REUNION, [{ index: 0, locuteur: "PDG" }, { index: 3, locuteur: "Yassine" }, { index: 5, locuteur: "PDG" }, { index: 6, locuteur: "Yassine" }, { index: 7, locuteur: "PDG" }]);
  it("rend l'instant, le locuteur et l'extrait ; filtre par locuteur ; ne devine rien sans mot utile", () => {
    const tous = chercher(avecLocuteurs, "budget");
    expect(tous.map((o) => o.horodatage)).toEqual(["00:24"]);
    expect(tous[0]).toMatchObject({ index: 3, locuteur: "Yassine", score: 1 });
    expect(tous[0]!.extrait).toMatch(/Trastuzex|traduction/);
    expect(chercher(avecLocuteurs, "budget", { locuteur: "yassine" })).toHaveLength(1);
    expect(chercher(avecLocuteurs, "budget", { locuteur: "PDG" })).toHaveLength(0);
    expect(chercher(avecLocuteurs, "Marseille Alger").map((o) => o.index).sort()).toEqual([4, 5]);
    expect(chercher(avecLocuteurs, "congrès de Marseille")[0]!.index).toBe(4);
    expect(chercher(avecLocuteurs, "le")).toEqual([]);
    expect(chercher(avecLocuteurs, "budget", { max: 1 })).toHaveLength(1);
  });
  it("les locuteurs : temps de parole et part ; le texte horodaté porte le locuteur", () => {
    const l = locuteursDe(avecLocuteurs);
    expect(l[0]!.locuteur).toBe("PDG");
    expect(l.reduce((s, x) => s + x.part, 0)).toBeGreaterThan(0.98);
    expect(texteHorodate(avecLocuteurs).split("\n")[3]).toBe("[00:24] Yassine : Passons au budget. Le budget marketing 2027 doit baisser de dix pour cent.");
    expect(statistiques(avecLocuteurs)).toMatchObject({ dureeS: 66, segments: 8, locuteurs: 2 });
  });
});

describe("structure — chapitres aux silences et aux changements de sujet", () => {
  it("coupe sur les pauses longues, nomme par mots-clés, borne la durée", () => {
    const ch = decouperEnChapitres(REUNION, { pauseMin: 6 });
    expect(ch).toHaveLength(3);
    expect(ch.map((c) => [c.de, c.a])).toEqual([[0, 2], [3, 5], [6, 7]]);
    expect(ch[1]!.titre.toLowerCase()).toMatch(/budget|marseille|alger/);
    expect(ch[0]!.debut).toBe(0); expect(ch[2]!.fin).toBe(66);
    const longs = Array.from({ length: 40 }, (_, i) => ({ debut: i * 30, fin: i * 30 + 25, texte: `segment ${i} sur le même sujet de production et de qualité` }));
    const parDuree = decouperEnChapitres(longs, { pauseMin: 60, dureeMax: 300 });
    expect(parDuree.length).toBeGreaterThanOrEqual(4);
    expect(parDuree.every((c) => c.fin - c.debut <= 330)).toBe(true);
    expect(motsCles("le budget du budget est un budget de marketing marketing", 2)).toEqual(["budget", "marketing"]);
  });
  it("les instants à regarder dans une vidéo : autour des passages qui répondent, sinon au début des chapitres — bornés", () => {
    expect(instantsAregarder(REUNION, { requete: "budget" })).toEqual([28]);
    const sans = instantsAregarder(REUNION, { max: 2 });
    expect(sans).toHaveLength(2);
    expect(sans[0]).toBeGreaterThanOrEqual(0);
    expect(fenetre(REUNION, 30, 40).map((s) => s.debut)).toEqual([24, 31, 38]);
  });
});
