import { TYPES_LUNA, estTypeLuna } from "./relations";

/**
 * CE QUE LUNA LIT DANS LES RAPPORTS — la consigne, le schéma JSON strict, et la RELECTURE de sa réponse.
 *
 * Luna repère les mentions d'influence ENTRE MÉDECINS (« suit l'avis du Pr X », « élève de », « co-orateur », « membre du
 * comité », « le chef de service décide »). Elle ne crée rien : chaque mention relue devient un lien PROPOSÉ, que le Super
 * Admin confirme ou rejette. La citation doit être un extrait MOT POUR MOT du rapport nommé — sinon la mention est jetée.
 *
 * Module PUR : l'appel au fournisseur vit dans `src/lib/influence-luna.ts`.
 */

export interface RapportAnalyse {
  /** Identifiant du rapport (FieldReport) ou « visite:<id> » pour le compte rendu écrit d'une visite. */
  id: string;
  texte: string;
  /** Le praticien visité (s'il est rattaché) — ce que « @visite » désigne. */
  doctorId: string | null;
  doctorNom: string | null;
  institutionId: string | null;
  institutionNom: string | null;
}

export interface MentionLue {
  rapportId: string;
  /** Nom tel qu'écrit, ou « @visite » / « @chef ». */
  influenceur: string;
  influence: string;
  type: (typeof TYPES_LUNA)[number];
  confiance: number;
  citation: string;
}

/** Le texte vaut-il un appel ? Un rapport qui ne nomme aucun confrère ne peut porter aucun lien. */
const INDICES = /\b(pr|dr|prof|professeur|docteur|chef|comit[ée]|[ée]l[èe]ve|orateur|co-?orateur|avis|influenc|ma[iî]tre|mentor|form[ée] par|d[ée]cide)/i;
export function rapportPorteur(texte: string): boolean {
  return INDICES.test(texte);
}

export const TEXTE_MAX = 1500;

export const CONSIGNE_INFLUENCE = [
  "Tu lis des comptes rendus de visite médicale (entreprise pharmaceutique, Algérie).",
  "Repère UNIQUEMENT les mentions d'influence ENTRE DEUX MÉDECINS nommés ou désignés :",
  "SUIT_AVIS (X suit l'avis / les recommandations de Y → influenceur Y, influencé X),",
  "ELEVE_DE (X est l'élève / a été formé par Y → influenceur Y), CO_ORATEUR (X et Y interviennent ensemble),",
  "COMITE (X et Y siègent au même comité / à la même commission), DECIDE (Y décide pour X, ex. « le chef de service décide »).",
  "Le médecin visité se note « @visite » ; le chef de service non nommé se note « @chef ».",
  "N'invente aucun nom. N'utilise que ce qui est écrit. Une mention vague ou sans second médecin est ignorée.",
  "Pour chaque mention, donne l'identifiant du compte rendu et une citation COPIÉE MOT POUR MOT (une phrase au plus,",
  "200 caractères au plus) qui la prouve, et ta confiance entre 0 et 1.",
  "Réponds en JSON selon le schéma. Aucun lien : {\"mentions\": []}.",
].join("\n");

export const SCHEMA_INFLUENCE = {
  name: "influence_mentions",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["mentions"],
    properties: {
      mentions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["rapportId", "influenceur", "influence", "type", "confiance", "citation"],
          properties: {
            rapportId: { type: "string" },
            influenceur: { type: "string" },
            influence: { type: "string" },
            type: { type: "string", enum: [...TYPES_LUNA] },
            confiance: { type: "number" },
            citation: { type: "string" },
          },
        },
      },
    },
  },
} as const;

const espaces = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * La citation est-elle un extrait du rapport ? Comparée espaces normalisés (un saut de ligne dicté n'est pas un mot) ;
 * renvoie l'extrait tel qu'il figure dans le rapport, ou null.
 */
export function citationVerifiee(citation: string, texte: string): string | null {
  const c = espaces(citation).replace(/^[«"“'\s]+|[»"”'\s]+$/g, "");
  if (c.length < 8 || c.length > 260) return null;
  return espaces(texte).includes(c) ? c : null;
}

/** Le texte tel qu'il part chez Luna (borné) — la citation se vérifie contre CE texte. */
export function texteEnvoye(r: RapportAnalyse): string {
  return r.texte.slice(0, TEXTE_MAX);
}

/**
 * LA RELECTURE STRICTE : forme attendue, rapport connu du lot, type connu, deux personnes différentes, confiance bornée,
 * citation vérifiée mot pour mot. Une réponse hors forme → null (rien n'est écrit) ; une mention fautive est jetée seule.
 */
export function lireReponseInfluence(data: unknown, lot: readonly RapportAnalyse[]): MentionLue[] | null {
  if (!data || typeof data !== "object" || !Array.isArray((data as { mentions?: unknown }).mentions)) return null;
  const parId = new Map(lot.map((r) => [r.id, r]));
  const out: MentionLue[] = [];
  const vus = new Set<string>();
  for (const m of (data as { mentions: unknown[] }).mentions) {
    if (!m || typeof m !== "object") continue;
    const x = m as Record<string, unknown>;
    const r = typeof x.rapportId === "string" ? parId.get(x.rapportId) : undefined;
    if (!r || !estTypeLuna(x.type)) continue;
    const de = typeof x.influenceur === "string" ? espaces(x.influenceur).slice(0, 120) : "";
    const vers = typeof x.influence === "string" ? espaces(x.influence).slice(0, 120) : "";
    if (!de || !vers || de.toLowerCase() === vers.toLowerCase()) continue;
    const citation = typeof x.citation === "string" ? citationVerifiee(x.citation, texteEnvoye(r)) : null;
    if (!citation) continue;
    const conf = typeof x.confiance === "number" && Number.isFinite(x.confiance) ? Math.max(0, Math.min(1, x.confiance)) : 0.5;
    const cle = `${r.id}|${de}|${vers}|${x.type}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({ rapportId: r.id, influenceur: de, influence: vers, type: x.type, confiance: conf, citation });
  }
  return out;
}

/** Le bloc d'un rapport tel que Luna le reçoit : identifiant, médecin visité, établissement (le texte est emballé à part). */
export function enteteRapport(r: RapportAnalyse): string {
  return `[${r.id}] médecin visité : ${r.doctorNom ?? "non rattaché"}${r.institutionNom ? ` — ${r.institutionNom}` : ""}`;
}
