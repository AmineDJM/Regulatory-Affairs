import { describe, expect, it } from "vitest";
import {
  GRANULARITE_LABELS, GRANULARITES, HEURES_RAPPORT, JOURS_AVANT_ECHEANCE, JOURS_AVANT_ECHEANCE_MAX,
  REGLAGE_TOURNEE_DEFAUT, STATUT_PLAN_LABELS,
  VUE_LABELS, VUES, avancementTournee, bloquantsDeSoumission, debutDeSemaine, echeanceDeSoumission,
  enRetardDeSoumission, estGranularite, estVue, etatVisite, fenetreDeVue, fenetreRapport,
  gestesPossibles, limiteResoumission, periodeDe, periodeSuivante, reglageDepuisJson, retardDeSoumission,
  type EtatVisite, type VisiteComptable,
} from "./tournee";
import { estJourOuvre } from "@/lib/sfe-day";

const d = (iso: string) => new Date(iso);
const jourDe = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;

describe("la période planifiée — quatre mailles, et la semaine commence le DIMANCHE", () => {
  it("chaque maille porte un libellé français et « mensuelle » est le défaut de la demande", () => {
    for (const g of GRANULARITES) expect(GRANULARITE_LABELS[g].length).toBeGreaterThan(3);
    expect(estGranularite("MONTH")).toBe(true);
    expect(estGranularite("DECADE")).toBe(false);
  });

  it("LA SEMAINE COMMENCE LE DIMANCHE — sinon un plan hebdomadaire couvre deux semaines de terrain", () => {
    // La semaine ouvrée algérienne va du dimanche au jeudi. Le cas qui ferait tomber cette
    // assertion : `debutDeSemaine` calé sur le lundi — la semaine du plan couperait alors la
    // semaine de travail en deux, et le KAM planifierait à cheval sur deux plans.
    expect(jourDe(debutDeSemaine(d("2026-01-21T10:00:00")))).toBe("2026-01-18"); // mercredi → dimanche 18
    expect(debutDeSemaine(d("2026-01-18T23:00:00")).getDay()).toBe(0);
    // Un dimanche est déjà son propre début.
    expect(jourDe(debutDeSemaine(d("2026-01-18T00:30:00")))).toBe("2026-01-18");
  });

  it("une période INCLUT son dernier jour — 23:59:59, jamais minuit", () => {
    // Le cas qui la ferait tomber : une fin posée à minuit du dernier jour. Toutes les visites
    // du dernier jour de la période sortiraient du plan, en silence.
    const p = periodeDe("MONTH", d("2026-02-10T08:00:00"));
    expect(jourDe(p.debut)).toBe("2026-02-01");
    expect(jourDe(p.fin)).toBe("2026-02-28");
    expect(p.fin.getHours()).toBe(23);
  });

  it("trimestre et semestre s'alignent sur l'année civile", () => {
    expect(jourDe(periodeDe("QUARTER", d("2026-05-15T08:00:00")).debut)).toBe("2026-04-01");
    expect(jourDe(periodeDe("QUARTER", d("2026-05-15T08:00:00")).fin)).toBe("2026-06-30");
    expect(jourDe(periodeDe("HALF_YEAR", d("2026-08-02T08:00:00")).debut)).toBe("2026-07-01");
    expect(jourDe(periodeDe("HALF_YEAR", d("2026-08-02T08:00:00")).fin)).toBe("2026-12-31");
  });

  it("la période SUIVANTE franchit l'année sans se replier sur elle-même", () => {
    const p = periodeSuivante("MONTH", d("2026-12-20T08:00:00"));
    expect(jourDe(p.debut)).toBe("2027-01-01");
    expect(jourDe(p.fin)).toBe("2027-01-31");
  });
});

describe("l'échéance de soumission — AVANT que la période commence", () => {
  it("15 jours avant la fin du mois PRÉCÉDANT la période", () => {
    // LECTURE ASSUMÉE, écrite dans le module : l'autre lecture (15 j avant la fin du mois
    // PLANIFIÉ) placerait l'échéance au milieu de la période, et le KAM planifierait des
    // journées déjà passées. C'est le cas qui ferait tomber cette assertion — et il rendrait le
    // plan de tournée inutile, pas seulement décalé.
    const e = echeanceDeSoumission(d("2026-02-01T00:00:00"));
    // Fin janvier = 31 ; 31 − 15 = 16 janvier (vendredi 16/01/2026 → recule au jeudi 15).
    expect(e.getTime()).toBeLessThan(d("2026-02-01T00:00:00").getTime());
    expect(estJourOuvre(e), "une échéance ne tombe jamais un jour de week-end").toBe(true);
    expect(JOURS_AVANT_ECHEANCE).toBe(15);
  });

  it("une échéance qui tomberait un vendredi ou un samedi RECULE au jour ouvré", () => {
    // Sans ce recul, l'échéance se lirait comme un jour de grâce et se raterait.
    for (const mois of ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01",
      "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01"]) {
      const e = echeanceDeSoumission(d(`${mois}T00:00:00`));
      expect(estJourOuvre(e), `échéance pour ${mois}`).toBe(true);
      expect(e.getTime(), `échéance pour ${mois} avant la période`).toBeLessThan(d(`${mois}T00:00:00`).getTime());
    }
  });

  it("un plan encore en brouillon APRÈS son échéance est en retard — validé, il ne l'est plus", () => {
    const echeance = d("2026-01-15T23:59:59");
    expect(enRetardDeSoumission({ statut: "DRAFT", echeance, maintenant: d("2026-01-20T08:00:00") })).toBe(true);
    expect(enRetardDeSoumission({ statut: "REJECTED", echeance, maintenant: d("2026-01-20T08:00:00") })).toBe(true);
    // Ce qui la ferait tomber : juger le retard sur la seule date. Un plan SOUMIS le 14 et
    // décidé le 20 serait alors « en retard » alors que le KAM a tenu son délai — on punirait
    // le temps de décision de son manager.
    expect(enRetardDeSoumission({ statut: "SUBMITTED", echeance, maintenant: d("2026-01-20T08:00:00") })).toBe(false);
    expect(enRetardDeSoumission({ statut: "APPROVED", echeance, maintenant: d("2026-01-20T08:00:00") })).toBe(false);
    expect(enRetardDeSoumission({ statut: "DRAFT", echeance, maintenant: d("2026-01-10T08:00:00") })).toBe(false);
  });
});

describe("le réglage de la planification — lu UNE fois, sans jamais lever", () => {
  it("un JSON absent, d'une autre forme ou vide rend les défauts de la demande (mensuel, 15 j)", () => {
    for (const raw of [null, undefined, "MONTH", 42, [], {}]) expect(reglageDepuisJson(raw), String(raw)).toEqual(REGLAGE_TOURNEE_DEFAUT);
    expect(REGLAGE_TOURNEE_DEFAUT).toEqual({ granularite: "MONTH", joursAvant: 15 });
  });

  it("une maille et un délai valides sont lus tels quels", () => {
    expect(reglageDepuisJson({ granularity: "QUARTER", submissionLeadDays: 30 })).toEqual({ granularite: "QUARTER", joursAvant: 30 });
    expect(reglageDepuisJson({ granularity: "WEEK", submissionLeadDays: 0 })).toEqual({ granularite: "WEEK", joursAvant: 0 });
  });

  it("une valeur hors borne ou d'un autre type retombe sur le défaut de SON champ, pas des deux", () => {
    // Le cas qui ferait tomber : un lecteur qui « comble » — lire 90 quand la base porte 900
    // fabriquerait une politique que personne n'a choisie (§118.16) ; on rend le défaut que la
    // demande nomme, et seulement pour le champ illisible.
    expect(reglageDepuisJson({ granularity: "DECADE", submissionLeadDays: 30 })).toEqual({ granularite: "MONTH", joursAvant: 30 });
    expect(reglageDepuisJson({ granularity: "QUARTER", submissionLeadDays: 900 })).toEqual({ granularite: "QUARTER", joursAvant: 15 });
    expect(reglageDepuisJson({ granularity: "QUARTER", submissionLeadDays: -1 })).toEqual({ granularite: "QUARTER", joursAvant: 15 });
    expect(reglageDepuisJson({ granularity: "QUARTER", submissionLeadDays: "30" })).toEqual({ granularite: "QUARTER", joursAvant: 15 });
    expect(reglageDepuisJson({ granularity: "QUARTER", submissionLeadDays: 12.6 }).joursAvant).toBe(13);
    expect(JOURS_AVANT_ECHEANCE_MAX).toBe(90);
  });
});

describe("le retard de soumission — compté en jours, jamais sur un plan soumis", () => {
  it("un brouillon passé son échéance porte ses JOURS de retard (une heure entamée compte pour un jour)", () => {
    const echeance = d("2026-01-15T23:59:59");
    const r = retardDeSoumission({ statut: "DRAFT", echeance, maintenant: d("2026-01-20T08:00:00") });
    expect(r.enRetard).toBe(true);
    expect(r.jours).toBe(5);
    expect(r.echeance).toEqual(echeance);
    expect(retardDeSoumission({ statut: "DRAFT", echeance, maintenant: d("2026-01-16T01:00:00") }).jours).toBe(1);
    expect(retardDeSoumission({ statut: "DRAFT", echeance, maintenant: d("2026-01-10T08:00:00") })).toEqual({ echeance, enRetard: false, jours: 0 });
  });

  it("un plan REJETÉ se juge sur l'échéance de RESOUMISSION, pas sur la première", () => {
    // Le cas qui ferait tomber : garder la première échéance — un KAM qui vient de recevoir ses
    // corrections lirait « en retard de 20 jours » alors qu'il a 48 h devant lui.
    const premiere = d("2026-01-15T23:59:59");
    const resoumission = d("2026-02-06T10:00:00");
    expect(retardDeSoumission({ statut: "REJECTED", echeance: premiere, resoumissionAvant: resoumission, maintenant: d("2026-02-05T10:00:00") }))
      .toEqual({ echeance: resoumission, enRetard: false, jours: 0 });
    expect(retardDeSoumission({ statut: "REJECTED", echeance: premiere, resoumissionAvant: resoumission, maintenant: d("2026-02-07T10:00:00") }).jours).toBe(1);
    // Sans échéance de resoumission (jamais posée), la première reste la référence.
    expect(retardDeSoumission({ statut: "REJECTED", echeance: premiere, maintenant: d("2026-02-05T10:00:00") }).echeance).toEqual(premiere);
  });

  it("un plan SOUMIS, ESCALADÉ ou VALIDÉ n'est JAMAIS en retard — le temps de décision n'est pas celui du KAM", () => {
    // Et l'échéance de resoumission ne se substitue que sur un plan REJETÉ : sur un plan
    // resoumis, la décision précédente est effacée et l'on ne rejuge rien après coup.
    const echeance = d("2026-01-15T23:59:59");
    for (const statut of ["SUBMITTED", "ESCALATED", "APPROVED"] as const) {
      const r = retardDeSoumission({ statut, echeance, resoumissionAvant: d("2026-01-01T00:00:00"), maintenant: d("2026-03-01T00:00:00") });
      expect(r, statut).toEqual({ echeance, enRetard: false, jours: 0 });
    }
    // `enRetardDeSoumission` est le MÊME jugement, pas une seconde règle.
    expect(enRetardDeSoumission({ statut: "DRAFT", echeance, maintenant: d("2026-01-20T08:00:00") })).toBe(true);
    expect(enRetardDeSoumission({ statut: "REJECTED", echeance, resoumissionAvant: d("2026-01-25T00:00:00"), maintenant: d("2026-01-20T08:00:00") })).toBe(false);
  });
});

describe("les 48 heures — le rapport terrain, et la resoumission", () => {
  it("la fenêtre est de 48 h et les heures RESTANTES voyagent avec la réponse", () => {
    // Un refus qui dit seulement « trop tard » fait découvrir la borne au moment où l'on ne
    // peut plus rien (§118.30).
    const visite = d("2026-01-10T09:00:00");
    const f = fenetreRapport(visite, d("2026-01-11T09:00:00"));
    expect(f.ouvert).toBe(true);
    expect(f.heuresRestantes).toBe(24);
    expect(HEURES_RAPPORT).toBe(48);
  });

  it("à la 49ᵉ heure c'est fermé, et il reste ZÉRO heure — jamais un négatif", () => {
    const visite = d("2026-01-10T09:00:00");
    const f = fenetreRapport(visite, d("2026-01-12T10:00:00"));
    expect(f.ouvert).toBe(false);
    expect(f.heuresRestantes).toBe(0);
  });

  it("la limite de resoumission est 48 h après le REJET, pas après la visite", () => {
    expect(limiteResoumission(d("2026-01-10T09:00:00")).toISOString())
      .toBe(d("2026-01-12T09:00:00").toISOString());
  });
});

describe("l'état d'une visite — TROIS états, pas deux", () => {
  const base = { date: d("2026-01-10T09:00:00"), maintenant: d("2026-01-10T18:00:00") };

  it("grise tant que le rapport n'est pas fait, verte après", () => {
    expect(etatVisite({ ...base, statut: "PLANNED", rapportFait: false })).toBe("A_FAIRE");
    expect(etatVisite({ ...base, statut: "PLANNED", rapportFait: true })).toBe("FAITE");
    expect(etatVisite({ ...base, statut: "COMPLETED", rapportFait: false })).toBe("FAITE");
  });

  it("PERDUE quand les 48 h sont passées sans rapport — ni grise, ni verte", () => {
    // Le cas que deux états seuls ne peuvent pas dire : une visite du 10 sans rapport le 20
    // n'est plus « en attente », il n'y a plus rien à rattraper. La laisser grise ferait lire un
    // retard rattrapable là où le mois est déjà entamé.
    expect(etatVisite({ ...base, statut: "PLANNED", rapportFait: false, maintenant: d("2026-01-20T08:00:00") }))
      .toBe("PERDUE");
  });

  it("une visite ANNULÉE ou REPORTÉE n'est pas perdue — quelqu'un l'a DIT", () => {
    expect(etatVisite({ ...base, statut: "CANCELLED", rapportFait: false, maintenant: d("2026-02-01T08:00:00") }))
      .toBe("ANNULEE");
    expect(etatVisite({ ...base, statut: "POSTPONED", rapportFait: false, maintenant: d("2026-02-01T08:00:00") }))
      .toBe("REPORTEE");
  });
});

describe("l'avancement — UN dénominateur, et quatre façons de mentir refusées", () => {
  const v = (etat: EtatVisite, imprevue = false): VisiteComptable => ({ etat, imprevue });

  it("« visitées / planifiées » compte les PRÉVUES au dénominateur", () => {
    const a = avancementTournee([v("FAITE"), v("FAITE"), v("A_FAIRE"), v("PERDUE")]);
    expect(a.planifiees).toBe(4);
    expect(a.visitees).toBe(2);
    expect(a.aFaire).toBe(1);
    expect(a.perdues).toBe(1);
    expect(a.tauxRealisation).toBe(50);
  });

  it("une visite IMPRÉVUE compte au RÉALISÉ, jamais au prévu", () => {
    // Le cas qui la ferait tomber : compter l'imprévue au dénominateur — le taux dépasserait
    // 100 % et la planification deviendrait illisible.
    const a = avancementTournee([v("FAITE"), v("FAITE", true), v("FAITE", true)]);
    expect(a.planifiees).toBe(1);
    expect(a.visitees).toBe(1);
    expect(a.imprevues).toBe(2);
    expect(a.tauxRealisation).toBe(100);
    // « LE NOMBRE DE VISITES » que la Direction demande : tout ce qui a été réellement fait.
    expect(a.visitesTotales).toBe(3);
  });

  it("les ANNULÉES sortent du dénominateur — et le compte le DIT", () => {
    // Les garder punirait un KAM pour une visite que son manager a décommandée ; les retirer
    // SANS le dire ferait disparaître le fait.
    const a = avancementTournee([v("FAITE"), v("ANNULEE"), v("REPORTEE")]);
    expect(a.planifiees).toBe(1);
    expect(a.ecartees).toBe(2);
    expect(a.tauxRealisation).toBe(100);
  });

  it("ZÉRO planifiée rend 0 %, jamais 100 % — « rien à faire donc tout est fait » est un faux succès", () => {
    const a = avancementTournee([]);
    expect(a.planifiees).toBe(0);
    expect(a.tauxRealisation).toBe(0);
    expect(a.visitesTotales).toBe(0);
  });

  it("une imprévue NON rapportée ne gonfle pas le nombre de visites", () => {
    const a = avancementTournee([v("A_FAIRE", true), v("PERDUE", true)]);
    expect(a.imprevues).toBe(2);
    expect(a.visitesTotales).toBe(0);
  });
});

describe("les quatre vues de l'emploi du temps", () => {
  it("Aujourd'hui / Demain / Cette semaine / Ce mois-ci — exactement celles de la demande", () => {
    expect(VUES.map((x) => VUE_LABELS[x])).toEqual(["Aujourd'hui", "Demain", "Cette semaine", "Ce mois-ci"]);
    expect(estVue("SEMAINE")).toBe(true);
    expect(estVue("TRIMESTRE")).toBe(false);
  });

  it("chaque vue borne un intervalle qui CONTIENT ce qu'elle annonce", () => {
    const maintenant = d("2026-01-21T14:00:00"); // mercredi
    const auj = fenetreDeVue("AUJOURD_HUI", maintenant);
    expect(jourDe(auj.debut)).toBe("2026-01-21");
    expect(jourDe(auj.fin)).toBe("2026-01-21");
    const dem = fenetreDeVue("DEMAIN", maintenant);
    expect(jourDe(dem.debut)).toBe("2026-01-22");
    const sem = fenetreDeVue("SEMAINE", maintenant);
    expect(jourDe(sem.debut)).toBe("2026-01-18"); // dimanche
    expect(jourDe(sem.fin)).toBe("2026-01-24");
    const mois = fenetreDeVue("MOIS", maintenant);
    expect(jourDe(mois.debut)).toBe("2026-01-01");
    expect(jourDe(mois.fin)).toBe("2026-01-31");
  });

  it("« Demain » franchit la fin de mois", () => {
    const dem = fenetreDeVue("DEMAIN", d("2026-01-31T20:00:00"));
    expect(jourDe(dem.debut)).toBe("2026-02-01");
  });
});

describe("le circuit de validation — deux étages, et un plan validé ne bouge plus", () => {
  it("chaque statut porte un libellé, et l'escalade est un état À PART", () => {
    for (const s of ["DRAFT", "SUBMITTED", "ESCALATED", "APPROVED", "REJECTED"] as const) {
      expect(STATUT_PLAN_LABELS[s].length).toBeGreaterThan(3);
    }
  });

  it("UN PLAN VALIDÉ NE SE MODIFIE PLUS — sa tournée est partie chez le KAM", () => {
    // Ce qui la ferait tomber : rendre `APPROVED` modifiable. On changerait la tournée d'un KAM
    // sous ses pieds, c'est-à-dire exactement ce qu'un plan validé doit empêcher.
    expect(gestesPossibles("APPROVED").modifiable).toBe(false);
    expect(gestesPossibles("SUBMITTED").modifiable).toBe(false);
    expect(gestesPossibles("DRAFT").modifiable).toBe(true);
    expect(gestesPossibles("REJECTED").modifiable, "un rejet REND la main au KAM").toBe(true);
  });

  it("ON N'ESCALADE QU'UNE FOIS — un plan chez le N+2 ne remonte pas au N+3", () => {
    expect(gestesPossibles("SUBMITTED").escaladable).toBe(true);
    expect(gestesPossibles("ESCALATED").escaladable).toBe(false);
    // Mais le N+2 DÉCIDE : sans cela le plan attendrait une décision de personne.
    expect(gestesPossibles("ESCALATED").decidable).toBe(true);
  });

  it("un plan décidé ne se re-décide pas", () => {
    expect(gestesPossibles("APPROVED").decidable).toBe(false);
    expect(gestesPossibles("REJECTED").decidable).toBe(false);
    expect(gestesPossibles("DRAFT").decidable).toBe(false);
  });
});

describe("ce qui manque pour soumettre — dit EN UNE FOIS", () => {
  it("un plan VIDE ne se soumet pas, et la raison le dit", () => {
    const b = bloquantsDeSoumission({ statut: "DRAFT", nbVisites: 0, nbHorsJoursOuvres: 0, nbHorsPeriode: 0 });
    expect(b.length).toBe(1);
    expect(b[0]).toContain("Aucune visite");
  });

  it("TOUS les bloquants arrivent ensemble — jamais un aller-retour par défaut", () => {
    // §118.18 : un refus par champ ferait ressaisir un plan de quarante visites autant de fois
    // qu'il a de défauts.
    const b = bloquantsDeSoumission({ statut: "APPROVED", nbVisites: 0, nbHorsJoursOuvres: 2, nbHorsPeriode: 1 });
    expect(b.length).toBe(4);
    expect(b.join(" ")).toContain("vendredi");
    expect(b.join(" ")).toContain("hors de la période");
  });

  it("un plan complet ne rend AUCUN bloquant", () => {
    expect(bloquantsDeSoumission({ statut: "DRAFT", nbVisites: 12, nbHorsJoursOuvres: 0, nbHorsPeriode: 0 })).toEqual([]);
  });
});
