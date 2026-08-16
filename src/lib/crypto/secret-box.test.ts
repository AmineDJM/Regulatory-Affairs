import { describe, it, expect } from "vitest";
import { sealSecret, openSecret } from "./secret-box";

describe("Les jetons dorment chiffrés", () => {
  it("un aller-retour rend exactement la valeur d'origine", () => {
    const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.charge-utile.signature";
    expect(openSecret(sealSecret(token))).toBe(token);
  });

  it("la valeur chiffrée ne contient RIEN du clair", () => {
    // Un jeton lisible dans une sauvegarde de base, c'est la boîte mail de quelqu'un offerte.
    const sealed = sealSecret("secret-tres-reconnaissable");
    expect(sealed).not.toContain("secret-tres-reconnaissable");
  });

  it("deux chiffrements du même secret diffèrent — sinon on lit les répétitions", () => {
    expect(sealSecret("meme-valeur")).not.toBe(sealSecret("meme-valeur"));
  });

  it("un octet modifié fait ÉCHOUER le déchiffrement, il ne rend pas une valeur fausse", () => {
    // C'est tout l'intérêt de GCM : il authentifie. Une valeur silencieusement corrompue serait
    // pire qu'une erreur — on enverrait des requêtes avec un jeton abîmé sans le savoir.
    const sealed = sealSecret("valeur");
    const parts = sealed.split(":");
    const tampered = [parts[0], parts[1], Buffer.from("autre-chose").toString("base64")].join(":");
    expect(openSecret(tampered)).toBeNull();
  });

  it("une valeur illisible rend null au lieu de lever", () => {
    // Un jeton indéchiffrable doit conduire à REDEMANDER une connexion, pas à faire tomber
    // l'écran de messagerie de tout le monde.
    expect(openSecret("pas-du-tout-chiffre")).toBeNull();
    expect(openSecret("a:b")).toBeNull();
    expect(openSecret(null)).toBeNull();
    expect(openSecret(undefined)).toBeNull();
    expect(openSecret("")).toBeNull();
  });

  it("supporte l'accentué et le très long", () => {
    const long = "éàü".repeat(2000);
    expect(openSecret(sealSecret(long))).toBe(long);
  });
});
