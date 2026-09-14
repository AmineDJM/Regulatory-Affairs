import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODULES, getAccess, userCan, type SessionUser } from "@/lib/rbac";
import { MODULE_LABELS, NAVIGATION, ANNUAIRES_TABS } from "@/lib/labels";
import { SERVICE_DU_MODULE } from "@/lib/assistant/context/modules-domaines";
import { visibleTabs } from "@/lib/nav-tabs";
import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════
 * LE MODULE « ANNUAIRES » — une porte dans le pôle Administration, gardée onglet par onglet.
 *
 * Décision de la Direction (09/2026) : « un module à part dans Administration nommé Annuaires
 * qui contiendra tous les annuaires ». Ce banc tient ce que le code PROMET :
 *   - le module existe, se nomme, entre dans le pôle Administration ;
 *   - chaque onglet porte le module de SON référentiel — c'est lui qui décide de l'affichage ;
 *   - la porte est accordée à tout le monde, et n'ouvre rien de plus que les modules déjà tenus ;
 *   - les écrans d'origine et le concentrateur lisent les MÊMES chargeurs (point d'appel, §118.49).
 * ═══════════════════════════════════════════════════════════
 */

const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("Annuaires — le module et son entrée de menu", () => {
  it("DIRECTORIES est un module déclaré, nommé « Annuaires »", () => {
    expect(MODULES).toContain("DIRECTORIES");
    expect(MODULE_LABELS.DIRECTORIES).toBe("Annuaires");
    expect(SERVICE_DU_MODULE.DIRECTORIES.domaines).toContain("DIRECTORY");
  });

  it("l'entrée de menu vit dans le pôle ADMINISTRATION, avec ses onglets", () => {
    const entree = NAVIGATION.find((n) => n.module === "DIRECTORIES");
    expect(entree).toBeDefined();
    expect(entree?.group).toBe("Pôles");
    expect(entree?.pole).toBe("ADMINISTRATION");
    expect(entree?.href).toBe("/annuaires");
    expect(entree?.tabs).toBe(ANNUAIRES_TABS);
  });

  it("chaque onglet porte le module de SON référentiel — jamais la porte « Annuaires » seule", () => {
    const parLabel = Object.fromEntries(ANNUAIRES_TABS.map((t) => [t.label, t.module]));
    expect(parLabel["Médecins"]).toBe("MEDICAL");
    expect(parLabel["Pharmaciens"]).toBe("MEDICAL");
    expect(parLabel["Établissements"]).toBe("MEDICAL");
    expect(parLabel["Partenaires"]).toBe("WORKSPACE");
    expect(parLabel["Personnes"]).toBe("WORKSPACE");
    // Un onglet « Médecins » gardé par DIRECTORIES s'afficherait à qui n'a pas la Promotion
    // médicale : la fuite par le menu que ce test existe pour empêcher.
    for (const t of ANNUAIRES_TABS) if (/Médecins|Pharmaciens|Établissements/.test(t.label)) expect(t.module).not.toBe("DIRECTORIES");
    // Et chaque onglet a sa page.
    for (const t of ANNUAIRES_TABS) {
      expect(() => lire(`src/app/(app)${t.href}/page.tsx`), `page manquante pour ${t.href}`).not.toThrow();
    }
  });
});

describe("Annuaires — les deux portes lisent le même chargeur (point d'appel, §118.49)", () => {
  const cas: [string, string, string][] = [
    ["src/app/(app)/medical/annuaire/page.tsx", "src/app/(app)/annuaires/feuille-praticiens.tsx", "chargerFeuillePraticiens"],
    ["src/app/(app)/medical/etablissements/page.tsx", "src/app/(app)/annuaires/etablissements/page.tsx", "chargerEtablissements"],
    ["src/app/(app)/mon-espace/annuaire/page.tsx", "src/app/(app)/annuaires/partenaires/page.tsx", "chargerPartenaires"],
    ["src/app/(app)/mon-espace/annuaire/page.tsx", "src/app/(app)/annuaires/personnes/page.tsx", "chargerPersonnes"],
  ];
  for (const [origine, hub, chargeur] of cas) {
    it(`${chargeur} : importé par l'écran d'origine ET par le concentrateur, et aucun des deux ne relit Prisma`, () => {
      for (const f of [origine, hub]) {
        const src = lire(f);
        expect(src, `${f} doit importer ${chargeur} depuis lib/queries/annuaires`).toMatch(new RegExp(`\\b${chargeur}\\b[\\s\\S]*from "@/lib/queries/annuaires"`));
        // Un écran qui rechargerait lui-même l'annuaire ferait une seconde lecture qui diverge.
        expect(src.includes("prisma."), `${f} ne doit plus lire Prisma directement`).toBe(false);
      }
    });
  }

  it("le chargeur ne remonte pas vers l'application : ses types viennent du socle", () => {
    const src = lire("src/lib/queries/annuaires.ts");
    expect(src).not.toMatch(/from "@\/app\//);
  });
});

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

suite("Annuaires — la porte est ouverte à tous, et n'ouvre rien de plus", () => {
  const acteur = async (role: string): Promise<SessionUser> =>
    ({ id: `__annuaires__${role}`, role, secondaryRole: null, access: await getAccess(`__annuaires__${role}`, role as never) } as unknown as SessionUser);

  it("un simple VIEWER passe la porte, voit Partenaires et Personnes, pas les onglets médicaux", async () => {
    const lecteur = await acteur("VIEWER");
    expect(userCan(lecteur, "DIRECTORIES", "VIEW")).toBe(true);
    expect(userCan(lecteur, "MEDICAL", "VIEW")).toBe(false);
    const tabs = await visibleTabs(lecteur, ANNUAIRES_TABS);
    const visibles = tabs.filter((t) => t.show).map((t) => t.label);
    expect(visibles).toContain("Partenaires");
    expect(visibles).toContain("Personnes");
    expect(visibles).not.toContain("Médecins");
    expect(visibles).not.toContain("Établissements");
  });

  it("un délégué médical voit les onglets médicaux — la porte suit le module, pas l'inverse", async () => {
    const kam = await acteur("MEDICAL_DELEGATE");
    const tabs = await visibleTabs(kam, ANNUAIRES_TABS);
    const visibles = tabs.filter((t) => t.show).map((t) => t.label);
    expect(visibles).toEqual(expect.arrayContaining(["Médecins", "Pharmaciens", "Établissements", "Partenaires", "Personnes"]));
  });
});
