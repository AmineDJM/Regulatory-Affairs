import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

let ACTEUR: unknown = null;
vi.mock("@/lib/session", () => ({
  requireUser: async () => ACTEUR,
  getUser: async () => ACTEUR,
  requireModule: async () => ACTEUR,
}));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { rattacherLegalAFiche, detacherLegalDeFiche } from "@/lib/actions/ad-pro-rattacher-legal";
// ⚠ ORDRE D'IMPORT IMPORTANT (documenté dans `assistant/capability-audit.test.ts`) :
// `ops/index.ts` et `lib/assistant.ts` forment un cycle d'INITIALISATION. Charger
// `assistant` d'abord — comme le fait l'application — donne l'ordre qui résout ;
// l'inverser fait échouer la SUITE ENTIÈRE sur « DOMAIN_TOOL_DEFS is not iterable ».
import "@/lib/assistant";
import { DOMAIN_TOOLS } from "@/lib/assistant/ops";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__ratlegal__";
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * BRANCHER UN DOCUMENT LEGAL EXISTANT — les DEUX droits, et rien de volé.
 *
 * Le bloc des pièces liées ne savait que CRÉER. Pour une convention déjà enregistrée dans Legal,
 * la seule issue était de la RECRÉER depuis la demande : deux lignes pour le même engagement,
 * deux montants dans les totaux, et celle qui porte les pièces jointes n'est pas celle qui porte
 * le lien.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
suite("Rattacher un document Legal existant à une fiche Ad & Pro", () => {
  let adminId = "", simpleId = "", docId = "", docAilleursId = "", sponsoId = "", autreSponsoId = "";

  beforeAll(async () => {
    const mk = (s: string, role: string) =>
      prisma.user.create({ data: { name: `${TAG}${s}`, email: `${TAG}${s}@t.dz`, role: role as never, passwordHash: "x" } });
    const [admin, simple] = await Promise.all([mk("admin", "SUPER_ADMIN"), mk("simple", "MEDICAL_DELEGATE")]);
    adminId = admin.id; simpleId = simple.id;

    const [spo, autre] = await Promise.all([
      prisma.sponsoringRequest.create({ data: { reference: `${TAG}SPO-1`, institution: `${TAG}CHU`, type: "Congrès", createdById: admin.id } }),
      prisma.sponsoringRequest.create({ data: { reference: `${TAG}SPO-2`, institution: `${TAG}Clinique`, type: "Congrès", createdById: admin.id } }),
    ]);
    sponsoId = spo.id; autreSponsoId = autre.id;

    const [libre, pris] = await Promise.all([
      prisma.legalDocument.create({ data: { title: `${TAG}Convention traiteur`, kind: "AGREEMENT", createdById: admin.id } }),
      prisma.legalDocument.create({
        data: { title: `${TAG}BC déjà rattaché`, kind: "PURCHASE_ORDER", createdById: admin.id, sourceType: "SPONSORING", sourceId: autre.id },
      }),
    ]);
    docId = libre.id; docAilleursId = pris.id;

    ACTEUR = { id: admin.id, role: "SUPER_ADMIN", secondaryRole: null, access: await getAccess(admin.id, "SUPER_ADMIN") } as unknown as SessionUser;
  });

  afterAll(async () => {
    await prisma.legalDocument.deleteMany({ where: { title: { startsWith: TAG } } }).catch(() => {});
    await prisma.sponsoringRequest.deleteMany({ where: { reference: { startsWith: TAG } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("un document LIBRE se rattache — et RIEN n'est recréé", async () => {
    const avant = await prisma.legalDocument.count({ where: { title: { startsWith: TAG } } });
    const r = await rattacherLegalAFiche(undefined, fd({ legalId: docId, entityType: "SPONSORING", entityId: sponsoId }));
    expect(r.ok, r.ok === false ? r.error : "").toBe(true);
    const doc = await prisma.legalDocument.findUniqueOrThrow({ where: { id: docId } });
    expect(doc.sourceType).toBe("SPONSORING");
    expect(doc.sourceId).toBe(sponsoId);
    // LE POINT ENTIER DE CETTE ACTION : le document n'est pas dupliqué.
    expect(await prisma.legalDocument.count({ where: { title: { startsWith: TAG } } })).toBe(avant);
  });

  it("rattacher DEUX FOIS à la même fiche est sans effet, et le DIT", async () => {
    const r = await rattacherLegalAFiche(undefined, fd({ legalId: docId, entityType: "SPONSORING", entityId: sponsoId }));
    expect(r.ok).toBe(true);
    expect(r.ok === true ? r.message : "").toContain("déjà rattaché");
  });

  it("un document DÉJÀ rattaché ailleurs n'est PAS volé — le refus nomme le geste", async () => {
    // Déplacer sans le dire retirerait une pièce d'un dossier que quelqu'un d'autre suit, et
    // personne ne saurait où elle est passée.
    const r = await rattacherLegalAFiche(undefined, fd({ legalId: docAilleursId, entityType: "SPONSORING", entityId: sponsoId }));
    expect(r.ok).toBe(false);
    expect(r.ok === false ? r.error : "").toContain("Détachez-le");
    const doc = await prisma.legalDocument.findUniqueOrThrow({ where: { id: docAilleursId } });
    expect(doc.sourceId, "le rattachement d'origine est INTACT").toBe(autreSponsoId);
  });

  it("SANS le droit sur la fiche cible : refus — rattacher, c'est écrire sur DEUX objets", async () => {
    // Ce qui le ferait tomber : ne vérifier que le document. N'importe qui ajouterait alors des
    // engagements à la demande d'un autre.
    ACTEUR = { id: simpleId, role: "MEDICAL_DELEGATE", secondaryRole: null, access: await getAccess(simpleId, "MEDICAL_DELEGATE") } as unknown as SessionUser;
    const libre = await prisma.legalDocument.create({ data: { title: `${TAG}Autre libre`, kind: "AGREEMENT", createdById: adminId } });
    const r = await rattacherLegalAFiche(undefined, fd({ legalId: libre.id, entityType: "SPONSORING", entityId: sponsoId }));
    expect(r.ok).toBe(false);
    const apres = await prisma.legalDocument.findUniqueOrThrow({ where: { id: libre.id } });
    expect(apres.sourceId, "aucune écriture sur un refus").toBeNull();
  });

  it("une nature de fiche qui ne porte pas de pièces est refusée AVANT toute lecture", async () => {
    ACTEUR = { id: adminId, role: "SUPER_ADMIN", secondaryRole: null, access: await getAccess(adminId, "SUPER_ADMIN") } as unknown as SessionUser;
    const r = await rattacherLegalAFiche(undefined, fd({ legalId: docId, entityType: "USER", entityId: adminId }));
    expect(r.ok).toBe(false);
    expect(r.ok === false ? r.error : "").toContain("ne porte pas de pièces");
  });

  it("DÉTACHER existe — sinon le refus précédent nommerait un geste qui n'existe pas", async () => {
    // §118.63 : un refus qui renvoie vers une action absente est une impasse déguisée en
    // explication. Ce qui le ferait tomber : retirer `detacherLegalDeFiche`.
    const r = await detacherLegalDeFiche(undefined, fd({ legalId: docId }));
    expect(r.ok, r.ok === false ? r.error : "").toBe(true);
    const doc = await prisma.legalDocument.findUniqueOrThrow({ where: { id: docId } });
    expect(doc.sourceId).toBeNull();
    expect(doc.sourceType).toBeNull();
    // Détaché, il redevient rattachable — la boucle est complète.
    const encore = await rattacherLegalAFiche(undefined, fd({ legalId: docId, entityType: "SPONSORING", entityId: sponsoId }));
    expect(encore.ok).toBe(true);
  });
});

/**
 * L'ÉCRAN : le bloc « Documents » générique a DISPARU des fiches Ad & Pro, et ce qui le remplace
 * doit être là. Propriétés de STRUCTURE — elles ne se voient pas dans le rendu d'un composant
 * isolé, c'est l'écran qui les porte (§118.75, §118.49).
 */
/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE MÊME GESTE DEPUIS LA CONVERSATION — et il fallait le prouver par le VRAI registre.
 *
 * L'écran offre le rattachement dans une liste déjà filtrée ; en conversation la personne
 * NOMME la pièce et la fiche. Ce banc part de `DOMAIN_TOOLS.legal_operation`, c'est-à-dire de
 * l'objet qu'Adam reçoit — pas de l'implémentation importée à la main : vérifier le corps
 * d'une fonction sans son point d'appel ne prouve rien (§118.49), et c'est ce câblage
 * (catalogue → enum de l'outil → implémentation) qui rend l'op réellement atteignable.
 *
 * Ce que le banc EXIGE, et ce qui le ferait tomber :
 *   • la carte NOMME la pièce ET la fiche — sans l'une des deux on validerait à l'aveugle ;
 *   • `execute` ÉCRIT, vérifié en base par le lien `sourceType`/`sourceId` — une carte qui
 *     s'affiche n'est pas une écriture (§118.81) ;
 *   • un nom qui désigne DEUX fiches ne rattache RIEN et le refus nomme les candidates —
 *     collapser choisirait le dossier à la place d'un humain (§118.34) ;
 *   • une pièce libre refuse le DÉTACHEMENT au lieu de rendre un succès vide (§118.25).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
suite("Le même rattachement depuis la conversation (legal_operation)", () => {
  const TAG2 = "__ratop__";
  let adminId = "", docId = "", spoId = "", homonymeAId = "", homonymeBId = "", croiseSpoId = "", croiseEvtId = "";

  beforeAll(async () => {
    const admin = await prisma.user.create({
      data: { name: `${TAG2}admin`, email: `${TAG2}admin@t.dz`, role: "SUPER_ADMIN" as never, passwordHash: "x" },
    });
    adminId = admin.id;
    const [spo, homA, homB] = await Promise.all([
      prisma.sponsoringRequest.create({ data: { reference: `${TAG2}SPO-7`, institution: `${TAG2}CHU Oran`, type: "Congrès", createdById: admin.id } }),
      prisma.sponsoringRequest.create({ data: { reference: `${TAG2}AMBI-A`, institution: `${TAG2}Ambigu`, type: "Congrès", createdById: admin.id } }),
      prisma.sponsoringRequest.create({ data: { reference: `${TAG2}AMBI-B`, institution: `${TAG2}Ambigu`, type: "Congrès", createdById: admin.id } }),
    ]);
    spoId = spo.id; homonymeAId = homA.id; homonymeBId = homB.id;
    // AMBIGUÏTÉ CROISÉE : UNE seule fiche par nature, mais DEUX natures répondent. C'est une
    // branche DISTINCTE de l'ambiguïté interne ci-dessus (`candidats` de `resoudreCible`) —
    // ici chaque résolution rend un `retenu` d'un élément, et c'est le CUMUL qui est ambigu.
    // Sans ce cas, la branche `trouves.length > 1` n'était couverte par rien : mesuré par
    // sabotage (collapser sur le premier laissait passer 14/14).
    const [croiseSpo, croiseEvt] = await Promise.all([
      prisma.sponsoringRequest.create({ data: { reference: `${TAG2}CROISE-S`, institution: `${TAG2}Soirée Béjaïa`, type: "Congrès", createdById: admin.id } }),
      prisma.event.create({ data: { name: `${TAG2}Soirée Béjaïa`, type: "SCIENTIFIC_DAY" as never, createdById: admin.id } }),
    ]);
    croiseSpoId = croiseSpo.id; croiseEvtId = croiseEvt.id;
    const doc = await prisma.legalDocument.create({
      data: { title: `${TAG2}Convention Sanofi 2026`, kind: "AGREEMENT", createdById: admin.id },
    });
    docId = doc.id;
    ACTEUR = { id: admin.id, role: "SUPER_ADMIN", secondaryRole: null, access: await getAccess(admin.id, "SUPER_ADMIN") } as unknown as SessionUser;
  });

  afterAll(async () => {
    await prisma.legalDocument.deleteMany({ where: { title: { startsWith: TAG2 } } }).catch(() => {});
    await prisma.sponsoringRequest.deleteMany({ where: { reference: { startsWith: TAG2 } } }).catch(() => {});
    await prisma.event.deleteMany({ where: { name: { startsWith: TAG2 } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG2 } } }).catch(() => {});
  });

  // `ops[nom]` porte { meta, impl } : on passe par CE chemin, celui que le runtime emprunte.
  const op = (nom: "link_record" | "unlink_record") => {
    const entree = DOMAIN_TOOLS.legal_operation.ops[nom];
    expect(entree, `legal_operation/${nom} absente du registre de production`).toBeDefined();
    return entree.impl;
  };
  const carteDe = (fields: { label: string; value: string }[]): string =>
    fields.map((f) => `${f.label}=${f.value}`).join(" | ");
  const acteur = () => ACTEUR as Parameters<ReturnType<typeof op>["propose"]>[1];

  it("l'op EXISTE dans l'outil qu'Adam reçoit — catalogue, enum et implémentation câblés", () => {
    const schema = DOMAIN_TOOLS.legal_operation.def.input_schema as { properties: { op: { enum: string[] } } };
    expect(schema.properties.op.enum).toContain("link_record");
    expect(schema.properties.op.enum).toContain("unlink_record");
    // La description de l'outil DIT que la pièce se branche : sans ce mot, le modèle recréerait
    // l'engagement au lieu de le rattacher — ce que le code exige, le prompt doit l'offrir (§118.19).
    expect(DOMAIN_TOOLS.legal_operation.def.description).toContain("BRANCHER");
  });

  it("« rattache la Convention Sanofi à SPO-7 » : la carte NOMME les deux, puis ÉCRIT", async () => {
    const draft = await op("link_record").propose({ reference: `${TAG2}Convention Sanofi`, target: `${TAG2}SPO-7` }, acteur());
    expect("error" in draft ? draft.error : "", "la proposition a été refusée").toBe("");
    if ("error" in draft) return;
    expect(draft.title).toContain("Convention Sanofi");
    const carte = carteDe(draft.fields);
    expect(carte).toContain("Convention Sanofi");
    expect(carte).toContain(`${TAG2}SPO-7`);
    expect(draft.warnings?.join(" ")).toContain("SANS COPIE");

    const r = await op("link_record").execute(draft.args, acteur());
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    // L'ÉCRITURE, en base : une carte qui s'affiche n'est pas une écriture.
    const apres = await prisma.legalDocument.findUnique({ where: { id: docId }, select: { sourceType: true, sourceId: true } });
    expect(apres?.sourceType).toBe("SPONSORING");
    expect(apres?.sourceId).toBe(spoId);
    // Et RIEN n'a été recréé : la pièce reste unique.
    expect(await prisma.legalDocument.count({ where: { title: { startsWith: TAG2 } } })).toBe(1);
  });

  it("un nom qui désigne DEUX fiches ne rattache RIEN, et le refus les nomme", async () => {
    const draft = await op("link_record").propose({ reference: `${TAG2}Convention Sanofi`, target: `${TAG2}Ambigu` }, acteur());
    expect("error" in draft).toBe(true);
    if (!("error" in draft)) return;
    expect(draft.error).toMatch(/AMBI-A|Plusieurs|précis/i);
    // Le lien n'a pas bougé : refuser, c'est ne rien écrire.
    const apres = await prisma.legalDocument.findUnique({ where: { id: docId }, select: { sourceId: true } });
    expect(apres?.sourceId).toBe(spoId);
    expect([homonymeAId, homonymeBId].every(Boolean)).toBe(true);
  });

  it("un nom porté par DEUX NATURES ne rattache RIEN — et le refus dit de préciser la nature", async () => {
    // Un sponsoring ET un événement portent « Soirée Béjaïa » : chaque nature rend UNE cible
    // certaine, donc l'ambiguïté n'est pas dans `candidats` mais dans le CUMUL. Choisir la
    // première rattacherait la pièce à l'un des deux dossiers au hasard (§118.34).
    const draft = await op("link_record").propose({ reference: `${TAG2}Convention Sanofi`, target: `${TAG2}Soirée Béjaïa` }, acteur());
    expect("error" in draft, "l'ambiguïté CROISÉE doit être refusée").toBe(true);
    if (!("error" in draft)) return;
    expect(draft.error).toContain("2 fiches");
    expect(draft.error).toMatch(/nature/i);
    expect([croiseSpoId, croiseEvtId].every(Boolean)).toBe(true);
    // Et la pièce est restée là où elle était.
    const apres = await prisma.legalDocument.findUnique({ where: { id: docId }, select: { sourceId: true } });
    expect(apres?.sourceId).toBe(spoId);
  });

  it("une fiche hors des natures rattachables est refusée en NOMMANT l'écran qui sait", async () => {
    const draft = await op("link_record").propose({ reference: `${TAG2}Convention Sanofi`, target: "peu importe", nature: "matériel promotionnel" }, acteur());
    expect("error" in draft).toBe(true);
    if ("error" in draft) expect(draft.error).toContain("écran");
  });

  it("DÉTACHER dit DE QUOI, puis écrit — et refuse sur une pièce libre", async () => {
    const draft = await op("unlink_record").propose({ reference: `${TAG2}Convention Sanofi` }, acteur());
    expect("error" in draft ? draft.error : "").toBe("");
    if ("error" in draft) return;
    expect(carteDe(draft.fields)).toContain("sponsoring");

    const r = await op("unlink_record").execute(draft.args, acteur());
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const apres = await prisma.legalDocument.findUnique({ where: { id: docId }, select: { sourceId: true } });
    expect(apres?.sourceId).toBeNull();

    // Deuxième détachement : un succès vide serait un faux succès (§118.25).
    const encore = await op("unlink_record").propose({ reference: `${TAG2}Convention Sanofi` }, acteur());
    expect("error" in encore).toBe(true);
    if ("error" in encore) expect(encore.error).toContain("rien à détacher");
  });
});

describe("les fiches Ad & Pro n'ont plus de dépôt générique — et gardent leurs pièces", () => {
  const lire = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
  const ECRANS = [
    "src/app/(app)/sponsoring/[id]/page.tsx",
    "src/app/(app)/events/[id]/page.tsx",
    "src/app/(app)/congress-international/[id]/page.tsx",
    "src/app/(app)/congress-national/[id]/page.tsx",
  ];

  it("plus AUCUN bloc « Documents » générique sur les fiches Ad & Pro", () => {
    // Ce qui le ferait tomber : le remettre. On y déposait à la main ce qui aurait dû être une
    // pièce du circuit, si bien que la même dépense existait deux fois — un fichier posé là et
    // un engagement dans Legal, aucun des deux ne sachant que l'autre existait.
    for (const f of [...ECRANS, "src/app/(app)/congress-international/congress-detail-view.tsx"]) {
      expect(lire(f), `${f} porte encore un bloc « Documents » générique`).not.toMatch(/CardTitle>Documents</);
    }
  });

  it("les QUATRE écrans montent le bloc des pièces liées AVEC l'emplacement nommé et les droits", () => {
    // LA MOITIÉ QUI COMPTE : retirer le dépôt générique SANS ceci aurait rendu invisible la
    // demande du médecin — obligatoire à la création, et le document que tout le circuit lit.
    for (const f of ECRANS) {
      const src = lire(f);
      expect(src, `${f} : pas de bloc de pièces liées`).toContain("<LinkedRecords");
      expect(src, `${f} : les pièces de la demande n'ont pas d'emplacement nommé`).toContain("piecesDeLaDemande");
      expect(src, `${f} : les droits sur les pièces liées ne sont pas passés`).toContain("ctxPieces.acces");
      expect(src, `${f} : rien à rattacher — le bouton n'apparaîtrait jamais`).toContain("ctxPieces.candidatsLegal");
    }
  });

  it("les droits viennent du MÊME calcul pour les quatre — quatre orthographes en oublieraient un", () => {
    // C'est le défaut mesuré de `ad-pro/attachments.ts` : « chacun l'épelait à sa façon, et
    // chaque orthographe oubliait quelqu'un, qui envoyait alors la facture par mail avec un
    // dossier vide ».
    for (const f of ECRANS) {
      expect(lire(f), `${f} recalcule les droits au lieu de lire le contexte partagé`).toContain("contextePiecesLiees(user,");
    }
  });
});
