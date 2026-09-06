import { describe, expect, it } from "vitest";
import { TOOL_DOMAINS } from "@/lib/assistant/context/tool-shortlist";
import { RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { SPECIALISTES, outilsAutorises, specialiste, specialistesActifs } from "./registry";
import { SPECIALIST_TOOLS } from "./tools";

describe("le registre des spécialistes — des outils qui existent, jamais une écriture, un bénéfice dit", () => {
  it("chaque outil d'un spécialiste existe au registre et n'est pas une écriture", () => {
    for (const s of SPECIALISTES) {
      for (const o of s.outils) {
        expect(o in TOOL_DOMAINS, `${s.id} → ${o}`).toBe(true);
        expect(RESOLVER_WRITE_NAMES.has(o), `${s.id} → ${o} est une écriture`).toBe(false);
      }
    }
  });
  it("les identifiants sont uniques, les actifs disent leur mesure, les inactifs disent pourquoi", () => {
    expect(new Set(SPECIALISTES.map((s) => s.id)).size).toBe(SPECIALISTES.length);
    for (const s of SPECIALISTES) expect(s.benefice.length, s.id).toBeGreaterThan(10);
    for (const s of specialistesActifs()) expect(s.benefice, s.id).toMatch(/mesur/);
    for (const s of SPECIALISTES.filter((x) => !x.actif)) expect(s.benefice, s.id).toMatch(/non mesuré|inactif/);
    // La mesure du 2026-09-06 est négative : aucun actif, et l'outil ne s'expose pas sans actif.
    expect(specialistesActifs()).toEqual([]);
    expect(specialiste("inconnu")).toBeNull();
    const outil = SPECIALIST_TOOLS.find((t) => t.def.name === "consult_specialists")!;
    expect(outil.allowed({ access: { modules: new Map([["LEGAL", {}]]) } } as never)).toBe(false);
  });
  it("les outils autorisés sont l'intersection avec ceux de la personne, écritures exclues", () => {
    const legal = specialiste("legal")!;
    expect(outilsAutorises(legal, ["legal_intelligence", "read_document", "update_legal_document", "decide_payment"], new Set(["update_legal_document", "decide_payment"]))).toEqual(["legal_intelligence", "read_document"]);
    expect(outilsAutorises(legal, [], new Set())).toEqual([]);
  });
});
