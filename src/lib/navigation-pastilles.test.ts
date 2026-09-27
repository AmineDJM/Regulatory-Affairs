import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { NAVIGATION, type NavItem } from "@/lib/labels";
import { groupIntoPoles, pastillesDesEntrees, modulesDeLEntree } from "@/lib/navigation";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE PASTILLE PAR MODULE, JAMAIS UNE PAR SOUS-MENU (§118.154).
 *
 * Mesuré dans la peau des Finances : « 3 » sur Finances ET sur Banque & paiements, Comptabilité
 * et Bons de commande — les trois notifications du module affichées quatre fois, et « Bons de
 * commande 3 » quand aucun bon n'attendait de signature. Le cas est joué sur le VRAI catalogue du
 * menu : une entrée fabriquée pour le banc prouverait une règle sur un menu qui n'existe pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const entree = (label: string): NavItem => {
  const e = NAVIGATION.find((n) => n.label === label);
  if (!e) throw new Error(`entrée « ${label} » absente du catalogue`);
  return e;
};

describe("pastillesDesEntrees — chaque module compté une fois", () => {
  it("PRÉMISSE : Finances et ses trois sous-menus portent le MÊME module — sinon le cas ne mesure rien", () => {
    const finances = entree("Finances");
    expect(finances.children?.map((c) => c.module)).toEqual(["FINANCES", "FINANCES", "FINANCES"]);
  });

  it("le parent porte la pastille ; ses sous-menus du même module n'en portent aucune", () => {
    const finances = entree("Finances");
    const badges = { FINANCES: 3 };
    expect(pastillesDesEntrees([finances], badges)).toEqual([3]);
    expect(pastillesDesEntrees(finances.children ?? [], badges, modulesDeLEntree(finances))).toEqual([0, 0, 0]);
  });

  it("un sous-menu d'un AUTRE module garde sa propre pastille — la règle n'efface rien", () => {
    // Mon Équipe : le premier sous-menu répète le parent, le Recrutement est un module à part.
    const equipe = entree("Mon Équipe");
    expect(equipe.children?.map((c) => c.module)).toEqual(["MY_TEAM", "RECRUITMENT"]);
    const badges = { MY_TEAM: 2, RECRUITMENT: 4 };
    expect(pastillesDesEntrees(equipe.children ?? [], badges, modulesDeLEntree(equipe))).toEqual([0, 4]);
  });

  it("entre sœurs : la première entrée du module compte, les suivantes non ; le pôle replié ne multiplie plus", () => {
    const regulatory = groupIntoPoles(NAVIGATION).find((p) => p.key === "REGULATORY");
    expect(regulatory, "le pôle Regulatory existe au catalogue").toBeTruthy();
    const modules = regulatory!.children.map((c) => c.module);
    // PRÉMISSE : au moins deux entrées sœurs du même module, sinon le cas est inerte.
    expect(modules.filter((m) => m === "REGULATORY").length).toBeGreaterThanOrEqual(2);
    const badges = { REGULATORY: 2, MEDICAL_INFO: 1 };
    const pastilles = pastillesDesEntrees(regulatory!.children, badges);
    expect(pastilles.reduce((a, n) => a + n, 0), "le total est celui des notifications, pas un multiple").toBe(3);
    expect(pastilles[modules.indexOf("REGULATORY")]).toBe(2);
  });

  it("les onglets fusionnés d'une entrée comptent avec elle, une fois", () => {
    const e = { module: "SPONSORING", tabs: [{ module: "EVENTS" }, { module: "SPONSORING" }] } as unknown as NavItem;
    expect(modulesDeLEntree(e)).toEqual(["SPONSORING", "EVENTS"]);
    expect(pastillesDesEntrees([e], { SPONSORING: 1, EVENTS: 2 })).toEqual([3]);
  });
});

describe("les deux menus lisent la même règle (points d'appel, §118.49)", () => {
  const lire = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("la barre latérale et le tiroir mobile appellent `pastillesDesEntrees` et ne lisent plus un module seul", () => {
    for (const f of ["src/components/layout/sidebar.tsx", "src/components/layout/mobile-tabbar.tsx"]) {
      const src = lire(f);
      expect(src, f).toMatch(/pastillesDesEntrees\(/);
      // Lire `moduleBadges[x]` en direct, c'est recompter le module à chaque entrée qui le porte.
      expect(src, f).not.toMatch(/moduleBadges\[/);
    }
  });

  it("les sous-menus passent les modules de leur parent comme déjà comptés, dans les deux menus", () => {
    for (const f of ["src/components/layout/sidebar.tsx", "src/components/layout/mobile-tabbar.tsx"]) {
      expect(lire(f), f).toMatch(/pastillesDesEntrees\(kids, moduleBadges, modulesDeLEntree\(item\)\)/);
    }
  });
});
