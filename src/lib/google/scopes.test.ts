import { describe, it, expect } from "vitest";
import {
  canonicalScope,
  normalizeScopes,
  isScopeSatisfied,
  computeMissingScopes,
  mergeGrantedScopes,
} from "./scopes";
import { GOOGLE_SCOPES, SCOPE_PURPOSE } from "./config";
import { buildAuthorizeUrl } from "./oauth";
import type { GoogleConfig } from "./config";

/**
 * LE BOGUE, GARDÉ SOUS TEST.
 *
 * `/chief-of-staff/reglages` annonçait « email manquant, profile manquant » sur un compte où ces
 * droits étaient accordés — et aucune reconnexion n'y changeait rien, puisque le droit était là.
 * La cause n'était pas le consentement mais la COMPARAISON : on demande `email`, Google répond
 * `https://www.googleapis.com/auth/userinfo.email`, et `includes()` ne voit pas que c'est le
 * même droit.
 *
 * Ce fichier reconstitue la réponse RÉELLE de Google — pas une réponse idéalisée où les deux
 * côtés s'écriraient pareil, ce qui ne prouverait rien.
 */

/** Ce que Google renvoie vraiment dans `scope` après un consentement complet d'Adam. */
const REPONSE_REELLE_DE_GOOGLE = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/contacts.readonly",
].join(" ");

describe("droits Google — les écritures équivalentes désignent le même droit", () => {
  it("« email » et l'URI userinfo.email sont le MÊME droit", () => {
    expect(canonicalScope("email")).toBe(canonicalScope("https://www.googleapis.com/auth/userinfo.email"));
  });

  it("« profile » et l'URI userinfo.profile sont le MÊME droit", () => {
    expect(canonicalScope("profile")).toBe(canonicalScope("https://www.googleapis.com/auth/userinfo.profile"));
  });

  it("« openid » se compare à lui-même, sans URI", () => {
    expect(canonicalScope("openid")).toBe("openid");
  });

  it("la barre oblique finale et les espaces ne changent pas le droit", () => {
    expect(canonicalScope(" https://mail.google.com/ ")).toBe(canonicalScope("https://mail.google.com"));
    expect(canonicalScope("  email  ")).toBe(canonicalScope("email"));
  });

  it("découpe une réponse séparée par des espaces, sans doublon", () => {
    const n = normalizeScopes("openid  email email https://www.googleapis.com/auth/userinfo.email");
    expect(n).toHaveLength(2); // openid + l'identité e-mail, comptée une seule fois
    expect(n).toContain("openid");
  });

  it("accepte aussi bien une chaîne qu'un tableau, et le vide", () => {
    expect(normalizeScopes(["openid", "email"])).toHaveLength(2);
    expect(normalizeScopes(null)).toEqual([]);
    expect(normalizeScopes("")).toEqual([]);
  });
});

describe("droits Google — ce qui manque VRAIMENT", () => {
  it("LE BOGUE : la réponse réelle de Google ne laisse AUCUN droit manquant", () => {
    expect(computeMissingScopes(GOOGLE_SCOPES, REPONSE_REELLE_DE_GOOGLE)).toEqual([]);
  });

  it("« email » est reconnu accordé quand Google rend son URI", () => {
    const granted = "openid https://www.googleapis.com/auth/userinfo.email";
    expect(isScopeSatisfied("email", new Set(normalizeScopes(granted)))).toBe(true);
  });

  it("« profile » est reconnu accordé quand Google rend son URI", () => {
    const granted = "https://www.googleapis.com/auth/userinfo.profile";
    expect(isScopeSatisfied("profile", new Set(normalizeScopes(granted)))).toBe(true);
  });

  it("un droit RÉELLEMENT absent est bien signalé, et sous la forme demandée", () => {
    const partiel = REPONSE_REELLE_DE_GOOGLE.replace("https://www.googleapis.com/auth/calendar ", "");
    const manquants = computeMissingScopes(GOOGLE_SCOPES, partiel);
    expect(manquants).toEqual(["https://www.googleapis.com/auth/calendar"]);
  });

  it("l'identité absente est signalée sous SON nom court, celui qu'on redemandera", () => {
    const sansIdentite = "https://www.googleapis.com/auth/gmail.modify";
    const manquants = computeMissingScopes(["email", "profile"], sansIdentite);
    expect(manquants).toEqual(["email", "profile"]);
  });

  it("aucune connexion = tous les droits manquants (pas une liste vide rassurante)", () => {
    expect(computeMissingScopes(GOOGLE_SCOPES, null)).toEqual([...GOOGLE_SCOPES]);
  });

  it("un droit accordé PLUS LARGE couvre le droit demandé", () => {
    // Un compte qui a consenti à `https://mail.google.com/` a plus que `gmail.modify` : le
    // signaler manquant enverrait reconnecter pour un droit déjà (largement) accordé.
    const large = "https://mail.google.com/";
    expect(isScopeSatisfied("https://www.googleapis.com/auth/gmail.modify", new Set(normalizeScopes(large)))).toBe(true);
    // …et l'inverse reste FAUX : un droit étroit ne couvre pas un droit large.
    const etroit = "https://www.googleapis.com/auth/gmail.readonly";
    expect(isScopeSatisfied("https://www.googleapis.com/auth/gmail.modify", new Set(normalizeScopes(etroit)))).toBe(false);
  });

  it("chaque droit demandé sait se nommer à l'écran", () => {
    for (const s of GOOGLE_SCOPES) {
      expect(SCOPE_PURPOSE[s], s).toBeTruthy();
    }
  });
});

describe("reconnexion — les droits déjà accordés ne se perdent pas", () => {
  it("l'union conserve un droit que le nouvel échange ne mentionne pas", () => {
    const avant = "openid https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar";
    const apres = "openid https://www.googleapis.com/auth/userinfo.email";
    const fusion = mergeGrantedScopes(avant, apres);
    expect(fusion).toContain("https://www.googleapis.com/auth/drive");
    expect(fusion).toContain("https://www.googleapis.com/auth/calendar");
    expect(fusion).toContain("https://www.googleapis.com/auth/userinfo.email");
  });

  it("l'union canonise : « email » puis son URI ne comptent qu'une fois", () => {
    const fusion = mergeGrantedScopes("email", "https://www.googleapis.com/auth/userinfo.email");
    expect(fusion.split(" ")).toHaveLength(1);
  });

  it("après une reconnexion partielle, plus AUCUN droit ne manque", () => {
    // Le compte avait tout sauf l'agenda ; la reconnexion n'a rendu que l'agenda.
    const avant = REPONSE_REELLE_DE_GOOGLE.replace("https://www.googleapis.com/auth/calendar ", "");
    const incrementale = "https://www.googleapis.com/auth/calendar";
    expect(computeMissingScopes(GOOGLE_SCOPES, mergeGrantedScopes(avant, incrementale))).toEqual([]);
  });

  it("une fusion sur rien du tout ne fabrique aucun droit", () => {
    expect(mergeGrantedScopes(null, null)).toBe("");
  });
});

describe("la demande envoyée à Google porte réellement les droits d'identité", () => {
  const CFG: GoogleConfig = {
    clientId: "cid.apps.googleusercontent.com",
    clientSecret: "secret",
    redirectUri: "https://erp.example.com/api/google/callback",
    adamEmail: "adam.executive.ai@gmail.com",
    pubsubTopic: null,
    pubsubAudience: null,
  };

  it("openid, email et profile figurent dans le paramètre `scope`", () => {
    const url = new URL(buildAuthorizeUrl(CFG, "state", "challenge"));
    const demandes = (url.searchParams.get("scope") ?? "").split(" ");
    expect(demandes).toContain("openid");
    expect(demandes).toContain("email");
    expect(demandes).toContain("profile");
  });

  it("la demande est INCRÉMENTALE : les droits déjà accordés sont conservés", () => {
    const url = new URL(buildAuthorizeUrl(CFG, "state", "challenge"));
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    // …et elle réclame un jeton de rafraîchissement, sans quoi l'accès meurt en une heure.
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  it("PKCE et l'état signé voyagent avec la demande", () => {
    const url = new URL(buildAuthorizeUrl(CFG, "st-42", "ch-42"));
    expect(url.searchParams.get("code_challenge")).toBe("ch-42");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("st-42");
  });

  it("aucun secret d'application ne part dans l'URL de consentement", () => {
    const url = buildAuthorizeUrl(CFG, "st", "ch");
    expect(url).not.toContain(CFG.clientSecret);
  });
});
