import { describe, it, expect } from "vitest";
import { signState, verifyState, makePkce, buildAuthorizeUrl } from "./oauth";
import { SCOPES, resolveMicrosoftConfig, missingMicrosoftVars, microsoftMailEnabled, pilotMailboxes } from "./config";

const CFG = {
  tenantId: "tenant-123",
  clientId: "client-abc",
  clientSecret: "secret-xyz",
  redirectUri: "https://app.adventumdz.com/api/mail/ms/callback",
};

describe("Le state OAuth — la protection qu'on oublie et qui coûte cher", () => {
  it("reconnaît un state qu'on vient d'émettre", () => {
    expect(verifyState(signState("user-1"))).toBe("user-1");
  });

  it("refuse un state FORGÉ", () => {
    // Sans cette signature, un lien de retour fabriqué permet de brancher la boîte d'un attaquant
    // sur le compte d'un collègue : le collègue enverrait alors des mails en son nom.
    expect(verifyState("nimportequoi")).toBeNull();
    expect(verifyState("dXNlci0x.signature-inventee")).toBeNull();
  });

  it("refuse un state dont la signature a été retouchée", () => {
    const s = signState("user-1");
    const tampered = `${s.slice(0, -2)}xy`;
    expect(verifyState(tampered)).toBeNull();
  });

  it("refuse un state dont la charge a été remplacée", () => {
    // On tente de faire passer le state de quelqu'un d'autre pour le sien.
    const mine = signState("user-1");
    const sig = mine.slice(mine.lastIndexOf(".") + 1);
    const forged = `${Buffer.from("user-2.0.x").toString("base64url")}.${sig}`;
    expect(verifyState(forged)).toBeNull();
  });

  it("refuse un state PÉRIMÉ", () => {
    const old = signState("user-1", Date.now() - 20 * 60_000);
    expect(verifyState(old)).toBeNull();
  });

  it("refuse un state daté du futur", () => {
    expect(verifyState(signState("user-1", Date.now() + 5 * 60_000))).toBeNull();
  });

  it("deux states du même utilisateur diffèrent — on ne rejoue pas un lien", () => {
    expect(signState("user-1")).not.toBe(signState("user-1"));
  });

  it("un state vide ou absent ne passe pas", () => {
    expect(verifyState(null)).toBeNull();
    expect(verifyState("")).toBeNull();
  });
});

describe("PKCE", () => {
  it("produit un vérificateur et une empreinte différents à chaque fois", () => {
    const a = makePkce();
    const b = makePkce();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(a.verifier);
    expect(a.verifier.length).toBeGreaterThan(40);
  });
});

describe("L'URL d'autorisation", () => {
  const url = () => new URL(buildAuthorizeUrl(CFG, "state-1", "challenge-1", "amine.djouamai@adventumdz.com"));

  it("vise le locataire de l'entreprise, pas le point d'entrée commun", () => {
    expect(url().origin + url().pathname).toContain("tenant-123");
  });

  it("ne demande QUE les droits nécessaires", () => {
    const scopes = (url().searchParams.get("scope") ?? "").split(" ");
    expect(scopes.sort()).toEqual([...SCOPES].sort());
    // Une permission d'application donnerait accès à TOUTES les boîtes de l'entreprise :
    // elle n'a rien à faire dans un pilote sur une seule boîte.
    expect(scopes.join(" ")).not.toContain(".All");
  });

  it("ne fait JAMAIS voyager le secret d'application dans l'URL", () => {
    // L'URL passe par le navigateur : un secret qui s'y trouve est un secret publié.
    expect(url().toString()).not.toContain(CFG.clientSecret);
  });

  it("porte PKCE en S256, jamais en clair", () => {
    expect(url().searchParams.get("code_challenge_method")).toBe("S256");
    expect(url().searchParams.get("code_challenge")).toBe("challenge-1");
  });

  it("force le choix du compte — un poste partagé ne doit pas enchaîner sur le précédent", () => {
    expect(url().searchParams.get("prompt")).toBe("select_account");
  });

  it("suggère la bonne boîte", () => {
    expect(url().searchParams.get("login_hint")).toBe("amine.djouamai@adventumdz.com");
  });

  // Une adresse d'entreprise existe souvent aussi comme compte Microsoft PERSONNEL. Sans cette
  // indication, le sélecteur propose les deux vignettes, on prend la mauvaise, et Microsoft
  // répond AADSTS50020 (« compte live.com inexistant dans ce locataire ») — exact, et
  // incompréhensible pour quelqu'un qui EST membre du locataire, avec son autre compte.
  it("n'accepte que le compte professionnel ou scolaire", () => {
    expect(url().searchParams.get("domain_hint")).toBe("organizations");
  });

  // L'indication de domaine ORIENTE le sélecteur ; elle ne décide de rien. C'est l'autorité du
  // locataire qui tranche qui a le droit d'entrer, et elle ne bouge pas.
  it("garde l'autorité du locataire malgré l'indication de domaine", () => {
    expect(url().pathname).toContain("tenant-123");
    expect(url().pathname).not.toContain("/organizations/");
    expect(url().pathname).not.toContain("/common/");
  });
});

describe("La configuration du serveur", () => {
  it("n'est complète qu'avec les quatre valeurs", () => {
    expect(resolveMicrosoftConfig({})).toBeNull();
    expect(resolveMicrosoftConfig({ MICROSOFT_TENANT_ID: "t" })).toBeNull();
    expect(resolveMicrosoftConfig({
      MICROSOFT_TENANT_ID: "t", MICROSOFT_CLIENT_ID: "c",
      MICROSOFT_CLIENT_SECRET: "s", MICROSOFT_REDIRECT_URI: "https://x/cb",
    })).not.toBeNull();
  });

  it("nomme ce qui manque", () => {
    expect(missingMicrosoftVars({ MICROSOFT_TENANT_ID: "t" }))
      .toEqual(["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI"]);
  });

  it("retire une barre finale de l'URL de retour — Microsoft compare au caractère près", () => {
    const cfg = resolveMicrosoftConfig({
      MICROSOFT_TENANT_ID: "t", MICROSOFT_CLIENT_ID: "c", MICROSOFT_CLIENT_SECRET: "s",
      MICROSOFT_REDIRECT_URI: "https://x/cb/",
    });
    expect(cfg?.redirectUri).toBe("https://x/cb");
  });

  it("le drapeau et la liste pilote se lisent comme un humain les écrit", () => {
    expect(microsoftMailEnabled({ MICROSOFT_MAIL: "true" })).toBe(true);
    expect(microsoftMailEnabled({ MICROSOFT_MAIL: "0" })).toBe(false);
    expect(microsoftMailEnabled({})).toBe(false);
    expect(pilotMailboxes({ MICROSOFT_MAIL_PILOT: " A@B.fr , c@d.fr " })).toEqual(["a@b.fr", "c@d.fr"]);
    expect(pilotMailboxes({})).toEqual([]);
  });
});
