import { describe, it, expect } from "vitest";
import type { UserRole } from "@prisma/client";
import { corpusAlertTargets } from "./watch-schedule";
import { canOpenCorpusPage } from "@/lib/org-chart-access";

const u = (id: string, role: string, secondaryRole?: string) => ({
  id,
  role: role as UserRole,
  secondaryRole: (secondaryRole ?? null) as UserRole | null,
});

const on = { regEnrollmentEnabled: true, regEnrollmentRoles: [] as string[] };
const off = { regEnrollmentEnabled: false, regEnrollmentRoles: [] as string[] };

describe("alerte de veille ANPP — le lien ne mène jamais à « Introuvable »", () => {
  it("module Analyse CTD non débloqué : personne n'est prévenu (la page répondrait Introuvable)", () => {
    expect(corpusAlertTargets([u("a", "SUPER_ADMIN")], off)).toEqual([]);
  });

  it("module débloqué : le Super Admin est prévenu", () => {
    expect(corpusAlertTargets([u("a", "SUPER_ADMIN")], on).map((x) => x.id)).toEqual(["a"]);
  });

  it("Super Admin seulement en rôle secondaire : non prévenu (la page exige le rôle principal)", () => {
    expect(corpusAlertTargets([u("b", "DIRECTION", "SUPER_ADMIN")], on)).toEqual([]);
  });

  it("chef réglementaire : ne gère pas le corpus, donc non prévenu", () => {
    expect(corpusAlertTargets([u("c", "HEAD_OF_REGULATORY")], on)).toEqual([]);
  });

  it("tout destinataire peut réellement ouvrir la page", () => {
    const users = [u("a", "SUPER_ADMIN"), u("b", "DIRECTION", "SUPER_ADMIN"), u("c", "HEAD_OF_REGULATORY")];
    for (const t of corpusAlertTargets(users, on)) expect(canOpenCorpusPage(t, on)).toBe(true);
  });
});
