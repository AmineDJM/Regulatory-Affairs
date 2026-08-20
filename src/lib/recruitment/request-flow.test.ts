import { describe, it, expect } from "vitest";
import {
  RECRUITMENT_CONTRACTS, CONTRACT_LABEL, isRecruitmentContract,
  contractNeedsEndDate, needsOnboarding,
  STAGE_LABEL, STAGE_TONE, isFinal,
  currentStep, canDecideStep, applyChainDecision, chainProgress,
  CANDIDATE_LABEL, candidateRank, canSelectCandidate,
  abilities, validateDraft, summarize, salaryRange,
  type ChainStep, type RecruitmentStage, type RecruitmentActor, type RequestDraft,
} from "./request-flow";

const step = (order: number, approverId: string, status: ChainStep["status"] = "PENDING"): ChainStep =>
  ({ order, approverId, approverName: approverId.toUpperCase(), status });

const actor = (over: Partial<RecruitmentActor> = {}): RecruitmentActor =>
  ({ userId: "me", isRequester: false, isHr: false, isTop: false, ...over });

describe("type de contrat — ce que le contrat implique, et qu'on ne redemande pas", () => {
  it("les quatre contrats demandables portent tous un libellé", () => {
    for (const c of RECRUITMENT_CONTRACTS) expect(CONTRACT_LABEL[c]).toBeTruthy();
    expect(isRecruitmentContract("CDI")).toBe(true);
    expect(isRecruitmentContract("INTERIM")).toBe(false);
  });

  // Un CDD, un stage ou une mission sans terme n'existent pas ; un CDI ne doit surtout pas en
  // porter — une date de fin sur un CDI serait relue un jour comme une échéance.
  it("seul le CDI n'a pas de date de fin", () => {
    expect(contractNeedsEndDate("CDI")).toBe(false);
    expect(contractNeedsEndDate("CDD")).toBe(true);
    expect(contractNeedsEndDate("STAGE")).toBe(true);
    expect(contractNeedsEndDate("CONSULTING")).toBe(true);
  });

  // LA règle que la demande a explicitement posée : un consultant reste externe.
  it("un consulting n'entre PAS dans l'effectif — pas de fiche employé, pas de compte", () => {
    expect(needsOnboarding("CONSULTING")).toBe(false);
    expect(needsOnboarding("CDI")).toBe(true);
    expect(needsOnboarding("CDD")).toBe(true);
    expect(needsOnboarding("STAGE")).toBe(true);
  });
});

describe("étapes — une demande close ne bouge plus", () => {
  it("chaque étape porte un libellé et un ton", () => {
    for (const s of Object.keys(STAGE_LABEL) as RecruitmentStage[]) {
      expect(STAGE_LABEL[s]).toBeTruthy();
      expect(STAGE_TONE[s]).toBeTruthy();
    }
  });

  it("clôturée, refusée et annulée sont finales — les autres non", () => {
    expect(isFinal("CLOSED")).toBe(true);
    expect(isFinal("REJECTED")).toBe(true);
    expect(isFinal("CANCELLED")).toBe(true);
    expect(isFinal("CHAIN")).toBe(false);
    expect(isFinal("SOURCING")).toBe(false);
  });
});

describe("chaîne hiérarchique — du N+1 jusqu'au PDG", () => {
  const chain = [step(1, "n1"), step(2, "n2"), step(3, "pdg")];

  it("la marche active est la PREMIÈRE encore en attente", () => {
    expect(currentStep(chain)?.approverId).toBe("n1");
    expect(currentStep([{ ...chain[0], status: "APPROVED" }, chain[1], chain[2]])?.approverId).toBe("n2");
    expect(currentStep(chain.map((s) => ({ ...s, status: "APPROVED" as const })))).toBeNull();
  });

  it("la marche active se lit dans la LISTE, pas dans un compteur", () => {
    // Un compteur et une liste finissent toujours par diverger, et la demande devient alors
    // invalidable par qui que ce soit. L'ordre d'entrée ne change rien au résultat.
    const shuffled = [chain[2], chain[0], chain[1]];
    expect(currentStep(shuffled)?.approverId).toBe("n1");
  });

  it("seul le titulaire de la marche tranche — et le PDG à n'importe laquelle", () => {
    expect(canDecideStep("CHAIN", chain, actor({ userId: "n1" })).ok).toBe(true);
    expect(canDecideStep("CHAIN", chain, actor({ userId: "n2" })).ok).toBe(false);
    expect(canDecideStep("CHAIN", chain, actor({ userId: "boss", isTop: true })).ok).toBe(true);
  });

  it("le refus DIT pourquoi — sinon personne ne sait quoi faire ensuite", () => {
    expect(canDecideStep("CHAIN", chain, actor({ userId: "n2" })).reason).toContain("N1");
    expect(canDecideStep("HR_REVIEW", chain, actor({ userId: "n1" })).reason).toContain("terminée");
  });

  it("approuver fait monter d'une marche ; la dernière envoie aux RH", () => {
    const a = applyChainDecision(chain, 1, "APPROVED");
    expect(a.outcome).toEqual({ stage: "CHAIN", complete: false });
    const b = applyChainDecision(a.steps, 2, "APPROVED");
    const c = applyChainDecision(b.steps, 3, "APPROVED");
    expect(c.outcome).toEqual({ stage: "HR_REVIEW", complete: true });
    expect(c.steps.every((s) => s.status === "APPROVED")).toBe(true);
  });

  it("un seul refus arrête tout, à n'importe quelle marche", () => {
    expect(applyChainDecision(chain, 1, "REJECTED").outcome.stage).toBe("REJECTED");
    const mid = applyChainDecision(chain, 1, "APPROVED").steps;
    expect(applyChainDecision(mid, 2, "REJECTED").outcome.stage).toBe("REJECTED");
  });

  // Écrire qu'un N+1 a validé alors qu'il n'a rien vu serait un faux.
  it("quand le PDG tranche d'en haut, les marches sautées sont marquées SAUTÉES, pas approuvées", () => {
    const r = applyChainDecision(chain, 3, "APPROVED");
    expect(r.steps.map((s) => s.status)).toEqual(["SKIPPED", "SKIPPED", "APPROVED"]);
    expect(r.outcome.stage).toBe("HR_REVIEW");
  });

  it("l'avancement se lit en clair", () => {
    expect(chainProgress(chain)).toEqual({ done: 0, total: 3, waitingOn: "N1" });
    const after = applyChainDecision(chain, 1, "APPROVED").steps;
    expect(chainProgress(after)).toEqual({ done: 1, total: 3, waitingOn: "N2" });
  });
});

describe("candidats — le pipeline vit sur les personnes, pas sur la demande", () => {
  it("chaque statut a un libellé et un rang d'avancement", () => {
    for (const s of Object.keys(CANDIDATE_LABEL) as (keyof typeof CANDIDATE_LABEL)[]) {
      expect(CANDIDATE_LABEL[s]).toBeTruthy();
      expect(candidateRank(s)).toBeGreaterThanOrEqual(0);
    }
    expect(candidateRank("HIRED")).toBeGreaterThan(candidateRank("SHORTLISTED"));
  });

  // « Le PDG sélectionne parmi les présélectionnés OU les autres » : la présélection est un avis,
  // pas un tri éliminatoire opposable au dernier décideur.
  it("le PDG retient un candidat présélectionné COMME un candidat qui ne l'est pas", () => {
    expect(canSelectCandidate("SHORTLISTED")).toBe(true);
    expect(canSelectCandidate("RECEIVED")).toBe(true);
  });

  it("on ne « retient » pas quelqu'un déjà écarté ou déjà recruté", () => {
    expect(canSelectCandidate("DECLINED")).toBe(false);
    expect(canSelectCandidate("HIRED")).toBe(false);
  });
});

describe("abilities — l'écran et le serveur posent la MÊME question", () => {
  it("chez les RH : ils demandent des précisions, ouvrent le poste ou refusent", () => {
    const a = abilities("HR_REVIEW", actor({ isHr: true }));
    expect(a.askInfo).toBe(true);
    expect(a.openSourcing).toBe(true);
    expect(a.hrReject).toBe(true);
    expect(a.addCandidate).toBe(false); // le poste n'est pas encore ouvert
  });

  it("précisions demandées : seul le demandeur répond", () => {
    expect(abilities("INFO_REQUESTED", actor({ isRequester: true })).answerInfo).toBe(true);
    expect(abilities("INFO_REQUESTED", actor({ isHr: true })).answerInfo).toBe(false);
  });

  it("poste ouvert : les RH déposent les CV, le demandeur présélectionne, le PDG tranche", () => {
    expect(abilities("SOURCING", actor({ isHr: true })).addCandidate).toBe(true);
    expect(abilities("SOURCING", actor({ isRequester: true })).shortlist).toBe(true);
    expect(abilities("SOURCING", actor({ isHr: true })).shortlist).toBe(false);
    expect(abilities("SOURCING", actor({ isTop: true })).select).toBe(true);
    expect(abilities("SOURCING", actor({ isRequester: true })).select).toBe(false);
  });

  it("l'intégration appartient aux RH, et seulement quand quelqu'un est recruté", () => {
    expect(abilities("ONBOARDING", actor({ isHr: true }), { hasHire: true }).onboard).toBe(true);
    expect(abilities("ONBOARDING", actor({ isHr: true }), { hasHire: false }).onboard).toBe(false);
    expect(abilities("ONBOARDING", actor({ isRequester: true }), { hasHire: true }).onboard).toBe(false);
  });

  it("on retire sa demande tant que PERSONNE n'a tranché", () => {
    expect(abilities("CHAIN", actor({ isRequester: true }), { chainUntouched: true }).cancel).toBe(true);
    // Après une première décision, la retirer effacerait un avis déjà donné.
    expect(abilities("CHAIN", actor({ isRequester: true }), { chainUntouched: false }).cancel).toBe(false);
    expect(abilities("SOURCING", actor({ isRequester: true }), { chainUntouched: true }).cancel).toBe(false);
  });

  it("une demande close ne permet plus RIEN, pas même au PDG", () => {
    for (const s of ["CLOSED", "REJECTED", "CANCELLED"] as RecruitmentStage[]) {
      const a = abilities(s, actor({ isTop: true, isHr: true, isRequester: true }), { hasHire: true, chainUntouched: true });
      expect(Object.values(a).some(Boolean), s).toBe(false);
    }
  });
});

describe("validateDraft — on ne bloque que ce qui rend la demande ininstruisible", () => {
  const draft = (over: Partial<RequestDraft> = {}): RequestDraft => ({
    position: "Chargé d'affaires réglementaires",
    headcount: 1,
    contractType: "CDI",
    salaryMin: 80_000,
    salaryMax: 110_000,
    startDate: "2026-10-01",
    endDate: null,
    ...over,
  });

  it("une demande complète passe", () => {
    expect(validateDraft(draft())).toBeNull();
  });

  it("l'intitulé, l'effectif et le contrat sont indispensables", () => {
    expect(validateDraft(draft({ position: "  " }))).toContain("intitulé");
    expect(validateDraft(draft({ headcount: 0 }))).toContain("au moins 1");
    expect(validateDraft(draft({ contractType: "AUTRE" }))).toContain("type de contrat");
  });

  it("une fourchette inversée est refusée, et le dit", () => {
    expect(validateDraft(draft({ salaryMin: 200_000, salaryMax: 100_000 }))).toContain("inversée");
  });

  it("une seule borne suffit — beaucoup de postes se posent « à partir de »", () => {
    expect(validateDraft(draft({ salaryMin: 90_000, salaryMax: null }))).toBeNull();
    expect(validateDraft(draft({ salaryMin: null, salaryMax: null }))).toBeNull();
  });

  it("un CDD sans terme est refusé ; un CDI avec terme aussi", () => {
    expect(validateDraft(draft({ contractType: "CDD", endDate: null }))).toContain("date de fin est obligatoire");
    expect(validateDraft(draft({ contractType: "CDI", endDate: "2027-01-01" }))).toContain("pas de date de fin");
  });

  it("la fin ne précède pas le début", () => {
    expect(validateDraft(draft({ contractType: "CDD", startDate: "2026-10-01", endDate: "2026-09-01" })))
      .toContain("précède");
  });

  // Les RH ont le droit de demander des précisions : refuser d'enregistrer un besoin réel parce
  // qu'une case est vide, c'est le renvoyer vers un e-mail où plus personne ne le suivra.
  it("missions, compétences et fiche de poste ne bloquent PAS", () => {
    expect(validateDraft(draft({ startDate: null }))).toBeNull();
  });
});

describe("affichage — la ligne qu'on lit dans une liste", () => {
  /**
   * Le formateur français sépare les milliers par une espace fine insécable (U+202F), pas par
   * une espace ordinaire. On la normalise ici : ces tests portent sur la RÈGLE d'écriture, pas
   * sur le codet que le navigateur choisit — l'y figer ferait échouer la suite au prochain
   * changement d'ICU sans qu'aucun comportement n'ait bougé.
   */
  const norm = (s: string | null) => (s ?? "").replace(/\s/g, " ");

  it("résume contrat, effectif et fourchette", () => {
    expect(norm(summarize({ contractType: "CDI", headcount: 2, salaryMin: 80_000, salaryMax: 110_000 })))
      .toBe("CDI · 2 postes · 80 000 DZD – 110 000 DZD");
  });

  it("sans rémunération renseignée, on n'invente pas un montant", () => {
    expect(salaryRange(null, null)).toBeNull();
    expect(summarize({ contractType: "STAGE", headcount: 1, salaryMin: null, salaryMax: null }))
      .toBe("Stage · 1 poste");
  });

  it("une borne unique s'écrit « à partir de » / « jusqu'à », jamais « 0 – X »", () => {
    expect(norm(salaryRange(90_000, null))).toBe("à partir de 90 000 DZD");
    expect(norm(salaryRange(null, 90_000))).toBe("jusqu'à 90 000 DZD");
    expect(norm(salaryRange(90_000, 90_000))).toBe("90 000 DZD");
  });
});
