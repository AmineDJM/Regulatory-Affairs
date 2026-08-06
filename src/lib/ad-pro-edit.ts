/**
 * MODIFIER UNE DEMANDE AD & PRO APRÈS SA CRÉATION.
 *
 * Une demande se saisit vite et mal : une ville oubliée, un montant mal tapé, un intitulé
 * approximatif. Jusqu'ici la seule issue était de supprimer et recommencer — en perdant la
 * référence, les pièces jointes, les postes et l'avancement du circuit.
 *
 * Deux règles portent tout le reste :
 *
 *   1. **Ce qui a fondé une décision ne se réécrit pas.** Une fois la Direction ayant tranché,
 *      le demandeur ne modifie plus : changer « 200 000 DZD demandés » en « 400 000 » après un
 *      accord transformerait la décision en autre chose que ce qui a été décidé. Seule la
 *      Direction (vue globale) garde la main, pour corriger une coquille en connaissance de
 *      cause — et chaque modification est tracée.
 *
 *   2. **Les champs de décision ne sont JAMAIS modifiables ici.** Montant accordé, statut, chef
 *      de produit désigné, avis, motifs : ils appartiennent au circuit. Les exposer dans un
 *      formulaire de correction reviendrait à offrir un raccourci autour du workflow. C'est
 *      pourquoi ce module énumère les champs autorisés au lieu d'interdire les autres : une
 *      liste blanche ne se trompe pas quand un champ nouveau apparaît dans le modèle.
 */

export type AdProKind = "SPONSORING" | "CONGRESS_NATIONAL" | "CONGRESS_INTERNATIONAL";

/** Ce qu'on sait de la personne qui veut modifier. */
export interface AdProEditor {
  id: string;
  /** Vue globale : Direction, Directeur des opérations, Super Admin. */
  hasGlobalView: boolean;
  /** Droit UPDATE sur le module concerné. */
  canUpdate: boolean;
}

/** Ce qu'on sait de la demande. */
export interface AdProEditTarget {
  requesterId: string | null;
  /** La décision est-elle rendue (accordée, refusée, clôturée) ? */
  decided: boolean;
}

/**
 * Cette personne peut-elle modifier cette demande ?
 *
 * • **vue globale** → toujours (y compris après décision : c'est le seul niveau qui peut
 *   corriger un dossier tranché en assumant ce que ça veut dire) ;
 * • **demandeur** ou **droit UPDATE** → tant que la décision n'est pas rendue ;
 * • sinon → non.
 */
export function canEditAdProRequest(editor: AdProEditor, target: AdProEditTarget): boolean {
  if (editor.hasGlobalView) return true;
  if (target.decided) return false;
  if (target.requesterId && target.requesterId === editor.id) return true;
  return editor.canUpdate;
}

/**
 * Statuts terminaux par type de demande. « Terminal » = la Direction a tranché ; ce qui suit
 * (paiement, clôture) ne rouvre pas la saisie.
 */
const DECIDED_STATUS: Record<AdProKind, readonly string[]> = {
  SPONSORING: ["APPROVED", "REFUSED", "ACCEPTED", "PAID", "CLOSED"],
  CONGRESS_NATIONAL: ["APPROVED", "REFUSED", "COMPLETED"],
  CONGRESS_INTERNATIONAL: ["APPROVED", "REFUSED", "COMPLETED"],
};

export function isAdProDecided(kind: AdProKind, status: string): boolean {
  return DECIDED_STATUS[kind].includes(status);
}

/**
 * Champs modifiables, par type de demande — LISTE BLANCHE (cf. règle 2 ci-dessus).
 * `num` : champs numériques (montants) ; `date` : champs date ; le reste est du texte.
 */
export interface EditableField {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date";
}

export const EDITABLE_FIELDS: Record<AdProKind, readonly EditableField[]> = {
  SPONSORING: [
    { key: "institution", label: "Institution / service / association", type: "text" },
    { key: "type", label: "Type de sponsoring", type: "text" },
    { key: "doctor", label: "Médecin concerné", type: "text" },
    { key: "specialty", label: "Spécialité", type: "text" },
    { key: "city", label: "Ville", type: "text" },
    { key: "product", label: "Produit concerné", type: "text" },
    { key: "amountRequested", label: "Budget demandé (intéressé)", type: "number" },
    { key: "amountProposed", label: "Budget suggéré (délégué)", type: "number" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "comments", label: "Appréciation / recommandation", type: "textarea" },
  ],
  CONGRESS_NATIONAL: [
    { key: "name", label: "Événement", type: "text" },
    { key: "hostInstitution", label: "Établissement / association hôte", type: "text" },
    { key: "country", label: "Pays", type: "text" },
    { key: "city", label: "Ville", type: "text" },
    { key: "date", label: "Date", type: "date" },
    { key: "specialty", label: "Spécialité", type: "text" },
    { key: "promotedProducts", label: "Produits promus", type: "text" },
    { key: "estimatedBudget", label: "Budget estimé", type: "number" },
    { key: "presentDoctors", label: "Médecins présents", type: "textarea" },
    { key: "presentDelegates", label: "Délégués présents", type: "textarea" },
  ],
  CONGRESS_INTERNATIONAL: [
    { key: "name", label: "Événement", type: "text" },
    { key: "country", label: "Pays", type: "text" },
    { key: "city", label: "Ville", type: "text" },
    { key: "startDate", label: "Date de début", type: "date" },
    { key: "endDate", label: "Date de fin", type: "date" },
    { key: "specialty", label: "Spécialité", type: "text" },
    { key: "products", label: "Produits promus", type: "text" },
    { key: "estimatedBudget", label: "Budget estimé", type: "number" },
    { key: "invitedDoctors", label: "Médecins invités", type: "textarea" },
    { key: "participants", label: "Participants Adventum", type: "textarea" },
  ],
};

/** Le champ existe-t-il dans la liste blanche de ce type de demande ? */
export function editableField(kind: AdProKind, key: string): EditableField | null {
  return EDITABLE_FIELDS[kind].find((f) => f.key === key) ?? null;
}

/**
 * Résumé lisible d'une modification, pour le journal d'audit. On note ce qui CHANGE (avant →
 * après), pas l'état final : relire « ville : Alger » n'apprend rien, « ville : Oran → Alger »
 * dit exactement ce qui s'est passé.
 */
export function describeChanges(
  kind: AdProKind,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const out: string[] = [];
  for (const f of EDITABLE_FIELDS[kind]) {
    if (!(f.key in after)) continue;
    const a = normalize(before[f.key]);
    const b = normalize(after[f.key]);
    if (a === b) continue;
    out.push(`${f.label} : ${a || "—"} → ${b || "—"}`);
  }
  return out;
}

function normalize(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Les Decimal de Prisma s'affichent correctement via String() (ils portent un toString()).
  return String(v).trim();
}
