import { describe, expect, it } from "vitest";
import type { Regle, Sujet } from "@/lib/teach/model";
import { cleDe, comparerPrecedence, conflitsAvecExistantes, estApplicable, resoudre } from "@/lib/teach/resolve";

let n = 0;
const regle = (r: Partial<Regle> & Pick<Regle, "kind" | "scope" | "statement">): Regle => ({
  id: r.id ?? `r${++n}`,
  kind: r.kind, scope: r.scope, statement: r.statement,
  ownerId: r.ownerId ?? "amine",
  subjectUserId: r.subjectUserId ?? (r.scope === "PERSON" ? "amine" : null),
  companyId: r.companyId ?? (r.scope === "COMPANY" ? "adventum" : null),
  departmentId: r.departmentId ?? (r.scope === "GROUP" ? "finance-dept" : null),
  domain: r.domain ?? "general",
  title: r.title ?? r.statement.slice(0, 40),
  params: r.params ?? null,
  priority: r.priority ?? 0,
  effectiveFrom: r.effectiveFrom ?? new Date("2026-01-01T00:00:00Z"),
  effectiveTo: r.effectiveTo ?? null,
  status: r.status ?? "ACTIVE",
  version: r.version ?? 1,
  supersedesId: r.supersedesId ?? null,
  provenance: r.provenance ?? null,
  createdAt: r.createdAt ?? new Date("2026-01-01T00:00:00Z"),
});
const sujet: Sujet = { userId: "amine", companyIds: ["adventum"], departmentIds: ["finance-dept", "direction"], maintenant: new Date("2026-09-05T10:00:00Z") };

describe("l'applicabilité — statut, dates, périmètre", () => {
  it("écarte inactive, future, expirée, autre personne, autre société, autre département", () => {
    expect(estApplicable(regle({ kind: "PREFERENCE", scope: "PERSON", statement: "x" }), sujet)).toBe(true);
    expect(estApplicable(regle({ kind: "PREFERENCE", scope: "PERSON", statement: "x", status: "DISABLED" }), sujet)).toBe(false);
    expect(estApplicable(regle({ kind: "PREFERENCE", scope: "PERSON", statement: "x", effectiveFrom: new Date("2026-10-01") }), sujet)).toBe(false);
    expect(estApplicable(regle({ kind: "PREFERENCE", scope: "PERSON", statement: "x", effectiveTo: new Date("2026-09-01") }), sujet)).toBe(false);
    expect(estApplicable(regle({ kind: "PREFERENCE", scope: "PERSON", statement: "x", subjectUserId: "khaled" }), sujet)).toBe(false);
    expect(estApplicable(regle({ kind: "COMPANY_RULE", scope: "COMPANY", statement: "x", companyId: "pharmagene" }), sujet)).toBe(false);
    expect(estApplicable(regle({ kind: "COMPANY_RULE", scope: "COMPANY", statement: "x", companyId: null }), sujet)).toBe(true); // commune au groupe
    expect(estApplicable(regle({ kind: "CONVENTION", scope: "GROUP", statement: "x", departmentId: "rh" }), sujet)).toBe(false);
    expect(estApplicable(regle({ kind: "CONVENTION", scope: "GROUP", statement: "x", departmentId: "direction" }), sujet)).toBe(true);
  });
});

describe("la précédence — écrite, pas devinée", () => {
  it("une règle CONTRAIGNANTE de société l'emporte sur une préférence personnelle de même clé", () => {
    const societe = regle({ kind: "VALIDATION_RULE", scope: "COMPANY", statement: "Toute facture > 500 000 DZD passe par le PDG", params: { cle: "seuilFacture" } });
    const perso = regle({ kind: "PREFERENCE", scope: "PERSON", statement: "Je préfère envoyer mes factures directement", params: { cle: "seuilFacture" } });
    const r = resoudre([perso, societe], sujet);
    expect(r.enVigueur).toEqual([societe]);
    expect(r.ecartees[0]).toMatchObject({ regle: perso, par: societe, raison: expect.stringMatching(/contraignante/) });
    expect(r.conflits).toEqual([]);
  });

  it("une convention PERSONNELLE précise une convention de société de même clé", () => {
    const societe = regle({ kind: "CONVENTION", scope: "COMPANY", statement: "Les dates s'écrivent dd/mm/aaaa", params: { cle: "formatDate" } });
    const perso = regle({ kind: "CONVENTION", scope: "PERSON", statement: "Pour moi, les dates en toutes lettres", params: { cle: "formatDate" } });
    const r = resoudre([societe, perso], sujet);
    expect(r.enVigueur).toEqual([perso]);
    expect(r.ecartees[0].raison).toMatch(/plus étroit/);
  });

  it("une exception l'emporte sur la règle qu'elle vise, par identifiant ou par clé", () => {
    const base = regle({ id: "base", kind: "COMPANY_RULE", scope: "COMPANY", statement: "Les devis sont valables 30 jours", params: { cle: "validiteDevis", valeur: 30 } });
    const exception = regle({ kind: "EXCEPTION", scope: "PERSON", statement: "Sauf pour les hôpitaux : 90 jours", params: { exceptionDe: "validiteDevis" } });
    const r = resoudre([base, exception], sujet);
    expect(r.enVigueur).toEqual([exception]);
    expect(r.ecartees[0].raison).toBe("une exception la vise");
    const parId = regle({ kind: "EXCEPTION", scope: "PERSON", statement: "Sauf le CHU", params: { exceptionDe: "base" } });
    expect(resoudre([base, parId], sujet).enVigueur).toEqual([parId]);
  });

  it("à périmètre égal : la priorité, puis la plus récente ; deux égales et différentes = conflit DIT", () => {
    const a = regle({ kind: "CONVENTION", scope: "PERSON", statement: "A", params: { cle: "k" }, priority: 1 });
    const b = regle({ kind: "CONVENTION", scope: "PERSON", statement: "B", params: { cle: "k" }, priority: 0, effectiveFrom: new Date("2026-06-01") });
    expect(resoudre([b, a], sujet).enVigueur).toEqual([a]);
    const c = regle({ kind: "CONVENTION", scope: "PERSON", statement: "C", params: { cle: "k2" }, effectiveFrom: new Date("2026-03-01") });
    const d = regle({ kind: "CONVENTION", scope: "PERSON", statement: "D", params: { cle: "k2" }, effectiveFrom: new Date("2026-05-01") });
    expect(resoudre([c, d], sujet).enVigueur).toEqual([d]);
    const e = regle({ kind: "CONVENTION", scope: "PERSON", statement: "E", params: { cle: "k3" } });
    const f = regle({ kind: "CONVENTION", scope: "PERSON", statement: "F", params: { cle: "k3" } });
    const r = resoudre([e, f], sujet);
    expect(r.enVigueur).toHaveLength(1);
    expect(r.conflits).toEqual([{ cle: "general:k3", regles: expect.arrayContaining([e, f]), indecidable: true }]);
    expect(comparerPrecedence(e, f)).toBe(0);
  });

  it("des clés différentes ne se gênent pas, et la lecture met les contraintes de société en tête", () => {
    const p = regle({ kind: "PREFERENCE", scope: "PERSON", statement: "Synthèses en trois points" });
    const s = regle({ kind: "COMPANY_RULE", scope: "COMPANY", statement: "Toute dépense > 50 000 passe au centre de paiement" });
    const g = regle({ kind: "CONVENTION", scope: "GROUP", statement: "Les notes de frais se déposent le vendredi" });
    const r = resoudre([p, g, s], sujet);
    expect(r.enVigueur.map((x) => x.id)).toEqual([s.id, g.id, p.id]);
    expect(r.ecartees).toEqual([]);
  });

  it("la clé : `params.cle`, sinon `params.de`, sinon l'intitulé normalisé — domaine compris", () => {
    expect(cleDe(regle({ kind: "MAPPING", scope: "PERSON", statement: "x", params: { de: "La DT", vers: "Direction technique" } }))).toBe("general:de:la dt");
    expect(cleDe(regle({ kind: "CONVENTION", scope: "PERSON", statement: "x", title: "Format des dates !", domain: "documents" }))).toBe("documents:convention:format des dates");
  });
});

describe("les conflits avant d'écrire", () => {
  it("trouve la règle ACTIVE de même clé, même périmètre, même sujet, au texte différent — et elle seule", () => {
    const existante = regle({ kind: "DOCUMENT_STANDARD", scope: "COMPANY", statement: "Les devis sont valables 30 jours", params: { cle: "validiteDevis", valeur: 30 } });
    const autreSociete = regle({ kind: "DOCUMENT_STANDARD", scope: "COMPANY", statement: "60 jours", params: { cle: "validiteDevis" }, companyId: "pharmagene" });
    const inactive = regle({ kind: "DOCUMENT_STANDARD", scope: "COMPANY", statement: "15 jours", params: { cle: "validiteDevis" }, status: "SUPERSEDED" });
    const identique = regle({ kind: "DOCUMENT_STANDARD", scope: "COMPANY", statement: "Les devis sont valables 45 jours", params: { cle: "validiteDevis" } });
    const nouvelle = { ...regle({ kind: "DOCUMENT_STANDARD", scope: "COMPANY", statement: "Les devis sont valables 45 jours", params: { cle: "validiteDevis", valeur: 45 } }) };
    expect(conflitsAvecExistantes(nouvelle, [existante, autreSociete, inactive, identique])).toEqual([existante]);
  });
});

describe("l'échelle", () => {
  it("résout mille règles en moins de 50 ms", () => {
    const regles: Regle[] = [];
    for (let i = 0; i < 1000; i += 1) {
      regles.push(regle({
        kind: i % 3 === 0 ? "COMPANY_RULE" : i % 3 === 1 ? "CONVENTION" : "PREFERENCE",
        scope: i % 3 === 0 ? "COMPANY" : i % 3 === 1 ? "GROUP" : "PERSON",
        statement: `Règle numéro ${i}`, params: { cle: `k${i % 400}` }, domain: i % 5 === 0 ? "finance" : "general",
      }));
    }
    const debut = performance.now();
    const r = resoudre(regles, sujet);
    const ms = performance.now() - debut;
    expect(r.enVigueur.length).toBe(400);
    expect(ms).toBeLessThan(50);
  });
});
