import {
  ISSUES_CONDITION, OPERATEURS_CONDITION,
  type IssueCondition, type OperateurCondition, type StepCondition,
} from "@/lib/missions/planner/contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ÉTAPE CONDITIONNELLE — « si A n'arrive pas avant T, fais C » devient une propriété du plan.
 *
 * ── CE QUI MANQUAIT ──────────────────────────────────────────────────────────────────────
 *
 * Le runtime savait attendre « sa réponse OU vendredi » (`anyOf`), et le résultat de l'attente
 * disait comment elle s'était réglée (`reveillePar: "TEMPS"` ou le type du fait). Mais rien ne
 * permettait à la suite du plan d'en dépendre : l'étape « relancer » partait qu'il y ait eu
 * réponse ou non, et « remercier » aussi. Le planificateur écrivait alors un WORKER pour
 * « décider » — un appel de modèle pour lire un booléen.
 *
 * ── LA RÈGLE, PURE ───────────────────────────────────────────────────────────────────────
 *
 * Une condition observe UNE étape amont (dépendance implicite, posée par le compilateur) et
 * attend une ISSUE (EVENT, TIMEOUT, DONE, FAILED, SKIPPED) et/ou un TEST sur sa sortie
 * (path / op / value). Non remplie, l'étape est IGNORÉE (SKIPPED) : ses descendantes partent
 * (§37), et le contrôle qualité la retire du dénominateur — elle n'est ni un succès ni un manque.
 *
 * Aucune base ici, aucun modèle : l'horloge et l'état amont sont des paramètres. C'est ce qui
 * rend la règle testable au cas près — et c'est une règle qui, prise de travers, enverrait une
 * relance à quelqu'un qui vient de répondre.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface AmontObserve {
  status: string;
  result: unknown;
}

export interface VerdictCondition {
  remplie: boolean;
  /** En français, avec les valeurs — c'est ce que le journal (`STEP_SKIPPED`) montrera. */
  raison: string;
}

/** Lit un chemin pointé (« payload.montant », « items.0.statut ») sans jamais traverser un prototype. */
export function lireChemin(obj: unknown, path: string): unknown {
  let courant: unknown = obj;
  for (const segment of path.split(".").map((s) => s.trim()).filter(Boolean)) {
    if (courant === null || courant === undefined) return undefined;
    if (Array.isArray(courant)) {
      const i = Number(segment);
      if (!Number.isInteger(i) || i < 0) return undefined;
      courant = courant[i];
      continue;
    }
    if (typeof courant !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(courant, segment)) return undefined;
    courant = (courant as Record<string, unknown>)[segment];
  }
  return courant;
}

const estVide = (v: unknown): boolean =>
  v === undefined || v === null || v === ""
  || (Array.isArray(v) && v.length === 0)
  || (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);

const nombre = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const texte = (v: unknown): string =>
  typeof v === "string" ? v.trim().toLowerCase() : v === null || v === undefined ? "" : JSON.stringify(v).toLowerCase();

const montrer = (v: unknown): string => {
  if (v === undefined) return "absent";
  if (typeof v === "string") return `« ${v.length > 40 ? `${v.slice(0, 40)}…` : v} »`;
  const j = JSON.stringify(v);
  return j.length > 60 ? `${j.slice(0, 60)}…` : j;
};

/**
 * L'ISSUE d'une étape amont, lue sur son statut et son résultat.
 *
 * Une attente réglée par le TEMPS écrit `reveillePar: "TEMPS"` ; réglée par un FAIT, elle écrit
 * le type du fait ; une attente humaine fournie écrit `fourniPar`. Tout cela est DONE — l'issue
 * fine (EVENT / TIMEOUT) n'est qu'un raffinement de DONE, jamais une contradiction.
 */
export function issueDe(amont: AmontObserve): { issue: IssueCondition | "EN_COURS" | "ANNULEE"; detail: string } {
  const r = amont.result && typeof amont.result === "object" && !Array.isArray(amont.result)
    ? (amont.result as Record<string, unknown>) : null;
  if (amont.status === "DONE") {
    const par = r?.reveillePar;
    if (par === "TEMPS") return { issue: "TIMEOUT", detail: "réglée par le temps" };
    if (typeof par === "string" && par.trim() !== "") return { issue: "EVENT", detail: `réglée par un fait (${par})` };
    if (typeof r?.fourniPar === "string") return { issue: "EVENT", detail: "fournie par une personne" };
    return { issue: "DONE", detail: "aboutie" };
  }
  if (amont.status === "FAILED") return { issue: "FAILED", detail: "en échec" };
  if (amont.status === "SKIPPED") return { issue: "SKIPPED", detail: "ignorée" };
  if (amont.status === "CANCELLED") return { issue: "ANNULEE", detail: "annulée" };
  return { issue: "EN_COURS", detail: `encore ${amont.status}` };
}

/** L'issue observée répond-elle à l'issue attendue ? DONE couvre EVENT et TIMEOUT. */
function issueRepond(attendue: IssueCondition, observee: ReturnType<typeof issueDe>["issue"]): boolean {
  if (attendue === "DONE") return observee === "DONE" || observee === "EVENT" || observee === "TIMEOUT";
  return attendue === observee;
}

/** Le comparateur — partagé avec les règles de surveillance (`watch/rules.ts`) : une seule sémantique de « > », « contient », « vide ». */
export function comparerValeurs(op: OperateurCondition, gauche: unknown, droite: string | undefined): { ok: boolean; detail: string } {
  switch (op) {
    case "exists": return { ok: !estVide(gauche), detail: estVide(gauche) ? "absent ou vide" : "présent" };
    case "empty": return { ok: estVide(gauche), detail: estVide(gauche) ? "vide" : `non vide (${montrer(gauche)})` };
    case "contains": {
      const ok = texte(gauche).includes(texte(droite));
      return { ok, detail: `${montrer(gauche)} ${ok ? "contient" : "ne contient pas"} ${montrer(droite)}` };
    }
    case "eq":
    case "ne": {
      const g = nombre(gauche); const d = nombre(droite);
      const egal = g !== null && d !== null ? g === d : texte(gauche) === texte(droite);
      const ok = op === "eq" ? egal : !egal;
      return { ok, detail: `${montrer(gauche)} ${egal ? "=" : "≠"} ${montrer(droite)}` };
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const g = nombre(gauche); const d = nombre(droite);
      if (g === null || d === null) {
        return { ok: false, detail: `comparaison numérique impossible (${montrer(gauche)} vs ${montrer(droite)})` };
      }
      const ok = op === "gt" ? g > d : op === "gte" ? g >= d : op === "lt" ? g < d : g <= d;
      const signe = { gt: ">", gte: "≥", lt: "<", lte: "≤" }[op];
      return { ok, detail: `${g} ${ok ? "" : "n'est pas "}${signe} ${d}` };
    }
  }
}

/**
 * LA DÉCISION. `amont` absent (clé introuvable) rend « non remplie » avec la raison : une
 * condition qu'on ne sait pas évaluer n'autorise pas — c'est le même sens d'erreur que le reste
 * du runtime (une porte sans gestionnaire est fermée).
 */
export function evaluerCondition(cond: StepCondition, amont: AmontObserve | undefined): VerdictCondition {
  if (!amont) return { remplie: false, raison: `l'étape amont « ${cond.step} » est introuvable` };
  const parties: string[] = [];

  if (cond.outcome) {
    const obs = issueDe(amont);
    if (!issueRepond(cond.outcome, obs.issue)) {
      return { remplie: false, raison: `« ${cond.step} » est ${obs.detail} (${obs.issue}), attendu ${cond.outcome}` };
    }
    parties.push(`« ${cond.step} » ${obs.detail}`);
  }

  if (cond.op) {
    if (!cond.path) return { remplie: false, raison: `l'opérateur ${cond.op} n'a pas de champ à tester` };
    const valeur = lireChemin(amont.result, cond.path);
    const c = comparerValeurs(cond.op, valeur, cond.value);
    if (!c.ok) return { remplie: false, raison: `« ${cond.step}.${cond.path} » : ${c.detail}` };
    parties.push(`« ${cond.step}.${cond.path} » : ${c.detail}`);
  }

  if (parties.length === 0) return { remplie: false, raison: "condition vide : ni issue attendue, ni test de sortie" };
  return { remplie: true, raison: parties.join(" ; ") };
}

/** Relit une condition venue de la base — retypée, jamais crue sur parole ; `null` si elle n'en est pas une. */
export function lireCondition(v: unknown): StepCondition | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const s = (k: string): string | undefined =>
    typeof o[k] === "string" && (o[k] as string).trim() !== "" ? (o[k] as string).trim() : undefined;
  const step = s("step");
  if (!step) return null;
  const outcome = s("outcome");
  const op = s("op");
  const cond: StepCondition = { step };
  if (outcome && (ISSUES_CONDITION as readonly string[]).includes(outcome)) cond.outcome = outcome as IssueCondition;
  if (op && (OPERATEURS_CONDITION as readonly string[]).includes(op)) cond.op = op as OperateurCondition;
  const path = s("path"); if (path) cond.path = path;
  const value = typeof o.value === "string" ? o.value : typeof o.value === "number" ? String(o.value) : undefined;
  if (value !== undefined && value !== "") cond.value = value;
  return cond.outcome || cond.op ? cond : null;
}
