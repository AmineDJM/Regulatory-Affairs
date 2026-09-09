import { describe, expect, it } from "vitest";
import { contratsDuFichier, decrireAction, direContrat, lireArguments, type TableEnums } from "./contrat";
import { scannerContrats } from "./contrat-scan";
import { CONTRATS_ACTIONS, CONTRAT_PAR_ID } from "./contrat.genere";
import { ACTION_CLASSIFICATION } from "@/lib/assistant/action-registry";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CLIQUET S'INVERSE.
 *
 * `action-parity.test.ts` compte les actions COUVERTES vers le haut : il prouve qu'aucun bouton
 * n'est un trou silencieux, et c'est ce qu'il doit faire. Mais compter vers le haut ne dit rien
 * du COÛT : on peut couvrir 712 actions en écrivant 712 fiches, et c'est exactement le travail
 * que le dirigeant a refusé — « je veux pas la capacité de retirer classe thérapeutique, je
 * veux la capacité de tout faire ».
 *
 * Ce cliquet-ci compte les actions NON DESCRIPTIBLES vers le BAS. Il ne récompense pas l'effort,
 * il mesure ce qui reste hors de portée du chemin générique. Combler un trou l'abaisse ; écrire
 * une action que la dérivation ne sait pas lire le fait ÉCHOUER, dans la même revue de code.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LE PLAFOND, mesuré le 09/09/2026 sur 715 actions.
 *
 * 117 → 77 (même jour, lecture des ARGUMENTS) : 638 appelables (89 %), 77 illisibles —
 *   27 dont les noms de champs sont calculés à l'exécution,
 *   27 à entrée typée que la signature ne dit pas à coup sûr (objet littéral, type importé,
 *      valeur par défaut) — plus UNE refusée pour son paramètre `userId` (§ identité d'acteur),
 *   23 sans lecture de champ trouvée.
 * Les 67 refus « entrée typée » IMPRIMAIENT la signature qu'ils déclaraient ne pas savoir
 * lire ; 40 sont désormais traduites (§118.34) et le reste dit ce qui manque.
 *
 * Il ne se relève JAMAIS sans une justification écrite ici, dans la même revue de code.
 */
const PLAFOND_ILLISIBLES = 77;

describe("CONTRAT D'ACTION — la dérivation LIT la source, elle ne l'invente pas", () => {
  // Une source ÉCRITE ICI : c'est le seul endroit où je connais la vérité indépendamment du
  // code testé. Mesurer la dérivation sur le vrai parc dirait seulement « elle est stable ».
  const SOURCE = `
"use server";
const MODULE = "REGULATORY" as const;
const STATUTS: Statut[] = ["OUVERT", "CLOS"];

export async function creerTruc(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "CREATE")) return { ok: false, error: "Non autorisé." };
  const titre = fdStr(formData, "titre");
  if (!titre) return { ok: false, error: "Le titre est obligatoire." };
  const montant = fdNum(formData, "montant");
  const echeance = fdDate(formData, "echeance");
  const actif = fdBool(formData, "actif");
  const dossierId = fdStr(formData, "dossierId");
  const statut = fdStr(formData, "statut");
  if (statut && !STATUTS.includes(statut as Statut)) return { ok: false, error: "Statut inconnu." };
  const etiquettes = formData.getAll("etiquette").map(String);
  await prisma.truc.create({ data: { titre, montant, echeance, actif, dossierId, statut, etiquettes } });
  await recordAudit({ actorId: user.id, action: "CREATE" });
  return { ok: true };
}

export async function bricoler(formData: FormData): Promise<ActionResult> {
  for (const [cle, valeur] of formData.entries()) await prisma.truc.update({ where: { id: cle }, data: { valeur } });
  return { ok: true };
}

export async function toutRevoquer(): Promise<ActionResult> {
  await prisma.session.deleteMany({ where: {} });
  return { ok: true };
}

export async function reglerPolitique(politique: MailPolicy, confirm?: string): Promise<ActionResult> {
  return { ok: true };
}
`;
  const contrats = contratsDuFichier("fixture", SOURCE);
  const par = new Map(contrats.map((c) => [c.fonction, c]));

  it("lit CHAQUE champ, son type, et rien de plus", () => {
    const c = par.get("creerTruc")!;
    expect(c.illisible).toBeNull();
    expect(c.champs.map((x) => `${x.nom}:${x.type}`)).toEqual([
      "actif:booleen", "dossierId:reference", "echeance:date",
      "etiquette:liste", "montant:nombre", "statut:texte", "titre:texte",
    ]);
  });

  it("OBLIGATOIRE veut dire « le code refuse sans lui » — prouvé, jamais supposé", () => {
    const c = par.get("creerTruc")!;
    expect(c.champs.find((x) => x.nom === "titre")!.obligatoire).toBe(true);
    // `montant` n'a aucune garde : non PROUVÉ obligatoire. L'omettre ferait au pire recevoir un
    // refus honnête de l'action ; le déclarer obligatoire ferait déranger un humain pour rien.
    expect(c.champs.find((x) => x.nom === "montant")!.obligatoire).toBe(false);
  });

  it("les valeurs admises se lisent quand la source les borne, et valent `null` sinon", () => {
    const c = par.get("creerTruc")!;
    expect(c.champs.find((x) => x.nom === "statut")!.valeurs).toEqual(["OUVERT", "CLOS"]);
    // `null` = NON LUES. Jamais « toutes » : le silence d'une fiche se lit comme une
    // permission de deviner (§118.26).
    expect(c.champs.find((x) => x.nom === "titre")!.valeurs).toBeNull();
  });

  it("la porte est LUE, et elle n'autorise rien — l'action revérifie à l'exécution", () => {
    const c = par.get("creerTruc")!;
    expect(c.porte.module).toBe("REGULATORY");
    expect(c.porte.verbe).toBe("CREATE");
    expect(c.ecrit).toBe(true);
    expect(c.audit).toBe(true);
  });

  it("SABOTAGE — un champ retiré de la source disparaît du contrat (l'assertion peut tomber)", () => {
    // §118.17 : une assertion dont on ne sait pas nommer le cas qui la ferait tomber n'en est
    // pas une. Voici ce cas, joué : sans cette ligne, la dérivation pourrait rendre une liste
    // figée et tous les tests ci-dessus passeraient quand même.
    const ampute = contratsDuFichier("fixture", SOURCE.replace(/\s*const montant = fdNum\(formData, "montant"\);/, ""));
    const c = ampute.find((x) => x.fonction === "creerTruc")!;
    expect(c.champs.map((x) => x.nom)).not.toContain("montant");
    expect(c.champs.map((x) => x.nom)).toContain("titre");
  });

  it("ce qui ne se lit pas à coup sûr le DIT, et ne porte AUCUN champ", () => {
    const dyn = par.get("bricoler")!;
    expect(dyn.illisible).toMatch(/calculés à l'exécution/);
    expect(dyn.champs).toEqual([]);

    const typee = par.get("reglerPolitique")!;
    expect(typee.appel).toBe("arguments");
    expect(typee.illisible).toMatch(/entrée typée/);
    expect(typee.champs).toEqual([]);
  });

  it("une action SANS entrée est appelable — il n'y a rien à ignorer", () => {
    const c = par.get("toutRevoquer")!;
    expect(c.appel).toBe("sans-entree");
    expect(c.illisible).toBeNull();
    expect(c.ecrit).toBe(true);
  });

  it("la cardinalité l'emporte sur ce que la valeur désigne — une liste d'`…Id` reste une LISTE", () => {
    // Le défaut réel : `setRowGrants` lit `getAll("rowId")`. Le nom finit par `Id`, donc la
    // première version rendait `reference` — et Adam aurait accordé UNE ligne sur vingt.
    const src = `export async function g(formData: FormData): Promise<ActionResult> {
      const userId = fdStr(formData, "userId");
      const ids = formData.getAll("rowId").map(String);
      await prisma.rowGrant.createMany({ data: ids.map((i) => ({ userId, entityId: i })) });
      return { ok: true };
    }`;
    const c = contratsDuFichier("f", src)[0]!;
    expect(c.champs.find((x) => x.nom === "rowId")!.type).toBe("liste");
    expect(c.champs.find((x) => x.nom === "userId")!.type).toBe("reference");
  });

  it("un énum du SCHÉMA se lit à travers le cast, dans ses deux formes réelles", () => {
    const enums: TableEnums = { Priorite: ["BASSE", "HAUTE"] };
    const direct = decrireAction(
      { fichier: "f", fonction: "a", signature: "formData: FormData",
        corps: `{ const p = fdStr(formData, "prio") as Priorite; }` }, {}, enums);
    expect(direct.champs[0]!.valeurs).toEqual(["BASSE", "HAUTE"]);
    // La forme qui avait échappé à la première version : la parenthèse ferme APRÈS le `??`.
    const defaute = decrireAction(
      { fichier: "f", fonction: "a", signature: "formData: FormData",
        corps: `{ const x = (fdStr(formData, "prio") ?? "BASSE") as Priorite; }` }, {}, enums);
    expect(defaute.champs[0]!.valeurs).toEqual(["BASSE", "HAUTE"]);
  });
});

describe("CONTRAT D'ACTION — le parc réel, et le cliquet qui ne remonte pas", () => {
  const vivants = scannerContrats();

  it("l'artefact versionné est EXACTEMENT ce que la source dit aujourd'hui", () => {
    // Le fichier généré n'est pas entretenu à la main : il est REDÉRIVÉ ici et comparé. Une
    // action ajoutée, un champ renommé, une garde déplacée → ce test tombe en nommant l'action,
    // et `npm run actions:contrat` le répare. C'est ce qui empêche l'artefact de mentir.
    const ecart = vivants.filter((v) => JSON.stringify(v) !== JSON.stringify(CONTRAT_PAR_ID.get(v.id)));
    const disparues = CONTRATS_ACTIONS.filter((c) => !vivants.some((v) => v.id === c.id));
    expect(
      [...ecart.map((e) => e.id), ...disparues.map((d) => `${d.id} (disparue)`)],
      "contrat.genere.ts a pris du retard sur la source → `npm run actions:contrat`",
    ).toEqual([]);
    expect(CONTRATS_ACTIONS.length).toBe(vivants.length);
  });

  it("CLIQUET INVERSÉ : le nombre d'actions hors du chemin générique ne remonte pas", () => {
    const illisibles = vivants.filter((c) => c.illisible);
    expect(
      illisibles.length,
      `Actions non descriptibles : ${illisibles.length} (plafond ${PLAFOND_ILLISIBLES}).\n` +
        `Une action AJOUTÉE que la dérivation ne sait pas lire doit être écrite autrement — ` +
        `champs lus par nom littéral — ou le plafond relevé ICI avec sa raison.\n` +
        illisibles.slice(0, 10).map((c) => `  ${c.id} — ${c.illisible}`).join("\n"),
    ).toBeLessThanOrEqual(PLAFOND_ILLISIBLES);

    const appelables = vivants.length - illisibles.length;
    console.info(`[CONTRAT_ACTION] ${appelables}/${vivants.length} actions décrites par dérivation (${Math.round(appelables / vivants.length * 100)} %) — ${illisibles.length} illisibles, plafond ${PLAFOND_ILLISIBLES}`);
  });

  it("INVARIANT DE SÛRETÉ : une action illisible ne porte JAMAIS de champs plausibles", () => {
    // C'est la propriété qui empêche le faux succès : si la dérivation ne sait pas lire une
    // action, elle ne doit pas rendre une liste qui RESSEMBLE à la bonne — Adam l'appellerait
    // avec des noms inventés et annoncerait que c'est fait.
    for (const c of vivants) {
      if (c.illisible) expect(c.champs, c.id).toEqual([]);
      else expect(c.illisible, c.id).toBeNull();
    }
  });

  it("les deux inventaires parlent du MÊME parc — aucune action connue d'un seul", () => {
    // §118.49 : un mécanisme qui n'est pas raccordé à son appelant est du code mort. Ici, deux
    // recensements indépendants du même parc : s'ils divergent, l'un des deux ment.
    const classees = new Set(Object.keys(ACTION_CLASSIFICATION));
    const decrites = new Set(vivants.map((c) => c.id));
    const seulementDecrites = [...decrites].filter((k) => !classees.has(k));
    const seulementClassees = [...classees].filter((k) => !decrites.has(k));
    expect({ seulementDecrites, seulementClassees }).toEqual({ seulementDecrites: [], seulementClassees: [] });
  });

  it("chaque champ `reference` est le pont vers le résolveur — et il y en a assez pour compter", () => {
    const refs = vivants.flatMap((c) => c.champs).filter((x) => x.type === "reference");
    expect(refs.length).toBeGreaterThan(300);
    // Une référence est un identifiant : jamais une liste de valeurs admises.
    for (const r of refs) expect(r.valeurs, r.nom).toBeNull();
  });

  it("la phrase rendue au modèle dit l'ignorance au lieu de la taire", () => {
    const illisible = vivants.find((c) => c.illisible)!;
    expect(direContrat(illisible)).toMatch(/non appelable directement/);
    const lisible = vivants.find((c) => !c.illisible && c.champs.length > 2)!;
    expect(direContrat(lisible)).toContain(lisible.champs[0]!.nom);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LIRE UNE SIGNATURE — et refuser tout entier ce qu'on ne lit pas tout entier.
 *
 * 67 refus imprimaient la signature qu'ils déclaraient ne pas savoir lire. Ce qui suit mesure
 * les deux moitiés : ce qu'on traduit maintenant, et ce qu'on continue de refuser — le second
 * comptant plus que le premier, parce qu'un appel positionnel mal lu ne DÉGRADE pas, il
 * DÉCALE.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("ARGUMENTS — un appel positionnel se lit tout entier, ou pas du tout", () => {
  const champs = (sig: string) => {
    const r = lireArguments(sig);
    return "champs" in r ? r.champs : null;
  };
  const refus = (sig: string) => {
    const r = lireArguments(sig);
    return "refus" in r ? r.refus : null;
  };

  it("les types simples se lisent, DANS L'ORDRE — c'est l'ordre qui fait l'appel", () => {
    expect(champs("id: string, name: string, path?: string")).toEqual([
      { nom: "id", type: "reference", obligatoire: true, valeurs: null },
      { nom: "name", type: "texte", obligatoire: true, valeurs: null },
      { nom: "path", type: "texte", obligatoire: false, valeurs: null },
    ]);
  });

  it("booléen, nombre et liste gardent leur nature — « on » n'est pas un booléen", () => {
    expect(champs("paused: boolean")).toEqual([{ nom: "paused", type: "booleen", obligatoire: true, valeurs: null }]);
    expect(champs("year: number, month: number")?.map((c) => c.type)).toEqual(["nombre", "nombre"]);
    expect(champs("ids: string[]")?.[0]?.type).toBe("liste");
  });

  it("une union de littéraux DONNE ses valeurs admises — on ne les devine pas", () => {
    expect(champs('decision: "GRANTED" | "REFUSED"')).toEqual([
      { nom: "decision", type: "texte", obligatoire: true, valeurs: ["GRANTED", "REFUSED"] },
    ]);
  });

  it("`| null` accepte l'absence de VALEUR, jamais l'absence d'ARGUMENT", () => {
    // Sauter le rang décalerait tous les suivants : le champ reste obligatoire.
    expect(champs("threadId: string | null")?.[0]?.obligatoire).toBe(true);
    expect(champs("q: string | undefined")?.[0]?.obligatoire).toBe(false);
  });

  it("`missionId` désigne une mission des DEUX côtés — pas deux conventions selon l'appel", () => {
    expect(champs("missionId: string")?.[0]?.type).toBe("reference");
    expect(champs("motif: string")?.[0]?.type).toBe("texte");
  });

  it("UN paramètre illisible rend TOUTE la signature illisible", () => {
    // LE CAS QUI FERAIT TOMBER CETTE ASSERTION : une lecture partielle. Elle rendrait ici
    // [id, title] pour une fonction dont le second argument est un objet — l'appel passerait
    // le titre au rang de l'objet, et l'action écrirait n'importe quoi sans une erreur.
    expect(champs("id: string, input: { title?: string; kind?: string }")).toBeNull();
    expect(refus("id: string, input: { title?: string }")).toMatch(/n'est pas une valeur simple/);
  });

  it("une valeur par défaut n'est pas une entrée — c'est un calcul du code", () => {
    // `now = new Date()` : la remplir depuis une demande ferait écrire une date choisie par un
    // modèle là où le code voulait « maintenant ».
    expect(champs("departmentId: string, now = new Date()")).toBeNull();
    expect(refus("now = new Date()")).toMatch(/valeur par défaut/);
  });

  it("SÉCURITÉ : un paramètre qui porte l'identité de l'ACTEUR ferme la signature", () => {
    // Une action qui reçoit son auteur au lieu de le lire dans la session fait confiance à son
    // appelant. Le bouton est un appelant sûr, un modèle ne l'est pas : accepter ce paramètre
    // permettrait d'écrire dans la mémoire de quelqu'un d'autre.
    expect(champs("userId: string, threadId: string, contenu: string")).toBeNull();
    expect(refus("userId: string, contenu: string")).toMatch(/identité de l'ACTEUR/);
    // Et la garde ne déborde PAS sur les identifiants d'objets, qui sont tout le parc.
    expect(champs("taskId: string, employeeId: string")).not.toBeNull();
  });

  it("le parc réel : les actions à arguments décrites portent des champs, les autres AUCUN", () => {
    const parArgs = CONTRATS_ACTIONS.filter((c) => c.appel === "arguments");
    expect(parArgs.length).toBeGreaterThan(60);
    for (const c of parArgs) {
      if (c.illisible) expect(c.champs, `${c.id} annonce des champs alors qu'elle est illisible`).toEqual([]);
      else expect(c.champs.length, `${c.id} est décrite sans un seul champ`).toBeGreaterThan(0);
    }
  });
});
