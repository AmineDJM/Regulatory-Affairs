import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Un cliquet juge le CODE, pas la prose qui le décrit (§118.79d, §118.88, §118.112b). */
const sans = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * LA CASE « NOUS L'AVONS » D'UN LOT DIT « NON » PAR SON TÉMOIN (§118.172 — vague « restes »).
 *
 * `updateTenderLine` n'écrit plus ce que le formulaire ne porte pas : la case se lit par `fdCase` — « on »,
 * « off », ou rien, et rien ne change rien. L'écran, lui, n'envoyait la case que COCHÉE : décocher n'envoyait
 * rien, et « rien » ne décoche plus. Les deux moitiés se vérifient ensemble, à leur POINT D'APPEL (§118.49) :
 * l'action sans l'écran rendrait la case impossible à décocher, l'écran sans l'action ne servirait à rien.
 */
describe("la case « Nous l'avons » d'un lot d'appel d'offres", () => {
  it("l'action la lit par `fdCase`, et l'écran envoie « off » quand elle est décochée", () => {
    expect(sans("src/lib/actions/pch-tender-line-actions.ts")).toMatch(/haveProduct: fdCase\(formData, "haveProduct"\)/);
    const ecran = sans("src/app/(app)/pch/[id]/tender-lines.tsx");
    expect(ecran, "l'écran doit envoyer le témoin : fd.set(\"haveProduct\", s.haveProduct ? \"on\" : \"off\")")
      .toMatch(/fd\.set\(\s*"haveProduct"\s*,\s*s\.haveProduct\s*\?\s*"on"\s*:\s*"off"\s*\)/);
    expect(ecran).not.toMatch(/if\s*\(\s*s\.haveProduct\s*\)\s*fd\.set\(\s*"haveProduct"/);
  });
});
