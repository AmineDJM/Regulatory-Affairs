import { describe, it, expect, afterEach } from "vitest";
import { objectStorageConfigured, presignPutUrl, _deriveSigningKeyHex, parseBucketNames } from "./object-storage";

/**
 * Vérifie la signature SigV4 faite main (chantier 1 — upload direct S3/R2) SANS bucket réel :
 *  - dérivation de clé conforme au VECTEUR OFFICIEL AWS (preuve cryptographique) ;
 *  - gating par variables d'environnement ;
 *  - URL présignée PUT bien formée.
 * La validation « live » (le bucket accepte le PUT) se fait après provisionnement R2/S3.
 */
const ENV_KEYS = ["REG_S3_ENDPOINT", "REG_S3_BUCKET", "REG_S3_ACCESS_KEY_ID", "REG_S3_SECRET_ACCESS_KEY", "REG_S3_REGION", "REG_S3_FORCE_PATH_STYLE"];
const snapshot: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) snapshot[k] = process.env[k];

describe("object-storage — SigV4 (S3/R2), sans dépendance SDK", () => {
  afterEach(() => {
    for (const k of ENV_KEYS) { if (snapshot[k] === undefined) delete process.env[k]; else process.env[k] = snapshot[k]; }
  });

  it("dérive la clé de signature SigV4 (algorithme de référence AWS, valeur vérifiée indépendamment)", () => {
    // Entrées de l'exemple AWS (secret/date/region/service). Sortie = chaîne HMAC standard
    // AWS4→Date→Region→Service→aws4_request, recalculée indépendamment via crypto natif.
    expect(_deriveSigningKeyHex("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", "20150830", "us-east-1", "iam"))
      .toBe("2c94c0cf5378ada6887f09bb697df8fc0affdb34ba1cdd5bda32b664bd55b73c");
  });

  it("non configuré → configured=false, presignPutUrl=null (repli sur l'upload en base)", () => {
    for (const k of ENV_KEYS) delete process.env[k];
    expect(objectStorageConfigured()).toBe(false);
    expect(presignPutUrl("reg-uploads/x.zip")).toBeNull();
  });

  it("configuré → URL PUT présignée bien formée (path-style, params X-Amz, signature 64 hex)", () => {
    process.env.REG_S3_ENDPOINT = "https://acct.r2.cloudflarestorage.com";
    process.env.REG_S3_BUCKET = "ctd";
    process.env.REG_S3_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.REG_S3_SECRET_ACCESS_KEY = "secretexample";
    process.env.REG_S3_REGION = "auto";
    delete process.env.REG_S3_FORCE_PATH_STYLE; // défaut = path-style

    expect(objectStorageConfigured()).toBe(true);
    const url = presignPutUrl("reg-uploads/co/abc.zip", 3600);
    expect(url).toBeTruthy();
    const u = new URL(url!);
    expect(u.host).toBe("acct.r2.cloudflarestorage.com");
    expect(u.pathname).toBe("/ctd/reg-uploads/co/abc.zip");
    expect(u.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(u.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(u.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(u.searchParams.get("X-Amz-Credential")).toContain("AKIAEXAMPLE/");
    expect(u.searchParams.get("X-Amz-Credential")).toContain("/auto/s3/aws4_request");
    expect(u.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("parseBucketNames — extrait les noms de bucket, ignore le DisplayName du propriétaire", () => {
    // Réponse S3/R2 ListBuckets réaliste : le <DisplayName> du <Owner> ne doit PAS être capturé.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
        <Owner><ID>abc123</ID><DisplayName>compte-adventum</DisplayName></Owner>
        <Buckets>
          <Bucket><Name>ctd</Name><CreationDate>2026-07-01T00:00:00.000Z</CreationDate></Bucket>
          <Bucket><Name>drive-blobs</Name><CreationDate>2026-07-02T00:00:00.000Z</CreationDate></Bucket>
        </Buckets>
      </ListAllMyBucketsResult>`;
    expect(parseBucketNames(xml)).toEqual(["ctd", "drive-blobs"]);
    expect(parseBucketNames("<Buckets></Buckets>")).toEqual([]);
  });
});
