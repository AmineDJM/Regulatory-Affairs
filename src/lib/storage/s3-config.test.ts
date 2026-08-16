import { describe, it, expect } from "vitest";
import {
  resolveS3Config, describeConfig, readVar, isTruthy, storageDisabled, providerOf, type Env,
} from "./s3-config";

const SUPABASE: Env = {
  S3_ENDPOINT: "https://abcd.storage.supabase.co/storage/v1/s3",
  S3_REGION: "eu-central-1",
  S3_ACCESS_KEY_ID: "AKIAxxxxxxxx",
  S3_SECRET_ACCESS_KEY: "s3cr3t",
  S3_BUCKET: "amd-internal-os",
  S3_FORCE_PATH_STYLE: "true",
};

const LEGACY_R2: Env = {
  REG_S3_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
  REG_S3_ACCESS_KEY_ID: "old-key",
  REG_S3_SECRET_ACCESS_KEY: "old-secret",
  REG_S3_BUCKET: "vieux-bucket",
};

describe("Supabase se configure avec les variables S3_ standards", () => {
  it("lit l'endpoint, la région, le bucket et les clés", () => {
    const cfg = resolveS3Config(SUPABASE)!;
    expect(cfg.endpoint).toBe("https://abcd.storage.supabase.co/storage/v1/s3");
    expect(cfg.region).toBe("eu-central-1");
    expect(cfg.bucket).toBe("amd-internal-os");
    expect(cfg.pathStyle).toBe(true);
  });

  it("accepte « true » comme « 1 » : un drapeau s'écrit comme on l'écrit vraiment", () => {
    expect(isTruthy("true", false)).toBe(true);
    expect(isTruthy("1", false)).toBe(true);
    expect(isTruthy("yes", false)).toBe(true);
    expect(isTruthy("0", true)).toBe(false);
    expect(isTruthy("false", true)).toBe(false);
    expect(isTruthy("", true)).toBe(true); // absent → défaut
  });

  it("le style CHEMIN est le défaut — Supabase et MinIO l'exigent", () => {
    const { S3_FORCE_PATH_STYLE: _omit, ...withoutFlag } = SUPABASE;
    expect(resolveS3Config(withoutFlag)!.pathStyle).toBe(true);
  });

  it("nettoie un espace ou un retour-ligne collé avec le secret", () => {
    // Une clé recopiée depuis un panneau d'hébergeur traîne souvent un blanc : sans ce
    // nettoyage, la signature échoue avec un message qui n'oriente vers rien.
    const cfg = resolveS3Config({ ...SUPABASE, S3_SECRET_ACCESS_KEY: "  s3cr3t\n" })!;
    expect(cfg.secretAccessKey).toBe("s3cr3t");
  });

  it("retire un / final de l'endpoint pour ne pas fabriquer un double slash", () => {
    expect(resolveS3Config({ ...SUPABASE, S3_ENDPOINT: "https://x.supabase.co/s3/" })!.endpoint)
      .toBe("https://x.supabase.co/s3");
  });
});

describe("La production qui tourne ne s'arrête pas parce qu'on renomme une variable", () => {
  it("les anciennes REG_S3_* fonctionnent encore, seules", () => {
    const cfg = resolveS3Config(LEGACY_R2)!;
    expect(cfg.bucket).toBe("vieux-bucket");
    expect(cfg.region).toBe("auto"); // défaut historique R2
  });

  it("les nouvelles PRIMENT quand les deux existent — sinon la transition ne finit jamais", () => {
    const cfg = resolveS3Config({ ...LEGACY_R2, ...SUPABASE })!;
    expect(cfg.bucket).toBe("amd-internal-os");
    expect(cfg.endpoint).toContain("supabase");
  });

  it("dit sous quel nom la configuration a été trouvée", () => {
    expect(readVar(SUPABASE, "BUCKET").source).toBe("S3");
    expect(readVar(LEGACY_R2, "BUCKET").source).toBe("REG_S3");
    expect(readVar({}, "BUCKET").source).toBe("none");
  });
});

describe("Sans configuration complète, on reste en base — et ce n'est pas une erreur", () => {
  it("une valeur indispensable manquante désactive le stockage objet", () => {
    for (const k of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
      const env = { ...SUPABASE };
      delete env[k];
      expect(resolveS3Config(env), k).toBeNull();
    }
  });

  it("l'interrupteur d'arrêt l'emporte sur une configuration complète", () => {
    expect(storageDisabled({ ...SUPABASE, S3_DISABLED: "1" })).toBe(true);
    expect(resolveS3Config({ ...SUPABASE, S3_DISABLED: "1" })).toBeNull();
    // L'ancien nom du drapeau marche aussi.
    expect(resolveS3Config({ ...SUPABASE, REG_S3_DISABLED: "true" })).toBeNull();
  });

  it("un environnement vide n'est pas configuré, sans lever", () => {
    expect(resolveS3Config({})).toBeNull();
  });

  it("nomme le drapeau EXACT qui coupe — pas l'autre", () => {
    // « Retirez S3_DISABLED » quand c'est REG_S3_DISABLED qui traîne envoie chercher une variable
    // qui n'existe pas dans le panneau. Le diagnostic doit donner le nom qu'on ira supprimer.
    expect(describeConfig({ ...SUPABASE, REG_S3_DISABLED: "1" }).disabledBy).toBe("REG_S3_DISABLED");
    expect(describeConfig({ ...SUPABASE, S3_DISABLED: "true" }).disabledBy).toBe("S3_DISABLED");
    expect(describeConfig(SUPABASE).disabledBy).toBeNull();
  });

  it("le drapeau moderne DÉSARME l'ancien — sinon on ne pourrait jamais rallumer", () => {
    // Poser `S3_DISABLED=0` doit rallumer le stockage même si un vieux `REG_S3_DISABLED=1` traîne
    // encore : autrement il faudrait retrouver et supprimer une variable héritée pour repartir.
    expect(resolveS3Config({ ...SUPABASE, REG_S3_DISABLED: "1", S3_DISABLED: "0" })).not.toBeNull();
  });
});

describe("Deux familles de variables mélangées — le piège silencieux", () => {
  it("repère une clé de l'ANCIEN fournisseur devant un endpoint tout neuf", () => {
    // Une clé n'est valable que sur l'hôte qui l'a émise. Un `S3_ENDPOINT` Supabase avec un
    // `REG_S3_ACCESS_KEY_ID` resté de R2 donne « SignatureDoesNotMatch », qui n'oriente vers rien.
    const d = describeConfig({
      S3_ENDPOINT: "https://abcd.storage.supabase.co/storage/v1/s3",
      S3_BUCKET: "amd-internal-os",
      S3_SECRET_ACCESS_KEY: "s3cr3t",
      REG_S3_ACCESS_KEY_ID: "AKIA-ancien-r2",
    });
    expect(d.configured).toBe(true); // techniquement complet…
    expect(d.mixedSources).toBe(true); // … mais très probablement faux
    expect(d.sources.S3_ACCESS_KEY_ID).toBe("REG_S3");
    expect(d.sources.S3_ENDPOINT).toBe("S3");
  });

  it("une famille unique n'est pas un mélange, sous l'un ou l'autre nom", () => {
    expect(describeConfig(SUPABASE).mixedSources).toBe(false);
    expect(describeConfig({
      REG_S3_ENDPOINT: "https://x.r2.cloudflarestorage.com", REG_S3_BUCKET: "b",
      REG_S3_ACCESS_KEY_ID: "k", REG_S3_SECRET_ACCESS_KEY: "s",
    }).mixedSources).toBe(false);
  });

  it("une configuration incomplète ne crie pas au mélange", () => {
    // Une valeur absente n'a pas de famille : elle ne mélange rien, elle manque.
    expect(describeConfig({ S3_ENDPOINT: "https://x.supabase.co" }).mixedSources).toBe(false);
  });
});

describe("Le diagnostic ne montre JAMAIS un secret", () => {
  const d = describeConfig(SUPABASE);

  it("expose l'hôte, le bucket, la région — et rien d'autre", () => {
    expect(d.configured).toBe(true);
    expect(d.endpointHost).toBe("abcd.storage.supabase.co");
    expect(d.bucket).toBe("amd-internal-os");
    expect(d.region).toBe("eu-central-1");
  });

  it("aucune clé, même tronquée, dans la description sérialisée", () => {
    const json = JSON.stringify(d);
    expect(json).not.toContain("s3cr3t");
    expect(json).not.toContain("AKIA");
  });

  it("nomme ce qui manque, sous le nom qu'il faut ajouter", () => {
    const partial = describeConfig({ S3_ENDPOINT: "https://x.supabase.co" });
    expect(partial.configured).toBe(false);
    expect(partial.missing).toEqual(["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]);
  });

  it("reconnaît le fournisseur pour le dire à l'écran — sans jamais s'en servir pour décider", () => {
    expect(providerOf("abcd.storage.supabase.co")).toBe("Supabase Storage");
    expect(providerOf("acct.r2.cloudflarestorage.com")).toBe("Cloudflare R2");
    expect(providerOf("s3.eu-west-3.amazonaws.com")).toBe("Amazon S3");
    expect(providerOf("minio.interne.lan")).toBe("S3-compatible");
    expect(providerOf("")).toBe("—");
  });
});
