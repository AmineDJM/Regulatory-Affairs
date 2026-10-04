import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children),
}));

import { InterimBanner } from "./interim-banner";

/**
 * L'INTÉRIMAIRE VOIT QU'IL AGIT AU NOM DE QUELQU'UN (§118.196, lot E4 — audit 360°, M13).
 *
 * La phrase existait (`delegationNotice`, son test parlait déjà d'un « bandeau ») et rien ne l'affichait
 * (§118.50) : un module prêté ne se distinguait pas d'un droit propre. On REND le vrai bandeau, puis on
 * vérifie que la coque le monte depuis l'accès calculé — vérifier le composant sans son appelant ne
 * prouverait rien (§118.49).
 */

describe("le bandeau d'intérim", () => {
  it("dit qui l'on remplace, jusqu'à quand, ce qui en vient, et mène à Mon espace", () => {
    const html = renderToStaticMarkup(React.createElement(InterimBanner, {
      interims: [{ absentId: "a1", absentNom: "Karim Saïdi", jusquau: new Date("2026-10-12T12:00:00Z"), modules: ["PCH", "VALIDATIONS"] }],
    }));
    expect(html).toContain("Intérim : vous remplacez Karim Saïdi jusqu&#x27;au 12 octobre (Marchés PCH, Demandes de validations)");
    expect(html).toContain("ce que vous tranchez pour cette personne est enregistré à votre nom");
    expect(html).toContain('href="/mon-espace"');
  });

  it("POINT D'APPEL — la coque rend le bandeau depuis l'accès calculé, et seulement pendant un intérim", () => {
    const coque = readFileSync("src/app/(app)/layout.tsx", "utf8");
    expect(coque).toContain('import { InterimBanner } from "@/components/layout/interim-banner";');
    expect(coque).toContain("{user.access.interims && user.access.interims.length > 0 && <InterimBanner interims={user.access.interims} />}");
  });

  it("POINTS D'APPEL — les gestes client : liste filtrée, congé terminé", () => {
    const panneau = readFileSync("src/components/hr/stand-in-panel.tsx", "utf8");
    // Ce qui a été choisi sous une liste plus large ne repart pas en silence — et se dit.
    expect(panneau).toContain("React.useState<string[]>(() => state.standInModules.filter((m) => proposes.has(m)))");
    expect(panneau).toContain("{plusProposes.length > 0 && (");
    const liste = readFileSync("src/components/hr/my-leaves.tsx", "utf8");
    expect(liste).toContain(`l.status !== "CANCELLED" && !l.termine && (`);
  });
});
