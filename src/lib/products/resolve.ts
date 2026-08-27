import { prisma } from "@/lib/prisma";
import { moleculeStem } from "@/lib/market/galenic";
import {
  aliasKey, certainMatch, identityKey, parseMention, resolveProduct,
  type ProductCandidate, type ProductMatch,
} from "./identity";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA RÉSOLUTION BRANCHÉE — la lecture, séparée de la décision.
 *
 * La DÉCISION (« cette mention désigne-t-elle ce produit ? ») vit dans `identity.ts`, pure et
 * éprouvée au cas près. ICI, on ne fait que CHARGER les bons candidats et appeler cette
 * décision. La séparation n'est pas une élégance : c'est ce qui permet de vérifier la règle
 * métier sans base de test, donc de la vérifier vraiment.
 *
 * ── POURQUOI ON NE CHARGE PAS TOUT LE CATALOGUE ──────────────────────────────────────────
 *
 * Un `findMany()` complet marcherait aujourd'hui et deviendrait une lecture de plusieurs
 * milliers de lignes à chaque mention de produit dans une conversation. Le pré-filtre SQL est
 * volontairement LARGE (radical de la molécule, alias exact, référence) : il ne décide de rien,
 * il réduit. C'est la fonction pure qui tranche ensuite, sur un lot borné.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const CANDIDATE_CAP = 60;

/** Le produit tel que la décision pure l'attend — même forme, chargée depuis la base. */
function toCandidate(row: {
  id: string; code: string; canonicalName: string; identityKey: string; dci: string;
  dosage: string | null; dosageUnit: string | null; form: string | null; packaging: string | null;
  aliases: { label: string }[];
}): ProductCandidate {
  return { ...row, aliases: row.aliases.map((a) => a.label) };
}

const SELECT = {
  id: true, code: true, canonicalName: true, identityKey: true, dci: true,
  dosage: true, dosageUnit: true, form: true, packaging: true,
  aliases: { select: { label: true } },
} as const;

/**
 * RÉSOUT UNE MENTION VERS UN PRODUIT. Rend TOUTES les correspondances du meilleur degré —
 * plusieurs résultats certains signifient une ambiguïté RÉELLE, que l'appelant doit poser à
 * l'humain plutôt que trancher.
 */
export async function resolveProductMention(mention: string): Promise<ProductMatch[]> {
  const brut = (mention ?? "").trim();
  if (!brut) return [];

  const cle = aliasKey(brut);
  const radical = moleculeStem(parseMention(brut).dci);
  // Le premier MOT du radical suffit à pré-filtrer : « NIVOLUMAB » pour « nivolumab 100 mg ».
  const amorce = radical.split(" ")[0] ?? "";

  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { code: { equals: brut, mode: "insensitive" } },
        { aliases: { some: { key: cle } } },
        { canonicalName: { equals: brut, mode: "insensitive" } },
        ...(amorce.length >= 3 ? [{ dci: { contains: amorce.slice(0, 6), mode: "insensitive" as const } }] : []),
      ],
    },
    select: SELECT,
    take: CANDIDATE_CAP,
  });

  return resolveProduct(brut, rows.map(toCandidate));
}

/** Le produit CERTAIN, ou `null`. La forme dont une capability a besoin neuf fois sur dix. */
export async function resolveProductId(mention: string): Promise<string | null> {
  const m = certainMatch(await resolveProductMention(mention));
  return m ? m.product.id : null;
}

/**
 * TROUVE OU CRÉE le produit canonique d'un tuple d'identité.
 *
 * L'unicité de `identityKey` est portée par la BASE : deux imports concurrents ne peuvent pas
 * créer deux fois le même produit, et on n'a pas à s'en remettre à un verrou applicatif.
 * `upsert` traduit exactement cette garantie.
 *
 * Rend `null` quand le tuple ne produit AUCUNE clé (DCI vide) — on n'indexe pas le vide, et
 * créer un produit sans identité serait créer le doublon qu'on cherche à éviter.
 */
export async function ensureProduct(input: {
  dci: string;
  canonicalName?: string | null;
  dosage?: string | null;
  dosageUnit?: string | null;
  form?: string | null;
  packaging?: string | null;
  /// Les valeurs de l'ERP : RETAIL (ville / officine), HOSPITAL, BOTH.
  channel?: "RETAIL" | "HOSPITAL" | "BOTH";
  companyId?: string | null;
  lifecycle?: string;
}): Promise<{ id: string; code: string; created: boolean } | null> {
  const key = identityKey(input);
  if (!key) return null;

  const existant = await prisma.product.findUnique({ where: { identityKey: key }, select: { id: true, code: true } });
  if (existant) return { ...existant, created: false };

  const code = await nextProductCode();
  const nom = (input.canonicalName ?? "").trim()
    || [input.dci, input.dosage, input.dosageUnit].filter(Boolean).join(" ").trim();

  const cree = await prisma.product.upsert({
    where: { identityKey: key },
    // Course perdue : l'autre écrivain a créé le produit entre notre lecture et notre écriture.
    // On ne remonte PAS ses champs — le premier arrivé fait foi, et écraser serait pire que ne
    // rien faire.
    update: {},
    create: {
      code, canonicalName: nom, identityKey: key,
      dci: input.dci.trim(),
      dosage: input.dosage ?? null, dosageUnit: input.dosageUnit ?? null,
      form: input.form ?? null, packaging: input.packaging ?? null,
      channel: input.channel ?? "BOTH",
      companyId: input.companyId ?? null,
      lifecycle: input.lifecycle ?? "STUDY",
    },
    select: { id: true, code: true },
  });
  return { ...cree, created: cree.code === code };
}

/** `PRD-AAAA-NNN`, dans la même forme que les autres références de l'ERP. */
async function nextProductCode(): Promise<string> {
  const annee = new Date().getFullYear();
  const dernier = await prisma.product.findFirst({
    where: { code: { startsWith: `PRD-${annee}-` } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const n = dernier ? Number(dernier.code.split("-")[2] ?? 0) + 1 : 1;
  return `PRD-${annee}-${String(n).padStart(3, "0")}`;
}

/**
 * ENREGISTRE UN ALIAS. Rend `false` si l'alias appartient DÉJÀ à un autre produit — la base
 * l'interdit, et on préfère le dire que de le voler en silence : un alias volé fait répondre
 * sur le mauvais produit sans que personne ne comprenne pourquoi.
 */
export async function addProductAlias(
  productId: string,
  label: string,
  opts: { source?: string; createdById?: string | null } = {},
): Promise<boolean> {
  const key = aliasKey(label);
  if (!key) return false;
  const existant = await prisma.productAlias.findUnique({ where: { key }, select: { productId: true } });
  if (existant) return existant.productId === productId;
  await prisma.productAlias.create({
    data: { productId, label: label.trim(), key, source: opts.source ?? "MANUAL", createdById: opts.createdById ?? null },
  });
  return true;
}
