import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/assistant", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/assistant")>();
  return { ...mod, executeReadTool: vi.fn() };
});

import { executeReadTool } from "@/lib/assistant";
import { ExecutantReel, classerEchecLecture, __videEchecsDurables } from "@/platform/in-process/missions/runner";
import type { CurrentUser } from "@/lib/session";
import type { CapabilityCall } from "@/lib/missions/ports";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES ÉCHECS DURABLES D'UNE LECTURE — le défaut n° 1 du Deep Smoke 2026-08-29.
 *
 * Le stockage objet répondait 402 (paiement/quota épuisé) et le runner déclarait l'échec
 * « retryable » : le moteur retentait TROIS fois chaque lecture, chaque replan relisait le
 * même blob, et le raisonnement « réparait » une panne de FACTURATION. Ces bancs épinglent la
 * correction sous ses deux faces :
 *
 *   — un refus DURABLE (402/401/403/404 du stockage, vocabulaire de facturation) est classé,
 *     non-retryable, et son reçu DIT l'action humaine requise ;
 *   — un échec TRANSITOIRE (réseau) reste retryable et n'est JAMAIS court-circuité — le
 *     sabotage anti-classement-large : déclarer durable un transitoire coûterait une réponse
 *     fausse, ce qui est pire que trois tentatives.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const lectureMock = vi.mocked(executeReadTool);

const user = {
  id: "u-runner-test", name: "Testeur", email: "t@amd.dz", role: "SUPER_ADMIN",
  access: {}, mustChangePassword: false,
} as unknown as CurrentUser;

const appel = (input: Record<string, unknown> = { documentId: "doc-1" }): CapabilityCall => ({
  capability: "read_document",
  input,
  actor: { userId: user.id, label: user.name, isAgent: false },
  missionId: "m-1",
  stepKey: "lecture",
  idempotencyKey: null,
});

beforeEach(() => {
  __videEchecsDurables();
  lectureMock.mockReset();
});

describe("classerEchecLecture — le classement, étroit et sûr", () => {
  it("402 du stockage = refus de FACTURATION : durable, action humaine dite", () => {
    const c = classerEchecLecture("Lecture de l'objet échouée (402) sur /storage/v1/s3/amd/blobs/ab/cd.");
    expect(c?.kind).toBe("PROVIDER_FAILURE");
    expect(c?.action).toContain("FACTURATION");
  });

  it("le vocabulaire de facturation suffit, même sans le message exact du stockage", () => {
    expect(classerEchecLecture("provider refused: quota exceeded for project")?.kind).toBe("PROVIDER_FAILURE");
    expect(classerEchecLecture("Payment Required")?.kind).toBe("PROVIDER_FAILURE");
  });

  it("401/403 = identifiants refusés : durable ; 404 = l'objet n'existe pas : MISSING_DOCUMENT", () => {
    expect(classerEchecLecture("Lecture de l'objet échouée (403) sur /s3/x.")?.kind).toBe("PROVIDER_FAILURE");
    expect(classerEchecLecture("Lecture de l'objet échouée (404) sur /s3/x.")?.kind).toBe("MISSING_DOCUMENT");
  });

  it("un échec TRANSITOIRE n'est PAS classé durable — dans le doute, on retente", () => {
    expect(classerEchecLecture("fetch failed")).toBeNull();
    expect(classerEchecLecture("ECONNRESET")).toBeNull();
    expect(classerEchecLecture("Lecture de l'objet échouée (503) sur /s3/x.")).toBeNull();
  });
});

describe("l'exécutant face à un échec durable — fail-fast, court-circuit, et le sabotage inverse", () => {
  it("un 402 rend un échec NON-retryable dont le message dit l'action humaine", async () => {
    lectureMock.mockRejectedValue(new Error("Lecture de l'objet échouée (402) sur /storage/v1/s3/amd/blobs/ab/cd."));
    const out = await new ExecutantReel(user).run(appel());
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error?.kind).toBe("PROVIDER_FAILURE");
      expect(out.error?.retryable).toBe(false);
      expect(out.error?.message).toContain("FACTURATION");
    }
  });

  it("le MÊME appel après un refus durable est COURT-CIRCUITÉ : zéro aller-retour supplémentaire", async () => {
    lectureMock.mockRejectedValue(new Error("Lecture de l'objet échouée (402) sur /storage/v1/s3/amd/blobs/ab/cd."));
    const executant = new ExecutantReel(user);
    await executant.run(appel());
    const second = await executant.run(appel());

    expect(lectureMock).toHaveBeenCalledTimes(1);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error?.message).toContain("COURT-CIRCUIT");
      expect(second.error?.retryable).toBe(false);
    }
  });

  it("un appel sur une AUTRE cible n'est pas court-circuité : le constat vaut par cible, pas par capacité", async () => {
    lectureMock.mockRejectedValue(new Error("Lecture de l'objet échouée (402) sur /storage/v1/s3/amd/blobs/ab/cd."));
    const executant = new ExecutantReel(user);
    await executant.run(appel({ documentId: "doc-1" }));
    await executant.run(appel({ documentId: "doc-2" }));
    expect(lectureMock).toHaveBeenCalledTimes(2);
  });

  it("SABOTAGE anti-classement-large — un échec transitoire reste retryable et JAMAIS court-circuité", async () => {
    lectureMock.mockRejectedValue(new Error("fetch failed"));
    const executant = new ExecutantReel(user);
    const premier = await executant.run(appel());
    const second = await executant.run(appel());

    expect(lectureMock).toHaveBeenCalledTimes(2);
    expect(premier.ok).toBe(false);
    if (!premier.ok) expect(premier.error?.retryable).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error?.message).not.toContain("COURT-CIRCUIT");
  });
});

describe("la phrase de refus ENROBÉE porte désormais sa cause — et se classe durable", () => {
  // Le run MTEFBM32COEC : `executePowerTool` attrapait le 402 et rendait la phrase générique
  // « La lecture a échoué (donnée indisponible)… » — le moteur retentait 3 fois + recours,
  // contre une panne de facturation dont le motif avait été avalé en route.
  it("un RETOUR « La lecture a échoué … Cause technique : (402) » est classé PROVIDER_FAILURE non-retryable", async () => {
    lectureMock.mockResolvedValue(
      "La lecture a échoué (donnée indisponible). Je préfère ne rien avancer plutôt que d'inventer un chiffre."
      + " Cause technique : Lecture de l'objet échouée (402) sur /storage/v1/s3/amd/blobs/ab/cd.");
    const out = await new ExecutantReel(user).run(appel());
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error?.kind).toBe("PROVIDER_FAILURE");
      expect(out.error?.retryable).toBe(false);
    }
  });

  it("la même phrase SANS cause durable reste retryable — le classement ne devine pas", async () => {
    lectureMock.mockResolvedValue(
      "La lecture a échoué (donnée indisponible). Je préfère ne rien avancer plutôt que d'inventer un chiffre.");
    const out = await new ExecutantReel(user).run(appel());
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error?.kind).toBe("CAPABILITY_FAILURE");
      expect(out.error?.retryable).toBe(true);
    }
  });
});
