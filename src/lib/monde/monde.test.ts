import { describe, expect, it } from "vitest";

import {
  chevauche, contient, direIntervalle, dureeJours, fermerIntervalles, intersection, trancheA,
} from "@/lib/monde/temps";
import {
  auMoment, changements, chronologie, connuA, contradictions, couverture, etatA, historique,
  valideA, type Fait,
} from "@/lib/monde/faits";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE CES TESTS TIENNENT (mandat 6 §45).
 *
 *   1. « QUI ÉTAIT RESPONSABLE AU MOMENT DE CETTE DÉCISION ? » rend la personne de L'ÉPOQUE, pas
 *      celle d'aujourd'hui. Le jour où cette fonction rendra la valeur courante, tout audit
 *      rétrospectif de l'entreprise deviendra faux, et il aura l'air juste.
 *   2. LE TEMPS DE VALIDITÉ ET LE TEMPS DE CONSTAT NE SE CONFONDENT PAS. Une passation saisie en
 *      retard change ce qui était VRAI sans changer ce qu'on SAVAIT ; les deux réponses sont
 *      légitimes, et elles diffèrent.
 *   3. NE PAS SAVOIR EST UNE RÉPONSE. Un champ jamais journalisé n'a pas d'histoire, et le
 *      modèle le dit au lieu de propager l'état actuel vers le passé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const d = (s: string): Date => new Date(`${s}T00:00:00.000Z`);

const fait = (o: Partial<Fait> & { sujet: string; predicat: string; objet: string }): Fait => ({
  sujetLibelle: o.sujet, depuis: null, jusqua: null, constateLe: o.depuis ?? d("2026-01-01"),
  source: "test", acteur: null, confiance: 1, ...o,
});

describe("monde — l'algèbre du temps", () => {
  it("la borne de début est INCLUSE, celle de fin EXCLUE — sinon deux réponses au même jour", () => {
    const i = { depuis: d("2026-01-01"), jusqua: d("2026-07-01") };
    expect(contient(i, d("2026-01-01"))).toBe(true);
    expect(contient(i, d("2026-06-30"))).toBe(true);
    expect(contient(i, d("2026-07-01"))).toBe(false);
  });

  it("une borne ouverte est INCONNUE, pas infinie — la durée reste nulle", () => {
    expect(dureeJours({ depuis: d("2026-01-01"), jusqua: d("2026-01-31") })).toBe(30);
    expect(dureeJours({ depuis: null, jusqua: d("2026-01-31") })).toBeNull();
    expect(dureeJours({ depuis: d("2026-01-01"), jusqua: null })).toBeNull();
    // …sauf si l'on demande explicitement le temps ÉCOULÉ, ce qui est une autre question.
    expect(dureeJours({ depuis: d("2026-01-01"), jusqua: null }, d("2026-01-11"))).toBe(10);
    expect(direIntervalle({ depuis: null, jusqua: null })).toBe("période inconnue");
  });

  it("chevauchement et intersection", () => {
    const a = { depuis: d("2026-01-01"), jusqua: d("2026-06-01") };
    const b = { depuis: d("2026-05-01"), jusqua: d("2026-09-01") };
    expect(chevauche(a, b)).toBe(true);
    expect(intersection(a, b)).toEqual({ depuis: d("2026-05-01"), jusqua: d("2026-06-01") });
    expect(chevauche(a, { depuis: d("2026-06-01"), jusqua: null })).toBe(false);
    expect(intersection(a, { depuis: d("2026-06-01"), jusqua: null })).toBeNull();
  });

  it("ferme les intervalles d'un journal de changements — c'est là qu'est l'histoire", () => {
    // Le journal dit « responsable : Yassine → Nesrine, le 1er juillet ». L'histoire complète
    // exige la valeur d'AVANT (dans `oldValue`) et la date de création de l'entité.
    const tranches = fermerIntervalles(
      [{ valeur: "Nesrine", quand: d("2026-07-01"), source: "AuditLog#2", acteur: "PDG" }],
      { debut: d("2026-01-01"), valeurInitiale: "Yassine", sourceInitiale: "AuditLog#2 (oldValue)" },
    );
    expect(tranches).toHaveLength(2);
    expect(tranches[0]).toMatchObject({ valeur: "Yassine", depuis: d("2026-01-01"), jusqua: d("2026-07-01") });
    expect(tranches[1]).toMatchObject({ valeur: "Nesrine", depuis: d("2026-07-01"), jusqua: null, acteur: "PDG" });
    expect(trancheA(tranches, d("2026-03-15"))?.valeur).toBe("Yassine");
    expect(trancheA(tranches, d("2026-08-15"))?.valeur).toBe("Nesrine");
    // Avant le début connu : AUCUNE tranche. Le modèle ne prolonge pas l'histoire vers l'arrière.
    expect(trancheA(tranches, d("2025-12-01"))).toBeNull();
  });

  it("sans valeur initiale, l'histoire commence au premier changement et ne prétend rien avant", () => {
    const tranches = fermerIntervalles([{ valeur: "INSTRUIT", quand: d("2026-04-01"), source: "AuditLog#9" }]);
    expect(tranches).toHaveLength(1);
    expect(tranches[0]!.depuis).toEqual(d("2026-04-01"));
    expect(trancheA(tranches, d("2026-02-01"))).toBeNull();
  });
});

describe("monde — la vérité temporelle", () => {
  const DOSSIER = "REGULATORY_PRODUCT:p1";
  const faits: Fait[] = [
    fait({ sujet: DOSSIER, sujetLibelle: "Dossier Trastuzumab", predicat: "responsable", objet: "Yassine Belkacem", depuis: d("2026-01-01"), jusqua: d("2026-07-01"), source: "AuditLog#2", constateLe: d("2026-01-01") }),
    // LA PASSATION A ÉTÉ SAISIE EN RETARD : vraie depuis le 1er juillet, connue le 21 seulement.
    fait({ sujet: DOSSIER, sujetLibelle: "Dossier Trastuzumab", predicat: "responsable", objet: "Nesrine Haddad", depuis: d("2026-07-01"), jusqua: null, source: "AuditLog#2", constateLe: d("2026-07-21"), acteur: "PDG" }),
    fait({ sujet: DOSSIER, sujetLibelle: "Dossier Trastuzumab", predicat: "statut", objet: "DEPOSE", depuis: d("2026-01-01"), jusqua: d("2026-04-10"), source: "AuditLog#5", constateLe: d("2026-01-01") }),
    fait({ sujet: DOSSIER, sujetLibelle: "Dossier Trastuzumab", predicat: "statut", objet: "INSTRUIT", depuis: d("2026-04-10"), jusqua: null, source: "AuditLog#5", constateLe: d("2026-04-10") }),
    fait({ sujet: DOSSIER, sujetLibelle: "Dossier Trastuzumab", predicat: "prix", objet: "18500 DZD", depuis: d("2026-02-01"), jusqua: null, source: "ERP:RegulatoryProduct.price", constateLe: d("2026-02-01"), confiance: 0.8 }),
  ];

  it("« qui était responsable au moment de cette décision ? » rend la personne de L'ÉPOQUE", () => {
    const decision = d("2026-03-15");
    expect(auMoment(faits, DOSSIER, "responsable", decision)?.objet).toBe("Yassine Belkacem");
    // Aujourd'hui, c'est quelqu'un d'autre — et c'est bien pour cela que la question se pose.
    expect(auMoment(faits, DOSSIER, "responsable", d("2026-09-01"))?.objet).toBe("Nesrine Haddad");
    // Avant tout ce que le journal connaît : personne. Pas « le plus ancien connu ».
    expect(auMoment(faits, DOSSIER, "responsable", d("2025-06-01"))).toBeNull();
  });

  it("ce qui était VRAI et ce qu'on SAVAIT ne se confondent pas", () => {
    const le5juillet = d("2026-07-05");
    // Vrai ce jour-là : Nesrine est déjà responsable.
    expect(valideA(faits, le5juillet).find((f) => f.predicat === "responsable")?.objet).toBe("Nesrine Haddad");
    // Mais personne ne le savait encore : la passation n'a été saisie que le 21.
    expect(connuA(faits, le5juillet).find((f) => f.predicat === "responsable")).toBeUndefined();
    // Et le 25, on le sait.
    expect(connuA(faits, d("2026-07-25")).find((f) => f.predicat === "responsable")?.objet).toBe("Nesrine Haddad");
  });

  it("« qu'est-ce qui a changé depuis mars ? » rend l'avant ET l'après", () => {
    const ch = changements(faits, d("2026-03-01"), d("2026-08-01"));
    const statut = ch.find((c) => c.predicat === "statut");
    expect(statut).toMatchObject({ avant: "DEPOSE", apres: "INSTRUIT" });
    const resp = ch.find((c) => c.predicat === "responsable");
    expect(resp).toMatchObject({ avant: "Yassine Belkacem", apres: "Nesrine Haddad", acteur: "PDG" });
    // Rien d'antérieur à la fenêtre ne remonte : le prix date de février.
    expect(ch.some((c) => c.predicat === "prix")).toBe(false);
    // Le plus récent d'abord — c'est l'ordre dans lequel on lit un « quoi de neuf ».
    expect(ch[0]!.quand.getTime()).toBeGreaterThanOrEqual(ch[ch.length - 1]!.quand.getTime());
  });

  it("l'état à une date ne complète JAMAIS les trous par la valeur d'aujourd'hui", () => {
    const e = etatA(faits, DOSSIER, d("2026-01-15"));
    expect(e.valeurs.responsable).toBe("Yassine Belkacem");
    expect(e.valeurs.statut).toBe("DEPOSE");
    // Le prix n'existe pas encore à cette date : il est INCONNU, pas « 18500 ».
    expect(e.valeurs.prix).toBeUndefined();
    expect(e.inconnus).toContain("prix");
    expect(e.sources.statut).toBe("AuditLog#5");
  });

  it("un relevé de valeur COURANTE ne se rétro-projette pas dans le passé", () => {
    // Un champ que rien ne journalise : on sait ce qu'il vaut AUJOURD'HUI, pas depuis quand.
    const avec: Fait[] = [...faits, fait({
      sujet: DOSSIER, predicat: "fabrication", objet: "EN_COURS",
      depuis: null, jusqua: null, constateLe: d("2026-09-06"),
      histoire: "COURANTE", source: "ERP:RegulatoryProduct.manufacturingStatus (non journalisé)", confiance: 0.7,
    })];
    // Aujourd'hui : la valeur est connue.
    expect(auMoment(avec, DOSSIER, "fabrication", d("2026-09-10"))?.objet).toBe("EN_COURS");
    // En mars : INCONNUE. Répondre « EN_COURS » serait inventer une histoire à un champ qui n'en a pas.
    expect(auMoment(avec, DOSSIER, "fabrication", d("2026-03-01"))).toBeNull();
    expect(etatA(avec, DOSSIER, d("2026-03-01")).inconnus).toContain("fabrication");
    expect(valideA(avec, d("2026-03-01")).some((f) => f.predicat === "fabrication")).toBe(false);
    expect(couverture(avec).sansHistoire).toContain("fabrication");
  });

  it("la couverture dit ce qui a une histoire et ce qui n'en a pas", () => {
    const c = couverture(faits);
    expect(c.journalises).toContain("responsable");
    expect(c.journalises).toContain("statut");
    // Le prix n'a qu'une seule valeur connue : pas d'histoire, et c'est DIT.
    expect(c.sansHistoire).toContain("prix");
    expect(c.depuis).toEqual(d("2026-01-01"));
    expect(c.faits).toBe(5);
  });

  it("l'histoire se lit dans l'ordre, avec ses sources", () => {
    const h = historique(faits, DOSSIER, "responsable");
    expect(h.map((f) => f.objet)).toEqual(["Yassine Belkacem", "Nesrine Haddad"]);
    const chrono = chronologie(faits, DOSSIER);
    expect(chrono[0]!.quand).toEqual(d("2026-01-01"));
    expect(chrono.every((x) => x.source.length > 0)).toBe(true);
  });

  it("deux valeurs pour la même propriété au même moment sont une CONTRADICTION — et seulement pour les prédicats fonctionnels", () => {
    const doubles: Fait[] = [
      ...faits,
      // Un second responsable qui recouvre la période de Yassine : impossible.
      fait({ sujet: DOSSIER, predicat: "responsable", objet: "Khaled Meziane", depuis: d("2026-03-01"), jusqua: d("2026-05-01"), source: "import RH", constateLe: d("2026-08-01") }),
      // Deux rattachements simultanés : parfaitement normal, ce n'est pas fonctionnel.
      fait({ sujet: DOSSIER, predicat: "rattache_a", objet: "Adventum", depuis: d("2026-01-01") }),
      fait({ sujet: DOSSIER, predicat: "rattache_a", objet: "Projet AO 2027", depuis: d("2026-01-01") }),
    ];
    const c = contradictions(doubles, new Set(["responsable", "statut", "prix"]));
    expect(c).toHaveLength(1);
    expect(c[0]!.predicat).toBe("responsable");
    expect(c[0]!.faits.map((f) => f.objet).sort()).toEqual(["Khaled Meziane", "Yassine Belkacem"]);
    // La recommandation cite la constatation la plus RÉCENTE — sans trancher à la place de §46.
    expect(c[0]!.suite).toContain("Khaled Meziane");
    expect(c[0]!.periode).toContain("2026-03-01");
  });

  it("aucune contradiction quand les périodes se succèdent proprement", () => {
    expect(contradictions(faits, new Set(["responsable", "statut", "prix"]))).toEqual([]);
  });
});
