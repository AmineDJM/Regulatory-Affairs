import { describe, it, expect } from "vitest";
import { estUneBaseDeBanc, estUneBaseLocale, refusDeBase } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN BANC N'OUVRE PAS LA BASE DE TRAVAIL — et on nomme le cas qui ferait tomber chaque
 * assertion, sinon ce n'en est pas une (§118.17).
 *
 * Ces cas ne sont pas des variations décoratives : chacun est un lancement RÉEL observé sur ce
 * conteneur. `DATABASE_URL` y pointe par défaut sur la base de PRODUCTION de Render, et
 * `npx tsx scripts/bench/…` était le geste le plus naturel du monde.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const BANC = ["node", "/home/user/Regulatory-Affairs/scripts/bench/chaine-humaine.ts"] as const;
const PRODUIT = ["node", "/app/node_modules/.bin/next"] as const;

const BENCH = "postgresql://amd:amd@localhost:5432/amd_bench";
const TRAVAIL = "postgresql://amd:amd@localhost:5432/amd_internal_os";
const RENDER = "postgresql://u:p@dpg-xxxx.frankfurt-postgres.render.com:5432/amd_bench";

describe("la base d'un banc se lit dans l'URL", () => {
  it("accepte un hôte local dont le nom contient « bench »", () => {
    expect(estUneBaseDeBanc(BENCH)).toBe(true);
    expect(estUneBaseDeBanc("postgresql://amd:amd@127.0.0.1:5432/adam_bench?schema=public")).toBe(true);
  });

  it("refuse la base de TRAVAIL, même locale : c'est le voisinage de la suite unitaire", () => {
    expect(estUneBaseDeBanc(TRAVAIL)).toBe(false);
  });

  it("refuse un hôte distant, même si le NOM dit « bench »", () => {
    // Le défaut le plus coûteux : un nom rassurant sur une base qui ne l'est pas.
    expect(estUneBaseDeBanc(RENDER)).toBe(false);
  });

  it("refuse une URL absente ou illisible plutôt que de la lire de travers", () => {
    expect(estUneBaseDeBanc("")).toBe(false);
    expect(estUneBaseDeBanc("pas-une-url")).toBe(false);
  });
});

describe("le refus s'arme sur un FAIT du lancement", () => {
  it("laisse passer la PRODUCTION : aucun scripts/bench/ au point d'entrée", () => {
    expect(refusDeBase({ DATABASE_URL: RENDER } as unknown as NodeJS.ProcessEnv, PRODUIT)).toBeNull();
  });

  it("laisse passer la SUITE UNITAIRE sur une base LOCALE, quel qu'en soit le nom", () => {
    // `office-sabotage.ts` lance vitest en enfant ; cet enfant hérite de `npm_lifecycle_script`,
    // donc du fait « je suis un banc ». Il est jugé comme un TEST : sans cela, la suite
    // unitaire tomberait sur le NOM de la base de travail.
    const env = { DATABASE_URL: TRAVAIL, VITEST: "true", npm_lifecycle_script: "tsx scripts/bench/office-sabotage.ts" } as unknown as NodeJS.ProcessEnv;
    expect(refusDeBase(env, BANC)).toBeNull();
  });

  /**
   * LE CAS QUI A ARRÊTÉ UNE CATASTROPHE. Dans ce conteneur, `DATABASE_URL` par défaut porte
   * l'hôte Render et la base `amd_internal_os` : `npm test` — la porte franchie avant chaque
   * commit — semait ses lignes dans la PRODUCTION d'Adventum, et rien ne l'en empêchait.
   */
  it("REFUSE la suite de tests contre une base DISTANTE", () => {
    const prod = "postgresql://u:p@dpg-d8u679mgvqtc739eosvg-a.oregon-postgres.render.com:5432/amd_internal_os";
    const r = refusDeBase({ DATABASE_URL: prod, VITEST: "true" } as unknown as NodeJS.ProcessEnv, PRODUIT);
    expect(r).toBeTruthy();
    expect(r).toContain("suite de tests");
    expect(r).toContain("hôte local");
    expect(r).toContain("TEST_DATABASE_URL");
  });

  /**
   * ET LA PORTE DU DÉPÔT PORTE SA BASE. Le refus ci-dessus est le filet ; le script `test` est
   * ce qui fait qu'on ne le rencontre pas. Sans lui, chaque contributeur devrait se souvenir de
   * poser la variable — c'est-à-dire l'oublier (§118.17).
   */
  it("le script `test` du dépôt porte une base LOCALE", async () => {
    const fs = await import("node:fs");
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    const cmd = pkg.scripts.test ?? "";
    expect(cmd, `script test : ${cmd}`).toContain("DATABASE_URL=");
    const m = /(postgres(?:ql)?:\/\/[^"}\s]+)/.exec(cmd);
    expect(m, `aucune URL lisible dans : ${cmd}`).toBeTruthy();
    expect(estUneBaseLocale(m?.[1] ?? "")).toBe(true);
  });

  it("la localité se lit dans l'URL, sans DNS", () => {
    expect(estUneBaseLocale(TRAVAIL)).toBe(true);
    expect(estUneBaseLocale(BENCH)).toBe(true);
    // Le piège : un nom qui CONTIENT « localhost » sans en être un.
    expect(estUneBaseLocale("postgresql://u:p@localhost.attaquant.example:5432/amd")).toBe(false);
    expect(estUneBaseLocale(RENDER)).toBe(false);
  });

  it("REFUSE un banc pointé sur la base de production", () => {
    const r = refusDeBase({ DATABASE_URL: RENDER } as unknown as NodeJS.ProcessEnv, BANC);
    expect(r).toBeTruthy();
    expect(r).toContain("render.com");
  });

  it("REFUSE un banc pointé sur la base de travail — la cause du PAY-2026-044", () => {
    expect(refusDeBase({ DATABASE_URL: TRAVAIL } as unknown as NodeJS.ProcessEnv, BANC)).toBeTruthy();
  });

  it("laisse passer un banc pointé sur sa propre base", () => {
    expect(refusDeBase({ DATABASE_URL: BENCH } as unknown as NodeJS.ProcessEnv, BANC)).toBeNull();
  });

  it("le refus NOMME le remède, pas seulement la faute (§118.30)", () => {
    const r = refusDeBase({ DATABASE_URL: TRAVAIL } as unknown as NodeJS.ProcessEnv, BANC) ?? "";
    expect(r).toContain("BENCH_DATABASE_URL");
    expect(r).toContain("amd_bench");
  });

  it("s'arme aussi par `npm_lifecycle_script`, pas seulement par argv", () => {
    const env = { DATABASE_URL: TRAVAIL, npm_lifecycle_script: "tsx scripts/bench/horizon-long.ts" } as unknown as NodeJS.ProcessEnv;
    expect(refusDeBase(env, PRODUIT)).toBeTruthy();
  });
});

/**
 * LE CLIQUET : chaque script npm qui lance un banc porte sa base. Un banc ajouté demain sans
 * elle serait REFUSÉ à l'exécution (c'est le but), mais le dire ici fait tomber la suite AVANT
 * qu'on perde un run — et surtout : ce test est ce qui empêche de « réparer » un refus en
 * retirant la base d'un script plutôt qu'en l'ajoutant au suivant.
 */
describe("les scripts npm des bancs portent leur base", () => {
  const bancs = async () => {
    const fs = await import("node:fs");
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    return Object.entries(pkg.scripts).filter(([, v]) => v.includes("scripts/bench/") || v.trim().endsWith("tsx --"));
  };

  it("aucun script lançant scripts/bench/ n'oublie BENCH_DATABASE_URL", async () => {
    const nus = (await bancs()).filter(([, v]) => !v.includes("BENCH_DATABASE_URL")).map(([k]) => k);
    expect(nus, `scripts sans base de banc : ${nus.join(", ")}`).toEqual([]);
  });

  /**
   * LE MANDATAIRE, MÊME RAISON. Le `fetch` global de Node n'honore pas `HTTPS_PROXY` (§118.84) :
   * un banc lancé sans le préchargement sort en DIRECT, donc non signé, donc en 401 — et l'échec
   * ressemble à une clé manquante. Deux bancs sur dix-sept le portaient ; les quinze autres
   * étaient injouables ici sans que personne l'ait écrit.
   */
  it("aucun script lançant un banc n'oublie le mandataire", async () => {
    const nus = (await bancs()).filter(([, v]) => !v.includes("proxy-dispatcher")).map(([k]) => k);
    expect(nus, `bancs sans mandataire : ${nus.join(", ")}`).toEqual([]);
  });
});
