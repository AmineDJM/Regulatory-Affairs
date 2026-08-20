import { describe, it, expect } from "vitest";
import {
  canViewPipeline, canManagePipeline, pipelineAccessFor, describePipelineAudience,
  type PipelineAccessSettings,
} from "./pipeline-access";

const NOBODY: PipelineAccessSettings = {
  pipelineViewerRoles: [],
  pipelineViewerUserIds: [],
  pipelineManagerRoles: [],
  pipelineManagerUserIds: [],
};

const settings = (over: Partial<PipelineAccessSettings> = {}): PipelineAccessSettings => ({ ...NOBODY, ...over });

const boss = { id: "boss", role: "SUPER_ADMIN" };
const head = { id: "u-head", role: "HEAD_OF_REGULATORY" };
const asst = { id: "u-asst", role: "REGULATORY_ASSISTANT" };

describe("le réglage par défaut ne montre rien à personne", () => {
  it("seul le Super Admin voit les dossiers verrouillés", () => {
    expect(canViewPipeline(boss, NOBODY)).toBe(true);
    expect(canViewPipeline(head, NOBODY)).toBe(false);
    expect(canViewPipeline(asst, NOBODY)).toBe(false);
  });

  it("seul le Super Admin tient le cadenas", () => {
    expect(canManagePipeline(boss, NOBODY)).toBe(true);
    expect(canManagePipeline(head, NOBODY)).toBe(false);
  });
});

describe("consultation ouverte par rôle ou nommément", () => {
  it("ouvre à un rôle", () => {
    expect(canViewPipeline(head, settings({ pipelineViewerRoles: ["HEAD_OF_REGULATORY"] }))).toBe(true);
    expect(canViewPipeline(asst, settings({ pipelineViewerRoles: ["HEAD_OF_REGULATORY"] }))).toBe(false);
  });

  it("ouvre à une personne nommée, quel que soit son rôle", () => {
    expect(canViewPipeline(asst, settings({ pipelineViewerUserIds: ["u-asst"] }))).toBe(true);
  });

  it("compte l'« autre rôle » : un cumul de fonctions ouvre ce que la fonction ouvre", () => {
    const cumul = { id: "u-x", role: "VIEWER", secondaryRole: "HEAD_OF_REGULATORY" };
    expect(canViewPipeline(cumul, settings({ pipelineViewerRoles: ["HEAD_OF_REGULATORY"] }))).toBe(true);
  });

  it("un « autre rôle » absent ne fait pas planter la comparaison", () => {
    const sansSecond = { id: "u-y", role: "VIEWER", secondaryRole: null };
    expect(canViewPipeline(sansSecond, settings({ pipelineViewerRoles: ["HEAD_OF_REGULATORY"] }))).toBe(false);
  });

  it("consulter n'est pas tenir le cadenas", () => {
    const s = settings({ pipelineViewerRoles: ["HEAD_OF_REGULATORY"] });
    expect(canViewPipeline(head, s)).toBe(true);
    expect(canManagePipeline(head, s)).toBe(false);
  });
});

describe("le cadenas implique la consultation", () => {
  it("qui peut ouvrir un dossier le voit — sinon il ouvrirait à l'aveugle", () => {
    const s = settings({ pipelineManagerRoles: ["HEAD_OF_REGULATORY"] });
    expect(canManagePipeline(head, s)).toBe(true);
    expect(canViewPipeline(head, s)).toBe(true);
  });

  it("vaut aussi pour une personne nommée au cadenas", () => {
    const s = settings({ pipelineManagerUserIds: ["u-asst"] });
    expect(canViewPipeline(asst, s)).toBe(true);
  });
});

describe("pipelineAccessFor — les deux droits d'un coup", () => {
  it("rend les deux vrais pour le Super Admin", () => {
    expect(pipelineAccessFor(boss, NOBODY)).toEqual({ view: true, manage: true });
  });

  it("rend une consultation sans cadenas", () => {
    expect(pipelineAccessFor(head, settings({ pipelineViewerRoles: ["HEAD_OF_REGULATORY"] })))
      .toEqual({ view: true, manage: false });
  });

  it("rend les deux faux quand rien n'est ouvert", () => {
    expect(pipelineAccessFor(head, NOBODY)).toEqual({ view: false, manage: false });
  });
});

describe("describePipelineAudience — ce que l'administrateur relit avant d'enregistrer", () => {
  it("dit l'absence d'ouverture", () => {
    expect(describePipelineAudience(NOBODY)).toContain("Personne d'autre que le Super Admin");
  });

  it("compte les accès de consultation", () => {
    const s = settings({ pipelineViewerRoles: ["HEAD_OF_REGULATORY", "DIRECTION"], pipelineViewerUserIds: ["u-asst"] });
    expect(describePipelineAudience(s)).toContain("3 accès en consultation");
  });

  it("compte les accès au cadenas séparément", () => {
    const s = settings({ pipelineManagerRoles: ["DIRECTION"] });
    const text = describePipelineAudience(s);
    expect(text).toContain("1 accès au cadenas");
    expect(text).not.toContain("consultation");
  });

  it("rappelle toujours que le Super Admin est inclus dès qu'un accès est ouvert", () => {
    expect(describePipelineAudience(settings({ pipelineViewerRoles: ["DIRECTION"] })))
      .toContain("en plus du Super Admin");
  });
});
