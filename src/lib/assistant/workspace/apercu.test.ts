import { describe, expect, it } from "vitest";
import { apercuDesSources, SOURCES_MIN, TITRE_PAR_DEFAUT } from "./apercu";
import { composeWorkspace } from "./compose";
import { WORKSPACE_LIMITS } from "./protocol";
import { extractSources } from "@/lib/assistant";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LE CODE TIENT, L'ÉCRAN LE REÇOIT — et JAMAIS rien d'autre.
 *
 * ── LA MESURE ───────────────────────────────────────────────────────────────────────────
 *
 * Sur « Analyse-moi les retards Regulatory », onze pièces nommées et liées étaient connues à
 * 108 ms ; le premier bloc arrivait à 13 742 ms. Treize secondes et demie de rétention pure.
 *
 * ── CE QUE CES TESTS TIENNENT, ET LE SECOND COMPTE PLUS QUE LE PREMIER ──────────────────
 *
 *   1. une lecture qui rapporte des éléments liés produit un bloc, tout de suite ;
 *   2. L'APERÇU NE RÉVÈLE RIEN QUE LE PANNEAU « SOURCES » NE MONTRAIT DÉJÀ. C'est toute sa
 *      sûreté : il ne lit pas la sortie de l'outil, il reçoit ce que `extractSources` en a
 *      déjà extrait et validé. Un module qui, lui, regarderait le JSON rouvrirait l'incident
 *      des six lignes de salaire affichées en réponse à « Bonsoir, ça va ? ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const S = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `Pièce ${i + 1}`, href: `/drive/${i + 1}` }));

describe("l'aperçu montre ce que la lecture vient de rapporter", () => {
  it("deux sources ou plus font un bloc, avec leurs liens", () => {
    const c = apercuDesSources("find_documents", S(3), "Découverte documentaire")!;
    expect(c.source).toBe("find_documents");
    expect(c.blocks).toHaveLength(1);
    const b = c.blocks[0]!;
    expect(b.kind).toBe("queue");
    expect(b.title).toBe("Découverte documentaire");
    expect(b).toMatchObject({ state: "complete", certitude: "fait" });
    expect(b.kind === "queue" && b.items.map((i) => i.href)).toEqual(["/drive/1", "/drive/2", "/drive/3"]);
    // Le total ANNONCÉ est celui des lignes montrées : dire onze en montrant huit serait un
    // chiffre faux, et un chiffre faux dans un espace de travail se recopie ensuite partout.
    expect(b.kind === "queue" && b.total).toBe(3);
  });

  it("une seule source ne fait pas un bloc — un cadre autour d'une ligne n'informe personne", () => {
    expect(apercuDesSources("find_documents", S(1))).toBeNull();
    expect(apercuDesSources("find_documents", [])).toBeNull();
    expect(SOURCES_MIN).toBe(2);
  });

  it("le détail d'un fait suit la ligne quand il existe, et jamais une chaîne vide", () => {
    const b = apercuDesSources("x", [
      { label: "A", href: "/a", detail: "  échéance 31/12  " },
      { label: "B", href: "/b", detail: "   " },
    ])!.blocks[0]!;
    expect(b.kind === "queue" && b.items).toEqual([
      { titre: "A", href: "/a", detail: "échéance 31/12" },
      { titre: "B", href: "/b", detail: null },
    ]);
  });

  it("sans titre fourni, un libellé neutre — jamais un nom d'outil montré à l'utilisateur", () => {
    const b = apercuDesSources("regulatory_signals", S(2))!.blocks[0]!;
    expect(b.title).toBe(TITRE_PAR_DEFAUT);
    expect(b.title).not.toContain("regulatory_signals");
    expect(apercuDesSources("x", S(2), "   ")!.blocks[0]!.title).toBe(TITRE_PAR_DEFAUT);
  });

  it("les doublons de lien fusionnent, et la liste est bornée", () => {
    const b = apercuDesSources("x", [...S(2), { label: "Encore", href: "/drive/1" }])!.blocks[0]!;
    expect(b.kind === "queue" && b.items).toHaveLength(2);
    const long = apercuDesSources("x", S(200))!.blocks[0]!;
    expect(long.kind === "queue" && long.items.length).toBe(WORKSPACE_LIMITS.queueItems);
  });
});

describe("LE TEST QUI COMPTE : l'aperçu ne révèle rien de plus que le panneau « Sources »", () => {
  /**
   * La sortie d'outil qui a produit l'incident : six lignes de salaire, dans un JSON, en
   * réponse à une politesse. `extractSources` n'en tire QUE des liens internes et des libellés
   * pris dans une liste blanche de clés ; l'aperçu ne voit pas le reste, et ne peut donc pas
   * l'afficher — non par prudence de rédaction, mais parce que la donnée ne lui parvient pas.
   */
  const SORTIE_SENSIBLE = JSON.stringify({
    salaries: [
      { nom: "A. Benali", salaireBrut: 480000, iban: "DZ59 0000 1234", lien: "/rh/1" },
      { nom: "K. Mouffok", salaireBrut: 610000, iban: "DZ59 0000 5678", lien: "/rh/2" },
      { nom: "S. Yahia", salaireBrut: 375000, motDePasse: "hunter2", lien: "/rh/3" },
    ],
  });

  it("aucun champ non lié ne franchit la barrière", () => {
    const sources = extractSources(SORTIE_SENSIBLE);
    const c = apercuDesSources("un_outil_inconnu", sources)!;
    const texte = JSON.stringify(c);
    for (const secret of ["480000", "610000", "375000", "DZ59", "hunter2", "salaireBrut", "iban", "motDePasse"]) {
      expect(texte, `« ${secret} » est passé dans l'aperçu`).not.toContain(secret);
    }
    // Ce qui passe, ce sont les noms et les liens — exactement le contenu du panneau Sources.
    expect(texte).toContain("/rh/1");
    expect(texte).toContain("A. Benali");
  });

  it("un lien EXTERNE ne devient jamais une ligne — on ne sort pas de l'ERP sans le dire", () => {
    const c = apercuDesSources("x", [
      { label: "Interne", href: "/dossiers/1" },
      { label: "Ailleurs", href: "https://exemple.test/piege" },
      { label: "Protocole relatif", href: "//exemple.test/piege" },
      { label: "Deuxième interne", href: "/dossiers/2" },
    ])!;
    const hrefs = c.blocks[0]!.kind === "queue" ? c.blocks[0]!.items.map((i) => i.href) : [];
    expect(hrefs).toEqual(["/dossiers/1", "/dossiers/2"]);
  });

  it("l'aperçu ne PRÉCÈDE jamais un vrai traducteur : l'appelant essaie `composeWorkspace` d'abord", () => {
    // Une lecture d'annuaire a sa fiche ; l'aperçu générique ne doit pas la remplacer. C'est
    // l'ordre `composeWorkspace(...) ?? apercuDesSources(...)` qui le garantit, et ce test
    // vérifie la prémisse : le traducteur rend bien quelque chose sur ces formes-là.
    const annuaire = JSON.stringify({ total: 2, salaries: [
      { nom: "A. Benali", poste: "RA", lien: "/rh/1" }, { nom: "K. Mouffok", poste: "QA", lien: "/rh/2" },
    ] });
    expect(composeWorkspace("directory_list", annuaire)).not.toBeNull();
    expect(composeWorkspace("un_outil_inconnu", annuaire)).toBeNull();
  });

  it("mesure consignée — lectures rendues visibles à l'instant où elles rendent", () => {
    /**
     * On part de SORTIES D'OUTILS RÉELLES par le chemin complet (JSON → `extractSources` →
     * aperçu), pas d'une liste de sources écrite à la main : c'est la chaîne qui est mesurée.
     */
    const sorties: [string, string][] = [
      ["find_documents", JSON.stringify({ documents: [
        { nom: "Contrat Kwality.pdf", lien: "/api/documents/1" }, { nom: "Avenant 2026.docx", lien: "/api/documents/2" }] })],
      ["search_everything", JSON.stringify({ resultats: [
        { titre: "REG-2026-9011", lien: "/regulatory/9011" }, { titre: "REG-2026-9012", lien: "/regulatory/9012" },
        { titre: "REG-2026-9013", lien: "/regulatory/9013" }] })],
      ["regulatory_signals", JSON.stringify({ dossiers: [
        { reference: "REG-1", lien: "/regulatory/1" }, { reference: "REG-2", lien: "/regulatory/2" }] })],
      ["search_contracts", JSON.stringify([
        { objet: "Bail Alger", lien: "/legal/1" }, { objet: "Distribution Hetero", lien: "/legal/2" }])],
      // Une lecture SANS élément lié n'a rien à montrer : `null` est la bonne réponse, et ce
      // cas compte comme un succès — l'aperçu ne doit pas fabriquer un bloc pour exister.
      ["read_budget", JSON.stringify({ total: 12_000_000, devise: "DZD" })],
    ];
    const attendus = [true, true, true, true, false];
    const justes = sorties.filter(([outil, out], i) =>
      (apercuDesSources(outil, extractSources(out)) !== null) === attendus[i]).length;

    consignerMesure("lecture_visible_des_quelle_rend", { n: sorties.length, ok: justes },
      "lib/assistant/workspace/apercu.test.ts",
      "sorties de lecture rendues visibles à l'instant où elles rendent — mesuré auparavant à 13 742 ms de rétention sur l'analyse Regulatory");

    expect(sorties.filter(([o, out], i) => (apercuDesSources(o, extractSources(out)) !== null) !== attendus[i]).map(([o]) => o)).toEqual([]);
  });
});
