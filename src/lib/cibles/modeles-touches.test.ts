import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { direEmpreinteEcriture, empreinteEcriture } from "./modeles-touches";
import type { ContratAction } from "@/lib/actions/contrat";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PHRASE QUE LA PERSONNE CONFIRME — et la mesure qui a décidé de sa forme.
 *
 * Chaque cas nomme le défaut qu'il ferme : sans cela, ce ne serait pas une assertion (§118.17).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("EMPREINTE D'ÉCRITURE — ce que la carte annonce qu'elle va toucher", () => {
  it("L'OBJET MÉTIER EST NOMMÉ EN FRANÇAIS, jamais en camelCase Prisma", () => {
    // LE CAS QUI FERAIT TOMBER : revenir à `modelesEcrits.join(", ")` — la personne lirait
    // « administrativeRequest », un identifiant technique dans la phrase qu'elle valide (§104.17).
    const p = direEmpreinteEcriture(["administrativeRequest"]);
    expect(p).toContain("Demande au bureau du secrétariat");
    expect(p).not.toContain("administrativeRequest");
  });

  it("LE JOURNAL D'AUDIT NE S'AFFICHE PAS — 67 % des écritures le déclarent, et son absence ne prouve rien", () => {
    // Mesuré : 430 des 640 actions écrivantes déclarent `auditLog`. Le nommer apprendrait à
    // sauter la ligne (§118.32), et les 33 % restants ne sont pas des écritures NON auditées :
    // ce sont des appels que la dérivation n'a pas vus.
    const p = direEmpreinteEcriture(["administrativeRequest", "auditLog", "businessEvent"]);
    expect(p).not.toMatch(/audit/i);
    expect(p).not.toMatch(/businessEvent|journal/i);
    expect(p).toContain("Demande au bureau du secrétariat");
  });

  it("LA NOTIFICATION A SA PROPRE PHRASE — elle dit qu'une PERSONNE va être dérangée", () => {
    // LE CAS QUI FERAIT TOMBER : la traiter comme une ligne de liste. « notification » noyé
    // parmi trois noms de tables ne se lit pas comme « quelqu'un va recevoir un message ».
    const avec = direEmpreinteEcriture(["administrativeRequest", "notification"]);
    expect(avec).toMatch(/notification part à la personne concernée/);
    const sans = direEmpreinteEcriture(["administrativeRequest"]);
    expect(sans).not.toMatch(/notification part/);
  });

  it("UNE TABLE QU'ON NE SAIT PAS NOMMER GARDE SON NOM, avec son registre annoncé", () => {
    // Le registre nomme 29 modèles sur les 188 que le parc écrit, et **189 cartes sur 640**
    // seulement portent un objet du registre. Rendre un COMPTE (« 2 tables que je ne sais pas
    // nommer ») aurait réparé ces 189 en dégradant les 451 autres, qui perdaient un nom
    // technique mais SPÉCIFIQUE — l'échange que §118.27 interdit. On garde le nom, et l'on dit
    // que c'est une table pour que le lecteur ne le prenne pas pour un libellé français.
    const e = empreinteEcriture(["promoMaterial", "fileBlob", "administrativeRequest"]);
    expect(e.objets).toEqual(["Demande au bureau du secrétariat"]);
    expect(e.tables).toEqual(["fileBlob", "promoMaterial"]);
    const p = direEmpreinteEcriture(["promoMaterial", "fileBlob", "administrativeRequest"]);
    expect(p).toContain("Demande au bureau du secrétariat");
    expect(p).toMatch(/les tables « fileBlob », « promoMaterial »/);
    // LE SINGULIER se dit au singulier — « les tables « x » » sur une seule table est le genre
    // de détail qui fait douter du reste de la phrase (§104.17).
    expect(direEmpreinteEcriture(["fileBlob"])).toMatch(/^Écrit la table « fileBlob »\.$/);
  });

  it("UNE ÉCRITURE SANS AUCUN OBJET NOMMABLE LE DIT — la carte ne laisse jamais croire qu'elle ne touche à rien", () => {
    // §104.15 : répondre « rien » sur ce qu'on n'a pas su lire est le faux succès parfait.
    expect(direEmpreinteEcriture(["fileBlob"])).toMatch(/^Écrit la table « fileBlob »/);
    // Le cas limite : uniquement de la plomberie. La phrase reste, et elle est honnête.
    expect(direEmpreinteEcriture(["auditLog"])).toMatch(/sans objet métier identifiable/);
  });

  it("LE PARC ENTIER : un nom de table n'apparaît JAMAIS en position de libellé français", () => {
    const rows: ContratAction[] = JSON.parse(
      readFileSync(join(process.cwd(), "src/lib/actions/contrat.genere.json"), "utf8"),
    );
    const ecrivains = rows.filter((c) => c.ecrit && !c.illisible);
    expect(ecrivains.length).toBeGreaterThan(500);

    let nommees = 0, avecTables = 0;
    for (const c of ecrivains) {
      const p = direEmpreinteEcriture(c.modelesEcrits);
      expect(p.length, c.id).toBeGreaterThan(10);

      // LA PROPRIÉTÉ, et c'est celle du défaut d'origine : la phrase a DEUX registres, et un nom
      // de table ne doit jamais passer pour un libellé. On coupe à la clause des tables — tout
      // ce qui la précède est du français, et aucun nom de modèle ne doit s'y trouver.
      //
      // (Un nom de table dans la clause des tables est VOULU : le retirer aurait remplacé
      // « promoMaterial » par un compte, ce qui dégrade 451 cartes sur 640, §118.27.)
      const coupe = p.search(/, et (la table|les tables)|^Écrit (la table|les tables)/m);
      const partieFr = coupe >= 0 ? p.slice(0, coupe) : p;
      for (const m of c.modelesEcrits) {
        if (m === "notification") continue; // le nom du modèle EST le mot français (voir plus bas)
        expect(partieFr, `${c.id} : « ${m} » apparaît comme un libellé français`).not.toContain(m);
      }
      // ET CE QUI EST TECHNIQUE EST TOUJOURS CITÉ : un nom nu se lirait comme un libellé.
      const e = empreinteEcriture(c.modelesEcrits);
      for (const t of e.tables) expect(p, `${c.id} : « ${t} » n'est pas cité`).toContain(`« ${t} »`);

      if (e.objets.length > 0) nommees += 1;
      if (e.tables.length > 0) avecTables += 1;
    }
    // ON IMPRIME LE PARTAGE au lieu de le supposer — c'est lui qui a décidé de la forme.
    console.log(`[EMPREINTE] ${nommees}/${ecrivains.length} cartes nomment un objet du registre ; `
      + `${avecTables} citent au moins une table brute`);
    expect(nommees).toBeGreaterThan(150);
  });

  it("« notification » : le nom du modèle EST le mot français, donc la fuite est indétectable par sous-chaîne", () => {
    // On le DIT plutôt que d'exempter en silence (§118.82) : le cas ci-dessus ne peut pas voir
    // une fuite de ce modèle-là. Ce qui la couvre est la FORMULATION exacte — une phrase, pas
    // un élément de liste — et le fait qu'il n'entre jamais dans `objets` ni dans `tables`.
    const e = empreinteEcriture(["notification"]);
    expect(e.objets).toEqual([]);
    expect(e.tables).toEqual([]);
    expect(e.previent).toBe(true);
    expect(direEmpreinteEcriture(["notification"]))
      .toBe("Écriture en base annoncée, sans objet métier identifiable. Une notification part à la personne concernée.");
  });
});
