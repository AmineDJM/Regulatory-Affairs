import { describe, expect, it } from "vitest";
import { calibrerTour } from "./tour";
import type { FaitSource } from "@/platform/in-process/fabric/provenance";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'AVERTISSEMENT SUR LA CARTE — parce que la trace, personne ne la lit avant de cliquer.
 *
 * La calibration entrait déjà dans la TRACE d'un tour. Mais la trace se déplie ; la carte
 * d'action, elle, est ce que la personne voit et confirme. Un état qui rend l'action fautive
 * doit donc atteindre la CARTE : c'est là que le geste se fait.
 *
 * `calibrerTour` est le point d'entrée réel — celui qu'appelle le tour d'Adam. Un test qui
 * appellerait `calibrer` seul dirait que le calcul est juste sans dire qu'il arrive quelque
 * part (§118.14, §118.49).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const MAINTENANT = new Date();
const ilYA = (jours: number) => new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString();

const fait = (p: Partial<FaitSource> & { libelle: string }): FaitSource => ({
  id: p.id ?? p.libelle, valeur: p.valeur ?? "x", nature: "ERP", famille: null,
  outil: "inspect_record", locator: null, href: null, horodatage: null, observeLe: MAINTENANT.toISOString(),
  confiance: 0.95, base: "metadata", fraicheur: "TEMPS_REEL", autorite: null, preuveNegative: null,
  acteur: "u", calcul: null, ...p,
} as FaitSource);

const resultat = () => ({ trace: [] as string[], proposal: { warnings: [] as string[], fields: [] } });

describe("la calibration atteint la CARTE, pas seulement la trace", () => {
  it("une copie indexée de six mois AVERTIT la proposition avant la confirmation", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : n'avertir que sur MANQUANT et CONTRADICTION. Adam
     * proposerait « résilier ce contrat » sur une clause lue dans une copie de mars, et la
     * carte serait muette — le geste se ferait sans que rien ne dise de relire.
     */
    const vieux = fait({
      libelle: "Clause de résiliation", valeur: "6 mois", nature: "DOCUMENT",
      outil: "search_drive", fraicheur: "INDEXEE", horodatage: ilYA(180),
    });
    const { resultat: r, calibration } = calibrerTour("quelle est la clause de résiliation ?", [vieux], resultat());
    expect(calibration.certitude).toBe("PERIME");
    expect(r.proposal.warnings.join(" "), "la carte ne dit rien de la copie datée").toContain("périmé");
    expect(r.proposal.warnings.join(" ")).toContain("à lever avant de confirmer");
    expect(r.trace.join(" ")).toContain("relire la source");
  });

  it("un tour PROBABLE n'avertit pas — une réserve permanente devient du bruit", () => {
    const doc = fait({ libelle: "Objet", valeur: "conseil", nature: "DOCUMENT", base: "native", confiance: 0.7 });
    const { resultat: r, calibration } = calibrerTour("quel est l'objet ?", [doc], resultat());
    expect(calibration.certitude).toBe("PROBABLE");
    expect(r.proposal.warnings).toEqual([]);
  });

  it("un tour sans lecture ni ancre n'est pas « manquant » — rien n'était exigé", () => {
    const { calibration } = calibrerTour("merci", [], resultat());
    expect(calibration.certitude).not.toBe("PERIME");
    expect(calibration.faits).toBe(0);
  });
});
