import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DELETE_REGISTRY, DELETABLE_KINDS, type DeletableKind } from "./admin-delete-registry";

/** Un cliquet juge le CODE, pas la prose qui le décrit (§118.79d, §118.88, §118.112b). */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const lire = (p: string) => sansCommentaires(readFileSync(p, "utf8"));

const CŒUR = "src/lib/actions/admin-delete-actions.ts";
const ADAM = "src/lib/assistant.ts";

describe("Registre des suppressions — le refus et la réserve", () => {
  it("les trois nouveaux types sont au registre, et le compte est mesuré", () => {
    for (const k of ["CONVERSATION", "NOTIFICATION"] as DeletableKind[]) {
      expect(DELETABLE_KINDS, `${k} doit être supprimable`).toContain(k);
      const spec = DELETE_REGISTRY[k];
      expect(spec.model, `${k} doit nommer son délégué Prisma`).toBeTruthy();
      expect(spec.redirect).toBe("/admin/messagerie");
    }
    expect(DELETABLE_KINDS).toHaveLength(28);
  });

  it("une conversation refuse, une notification non — et chacune dit pourquoi", () => {
    // Le REFUS n'existe que là où un type a une raison de refuser. Le poser partout ferait
    // payer une requête à chaque suppression du parc, pour rien.
    expect(DELETE_REGISTRY.CONVERSATION.refuse).toBeTypeOf("function");
    expect(DELETE_REGISTRY.NOTIFICATION.refuse).toBeUndefined();
    // La RÉSERVE ne vit que là où la cascade emporte le contenu de l'objet : une notification
    // se restaure à l'identique, donc une réserve y serait du bruit (§118.32).
    expect(DELETE_REGISTRY.CONVERSATION.reserve).toMatch(/VIDE/);
    expect(DELETE_REGISTRY.NOTIFICATION.reserve).toBeUndefined();
  });

  it("les 26 types d'origine ne refusent rien et ne réservent rien — l'ajout n'a rien changé chez eux", () => {
    const anciens = DELETABLE_KINDS.filter((k) => k !== "CONVERSATION" && k !== "NOTIFICATION");
    expect(anciens).toHaveLength(26);
    for (const k of anciens) {
      expect(DELETE_REGISTRY[k].refuse, `${k} ne refusait rien avant ce lot`).toBeUndefined();
      expect(DELETE_REGISTRY[k].reserve, `${k} n'annonçait aucune réserve avant ce lot`).toBeUndefined();
    }
  });
});

/**
 * LE CLIQUET DE POSITION (§118.17, §118.49).
 *
 * Une garde se place AVANT, jamais après le clic. Le refus doit donc être lu avant tout
 * instantané dans le cœur partagé, ET avant la construction de la carte chez Adam — sinon le
 * geste est offert puis retiré, ce que §118.83 interdit.
 */
describe("Cliquet — le refus est lu AVANT, aux deux portes", () => {
  it("le cœur partagé lit le refus avant le premier instantané", () => {
    const src = lire(CŒUR);
    const iRefus = src.indexOf("spec.refuse(id)");
    const iSnapshot = src.indexOf("deleteDelegateOf(spec).findUnique");
    expect(iRefus, "snapshotAndSoftDelete doit appeler spec.refuse").toBeGreaterThan(-1);
    expect(iSnapshot).toBeGreaterThan(-1);
    expect(iRefus, "le refus doit précéder l'instantané").toBeLessThan(iSnapshot);
  });

  it("Adam lit le refus avant de construire la carte de confirmation", () => {
    const src = lire(ADAM);
    const iRefus = src.indexOf("spec.refuse(target.id)");
    const iCarte = src.indexOf("const confirmText = target.name.includes");
    expect(iRefus, "delete_record doit appeler spec.refuse").toBeGreaterThan(-1);
    expect(iCarte).toBeGreaterThan(-1);
    expect(iRefus, "le refus doit précéder la carte — pas un geste offert puis retiré").toBeLessThan(iCarte);
  });

  it("la réserve du registre atteint la carte d'Adam", () => {
    // Une réserve calculée que personne n'affiche est du code mort (§118.50).
    expect(lire(ADAM)).toContain("spec.reserve");
  });
});

describe("La phrase de la confirmation ne contredit pas le code", () => {
  const BOUTON = "src/components/shared/super-admin-delete.tsx";

  it("la suppression dépose un instantané — c'est la PRÉMISSE de tout ce qui suit", () => {
    // Sans ce fait, les deux assertions suivantes n'auraient aucune raison d'être : c'est lui
    // qui rend « irréversible » faux (§118.104 — on vérifie la prémisse).
    const src = lire(CŒUR);
    expect(src).toContain("prisma.deletedRecord.create");
    expect(src).toContain("superAdminDelete");
  });

  it("elle n'annonce pas une irréversibilité que la corbeille dément", () => {
    const src = readFileSync(BOUTON, "utf8");
    // On lit le fichier ENTIER ici, commentaires compris : une phrase affichée vit dans du
    // JSX, et l'en-tête CITE l'ancienne formule pour documenter le défaut — on cible donc la
    // formule exacte qui était rendue, pas le mot dans la prose.
    expect(src).not.toContain("Cette action ne peut pas être annulée.");
    expect(src).not.toContain('description="Action réservée au Super Admin — irréversible."');
  });

  it("elle NOMME la corbeille, qui est le geste de retour", () => {
    const src = readFileSync(BOUTON, "utf8");
    expect(src).toContain("Corbeille");
  });
});

describe("L'écran d'administration ne propose jamais ce que le registre refuse", () => {
  it("CHAQUE requête de conversation est bornée aux groupes et aux canaux", () => {
    // Afficher les tête-à-tête offrirait un bouton qui refuse — une fausse promesse pire que
    // l'absence (§118.27, §118.83).
    //
    // La première version de cette assertion cherchait la clause N'IMPORTE OÙ dans le fichier :
    // un sabotage qui débornait la LISTE en laissant le COMPTE intact passait au vert, parce que
    // le littéral restait présent (§118.111 — un sabotage qui passe dit « je ne teste pas ce que
    // je crois »). On juge donc requête par requête : un troisième accès ajouté demain devra
    // déclarer sa portée, et l'échec le NOMME.
    const src = lire("src/app/(app)/admin/messagerie/page.tsx");
    const acces = src.split("prisma.conversation.").slice(1);
    expect(acces.length, "l'écran doit interroger les conversations").toBeGreaterThanOrEqual(2);
    acces.forEach((frag, i) => {
      const fin = frag.indexOf("take:") >= 0 ? frag.indexOf("take:") : 400;
      const entete = frag.slice(0, Math.max(fin, 120));
      expect(entete, `l'accès #${i + 1} aux conversations n'est pas borné aux GROUP/CHANNEL`)
        .toContain('type: { in: ["GROUP", "CHANNEL"] }');
    });
    expect(src).not.toMatch(/type:\s*"DIRECT"/);
  });

  it("aucun corps de message n'est lu par cet écran", () => {
    // La lecture de la messagerie est cloisonnée par appartenance : un écran d'administration
    // qui sélectionnerait `body` d'un message serait une porte dérobée (§118.7).
    const src = lire("src/app/(app)/admin/messagerie/page.tsx");
    expect(src).not.toContain("prisma.message.");
    expect(src).not.toMatch(/messages:\s*\{\s*select/);
  });
});
