import { OPERATEURS_CONDITION, type OperateurCondition } from "@/lib/missions/planner/contract";
import { comparerValeurs, lireChemin } from "@/lib/missions/runtime/condition";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES RÈGLES D'UNE SURVEILLANCE — ce qui fait qu'un « problème » est une décision de CODE.
 *
 * « Surveille ce dossier et préviens-moi seulement s'il y a un problème » ne dit pas ce qu'est
 * un problème. Le dire à un modèle à chaque battement coûterait un appel par surveillance et par
 * heure, pour une réponse qui varierait. Ici, un problème est une RÈGLE : une échéance qui
 * approche ou qui est passée, un silence trop long, un statut bloqué ou entré dans une liste,
 * un statut qui change, une valeur qui franchit un seuil, une cible qui disparaît. Chaque règle
 * est pure : l'état observé, l'état précédent et l'horloge sont des paramètres.
 *
 * ── LA SIGNATURE, OU POURQUOI UN PROBLÈME N'EST DIT QU'UNE FOIS ─────────────────────────
 *
 * Un problème porte une CLÉ stable (le code + ce qui l'identifie : l'échéance, la date du
 * dernier changement, le statut) et un DÉTAIL humain (« échéance dans 3 jours »). La signature
 * d'un lot de problèmes se calcule sur les clés : « aucun changement depuis 15 jours » puis
 * « depuis 16 jours » est le MÊME problème — il n'est pas re-signalé chaque matin. C'est ce qui
 * rend « seulement s'il y a un problème » supportable dans la durée.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const CODES_REGLE = [
  "SANS_CHANGEMENT", "ECHEANCE_PROCHE", "ECHEANCE_DEPASSEE", "STATUT_PARMI", "STATUT_CHANGE",
  "BLOQUE", "DISPARU", "VALEUR",
] as const;
export type CodeRegle = (typeof CODES_REGLE)[number];

export interface RegleSurveillance {
  code: CodeRegle;
  /** SANS_CHANGEMENT / ECHEANCE_PROCHE : le nombre de jours. */
  jours?: number;
  /** STATUT_PARMI : les statuts qui déclenchent. */
  valeurs?: string[];
  /** VALEUR : le champ de l'état, l'opérateur et le seuil — même grammaire que l'étape conditionnelle. */
  champ?: string;
  op?: OperateurCondition;
  valeur?: string;
}

/** L'état d'une cible, NORMALISÉ par le lecteur (le pont) — les règles ne connaissent pas l'ERP. */
export interface EtatCible {
  existe: boolean;
  statut?: string | null;
  /** La cible est arrivée à son terme (tâche faite, dossier clos) : la surveillance s'arrête d'elle-même. */
  terminal?: boolean;
  bloque?: boolean;
  /** ISO 8601. */
  echeance?: string | null;
  /** ISO 8601 — le dernier fait ou la dernière mise à jour touchant la cible. */
  dernierChangement?: string | null;
  /** Les champs libres qu'une règle VALEUR peut tester. */
  champs?: Record<string, unknown>;
  /** Une ligne pour l'humain (« REG-2026-014 — AWAITING_ANPP, responsable Amel B. »). */
  resume?: string;
}

export type GraviteProbleme = "INFO" | "ATTENTION" | "ARBITRAGE";

export interface Probleme {
  code: CodeRegle;
  gravite: GraviteProbleme;
  /** Ce qui identifie le problème, stable d'un battement à l'autre. */
  cle: string;
  /** Ce qu'on dit à la personne. */
  detail: string;
}

const JOUR = 86_400_000;
const jours = (a: number, b: number): number => Math.floor((b - a) / JOUR);
const dateLisible = (iso: string): string => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}` : iso;
};
const instant = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

/** ÉVALUE les règles. Pur. Une cible disparue court-circuite : rien d'autre ne se mesure sur du vide. */
export function evaluerRegles(
  etat: EtatCible,
  regles: readonly RegleSurveillance[],
  precedent: EtatCible | null,
  maintenant: Date,
): Probleme[] {
  const out: Probleme[] = [];
  const now = maintenant.getTime();
  if (!etat.existe) {
    if (regles.some((r) => r.code === "DISPARU")) {
      out.push({ code: "DISPARU", gravite: "ATTENTION", cle: "disparu", detail: "la cible n'existe plus (supprimée ou déplacée ?)" });
    }
    return out;
  }
  for (const r of regles) {
    switch (r.code) {
      case "DISPARU":
        break;
      case "BLOQUE":
        if (etat.bloque) out.push({ code: r.code, gravite: "ATTENTION", cle: `bloque:${etat.statut ?? ""}`, detail: `bloqué${etat.statut ? ` (${etat.statut})` : ""}` });
        break;
      case "SANS_CHANGEMENT": {
        if (etat.terminal) break;
        const t = instant(etat.dernierChangement);
        const seuil = r.jours ?? 14;
        if (t !== null && jours(t, now) >= seuil) {
          out.push({ code: r.code, gravite: "ATTENTION", cle: `silence:${etat.dernierChangement}`, detail: `aucun changement depuis ${jours(t, now)} jour(s) (dernier : ${dateLisible(etat.dernierChangement!)})` });
        }
        break;
      }
      case "ECHEANCE_PROCHE": {
        if (etat.terminal) break;
        const t = instant(etat.echeance);
        const seuil = r.jours ?? 7;
        // « Dans 2 jours » se compte en jours entamés : une échéance dans 47 h est dans 2 jours.
        const restant = t !== null ? Math.ceil((t - now) / JOUR) : null;
        if (t !== null && restant !== null && t >= now && restant <= seuil) {
          out.push({ code: r.code, gravite: "ATTENTION", cle: `echeance-proche:${etat.echeance}`, detail: `échéance dans ${restant} jour(s) (${dateLisible(etat.echeance!)})` });
        }
        break;
      }
      case "ECHEANCE_DEPASSEE": {
        if (etat.terminal) break;
        const t = instant(etat.echeance);
        if (t !== null && t < now) {
          out.push({ code: r.code, gravite: "ATTENTION", cle: `echeance-depassee:${etat.echeance}`, detail: `échéance dépassée de ${Math.max(1, jours(t, now))} jour(s) (${dateLisible(etat.echeance!)})` });
        }
        break;
      }
      case "STATUT_PARMI":
        if (etat.statut && (r.valeurs ?? []).map((v) => v.toUpperCase()).includes(etat.statut.toUpperCase())) {
          out.push({ code: r.code, gravite: "ATTENTION", cle: `statut:${etat.statut}`, detail: `statut ${etat.statut}` });
        }
        break;
      case "STATUT_CHANGE":
        if (precedent?.statut && etat.statut && precedent.statut !== etat.statut) {
          out.push({ code: r.code, gravite: "INFO", cle: `changement:${precedent.statut}>${etat.statut}`, detail: `statut passé de ${precedent.statut} à ${etat.statut}` });
        }
        break;
      case "VALEUR": {
        if (!r.champ || !r.op) break;
        const v = lireChemin(etat.champs ?? {}, r.champ);
        const c = comparerValeurs(r.op, v, r.valeur);
        if (c.ok) out.push({ code: r.code, gravite: "ATTENTION", cle: `valeur:${r.champ}:${r.op}:${r.valeur ?? ""}:${JSON.stringify(v ?? null)}`, detail: `${r.champ} : ${c.detail}` });
        break;
      }
    }
  }
  return out;
}

/** La signature STABLE d'un lot de problèmes — vide quand il n'y en a aucun. */
export function signatureDe(problemes: readonly Probleme[]): string {
  if (problemes.length === 0) return "";
  const base = problemes.map((p) => `${p.code}:${p.cle}`).sort().join("|");
  let h = 5381;
  for (let i = 0; i < base.length; i++) h = ((h << 5) + h + base.charCodeAt(i)) | 0;
  return `${problemes.length}-${(h >>> 0).toString(16)}`;
}

/** La gravité la plus haute d'un lot. */
export function graviteDe(problemes: readonly Probleme[]): GraviteProbleme {
  const rang: Record<GraviteProbleme, number> = { INFO: 1, ATTENTION: 2, ARBITRAGE: 3 };
  return problemes.reduce<GraviteProbleme>((max, p) => (rang[p.gravite] > rang[max] ? p.gravite : max), "INFO");
}

/**
 * LES RÈGLES PAR DÉFAUT D'UN TYPE DE CIBLE — ce qu'un chef de cabinet surveillerait sans qu'on
 * le lui dise. La personne peut les restreindre ou les compléter à la création.
 */
export function reglesParDefaut(targetType: string): RegleSurveillance[] {
  switch (targetType) {
    case "REGULATORY_PRODUCT":
      return [{ code: "BLOQUE" }, { code: "STATUT_CHANGE" }, { code: "ECHEANCE_PROCHE", jours: 7 }, { code: "ECHEANCE_DEPASSEE" }, { code: "SANS_CHANGEMENT", jours: 14 }, { code: "DISPARU" }];
    case "REGULATORY_DOSSIER":
      return [{ code: "BLOQUE" }, { code: "STATUT_CHANGE" }, { code: "SANS_CHANGEMENT", jours: 14 }, { code: "DISPARU" }];
    case "TASK":
      return [{ code: "ECHEANCE_PROCHE", jours: 3 }, { code: "ECHEANCE_DEPASSEE" }, { code: "SANS_CHANGEMENT", jours: 7 }, { code: "DISPARU" }];
    // Un appel d'offres se surveille comme un dossier : le dépôt qui approche ou passe, une
    // suspension, un changement de statut (information), le silence, la disparition.
    case "PCH_TENDER":
      return [{ code: "BLOQUE" }, { code: "STATUT_CHANGE" }, { code: "ECHEANCE_PROCHE", jours: 7 }, { code: "ECHEANCE_DEPASSEE" }, { code: "SANS_CHANGEMENT", jours: 14 }, { code: "DISPARU" }];
    case "EXPENSE_ORDER":
    case "PAYMENT_REQUEST":
    case "VALIDATION_REQUEST":
      return [{ code: "STATUT_CHANGE" }, { code: "SANS_CHANGEMENT", jours: 7 }, { code: "DISPARU" }];
    // Un CONTRAT ou une FACTURE (Legal) : l'échéance qui approche ou passe, le changement de
    // statut (renouvelé, réglé — information), la disparition.
    case "LEGAL_DOCUMENT":
      return [{ code: "ECHEANCE_PROCHE", jours: 30 }, { code: "ECHEANCE_DEPASSEE" }, { code: "STATUT_CHANGE" }, { code: "DISPARU" }];
    // Une ENVELOPPE budgétaire : dépassée (bloqué → arbitrage), 80 % consommés (seuil), santé
    // qui change (information), fin de période proche, disparition.
    case "BUDGET_ENVELOPE":
      return [{ code: "BLOQUE" }, { code: "VALEUR", champ: "consommePct", op: "gte", valeur: "80" }, { code: "STATUT_CHANGE" }, { code: "ECHEANCE_PROCHE", jours: 15 }, { code: "DISPARU" }];
    // Une RÉPONSE E-MAIL attendue : la réponse arrive (information, et la surveillance se clôt
    // d'elle-même) ; sinon, cinq jours de silence valent relance.
    case "EMAIL_THREAD":
      return [{ code: "STATUT_CHANGE" }, { code: "SANS_CHANGEMENT", jours: 5 }, { code: "DISPARU" }];
    // Un DOCUMENT attendu au Drive : il arrive (information, clôture) ; sinon, sept jours d'absence.
    case "DRIVE_ATTENDU":
      return [{ code: "STATUT_CHANGE" }, { code: "SANS_CHANGEMENT", jours: 7 }, { code: "DISPARU" }];
    default:
      return [{ code: "SANS_CHANGEMENT", jours: 30 }, { code: "DISPARU" }];
  }
}

/** Relit des règles venues de la base ou d'un outil — retypées, jamais crues sur parole. */
export function lireRegles(v: unknown): RegleSurveillance[] {
  if (!Array.isArray(v)) return [];
  const out: RegleSurveillance[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const code = typeof o.code === "string" ? o.code.toUpperCase() : "";
    if (!(CODES_REGLE as readonly string[]).includes(code)) continue;
    const r: RegleSurveillance = { code: code as CodeRegle };
    if (typeof o.jours === "number" && o.jours > 0) r.jours = Math.round(o.jours);
    if (Array.isArray(o.valeurs)) r.valeurs = o.valeurs.filter((s): s is string => typeof s === "string" && s.trim() !== "");
    if (typeof o.champ === "string" && o.champ.trim()) r.champ = o.champ.trim();
    if (typeof o.op === "string" && (OPERATEURS_CONDITION as readonly string[]).includes(o.op)) r.op = o.op as OperateurCondition;
    if (typeof o.valeur === "string") r.valeur = o.valeur; else if (typeof o.valeur === "number") r.valeur = String(o.valeur);
    if (r.code === "VALEUR" && (!r.champ || !r.op)) continue;
    out.push(r);
  }
  return out;
}

/** Relit un état persisté (`lastState`). */
export function lireEtat(v: unknown): EtatCible | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.existe !== "boolean") return null;
  return {
    existe: o.existe,
    statut: typeof o.statut === "string" ? o.statut : null,
    terminal: o.terminal === true,
    bloque: o.bloque === true,
    echeance: typeof o.echeance === "string" ? o.echeance : null,
    dernierChangement: typeof o.dernierChangement === "string" ? o.dernierChangement : null,
    champs: o.champs && typeof o.champs === "object" && !Array.isArray(o.champs) ? (o.champs as Record<string, unknown>) : {},
    resume: typeof o.resume === "string" ? o.resume : undefined,
  };
}

/** Les règles, en français, pour la confirmation à la personne. */
export function decrireRegles(regles: readonly RegleSurveillance[]): string {
  const parts = regles.map((r) => {
    switch (r.code) {
      case "SANS_CHANGEMENT": return `silence de plus de ${r.jours ?? 14} jours`;
      case "ECHEANCE_PROCHE": return `échéance à moins de ${r.jours ?? 7} jours`;
      case "ECHEANCE_DEPASSEE": return "échéance dépassée";
      case "STATUT_PARMI": return `statut parmi ${(r.valeurs ?? []).join(", ")}`;
      case "STATUT_CHANGE": return "changement de statut (information)";
      case "BLOQUE": return "blocage";
      case "DISPARU": return "disparition de la cible";
      case "VALEUR": return `${r.champ} ${r.op} ${r.valeur ?? ""}`.trim();
    }
  });
  return parts.join(" ; ");
}
