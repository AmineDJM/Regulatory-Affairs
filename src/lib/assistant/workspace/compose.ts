import {
  WORKSPACE_LIMITS,
  type WorkspaceAction, type WorkspaceBlock, type WorkspaceComposition, type WorkspaceDoc,
  type WorkspaceEndpoint, type WorkspaceEvent, type WorkspaceField, type WorkspaceGauge,
  type WorkspaceItem, type WorkspaceMail, type WorkspacePerson, type WorkspaceColumn,
  type WorkspaceRow, type WorkspaceMetric, type WorkspaceStep, type WorkspaceActionIcon,
} from "./protocol";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * DE LA SOURCE CANONIQUE À L'ÉCRAN — une traduction, pas une génération.
 *
 * Le modèle n'intervient nulle part ici. On lit la sortie EXACTE d'un outil canonique et on la
 * range dans les blocs typés du protocole. Ce qui s'affiche vient donc de la base de données.
 *
 * ── LA RÈGLE DE SÛRETÉ, QUI EST AUSSI LA RÈGLE DE QUALITÉ ─────────────────────────────────
 *
 * UNE FORME NON RECONNUE NE PRODUIT RIEN (`null`). Pas de bloc « données brutes », pas de
 * repli en JSON indenté. C'est exactement le chemin par lequel six lignes de salaire sont
 * arrivées à l'écran en réponse à « Bonsoir, ça va ? » : un affichage capable de tout montrer
 * finit par tout montrer. Ici, l'inconnu ne s'affiche pas — la réponse en texte suffit.
 *
 * Les fonctions sont PURES et défensives : la sortie d'un outil est du JSON qu'on n'a pas
 * écrit dans ce fichier, donc chaque champ est vérifié avant d'être lu.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Une chaîne non vide, ou `null`. Les `undefined`, nombres et objets ne passent pas. */
function s(v: unknown): string | null {
  if (typeof v === "string") { const t = v.trim(); return t.length > 0 ? t : null; }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function clip(v: string | null, max: number): string | null {
  if (!v) return null;
  return v.length <= max ? v : `${v.slice(0, max - 1).trimEnd()}…`;
}

/** Une liste de chaînes, bornée — les tableaux hétérogènes sont ignorés silencieusement. */
function strings(v: unknown, max: number): string[] {
  return arr(v).map(s).filter((x): x is string => x !== null).slice(0, max);
}

function parse(raw: string): Json | unknown[] | null {
  const t = raw.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  try {
    const v: unknown = JSON.parse(t);
    return isObj(v) || Array.isArray(v) ? (v as Json | unknown[]) : null;
  } catch {
    // Une sortie tronquée n'est pas une donnée : on ne devine pas ce qui manque.
    return null;
  }
}

/**
 * Un outil qui répond « rien trouvé » rend un objet `{ resultat, precision }`. Ce n'est pas un
 * échec de composition : c'est une réponse, et elle se dit en texte, pas en tableau vide.
 */
const isEmptyAnswer = (o: Json): boolean => typeof o.resultat === "string";

// ── Les traducteurs, un par forme canonique ────────────────────────────────────────────────

function endpointsOf(v: unknown): WorkspaceEndpoint[] {
  const out: WorkspaceEndpoint[] = [];
  for (const e of arr(v)) {
    if (!isObj(e)) continue;
    const valeur = s(e.valeur) ?? s(e.adresse) ?? s(e.value);
    if (!valeur) continue;
    const canalRaw = s(e.canal);
    const canal: WorkspaceEndpoint["canal"] =
      canalRaw === "téléphone" ? "téléphone" : canalRaw === "WhatsApp" ? "WhatsApp" : "e-mail";
    out.push({
      canal, valeur,
      usage: s(e.usage),
      fiabilite: s(e.fiabilite),
      ...(e.principale === true ? { principale: true } : {}),
    });
  }
  return out;
}

/** `directory_lookup` — une ou plusieurs personnes avec toutes leurs coordonnées. */
function fromDirectoryLookup(o: Json): WorkspaceBlock[] {
  const people: WorkspacePerson[] = [];
  for (const p of arr(o.personnes)) {
    if (!isObj(p)) continue;
    const nom = s(p.nom);
    if (!nom) continue;
    people.push({
      nom,
      poste: s(p.poste),
      entite: s(p.entite),
      departement: s(p.departement),
      coordonnees: endpointsOf(p.coordonnees),
    });
  }
  if (people.length === 0) return [];
  return [{
    kind: "people",
    title: people.length === 1 ? people[0].nom : `${people.length} personnes trouvées`,
    people: people.slice(0, WORKSPACE_LIMITS.people),
    ...(s(o.note) ? { note: s(o.note) as string } : {}),
  }];
}

/** `directory_list` — le registre. Les adresses y sont une LISTE par personne, pas une seule. */
function fromDirectoryList(o: Json): WorkspaceBlock[] {
  const rows: WorkspacePerson[] = [];
  for (const e of arr(o.salaries)) {
    if (!isObj(e)) continue;
    const nom = s(e.nom);
    if (!nom) continue;
    const mails = endpointsOf(e.emails).map((x) => ({ ...x, canal: "e-mail" as const }));
    const tels: WorkspaceEndpoint[] = strings(e.telephones, 3).map((valeur) => ({ canal: "téléphone" as const, valeur }));
    rows.push({
      nom, poste: s(e.poste), departement: s(e.departement), entite: s(e.entite),
      coordonnees: [...mails, ...tels],
    });
  }
  if (rows.length === 0) return [];
  const total = typeof o.total === "number" ? o.total : rows.length;
  return [{
    kind: "directory",
    title: "Annuaire",
    total,
    rows: rows.slice(0, WORKSPACE_LIMITS.tableRows),
    ...(s(o.note) ? { note: s(o.note) as string } : {}),
  }];
}

/** `gmail_search` — des messages reçus. */
function fromMail(o: Json): WorkspaceBlock[] {
  const messages: WorkspaceMail[] = [];
  for (const m of arr(o.messages)) {
    if (!isObj(m)) continue;
    const de = s(m.de);
    if (!de) continue;
    const alerte = strings(m.alerteManipulation, 3);
    messages.push({
      de,
      objet: s(m.objet) ?? "(sans objet)",
      ...(s(m.id) ? { id: s(m.id) as string } : {}),
      ...(s(m.recuLe) ? { recuLe: s(m.recuLe) as string } : {}),
      ...(s(m.importance) ? { importance: s(m.importance) as string } : {}),
      ...(clip(s(m.extrait), WORKSPACE_LIMITS.snippetChars) ? { extrait: clip(s(m.extrait), WORKSPACE_LIMITS.snippetChars) as string } : {}),
      ...(strings(m.piecesJointes, 5).length ? { piecesJointes: strings(m.piecesJointes, 5) } : {}),
      ...(strings(m.demandes, 3).length ? { demandes: strings(m.demandes, 3) } : {}),
      ...(alerte.length ? { alerte } : {}),
    });
  }
  if (messages.length === 0) return [];
  return [{
    kind: "mail",
    title: messages.length === 1 ? "1 message" : `${messages.length} messages`,
    messages: messages.slice(0, WORKSPACE_LIMITS.mails),
  }];
}

/** `read_calendar` — un TABLEAU d'événements, pas un objet enveloppe. */
function fromCalendar(list: unknown[]): WorkspaceBlock[] {
  const events: WorkspaceEvent[] = [];
  for (const e of list) {
    if (!isObj(e)) continue;
    const titre = s(e.titre);
    if (!titre) continue;
    events.push({
      titre,
      ...(s(e.jour) ? { jour: s(e.jour) as string } : {}),
      ...(s(e.heure) ? { heure: s(e.heure) as string } : {}),
      lieu: s(e.lieu),
      organisateur: s(e.organisateur),
      visio: s(e.visio),
      ...(strings(e.invites, 8).length ? { invites: strings(e.invites, 8) } : {}),
    });
  }
  if (events.length === 0) return [];
  return [{
    kind: "agenda",
    title: events.length === 1 ? "Prochain rendez-vous" : "Agenda",
    events: events.slice(0, WORKSPACE_LIMITS.events),
  }];
}

/**
 * LES GESTES D'UNE LIGNE — traduits, et VÉRIFIÉS.
 *
 * La phrase vient du serveur, mais elle traverse une sortie d'outil : on la relit comme tout le
 * reste de ce fichier. Une action sans libellé ou sans phrase ne s'affiche pas — un bouton muet,
 * ou un bouton qui n'envoie rien, sont deux façons de trahir la confiance qu'on lui accorde.
 */
const EDIT_TYPES = new Set(["texte", "choix", "date", "nombre"]);

/**
 * UN CHAMP MODIFIABLE, RELU COMME TOUT LE RESTE.
 *
 * La règle qui compte : `phrase` DOIT contenir `%s`. Sans lui, la valeur saisie n'irait nulle
 * part et le bouton enverrait une phrase figée — c'est-à-dire modifierait autre chose que ce
 * que l'utilisateur croit. On écarte alors l'édition et le champ reste en lecture seule, ce
 * qui est le repli sûr.
 */
function readEditable(v: unknown): WorkspaceField["editable"] | null {
  if (!isObj(v)) return null;
  const phrase = s(v.phrase);
  const type = s(v.type);
  if (!phrase || !phrase.includes("%s") || !type || !EDIT_TYPES.has(type)) return null;
  const options = strings(v.options, 24);
  return {
    phrase,
    type: type as "texte" | "choix" | "date" | "nombre",
    ...(options.length ? { options } : {}),
    ...(s(v.aide) ? { aide: clip(s(v.aide), 60) } : {}),
  };
}

const ACTION_ICONS = new Set<string>([
  "voir", "email", "tache", "modifier", "apercu", "envoyer", "escalade", "planifier", "relancer", "valider",
]);

function actionsOf(v: unknown, max: number = WORKSPACE_LIMITS.itemActions): WorkspaceAction[] {
  const out: WorkspaceAction[] = [];
  for (const a of arr(v)) {
    if (!isObj(a)) continue;
    const libelle = clip(s(a.libelle) ?? s(a.label), 24);
    const phrase = s(a.phrase) ?? s(a.prompt);
    if (!libelle || !phrase) continue;
    const ton = s(a.ton);
    // Le pictogramme vient d'un vocabulaire FERMÉ : un mot inconnu ne devient pas une icône au
    // hasard, il disparaît — et le bouton reste un bouton texte, parfaitement lisible.
    const icone = s(a.icone);
    out.push({
      libelle, phrase,
      ...(ton === "danger" || ton === "primaire" ? { ton } : {}),
      ...(icone && ACTION_ICONS.has(icone) ? { icone: icone as WorkspaceActionIcon } : {}),
    });
    if (out.length >= max) break;
  }
  return out;
}

/** `list_pending_decisions` — la file. Chaque élément porte au moins un intitulé. */
function fromQueue(o: Json): WorkspaceBlock[] {
  const items: WorkspaceItem[] = [];
  for (const it of arr(o.elements)) {
    if (!isObj(it)) continue;
    const titre = s(it.titre) ?? s(it.libelle) ?? s(it.objet) ?? s(it.type);
    if (!titre) continue;
    const actions = actionsOf(it.actions);
    items.push({
      titre,
      detail: clip(s(it.detail) ?? s(it.demandeur) ?? s(it.description), WORKSPACE_LIMITS.snippetChars),
      statut: s(it.statut) ?? s(it.etat),
      echeance: s(it.echeance) ?? s(it.date) ?? s(it.depuis),
      href: s(it.lien) ?? s(it.href),
      ...(actions.length ? { actions } : {}),
    });
  }
  if (items.length === 0) return [];
  const total = typeof o.total === "number" ? o.total : items.length;
  return [{
    kind: "queue",
    title: "En attente de votre décision",
    total,
    items: items.slice(0, WORKSPACE_LIMITS.queueItems),
  }];
}

/**
 * `inspect_record` — la fiche canonique. Sa forme varie selon le type d'enregistrement, donc
 * on ne suppose rien : on aplatit les champs SCALAIRES du premier niveau. Les sous-objets et
 * les listes sont laissés au texte, qui sait les résumer ; les afficher tous ferait de la
 * fiche un vidage de base, ce que le protocole refuse.
 */
function fromRecord(o: Json): WorkspaceBlock[] {
  const source = isObj(o.fiche) ? o.fiche : isObj(o.enregistrement) ? o.enregistrement : o;
  const fields: WorkspaceField[] = [];
  for (const [k, v] of Object.entries(source)) {
    if (fields.length >= WORKSPACE_LIMITS.recordFields) break;
    if (k === "id" || k === "lien" || k === "href" || k === "type") continue;
    const value = typeof v === "boolean" ? (v ? "oui" : "non") : s(v);
    if (!value) continue;
    fields.push({ label: humanize(k), value: clip(value, WORKSPACE_LIMITS.snippetChars) as string });
  }
  if (fields.length < 2) return [];
  const title = s(source.nom) ?? s(source.titre) ?? s(source.libelle) ?? s(o.titre) ?? "Fiche";
  return [{
    kind: "record",
    title,
    subtitle: s(source.type) ?? s(o.type),
    href: s(source.lien) ?? s(o.lien),
    // Le titre ne se répète pas dans les champs.
    fields: fields.filter((f) => f.value !== title),
  }];
}

/**
 * LES ACCENTS QUE LES CLÉS N'ONT PAS.
 *
 * Les clés JSON des outils sont écrites sans accent (`dateDepot`, `priorite`, `entite`) parce
 * qu'une clé accentuée est une source d'ennuis. Mais « Date depot » et « Priorite » affichés au
 * PDG, dans une interface qui se veut soignée, sont des fautes d'orthographe.
 *
 * Une courte table couvre les clés RÉELLEMENT rencontrées dans l'ERP. Elle n'a pas vocation à
 * être exhaustive : ce qui n'y est pas passe par la règle générale, qui reste correcte.
 */
const LABELS: Record<string, string> = {
  entite: "Entité", priorite: "Priorité", statut: "Statut", echeance: "Échéance",
  categorie: "Catégorie", departement: "Département", etat: "État", numero: "Numéro",
  reference: "Référence", montant: "Montant", devise: "Devise", creele: "Créé le",
  "date depot": "Date de dépôt", "date creation": "Date de création",
  "date limite": "Date limite", "etape courante": "Étape courante",
  "charge du dossier": "Chargé du dossier", "cree le": "Créé le", "mis a jour": "Mis à jour",
  "derniere activite": "Dernière activité", "nom complet": "Nom complet",
  "type de process": "Type de process", "niveau de process": "Niveau de process",
};

/**
 * `nomComplet` → « Nom complet » ; `chargeDuDossier` → « Chargé du dossier ». Presque sans
 * dictionnaire.
 *
 * LA CAPITALE N'EST PAS ANGLAISE. Découper le chameau donne « Charge Du Dossier », qui est de
 * l'anglais typographique dans une interface française. Seul le premier mot prend la majuscule
 * — SAUF les sigles, qu'on reconnaît à leur casse (« dateAMM » → « date AMM », jamais « amm »).
 */
function humanize(key: string): string {
  const words = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/);
  const out = words.map((w, i) => {
    const acronym = w.length > 1 && w === w.toUpperCase();
    if (acronym) return w;
    return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w.toLowerCase();
  });
  const plain = out.join(" ");
  // La table est consultée sur la forme MINUSCULE, pour couvrir `dateDepot` et `date_depot`
  // d'un seul coup. Deux passes : l'expression entière d'abord (« date depot » → « Date de
  // dépôt »), puis MOT À MOT — sans quoi « numeroAMM » resterait « Numero AMM » parce que le
  // sigle qui suit empêche la correspondance globale.
  const whole = LABELS[plain.toLowerCase()];
  if (whole) return whole;
  const byWord = out.map((w, i) => {
    const fix = LABELS[w.toLowerCase()];
    if (!fix) return w;
    return i === 0 ? fix : fix.charAt(0).toLowerCase() + fix.slice(1);
  });
  return byWord.join(" ");
}

/** Ce qui fait fonctionner l'application sans rien apprendre au PDG. */
const STRUCTURAL_KEYS = new Set(["id", "lien", "href", "url", "cle", "key", "uuid"]);

/**
 * LE REPLI GÉNÉRIQUE, ET SA LIMITE. Une liste d'objets HOMOGÈNES devient un tableau — mais
 * seulement si l'appelant l'a explicitement autorisé pour cet outil. Appliqué à n'importe
 * quelle sortie, ce serait précisément le vidage qu'on interdit.
 */
export function tableFromRows(title: string, list: unknown[]): WorkspaceBlock | null {
  const rows = list.filter(isObj).slice(0, WORKSPACE_LIMITS.tableRows);
  if (rows.length < 2) return null;

  // Les colonnes sont celles que PARTAGE la majorité des lignes : une clé présente une fois
  // sur trente produit une colonne vide, qui coûte de la largeur et n'apprend rien.
  const counts = new Map<string, number>();
  for (const r of rows) for (const k of Object.keys(r)) counts.set(k, (counts.get(k) ?? 0) + 1);
  const keys = [...counts.entries()]
    .filter(([, n]) => n >= rows.length * 0.6)
    // Les clés de PLOMBERIE ne sont pas des colonnes : un identifiant technique occupe une
    // pleine largeur et n'apprend rien au PDG.
    .filter(([k]) => !STRUCTURAL_KEYS.has(k))
    .map(([k]) => k)
    .slice(0, 6);
  if (keys.length === 0) return null;

  const columns: WorkspaceColumn[] = keys.map((k) => ({
    key: k,
    label: humanize(k),
    numeric: rows.every((r) => r[k] === undefined || typeof r[k] === "number"),
  }));
  const out: WorkspaceRow[] = rows.map((r) => {
    const cells: Record<string, string> = {};
    for (const k of keys) cells[k] = clip(s(r[k]), 80) ?? "—";
    // LE LIEN DE LA LIGNE SURVIT À LA DISPARITION DE SA COLONNE. `lien` est écarté des colonnes
    // (c'est de la plomberie), mais c'est lui qui rend la ligne cliquable — le perdre
    // renverrait le PDG à chercher lui-même la fiche qu'il a sous les yeux.
    const href = s(r.lien) ?? s(r.href);
    return { cells, ...(href ? { href } : {}) };
  });
  return { kind: "table", title, columns: out.length ? columns : [], rows: out, total: list.length };
}

/**
 * LA TABLE DE CORRESPONDANCE — outil canonique → traducteur.
 *
 * Elle est FERMÉE, et c'est le point. Un outil absent d'ici ne compose rien : sa réponse
 * reste du texte. Ajouter une entrée est une décision explicite, prise en connaissance de ce
 * que l'outil rend.
 */
/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES LECTURES QUI RENDENT DES LIGNES — « Dans un tableau ».
 *
 * LE DÉFAUT QU'ON FERME. En production, le PDG a demandé les dossiers Regulatory les plus
 * avancés, puis simplement : « Dans un tableau ». Réponse d'Adam : « Je ne peux pas afficher de
 * tableaux Markdown ici. » Quelques tours plus loin, sur un export : « Je ne peux pas afficher un
 * fichier Excel. » Les deux phrases sont FAUSSES. Le protocole a un bloc `table` depuis sa
 * création ; ce qui manquait, c'était le chemin qui y mène.
 *
 * La règle de style interdit — à raison — d'ÉCRIRE du Markdown : la conversation rend du texte
 * brut, et un tableau tapé à la main y arriverait en bouillie. Mais elle ne disait pas que
 * l'écran, lui, sait en construire un à partir de la donnée canonique. Le modèle en a déduit une
 * impossibilité là où il n'y avait qu'un partage des rôles.
 *
 * LA TABLE RESTE FERMÉE. Chaque entrée nomme l'outil ET l'endroit où lire ses lignes. On ne
 * transforme pas « toute sortie contenant un tableau » en tableau : c'est exactement le vidage
 * qui a mis six lignes de salaire à l'écran en réponse à « Bonsoir, ça va ? ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const TABLE_TOOLS: Record<string, { title: string; keys: readonly string[] }> = {
  // Sortie en TABLEAU NU — la lecture rend directement ses lignes.
  search_courriers: { title: "Courriers", keys: [] },
  // Sortie en OBJET — les lignes sont sous l'une de ces clés, dans cet ordre de préférence.
  regulatory_portfolio: { title: "Dossiers Regulatory", keys: ["dossiers"] },
  regulatory_workload: { title: "Charge Regulatory", keys: ["repartition"] },
  read_budget: { title: "Budget", keys: ["postes", "parEnveloppe"] },
  read_hr_overview: { title: "Effectif par entité", keys: ["parEntite"] },
};

function fromTableTool(tool: string, data: Json | unknown[]): WorkspaceBlock[] {
  const cfg = TABLE_TOOLS[tool];
  if (!cfg) return [];
  if (Array.isArray(data)) {
    const b = tableFromRows(cfg.title, data);
    return b ? [b] : [];
  }
  for (const k of cfg.keys) {
    const rows = data[k];
    if (!Array.isArray(rows)) continue;
    const b = tableFromRows(cfg.title, rows);
    if (b) return [b];
  }
  return [];
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * `_blocs` — QUAND UNE LECTURE DÉCLARE ELLE-MÊME CE QU'ELLE MONTRE.
 *
 * LE PROBLÈME QUE ÇA RÉSOUT. Les traducteurs ci-dessus DEVINENT une forme à partir d'un JSON.
 * C'est le bon mécanisme pour l'annuaire ou la boîte mail, dont la forme est stable. Ça ne
 * marche pas pour « montre-moi ce contrat », « où en est ce dossier », « fais-moi voir l'Excel
 * avant de l'envoyer » : ce qu'il faut afficher — un PDF, une jauge, une feuille lue — n'est pas
 * inférable d'un objet, il est CONNU de l'outil qui l'a produit.
 *
 * CE QUE ÇA NE ROUVRE PAS. Le modèle n'écrit toujours RIEN ici : `_blocs` est rempli par du code
 * serveur, dans un outil canonique, et il est REVALIDÉ champ par champ ci-dessous — type de bloc
 * inconnu écarté, champ manquant écarté, listes bornées, `href` restreint aux routes internes.
 * Ce qui reste interdit, c'est ce qui a produit l'incident des six salaires : l'inférence
 * automatique sur une forme inconnue. Une déclaration explicite d'un développeur n'en est pas une.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const TONES = new Set(["neutre", "attention", "alerte", "succes"]);
const DOC_KINDS = new Set(["pdf", "image", "feuille", "texte", "autre"]);

/**
 * UN DOCUMENT NE S'OUVRE QUE PAR UNE ROUTE DE L'ERP.
 *
 * Une URL absolue dans un cadre affiché sous la réponse du PDG, c'est une page tierce qui
 * s'exécute dans son onglet. On n'accepte donc qu'un chemin interne — et la route, elle,
 * revérifie les droits du document à chaque requête.
 */
const isInternalHref = (h: string): boolean => h.startsWith("/") && !h.startsWith("//");

function readColumns(v: unknown): WorkspaceColumn[] {
  const out: WorkspaceColumn[] = [];
  for (const c of arr(v)) {
    if (!isObj(c)) continue;
    const key = s(c.key);
    if (!key) continue;
    out.push({
      key, label: s(c.label) ?? humanize(key),
      ...(c.numeric === true ? { numeric: true } : {}),
      ...(c.badge === true ? { badge: true } : {}),
    });
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * LES LIGNES D'UN TABLEAU DÉCLARÉ — les DEUX formes acceptées, une seule rendue.
 *
 * Un outil peut écrire `{ reference: "REG-001" }` (le cas courant) ou
 * `{ cells: {...}, actions: [...] }` quand il veut poser un geste sur la ligne. Exiger la
 * seconde partout alourdirait chaque appelant pour une capacité que trois d'entre eux utilisent.
 */
function readRows(v: unknown, columns: WorkspaceColumn[]): WorkspaceRow[] {
  const out: WorkspaceRow[] = [];
  for (const r of arr(v)) {
    if (!isObj(r)) continue;
    const source = isObj(r.cells) ? r.cells : r;
    const cells: Record<string, string> = {};
    for (const c of columns) cells[c.key] = clip(s(source[c.key]), 120) ?? "—";
    const actions = actionsOf(r.actions).slice(0, WORKSPACE_LIMITS.rowActions);
    const href = s(r.href) ?? s(r.lien);
    const tons: Record<string, "neutre" | "attention" | "alerte" | "succes"> = {};
    if (isObj(r.tons)) {
      for (const [k, t] of Object.entries(r.tons)) {
        if (t === "neutre" || t === "attention" || t === "alerte" || t === "succes") tons[k] = t;
      }
    }
    out.push({
      cells,
      ...(Object.keys(tons).length ? { tons } : {}),
      ...(actions.length ? { actions } : {}),
      ...(href ? { href } : {}),
    });
    if (out.length >= WORKSPACE_LIMITS.tableRows) break;
  }
  return out;
}

function readSheet(v: unknown): WorkspaceDoc["feuille"] {
  if (!isObj(v)) return null;
  const columns = readColumns(v.columns);
  if (columns.length === 0) return null;
  const rows: Record<string, string>[] = [];
  for (const r of arr(v.rows)) {
    if (!isObj(r)) continue;
    const line: Record<string, string> = {};
    for (const c of columns) line[c.key] = clip(s(r[c.key]), 120) ?? "—";
    rows.push(line);
    if (rows.length >= WORKSPACE_LIMITS.sheetRows) break;
  }
  if (rows.length === 0) return null;
  return { columns, rows, total: num(v.total) ?? rows.length };
}

const TON = new Set(["neutre", "attention", "alerte", "succes"]);
const tonOf = (v: unknown, fallback?: "neutre" | "succes" | "attention" | "alerte") => {
  const t = s(v);
  return t && TON.has(t) ? (t as "neutre" | "attention" | "alerte" | "succes") : fallback;
};

function readMetrics(v: unknown): WorkspaceMetric[] {
  const out: WorkspaceMetric[] = [];
  for (const m of arr(v)) {
    if (!isObj(m)) continue;
    const valeur = clip(s(m.valeur) ?? s(m.value), 12);
    const label = clip(s(m.label) ?? s(m.libelle), 32);
    if (!valeur || !label) continue;
    out.push({ valeur, label, ...(tonOf(m.ton) ? { ton: tonOf(m.ton) } : {}) });
    if (out.length >= WORKSPACE_LIMITS.metrics) break;
  }
  return out;
}

/** Une personne déclarée par un outil — nom obligatoire, tout le reste facultatif. */
function readPerson(v: unknown): WorkspacePerson | null {
  if (!isObj(v)) return null;
  const nom = clip(s(v.nom) ?? s(v.name), 80);
  if (!nom) return null;
  const statutLabel = clip(s(isObj(v.statut) ? v.statut.label : v.statut), 24);
  const metriques = readMetrics(v.metriques);
  // La photo suit la règle des documents : une route de l'ERP, qui revérifie les droits. Une URL
  // externe est ÉCARTÉE — elle ferait fuiter la consultation vers un tiers, et afficherait un
  // visage que l'ERP n'a pas validé.
  const photo = s(v.photo) ?? s(v.avatar);
  return {
    nom,
    poste: s(v.poste), departement: s(v.departement), entite: s(v.entite),
    ...(photo && isInternalHref(photo) ? { photo } : {}),
    coordonnees: endpointsOf(v.coordonnees),
    ...(statutLabel ? { statut: { label: statutLabel, ton: tonOf(isObj(v.statut) ? v.statut.ton : null, "neutre")! } } : {}),
    ...(metriques.length ? { metriques } : {}),
    ...(s(v.href) ?? s(v.lien) ? { href: (s(v.href) ?? s(v.lien)) as string } : {}),
  };
}

/** Un bloc déclaré par un outil, relu champ par champ. Ce qui ne passe pas est ÉCARTÉ. */
function readBlock(v: unknown): WorkspaceBlock | null {
  if (!isObj(v)) return null;
  const title = s(v.title) ?? s(v.titre);
  if (!title) return null;

  if (v.kind === "progress") {
    const gauges: WorkspaceGauge[] = [];
    for (const g of arr(v.gauges ?? v.jauges)) {
      if (!isObj(g)) continue;
      const label = clip(s(g.label) ?? s(g.libelle), 60);
      const valeur = num(g.valeur) ?? num(g.value);
      if (!label || valeur === null) continue;
      const ton = s(g.ton);
      gauges.push({
        label, valeur,
        ...(num(g.total) !== null ? { total: num(g.total) as number } : {}),
        ...(s(g.unite) ? { unite: s(g.unite) } : {}),
        ...(s(g.detail) ? { detail: clip(s(g.detail), 80) } : {}),
        ...(ton && TONES.has(ton) ? { ton: ton as WorkspaceGauge["ton"] } : {}),
      });
      if (gauges.length >= WORKSPACE_LIMITS.gauges) break;
    }
    if (gauges.length === 0) return null;
    return { kind: "progress", title, gauges, ...(s(v.note) ? { note: s(v.note) } : {}) };
  }

  if (v.kind === "document") {
    const docs: WorkspaceDoc[] = [];
    for (const d of arr(v.docs ?? v.documents)) {
      if (!isObj(d)) continue;
      const nom = clip(s(d.nom) ?? s(d.name), 120);
      const href = s(d.href) ?? s(d.lien);
      if (!nom || !href || !isInternalHref(href)) continue;
      const type = s(d.type);
      const feuille = readSheet(d.feuille);
      docs.push({
        nom, href,
        type: (type && DOC_KINDS.has(type) ? type : "autre") as WorkspaceDoc["type"],
        ...(s(d.mime) ? { mime: s(d.mime) } : {}),
        ...(s(d.soustitre) ? { soustitre: clip(s(d.soustitre), 120) } : {}),
        ...(s(d.taille) ? { taille: s(d.taille) } : {}),
        ...(s(d.date) ? { date: s(d.date) } : {}),
        ...(num(d.pages) !== null ? { pages: num(d.pages) as number } : {}),
        ...(feuille ? { feuille } : {}),
      });
      if (docs.length >= WORKSPACE_LIMITS.docs) break;
    }
    if (docs.length === 0) return null;
    return { kind: "document", title, docs, ...(s(v.note) ? { note: s(v.note) } : {}) };
  }

  if (v.kind === "table") {
    const columns = readColumns(v.columns);
    const rows = readRows(v.rows, columns);
    if (columns.length === 0 || rows.length === 0) return null;
    return { kind: "table", title, columns, rows, total: num(v.total) ?? rows.length };
  }

  if (v.kind === "people") {
    // Une fiche RICHE — la même forme que `fromDirectoryLookup`, mais déclarée par l'outil qui
    // sait, lui, combien de dossiers cette personne porte et combien sont en retard.
    const people: WorkspacePerson[] = [];
    for (const p of arr(v.people ?? v.personnes)) {
      const person = readPerson(p);
      if (person) people.push(person);
      if (people.length >= WORKSPACE_LIMITS.people) break;
    }
    if (people.length === 0) return null;
    return {
      kind: "people", title, people,
      ...(s(v.note) ? { note: s(v.note) as string } : {}),
      ...(actionsOf(v.actions).length ? { actions: actionsOf(v.actions) } : {}),
    };
  }

  if (v.kind === "dossier") {
    const fields: WorkspaceField[] = [];
    for (const f of arr(v.fields ?? v.champs)) {
      if (!isObj(f)) continue;
      const label = clip(s(f.label) ?? s(f.libelle), 40);
      const value = clip(s(f.value) ?? s(f.valeur), WORKSPACE_LIMITS.snippetChars);
      if (!label || !value) continue;
      // Un champ qui DÉSIGNE quelqu'un porte son visage. La photo suit la même règle que
      // partout ailleurs : route interne, sinon on garde le nom seul.
      const av = isObj(f.avatar) ? f.avatar : null;
      const avNom = av ? clip(s(av.nom) ?? s(av.name), 80) : null;
      const avPhoto = av ? s(av.photo) : null;
      fields.push({
        label, value,
        ...(avNom ? { avatar: { nom: avNom, ...(avPhoto && isInternalHref(avPhoto) ? { photo: avPhoto } : {}) } } : {}),
        ...(tonOf(f.ton) ? { ton: tonOf(f.ton) } : {}),
        ...(readEditable(f.editable) ? { editable: readEditable(f.editable) } : {}),
      });
      if (fields.length >= WORKSPACE_LIMITS.recordFields) break;
    }

    const steps: WorkspaceStep[] = [];
    for (const st of arr(v.steps ?? v.etapes)) {
      if (!isObj(st)) continue;
      const label = clip(s(st.label) ?? s(st.libelle), 28);
      const etat = s(st.etat);
      if (!label) continue;
      steps.push({ label, etat: etat === "fait" || etat === "courant" ? etat : "a-venir" });
      if (steps.length >= WORKSPACE_LIMITS.steps) break;
    }

    const docs: WorkspaceDoc[] = [];
    for (const d of arr(v.docs)) {
      if (!isObj(d)) continue;
      const nom = clip(s(d.nom) ?? s(d.name), 120);
      const href = s(d.href) ?? s(d.lien);
      if (!nom || !href || !isInternalHref(href)) continue;
      const type = s(d.type);
      docs.push({
        nom, href,
        type: (type && DOC_KINDS.has(type) ? type : "autre") as WorkspaceDoc["type"],
        ...(s(d.taille) ? { taille: s(d.taille) } : {}),
        ...(s(d.date) ? { date: s(d.date) } : {}),
        ...(s(d.soustitre) ? { soustitre: clip(s(d.soustitre), 60) } : {}),
      });
      if (docs.length >= WORKSPACE_LIMITS.docs + 3) break;
    }

    const participants: WorkspacePerson[] = [];
    for (const p of arr(v.participants)) {
      const person = readPerson(p);
      if (person) participants.push(person);
      if (participants.length >= WORKSPACE_LIMITS.participants) break;
    }

    const activite: { date?: string | null; label: string }[] = [];
    for (const a of arr(v.activite ?? v.activity)) {
      if (!isObj(a)) continue;
      const label = clip(s(a.label) ?? s(a.libelle), WORKSPACE_LIMITS.snippetChars);
      if (!label) continue;
      activite.push({ label, date: s(a.date) });
      if (activite.length >= WORKSPACE_LIMITS.activity) break;
    }

    // UN DOSSIER SANS AUCUN CONTENU N'EST PAS UN DOSSIER. Une carte vide avec quatre boutons
    // promet un objet qui n'existe pas.
    if (fields.length === 0 && steps.length === 0) return null;

    const alerteLabel = clip(s(isObj(v.alerte) ? v.alerte.label : v.alerte), WORKSPACE_LIMITS.snippetChars);
    const badgeLabel = clip(s(isObj(v.badge) ? v.badge.label : v.badge), 24);
    const href = s(v.href) ?? s(v.lien);
    return {
      kind: "dossier", title,
      ...(s(v.subtitle) ?? s(v.soustitre) ? { subtitle: (s(v.subtitle) ?? s(v.soustitre)) as string } : {}),
      ...(badgeLabel ? { badge: { label: badgeLabel, ton: tonOf(isObj(v.badge) ? v.badge.ton : null, "neutre")! } } : {}),
      fields,
      ...(steps.length ? { steps } : {}),
      ...(alerteLabel ? { alerte: { label: alerteLabel, ton: tonOf(isObj(v.alerte) ? v.alerte.ton : null, "alerte") === "attention" ? "attention" : "alerte" } } : {}),
      ...(docs.length ? { docs } : {}),
      ...(participants.length ? { participants } : {}),
      ...(activite.length ? { activite } : {}),
      ...(href && isInternalHref(href) ? { href } : {}),
      ...(actionsOf(v.actions, WORKSPACE_LIMITS.blockActions).length ? { actions: actionsOf(v.actions, WORKSPACE_LIMITS.blockActions) } : {}),
    };
  }

  if (v.kind === "email") {
    const a = strings(v.a ?? v.to, 8);
    const corps = clip(s(v.corps) ?? s(v.body), 4000);
    if (a.length === 0 || !corps) return null;
    const statut = s(v.statut);
    return {
      kind: "email", title,
      a,
      ...(strings(v.cc, 8).length ? { cc: strings(v.cc, 8) } : {}),
      objet: clip(s(v.objet) ?? s(v.subject), 200) ?? "(sans objet)",
      corps,
      ...(strings(v.piecesJointes, 5).length ? { piecesJointes: strings(v.piecesJointes, 5) } : {}),
      statut: statut === "envoye" || statut === "annule" ? statut : "brouillon",
      ...(s(v.envoyeLe) ? { envoyeLe: s(v.envoyeLe) } : {}),
      ...(actionsOf(v.actions, WORKSPACE_LIMITS.blockActions).length ? { actions: actionsOf(v.actions, WORKSPACE_LIMITS.blockActions) } : {}),
    };
  }

  if (v.kind === "timeline") {
    const steps: { date?: string | null; label: string; detail?: string | null }[] = [];
    for (const st of arr(v.steps ?? v.etapes)) {
      if (!isObj(st)) continue;
      const label = clip(s(st.label) ?? s(st.libelle), 120);
      if (!label) continue;
      steps.push({ label, date: s(st.date), detail: clip(s(st.detail), WORKSPACE_LIMITS.snippetChars) });
      if (steps.length >= WORKSPACE_LIMITS.timelineSteps) break;
    }
    if (steps.length === 0) return null;
    return { kind: "timeline", title, steps };
  }

  // Tout autre `kind` — y compris ceux qui ont déjà un traducteur dédié : on ne veut pas deux
  // chemins pour la même forme, et surtout pas un chemin qui contourne la validation.
  return null;
}

function declaredBlocks(data: Json): WorkspaceBlock[] {
  const out: WorkspaceBlock[] = [];
  for (const b of arr(data._blocs)) {
    const parsed = readBlock(b);
    if (parsed) out.push(parsed);
    if (out.length >= 4) break;
  }
  return out;
}

export function composeWorkspace(tool: string, raw: string): WorkspaceComposition | null {
  const data = parse(raw);
  if (data === null) return null;

  let blocks: WorkspaceBlock[] = [];
  if (Array.isArray(data)) {
    if (tool === "read_calendar") blocks = fromCalendar(data);
    else blocks = fromTableTool(tool, data);
  } else {
    if (isEmptyAnswer(data)) return null;
    // Ce que l'outil DÉCLARE passe d'abord : il en sait plus que n'importe quelle inférence.
    blocks = declaredBlocks(data);
    if (blocks.length === 0) {
      switch (tool) {
        case "directory_lookup": blocks = fromDirectoryLookup(data); break;
        case "directory_list": blocks = fromDirectoryList(data); break;
        case "gmail_search": blocks = fromMail(data); break;
        case "list_pending_decisions": blocks = fromQueue(data); break;
        case "inspect_record": blocks = fromRecord(data); break;
        default: blocks = fromTableTool(tool, data);
      }
    }
  }

  if (blocks.length === 0) return null;
  return { source: tool, blocks };
}

/** Les outils qui savent composer — utile aux tests et à l'observabilité. */
export const COMPOSABLE_TOOLS: readonly string[] = [
  "directory_lookup", "directory_list", "gmail_search",
  "read_calendar", "list_pending_decisions", "inspect_record",
  ...Object.keys(TABLE_TOOLS),
];
