import { describe, expect, it } from "vitest";
import { empreinteDemandee, verdictEmpreinte } from "./empreinte";

/**
 * CE FICHIER PROTÈGE UN INVARIANT, PAS UNE FONCTION.
 *
 * L'invariant : l'empreinte réelle d'une écriture ne dépasse jamais l'empreinte demandée. Les
 * trois premiers cas sont les trois pannes RÉELLES qui l'ont motivé, chacune sur une surface
 * différente (conversation ERP, comptes, Live Office) — c'est cette diversité qui prouve que la
 * règle est générale et non trois rustines.
 *
 * Le quatrième cas est celui qu'on oublie de tester et qui décide de la survie de la règle : ce
 * qu'elle laisse passer. Une garde qui refuse ce qu'elle ne comprend pas est désactivée dans la
 * semaine, et la protection meurt avec elle.
 */
describe("l'empreinte d'une écriture ne dépasse pas celle de la demande", () => {
  it("un champ demandé n'autorise pas la destruction de l'enregistrement", () => {
    // MESURÉ dans le vrai chat : « Je propose : SUPPRIMER DÉFINITIVEMENT l'employé Allaeddine ».
    const v = verdictEmpreinte("Retire l'adresse e-mail d'Allaeddine", "delete_record", "Supprimer définitivement");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.axe).toBe("PROFONDEUR");

    // La demande qui vise VRAIMENT la personne passe : la règle lit la portée, pas le verbe.
    expect(verdictEmpreinte("Supprime cet employé", "delete_record").ok).toBe(true);
  });

  it("une modification d'annuaire n'autorise pas à toucher au compte", () => {
    for (const outil of ["set_account_active", "set_account_role"]) {
      expect(verdictEmpreinte("Corrige son numéro de téléphone dans l'annuaire", outil).ok).toBe(false);
    }
    // « change son rôle » ne nomme aucun champ reconnu → la règle est muette, l'action passe.
    expect(verdictEmpreinte("Change son rôle", "set_account_role").ok).toBe(true);
  });

  it("une cellule demandée n'autorise pas la suppression de la ligne (Live Office)", () => {
    const supprLigne = { commandes: [{ op: "xlsx.supprimer_ligne", cible: { index: 12 } }] };
    expect(verdictEmpreinte("Modifie la cellule B12", "artifact_edit", undefined, supprLigne).ok).toBe(false);
    expect(verdictEmpreinte("Supprime la ligne 12", "artifact_edit", undefined, supprLigne).ok).toBe(true);
    // Écrire DANS la cellule n'a jamais d'empreinte à dépasser.
    const valeur = { commandes: [{ op: "xlsx.valeur", cible: { ref: "B12" }, valeur: "3" }] };
    expect(verdictEmpreinte("Modifie la cellule B12", "artifact_edit", undefined, valeur).ok).toBe(true);
  });

  it("une cible unique n'autorise pas le lot, et un lot demandé n'est pas bridé", () => {
    const lot = { tool: "delete_record", targets: ["REG-2026-014", "REG-2026-015"] };
    expect(verdictEmpreinte("Supprime le dossier REG-2026-014", "bulk_action", undefined, lot).ok).toBe(false);
    for (const d of ["Supprime ces trois dossiers", "Supprime tous les dossiers archivés", "Supprime les dossiers de 2024"]) {
      expect(verdictEmpreinte(d, "bulk_action", undefined, lot).ok).toBe(true);
    }
  });

  it("LE SILENCE N'INTERDIT RIEN — ce que la règle ne lit pas, elle le laisse passer", () => {
    // Aucune de ces demandes n'énonce sa portée. Refuser ici ferait de la garde une nuisance.
    for (const d of ["Supprime Allaeddine", "Fais le nécessaire", "Occupe-toi de ça", "Nettoie l'annuaire"]) {
      expect(empreinteDemandee(d).profondeur, d).toBeNull();
      expect(verdictEmpreinte(d, "delete_record").ok, d).toBe(true);
    }
    // Une CRÉATION n'a pas d'empreinte à dépasser, même quand la phrase nomme un champ.
    expect(verdictEmpreinte("Crée une tâche pour corriger l'adresse e-mail d'Allaeddine", "create_task").ok).toBe(true);
  });

  it("la tête du groupe nominal décide — « adresse e-mail » n'est pas « un mail »", () => {
    // Le piège fondateur : « mail » est AUSSI le nom d'un enregistrement (un message reçu).
    expect(empreinteDemandee("Retire l'adresse e-mail d'Allaeddine").profondeur).toBe("CHAMP");
    expect(empreinteDemandee("Supprime ce mail").profondeur).toBe("ENREGISTREMENT");
    // Deux verbes, deux portées : la plus large gagne, parce que la demande l'autorise.
    expect(empreinteDemandee("Supprime l'employé Allaeddine et corrige son numéro").profondeur).toBe("ENREGISTREMENT");
  });
});
