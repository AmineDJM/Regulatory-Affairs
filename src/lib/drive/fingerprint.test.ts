import { describe, it, expect } from "vitest";
import { shouldFingerprint, toHex, fingerprintFile, FINGERPRINT_MIN_BYTES, FINGERPRINT_MAX_BYTES } from "./fingerprint";

describe("Quand cela vaut la peine de calculer une empreinte", () => {
  it("pas pour un petit fichier — la vérification coûterait autant que l'envoi", () => {
    expect(shouldFingerprint(0)).toBe(false);
    expect(shouldFingerprint(FINGERPRINT_MIN_BYTES - 1)).toBe(false);
  });

  it("oui dès qu'un envoi commence à se compter en secondes", () => {
    expect(shouldFingerprint(FINGERPRINT_MIN_BYTES)).toBe(true);
    expect(shouldFingerprint(80 * 1024 * 1024)).toBe(true);
  });

  it("non au-delà du plafond — un onglet qui s'effondre est pire qu'un envoi non optimisé", () => {
    // `crypto.subtle.digest` exige le fichier ENTIER en mémoire : au-delà, on renonce sciemment.
    expect(shouldFingerprint(FINGERPRINT_MAX_BYTES)).toBe(true);
    expect(shouldFingerprint(FINGERPRINT_MAX_BYTES + 1)).toBe(false);
  });
});

describe("L'empreinte a la forme attendue par la base", () => {
  it("hexadécimal minuscule, 64 caractères", async () => {
    const blob = new Blob([new Uint8Array(FINGERPRINT_MIN_BYTES).fill(7)]);
    const hex = await fingerprintFile(blob);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("le même contenu donne la même empreinte, un contenu différent une autre", async () => {
    const a = new Blob([new Uint8Array(FINGERPRINT_MIN_BYTES).fill(1)]);
    const b = new Blob([new Uint8Array(FINGERPRINT_MIN_BYTES).fill(1)]);
    const c = new Blob([new Uint8Array(FINGERPRINT_MIN_BYTES).fill(2)]);
    expect(await fingerprintFile(a)).toBe(await fingerprintFile(b));
    expect(await fingerprintFile(a)).not.toBe(await fingerprintFile(c));
  });

  it("les octets de tête sont rendus avec leur zéro — sinon la comparaison échoue en base", () => {
    expect(toHex(new Uint8Array([0, 15, 255]).buffer)).toBe("000fff");
  });

  it("un fichier hors bornes rend null, sans lever — l'envoi normal prend le relais", async () => {
    expect(await fingerprintFile(new Blob(["court"]))).toBeNull();
  });
});
