import { describe, it, expect } from "vitest";
import { DirectoryChannel, EndpointConfidence } from "@prisma/client";
import { rankEndpoints, decideAddress, askWhichAddress, domainLabel, normalizeName, type ResolvedEndpoint } from "./rank";
import { normalizeEndpointValue, isChannel, isConfidence } from "./normalize";

/**
 * QUELLE ADRESSE PART, ET QUAND ON DEMANDE.
 *
 * Les cas sont écrits depuis la question qui compte : « si je me trompe, où atterrit le message
 * du PDG ? » Une erreur de classement envoie un courrier professionnel sur une boîte
 * personnelle ; une question de trop coûte six mots. Les tests penchent donc du côté de la
 * question — mais pas au point de la poser quand la réponse est évidente.
 */

const mail = (value: string, over: Partial<ResolvedEndpoint> = {}): ResolvedEndpoint => ({
  channel: DirectoryChannel.EMAIL,
  value,
  label: null,
  confidence: EndpointConfidence.VERIFIED_INTERNAL,
  isPrimary: false,
  source: "test",
  ...over,
});

describe("classement — la provenance décide, pas l'ordre d'arrivée", () => {
  it("une adresse VÉRIFIÉE passe devant une adresse simplement aperçue", () => {
    const ranked = rankEndpoints([
      mail("vu@ailleurs.dz", { confidence: EndpointConfidence.OBSERVED_HISTORY }),
      mail("verifie@societe.dz", { confidence: EndpointConfidence.VERIFIED_INTERNAL }),
    ]);
    expect(ranked[0].value).toBe("verifie@societe.dz");
  });

  it("l'adresse marquée PRINCIPALE passe avant tout le reste", () => {
    const ranked = rankEndpoints([
      mail("autre@societe.dz", { confidence: EndpointConfidence.VERIFIED_INTERNAL }),
      mail("principale@societe.dz", { confidence: EndpointConfidence.OBSERVED_HISTORY, isPrimary: true }),
    ]);
    expect(ranked[0].value).toBe("principale@societe.dz");
  });

  it("la MÊME adresse vue par deux sources n'apparaît qu'une fois, à sa meilleure provenance", () => {
    const ranked = rankEndpoints([
      mail("a@societe.dz", { confidence: EndpointConfidence.OBSERVED_HISTORY, source: "historique" }),
      mail("a@societe.dz", { confidence: EndpointConfidence.VERIFIED_INTERNAL, source: "annuaire" }),
    ]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].confidence).toBe(EndpointConfidence.VERIFIED_INTERNAL);
  });

  it("le caractère PRINCIPAL survit à la fusion des doublons", () => {
    const ranked = rankEndpoints([
      mail("a@societe.dz", { isPrimary: true, confidence: EndpointConfidence.OBSERVED_HISTORY }),
      mail("a@societe.dz", { isPrimary: false, confidence: EndpointConfidence.VERIFIED_INTERNAL }),
    ]);
    expect(ranked[0].isPrimary).toBe(true);
    expect(ranked[0].confidence).toBe(EndpointConfidence.VERIFIED_INTERNAL);
  });
});

describe("décision — écrire, demander, ou dire qu'on n'a rien", () => {
  it("UNE seule adresse : on écrit, sans poser de question", () => {
    const d = decideAddress([mail("seule@societe.dz")]);
    expect(d.kind).toBe("send");
    if (d.kind === "send") expect(d.address.value).toBe("seule@societe.dz");
  });

  it("aucune adresse : on le dit, on n'invente pas", () => {
    expect(decideAddress([]).kind).toBe("none");
    expect(decideAddress([{ ...mail("x"), channel: DirectoryChannel.PHONE }]).kind).toBe("none");
  });

  it("DEUX adresses vérifiées à égalité : on demande — c'est le cas Pharmagene / Gmail", () => {
    const d = decideAddress([
      mail("amine.djouamai@pharmagenedz.com", { label: "Pharmagene" }),
      mail("amine.djouamaii@gmail.com", { label: "Gmail" }),
    ]);
    expect(d.kind).toBe("ask");
    if (d.kind === "ask") {
      expect(askWhichAddress("Amine", d.options)).toBe("Amine : Pharmagene ou Gmail ?");
    }
  });

  it("un INDICE du PDG tranche, et la question disparaît", () => {
    const options = [
      mail("amine.djouamai@pharmagenedz.com", { label: "Pharmagene" }),
      mail("amine.djouamaii@gmail.com", { label: "Gmail" }),
    ];
    const d = decideAddress(options, "Pharmagene");
    expect(d.kind).toBe("send");
    if (d.kind === "send") expect(d.address.value).toContain("pharmagenedz");

    const g = decideAddress(options, "sa Gmail");
    expect(g.kind).toBe("send");
    if (g.kind === "send") expect(g.address.value).toContain("gmail");
  });

  it("l'indice se trouve AUSSI dans le domaine, pas seulement dans l'étiquette", () => {
    const d = decideAddress(
      [mail("a@pharmagenedz.com"), mail("b@adventum.dz")],
      "pharmagenedz",
    );
    expect(d.kind).toBe("send");
    if (d.kind === "send") expect(d.address.value).toBe("a@pharmagenedz.com");
  });

  it("une adresse VÉRIFIÉE l'emporte sur une adresse observée — sans question", () => {
    const d = decideAddress([
      mail("pro@societe.dz", { confidence: EndpointConfidence.VERIFIED_INTERNAL }),
      mail("vieille@ailleurs.dz", { confidence: EndpointConfidence.OBSERVED_HISTORY }),
    ]);
    expect(d.kind).toBe("send");
    if (d.kind === "send") expect(d.address.value).toBe("pro@societe.dz");
  });

  it("une PRINCIPALE désignée évite la question même entre deux vérifiées", () => {
    const d = decideAddress([
      mail("pro@societe.dz", { label: "Pharmagene", isPrimary: true }),
      mail("perso@gmail.com", { label: "Gmail" }),
    ]);
    expect(d.kind).toBe("send");
    if (d.kind === "send") expect(d.address.value).toBe("pro@societe.dz");
  });
});

describe("normalisation — la même adresse doit se reconnaître", () => {
  it("la casse et les espaces ne font pas deux adresses", () => {
    expect(normalizeEndpointValue("EMAIL", "  Amine@Pharmagenedz.COM ")).toBe("amine@pharmagenedz.com");
  });

  it("une adresse invalide est refusée plutôt que rangée de travers", () => {
    expect(normalizeEndpointValue("EMAIL", "pas-une-adresse")).toBeNull();
    expect(normalizeEndpointValue("EMAIL", "")).toBeNull();
  });

  it("un numéro se range sans sa ponctuation, l'indicatif conservé", () => {
    expect(normalizeEndpointValue("PHONE", "+213 (0)555 12 34 56")).toBe("+213055512345 6".replace(" ", ""));
    expect(normalizeEndpointValue("WHATSAPP", "0555-12-34-56")).toBe("0555123456");
    expect(normalizeEndpointValue("PHONE", "12")).toBeNull();
  });

  it("les canaux et provenances inconnus sont rejetés", () => {
    expect(isChannel("EMAIL")).toBe(true);
    expect(isChannel("PIGEON")).toBe(false);
    expect(isConfidence("VERIFIED_INTERNAL")).toBe(true);
    expect(isConfidence("PEUT_ETRE")).toBe(false);
  });

  it("les accents ne cassent pas la recherche d'un nom", () => {
    expect(normalizeName("Raïhana Bénali")).toBe("raihana benali");
    expect(normalizeName("  DJOUAMAII, Amine  ")).toBe("djouamaii amine");
  });

  it("le domaine se rend lisible pour la question courte", () => {
    expect(domainLabel("x@pharmagenedz.com")).toBe("Pharmagenedz");
    expect(domainLabel("x@gmail.com")).toBe("Gmail");
  });
});
