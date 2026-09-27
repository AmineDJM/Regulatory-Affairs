import { describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ usePathname: () => "/mon-espace" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children),
}));

import { MobileTabBar } from "./mobile-tabbar";
import type { NavItem } from "@/lib/labels";

/**
 * UN ONGLET FIXE N'OUVRE PAS CE QUE LE MENU FERME (§118.153).
 *
 * L'onglet « Assistant » de la barre mobile était dessiné en dur, pour tout le monde, alors que
 * le menu réserve Adam au Super Admin : la personne le touchait et tombait sur une page
 * introuvable. On REND la vraie barre avec deux menus — celui d'un employé, celui du Super
 * Admin — et on lit les liens produits. « Messages » n'est pas une entrée de menu : il doit
 * rester, sans quoi la règle aurait été écrite trop large (« tout onglet suit le menu »).
 */

const ESPACE: NavItem = { module: "WORKSPACE", label: "Mon espace", href: "/mon-espace", icon: "LayoutGrid", group: "Pilotage" };
const ASSISTANT: NavItem = { module: "WORKSPACE", label: "Assistant IA", href: "/assistant", icon: "Sparkles", group: "Pilotage" };
const liens = (items: NavItem[]) =>
  [...renderToStaticMarkup(React.createElement(MobileTabBar, { items })).matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

describe("barre d'onglets mobile — l'onglet Assistant suit le menu", () => {
  it("un menu SANS Adam : pas d'onglet Assistant, mais Espace et Messages restent", () => {
    const l = liens([ESPACE]);
    expect(l).not.toContain("/assistant");
    expect(l).toEqual(expect.arrayContaining(["/mon-espace", "/messages"]));
  });

  it("un menu AVEC Adam (Super Admin) : l'onglet est là — la garde ne ferme que ce qu'elle doit", () => {
    expect(liens([ESPACE, ASSISTANT])).toContain("/assistant");
  });
});
