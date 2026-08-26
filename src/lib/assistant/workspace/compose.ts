import {
  WORKSPACE_LIMITS,
  type WorkspaceBlock, type WorkspaceComposition, type WorkspaceEndpoint,
  type WorkspaceEvent, type WorkspaceField, type WorkspaceItem, type WorkspaceMail,
  type WorkspacePerson, type WorkspaceColumn,
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

/** `list_pending_decisions` — la file. Chaque élément porte au moins un intitulé. */
function fromQueue(o: Json): WorkspaceBlock[] {
  const items: WorkspaceItem[] = [];
  for (const it of arr(o.elements)) {
    if (!isObj(it)) continue;
    const titre = s(it.titre) ?? s(it.libelle) ?? s(it.objet) ?? s(it.type);
    if (!titre) continue;
    items.push({
      titre,
      detail: clip(s(it.detail) ?? s(it.demandeur) ?? s(it.description), WORKSPACE_LIMITS.snippetChars),
      statut: s(it.statut) ?? s(it.etat),
      echeance: s(it.echeance) ?? s(it.date) ?? s(it.depuis),
      href: s(it.lien) ?? s(it.href),
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
    .map(([k]) => k)
    .slice(0, 6);
  if (keys.length === 0) return null;

  const columns: WorkspaceColumn[] = keys.map((k) => ({
    key: k,
    label: humanize(k),
    numeric: rows.every((r) => r[k] === undefined || typeof r[k] === "number"),
  }));
  const out: Record<string, string>[] = rows.map((r) => {
    const line: Record<string, string> = {};
    for (const k of keys) line[k] = clip(s(r[k]), 80) ?? "—";
    return line;
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
export function composeWorkspace(tool: string, raw: string): WorkspaceComposition | null {
  const data = parse(raw);
  if (data === null) return null;

  let blocks: WorkspaceBlock[] = [];
  if (Array.isArray(data)) {
    if (tool === "read_calendar") blocks = fromCalendar(data);
  } else {
    if (isEmptyAnswer(data)) return null;
    switch (tool) {
      case "directory_lookup": blocks = fromDirectoryLookup(data); break;
      case "directory_list": blocks = fromDirectoryList(data); break;
      case "gmail_search": blocks = fromMail(data); break;
      case "list_pending_decisions": blocks = fromQueue(data); break;
      case "inspect_record": blocks = fromRecord(data); break;
      default: blocks = [];
    }
  }

  if (blocks.length === 0) return null;
  return { source: tool, blocks };
}

/** Les outils qui savent composer — utile aux tests et à l'observabilité. */
export const COMPOSABLE_TOOLS: readonly string[] = [
  "directory_lookup", "directory_list", "gmail_search",
  "read_calendar", "list_pending_decisions", "inspect_record",
];
