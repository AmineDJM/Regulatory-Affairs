import type { ChampEntree, ContratEntree } from "@/lib/missions/ports";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONTRAT D'ENTRÉE D'UNE CAPACITÉ — dérivé du schéma de l'outil, montré au planificateur,
 * vérifié à la compilation.
 *
 * ── LE DÉFAUT MESURÉ ─────────────────────────────────────────────────────────────────────
 *
 * Banc de missions inédites, neuf missions vagues, run m5. Sept des onze étapes d'écriture qui
 * ont échoué l'ont fait pour la MÊME raison : le planificateur écrivait des clés d'entrée que
 * l'outil ne lit pas.
 *
 *     send_message           { to, message }              lit { recipientName, body }
 *     plan_reminder          { message, schedule }        lit { title, quand | date }
 *     create_calendar_event  { schedule }                 lit { title, date }
 *     decide_payment         { action, paymentReference } lit { reference, decision }
 *     watch_entity           { entity, instructions }     lit { reference }
 *
 * Aucune de ces clés n'était absurde : ce sont celles qu'un humain aurait devinées. Mais on ne
 * DEVINE pas un contrat ; on le lit. Le planificateur ne voyait qu'un résumé d'une phrase, et le
 * compilateur — qui refuse une capacité inventée, un cycle, une cardinalité fausse — laissait
 * passer une entrée que l'outil refuserait à coup sûr. L'échec arrivait donc APRÈS l'accord du
 * dirigeant, à l'exécution, et coûtait une replanification complète.
 *
 * ── CE QUE CE MODULE TIENT ───────────────────────────────────────────────────────────────
 *
 *   1. `contratDepuisSchema`  — le contrat vient du `input_schema` de l'outil, la source que le
 *                               modèle voit déjà en conversation. Pas de second tableau à tenir.
 *   2. `decrireEntrees`       — une ligne compacte pour le planificateur : `reference* (texte),
 *                               decision* (APPROVE|REFUSE…)`. Les obligatoires d'abord.
 *   3. `verifierEntree`       — clés inconnues, obligatoires manquantes, valeurs hors contrat ;
 *                               et les FAUTES DE FORME réparées en code (« approve » → APPROVE,
 *                               « 50 » → 50), dites en warning, jamais renvoyées au modèle qui
 *                               vient de les commettre (compile.ts : mesuré, il récidive).
 *
 * Une référence `{{etape.chemin}}` n'est pas vérifiée ici : sa valeur n'existe qu'à l'exécution.
 * Elle compte comme présente, et le moteur la résout (runtime/interpolate.ts).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const TYPES_LISIBLES: Record<string, string> = {
  string: "texte", number: "nombre", integer: "entier", boolean: "booléen", array: "liste", object: "objet",
};

function typeLisible(t: unknown): string {
  if (typeof t === "string") return TYPES_LISIBLES[t] ?? t;
  if (Array.isArray(t)) {
    const parts = t.filter((x): x is string => typeof x === "string" && x !== "null").map((x) => TYPES_LISIBLES[x] ?? x);
    return parts.length > 0 ? parts.join("|") : "texte";
  }
  return "texte";
}

/** Le contrat d'une capacité à partir d'un JSON Schema d'objet. `null` s'il n'y a pas de schéma lisible. */
export function contratDepuisSchema(schema: unknown): ContratEntree | null {
  if (!schema || typeof schema !== "object") return null;
  const o = schema as Record<string, unknown>;
  const props = o.properties;
  if (!props || typeof props !== "object" || Array.isArray(props)) return null;
  const requis = new Set(
    Array.isArray(o.required) ? (o.required as unknown[]).filter((r): r is string => typeof r === "string") : [],
  );
  const champs: ChampEntree[] = [];
  for (const [nom, def] of Object.entries(props as Record<string, unknown>)) {
    const d = def && typeof def === "object" && !Array.isArray(def) ? (def as Record<string, unknown>) : {};
    const valeurs = Array.isArray(d.enum)
      ? (d.enum as unknown[]).filter((v): v is string => typeof v === "string")
      : [];
    const description = typeof d.description === "string" ? d.description.replace(/\s+/g, " ").trim() : "";
    champs.push({
      nom,
      type: typeLisible(d.type),
      requis: requis.has(nom),
      ...(valeurs.length > 0 ? { valeurs } : {}),
      ...(description ? { description } : {}),
    });
  }
  return { champs };
}

/** Une valeur qui contient une référence `{{…}}` : elle n'existe qu'à l'exécution. */
export const estGabarit = (v: unknown): boolean => typeof v === "string" && /\{\{[^}]+\}\}/.test(v);

const MAX_OPTIONNELLES = 6;
const MAX_VALEURS = 6;

function decrireChamp(c: ChampEntree): string {
  const forme = c.valeurs && c.valeurs.length > 0
    ? c.valeurs.slice(0, MAX_VALEURS).join("|") + (c.valeurs.length > MAX_VALEURS ? "|…" : "")
    : c.type;
  return `${c.nom}${c.requis ? "*" : ""} (${forme})`;
}

/**
 * LA LIGNE MONTRÉE AU PLANIFICATEUR. Obligatoires d'abord (marquées *), puis au plus six
 * optionnelles : au-delà, le nombre — une capacité à vingt options n'a pas besoin des vingt pour
 * être bien appelée, et chaque caractère du catalogue est payé à chaque planification.
 */
export function decrireEntrees(c: ContratEntree): string {
  if (c.champs.length === 0) return "entrées : aucune";
  const requis = c.champs.filter((x) => x.requis);
  const optionnels = c.champs.filter((x) => !x.requis);
  const montres = [...requis, ...optionnels.slice(0, MAX_OPTIONNELLES)].map(decrireChamp);
  const reste = optionnels.length - Math.min(optionnels.length, MAX_OPTIONNELLES);
  return `entrées : ${montres.join(", ")}${reste > 0 ? `, +${reste} optionnelle(s)` : ""}`;
}

export interface Reparation { champ: string; de: unknown; vers: unknown }
export interface VerdictEntree {
  /** Des clés que la capacité ne lit pas. */
  inconnues: string[];
  /** Des clés exigées, absentes ou vides. */
  manquantes: string[];
  /** Des valeurs littérales hors contrat (énumération, type) — non réparables sans deviner. */
  invalides: { champ: string; raison: string }[];
  /** Les fautes de FORME réparées en code — à appliquer et à dire. */
  reparations: Reparation[];
  /** L'entrée après réparations. */
  entree: Record<string, unknown>;
}

const estVide = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

const BOOLEENS: Record<string, boolean> = {
  true: true, vrai: true, oui: true, "1": true, false: false, faux: false, non: false, "0": false,
};

/**
 * VÉRIFIE UNE ENTRÉE CONTRE SON CONTRAT — et répare ce qui n'est qu'une faute de forme.
 *
 * Ce qui se répare : la casse d'une valeur énumérée (correspondance unique), un nombre écrit en
 * texte, un booléen écrit en mot, un texte donné comme nombre. Ce qui ne se répare PAS : une
 * valeur qui n'est dans aucune énumération, un texte là où une liste est attendue, une clé
 * inconnue (la remplacer par « la plus proche » serait exactement la devinette que ce module
 * existe pour supprimer).
 */
export function verifierEntree(input: Record<string, unknown>, contrat: ContratEntree): VerdictEntree {
  const parNom = new Map(contrat.champs.map((c) => [c.nom, c]));
  const entree: Record<string, unknown> = { ...input };
  const verdict: VerdictEntree = { inconnues: [], manquantes: [], invalides: [], reparations: [], entree };

  for (const cle of Object.keys(input)) {
    if (!parNom.has(cle)) verdict.inconnues.push(cle);
  }
  for (const c of contrat.champs) {
    const v = input[c.nom];
    if (c.requis && estVide(v)) {
      verdict.manquantes.push(c.nom);
      continue;
    }
    if (estVide(v) || estGabarit(v)) continue;

    if (c.valeurs && c.valeurs.length > 0) {
      if (typeof v !== "string") {
        verdict.invalides.push({ champ: c.nom, raison: `attendu l'une des valeurs ${c.valeurs.join("|")}` });
        continue;
      }
      if (c.valeurs.includes(v)) continue;
      const proches = c.valeurs.filter((x) => x.toLowerCase() === v.trim().toLowerCase());
      if (proches.length === 1) {
        entree[c.nom] = proches[0];
        verdict.reparations.push({ champ: c.nom, de: v, vers: proches[0] });
      } else {
        verdict.invalides.push({ champ: c.nom, raison: `« ${v} » n'est pas admis — attendu ${c.valeurs.join("|")}` });
      }
      continue;
    }

    const types = c.type.split("|");
    const accepte = (t: string): boolean => {
      if (t === "texte") return typeof v === "string";
      if (t === "nombre") return typeof v === "number" && Number.isFinite(v);
      if (t === "entier") return typeof v === "number" && Number.isInteger(v);
      if (t === "booléen") return typeof v === "boolean";
      if (t === "liste") return Array.isArray(v);
      if (t === "objet") return v !== null && typeof v === "object" && !Array.isArray(v);
      return true;
    };
    if (types.some(accepte)) continue;

    // ── LES RÉPARATIONS DE FORME ───────────────────────────────────────────────────────
    if (types.includes("nombre") || types.includes("entier")) {
      const n = typeof v === "string" ? Number(v.replace(/\s/g, "").replace(",", ".")) : NaN;
      if (Number.isFinite(n) && (!types.includes("entier") || types.includes("nombre") || Number.isInteger(n))) {
        entree[c.nom] = n;
        verdict.reparations.push({ champ: c.nom, de: v, vers: n });
        continue;
      }
    }
    if (types.includes("booléen") && typeof v === "string" && v.trim().toLowerCase() in BOOLEENS) {
      const b = BOOLEENS[v.trim().toLowerCase()];
      entree[c.nom] = b;
      verdict.reparations.push({ champ: c.nom, de: v, vers: b });
      continue;
    }
    if (types.includes("texte") && (typeof v === "number" || typeof v === "boolean")) {
      entree[c.nom] = String(v);
      verdict.reparations.push({ champ: c.nom, de: v, vers: String(v) });
      continue;
    }
    verdict.invalides.push({ champ: c.nom, raison: `attendu ${c.type}, reçu ${typeDe(v)}` });
  }
  return verdict;
}

function typeDe(v: unknown): string {
  if (Array.isArray(v)) return "liste";
  if (v === null) return "null";
  if (typeof v === "object") return "objet";
  if (typeof v === "string") return "texte";
  if (typeof v === "number") return "nombre";
  if (typeof v === "boolean") return "booléen";
  return typeof v;
}

/**
 * UNE ENTRÉE MINIMALE QUI HONORE LE CONTRAT — pour les bancs et les matrices, jamais pour agir.
 *
 * Chaque champ exigé reçoit une valeur de sa forme (la première valeur d'une énumération, 1,
 * `true`, une liste vide, « x »). C'est ce qui permet de compiler « une étape par capacité » sur
 * le vrai catalogue sans deviner des clés : la matrice permissions × capacités mesure alors
 * l'accord et la clé d'idempotence, pas la présence d'un paramètre.
 */
export function exempleEntree(contrat: ContratEntree | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of contrat?.champs ?? []) {
    if (!c.requis) continue;
    if (c.valeurs && c.valeurs.length > 0) { out[c.nom] = c.valeurs[0]; continue; }
    const t = c.type.split("|")[0];
    out[c.nom] = t === "nombre" || t === "entier" ? 1 : t === "booléen" ? true : t === "liste" ? [] : t === "objet" ? {} : "x";
  }
  return out;
}
