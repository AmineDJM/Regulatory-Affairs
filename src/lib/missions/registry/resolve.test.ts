import { describe, expect, it } from "vitest";
import type { CapabilityBrief, CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import type { CapabilityMeta } from "@/lib/missions/registry/capability-meta";
import { resoudreCapacites, scoreCapacite, jetonsEtendus } from "@/lib/missions/registry/resolve";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE SEUIL DE PERTINENCE COUPE-T-IL LA QUEUE — SANS COUPER LE PLANCHER ?
 *
 * ── LA MESURE QUI A PRODUIT CE FICHIER ───────────────────────────────────────────────────
 *
 * Un run réel sur Render a chiffré le gaspillage : 28 capacités montrées au planner, 3 à 5
 * réellement retenues dans le plan compilé, pour ~2 300 jetons de résumés dans un prompt qui en
 * mesurait 4 200 à 5 100. Près de la moitié de l'entrée décrivait des outils que le plan n'a pas
 * utilisés — et chacun de ces outils est une piste que le modèle examine avant de l'écarter.
 *
 * ── LE RISQUE EXACT DE CETTE OPTIMISATION ────────────────────────────────────────────────
 *
 * Réduire ce qu'on montre est trivialement facile ; le faire sans cacher une capacité NÉCESSAIRE
 * ne l'est pas. Ce dépôt connaît déjà la panne : montrer `send_email` sans montrer
 * `directory_list` produit un plan cohérent, compilable, et qui envoie un message à personne.
 * La garde qui l'empêche est le TOURNIQUET par domaine, et il admet délibérément des capacités
 * qui n'ont marqué AUCUN point — parce que « liste des gens » ne partage aucun mot avec
 * « bonne année ».
 *
 * Ce fichier vérifie donc les deux moitiés de la même décision :
 *   1. le seuil retire bien la queue (les capacités qui ont effleuré un mot sans concerner la
 *      demande) — et il le prouve par CONTRE-EXEMPLE, en refaisant la même résolution seuil
 *      désarmé, ce qui interdit qu'un jour le test passe parce que le montage a changé ;
 *   2. le seuil ne retire RIEN de ce que le tourniquet a placé, y compris à score nul.
 *
 * Le montage fixe `maxDomaines` et `parDomaine` pour que l'arithmétique soit lisible ; le seuil,
 * lui, reste à sa valeur de PRODUCTION — c'est lui qui est jugé ici.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const b = (id: string, domain: string, summary: string): CapabilityBrief => ({
  id,
  domain,
  effect: "READ",
  batchable: false,
  summary,
});

/**
 * LE MONTAGE — vingt-sept capacités réparties en trois zones nettes.
 *
 * `messagerie` et `rh` marquent haut (le domaine lui-même est dans la demande) ; `annuaire`
 * marque par une seule de ses trois capacités, et les deux autres à ZÉRO : ce sont elles que le
 * tourniquet doit sauver. Tout le reste est la QUEUE : un mot commun, aucun rapport.
 */
const CAPACITES: readonly CapabilityBrief[] = [
  // ── messagerie — le domaine central de la demande ─────────────────────────────────────
  b("send_message", "messagerie", "Envoie un message ERP à une personne."),
  b("draft_message", "messagerie", "Prépare un message sans l'envoyer."),
  b("message_history", "messagerie", "Relit l'historique des messages d'un fil."),
  b("message_template", "messagerie", "Applique un modèle de message enregistré."),
  b("message_export", "messagerie", "Exporte les messages d'une période."),

  // ── rh — le second domaine nommé par la demande ───────────────────────────────────────
  b("employee_list", "rh", "Liste les salariés actifs."),
  b("employee_contract", "rh", "Ouvre le contrat d'un salarié."),
  b("employee_absence", "rh", "Relit les absences d'une période."),
  b("employee_payroll", "rh", "Prépare un bulletin de paie."),

  // ── annuaire — UNE capacité marque, DEUX ne marquent rien, et elles sont utiles ───────
  b("directory_list", "annuaire", "Liste les personnes de l'annuaire."),
  b("directory_card", "annuaire", "Ouvre la fiche d'une personne."),
  b("directory_org_chart", "annuaire", "Affiche l'organigramme."),

  // ── LA QUEUE — un mot de la demande apparaît dans le résumé, et c'est tout ────────────
  b("invoice_reminder", "comptabilite", "Relance une facture par message."),
  b("payment_status", "comptabilite", "Donne l'état d'un paiement d'un salarié."),
  b("stock_alert", "logistique", "Signale un stock bas par message."),
  b("delivery_track", "logistique", "Suit une livraison et prévient le salarié."),
  b("document_send", "drive", "Envoie un document par message."),
  b("document_classify", "drive", "Classe un document reçu par message."),
  b("task_create", "taches", "Crée une tâche pour un salarié."),
  b("task_remind", "taches", "Rappelle une tâche par message."),
  b("meeting_book", "agenda", "Réserve une réunion et prévient chaque salarié."),
  b("meeting_notes", "agenda", "Rédige le compte rendu et l'envoie par message."),

  // ── LE HORS-SUJET COMPLET — score nul, hors des domaines retenus ─────────────────────
  b("batch_release", "qualite", "Libère un lot pharmaceutique."),
  b("stability_study", "qualite", "Ouvre une étude de stabilité."),
  b("customs_declare", "import", "Dépose une déclaration douanière."),
  b("tender_open", "pch", "Ouvre un appel d'offres."),
  b("price_history", "pch", "Retrace l'historique de prix d'un produit."),
];

const ACTEUR: MissionActor = { userId: "u-1", label: "Le PDG", isAgent: false };

const catalogue: CapabilityCatalog = {
  has: (name) => CAPACITES.some((c) => c.id === name),
  allowed: () => true,
  meta: (name) =>
    ({
      id: name,
      domain: CAPACITES.find((c) => c.id === name)?.domain ?? "inconnu",
      effect: "READ",
      idempotent: true,
      batchable: false,
      latency: "LOW",
      confirmation: "NEVER",
      declared: false,
    }) satisfies CapabilityMeta,
  brief: () => [...CAPACITES],
};

const DEMANDE = "envoie à chacun des salariés un message de bonne année sur la messagerie";

/** Le même montage des deux côtés : seules les deux options du seuil changent. */
const STRUCTURE = { maxDomaines: 3, parDomaine: 3, limite: 20 } as const;
const SEUIL_DESARME = { ...STRUCTURE, seuilRelatif: 0, seuilMinimum: 0 } as const;

const idsMontres = (opts: Parameters<typeof resoudreCapacites>[3]): string[] =>
  resoudreCapacites(DEMANDE, catalogue, ACTEUR, opts).capacites.map((c) => c.id);

describe("le seuil de pertinence — ce qu'il coupe, et ce qu'il ne coupe pas", () => {
  it("COUPE la queue : une capacité qui n'a effleuré qu'un mot n'est plus montrée", () => {
    const avec = idsMontres(STRUCTURE);
    const sans = idsMontres(SEUIL_DESARME);

    // LE CONTRE-EXEMPLE EST LA MOITIÉ QUI COMPTE. Sans lui, ce test passerait encore le jour où
    // le seuil serait retiré — il suffirait que le montage soit trop petit pour atteindre la
    // limite. Ici la même résolution, seuil désarmé, MONTRE la capacité que le seuil retire.
    expect(sans).toContain("invoice_reminder");
    expect(avec).not.toContain("invoice_reminder");
    expect(avec.length).toBeLessThan(sans.length);

    // Et la queue coupée est bien la QUEUE : tout ce qui disparaît a un score faible.
    const demande = jetonsEtendus(DEMANDE);
    const meilleur = Math.max(...CAPACITES.map((c) => scoreCapacite(c, demande)));
    for (const id of sans.filter((x) => !avec.includes(x))) {
      const brief = CAPACITES.find((c) => c.id === id)!;
      expect(scoreCapacite(brief, demande), id).toBeLessThan(meilleur * 0.25);
    }
  });

  it("NE COUPE PAS le plancher : une capacité à score NUL d'un domaine retenu reste montrée", () => {
    const demande = jetonsEtendus(DEMANDE);
    const carte = CAPACITES.find((c) => c.id === "directory_card")!;

    // La prémisse d'abord : si un jour cette capacité se mettait à marquer, le test ci-dessous
    // deviendrait vrai pour une raison sans rapport avec le tourniquet.
    expect(scoreCapacite(carte, demande)).toBe(0);

    const avec = idsMontres(STRUCTURE);
    // C'est la panne connue de ce dépôt : montrer de quoi écrire sans montrer à QUI. Le seuil
    // s'applique au remplissage, jamais au tourniquet — cette ligne est ce qui le tient.
    expect(avec).toContain("directory_list");
    expect(avec).toContain("directory_card");
    expect(avec).toContain("directory_org_chart");
  });

  it("NE COUPE PAS une capacité IMPOSÉE, même sous le seuil", () => {
    // Une reprise ou un replan ciblé sait ce dont il a besoin ; le résolveur n'a pas à en juger.
    const avec = idsMontres({ ...STRUCTURE, imposees: ["invoice_reminder"] });
    expect(avec).toContain("invoice_reminder");
  });

  it("le seuil est RELATIF, et il ne mord QUE sur le remplissage", () => {
    // Le seuil vaut `max(minimum, relatif × meilleur)`. Relatif, parce qu'une demande écrite avec
    // les mots exacts du catalogue marque haut partout et une demande orale marque bas partout :
    // un seuil absolu trancherait au mauvais endroit dans l'un des deux cas.
    //
    // Le durcir doit couper DAVANTAGE — mais seulement dans la boucle de remplissage. Ici deux
    // capacités marquent 3 : `employee_absence`, placée par le tourniquet, et `employee_payroll`,
    // qui n'entrait que par le remplissage. À seuil 0,5 × 9 = 4,5, la seconde tombe et la
    // première reste. C'est exactement la frontière que l'optimisation ne doit pas franchir.
    const demande = jetonsEtendus(DEMANDE);
    const score = (id: string) => scoreCapacite(CAPACITES.find((c) => c.id === id)!, demande);
    expect(score("employee_absence")).toBe(score("employee_payroll"));

    const strict = idsMontres({ ...STRUCTURE, seuilRelatif: 0.5 });
    expect(strict).toContain("employee_absence");
    expect(strict).not.toContain("employee_payroll");
    expect(idsMontres(STRUCTURE)).toContain("employee_payroll");
  });

  it("le résolveur reste une RÉDUCTION : jamais plus que la limite, jamais tout le catalogue", () => {
    const r = resoudreCapacites(DEMANDE, catalogue, ACTEUR, STRUCTURE);
    expect(r.metriques.plannerCapabilitiesExposed).toBeLessThanOrEqual(STRUCTURE.limite);
    expect(r.metriques.plannerCapabilitiesExposed).toBeLessThan(r.metriques.capacitesAutorisees);
    expect(r.metriques.capacitesAutorisees).toBe(CAPACITES.length);
    expect(r.metriques.jetonsEvites).toBeGreaterThan(0);
  });
});
