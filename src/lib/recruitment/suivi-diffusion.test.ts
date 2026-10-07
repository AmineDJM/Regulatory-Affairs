import { describe, it, expect } from "vitest";
import {
  abilities, completerJusquAuSommet, cibleDeLaDecision, decisionDuSommetExigeSuivi, refusDesignationDuSommet,
  suiveursAPrevenir, nettoyerIds, friseDuRecrutement, statutDuRecrutement,
  type ChainStep, type RecruitmentActor, type RecruitmentStage,
} from "./request-flow";
import {
  postLinkedInDeSecours, postLinkedInValide, motsDieseDeSecours, lienPartageLinkedIn, pastilleCanal,
  emploiticConfigure, LIMITE_POST_LINKEDIN, type ContenuPostLinkedIn,
} from "./diffusion";
import { recruitmentAccessFor } from "@/lib/rbac";

/**
 * LE RECRUTEMENT, MODULE À PART SOUS LES RH (Direction, 07/10) — les règles pures du lot :
 * n'importe qui demande, la chaîne monte jusqu'au DG, le DG qui conclut désigne le N+1 et le suivi, le suivi voit
 * et agit dans ses limites, les RH diffusent ; le post LinkedIn ne dit que ce que la demande porte.
 */

const step = (order: number, approverId: string, status: ChainStep["status"] = "PENDING"): ChainStep =>
  ({ order, approverId, approverName: approverId.toUpperCase(), status });
const actor = (over: Partial<RecruitmentActor> = {}): RecruitmentActor =>
  ({ userId: "me", isRequester: false, isHr: false, isTop: false, ...over });

describe("n'importe qui peut demander un recrutement", () => {
  it("sans département ni RH : VIEW + CREATE (+ sa fiche de poste), portée de ce dont on est partie", () => {
    const a = recruitmentAccessFor({ headsDepartment: false, rhCanUpdate: false });
    expect(a.actions).toEqual(expect.arrayContaining(["VIEW", "CREATE"]));
    expect(a.actions).not.toContain("UPDATE");
    expect(a.actions).not.toContain("DELETE");
    expect(a.scope).toBe("ASSIGNED");
  });
  it("les RH gardent le module entier, le chef de département son jeu plus large", () => {
    expect(recruitmentAccessFor({ headsDepartment: false, rhCanUpdate: true }).scope).toBe("ALL");
    expect(recruitmentAccessFor({ headsDepartment: true, rhCanUpdate: false }).actions).toContain("UPDATE");
  });
});

describe("la chaîne monte jusqu'au DG / Super Admin", () => {
  const sommets = [{ id: "dg", name: "DG" }, { id: "sa", name: "Super Admin" }];
  it("l'organigramme s'arrête avant le sommet : le DG est ajouté en dernière marche", () => {
    const c = completerJusquAuSommet([{ approverId: "n1", name: "N1", isTop: false }], sommets, "dem");
    expect(c.map((m) => m.approverId)).toEqual(["n1", "dg"]);
  });
  it("le sommet est déjà dans la chaîne : elle ne bouge pas", () => {
    const c = completerJusquAuSommet([{ approverId: "n1", name: "N1", isTop: false }, { approverId: "dir", name: "Dir", isTop: true }], sommets, "dem");
    expect(c.map((m) => m.approverId)).toEqual(["n1", "dir"]);
  });
  it("sans fiche employé (chaîne vide) : la demande part directement au DG", () => {
    expect(completerJusquAuSommet([], sommets, "dem").map((m) => m.approverId)).toEqual(["dg"]);
  });
  it("le DG qui demande ne se valide pas : le sommet suivant prend la marche", () => {
    expect(completerJusquAuSommet([], sommets, "dg").map((m) => m.approverId)).toEqual(["sa"]);
  });
  it("aucun sommet disponible : la chaîne reste ce qu'elle est (l'action refuse une chaîne vide)", () => {
    expect(completerJusquAuSommet([], [], "dem")).toEqual([]);
  });
});

describe("le DG qui conclut la chaîne désigne le N+1 et le suivi", () => {
  const chaine = [step(1, "n1"), step(2, "dg")];
  it("exigé du sommet quand SA validation envoie la demande aux RH — de sa marche ou d'en haut", () => {
    expect(decisionDuSommetExigeSuivi("CHAIN", chaine, { userId: "dg", isTop: true })).toBe(true);
    // Un autre membre du sommet, sans marche : il tranche la dernière, les autres passent « non consultées ».
    expect(decisionDuSommetExigeSuivi("CHAIN", chaine, { userId: "sa", isTop: true })).toBe(true);
    expect(cibleDeLaDecision(chaine, { userId: "sa", isTop: true })?.order).toBe(2);
  });
  it("jamais exigé du N+1 intermédiaire, ni hors de la chaîne", () => {
    expect(decisionDuSommetExigeSuivi("CHAIN", chaine, { userId: "n1", isTop: false })).toBe(false);
    expect(decisionDuSommetExigeSuivi("HR_REVIEW", chaine, { userId: "dg", isTop: true })).toBe(false);
  });
  it("le sommet qui a une marche INTERMÉDIAIRE ne conclut pas : rien à désigner", () => {
    const c = [step(1, "dg"), step(2, "pdg")];
    expect(decisionDuSommetExigeSuivi("CHAIN", c, { userId: "dg", isTop: true })).toBe(false);
  });
  it("le N+1 et au moins un suiveur, tous actifs — sinon le refus dit ce qui manque", () => {
    const actifs = new Set(["a", "b", "c"]);
    expect(refusDesignationDuSommet({ futureManagerId: null, followerIds: ["b"] }, actifs)).toMatch(/N\+1/);
    expect(refusDesignationDuSommet({ futureManagerId: "a", followerIds: [] }, actifs)).toMatch(/au moins une personne/);
    expect(refusDesignationDuSommet({ futureManagerId: "z", followerIds: ["b"] }, actifs)).toMatch(/pas un utilisateur actif/);
    expect(refusDesignationDuSommet({ futureManagerId: "a", followerIds: ["b", "z"] }, actifs)).toMatch(/suivi n'est pas un utilisateur actif/);
    expect(refusDesignationDuSommet({ futureManagerId: "a", followerIds: ["b", "c"] }, actifs)).toBeNull();
  });
  it("les identifiants désignés sont nettoyés : vides et doublons retirés", () => {
    expect(nettoyerIds(["a", " ", "b", "a", null, undefined])).toEqual(["a", "b"]);
  });
});

describe("le suivi désigné : voir, aider, être prévenu — sans trancher", () => {
  const suiveur = actor({ isFollower: true });
  it("en sourcing : il dépose des CV et consigne les entretiens", () => {
    const a = abilities("SOURCING", suiveur);
    expect(a.addCandidate).toBe(true);
    expect(a.interview).toBe(true);
    expect(a.comment).toBe(true);
  });
  it("il ne présélectionne pas, ne retient pas, ne recrute pas, n'instruit pas, ne diffuse pas", () => {
    const a = abilities("SOURCING", suiveur);
    expect([a.shortlist, a.select, a.hire, a.diffuse]).toEqual([false, false, false, false]);
    const h = abilities("HR_REVIEW", suiveur);
    expect([h.askInfo, h.openSourcing, h.hrReject, h.diffuse]).toEqual([false, false, false, false]);
  });
  it("une demande close : plus de fil, pour personne", () => {
    expect(abilities("CLOSED", suiveur).comment).toBe(false);
    expect(abilities("CLOSED", actor({ isHr: true })).comment).toBe(false);
  });
  it("qui n'est partie de rien n'écrit pas au fil", () => {
    expect(abilities("SOURCING", actor()).comment).toBe(false);
  });
  it("prévenus à côté du demandeur : une fois chacun, jamais l'auteur du geste", () => {
    expect(suiveursAPrevenir("n1", ["s1", "n1", "s2"], ["s2"])).toEqual(["n1", "s1"]);
    expect(suiveursAPrevenir(null, [], ["x"])).toEqual([]);
  });
});

describe("la diffusion appartient aux RH, une fois la demande validée", () => {
  it("chez les RH et poste ouvert : oui ; avant la validation ou après : non", () => {
    for (const s of ["HR_REVIEW", "SOURCING"] as RecruitmentStage[]) expect(abilities(s, actor({ isHr: true })).diffuse, s).toBe(true);
    for (const s of ["CHAIN", "INFO_REQUESTED", "RETURNED", "ONBOARDING", "CLOSED"] as RecruitmentStage[]) {
      expect(abilities(s, actor({ isHr: true, isTop: true })).diffuse, s).toBe(false);
    }
    expect(abilities("SOURCING", actor({ isRequester: true })).diffuse).toBe(false);
  });
  it("les pastilles : Préparé, Publié le …, Retiré, Échec", () => {
    expect(pastilleCanal("PREPARE", null).libelle).toBe("Préparé");
    expect(pastilleCanal("PUBLIE", "2026-10-07T10:00:00Z").libelle).toMatch(/^Publié le 7 oct/);
    expect(pastilleCanal("RETIRE", null).libelle).toBe("Retiré");
    expect(pastilleCanal("ECHEC", null).ton).toBe("danger");
  });
  it("Emploitic : « API à configurer » tant que la clé manque", () => {
    expect(emploiticConfigure({})).toBe(false);
    expect(emploiticConfigure({ EMPLOITIC_API_KEY: "  " })).toBe(false);
    expect(emploiticConfigure({ EMPLOITIC_API_KEY: "k" })).toBe(true);
  });
});

describe("le post LinkedIn — selon l'entité, sans rien inventer", () => {
  const c: ContenuPostLinkedIn = {
    societe: "Adventum Pharma", poste: "Délégué médical", departement: "Promotion médicale", lieu: "Oran",
    contrat: "CDI", resume: null, missions: ["Visiter les CHU de l'Ouest"], profil: ["Formation scientifique"],
    avantages: [], lien: "https://adventumdz.com/carrieres/delegue-medical",
  };

  it("le post de secours nomme la société, le poste, le lien, et porte 3 à 5 mots-dièse", () => {
    const t = postLinkedInDeSecours(c);
    expect(t).toContain("Adventum Pharma recrute : Délégué médical (CDI · Oran · Promotion médicale).");
    expect(t).toContain("• Visiter les CHU de l'Ouest");
    expect(t).toContain("Pour postuler : https://adventumdz.com/carrieres/delegue-medical");
    const h = motsDieseDeSecours(c);
    expect(h.length).toBeGreaterThanOrEqual(3);
    expect(h.length).toBeLessThanOrEqual(5);
    expect(h[0]).toBe("#DelegueMedical");
  });
  it("le post de secours ne parle jamais d'argent quand l'offre publiée n'en dit rien", () => {
    expect(postLinkedInDeSecours(c)).not.toMatch(/DZD|salaire|rémunération/i);
  });
  it("sans offre : pas de lien inventé", () => {
    expect(postLinkedInDeSecours({ ...c, lien: null })).not.toMatch(/https?:\/\//);
  });
  it("le post de Luna est retenu s'il tient ; le lien est ajouté s'il manque ; les mots-dièse vont en fin", () => {
    const t = postLinkedInValide({ texte: "Adventum Pharma renforce son équipe et recrute un Délégué médical à Oran. #Pharma", motsDiese: ["#Pharma", "Recrutement", "#Algerie"] }, c);
    expect(t).not.toBeNull();
    expect(t).toContain("Pour postuler : https://adventumdz.com/carrieres/delegue-medical");
    expect(t!.trim().endsWith("#Pharma #Recrutement #Algerie")).toBe(true);
    expect(t!.match(/#Pharma/g)).toHaveLength(1);
  });
  it("REPLI : un post qui invente une rémunération, oublie le poste, ou manque de mots-dièse est écarté", () => {
    expect(postLinkedInValide({ texte: "Adventum recrute un Délégué médical à Oran, salaire attractif de 120 000 DZD.", motsDiese: ["#a1", "#b2", "#c3"] }, c)).toBeNull();
    expect(postLinkedInValide({ texte: "Rejoignez une équipe formidable dans un secteur passionnant et d'avenir !", motsDiese: ["#a1", "#b2", "#c3"] }, c)).toBeNull();
    expect(postLinkedInValide({ texte: "Adventum Pharma recrute un Délégué médical à Oran pour l'Ouest.", motsDiese: ["#Pharma"] }, c)).toBeNull();
    expect(postLinkedInValide("texte brut", c)).toBeNull();
    expect(postLinkedInValide(null, c)).toBeNull();
  });
  it("la rémunération passe quand l'offre PUBLIÉE la porte", () => {
    const avec = { ...c, avantages: ["Rémunération : 120 000 DZD"] };
    expect(postLinkedInValide({ texte: "Adventum Pharma recrute un Délégué médical à Oran — rémunération 120 000 DZD.", motsDiese: ["#a1", "#b2", "#c3"] }, avec)).not.toBeNull();
  });
  it("le lien de partage encode le texte, et le post reste sous la limite", () => {
    expect(lienPartageLinkedIn("a & b")).toBe("https://www.linkedin.com/feed/?shareActive=true&text=a%20%26%20b");
    const long = postLinkedInDeSecours({ ...c, resume: "x".repeat(5000) });
    expect(long.length).toBeLessThanOrEqual(LIMITE_POST_LINKEDIN);
  });
});

describe("la frise et la phrase « état — chez qui »", () => {
  it("chaîne en cours : la marche active est courante, la suite à venir", () => {
    const f = friseDuRecrutement("CHAIN", [step(1, "n1", "APPROVED"), step(2, "dg")]);
    expect(f.map((e) => e.etat)).toEqual(["done", "done", "current", "todo", "todo", "todo", "todo"]);
  });
  it("poste ouvert : la chaîne et les RH sont faits, le poste ouvert est courant", () => {
    const f = friseDuRecrutement("SOURCING", [step(1, "dg", "APPROVED")]);
    expect(f.find((e) => e.cle === "ouvert")?.etat).toBe("current");
    expect(f.find((e) => e.cle === "rh")?.etat).toBe("done");
  });
  it("refusée par les RH : la case RH est rouge ; refusée dans la chaîne : la marche", () => {
    expect(friseDuRecrutement("REJECTED", [step(1, "dg", "APPROVED")]).find((e) => e.cle === "rh")?.etat).toBe("rejected");
    const parLaChaine = friseDuRecrutement("REJECTED", [step(1, "n1", "REJECTED")]);
    expect(parLaChaine.find((e) => e.cle === "m1")?.etat).toBe("rejected");
    expect(parLaChaine.find((e) => e.cle === "rh")?.etat).toBe("todo");
  });
  it("la phrase dit l'état et chez qui", () => {
    expect(statutDuRecrutement("CHAIN", { waitingOn: "Karim", requesterName: "Lina" }).phrase).toBe("Validation hiérarchique — chez Karim");
    expect(statutDuRecrutement("RETURNED", { waitingOn: null, requesterName: "Lina", aVous: true }).phrase).toBe("À corriger — à vous");
    expect(statutDuRecrutement("HR_REVIEW", { waitingOn: null, requesterName: "Lina" }).phrase).toBe("À instruire — chez les RH");
  });
});
