/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONTRAT D'UNE ACTION — DÉRIVÉ DE SA SOURCE, JAMAIS DÉCLARÉ À CÔTÉ.
 *
 * ── POURQUOI PAS UNE TABLE ÉCRITE À LA MAIN ──────────────────────────────────────────────
 *
 * L'ERP porte 712 actions serveur. Pour qu'Adam puisse en appeler UNE QUELCONQUE, il lui faut
 * savoir ce qu'elle attend. La façon évidente — écrire une fiche par action — a été mesurée
 * ailleurs dans ce dépôt : 520 déclarations d'op, 503 propose/execute, 117 résolveurs. Elle
 * produit exactement le défaut que le dirigeant a nommé : on ajoute la capacité de retirer
 * « classe thérapeutique », pas la capacité de tout faire. Et une table écrite à la main est
 * fausse le jour où quelqu'un ajoute un champ sans y penser — silencieusement.
 *
 * §118.17 : un garde-fou s'arme sur un FAIT DU PROCESSUS, jamais sur une variable qu'un auteur
 * futur devrait penser à poser. Ici le fait est la SOURCE de l'action. Le contrat se dérive
 * d'elle, donc il ne peut pas prendre de retard sur elle.
 *
 * Contrainte qui a décidé de la forme : un fichier `"use server"` ne peut EXPORTER que des
 * fonctions asynchrones. Le contrat ne peut donc pas vivre dans le fichier de l'action ; il
 * est LU depuis lui. Ce module est la lecture — pur, sans un seul import, testable sur une
 * chaîne de caractères, et exécutable partout (§ frontière client/serveur).
 *
 * ── CE QU'IL REFUSE DE DEVINER ───────────────────────────────────────────────────────────
 *
 * Trois choses seulement doivent être EXACTES, parce qu'une erreur sur elles produit un faux
 * succès : l'identité de l'action, les noms de ses champs, et le fait qu'elle écrive. Le reste
 * (le libellé du module, l'indice de porte) peut être approximatif SANS DANGER, parce que
 * l'action revérifie ses droits à l'exécution — la porte lue ici n'autorise rien, elle sert à
 * ne pas proposer ce que la personne ne peut pas faire.
 *
 * Quand les champs ne se lisent PAS à coup sûr, le contrat le DIT (`illisible`) au lieu de
 * rendre une liste plausible (§118.26 : le silence d'une fiche se lit comme une permission de
 * deviner). Une action illisible n'est pas appelable génériquement — sans quoi Adam la
 * appellerait avec des noms de champs inventés, recevrait `{ ok: false }` ou, pire, un
 * `{ ok: true }` n'ayant rien modifié, et annoncerait que c'est fait.
 *
 * `obligatoire: true` veut dire « le code REFUSE sans ce champ », prouvé par sa garde. `false`
 * veut dire « non prouvé obligatoire », pas « facultatif » — et l'asymétrie est voulue : se
 * tromper dans ce sens fait recevoir un refus honnête (« Le nom est obligatoire. »), se
 * tromper dans l'autre ferait déranger un humain pour rien.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce qu'un champ attend. `reference` désigne une autre fiche — le pont vers `resoudreCible`. */
export type TypeChamp = "texte" | "nombre" | "date" | "booleen" | "liste" | "reference";

export interface ChampAction {
  nom: string;
  type: TypeChamp;
  /** Le code refuse-t-il SANS ce champ ? `true` = prouvé par sa garde, jamais supposé. */
  obligatoire: boolean;
  /** Les valeurs admises quand elles se lisent. `null` = NON LUES (jamais « toutes »). */
  valeurs: readonly string[] | null;
}

/** Ce que la source déclare de sa porte. N'AUTORISE RIEN : l'action revérifie à l'exécution. */
export interface PorteLue {
  /** Le module RBAC (« REGULATORY »), quand un `userCan` le nomme. */
  module: string | null;
  /** Le verbe RBAC (« CREATE », « UPDATE »…). */
  verbe: string | null;
  /** Le type d'entité d'un `canAccessEntity`, quand il y en a un. */
  entite: string | null;
  /** Les gardes reconnues, telles qu'écrites (`requireAdmin`, `requireChief`…). */
  gardes: readonly string[];
}

export interface ContratAction {
  /** `fichier:fonction` — la même clé que le registre de parité, pour qu'ils se recoupent. */
  id: string;
  fichier: string;
  fonction: string;
  /**
   * COMMENT ON L'APPELLE — et ce n'est pas cosmétique.
   *
   * 98 actions de l'ERP sont des `useActionState` : elles reçoivent l'ÉTAT PRÉCÉDENT avant le
   * formulaire. Appeler `f(formData)` sur l'une d'elles lui ferait lire un formulaire là où
   * elle attend un état, et le vrai formulaire n'arriverait jamais — sans erreur, sans effet,
   * et avec un `{ ok: … }` à l'air normal. Le faux succès parfait, pour une virgule.
   */
  appel: "formulaire" | "etat-formulaire" | "arguments" | "sans-entree";
  champs: readonly ChampAction[];
  porte: PorteLue;
  /** L'action écrit-elle en base ? Lu sur les effets réellement présents dans le corps. */
  ecrit: boolean;
  /**
   * LES MODÈLES QU'ELLE ÉCRIT, lus sur ses appels Prisma.
   *
   * C'est le FAIT sur lequel s'arme l'interdiction d'auto-escalade (`generique.ts`). Une garde
   * qui reconnaîtrait les actions sensibles à leur NOM raterait `updateUserRole` — aucun des
   * motifs de `policy/guard.ts` n'attrape ce camel-case — et raterait surtout celle que
   * quelqu'un nommera autrement demain. Le modèle écrit, lui, ne se renomme pas pour échapper
   * à une garde.
   */
  modelesEcrits: readonly string[];
  /** L'action laisse-t-elle une trace d'audit ? */
  audit: boolean;
  /**
   * POURQUOI ON NE PEUT PAS L'APPELER GÉNÉRIQUEMENT — `null` quand on le peut.
   * Une phrase, pas un code : c'est ce qu'un modèle et un humain lisent tous les deux.
   */
  illisible: string | null;
}

/** Une action telle qu'on la trouve dans un fichier : sa signature et son corps. */
export interface SourceAction {
  fichier: string;
  fonction: string;
  signature: string;
  corps: string;
}

/** Les énums connus, fournis par l'appelant (Prisma les tient ; ce module reste pur). */
export type TableEnums = Readonly<Record<string, readonly string[]>>;

// ───────────────────────────────────────────────────────────────────────────────────────────
// DÉCOUPAGE DE LA SOURCE
// ───────────────────────────────────────────────────────────────────────────────────────────

const RE_ENTETE = /^export async function ([A-Za-z0-9_]+)\s*\(/gm;

/** Le contenu d'un couple de délimiteurs, par équilibrage. `null` si jamais refermé. */
function equilibrer(source: string, ouvre: number, o: string, f: string): { texte: string; fin: number } | null {
  if (source[ouvre] !== o) return null;
  let profondeur = 0;
  for (let i = ouvre; i < source.length; i++) {
    if (source[i] === o) profondeur++;
    else if (source[i] === f) {
      profondeur--;
      if (profondeur === 0) return { texte: source.slice(ouvre + 1, i), fin: i + 1 };
    }
  }
  return null;
}

/**
 * OÙ COMMENCE LE CORPS — la question a l'air triviale et ne l'est pas.
 *
 * Entre la parenthèse des paramètres et l'accolade du corps, il peut y avoir un type de retour,
 * et ce type peut CONTENIR une accolade : `Promise<{ ok: boolean; error?: string }>`. Prendre
 * « la prochaine accolade » découperait un corps qui commence au milieu du type de retour —
 * l'action rendrait alors moins de champs, ce qui ressemble à une action plus simple, jamais à
 * une erreur. On avance donc en suivant la profondeur des chevrons ET des accolades : le corps
 * s'ouvre à la première accolade rencontrée hors de tout type.
 */
function debutDuCorps(source: string, apresParams: number): number {
  let chevrons = 0;
  for (let i = apresParams; i < source.length; i++) {
    const c = source[i];
    if (c === "<") chevrons++;
    else if (c === ">") { if (chevrons > 0) chevrons--; }
    else if (c === "{") { if (chevrons === 0) return i; }
    else if (c === ";" && chevrons === 0) return -1; // une surcharge sans corps
  }
  return -1;
}

/**
 * Les actions exportées d'un fichier, avec leur signature et leur corps.
 *
 * Le découpage se fait par ÉQUILIBRAGE, pas par expression régulière : une première version
 * exigeait `)\s*:` — donc un type de retour — et perdait en silence les trois actions qui n'en
 * déclarent pas. C'est le recoupement avec le registre de parité qui l'a dit ; seul, ce module
 * aurait affiché « 709 actions » avec l'assurance d'en avoir vu 712.
 */
export function decouperActions(fichier: string, source: string): SourceAction[] {
  const out: SourceAction[] = [];
  RE_ENTETE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_ENTETE.exec(source)) !== null) {
    const params = equilibrer(source, m.index + m[0].length - 1, "(", ")");
    if (!params) continue;
    const ouvre = debutDuCorps(source, params.fin);
    if (ouvre < 0) continue;
    const corps = equilibrer(source, ouvre, "{", "}");
    out.push({
      fichier, fonction: m[1]!,
      signature: params.texte.replace(/\s+/g, " ").trim(),
      corps: corps ? `{${corps.texte}}` : source.slice(ouvre),
    });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────────────────────
// LES VALEURS ADMISES
// ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Les listes de littéraux déclarées EN TÊTE d'un fichier (`const STATUTS: T[] = [...]`,
 * `new Set([...])`). C'est la forme sous laquelle l'ERP écrit ses allowlists.
 */
export function enumsLocaux(source: string): TableEnums {
  const table: Record<string, readonly string[]> = {};
  const re = /^const\s+([A-Za-z_0-9]+)(?:\s*:\s*[A-Za-z0-9_<>\[\]| ]+)?\s*=\s*(?:new Set\()?\[([^\]]*)\]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const valeurs = [...m[2]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!);
    if (valeurs.length >= 2) table[m[1]!] = valeurs;
  }
  return table;
}

// ───────────────────────────────────────────────────────────────────────────────────────────
// LA LECTURE D'UNE ACTION
// ───────────────────────────────────────────────────────────────────────────────────────────

const TYPE_PAR_HELPER: Readonly<Record<string, TypeChamp>> = {
  fdStr: "texte", fdNum: "nombre", fdDate: "date", fdBool: "booleen",
};

/** `id`, `userId`, `dossierId`… désignent une autre fiche. C'est le pont vers `resoudreCible`. */
const estReference = (nom: string): boolean => nom === "id" || /[a-z0-9]Id$/.test(nom);

/**
 * Le nom du champ est-il CALCULÉ à l'exécution ? Alors on ne peut rien annoncer.
 *
 * Le test porte sur le premier caractère non blanc après la virgule (ou la parenthèse) : un
 * guillemet est un littéral, autre chose est une variable. Une première version testait
 * `[^"]` juste après la virgule et comptait 563 actions sur 619 comme dynamiques — parce
 * qu'un retour à la ligne n'est pas un guillemet. Un détecteur trop large aurait fermé la
 * porte à 90 % du parc en annonçant l'avoir ouverte.
 */
function lectureDynamique(corps: string): boolean {
  return /\b(?:fdStr|fdNum|fdDate|fdBool)\s*\(\s*[A-Za-z0-9_]+\s*,\s*(?!\s*")[A-Za-z_`$]/.test(corps)
    || /\.(?:get|getAll|has)\s*\(\s*(?!\s*")[A-Za-z_`$]/.test(corps)
    || /\.entries\(\)/.test(corps);
}

/** Une action qui touche la base — lu sur les appels réellement présents. */
const RE_ECRITURE = /prisma\s*\.\s*[A-Za-z0-9_]+\s*\.\s*(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\b|\$executeRaw|\$transaction/;
const RE_MODELE_ECRIT = /(?:prisma|tx)\s*\.\s*([A-Za-z0-9_]+)\s*\.\s*(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g;

/** Les modèles Prisma qu'une action ÉCRIT — `prisma.user.update` comme `tx.rowGrant.createMany`. */
function modelesEcrits(corps: string): string[] {
  const vus = new Set<string>();
  for (const m of corps.matchAll(RE_MODELE_ECRIT)) vus.add(m[1]!);
  return [...vus].sort();
}

function lirePorte(corps: string, constantes: Readonly<Record<string, string>>): PorteLue {
  let module: string | null = null, verbe: string | null = null, entite: string | null = null;
  const gardes = new Set<string>();

  const rc = /userCan\s*\(\s*[A-Za-z0-9_.]+\s*,\s*(?:"([A-Z_]+)"|([A-Z_0-9]+))\s*,\s*"([A-Z_]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = rc.exec(corps)) !== null) {
    module ??= m[1] ?? constantes[m[2]!] ?? m[2]!;
    verbe ??= m[3]!;
    gardes.add("userCan");
  }
  const re = /canAccessEntity\s*\(\s*[A-Za-z0-9_.]+\s*,\s*(?:"([A-Z_]+)"|([A-Z_0-9]+))\s*,/g;
  while ((m = re.exec(corps)) !== null) {
    entite ??= m[1] ?? constantes[m[2]!] ?? m[2]!;
    gardes.add("canAccessEntity");
  }
  // Les autres gardes de l'ERP, telles qu'écrites. La liste est OUVERTE par construction :
  // on relève ce qui ressemble à une garde, et ne pas en reconnaître une ne rend rien faux —
  // l'exécution revérifie de toute façon.
  for (const g of corps.matchAll(/\b(require[A-Z][A-Za-z]*|assert[A-Z][A-Za-z]*|can[A-Z][A-Za-z]*|has[A-Z][A-Za-z]*|is[A-Z][A-Za-z]*)\s*\(/g)) {
    if (g[1] !== "requireUser") gardes.add(g[1]!);
  }
  return { module, verbe, entite, gardes: [...gardes].sort() };
}

/**
 * À QUEL RANG L'ACTION REÇOIT-ELLE SON FORMULAIRE ?
 *
 * `null` quand elle n'en prend pas, ou quand il arrive APRÈS un argument qu'on ne saurait pas
 * fournir — deux actions de l'ERP prennent `(id, prev, formData)`, et deviner leur premier
 * argument reviendrait à choisir la cible à la place d'un humain. On le DIT au lieu de tenter.
 */
export function rangDuFormulaire(signature: string): 0 | 1 | null {
  if (!/FormData/.test(signature)) return null;
  const params: string[] = [];
  let profondeur = 0, courant = "";
  for (const c of signature) {
    if ("<([{".includes(c)) profondeur++;
    else if (">)]}".includes(c)) profondeur--;
    if (c === "," && profondeur === 0) { params.push(courant); courant = ""; continue; }
    courant += c;
  }
  if (courant.trim()) params.push(courant);
  const rang = params.findIndex((p) => /FormData/.test(p));
  return rang === 0 || rang === 1 ? (rang as 0 | 1) : null;
}

/**
 * LE CONTRAT D'UNE ACTION.
 *
 * `constantes` porte les `const X = "…"` du fichier (pour résoudre `userCan(user, MODULE, …)`),
 * `enums` les valeurs admises connues — celles du fichier ET celles du schéma, fournies par
 * l'appelant pour que ce module n'importe rien.
 */
export function decrireAction(
  src: SourceAction,
  constantes: Readonly<Record<string, string>> = {},
  enums: TableEnums = {},
): ContratAction {
  const { fichier, fonction, signature, corps } = src;
  const base = {
    id: `${fichier}:${fonction}`,
    fichier, fonction,
    porte: lirePorte(corps, constantes),
    ecrit: RE_ECRITURE.test(corps),
    modelesEcrits: modelesEcrits(corps),
    audit: /recordAudit\s*\(/.test(corps),
  };

  const rang = rangDuFormulaire(signature);
  if (rang === null) {
    // Sans argument : rien à décrire, donc APPELABLE. C'est le cas des bascules (« révoquer
    // toutes les sessions »). Une entrée typée, elle, ne passe pas par un formulaire : Adam ne
    // saurait pas fabriquer l'objet, et le dire vaut mieux que de tenter.
    if (signature === "") {
      return { ...base, appel: "sans-entree", champs: [], illisible: null };
    }
    return {
      ...base, appel: "arguments", champs: [],
      illisible: `entrée typée (${signature}) — cette action ne s'appelle pas par un formulaire`,
    };
  }

  const appel = rang === 0 ? "formulaire" as const : "etat-formulaire" as const;

  if (lectureDynamique(corps)) {
    return {
      ...base, appel, champs: [],
      illisible: "les noms de champs sont calculés à l'exécution — la source ne les énonce pas",
    };
  }

  const champs = lireChamps(corps, enums);
  if (champs.length === 0) {
    return {
      ...base, appel, champs: [],
      illisible: "aucune lecture de champ trouvée dans le corps — l'entrée attendue reste inconnue",
    };
  }
  return { ...base, appel, champs, illisible: null };
}

function lireChamps(corps: string, enums: TableEnums): ChampAction[] {
  const parNom = new Map<string, ChampAction>();
  /** Le nom de variable sous lequel un champ a été rangé — pour retrouver sa garde et son cast. */
  const variableDe = new Map<string, string>();

  const poser = (nom: string, type: TypeChamp) => {
    const deja = parNom.get(nom);
    // LA CARDINALITÉ L'EMPORTE SUR CE QUE LA VALEUR DÉSIGNE — deux axes, jamais confondus
    // (§118.16). `setRowGrants` lit `getAll("rowId")` : c'est une LISTE de références. Une
    // première version laissait le nom en `…Id` écraser la liste, et Adam aurait accordé UNE
    // ligne là où la personne en demandait vingt — un faux succès parfait, l'écran affichant
    // simplement moins de droits que prévu.
    const t = type === "liste" || deja?.type === "liste"
      ? "liste"
      : estReference(nom) ? "reference" : type;
    if (!deja || t !== deja.type) {
      parNom.set(nom, { nom, type: t, obligatoire: deja?.obligatoire ?? false, valeurs: deja?.valeurs ?? null });
    }
  };

  for (const m of corps.matchAll(/(?:const|let)\s+([A-Za-z_0-9]+)\s*=\s*(?:await\s+)?(fdStr|fdNum|fdDate|fdBool)\s*\(\s*[A-Za-z0-9_]+\s*,\s*"([^"]+)"/g)) {
    poser(m[3]!, TYPE_PAR_HELPER[m[2]!]!);
    variableDe.set(m[3]!, m[1]!);
  }
  for (const m of corps.matchAll(/\b(fdStr|fdNum|fdDate|fdBool)\s*\(\s*[A-Za-z0-9_]+\s*,\s*"([^"]+)"/g)) {
    poser(m[2]!, TYPE_PAR_HELPER[m[1]!]!);
  }
  for (const m of corps.matchAll(/\.getAll\s*\(\s*"([^"]+)"/g)) poser(m[1]!, "liste");
  for (const m of corps.matchAll(/\.(?:get|has)\s*\(\s*"([^"]+)"/g)) poser(m[1]!, "texte");

  for (const champ of parNom.values()) {
    const v = variableDe.get(champ.nom);
    if (v) {
      champ.obligatoire = new RegExp(`if\\s*\\(\\s*!\\s*${v}\\b|\\|\\|\\s*!\\s*${v}\\b|&&\\s*!\\s*${v}\\b`).test(corps);
      champ.valeurs = valeursAdmises(corps, v, enums);
    }
    if (!champ.valeurs) champ.valeurs = valeursAdmisesInline(corps, champ.nom, enums);
  }
  return [...parNom.values()].sort((a, b) => a.nom.localeCompare(b.nom));
}

/** `X as StatutProjet` ou `LISTE.includes(x)` — deux façons dont l'ERP borne une valeur. */
function valeursAdmises(corps: string, variable: string, enums: TableEnums): readonly string[] | null {
  const cast = new RegExp(`\\b${variable}\\s+as\\s+([A-Za-z_][A-Za-z0-9_]*)`).exec(corps);
  if (cast && enums[cast[1]!]) return enums[cast[1]!]!;
  for (const [nom, valeurs] of Object.entries(enums)) {
    if (new RegExp(`\\b${nom}\\b\\s*\\.\\s*(?:includes|has)\\s*\\(\\s*${variable}\\b`).test(corps)) return valeurs;
  }
  return null;
}

/** Le cas `fdStr(fd, "status") as StatutProjet`, sans variable intermédiaire. */
function valeursAdmisesInline(corps: string, nom: string, enums: TableEnums): readonly string[] | null {
  // Deux formes réelles, et la seconde a échappé à la première version : `fdStr(fd, "k") as T`
  // et `(fdStr(fd, "k") ?? "AUTRE") as T` — la parenthèse fermante n'est pas au même endroit.
  const echappe = nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lecture = `(?:fdStr|fdNum)\\s*\\(\\s*[A-Za-z0-9_]+\\s*,\\s*"${echappe}"\\s*\\)`;
  for (const motif of [
    `${lecture}(?:\\s*\\?\\?\\s*"[^"]*")?\\s+as\\s+([A-Za-z_][A-Za-z0-9_]*)`,
    `\\(\\s*${lecture}\\s*\\?\\?\\s*"[^"]*"\\s*\\)\\s+as\\s+([A-Za-z_][A-Za-z0-9_]*)`,
  ]) {
    const m = new RegExp(motif).exec(corps);
    if (m && enums[m[1]!]) return enums[m[1]!]!;
  }
  return null;
}

/** Les `const X = "…"` d'un fichier — pour résoudre `userCan(user, MODULE, …)`. */
export function constantesDuFichier(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of source.matchAll(/^const\s+([A-Z_][A-Z_0-9]*)\s*(?::[^=]+)?=\s*"([^"]+)"/gm)) out[m[1]!] = m[2]!;
  return out;
}

/** Tous les contrats d'un fichier — le point d'entrée pur, testable sur une chaîne. */
export function contratsDuFichier(fichier: string, source: string, enumsSchema: TableEnums = {}): ContratAction[] {
  const constantes = constantesDuFichier(source);
  const enums = { ...enumsSchema, ...enumsLocaux(source) };
  return decouperActions(fichier, source).map((a) => decrireAction(a, constantes, enums));
}

/**
 * CE QU'ON DIT AU MODÈLE. Une phrase par action, lisible par un humain comme par un modèle —
 * et qui NOMME son ignorance au lieu de la taire.
 */
export function direContrat(c: ContratAction): string {
  if (c.illisible) return `${c.id} — non appelable directement : ${c.illisible}`;
  if (c.champs.length === 0) return `${c.id} — sans entrée.`;
  const champ = (ch: ChampAction) => {
    const marque = ch.obligatoire ? "" : " (facultatif)";
    const val = ch.valeurs ? ` ∈ {${ch.valeurs.join(", ")}}` : "";
    return `${ch.nom} : ${ch.type}${val}${marque}`;
  };
  return `${c.id} — ${c.champs.map(champ).join(" ; ")}`;
}
