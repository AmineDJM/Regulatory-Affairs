import { describe, it, expect } from "vitest";
import { LINKABLE_SOURCES, isLinkableSource, sourceHref, sourceLabel, sourceCaption } from "./source-link";
import { NAVIGATION } from "@/lib/labels";

describe("sourceHref — cliquer mène QUELQUE PART", () => {
  it("rend la fiche de l'objet source", () => {
    expect(sourceHref("SPONSORING", "abc")).toBe("/sponsoring/abc");
    expect(sourceHref("ADMIN_REQUEST", "xyz")).toBe("/demandes/xyz");
  });

  it("rend null plutôt qu'un lien mort quand on ne sait pas où aller", () => {
    // Un type hors carte n'est pas une erreur : c'est un objet vers lequel on ne sait pas encore
    // naviguer. On préfère l'afficher sans lien que d'envoyer sur une page inexistante.
    expect(sourceHref("VALIDATION_REQUEST", "abc")).toBeNull();
    expect(sourceHref("SPONSORING", null)).toBeNull();
    expect(sourceHref(null, "abc")).toBeNull();
  });

  it("TOUTES les routes déclarées appartiennent à un module de la navigation", () => {
    // Le garde-fou qui empêche la carte de mentir : une route inventée (ou une entrée de menu
    // renommée sans repasser ici) produirait un lien mort, et un lien mort dans un fil de
    // rattachement fait douter de tout le reste.
    const known = new Set<string>();
    for (const n of NAVIGATION) {
      known.add(n.href);
      for (const t of n.tabs ?? []) known.add(t.href);
      for (const m of n.match ?? []) known.add(m);
    }
    for (const [type, build] of Object.entries(LINKABLE_SOURCES)) {
      const href = build!("ID");
      // « /sponsoring/ID » doit être porté par une entrée « /sponsoring » (ou plus précise).
      const reachable = [...known].some((k) => k !== "/" && href.startsWith(k));
      expect(reachable, `${type} → ${href}`).toBe(true);
    }
  });
});

describe("isLinkableSource", () => {
  it("ne se laisse pas berner par une chaîne vide ou inconnue", () => {
    expect(isLinkableSource("SPONSORING")).toBe(true);
    expect(isLinkableSource("")).toBe(false);
    expect(isLinkableSource(null)).toBe(false);
    expect(isLinkableSource("N'IMPORTE QUOI")).toBe(false);
  });
});

describe("sourceCaption — ce qu'on lit, jamais un identifiant technique", () => {
  it("nomme le type et sa référence", () => {
    expect(sourceCaption("SPONSORING", "SPO-2026-014")).toBe("Sponsoring SPO-2026-014");
  });

  it("se contente du type quand la référence manque — pas d'identifiant de base", () => {
    expect(sourceCaption("ADMIN_REQUEST", null)).toBe(sourceLabel("ADMIN_REQUEST"));
    expect(sourceCaption("ADMIN_REQUEST", "   ")).toBe(sourceLabel("ADMIN_REQUEST"));
  });

  it("rend null quand il n'y a aucune source — la ligne ne doit pas s'afficher vide", () => {
    expect(sourceCaption(null)).toBeNull();
  });
});
