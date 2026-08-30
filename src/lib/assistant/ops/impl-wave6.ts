import { prisma } from "@/lib/prisma";
import {
  createBdProject, updateBdProject, deleteBdProject, createBdRange, updateBdRange, deleteBdRange,
  createBdProduct, updateBdProduct, deleteBdProduct, updateBdCell, addBdProjectComment,
} from "@/lib/actions/bd-project-actions";
import {
  updateDossierStatus, assignDossier, postDossierMessage, linkEmailToDossier, createDossierFromTask,
  archiveDossier, deleteDossierMessage, editDossierMessage,
} from "@/lib/actions/dossier-actions";
import { createDirective, updateDirectiveStatus, postDirectiveMessage } from "@/lib/actions/directive-actions";
import { createSupportRequest, takeSupportRequest, answerSupportRequest, updateSupportStatus } from "@/lib/actions/support-actions";
import { createReminder, completeReminder, cancelReminder, snoozeReminder } from "@/lib/actions/reminder-actions";
import { ROLE_LABELS } from "@/lib/labels";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { runFd, runFd2, fieldsOf, resolveOne, isoDate } from "./helpers";
import { matchLabel, fold } from "./impl-regulatory";

/**
 * OPS VAGUE 6a — BUSINESS DEVELOPMENT tableau stratégique (projets → gammes → produits, FUSION
 * intégrale du produit 19 champs, cellule par liste blanche), PROJETS de suivi (statut, équipe
 * REJOUÉE, fil avec mentions membres, e-mail lié, ouverture depuis une tâche, messages édités /
 * supprimés par extrait), DIRECTIVES (émission Direction vers personne OU rôle, statut dont
 * archivage réservé, fil), SUPPORT (demande vers personne/rôle, prise en charge, réponse qui
 * clôt, statut), RAPPELS personnels (création datée, terminer, reporter +1 j par défaut,
 * annuler). Toujours par les ACTIONS CANONIQUES.
 */

// ─────────────────────────── BUSINESS DEVELOPMENT — tableau stratégique ───────────────────────────

const BD_STATUS_FR: [string, string][] = [
  ["IDEA", "Idée"], ["TO_ANALYZE", "À analyser"], ["IN_PROGRESS", "En cours"],
  ["AWAITING_SUPPLIER", "Attente fournisseur"], ["AWAITING_INTERNAL", "Attente interne"],
  ["RECOMMENDATION_READY", "Recommandation prête"], ["VALIDATED", "Validée"],
  ["ABANDONED", "Abandonnée"], ["CLOSED", "Clôturée"],
];
const SOURCING_FR: [string, string][] = [
  ["MANUFACTURED", "Fabrication locale"], ["IMPORTED", "Importation"], ["TO_STUDY", "À étudier"],
];
const PRIORITY_FR: [string, string][] = [
  ["LOW", "Basse"], ["MEDIUM", "Moyenne"], ["HIGH", "Haute"], ["CRITICAL", "Critique"],
];

const resolveBdProject = (raw: string) =>
  resolveOne(raw, "le projet BD (champ « target » — son nom)",
    (q) => prisma.bdProject.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 6 }),
    (p) => p.name);

interface BdRangeHit { id: string; name: string; projectId: string; projectName: string }

async function resolveBdRange(raw: string, projectRaw: string): Promise<BdRangeHit | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez la gamme (champ « range » — son nom)." };
  const rows = await prisma.bdRange.findMany({
    where: {
      name: { contains: q, mode: "insensitive" },
      ...(projectRaw.trim() ? { project: { name: { contains: projectRaw.trim(), mode: "insensitive" } } } : {}),
    },
    select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
    take: 6,
  });
  if (rows.length === 1) return { id: rows[0].id, name: rows[0].name, projectId: rows[0].projectId, projectName: rows[0].project.name };
  if (rows.length === 0) return { error: `Aucune gamme « ${q} »${projectRaw ? ` sur le projet « ${projectRaw} »` : ""}.` };
  return { error: `Plusieurs gammes correspondent : ${rows.map((r) => `${r.name} (${r.project.name})`).join(" ; ")} — préciser le projet (champ « target »).` };
}

interface BdProductHit { id: string; dci: string; projectId: string; projectName: string }

async function resolveBdProduct(raw: string, projectRaw: string): Promise<BdProductHit | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez le produit (champ « product » — DCI ou nom de marque)." };
  const rows = await prisma.bdProduct.findMany({
    where: {
      OR: [{ dci: { contains: q, mode: "insensitive" } }, { brandName: { contains: q, mode: "insensitive" } }],
      ...(projectRaw.trim() ? { range: { project: { name: { contains: projectRaw.trim(), mode: "insensitive" } } } } : {}),
    },
    select: { id: true, dci: true, range: { select: { projectId: true, project: { select: { name: true } } } } },
    take: 6,
  });
  if (rows.length === 1) return { id: rows[0].id, dci: rows[0].dci, projectId: rows[0].range.projectId, projectName: rows[0].range.project.name };
  if (rows.length === 0) return { error: `Aucun produit BD « ${q} »${projectRaw ? ` sur le projet « ${projectRaw} »` : ""}.` };
  return { error: `Plusieurs produits correspondent : ${rows.map((r) => `${r.dci} (${r.range.project.name})`).join(" ; ")} — préciser le projet (champ « target »).` };
}

/** Champs produit rejoués tels quels par la FUSION (l'action REMPLACE tout). */
const BD_PRODUCT_FIELDS = [
  "brandName", "dosage", "form", "competitors", "competitorShares", "competitorVolume", "competitorPrice", "comment",
] as const;
const BD_PRODUCT_NUMS = [
  "marketSizeDzd", "marketSizeUsd", "unitPrice", "totalMarketVolume",
  "investmentY1", "investmentY2", "investmentY3", "revenueY1", "revenueY2", "revenueY3",
] as const;

/** Liste blanche des cellules éditables (libellés FR → clé technique de l'action). */
const BD_CELL_PROJECT_FR: [string, string][] = [
  ["name", "Nom"], ["description", "Description"], ["comment", "Commentaire"], ["status", "Statut"],
];
const BD_CELL_PRODUCT_FR: [string, string][] = [
  ["dci", "DCI"], ["brandName", "Nom de marque"], ["dosage", "Dosage"], ["form", "Forme"],
  ["sourcing", "Sourcing"], ["marketSizeDzd", "Taille de marché DZD"], ["marketSizeUsd", "Taille de marché USD"],
  ["unitPrice", "Prix unitaire"], ["totalMarketVolume", "Volume de marché"], ["competitors", "Concurrents"],
  ["competitorShares", "Parts des concurrents"], ["competitorVolume", "Volumes des concurrents"],
  ["competitorPrice", "Prix des concurrents"], ["investmentY1", "Investissement A1"], ["investmentY2", "Investissement A2"],
  ["investmentY3", "Investissement A3"], ["revenueY1", "Revenus A1"], ["revenueY2", "Revenus A2"],
  ["revenueY3", "Revenus A3"], ["comment", "Commentaire"],
];

export const BD6_OPS_IMPL: Record<string, OpImpl> = {
  create_bd_project: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "name") || opStr(input, "label");
      if (!name) return { error: "Nommez le projet BD (champ « name »)." };
      const statusRaw = opStr(input, "status");
      const status = statusRaw ? matchLabel(statusRaw, BD_STATUS_FR) : null;
      if (status && typeof status === "object") return status;
      return {
        title: `Créer le projet BD « ${name} »`,
        fields: fieldsOf([
          ["Projet", name],
          ["Stade", status ? BD_STATUS_FR.find(([c]) => c === status)?.[1] ?? null : "Idée (défaut)"],
          ["Description", opStr(input, "notes") || null],
        ]),
        args: { name, status: status || null, description: opStr(input, "notes") || null, comment: opStr(input, "note") || null },
        successMessage: `Projet BD « ${name} » créé.`,
        revalidate: ["/business-development"],
      };
    },
    execute: (args) => runFd2(createBdProject, args, "La création du projet a été refusée.", { revalidate: ["/business-development"] }),
  },

  update_bd_project: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveBdProject(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const current = await prisma.bdProject.findUnique({
        where: { id: hit.id }, select: { name: true, description: true, comment: true, status: true },
      });
      if (!current) return { error: "Projet introuvable." };
      const statusRaw = opStr(input, "status");
      const status = statusRaw ? matchLabel(statusRaw, BD_STATUS_FR) : null;
      if (status && typeof status === "object") return status;
      const newName = opStr(input, "newName") || current.name;
      // FUSION : l'action REMPLACE nom, description et commentaire — l'existant est relu et rejoué.
      return {
        title: `Modifier le projet BD « ${current.name} »`,
        fields: fieldsOf([
          ["Projet", newName !== current.name ? `${current.name} → ${newName}` : current.name],
          ["Stade", status ? BD_STATUS_FR.find(([c]) => c === status)?.[1] ?? null : `${BD_STATUS_FR.find(([c]) => c === current.status)?.[1] ?? current.status} (inchangé)`],
          ["Le reste", "description et commentaire rejoués à l'identique"],
        ]),
        args: {
          id: hit.id, name: newName, status: status || null,
          description: opStr(input, "notes") || current.description || null,
          comment: opStr(input, "note") || current.comment || null,
        },
        successMessage: `Projet « ${newName} » modifié.`,
        revalidate: ["/business-development"],
      };
    },
    execute: (args) => runFd(updateBdProject, args, "La modification du projet a été refusée.", { revalidate: ["/business-development"] }),
  },

  delete_bd_project: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveBdProject(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const [ranges, products] = await Promise.all([
        prisma.bdRange.count({ where: { projectId: hit.id } }),
        prisma.bdProduct.count({ where: { range: { projectId: hit.id } } }),
      ]);
      return {
        title: `SUPPRIMER le projet BD « ${hit.name} »`,
        fields: [
          { label: "Projet", value: hit.name },
          { label: "Emporté en cascade", value: `${ranges} gamme(s), ${products} produit(s)` },
        ],
        warnings: ["Suppression DÉFINITIVE du projet ET de toutes ses gammes et produits — le tableau stratégique perd ces lignes."],
        confirmText: hit.name,
        args: { id: hit.id },
        successMessage: `Projet « ${hit.name} » supprimé (gammes et produits compris).`,
        revalidate: ["/business-development"],
      };
    },
    execute: (args) => runFd(deleteBdProject, args, "La suppression du projet a été refusée.", { revalidate: ["/business-development"] }),
  },

  create_bd_range: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveBdProject(opStr(input, "target"));
      if ("error" in hit) return hit;
      const name = opStr(input, "name") || opStr(input, "range");
      if (!name) return { error: "Nommez la gamme (champ « name »)." };
      return {
        title: `Ajouter la gamme « ${name} » au projet « ${hit.name} »`,
        fields: fieldsOf([["Projet", hit.name], ["Gamme", name], ["Commentaire", opStr(input, "note") || null]]),
        args: { projectId: hit.id, name, comment: opStr(input, "note") || null },
        successMessage: `Gamme « ${name} » ajoutée à « ${hit.name} ».`,
        revalidate: ["/business-development"],
      };
    },
    execute: (args) => runFd(createBdRange, args, "L'ajout de la gamme a été refusé.", { revalidate: ["/business-development"] }),
  },

  update_bd_range: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveBdRange(opStr(input, "range") || opStr(input, "name"), opStr(input, "target"));
      if ("error" in hit) return hit;
      const current = await prisma.bdRange.findUnique({ where: { id: hit.id }, select: { comment: true } });
      const newName = opStr(input, "newName") || hit.name;
      // FUSION : nom et commentaire sont REMPLACÉS — le commentaire existant est rejoué s'il n'est pas donné.
      return {
        title: `Modifier la gamme « ${hit.name} » (${hit.projectName})`,
        fields: fieldsOf([
          ["Gamme", newName !== hit.name ? `${hit.name} → ${newName}` : hit.name],
          ["Commentaire", opStr(input, "note") || (current?.comment ? `${current.comment} (rejoué)` : null)],
        ]),
        args: { id: hit.id, name: newName, comment: opStr(input, "note") || current?.comment || null },
        successMessage: `Gamme « ${newName} » modifiée.`,
        revalidate: ["/business-development"],
      };
    },
    execute: (args) => runFd(updateBdRange, args, "La modification de la gamme a été refusée.", { revalidate: ["/business-development"] }),
  },

  delete_bd_range: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveBdRange(opStr(input, "range") || opStr(input, "name"), opStr(input, "target"));
      if ("error" in hit) return hit;
      const products = await prisma.bdProduct.count({ where: { rangeId: hit.id } });
      return {
        title: `Supprimer la gamme « ${hit.name} » (${hit.projectName})`,
        fields: [{ label: "Gamme", value: hit.name }, { label: "Produits emportés", value: String(products) }],
        warnings: ["Suppression définitive de la gamme ET de ses produits (cascade)."],
        args: { id: hit.id },
        successMessage: `Gamme « ${hit.name} » supprimée.`,
        revalidate: ["/business-development"],
      };
    },
    execute: (args) => runFd(deleteBdRange, args, "La suppression de la gamme a été refusée.", { revalidate: ["/business-development"] }),
  },

  create_bd_product: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const range = await resolveBdRange(opStr(input, "range"), opStr(input, "target"));
      if ("error" in range) return range;
      const dci = opStr(input, "dci") || opStr(input, "name");
      if (!dci) return { error: "Précisez le DCI / produit (champ « dci »)." };
      const sourcingRaw = opStr(input, "mode");
      const sourcing = sourcingRaw ? matchLabel(sourcingRaw, SOURCING_FR) : null;
      if (sourcing && typeof sourcing === "object") return sourcing;
      return {
        title: `Ajouter le produit « ${dci} » à la gamme « ${range.name} »`,
        fields: fieldsOf([
          ["Gamme", `${range.name} (${range.projectName})`],
          ["DCI", dci],
          ["Nom de marque", opStr(input, "label") || null],
          ["Sourcing", sourcing ? SOURCING_FR.find(([c]) => c === sourcing)?.[1] ?? null : null],
        ]),
        args: {
          rangeId: range.id, dci,
          brandName: opStr(input, "label") || null, dosage: opStr(input, "dosage") || null,
          form: opStr(input, "form") || null, sourcing: sourcing || null,
          comment: opStr(input, "note") || null,
        },
        successMessage: `Produit « ${dci} » ajouté à « ${range.name} ».`,
        revalidate: ["/business-development"],
      };
    },
    execute: (args) => runFd(createBdProduct, args, "L'ajout du produit a été refusé.", { revalidate: ["/business-development"] }),
  },

  update_bd_product: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveBdProduct(opStr(input, "product") || opStr(input, "dci"), opStr(input, "target"));
      if ("error" in hit) return hit;
      const current = await prisma.bdProduct.findUnique({ where: { id: hit.id } });
      if (!current) return { error: "Produit introuvable." };
      const sourcingRaw = opStr(input, "mode");
      const sourcing = sourcingRaw ? matchLabel(sourcingRaw, SOURCING_FR) : null;
      if (sourcing && typeof sourcing === "object") return sourcing;
      // FUSION INTÉGRALE : l'action REMPLACE les 19 champs de l'étude produit — tout
      // l'existant est relu et rejoué ; seuls les champs donnés changent.
      const args: Record<string, string | null> = { id: hit.id, dci: opStr(input, "dci") || current.dci };
      for (const f of BD_PRODUCT_FIELDS) args[f] = (current[f] as string | null) ?? null;
      for (const f of BD_PRODUCT_NUMS) args[f] = current[f] != null ? String(Number(current[f])) : null;
      if (opStr(input, "label")) args.brandName = opStr(input, "label");
      if (opStr(input, "dosage")) args.dosage = opStr(input, "dosage");
      if (opStr(input, "form")) args.form = opStr(input, "form");
      if (opStr(input, "note")) args.comment = opStr(input, "note");
      args.sourcing = sourcing || ((current.sourcing as string | null) ?? null);
      return {
        title: `Modifier le produit BD « ${hit.dci} » (${hit.projectName})`,
        fields: fieldsOf([
          ["Produit", hit.dci],
          ["Sourcing", sourcing ? SOURCING_FR.find(([c]) => c === sourcing)?.[1] ?? null : null],
          ["Le reste", "les 19 champs de l'étude sont rejoués à l'identique (FUSION) — pour UNE cellule chiffrée, préférer set_bd_cell"],
        ]),
        args,
        successMessage: `Produit « ${hit.dci} » modifié.`,
        revalidate: ["/business-development"],
      };
    },
    execute: (args) => runFd(updateBdProduct, args, "La modification du produit a été refusée.", { revalidate: ["/business-development"] }),
  },

  delete_bd_product: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveBdProduct(opStr(input, "product") || opStr(input, "dci"), opStr(input, "target"));
      if ("error" in hit) return hit;
      return {
        title: `Supprimer le produit BD « ${hit.dci} » (${hit.projectName})`,
        fields: [{ label: "Produit", value: hit.dci }],
        warnings: ["Suppression définitive de la ligne produit du tableau stratégique."],
        args: { id: hit.id },
        successMessage: `Produit « ${hit.dci} » supprimé.`,
        revalidate: ["/business-development"],
      };
    },
    execute: (args) => runFd(deleteBdProduct, args, "La suppression du produit a été refusée.", { revalidate: ["/business-development"] }),
  },

  set_bd_cell: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const kindRaw = fold(opStr(input, "kind") || opStr(input, "mode"));
      const isProduct = /produit|product/.test(kindRaw);
      const isProject = /projet|project/.test(kindRaw);
      if (!isProduct && !isProject) return { error: "Précisez la cible (champ « kind ») : projet ou produit." };
      const value = opStr(input, "value") || opStr(input, "note");
      const fieldRaw = opStr(input, "field") || opStr(input, "label");
      if (isProject) {
        const hit = await resolveBdProject(opStr(input, "target") || opStr(input, "name"));
        if ("error" in hit) return hit;
        const field = matchLabel(fieldRaw, BD_CELL_PROJECT_FR);
        if (typeof field === "object") return field;
        const shown = field === "status" ? (() => { const s = matchLabel(value, BD_STATUS_FR); return typeof s === "string" ? s : value; })() : value;
        if (field === "status" && !BD_STATUS_FR.some(([c]) => c === shown)) return { error: "Statut de projet inconnu — stades : " + BD_STATUS_FR.map(([, l]) => l).join(", ") + "." };
        return {
          title: `${hit.name} : ${BD_CELL_PROJECT_FR.find(([c]) => c === field)?.[1]} → ${shown || "(vide)"}`,
          fields: [{ label: "Projet", value: hit.name }, { label: "Cellule", value: `${BD_CELL_PROJECT_FR.find(([c]) => c === field)?.[1]} = ${shown || "(vide)"}` }],
          args: { kind: "project", id: hit.id, field, value: shown },
          successMessage: `Cellule mise à jour sur « ${hit.name} ».`,
          revalidate: ["/business-development"],
        };
      }
      const hit = await resolveBdProduct(opStr(input, "product") || opStr(input, "name"), opStr(input, "target"));
      if ("error" in hit) return hit;
      const field = matchLabel(fieldRaw, BD_CELL_PRODUCT_FR);
      if (typeof field === "object") return field;
      const shown = field === "sourcing" ? (() => { const s = matchLabel(value, SOURCING_FR); return typeof s === "string" ? s : value; })() : value;
      return {
        title: `${hit.dci} : ${BD_CELL_PRODUCT_FR.find(([c]) => c === field)?.[1]} → ${shown || "(vide)"}`,
        fields: [{ label: "Produit", value: `${hit.dci} (${hit.projectName})` }, { label: "Cellule", value: `${BD_CELL_PRODUCT_FR.find(([c]) => c === field)?.[1]} = ${shown || "(vide)"}` }],
        args: { kind: "product", id: hit.id, field, value: shown },
        successMessage: `Cellule mise à jour sur « ${hit.dci} ».`,
        revalidate: ["/business-development"],
      };
    },
    execute: (args) => runFd(updateBdCell, args, "L'édition de la cellule a été refusée.", { revalidate: ["/business-development"] }),
  },

  comment_bd_project: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveBdProject(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const body = opStr(input, "message") || opStr(input, "note");
      if (!body) return { error: "Écrivez le commentaire (champ « message »)." };
      return {
        title: `Commenter le projet BD « ${hit.name} »`,
        fields: [{ label: "Projet", value: hit.name }, { label: "Commentaire", value: body }],
        args: { projectId: hit.id, body },
        successMessage: `Commentaire posé sur « ${hit.name} ».`,
        revalidate: ["/business-development"],
      };
    },
    execute: (args) => runFd(addBdProjectComment, args, "Le commentaire a été refusé.", { revalidate: ["/business-development"] }),
  },
};

// ─────────────────────────── PROJETS DE SUIVI (dossiers) ───────────────────────────

const DOSSIER_STATUS_FR: [string, string][] = [
  ["OPEN", "Ouvert"], ["IN_PROGRESS", "En cours"], ["ON_HOLD", "En attente"], ["DONE", "Terminé"], ["ARCHIVED", "Archivé"],
];

interface DossierHit { id: string; reference: string; title: string }

async function resolveDossier(raw: string): Promise<DossierHit | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez le projet (champ « target » — référence ou intitulé)." };
  const exact = await prisma.dossier.findFirst({
    where: { reference: { equals: q, mode: "insensitive" } },
    select: { id: true, reference: true, title: true },
  });
  if (exact) return exact;
  const rows = await prisma.dossier.findMany({
    where: { OR: [{ title: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] },
    select: { id: true, reference: true, title: true },
    orderBy: { updatedAt: "desc" }, take: 6,
  });
  if (rows.length === 1) return rows[0];
  if (rows.length === 0) return { error: `Aucun projet « ${q} ».` };
  return { error: `Plusieurs projets correspondent : ${rows.map((d) => `${d.reference} — ${d.title}`).join(" ; ")} — donner la référence.` };
}

async function resolveDossierMessage(dossier: DossierHit, excerptRaw: string): Promise<{ id: string; excerpt: string } | { error: string }> {
  const rows = await prisma.dossierMessage.findMany({
    where: { dossierId: dossier.id },
    select: { id: true, body: true, createdAt: true },
    orderBy: { createdAt: "desc" }, take: 10,
  });
  if (rows.length === 0) return { error: `${dossier.reference} n'a aucun message.` };
  const excerpt = (m: (typeof rows)[number]) => `« ${m.body.slice(0, 60)}${m.body.length > 60 ? "…" : ""} »`;
  const q = fold(excerptRaw);
  if (!q || /^dernier/.test(q)) {
    if (rows.length === 1 || /^dernier/.test(q)) return { id: rows[0].id, excerpt: excerpt(rows[0]) };
    return { error: `Précisez le message (champ « message » — un extrait, ou « dernier ») parmi : ${rows.slice(0, 5).map(excerpt).join(" ; ")}.` };
  }
  const hits = rows.filter((m) => fold(m.body).includes(q));
  if (hits.length === 1) return { id: hits[0].id, excerpt: excerpt(hits[0]) };
  if (hits.length === 0) return { error: `Aucun message contenant « ${excerptRaw} » — messages : ${rows.slice(0, 5).map(excerpt).join(" ; ")}.` };
  return { error: `Plusieurs messages correspondent : ${hits.map(excerpt).join(" ; ")} — préciser l'extrait.` };
}

async function userByName(raw: string): Promise<{ id: string; name: string } | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez la personne (nom)." };
  const rows = await prisma.user.findMany({
    where: { name: { contains: q, mode: "insensitive" }, isActive: true },
    select: { id: true, name: true }, take: 6,
  });
  if (rows.length === 1) return rows[0];
  if (rows.length === 0) return { error: `Aucun utilisateur actif « ${q} ».` };
  return { error: `Plusieurs personnes correspondent : ${rows.map((u) => u.name).join(", ")} — préciser.` };
}

export const DOSSIER_OPS_IMPL: Record<string, OpImpl> = {
  set_dossier_status: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const d = await resolveDossier(opStr(input, "target"));
      if ("error" in d) return d;
      const m = matchLabel(opStr(input, "status"), DOSSIER_STATUS_FR);
      if (typeof m === "object") return m;
      return {
        title: `${d.reference} — ${d.title} → ${DOSSIER_STATUS_FR.find(([c]) => c === m)?.[1]}`,
        fields: [{ label: "Projet", value: `${d.reference} — ${d.title}` }, { label: "Statut", value: DOSSIER_STATUS_FR.find(([c]) => c === m)?.[1] ?? m }],
        warnings: ["Geste du créateur, du responsable ou de la Direction (revérifié par l'action)."],
        args: { id: d.id, status: m },
        successMessage: `${d.reference} : ${DOSSIER_STATUS_FR.find(([c]) => c === m)?.[1]}.`,
        revalidate: ["/dossiers", "/mon-travail"],
      };
    },
    execute: (args) => runFd(updateDossierStatus, args, "Le changement de statut a été refusé.", { revalidate: ["/dossiers"] }),
  },

  assign_dossier: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const d = await resolveDossier(opStr(input, "target"));
      if ("error" in d) return d;
      const current = await prisma.dossier.findUnique({
        where: { id: d.id }, select: { assignedToId: true, participantIds: true },
      });
      if (!current) return { error: "Projet introuvable." };
      // FUSION : l'action REMPLACE responsable ET participants — l'existant est relu :
      // responsable absent → conservé ; participants absents → rejoués ; « aucun » vide.
      let assigneeId = current.assignedToId;
      let assigneeShown = "(inchangé)";
      const personRaw = opStr(input, "person");
      if (/^aucun/i.test(personRaw)) { assigneeId = null; assigneeShown = "— (retiré)"; }
      else if (personRaw) {
        const u = await userByName(personRaw);
        if ("error" in u) return u;
        assigneeId = u.id; assigneeShown = u.name;
      }
      let partIds = current.participantIds;
      let partsShown = `${current.participantIds.length} rejoué(s)`;
      const peopleRaw = opStr(input, "people");
      if (/^aucun/i.test(peopleRaw)) { partIds = []; partsShown = "— (liste vidée)"; }
      else if (peopleRaw) {
        const names = peopleRaw.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
        const ids: string[] = []; const shown: string[] = [];
        for (const n of names) {
          const u = await userByName(n);
          if ("error" in u) return u;
          if (!ids.includes(u.id)) { ids.push(u.id); shown.push(u.name); }
        }
        partIds = ids; partsShown = shown.join(", ") + " (liste REMPLACÉE)";
      }
      const fd: Record<string, string | null> = { id: d.id, assignedToId: assigneeId, participantIds: partIds.join(",") };
      return {
        title: `Équipe du projet ${d.reference}`,
        fields: [
          { label: "Projet", value: `${d.reference} — ${d.title}` },
          { label: "Responsable", value: assigneeShown },
          { label: "Participants", value: partsShown },
        ],
        warnings: ["Les NOUVEAUX membres sont notifiés — les personnes retirées ne le sont pas."],
        args: fd,
        successMessage: `Équipe de ${d.reference} mise à jour.`,
        revalidate: ["/dossiers", "/mon-travail"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      if (args.assignedToId) fd.set("assignedToId", args.assignedToId);
      for (const pid of (args.participantIds ?? "").split(",").filter(Boolean)) fd.append("participantIds", pid);
      const r = await assignDossier(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "La mise à jour de l'équipe a été refusée." };
      return { ok: true, revalidate: ["/dossiers"] };
    },
  },

  post_dossier_message: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const d = await resolveDossier(opStr(input, "target"));
      if ("error" in d) return d;
      const body = opStr(input, "message") || opStr(input, "note");
      if (!body) return { error: "Écrivez le message (champ « message »)." };
      const mentionsRaw = opStr(input, "people");
      const mentionIds: string[] = []; const mentioned: string[] = [];
      if (mentionsRaw && !/^aucun/i.test(mentionsRaw)) {
        for (const n of mentionsRaw.split(/[;,]/).map((s) => s.trim()).filter(Boolean)) {
          const u = await userByName(n);
          if ("error" in u) return u;
          if (!mentionIds.includes(u.id)) { mentionIds.push(u.id); mentioned.push(u.name); }
        }
      }
      return {
        title: `Message sur ${d.reference}`,
        fields: fieldsOf([
          ["Projet", `${d.reference} — ${d.title}`],
          ["Message", body],
          ["Mentions", mentioned.length ? mentioned.join(", ") : null],
        ]),
        warnings: mentionIds.length ? ["Une mention ne touche que les MEMBRES du projet — un non-membre mentionné est ignoré par l'action."] : [],
        args: { id: d.id, body, mentionIds: mentionIds.join(",") },
        successMessage: `Message posé sur ${d.reference}.`,
        revalidate: ["/dossiers"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      fd.set("body", args.body ?? "");
      for (const mid of (args.mentionIds ?? "").split(",").filter(Boolean)) fd.append("mentionIds", mid);
      const r = await postDossierMessage(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le message a été refusé." };
      return { ok: true, revalidate: ["/dossiers"] };
    },
  },

  link_email_to_dossier: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const targetRaw = opStr(input, "target");
      const newTitle = opStr(input, "name");
      const subject = opStr(input, "label");
      if (!subject) return { error: "Précisez l'objet de l'e-mail (champ « label »)." };
      let dossierShown = "";
      let dossierId: string | null = null;
      if (targetRaw) {
        const d = await resolveDossier(targetRaw);
        if ("error" in d) return d;
        dossierId = d.id; dossierShown = `${d.reference} — ${d.title}`;
      } else if (newTitle) {
        dossierShown = `« ${newTitle} » (créé à la volée)`;
      } else {
        return { error: "Donnez le projet cible (champ « target ») OU l'intitulé du projet à créer (champ « name »)." };
      }
      return {
        title: `Lier l'e-mail « ${subject} » à ${dossierShown}`,
        fields: fieldsOf([
          ["Projet", dossierShown],
          ["Objet", subject],
          ["Expéditeur", opStr(input, "person") || null],
          ["Reçu le", isoDate(opStr(input, "date"))],
        ]),
        args: {
          dossierId, newTitle: dossierId ? null : newTitle, subject,
          from: opStr(input, "person") || null, date: isoDate(opStr(input, "date")), body: opStr(input, "message") || null,
        },
        successMessage: `E-mail « ${subject} » journalisé dans ${dossierShown}.`,
        revalidate: ["/dossiers"],
      };
    },
    async execute(args) {
      const r = await linkEmailToDossier({
        dossierId: args.dossierId, newTitle: args.newTitle, subject: args.subject,
        from: args.from, date: args.date, body: args.body,
      });
      if (!r.ok) return { ok: false, error: r.error ?? "Le rattachement de l'e-mail a été refusé." };
      return { ok: true, revalidate: ["/dossiers"] };
    },
  },

  create_dossier_from_task: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const q = (opStr(input, "label") || opStr(input, "target")).trim();
      if (!q) return { error: "Précisez la tâche d'origine (champ « label » — son titre)." };
      const rows = await prisma.task.findMany({
        where: { title: { contains: q, mode: "insensitive" } },
        select: { id: true, title: true, status: true },
        orderBy: { createdAt: "desc" }, take: 6,
      });
      if (rows.length === 0) return { error: `Aucune tâche « ${q} ».` };
      if (rows.length > 1) return { error: `Plusieurs tâches correspondent : ${rows.map((t) => t.title).join(" ; ")} — préciser.` };
      return {
        title: `Ouvrir un projet de suivi depuis la tâche « ${rows[0].title} »`,
        fields: [{ label: "Tâche", value: rows[0].title }],
        warnings: ["Le projet reprend titre, description, responsable, priorité et échéance de la tâche."],
        args: { taskId: rows[0].id },
        successMessage: `Projet ouvert depuis « ${rows[0].title} ».`,
        revalidate: ["/dossiers"],
      };
    },
    async execute(args) {
      const r = await createDossierFromTask(args.taskId ?? "");
      if (!r.ok) return { ok: false, error: r.error ?? "L'ouverture du projet a été refusée." };
      return { ok: true, revalidate: ["/dossiers"] };
    },
  },

  archive_dossier: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const d = await resolveDossier(opStr(input, "target"));
      if ("error" in d) return d;
      return {
        title: `ARCHIVER le projet ${d.reference} — ${d.title}`,
        fields: [{ label: "Projet", value: `${d.reference} — ${d.title}` }],
        warnings: ["Le projet sort des listes actives (statut Archivé) — il reste consultable, rien n'est supprimé."],
        args: { id: d.id },
        successMessage: `${d.reference} archivé.`,
        revalidate: ["/dossiers", "/mon-travail"],
      };
    },
    execute: (args) => runFd(archiveDossier, args, "L'archivage a été refusé.", { revalidate: ["/dossiers"] }),
  },

  delete_dossier_message: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const d = await resolveDossier(opStr(input, "target"));
      if ("error" in d) return d;
      const msg = await resolveDossierMessage(d, opStr(input, "message") || opStr(input, "label"));
      if ("error" in msg) return msg;
      return {
        title: `Supprimer un message du fil de ${d.reference}`,
        fields: [{ label: "Projet", value: `${d.reference} — ${d.title}` }, { label: "Message", value: msg.excerpt }],
        warnings: ["Suppression définitive du message ET de ses pièces jointes — réservé à l'auteur, au responsable ou à la Direction."],
        args: { id: msg.id },
        successMessage: `Message supprimé du fil de ${d.reference}.`,
        revalidate: ["/dossiers"],
      };
    },
    execute: (args) => runFd(deleteDossierMessage, args, "La suppression du message a été refusée.", { revalidate: ["/dossiers"] }),
  },

  edit_dossier_message: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const d = await resolveDossier(opStr(input, "target"));
      if ("error" in d) return d;
      const msg = await resolveDossierMessage(d, opStr(input, "message") || opStr(input, "label"));
      if ("error" in msg) return msg;
      const body = opStr(input, "note") || opStr(input, "newName");
      if (!body) return { error: "Donnez le NOUVEAU texte du message (champ « note »)." };
      return {
        title: `Modifier un message du fil de ${d.reference}`,
        fields: [
          { label: "Message actuel", value: msg.excerpt },
          { label: "Nouveau texte", value: body },
        ],
        warnings: ["Réservé à l'auteur, au responsable ou à la Direction (revérifié par l'action)."],
        args: { id: msg.id, body },
        successMessage: `Message modifié sur ${d.reference}.`,
        revalidate: ["/dossiers"],
      };
    },
    execute: (args) => runFd(editDossierMessage, args, "La modification du message a été refusée.", { revalidate: ["/dossiers"] }),
  },
};

// ─────────────────────────── DIRECTIVES ───────────────────────────

const DIRECTIVE_STATUS_FR: [string, string][] = [
  ["OPEN", "Ouverte"], ["ACKNOWLEDGED", "Prise en compte"], ["IN_PROGRESS", "En cours"],
  ["DONE", "Terminée"], ["ARCHIVED", "Archivée"],
];
const ROLE_PAIRS: [string, string][] = Object.entries(ROLE_LABELS as Record<string, string>);

interface DirectiveHit { id: string; reference: string; title: string }

async function resolveDirective(raw: string): Promise<DirectiveHit | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez la directive (champ « target » — référence DIR-… ou titre)." };
  const exact = await prisma.directive.findFirst({
    where: { reference: { equals: q, mode: "insensitive" } },
    select: { id: true, reference: true, title: true },
  });
  if (exact) return exact;
  const rows = await prisma.directive.findMany({
    where: { OR: [{ title: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] },
    select: { id: true, reference: true, title: true },
    orderBy: { createdAt: "desc" }, take: 6,
  });
  if (rows.length === 1) return rows[0];
  if (rows.length === 0) return { error: `Aucune directive « ${q} ».` };
  return { error: `Plusieurs directives correspondent : ${rows.map((d) => `${d.reference} — ${d.title}`).join(" ; ")} — donner la référence.` };
}

export const DIRECTIVE_OPS_IMPL: Record<string, OpImpl> = {
  create_directive: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const title = opStr(input, "label") || opStr(input, "name");
      const body = opStr(input, "message") || opStr(input, "note");
      if (!title || !body) return { error: "Titre (champ « label ») et contenu (champ « message ») sont obligatoires." };
      const personRaw = opStr(input, "person");
      const roleRaw = opStr(input, "role");
      let targetUserId: string | null = null; let targetShown = "";
      let targetRole: string | null = null;
      if (personRaw) {
        const u = await userByName(personRaw);
        if ("error" in u) return u;
        targetUserId = u.id; targetShown = u.name;
      } else if (roleRaw) {
        const m = matchLabel(roleRaw, ROLE_PAIRS);
        if (typeof m === "object") return m;
        targetRole = m; targetShown = `rôle « ${ROLE_PAIRS.find(([c]) => c === m)?.[1] ?? m} »`;
      } else {
        return { error: "Choisissez le destinataire : une personne (champ « person ») ou un rôle (champ « role »)." };
      }
      const priorityRaw = opStr(input, "priority") || opStr(input, "mode");
      const priority = priorityRaw ? matchLabel(priorityRaw, PRIORITY_FR) : null;
      if (priority && typeof priority === "object") return priority;
      return {
        title: `Émettre la directive « ${title} » → ${targetShown}`,
        fields: fieldsOf([
          ["Titre", title],
          ["Destinataire", targetShown],
          ["Priorité", priority ? PRIORITY_FR.find(([c]) => c === priority)?.[1] ?? null : null],
          ["Échéance", isoDate(opStr(input, "date"))],
          ["Contenu", body],
        ]),
        warnings: ["Émission réservée à la Direction. La note part SEULEMENT après validation du Directeur Général (ou du Super Admin) — sauf s'il en est l'auteur, auquel cas elle part aussitôt."],
        args: {
          title, body, targetUserId, targetRole, priority: priority || null,
          dueDate: isoDate(opStr(input, "date")),
        },
        successMessage: `Directive « ${title} » soumise (${targetShown}) — elle partira à la validation de la direction générale.`,
        revalidate: ["/directives", "/mon-travail"],
      };
    },
    execute: (args) => runFd2(createDirective, args, "L'émission de la directive a été refusée.", { revalidate: ["/directives"] }),
  },

  set_directive_status: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const d = await resolveDirective(opStr(input, "target"));
      if ("error" in d) return d;
      const m = matchLabel(opStr(input, "status"), DIRECTIVE_STATUS_FR);
      if (typeof m === "object") return m;
      return {
        title: `${d.reference} — ${d.title} → ${DIRECTIVE_STATUS_FR.find(([c]) => c === m)?.[1]}`,
        fields: [{ label: "Directive", value: `${d.reference} — ${d.title}` }, { label: "Statut", value: DIRECTIVE_STATUS_FR.find(([c]) => c === m)?.[1] ?? m }],
        warnings: m === "ARCHIVED"
          ? ["L'ARCHIVAGE est réservé à la Direction — l'émetteur est informé de chaque avancement."]
          : ["Geste du destinataire, de l'émetteur ou de la Direction — « prise en compte » horodate l'accusé."],
        args: { id: d.id, status: m },
        successMessage: `${d.reference} : ${DIRECTIVE_STATUS_FR.find(([c]) => c === m)?.[1]}.`,
        revalidate: ["/directives", "/mon-travail"],
      };
    },
    execute: (args) => runFd(updateDirectiveStatus, args, "Le changement de statut a été refusé.", { revalidate: ["/directives"] }),
  },

  post_directive_message: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const d = await resolveDirective(opStr(input, "target"));
      if ("error" in d) return d;
      const body = opStr(input, "message") || opStr(input, "note");
      if (!body) return { error: "Écrivez le message (champ « message »)." };
      return {
        title: `Message sur la directive ${d.reference}`,
        fields: [{ label: "Directive", value: `${d.reference} — ${d.title}` }, { label: "Message", value: body }],
        warnings: ["Fil émetteur ↔ destinataire : l'autre partie est notifiée."],
        args: { id: d.id, body },
        successMessage: `Message posé sur ${d.reference}.`,
        revalidate: ["/directives"],
      };
    },
    execute: (args) => runFd(postDirectiveMessage, args, "Le message a été refusé.", { revalidate: ["/directives"] }),
  },
};

// ─────────────────────────── SUPPORT ───────────────────────────

const SUPPORT_STATUS_FR: [string, string][] = [
  ["OPEN", "Ouverte"], ["IN_PROGRESS", "En cours"], ["ANSWERED", "Répondue"], ["CLOSED", "Clôturée"],
];
const SUPPORT_CATEGORY_FR: [string, string][] = [
  ["QUESTION", "Question"], ["SUPPORT_MATERIAL", "Support promotionnel"], ["BROCHURE", "Brochure"],
  ["DOCUMENT", "Document"], ["OTHER", "Autre"],
];

interface SupportHit { id: string; reference: string; subject: string }

async function resolveSupport(raw: string): Promise<SupportHit | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez la demande de support (champ « target » — référence SUP-… ou objet)." };
  const exact = await prisma.supportRequest.findFirst({
    where: { reference: { equals: q, mode: "insensitive" } },
    select: { id: true, reference: true, subject: true },
  });
  if (exact) return exact;
  const rows = await prisma.supportRequest.findMany({
    where: { OR: [{ subject: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] },
    select: { id: true, reference: true, subject: true },
    orderBy: { createdAt: "desc" }, take: 6,
  });
  if (rows.length === 1) return rows[0];
  if (rows.length === 0) return { error: `Aucune demande de support « ${q} ».` };
  return { error: `Plusieurs demandes correspondent : ${rows.map((r) => `${r.reference} — ${r.subject}`).join(" ; ")} — donner la référence.` };
}

export const SUPPORT_OPS_IMPL: Record<string, OpImpl> = {
  create_support_request: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const subject = opStr(input, "label") || opStr(input, "name");
      const body = opStr(input, "message") || opStr(input, "note");
      if (!subject || !body) return { error: "Objet (champ « label ») et message (champ « message ») sont obligatoires." };
      const personRaw = opStr(input, "person");
      const roleRaw = opStr(input, "role");
      let targetUserId: string | null = null; let targetShown = "";
      let targetRole: string | null = null;
      if (personRaw) {
        const u = await userByName(personRaw);
        if ("error" in u) return u;
        targetUserId = u.id; targetShown = u.name;
      } else if (roleRaw) {
        const m = matchLabel(roleRaw, ROLE_PAIRS);
        if (typeof m === "object") return m;
        targetRole = m; targetShown = `rôle « ${ROLE_PAIRS.find(([c]) => c === m)?.[1] ?? m} »`;
      } else {
        return { error: "Choisissez le destinataire : une personne (champ « person ») ou un rôle (champ « role »)." };
      }
      const catRaw = opStr(input, "kind");
      const category = catRaw ? matchLabel(catRaw, SUPPORT_CATEGORY_FR) : null;
      if (category && typeof category === "object") return category;
      return {
        title: `Demande de support « ${subject} » → ${targetShown}`,
        fields: fieldsOf([
          ["Objet", subject],
          ["Destinataire", targetShown],
          ["Catégorie", category ? SUPPORT_CATEGORY_FR.find(([c]) => c === category)?.[1] ?? null : "Question (défaut)"],
          ["Produit", opStr(input, "product") || null],
          ["Message", body],
        ]),
        args: {
          subject, body, targetUserId, targetRole,
          category: category || null, product: opStr(input, "product") || null,
        },
        successMessage: `Demande de support « ${subject} » envoyée (${targetShown}).`,
        revalidate: ["/support", "/mon-travail"],
      };
    },
    execute: (args) => runFd2(createSupportRequest, args, "La demande de support a été refusée.", { revalidate: ["/support"] }),
  },

  take_support_request: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const r = await resolveSupport(opStr(input, "target"));
      if ("error" in r) return r;
      return {
        title: `Prendre en charge ${r.reference} — ${r.subject}`,
        fields: [{ label: "Demande", value: `${r.reference} — ${r.subject}` }],
        warnings: ["Réservé au DESTINATAIRE (personne ciblée, rôle ciblé ou assigné) — le demandeur est prévenu."],
        args: { id: r.id },
        successMessage: `${r.reference} pris en charge.`,
        revalidate: ["/support"],
      };
    },
    execute: (args) => runFd(takeSupportRequest, args, "La prise en charge a été refusée.", { revalidate: ["/support"] }),
  },

  answer_support_request: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const r = await resolveSupport(opStr(input, "target"));
      if ("error" in r) return r;
      const body = opStr(input, "message") || opStr(input, "note");
      if (!body) return { error: "Écrivez la réponse (champ « message »)." };
      return {
        title: `Répondre à ${r.reference} — ${r.subject}`,
        fields: [{ label: "Demande", value: `${r.reference} — ${r.subject}` }, { label: "Réponse", value: body }],
        warnings: ["La réponse d'un DESTINATAIRE passe la demande « Répondue » (et la lui assigne) ; le demandeur, lui, relance simplement le fil."],
        args: { id: r.id, body },
        successMessage: `Réponse posée sur ${r.reference}.`,
        revalidate: ["/support"],
      };
    },
    execute: (args) => runFd(answerSupportRequest, args, "La réponse a été refusée.", { revalidate: ["/support"] }),
  },

  set_support_status: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const r = await resolveSupport(opStr(input, "target"));
      if ("error" in r) return r;
      const m = matchLabel(opStr(input, "status"), SUPPORT_STATUS_FR);
      if (typeof m === "object") return m;
      return {
        title: `${r.reference} — ${r.subject} → ${SUPPORT_STATUS_FR.find(([c]) => c === m)?.[1]}`,
        fields: [{ label: "Demande", value: `${r.reference} — ${r.subject}` }, { label: "Statut", value: SUPPORT_STATUS_FR.find(([c]) => c === m)?.[1] ?? m }],
        warnings: [m === "CLOSED"
          ? "La clôture est ouverte au demandeur ET au répondant."
          : "Les autres statuts sont réservés au répondant (revérifié par l'action)."],
        args: { id: r.id, status: m },
        successMessage: `${r.reference} : ${SUPPORT_STATUS_FR.find(([c]) => c === m)?.[1]}.`,
        revalidate: ["/support"],
      };
    },
    execute: (args) => runFd(updateSupportStatus, args, "Le changement de statut a été refusé.", { revalidate: ["/support"] }),
  },
};

// ─────────────────────────── RAPPELS PERSONNELS ───────────────────────────

async function resolveReminder(userId: string, raw: string): Promise<{ id: string; title: string } | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez le rappel (champ « label » — son objet)." };
  const rows = await prisma.reminder.findMany({
    where: { userId, title: { contains: q, mode: "insensitive" } },
    select: { id: true, title: true, status: true, remindAt: true },
    orderBy: { remindAt: "desc" }, take: 6,
  });
  const pending = rows.filter((r) => r.status === "PENDING");
  const pick = pending.length === 1 ? pending[0] : rows.length === 1 ? rows[0] : null;
  if (pick) return { id: pick.id, title: pick.title };
  if (rows.length === 0) return { error: `Aucun rappel « ${q} » dans votre espace.` };
  return { error: `Plusieurs rappels correspondent : ${rows.map((r) => `${r.title} (${r.remindAt.toISOString().slice(0, 10)})`).join(" ; ")} — préciser.` };
}

export const REMINDER_OPS_IMPL: Record<string, OpImpl> = {
  create_reminder: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const title = opStr(input, "label") || opStr(input, "name") || opStr(input, "title");
      if (!title) return { error: "Donnez l'objet du rappel (champ « label »)." };
      const date = opStr(input, "date");
      if (!date) return { error: "Donnez la date du rappel (champ « date » — AAAA-MM-JJ, heure en option AAAA-MM-JJTHH:MM)." };
      return {
        title: `Rappel « ${title} »`,
        fields: fieldsOf([
          ["Objet", title],
          ["Quand", date],
          ["Note", opStr(input, "note") || null],
        ]),
        warnings: ["Rappel PERSONNEL : il n'appartient qu'à vous — à l'échéance, la plateforme vous notifie."],
        args: { title, remindAt: date, note: opStr(input, "note") || null },
        successMessage: `Rappel « ${title} » posé pour le ${date}.`,
        revalidate: ["/mon-espace"],
      };
    },
    execute: (args) => runFd(createReminder, args, "La création du rappel a été refusée (date passée ?).", { revalidate: ["/mon-espace"] }),
  },

  complete_reminder: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const r = await resolveReminder(user.id, opStr(input, "label") || opStr(input, "name"));
      if ("error" in r) return r;
      return {
        title: `Terminer le rappel « ${r.title} »`,
        fields: [{ label: "Rappel", value: r.title }],
        args: { id: r.id },
        successMessage: `Rappel « ${r.title} » terminé.`,
        revalidate: ["/mon-espace"],
      };
    },
    execute: (args) => runFd(completeReminder, args, "Le rappel n'a pas pu être terminé.", { revalidate: ["/mon-espace"] }),
  },

  cancel_reminder: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const r = await resolveReminder(user.id, opStr(input, "label") || opStr(input, "name"));
      if ("error" in r) return r;
      return {
        title: `Annuler le rappel « ${r.title} »`,
        fields: [{ label: "Rappel", value: r.title }],
        args: { id: r.id },
        successMessage: `Rappel « ${r.title} » annulé.`,
        revalidate: ["/mon-espace"],
      };
    },
    execute: (args) => runFd(cancelReminder, args, "Le rappel n'a pas pu être annulé.", { revalidate: ["/mon-espace"] }),
  },

  snooze_reminder: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const r = await resolveReminder(user.id, opStr(input, "label") || opStr(input, "name"));
      if ("error" in r) return r;
      const date = opStr(input, "date");
      return {
        title: `Reporter le rappel « ${r.title} »`,
        fields: [
          { label: "Rappel", value: r.title },
          { label: "Nouvelle échéance", value: date || "demain, même heure (défaut +1 jour)" },
        ],
        args: { id: r.id, remindAt: date || null },
        successMessage: `Rappel « ${r.title} » reporté${date ? ` au ${date}` : " à demain"}.`,
        revalidate: ["/mon-espace"],
      };
    },
    execute: (args) => runFd(snoozeReminder, args, "Le report a été refusé.", { revalidate: ["/mon-espace"] }),
  },
};
