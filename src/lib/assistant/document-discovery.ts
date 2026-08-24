import type { PowerTool } from "@/lib/assistant/power-tools";
import type { CurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { searchDrive } from "@/lib/queries/drive-search";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";
import { getBlob } from "@/lib/drive-storage";
import { extractAttachmentText } from "@/lib/assistant-files";
import { foldText } from "@/lib/assistant/memory-context";

/**
 * DÉCOUVERTE DOCUMENTAIRE EN DRIVE « SALE » — retrouver un document que son NOM ne trahit pas.
 *
 * Le Drive réel n'est pas propre : « scan_0234.pdf » peut être le contrat de Khaled, rangé dans
 * le mauvais dossier. La règle : LE NOM D'UN FICHIER EST UN INDICE, PAS UNE PREUVE — la preuve,
 * c'est le CONTENU lu. Le moteur combine donc trois sources :
 *   1. les MÉTADONNÉES (nom/chemin, via la même recherche que l'écran Drive) ;
 *   2. l'INDEX TEXTUEL PROGRESSIF (`DriveTextIndex`) — le texte des fichiers déjà lus, qui
 *      grandit à chaque lecture (read_document, find_documents) : jamais de balayage massif ;
 *   3. la LECTURE À LA VOLÉE, bornée, des meilleurs candidats non encore indexés.
 *
 * Chaque résultat porte sa CONFIANCE (HAUTE = les termes sont dans le contenu lu ;
 * MOYENNE = correspondance partielle ; FAIBLE = le nom seul, contenu illisible ou non lu)
 * et sa PREUVE (extrait cité). Les DROITS Drive se revérifient nœud par nœud, y compris
 * pour l'index : un texte indexé ne s'affiche jamais à qui ne peut pas ouvrir le fichier.
 */

const EXEC = (u: CurrentUser): boolean => u.role === "SUPER_ADMIN" || u.role === "DIRECTION";

const str = (input: Record<string, unknown>, key: string): string =>
  typeof input[key] === "string" ? (input[key] as string).trim() : "";

/** Texte indexé par fichier (assez pour retrouver et citer, sans stocker le document entier). */
const INDEX_TEXT_CAP = 20_000;
/** Au-delà, pas de lecture à la volée (un .zip d'1 Go n'a rien à faire ici). */
const ON_THE_FLY_SIZE_CAP = 8 * 1024 * 1024;

/**
 * Mémorise le texte extrait d'un fichier du Drive — appelé après CHAQUE lecture réussie.
 * Meilleur-effort : l'échec d'indexation ne casse jamais la lecture.
 */
export async function indexDriveNodeText(nodeId: string, versionId: string, text: string, note?: string | null): Promise<void> {
  try {
    const capped = text.slice(0, INDEX_TEXT_CAP);
    await prisma.driveTextIndex.upsert({
      where: { nodeId },
      create: { nodeId, versionId, text: capped, textFold: foldText(capped), note: note ?? null },
      update: { versionId, text: capped, textFold: foldText(capped), note: note ?? null },
    });
  } catch (err) {
    console.error("[assistant] indexDriveNodeText failed", err);
  }
}

interface NodeText {
  name: string;
  text: string | null;
  note: string | null;
  fromIndex: boolean;
}

/**
 * Lit le texte d'un nœud : index d'abord (si la version n'a pas bougé), sinon extraction à la
 * volée + indexation. Le DROIT a déjà été vérifié par l'appelant (nœud par nœud).
 */
async function nodeText(nodeId: string): Promise<NodeText | null> {
  const node = await prisma.driveNode.findUnique({
    where: { id: nodeId },
    select: { name: true, type: true, isTrashed: true, size: true },
  });
  if (!node || node.isTrashed || node.type !== "FILE") return null;

  const version = await prisma.fileVersion.findFirst({
    where: { nodeId }, orderBy: { version: "desc" }, select: { id: true, blobId: true },
  });
  if (!version) return { name: node.name, text: null, note: "aucune version de fichier", fromIndex: false };

  const cached = await prisma.driveTextIndex.findUnique({
    where: { nodeId }, select: { versionId: true, text: true, note: true },
  });
  if (cached && cached.versionId === version.id) {
    return { name: node.name, text: cached.text || null, note: cached.note, fromIndex: true };
  }

  if (node.size > ON_THE_FLY_SIZE_CAP) {
    return { name: node.name, text: null, note: "trop volumineux pour une lecture à la volée", fromIndex: false };
  }
  const bytes = await getBlob(version.blobId).catch(() => null);
  if (!bytes) return { name: node.name, text: null, note: "contenu indisponible", fromIndex: false };
  const t = await extractAttachmentText(node.name, bytes);
  // On indexe MÊME l'échec (texte vide) : inutile de re-tenter un scan illisible à chaque fois.
  await indexDriveNodeText(nodeId, version.id, t.text ?? "", t.note ?? (t.text ? null : "illisible (scan sans OCR ?)"));
  return { name: node.name, text: t.text || null, note: t.note ?? null, fromIndex: false };
}

interface Finding {
  nodeId: string;
  nom: string;
  chemin?: string;
  matchedInName: number;
  matchedInContent: number;
  excerpt?: string;
  note?: string | null;
  contentChecked: boolean;
}

function tokensOf(query: string): string[] {
  return [...new Set(foldText(query).split(/[^a-z0-9]+/).filter((t) => t.length >= 3))].slice(0, 8);
}

function countMatches(foldedHaystack: string, tokens: string[]): number {
  return tokens.filter((t) => foldedHaystack.includes(t)).length;
}

function excerptAround(text: string, tokens: string[]): string | undefined {
  const folded = foldText(text);
  for (const t of tokens) {
    const at = folded.indexOf(t);
    if (at >= 0) {
      const start = Math.max(0, at - 90);
      const end = Math.min(text.length, at + t.length + 130);
      return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
    }
  }
  return undefined;
}

export const DOCUMENT_DISCOVERY_TOOLS: PowerTool[] = [
  {
    def: {
      name: "find_documents",
      description:
        "RETROUVE des documents dans le Drive même MAL NOMMÉS ou MAL RANGÉS (« retrouve le contrat de Khaled », « la facture " +
        "du fournisseur X de mars ») : cherche dans les NOMS, dans le TEXTE des fichiers déjà lus (index progressif), puis LIT " +
        "les meilleurs candidats pour VÉRIFIER. Chaque résultat porte sa CONFIANCE (HAUTE = termes trouvés dans le contenu lu ; " +
        "MOYENNE = partiel ; FAIBLE = nom seul, contenu non vérifiable) et sa PREUVE (extrait). Le nom d'un fichier est un indice, " +
        "pas une preuve. Plus lent que search_drive : à utiliser quand la recherche par nom ne suffit pas.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Ce que l'on cherche : nature du document + entité (« contrat Khaled Benali », « facture Sarl Imprimerie mars »)." },
          max_reads: { type: "number", description: "Nombre maximum de fichiers lus à la volée pour vérification (défaut 6, max 10)." },
        },
        required: ["query"],
      },
    },
    allowed: EXEC,
    label: "Découverte documentaire (contenu vérifié)",
    run: async (input, user) => {
      const query = str(input, "query");
      if (query.length < 3) return "Donnez ce que vous cherchez (nature du document + nom/entité).";
      const maxReads = Math.min(Math.max(Math.round(Number(input.max_reads) || 6), 1), 10);
      const tokens = tokensOf(query);
      if (tokens.length === 0) return "Termes trop courts — donnez au moins un mot de 3 caractères.";

      const findings = new Map<string, Finding>();

      // 1) MÉTADONNÉES — la même recherche que l'écran Drive (droits déjà appliqués).
      //    La requête entière, puis chaque terme séparément : un fichier « BENALI_scan.pdf »
      //    doit sortir même si « contrat » n'est pas dans son nom.
      const metaQueries = [query, ...tokens.filter((t) => !foldText(query).startsWith(t))].slice(0, 4);
      const metaResults = await Promise.all(metaQueries.map((q) => searchDrive(user, q).catch(() => ({ rows: [], truncated: false }))));
      for (const out of metaResults) {
        for (const r of out.rows.slice(0, 15)) {
          const prev = findings.get(r.id);
          const matchedInName = countMatches(foldText(`${r.name} ${r.path ?? ""}`), tokens);
          if (!prev) {
            findings.set(r.id, { nodeId: r.id, nom: r.name, chemin: r.path, matchedInName, matchedInContent: 0, contentChecked: false });
          } else if (matchedInName > prev.matchedInName) prev.matchedInName = matchedInName;
        }
      }

      // 2) INDEX TEXTUEL — les fichiers déjà lus dont le CONTENU porte tous les termes
      //    (repli : au moins un terme si la conjonction ne donne rien). Droit revérifié nœud
      //    par nœud AVANT toute exploitation.
      const indexed = await prisma.driveTextIndex.findMany({
        where: { AND: tokens.map((t) => ({ textFold: { contains: t } })) },
        select: { nodeId: true, text: true, note: true },
        orderBy: { updatedAt: "desc" },
        take: 15,
      });
      const indexedFallback = indexed.length > 0 ? [] : await prisma.driveTextIndex.findMany({
        where: { OR: tokens.map((t) => ({ textFold: { contains: t } })) },
        select: { nodeId: true, text: true, note: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
      for (const hit of [...indexed, ...indexedFallback]) {
        if (!canViewDrive(await resolveDriveAccess(user, hit.nodeId))) continue; // jamais le contenu d'autrui
        const node = await prisma.driveNode.findUnique({ where: { id: hit.nodeId }, select: { name: true, isTrashed: true } });
        if (!node || node.isTrashed) continue;
        const matchedInContent = countMatches(foldText(hit.text), tokens);
        const f = findings.get(hit.nodeId) ?? { nodeId: hit.nodeId, nom: node.name, matchedInName: countMatches(foldText(node.name), tokens), matchedInContent: 0, contentChecked: false };
        f.matchedInContent = Math.max(f.matchedInContent, matchedInContent);
        f.excerpt = f.excerpt ?? excerptAround(hit.text, tokens);
        f.contentChecked = true;
        f.note = hit.note;
        findings.set(hit.nodeId, f);
      }

      // 3) VÉRIFICATION par LECTURE des meilleurs candidats « nom seul » (bornée).
      const toVerify = [...findings.values()]
        .filter((f) => !f.contentChecked)
        .sort((a, b) => b.matchedInName - a.matchedInName)
        .slice(0, maxReads);
      let unreadable = 0;
      for (const f of toVerify) {
        if (!canViewDrive(await resolveDriveAccess(user, f.nodeId))) { findings.delete(f.nodeId); continue; }
        const t = await nodeText(f.nodeId);
        if (!t) { findings.delete(f.nodeId); continue; }
        f.contentChecked = true;
        f.note = t.note;
        if (t.text) {
          f.matchedInContent = countMatches(foldText(t.text), tokens);
          f.excerpt = excerptAround(t.text, tokens);
        } else {
          unreadable += 1;
        }
      }

      if (findings.size === 0) {
        const total = await prisma.driveTextIndex.count();
        return `Aucun document trouvé pour « ${query} » — ni par le nom, ni dans le texte des ${total} fichier(s) déjà indexés. ` +
          "L'index textuel grandit à chaque lecture : un document jamais ouvert par l'assistant et mal nommé peut lui échapper — préciser un dossier ou un autre terme peut aider.";
      }

      // CONFIANCE : le CONTENU prime toujours sur le nom.
      const need = Math.min(tokens.length, 2);
      const ranked = [...findings.values()]
        .map((f) => {
          const confiance = f.matchedInContent >= need ? "HAUTE" : f.matchedInContent >= 1 ? "MOYENNE" : "FAIBLE";
          return { ...f, confiance };
        })
        .sort((a, b) => (b.matchedInContent - a.matchedInContent) || (b.matchedInName - a.matchedInName))
        .slice(0, 12);

      const total = await prisma.driveTextIndex.count();
      return JSON.stringify({
        recherche: query,
        resultats: ranked.map((f) => ({
          nom: f.nom,
          chemin: f.chemin,
          lien: `/drive/${f.nodeId}`,
          driveNodeId: f.nodeId,
          confiance: f.confiance,
          preuve: f.excerpt ?? (f.confiance === "FAIBLE" ? "correspondance sur le NOM seulement — contenu non vérifiable" : undefined),
          termesDansContenu: `${f.matchedInContent}/${tokens.length}`,
          note: f.note ?? undefined,
        })),
        illisibles: unreadable || undefined,
        indexTextuel: `${total} fichier(s) du Drive indexés en texte — l'index s'enrichit à chaque lecture.`,
        rappel: "Le nom d'un fichier est un INDICE, pas une preuve : ne conclure qu'à partir des résultats HAUTE/MOYENNE (contenu vérifié), et lire le document (read_document) avant d'en citer un chiffre.",
      });
    },
  },
];
