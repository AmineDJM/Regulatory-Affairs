import { describe, it, expect } from "vitest";
import { isInternalNavigation } from "./nav-progress";

/** Ce que le fil de progression doit IGNORER : tout ce qui n'est pas « une autre page, ici ». */
const HERE = "https://app.example.dz/regulatory?tab=pipeline";
const lien = (href: string, target = "", download = false) => ({
  href, target, hasAttribute: (n: string) => n === "download" && download,
});

describe("isInternalNavigation — le fil ne part que pour une vraie navigation interne", () => {
  it("une autre page de l'application", () => {
    expect(isInternalNavigation(lien("https://app.example.dz/mon-espace"), HERE)).toBe(true);
    expect(isInternalNavigation(lien("/pch/abc"), HERE)).toBe(true);
  });
  it("la même page avec d'autres paramètres (mois suivant du calendrier)", () => {
    expect(isInternalNavigation(lien("/regulatory?tab=corpus"), HERE)).toBe(true);
  });
  it("une ancre dans la même page, ou `href=\"#\"`", () => {
    expect(isInternalNavigation(lien("#haut"), HERE)).toBe(false);
    expect(isInternalNavigation(lien("#"), HERE)).toBe(false);
    expect(isInternalNavigation(lien("/regulatory?tab=pipeline#bas"), HERE)).toBe(false);
  });
  it("une autre origine, un nouvel onglet, un téléchargement", () => {
    expect(isInternalNavigation(lien("https://ailleurs.example.com/x"), HERE)).toBe(false);
    expect(isInternalNavigation(lien("/mon-espace", "_blank"), HERE)).toBe(false);
    expect(isInternalNavigation(lien("/api/files/1", "", true), HERE)).toBe(false);
    expect(isInternalNavigation(lien("mailto:x@y.dz"), HERE)).toBe(false);
  });
  it("une adresse illisible ne fait pas planter le clic", () => {
    expect(isInternalNavigation(lien("http://[oops"), HERE)).toBe(false);
  });
});
