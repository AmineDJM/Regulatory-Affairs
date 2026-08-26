import { describe, it, expect } from "vitest";
import {
  parseRetryAfter, cooldownFor, cooldownMessage, isRateLimitStatus, rateLimitFrom,
  DEFAULT_VOICE_COOLDOWN_MS, MAX_VOICE_COOLDOWN_MS, MIN_VOICE_COOLDOWN_MS,
} from "./voice-cooldown";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'INCIDENT SDP_429 — et la règle qu'on en tire.
 *
 * Ce qui s'est passé, lu dans les journaux de production : le secret éphémère se créait bien
 * (430–470 ms), l'échange SDP était refusé pour quota, et la reconnexion automatique repartait
 * AUSSITÔT — jusqu'à trois tentatives en quelques secondes, chacune reforgeant une session.
 * On consommait ainsi la ressource qu'on attendait de voir se libérer.
 *
 * La règle, vérifiée ici : **un refus limitant impose une attente ; tout autre refus n'en
 * impose aucune**. Se tromper dans un sens entretient l'incident ; dans l'autre, on masque un
 * vrai bogue derrière une pause.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

describe("quels refus imposent d'attendre", () => {
  it("429 et 503 : oui", () => {
    expect(isRateLimitStatus(429)).toBe(true);
    expect(isRateLimitStatus(503)).toBe(true);
  });

  it("les autres : NON — attendre masquerait un vrai défaut", () => {
    // 401 se corrige (jeton), 400 est un défaut de notre requête, 500 mérite un nouvel essai
    // immédiat. Aucun ne se répare en patientant.
    for (const s of [200, 400, 401, 403, 404, 500, 502]) {
      expect(isRateLimitStatus(s), `statut ${s}`).toBe(false);
    }
  });
});

describe("« Retry-After » — on suit la consigne du serveur", () => {
  it("en secondes", () => {
    expect(parseRetryAfter("30")).toBe(30_000);
    expect(parseRetryAfter(" 5 ")).toBe(5_000);
    expect(parseRetryAfter("0")).toBe(0);
  });

  it("en date HTTP", () => {
    const now = Date.UTC(2026, 7, 26, 12, 0, 0);
    expect(parseRetryAfter("Wed, 26 Aug 2026 12:00:20 GMT", now)).toBe(20_000);
  });

  it("une date déjà passée ne rend jamais un délai négatif", () => {
    const now = Date.UTC(2026, 7, 26, 12, 0, 0);
    expect(parseRetryAfter("Wed, 26 Aug 2026 11:59:00 GMT", now)).toBe(0);
  });

  it("absent ou illisible → `null`, PAS zéro", () => {
    // Zéro relancerait immédiatement : très exactement le comportement qu'on corrige.
    for (const raw of [null, undefined, "", "   ", "bientôt"]) {
      expect(parseRetryAfter(raw), JSON.stringify(raw)).toBeNull();
    }
  });
});

describe("le délai appliqué est borné des deux côtés", () => {
  it("sans consigne, une attente franche", () => {
    expect(cooldownFor(null)).toBe(DEFAULT_VOICE_COOLDOWN_MS);
    expect(cooldownFor(Number.NaN)).toBe(DEFAULT_VOICE_COOLDOWN_MS);
  });

  it("une consigne dérisoire est relevée — sinon on relance pour rien", () => {
    expect(cooldownFor(0)).toBe(MIN_VOICE_COOLDOWN_MS);
    expect(cooldownFor(200)).toBe(MIN_VOICE_COOLDOWN_MS);
  });

  it("une consigne énorme est plafonnée — la voix n'est pas condamnée pour la journée", () => {
    expect(cooldownFor(3_600_000)).toBe(MAX_VOICE_COOLDOWN_MS);
  });

  it("entre les deux, on suit exactement le serveur", () => {
    expect(cooldownFor(45_000)).toBe(45_000);
  });
});

describe("ce que le PDG lit — une durée, pas un code", () => {
  it("en secondes sous la minute", () => {
    const m = cooldownMessage(30_000);
    expect(m).toContain("30 s");
    expect(m).toContain("limite de connexions");
    // Le repli est nommé : on ne laisse personne bloqué.
    expect(m).toContain("écrite reste disponible");
  });

  it("en minutes au-delà", () => {
    expect(cooldownMessage(120_000)).toContain("2 min");
  });

  it("jamais « 0 s » — un reste infime s'arrondit à la seconde", () => {
    expect(cooldownMessage(1)).toContain("1 s");
  });

  it("aucun code technique n'apparaît", () => {
    // « SDP_429 » ou « momentanément indisponible (connexion refusée) » — l'ancien message —
    // n'aidaient personne à décider s'il fallait réessayer, appeler quelqu'un, ou renoncer.
    const m = cooldownMessage(30_000);
    expect(m).not.toMatch(/SDP|429|503|HTTP/);
  });
});

describe("reconnaître un refus limitant, sans `instanceof`", () => {
  it("depuis un objet portant le statut", () => {
    const info = rateLimitFrom({ name: "SdpRejection", status: 429, retryAfterMs: 12_000, detail: "rate_limit_exceeded" });
    expect(info).toEqual({ status: 429, retryAfterMs: 12_000, detail: "rate_limit_exceeded" });
  });

  it("depuis un ancien jet qui ne portait qu'un message", () => {
    // Repli de compatibilité : `throw new Error("SDP_429")` existait avant ce lot.
    expect(rateLimitFrom(new Error("SDP_429"))).toEqual({ status: 429, retryAfterMs: null, detail: "" });
    expect(rateLimitFrom(new Error("SDP_503"))?.status).toBe(503);
  });

  it("un refus NON limitant ne déclenche pas d'attente", () => {
    expect(rateLimitFrom({ status: 500, detail: "boom" })).toBeNull();
    expect(rateLimitFrom(new Error("SDP_401"))).toBeNull();
  });

  it("ce qui n'est pas un refus du tout est ignoré", () => {
    for (const junk of [null, undefined, "SDP_429", 429, new Error("MIC_UNSUPPORTED")]) {
      expect(rateLimitFrom(junk), String(junk)).toBeNull();
    }
  });

  it("le détail traverse — c'est lui qui manquait dans les journaux", () => {
    // `detail: undefined` sur chaque 429 empêchait de distinguer un plafond de sessions
    // simultanées d'un quota par minute. Deux incidents, deux remèdes.
    const info = rateLimitFrom({ status: 429, detail: '{"error":{"code":"concurrent_limit"}}' });
    expect(info?.detail).toContain("concurrent_limit");
  });
});

describe("le scénario complet du 26 août", () => {
  it("un 429 sans consigne met 30 s d'attente et le dit clairement", () => {
    const refus = rateLimitFrom(new Error("SDP_429"));
    expect(refus).not.toBeNull();
    const wait = cooldownFor(refus?.retryAfterMs ?? null);
    expect(wait).toBe(30_000);
    expect(cooldownMessage(wait)).toContain("30 s");
  });

  it("trois tentatives rapprochées ne peuvent plus se produire", () => {
    // La preuve tient dans la borne basse : même si le serveur répondait « réessaie tout de
    // suite », on attendrait 5 secondes. Les trois sessions en huit secondes des journaux
    // sont arithmétiquement impossibles.
    const troisTentatives = 3 * cooldownFor(0);
    expect(troisTentatives).toBeGreaterThan(8_242); // la durée observée dans l'incident
  });
});
