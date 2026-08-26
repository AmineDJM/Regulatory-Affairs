import { describe, it, expect, beforeEach } from "vitest";
import {
  decideRollout, bucketOf, resetGuard, recordOutcome, guardStatus, guardTripped,
  readyForNextStep, configuredCanaryPercent, routerDisabled,
  SAFE_READ_TOOLS, DEFAULT_CANARY_PERCENT, MIN_SAMPLES_BEFORE_TRIP,
} from "./rollout";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA FRONTIÈRE DE L'AUTORISATION, VÉRIFIÉE.
 *
 * L'autorisation de §26 est bornée : lectures sûres actives, 20 % de canary sur le reste des
 * lectures, MUTATIONS INCHANGÉES. Ces bornes ne valent que si elles sont exécutables — un
 * commentaire ne protège rien. Ce fichier les rend cassantes.
 *
 * Ce qu'il ne mesure PAS : la qualité du routage (c'est le rôle des corpus) ni la garde en
 * production (elle est par instance, cf. la limite écrite dans `rollout.ts`).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const USER = "user-ceo-1";
/** Un canary à 0 % isole ce qu'on teste : plus rien ne passe par hasard. */
const noCanary = { userId: USER, canaryPercent: 0 };

beforeEach(() => resetGuard());

describe("le seau est déterministe — un incident doit se rejouer", () => {
  it("le même énoncé du même compte tombe toujours dans le même seau", () => {
    const a = bucketOf(USER, "Où en est Raltegravir ?");
    const b = bucketOf(USER, "Où en est Raltegravir ?");
    expect(a).toBe(b);
  });

  it("la casse et les espaces de bord ne changent pas le seau", () => {
    expect(bucketOf(USER, "  Où en est RALTEGRAVIR ? ")).toBe(bucketOf(USER, "où en est raltegravir ?"));
  });

  it("reste dans 0–99, sur un échantillon large", () => {
    for (let i = 0; i < 500; i += 1) {
      const b = bucketOf(`u-${i}`, `demande numéro ${i}`);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });

  it("répartit à peu près uniformément — sinon 20 % ne veut pas dire 20 %", () => {
    let inCanary = 0;
    const N = 2000;
    for (let i = 0; i < N; i += 1) if (bucketOf(USER, `question variée ${i}`) < 20) inCanary += 1;
    // Tolérance large : on cherche un biais grossier (tout ou rien), pas une preuve statistique.
    expect(inCanary / N).toBeGreaterThan(0.13);
    expect(inCanary / N).toBeLessThan(0.28);
  });

  it("deux comptes différents ne partagent pas forcément le sort du même énoncé", () => {
    const buckets = new Set(Array.from({ length: 50 }, (_, i) => bucketOf(`compte-${i}`, "Quels mails aujourd'hui ?")));
    expect(buckets.size).toBeGreaterThan(10);
  });
});

describe("§3 — AUCUNE mutation ne change de chemin", () => {
  const mutations = [
    "Supprime le dossier Raltegravir.",
    "Paie la facture de Pharmagene.",
    "Augmente le salaire de Raihana.",
    "Change les droits de Khaled.",
    "Désactive le compte de Khaled.",
    "Envoie le mail à Deepak.",
    "Valide la demande de congé.",
    "Assigne le dossier à Raihana.",
  ];

  it.each(mutations)("« %s » → LEGACY, quel que soit le seau", (phrase) => {
    // canaryPercent: 100 — même en ouvrant tout, la mutation ne bouge pas.
    const d = decideRollout(phrase, { userId: USER, canaryPercent: 100 });
    expect(d.isMutation).toBe(true);
    expect(d.mode).toBe("LEGACY");
  });

  it("« Envoie-le » — la mutation DÉGUISÉE en raccourci reste sur le chemin prouvé", () => {
    // Le routeur la classe FAST_DETERMINISTIC (c'est une réponse courte à une proposition en
    // attente), mais elle EXPÉDIE UN MAIL. C'est le seul cas où « rapide » et « sûr » divergent.
    const d = decideRollout("Envoie-le", { userId: USER, canaryPercent: 100, ctx: { hasPendingMail: true } });
    expect(d.route.route).toBe("FAST_DETERMINISTIC");
    expect(d.route.fastKind).toBe("APPROVE_PENDING");
    expect(d.isMutation).toBe(true);
    expect(d.mode).toBe("LEGACY");
  });

  it("« Oui, vas-y. » aussi", () => {
    const d = decideRollout("Oui, vas-y.", { userId: USER, canaryPercent: 100, ctx: { hasPendingMail: true } });
    expect(d.mode).toBe("LEGACY");
  });
});

describe("§1 — les lectures canoniques sûres sont ACTIVES, sans tirage au sort", () => {
  const lectures = [
    "Quel est l'email de Raihana ?",
    "Donne-moi tous les salariés et leurs mails.",
    "Quels mails aujourd'hui ?",
    "Deepak a répondu ?",
    "Mon prochain rendez-vous ?",
    "Où en est Nintedanib ?",
  ];

  it.each(lectures)("« %s » → FAST_READ même avec un canary à 0 %%", (phrase) => {
    const d = decideRollout(phrase, noCanary);
    expect(d.mode).toBe("FAST_READ");
    expect(d.isMutation).toBe(false);
    expect(d.route.tool).not.toBeNull();
    expect(SAFE_READ_TOOLS.has(d.route.tool as string)).toBe(true);
  });

  it("le chemin rapide n'ouvre QUE des outils de la liste blanche", () => {
    // La liste blanche est une décision, pas un effet de bord : si un outil y entre par
    // renommage, ce test ne le voit pas — mais l'inverse (un outil hors liste qui passerait
    // en rapide) est bien fermé ici.
    for (const phrase of lectures) {
      const d = decideRollout(phrase, noCanary);
      if (d.mode === "FAST_READ") expect(SAFE_READ_TOOLS.has(d.route.tool as string)).toBe(true);
    }
  });
});

describe("§4 — le doute retombe sur le généraliste, jamais sur un raccourci", () => {
  it("une demande ouverte ne prend aucun raccourci canonique", () => {
    const d = decideRollout("Faut-il recruter un deuxième pharmacien cette année ?", noCanary);
    expect(d.mode).not.toBe("FAST_READ");
  });

  it("une confiance sous le plancher renvoie sur LEGACY, canary ouvert ou pas", () => {
    const d = decideRollout("hmm", { userId: USER, canaryPercent: 100 });
    if (d.route.confidence < 0.5) {
      expect(d.mode).toBe("LEGACY");
      expect(d.reason).toContain("confiance");
    }
  });

  it("le coupe-circuit ramène TOUT sur l'ancien chemin", () => {
    const d = decideRollout("Quel est l'email de Raihana ?", { userId: USER, canaryPercent: 100, disabled: true });
    expect(d.mode).toBe("LEGACY");
    expect(d.reason).toContain("désactivé");
  });
});

describe("§2 — le canary borne exactement ce qu'il doit borner", () => {
  /** Une lecture qui n'est PAS canonique : c'est elle qui passe par le tirage. */
  const OUVERTE = "Résume-moi la situation du portefeuille réglementaire par rapport au trimestre dernier.";

  it("à 0 %, aucune lecture ouverte ne bascule", () => {
    expect(decideRollout(OUVERTE, noCanary).mode).toBe("LEGACY");
  });

  it("à 100 %, elle bascule", () => {
    const d = decideRollout(OUVERTE, { userId: USER, canaryPercent: 100 });
    expect(d.mode).toBe("SHORTLIST");
  });

  it("la frontière est stricte : seau < pourcentage, pas ≤", () => {
    const b = bucketOf(USER, OUVERTE);
    // Exactement au seuil de son propre seau, l'énoncé est DEHORS.
    expect(decideRollout(OUVERTE, { userId: USER, canaryPercent: b }).mode).toBe("LEGACY");
    expect(decideRollout(OUVERTE, { userId: USER, canaryPercent: b + 1 }).mode).toBe("SHORTLIST");
  });

  it("le défaut de la mission est bien 20 %", () => {
    expect(DEFAULT_CANARY_PERCENT).toBe(20);
    expect(configuredCanaryPercent({} as NodeJS.ProcessEnv)).toBe(20);
  });

  it("le réglage d'environnement est borné et jamais toxique", () => {
    expect(configuredCanaryPercent({ CHIEF_ROUTER_CANARY: "50" } as never)).toBe(50);
    expect(configuredCanaryPercent({ CHIEF_ROUTER_CANARY: "-10" } as never)).toBe(0);
    expect(configuredCanaryPercent({ CHIEF_ROUTER_CANARY: "5000" } as never)).toBe(100);
    expect(configuredCanaryPercent({ CHIEF_ROUTER_CANARY: "n'importe quoi" } as never)).toBe(20);
  });

  it("le coupe-circuit se lit dans l'environnement", () => {
    expect(routerDisabled({ CHIEF_ROUTER_DISABLED: "1" } as never)).toBe(true);
    expect(routerDisabled({ CHIEF_ROUTER_DISABLED: "true" } as never)).toBe(true);
    expect(routerDisabled({} as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("§22 — la voix est une MODALITÉ, pas un deuxième cerveau", () => {
  const phrases = [
    "Quel est l'email de Raihana ?",
    "Deepak a répondu ?",
    "Supprime le dossier Raltegravir.",
    "Résume-moi la situation du portefeuille réglementaire par rapport au trimestre dernier.",
  ];

  it.each(phrases)("« %s » est aiguillé IDENTIQUEMENT à l'oral et à l'écrit", (phrase) => {
    // Deux aiguillages parallèles finiraient par diverger, et le PDG obtiendrait deux réponses
    // différentes selon qu'il tape ou qu'il parle. C'est ce que ce test rend impossible.
    const parle = decideRollout(phrase, { userId: USER, canaryPercent: 20, ctx: { modality: "voice" } });
    const ecrit = decideRollout(phrase, { userId: USER, canaryPercent: 20, ctx: { modality: "text" } });
    expect(parle.mode).toBe(ecrit.mode);
    expect(parle.route.tool).toBe(ecrit.route.tool);
    expect(parle.route.domain).toBe(ecrit.route.domain);
    expect(parle.bucket).toBe(ecrit.bucket);
  });
});

describe("§8 — la garde se déclenche seule, et pas sur du bruit", () => {
  const fill = (n: number, s = {}) => { for (let i = 0; i < n; i += 1) recordOutcome(s); };

  it("trois erreurs sur cinq tours ne déclenchent RIEN — l'échantillon ne veut rien dire", () => {
    fill(2);
    fill(3, { wrongTool: true });
    expect(guardStatus().samples).toBe(5);
    expect(guardTripped()).toBe(false);
  });

  it("au-delà du minimum, 2 % de mauvais outil déclenche", () => {
    fill(98);
    fill(2, { wrongTool: true });
    const s = guardStatus();
    expect(s.samples).toBe(100);
    expect(s.wrongToolRate).toBeCloseTo(0.02, 5);
    expect(s.tripped).toBe(true);
    expect(s.reason).toContain("mauvais outil");
  });

  it("exactement 1 % ne déclenche pas — le seuil est « > 1 % », pas « ≥ »", () => {
    fill(99);
    fill(1, { wrongTool: true });
    expect(guardStatus().wrongToolRate).toBeCloseTo(0.01, 5);
    expect(guardTripped()).toBe(false);
  });

  it("l'outil manquant a sa propre porte", () => {
    fill(97);
    fill(3, { missingTool: true });
    const s = guardStatus();
    expect(s.tripped).toBe(true);
    expect(s.reason).toContain("outil manquant");
  });

  it("le REPLI seul ne déclenche pas — c'est le filet, pas la faute", () => {
    // §4 dit qu'un raté DOIT devenir généraliste. Punir le repli reviendrait à punir la
    // sécurité elle-même : on le mesure, on ne coupe pas dessus.
    fill(50, { fallback: true });
    fill(50);
    const s = guardStatus();
    expect(s.fallbackRate).toBeCloseTo(0.5, 5);
    expect(s.tripped).toBe(false);
  });

  it("une garde déclenchée renvoie TOUT sur LEGACY, y compris les lectures sûres", () => {
    fill(98);
    fill(2, { wrongTool: true });
    const d = decideRollout("Quel est l'email de Raihana ?", noCanary);
    expect(d.mode).toBe("LEGACY");
    expect(d.reason).toContain("garde déclenchée");
  });

  it("la remise à zéro rouvre le chemin rapide — la garde est réversible", () => {
    fill(98);
    fill(2, { wrongTool: true });
    expect(decideRollout("Quel est l'email de Raihana ?", noCanary).mode).toBe("LEGACY");
    resetGuard();
    expect(decideRollout("Quel est l'email de Raihana ?", noCanary).mode).toBe("FAST_READ");
  });

  it("le minimum d'échantillons est celui annoncé", () => {
    fill(MIN_SAMPLES_BEFORE_TRIP - 1, { wrongTool: true });
    expect(guardTripped()).toBe(false);
    fill(1, { wrongTool: true });
    expect(guardTripped()).toBe(true);
  });
});

describe("§9 — le feu vert exige les DEUX conditions", () => {
  const fill = (n: number, s = {}) => { for (let i = 0; i < n; i += 1) recordOutcome(s); };

  it("un taux parfait sur trente tours ne suffit pas", () => {
    fill(30);
    expect(readyForNextStep()).toBe(false);
  });

  it("un gros volume avec 3 % de mauvais outils ne suffit pas non plus", () => {
    fill(291);
    fill(9, { wrongTool: true });
    expect(guardStatus().samples).toBe(300);
    expect(readyForNextStep()).toBe(false);
  });

  it("volume ET propreté → feu vert", () => {
    fill(250);
    expect(readyForNextStep()).toBe(true);
  });

  it("« ne modifie pas les seuils pour faire passer le test » — ils sont figés ici", () => {
    // Si quelqu'un desserre 1 % à 5 % pour verdir un tableau de bord, cette ligne casse.
    expect(MIN_SAMPLES_BEFORE_TRIP).toBe(50);
  });
});
