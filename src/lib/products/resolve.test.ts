import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addProductAlias, ensureProduct, resolveProductId, resolveProductMention } from "./resolve";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA RÉSOLUTION BRANCHÉE — le circuit, avec la vraie base.
 *
 * `identity.test.ts` gèle la DÉCISION (pure, au cas près). Celui-ci gèle ce que la décision
 * seule ne peut pas prouver : que le pré-filtre SQL ramène bien les candidats qu'il faut, que
 * l'unicité anti-doublon est réellement portée par la base, et qu'un alias ne peut pas être
 * volé à un autre produit.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `ZZTEST${Date.now()}`;
const ids: string[] = [];

suite("le produit canonique, en base", () => {
  afterAll(async () => {
    await prisma.productAlias.deleteMany({ where: { productId: { in: ids } } }).catch(() => {});
    await prisma.product.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  });

  it("crée un produit, puis le RETROUVE au lieu d'en créer un second", async () => {
    const tuple = { dci: `${TAG}umab`, dosage: "100", dosageUnit: "mg", form: "Injectable", packaging: "B/1" };

    const a = await ensureProduct({ ...tuple, canonicalName: `${TAG}umab 100 mg` });
    expect(a).not.toBeNull();
    ids.push(a!.id);
    expect(a!.created).toBe(true);

    // MÊME TUPLE, écrit autrement : « 100.0 » et une casse différente. C'est le même produit,
    // et l'unicité est portée par la BASE — pas par la vigilance de l'appelant.
    const b = await ensureProduct({ ...tuple, dosage: "100.0", dosageUnit: "MG" });
    expect(b!.id).toBe(a!.id);
    expect(b!.created).toBe(false);

    // Un DOSAGE différent est un AUTRE produit. C'est la garantie qui évite d'écrire un chiffre
    // d'affaires du 40 mg sous le 100 mg.
    const c = await ensureProduct({ ...tuple, dosage: "40" });
    ids.push(c!.id);
    expect(c!.id).not.toBe(a!.id);
  });

  it("un tuple sans DCI ne crée RIEN — on n'indexe pas le vide", async () => {
    expect(await ensureProduct({ dci: "" })).toBeNull();
    expect(await ensureProduct({ dci: "   " })).toBeNull();
  });

  it("un alias enregistré résout, et ne peut pas être VOLÉ à un autre produit", async () => {
    const p1 = await ensureProduct({ dci: `${TAG}alfa`, dosage: "10", dosageUnit: "mg", form: "Comprimé" });
    const p2 = await ensureProduct({ dci: `${TAG}beta`, dosage: "20", dosageUnit: "mg", form: "Comprimé" });
    ids.push(p1!.id, p2!.id);

    expect(await addProductAlias(p1!.id, `${TAG}A`)).toBe(true);
    // Le même alias revendiqué par un AUTRE produit : refusé. Un alias volé ferait répondre sur
    // le mauvais produit sans que personne ne comprenne pourquoi.
    expect(await addProductAlias(p2!.id, `${TAG}A`)).toBe(false);
    // Re-poser le MÊME alias sur le MÊME produit est sans effet, pas une erreur (idempotence).
    expect(await addProductAlias(p1!.id, `${TAG}A`)).toBe(true);

    expect(await resolveProductId(`${TAG}A`)).toBe(p1!.id);
  });

  it("la RÉFÉRENCE résout, et une référence inconnue ne retombe sur rien", async () => {
    const p = await ensureProduct({ dci: `${TAG}gamma`, dosage: "5", dosageUnit: "mg", form: "Gélule" });
    ids.push(p!.id);
    expect(await resolveProductId(p!.code)).toBe(p!.id);
    expect(await resolveProductId("PRD-1999-999")).toBeNull();
  });

  it("une DCI ambiguë ne rend RIEN de certain — elle se pose à l'humain", async () => {
    // Deux dosages de la même molécule existent (créés plus haut) : « …umab » seul ne tranche pas.
    const m = await resolveProductMention(`${TAG}umab`);
    expect(m.length).toBeGreaterThanOrEqual(2);
    expect(m.every((x) => x.certain === false)).toBe(true);
    expect(await resolveProductId(`${TAG}umab`)).toBeNull();

    // …et le dosage précisé tranche.
    expect(await resolveProductId(`${TAG}umab 100 mg`)).not.toBeNull();
  });
});
