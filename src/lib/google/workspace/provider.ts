import { DOCS_BASE, SHEETS_BASE, SLIDES_BASE, PEOPLE_BASE, DRIVE_BASE } from "../config";
import { googleJson } from "../client";

/**
 * DOCS · SHEETS · SLIDES · CONTACTS — la bureautique Google d'Adam.
 *
 * Ces API ne remplacent pas les livrables DOCX/XLSX/PPTX déjà produits par le Chief : elles
 * ajoutent un CANAL DE SORTIE (un document Google se partage d'un lien, s'édite à plusieurs, et
 * survit à l'e-mail) et un CANAL D'ENTRÉE (lire une feuille qu'un partenaire a partagée).
 *
 * Chaque API Google a sa propre grammaire — `batchUpdate` de requêtes pour Docs et Slides,
 * plages A1 pour Sheets. On l'enferme ici : au-dessus, le Chief manipule des verbes métier
 * (créer, lire, ajouter), et rien de cette mécanique ne remonte jusqu'au modèle.
 */

// ───────────────────────────── Google Docs ─────────────────────────────

export interface GDocSummary {
  documentId: string;
  title: string;
  url: string;
}

export async function createDoc(accessToken: string, title: string, body?: string): Promise<GDocSummary> {
  const doc = await googleJson<{ documentId?: string; title?: string }>({
    method: "POST",
    url: `${DOCS_BASE}/documents`,
    accessToken,
    body: { title },
  });
  const documentId = String(doc.documentId ?? "");
  if (body?.trim()) await appendToDoc(accessToken, documentId, body);
  return { documentId, title: doc.title ?? title, url: `https://docs.google.com/document/d/${documentId}/edit` };
}

interface RawDocElement {
  paragraph?: { elements?: { textRun?: { content?: string } }[] };
  table?: { tableRows?: { tableCells?: { content?: RawDocElement[] }[] }[] };
}

/** Le TEXTE d'un document, tableaux compris — ce qu'un humain lirait, pas la structure. */
export async function readDocText(accessToken: string, documentId: string): Promise<{ title: string; text: string }> {
  const doc = await googleJson<{ title?: string; body?: { content?: RawDocElement[] } }>({
    url: `${DOCS_BASE}/documents/${encodeURIComponent(documentId)}`,
    accessToken,
  });
  const out: string[] = [];
  const walk = (elements: RawDocElement[] | undefined) => {
    for (const el of elements ?? []) {
      if (el.paragraph) {
        const line = (el.paragraph.elements ?? []).map((e) => e.textRun?.content ?? "").join("").replace(/\n+$/, "");
        if (line.trim()) out.push(line);
      }
      for (const row of el.table?.tableRows ?? []) {
        const cells = (row.tableCells ?? []).map((c) => {
          const sub: string[] = [];
          const inner = c.content ?? [];
          for (const e of inner) {
            const t = (e.paragraph?.elements ?? []).map((x) => x.textRun?.content ?? "").join("").trim();
            if (t) sub.push(t);
          }
          return sub.join(" ");
        });
        if (cells.some(Boolean)) out.push(cells.join(" | "));
      }
    }
  };
  walk(doc.body?.content);
  return { title: doc.title ?? "(sans titre)", text: out.join("\n").trim() };
}

/**
 * Ajoute du texte À LA FIN d'un document.
 *
 * `endOfSegmentLocation` plutôt qu'un index calculé : un index se périme dès que quelqu'un
 * d'autre tape une lettre, et l'insertion atterrit alors au milieu d'une phrase.
 */
export async function appendToDoc(accessToken: string, documentId: string, text: string): Promise<void> {
  await googleJson({
    method: "POST",
    url: `${DOCS_BASE}/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    accessToken,
    body: { requests: [{ insertText: { endOfSegmentLocation: {}, text: text.endsWith("\n") ? text : `${text}\n` } }] },
  });
}

/** Remplace un texte partout dans le document (publipostage simple : « {{nom}} » → « Deepak »). */
export async function replaceInDoc(accessToken: string, documentId: string, replacements: Record<string, string>): Promise<number> {
  const requests = Object.entries(replacements).map(([find, replace]) => ({
    replaceAllText: { containsText: { text: find, matchCase: true }, replaceText: replace },
  }));
  if (requests.length === 0) return 0;
  const res = await googleJson<{ replies?: { replaceAllText?: { occurrencesChanged?: number } }[] }>({
    method: "POST",
    url: `${DOCS_BASE}/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    accessToken,
    body: { requests },
  });
  return (res.replies ?? []).reduce((n, r) => n + Number(r.replaceAllText?.occurrencesChanged ?? 0), 0);
}

// ──────────────────────────── Google Sheets ────────────────────────────

export interface GSheetSummary {
  spreadsheetId: string;
  title: string;
  url: string;
  sheets: string[];
}

export async function createSpreadsheet(accessToken: string, title: string, firstSheetName = "Feuille 1"): Promise<GSheetSummary> {
  const res = await googleJson<{ spreadsheetId?: string; properties?: { title?: string }; sheets?: { properties?: { title?: string } }[] }>({
    method: "POST",
    url: `${SHEETS_BASE}/spreadsheets`,
    accessToken,
    body: { properties: { title }, sheets: [{ properties: { title: firstSheetName } }] },
  });
  const id = String(res.spreadsheetId ?? "");
  return {
    spreadsheetId: id,
    title: res.properties?.title ?? title,
    url: `https://docs.google.com/spreadsheets/d/${id}/edit`,
    sheets: (res.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean),
  };
}

export async function readRange(accessToken: string, spreadsheetId: string, range: string): Promise<string[][]> {
  const res = await googleJson<{ values?: string[][] }>({
    url: `${SHEETS_BASE}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
    accessToken,
    query: { majorDimension: "ROWS" },
  });
  return res.values ?? [];
}

/**
 * Écrit une plage. `USER_ENTERED` : « 12,5 » devient un nombre et « =SOMME(...) » une formule —
 * c'est ce qu'attend quelqu'un qui reçoit un tableau, plutôt qu'une colonne de texte inerte.
 */
export async function writeRange(accessToken: string, spreadsheetId: string, range: string, values: (string | number)[][]): Promise<number> {
  const res = await googleJson<{ updatedCells?: number }>({
    method: "PUT",
    url: `${SHEETS_BASE}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
    accessToken,
    query: { valueInputOption: "USER_ENTERED" },
    body: { range, majorDimension: "ROWS", values },
  });
  return Number(res.updatedCells ?? 0);
}

export async function appendRows(accessToken: string, spreadsheetId: string, range: string, values: (string | number)[][]): Promise<number> {
  const res = await googleJson<{ updates?: { updatedRows?: number } }>({
    method: "POST",
    url: `${SHEETS_BASE}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append`,
    accessToken,
    query: { valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS" },
    body: { range, majorDimension: "ROWS", values },
  });
  return Number(res.updates?.updatedRows ?? 0);
}

/** Crée une feuille COMPLÈTE depuis un tableau — le chemin normal d'un livrable du Chief. */
export async function createSheetFromTable(accessToken: string, title: string, header: string[], rows: (string | number)[][]): Promise<GSheetSummary> {
  const sheet = await createSpreadsheet(accessToken, title);
  const values = [header, ...rows];
  await writeRange(accessToken, sheet.spreadsheetId, `A1:${columnLetter(header.length)}${values.length}`, values);
  return sheet;
}

/** 1 → A, 27 → AA. Se teste seul, et évite les tableaux qui s'arrêtent à la colonne Z. */
export function columnLetter(n: number): string {
  let s = "";
  let x = Math.max(1, n);
  while (x > 0) {
    const rem = (x - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

// ──────────────────────────── Google Slides ────────────────────────────

export interface GSlidesSummary {
  presentationId: string;
  title: string;
  url: string;
  slideCount: number;
}

export async function createPresentation(accessToken: string, title: string): Promise<GSlidesSummary> {
  const res = await googleJson<{ presentationId?: string; title?: string; slides?: unknown[] }>({
    method: "POST",
    url: `${SLIDES_BASE}/presentations`,
    accessToken,
    body: { title },
  });
  const id = String(res.presentationId ?? "");
  return {
    presentationId: id,
    title: res.title ?? title,
    url: `https://docs.google.com/presentation/d/${id}/edit`,
    slideCount: (res.slides ?? []).length,
  };
}

interface RawSlide {
  objectId?: string;
  pageElements?: { shape?: { text?: { textElements?: { textRun?: { content?: string } }[] } } }[];
}

/** Le texte des diapositives — pour lire un support reçu, ou vérifier ce qu'on vient de produire. */
export async function readSlidesText(accessToken: string, presentationId: string): Promise<{ title: string; slides: string[] }> {
  const res = await googleJson<{ title?: string; slides?: RawSlide[] }>({
    url: `${SLIDES_BASE}/presentations/${encodeURIComponent(presentationId)}`,
    accessToken,
  });
  const slides = (res.slides ?? []).map((s) =>
    (s.pageElements ?? [])
      .map((el) => (el.shape?.text?.textElements ?? []).map((t) => t.textRun?.content ?? "").join(""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  return { title: res.title ?? "(sans titre)", slides };
}

/** Ajoute une diapositive TITRE + CORPS — la forme utile pour un point exécutif. */
export async function addSlide(accessToken: string, presentationId: string, title: string, body: string): Promise<void> {
  const slideId = `s_${Date.now().toString(36)}`;
  const titleId = `${slideId}_t`;
  const bodyId = `${slideId}_b`;
  await googleJson({
    method: "POST",
    url: `${SLIDES_BASE}/presentations/${encodeURIComponent(presentationId)}:batchUpdate`,
    accessToken,
    body: {
      requests: [
        {
          createSlide: {
            objectId: slideId,
            slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
            placeholderIdMappings: [
              { layoutPlaceholder: { type: "TITLE" }, objectId: titleId },
              { layoutPlaceholder: { type: "BODY" }, objectId: bodyId },
            ],
          },
        },
        { insertText: { objectId: titleId, text: title } },
        { insertText: { objectId: bodyId, text: body } },
      ],
    },
  });
}

// ──────────────────────── People / Contacts ────────────────────────

export interface GContact {
  resourceName: string;
  displayName: string;
  emails: string[];
  phones: string[];
  organization: string | null;
}

interface RawPerson {
  resourceName?: string;
  names?: { displayName?: string }[];
  emailAddresses?: { value?: string }[];
  phoneNumbers?: { value?: string }[];
  organizations?: { name?: string; title?: string }[];
}

function normalizePerson(p: RawPerson): GContact {
  return {
    resourceName: String(p.resourceName ?? ""),
    displayName: p.names?.[0]?.displayName ?? "(sans nom)",
    emails: (p.emailAddresses ?? []).map((e) => (e.value ?? "").toLowerCase()).filter(Boolean),
    phones: (p.phoneNumbers ?? []).map((e) => e.value ?? "").filter(Boolean),
    organization: p.organizations?.[0]?.name ?? null,
  };
}

const PERSON_FIELDS = "names,emailAddresses,phoneNumbers,organizations";

export async function listContacts(accessToken: string, pageSize = 100): Promise<GContact[]> {
  const res = await googleJson<{ connections?: RawPerson[] }>({
    url: `${PEOPLE_BASE}/people/me/connections`,
    accessToken,
    query: { personFields: PERSON_FIELDS, pageSize, sortOrder: "LAST_MODIFIED_DESCENDING" },
  });
  return (res.connections ?? []).map(normalizePerson);
}

/** Cherche un contact par nom ou fragment d'adresse — « Deepak » doit suffire. */
export async function searchContacts(accessToken: string, query: string, pageSize = 15): Promise<GContact[]> {
  const res = await googleJson<{ results?: { person?: RawPerson }[] }>({
    url: `${PEOPLE_BASE}/people:searchContacts`,
    accessToken,
    query: { query, readMask: PERSON_FIELDS, pageSize },
  });
  return (res.results ?? []).map((r) => normalizePerson(r.person ?? {}));
}

/** Le fichier Drive derrière un document bureautique — pour le partager ou le ranger. */
export async function driveFileOf(accessToken: string, fileId: string): Promise<{ id: string; name: string; webViewLink: string | null }> {
  const res = await googleJson<{ id?: string; name?: string; webViewLink?: string }>({
    url: `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}`,
    accessToken,
    query: { fields: "id,name,webViewLink" },
  });
  return { id: String(res.id ?? fileId), name: res.name ?? "", webViewLink: res.webViewLink ?? null };
}
