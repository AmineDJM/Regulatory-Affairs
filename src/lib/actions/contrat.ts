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
  /**
   * Les gardes RECONNUES, telles qu'écrites (`requireAdmin`, `requireChief`…).
   *
   * ⚠ Une liste VIDE ne veut PAS dire « action sans protection » — seulement « aucune garde
   * d'une forme que la dérivation sait nommer ». Mesuré : `setRegulatoryLock` (le cadenas d'un
   * dossier confidentiel) sort avec `gardes: []` alors que son corps appelle
   * `holdsRegulatoryLock(user)`, et `saveOrgNode` teste `user.role !== "SUPER_ADMIN"` en clair.
   * Ce champ sert à DÉCRIRE et à faire trouver une action, jamais à décider si on l'autorise :
   * la décision appartient à l'action elle-même, que l'exécuteur appelle telle quelle (§118.74).
   * Bâtir une garde là-dessus refuserait 182 actions à tort et, pire, ferait croire qu'une
   * liste vide est un fait.
   */
  gardes: readonly string[];
  /**
   * LE MODULE EN FRANÇAIS, lu sur `recordAudit({ module })` — 434 actions le déclarent.
   *
   * Ce n'est pas un doublon du module RBAC : celui-là est une clé technique
   * (`BUSINESS_DEVELOPMENT`), celui-ci est le mot que la personne emploie (« Business
   * Development »), et c'est LUI que la recherche par intention doit rencontrer. Trouvé en
   * cassant la découverte : déplacer la garde d'une action a fait disparaître son module RBAC
   * du contrat, et « crée un projet business development » a cessé de trouver l'action — alors
   * que le mot était toujours écrit deux lignes plus bas, dans son audit.
   */
  moduleFr: string | null;
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

export const HELPERS_PARTAGES: Readonly<Record<string, TypeChamp>> = {
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
function lectureDynamique(corps: string, lecteurs: readonly string[], formulaires: readonly string[]): boolean {
  const ech = (n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const noms = lecteurs.map(ech).join("|");
  // (a) UN LECTEUR appelé avec une clé qui n'est pas un littéral.
  if (new RegExp(`\\b(?:${noms})\\s*\\(\\s*[A-Za-z0-9_]+\\s*,\\s*(?!\\s*")[A-Za-z_\`$]`).test(corps)) return true;
  if (formulaires.length === 0) return false;
  const fd = formulaires.map(ech).join("|");
  // (b) LE FORMULAIRE LUI-MÊME interrogé sur une clé calculée — le récepteur compte : sans lui,
  //     `PROJECT_TEXT.has(field)` (un ENSEMBLE) faisait passer l'action pour dynamique.
  if (new RegExp(`\\b(?:${fd})\\s*\\.\\s*(?:get|getAll|has)\\s*\\(\\s*(?!\\s*")[A-Za-z_\`$]`).test(corps)) return true;
  // (c) LE FORMULAIRE PARCOURU : on ne sait alors rien annoncer.
  return new RegExp(`\\b(?:${fd})\\s*\\.\\s*(?:entries|keys|forEach)\\s*\\(`).test(corps);
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
  const audit = /recordAudit\s*\(\s*\{[^}]*?\bmodule\s*:\s*(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/s.exec(corps);
  const moduleFr = audit ? (audit[1] ?? constantes[audit[2]!] ?? null) : null;
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
  return { module, verbe, entite, moduleFr, gardes: [...gardes].sort() };
}

/**
 * À QUEL RANG L'ACTION REÇOIT-ELLE SON FORMULAIRE ?
 *
 * `null` quand elle n'en prend pas, ou quand il arrive APRÈS un argument qu'on ne saurait pas
 * fournir — deux actions de l'ERP prennent `(id, prev, formData)`, et deviner leur premier
 * argument reviendrait à choisir la cible à la place d'un humain. On le DIT au lieu de tenter.
 */
/**
 * LE NOM SOUS LEQUEL LE FORMULAIRE ARRIVE — et ses alias directs.
 *
 * Sans lui, le détecteur de lecture dynamique s'armait sur `.get|.getAll|.has` SANS REGARDER
 * LE RÉCEPTEUR, donc sur n'importe quel `.has(variable)` du corps. Mesuré : 19 des 27 actions
 * déclarées « noms de champs calculés à l'exécution » ne l'étaient pas du tout — leurs `.has`
 * portaient sur des ENSEMBLES (`PROJECT_TEXT.has(field)`, `CREATOR_DELETABLE.has(kind)`),
 * c'est-à-dire des tests d'appartenance sans le moindre rapport avec un formulaire. Une garde
 * armée sur une forme qui ignore son récepteur refuse ce qu'elle n'a pas regardé.
 *
 * Les ALIAS comptent : `const fd = formData` est du même objet, et fermer les yeux dessus
 * ferait déclarer COMPLÈTE une liste de champs qui ne l'est pas — le sens dangereux de
 * l'erreur, car un champ manquant peut être celui qui AIGUILLE l'écriture (`kind === "project"`
 * choisit la table). On ne suit pas une déstructuration ni un passage par argument : ce qu'on
 * ne relie pas au formulaire à coup sûr ne déclenche rien, et c'est la limite ASSUMÉE de ce
 * lecteur — elle est ici pour qu'on la lise avant de s'y fier.
 */
export function nomsDuFormulaire(signature: string, corps: string): string[] {
  const rang = rangDuFormulaire(signature);
  if (rang === null) return [];
  const params: string[] = [];
  let prof = 0, cur = "";
  for (const c of signature) {
    if ("<([{".includes(c)) prof++;
    else if (">)]}".includes(c)) prof--;
    if (c === "," && prof === 0) { params.push(cur); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) params.push(cur);
  const nom = /(\w+)\s*:/.exec(params[rang] ?? "")?.[1];
  if (!nom) return [];
  const noms = new Set([nom]);
  // Les alias DIRECTS, autant de fois qu'il en faut (`const a = formData; const b = a;`).
  for (let i = 0; i < 3; i++) {
    for (const m of corps.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(\w+)\s*;/g)) {
      if (noms.has(m[2]!)) noms.add(m[1]!);
    }
  }
  return [...noms];
}

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
  /** Les lecteurs de champ RECONNUS dans ce fichier, en plus des quatre helpers partagés. */
  lecteursDuFichier: Readonly<Record<string, TypeChamp>> = {},
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
    const lue = lireArguments(signature);
    return "champs" in lue
      ? { ...base, appel: "arguments" as const, champs: lue.champs, illisible: null }
      : {
          ...base, appel: "arguments" as const, champs: [],
          illisible: `entrée typée (${signature}) — ${lue.refus}`,
        };
  }

  const appel = rang === 0 ? "formulaire" as const : "etat-formulaire" as const;

  const lecteurs = { ...HELPERS_PARTAGES, ...lecteursDuFichier };
  if (lectureDynamique(corps, Object.keys(lecteurs), nomsDuFormulaire(signature, corps))) {
    return {
      ...base, appel, champs: [],
      illisible: "les noms de champs sont calculés à l'exécution — la source ne les énonce pas",
    };
  }

  const champs = lireChamps(corps, enums, lecteurs);
  if (champs.length === 0) {
    return {
      ...base, appel, champs: [],
      illisible: "aucune lecture de champ trouvée dans le corps — l'entrée attendue reste inconnue",
    };
  }
  return { ...base, appel, champs, illisible: null };
}

function lireChamps(corps: string, enums: TableEnums, lecteurs: Readonly<Record<string, TypeChamp>>): ChampAction[] {
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

  // LES LECTEURS SONT CEUX DU FICHIER, pas une liste de quatre noms (voir `helpersDuFichier`).
  const noms = Object.keys(lecteurs).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  for (const m of corps.matchAll(new RegExp(`(?:const|let)\\s+([A-Za-z_0-9]+)\\s*=\\s*(?:await\\s+)?(${noms})\\s*\\(\\s*[A-Za-z0-9_]+\\s*,\\s*"([^"]+)"`, "g"))) {
    poser(m[3]!, lecteurs[m[2]!]!);
    variableDe.set(m[3]!, m[1]!);
  }
  for (const m of corps.matchAll(new RegExp(`\\b(${noms})\\s*\\(\\s*[A-Za-z0-9_]+\\s*,\\s*"([^"]+)"`, "g"))) {
    poser(m[2]!, lecteurs[m[1]!]!);
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
/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * QUI LIT UN CHAMP DE FORMULAIRE ? — la question posée à la SOURCE, pas à une liste.
 *
 * Le lecteur ne connaissait que `fdStr`, `fdNum`, `fdDate`, `fdBool`. Or le parc en compte
 * QUATORZE : `str` (114 appels), `num` (30), `int` (9), `list`, `readIds`, `fd`, `posInt`,
 * `fdList`, `parseIds`, `checked`, `fdDateTime`… Résultat mesuré : 23 actions déclarées
 * « aucune lecture de champ trouvée dans le corps » — dont DIX-HUIT du seul
 * `regulatory-actions.ts`, où chaque champ est pourtant nommé en clair
 * (`str(formData, "priority")`). Le refus était celui du LECTEUR, pas de la source : §118.78,
 * une seconde fois, à un autre étage.
 *
 * ── SUR QUOI LA RECONNAISSANCE S'ARME ────────────────────────────────────────────────────
 *
 * Pas sur une liste de noms — elle serait fausse au quinzième helper, EN SILENCE (§118.73).
 * Sur la DÉFINITION : une fonction dont le premier paramètre est un `FormData` et le second
 * une clé `string`. C'est exactement ce qu'est un lecteur de champ, et c'est ce qui distingue
 * `str(formData, "id")` de `createStockLocation(formData, "ANNEX")` — dont le second
 * paramètre est une union de littéraux (`"HOSPITAL" | "ANNEX"`), donc une VALEUR et non une
 * clé. Ce faux positif existe dans le parc ; sans ce point, on aurait déclaré un champ nommé
 * « ANNEX » qui n'a jamais existé.
 *
 * Le TYPE vient du type de RETOUR déclaré. Un helper qui n'en déclare pas rend « texte » :
 * ce n'est pas une supposition, c'est le medium — un `FormData` ne transporte que du texte, et
 * `enFormulaire` sérialise tout. Se tromper de type sur un champ de formulaire coûte une
 * indication au modèle, jamais un appel faux (contrairement aux ARGUMENTS positionnels, où le
 * type gouverne la valeur réellement passée — d'où la rigueur inverse là-bas).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function helpersDuFichier(source: string): Record<string, TypeChamp> {
  const out: Record<string, TypeChamp> = {};
  // `function NAME(p: FormData, k: string): RET` ET `const NAME = (p: FormData, k: string): RET =>`
  const re = /(?:function|const)\s+([A-Za-z_][\w]*)\s*(?:=\s*)?(?:async\s*)?\(\s*\w+\s*:\s*FormData\s*,\s*\w+\s*:\s*string\s*\)\s*(?::\s*([^={\n]+))?/g;
  for (const m of source.matchAll(re)) {
    const retour = (m[2] ?? "").trim();
    out[m[1]!] = typeDuRetour(retour);
  }
  return out;
}

/** Ce qu'un type de retour dit du champ. Inconnu → « texte », la nature même d'un formulaire. */
function typeDuRetour(retour: string): TypeChamp {
  const t = retour.replace(/\s+/g, " ").replace(/Promise<(.*)>/, "$1").trim();
  if (/^(?:readonly )?string\s*\[\]/.test(t)) return "liste";
  if (/^number\b/.test(t)) return "nombre";
  if (/^Date\b/.test(t)) return "date";
  if (/^boolean\b/.test(t)) return "booleen";
  return "texte";
}

export function constantesDuFichier(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of source.matchAll(/^const\s+([A-Za-z_][A-Za-z_0-9]*)\s*(?::[^=]+)?=\s*"([^"]+)"/gm)) out[m[1]!] = m[2]!;
  return out;
}

/** Tous les contrats d'un fichier — le point d'entrée pur, testable sur une chaîne. */
export function contratsDuFichier(fichier: string, source: string, enumsSchema: TableEnums = {}): ContratAction[] {
  const constantes = constantesDuFichier(source);
  const enums = { ...enumsSchema, ...enumsLocaux(source) };
  const lecteurs = helpersDuFichier(source);
  return decouperActions(fichier, source).map((a) => decrireAction(a, constantes, enums, lecteurs));
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

// ───────────────────────────────────────────────────────────────────────────────────────────
// UNE ACTION À ARGUMENTS SE LIT AUSSI
// ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 67 REFUS IMPRIMAIENT LA SIGNATURE QU'ILS DÉCLARAIENT NE PAS SAVOIR LIRE.
 *
 * « entrée typée (missionId: string) — cette action ne s'appelle pas par un formulaire » :
 * le nom du paramètre, son type et son rang étaient DANS le message. C'est un « je ne peux
 * pas » artificiel écrit dans le CODE, comme le contrôle des livrables qui déclarait « aucun
 * moteur de calcul Excel dans le dépôt » alors que le dossier d'à côté en portait un
 * (§118.59) et comme l'ingestion qui renvoyait océriser à la main (§118.63). On TRADUIT au
 * lieu de refuser (§118.34).
 *
 * ── POURQUOI LA LECTURE EST TOUT-OU-RIEN ─────────────────────────────────────────────────
 *
 * Un formulaire est NOMMÉ : une clé manquante arrive vide et l'action s'en plaint. Un appel
 * positionnel est MUET : un argument manquant devient `undefined` au bon rang, et la fonction
 * part quand même. Un paramètre mal lu ne dégrade donc pas la lecture — il DÉCALE tous les
 * suivants, et `renameDocument(id, name)` appelé de travers renomme avec l'identifiant.
 * Un seul paramètre illisible rend TOUTE la signature illisible : ici, lire quatre paramètres
 * sur cinq est strictement pire que n'en lire aucun.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce qu'on sait traduire — et rien d'autre. Un type absent d'ici rend la signature illisible. */
const TYPES_SIMPLES: Readonly<Record<string, TypeChamp>> = {
  string: "texte", number: "nombre", boolean: "booleen", Date: "date",
  "string[]": "liste", "readonly string[]": "liste",
};

/**
 * L'IDENTITÉ DE L'ACTEUR, reconnue au NOM du paramètre — et refusée.
 *
 * Toute action d'écran tient son acteur de la SESSION (`requireUser`) ; celle qui le reçoit en
 * argument fait confiance à son appelant. Le bouton est un appelant sûr, un modèle ne l'est
 * pas : ouvrir ce paramètre, c'est permettre d'agir au nom de quelqu'un d'autre — exactement
 * ce qu'`executerAction` refuse déjà en ne transmettant PAS `user` (§118.7).
 *
 * La liste est FERMÉE et COURTE, parce qu'une garde large — « tout paramètre finissant par
 * Id » — refuserait `missionId`, `taskId`, `messageId`, c'est-à-dire la quasi-totalité du
 * parc, pour se protéger d'un risque qu'aucune de ces actions ne porte. Une seule action est
 * dans ce cas aujourd'hui (`rememberExchange`), et le refus la NOMME avec sa raison.
 */
const IDENTITE_ACTEUR = /^(userId|actorId|asUser|onBehalfOf|accountId|sessionUserId|impersonate\w*)$/i;

/** Découpe une liste de paramètres au niveau ZÉRO — un `{ a: string }` ne se coupe pas en deux. */
function decouperParametres(signature: string): string[] {
  const out: string[] = [];
  let prof = 0, cur = "";
  for (const ch of signature) {
    if ("{<([".includes(ch)) prof++;
    else if ("}>)]".includes(ch)) prof--;
    if (ch === "," && prof === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Une union de littéraux (`"GRANTED" | "REFUSED"`) — les valeurs admises, lues sans les deviner. */
function litterauxUnion(type: string): string[] | null {
  const parts = type.split("|").map((p) => p.trim());
  if (parts.length < 2 || !parts.every((p) => /^"[^"]*"$/.test(p))) return null;
  return parts.map((p) => p.slice(1, -1));
}

/** Le résultat d'une lecture de signature : des champs, ou la RAISON exacte du refus (§118.30). */
export type LectureArguments = { champs: ChampAction[] } | { refus: string };

export function lireArguments(signature: string): LectureArguments {
  const champs: ChampAction[] = [];
  for (const brut of decouperParametres(signature)) {
    const p = brut.replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/,$/, "");
    if (!p) continue;
    if (p.startsWith("...")) return { refus: `le paramètre « ${p.slice(0, 30)} » est variadique` };
    // UNE VALEUR PAR DÉFAUT (`now = new Date()`) : le rang existe, mais sa valeur est calculée
    // à l'appel. La remplir depuis une demande ferait écrire une date choisie par un modèle là
    // où le code voulait « maintenant ».
    const avantType = p.split(":")[0] ?? "";
    if (avantType.includes("=") || /[^=!<>]=[^=>]/.test(p)) {
      return { refus: `le paramètre « ${avantType.split("=")[0]!.trim()} » a une valeur par défaut` };
    }
    const m = /^(\w+)(\?)?\s*:\s*([\s\S]+)$/.exec(p);
    if (!m) return { refus: `« ${p.slice(0, 40)} » n'est pas un nom simple typé` };
    const nom = m[1]!;
    let optionnel = Boolean(m[2]);
    let type = m[3]!.replace(/\s+/g, " ").trim();

    if (IDENTITE_ACTEUR.test(nom)) {
      return {
        refus: `le paramètre « ${nom} » porte l'identité de l'ACTEUR — une action qui reçoit son `
          + `auteur au lieu de le lire dans la session ne s'appelle que depuis un écran`,
      };
    }
    if (/\|\s*undefined$/.test(type)) { type = type.replace(/\|\s*undefined$/, "").trim(); optionnel = true; }
    // `| null` dit qu'on accepte l'ABSENCE DE VALEUR, jamais l'absence d'ARGUMENT : sauter le
    // rang décalerait tous les suivants. Le champ reste donc obligatoire.
    if (/\|\s*null$/.test(type)) type = type.replace(/\|\s*null$/, "").trim();

    const valeurs = litterauxUnion(type);
    const simple = valeurs ? "texte" as const : TYPES_SIMPLES[type];
    if (!simple) return { refus: `le type de « ${nom} » (${type}) n'est pas une valeur simple` };
    // MÊME RÈGLE DE RÉFÉRENCE QUE LE FORMULAIRE : `missionId` désigne une mission des deux
    // côtés. Deux conventions selon la façon d'appeler feraient qu'« arrête la mission de
    // consolidation » se résoudrait dans un cas et exigerait un cuid dans l'autre.
    champs.push({
      nom,
      type: simple === "texte" && !valeurs && estReference(nom) ? "reference" : simple,
      obligatoire: !optionnel,
      valeurs: valeurs ?? null,
    });
  }
  return champs.length ? { champs } : { refus: "aucun paramètre lisible" };
}
