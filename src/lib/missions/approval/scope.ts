import { createHash } from "node:crypto";
import type { CompiledMission, CompiledStep } from "@/lib/missions/compiler/compile";
import { EFFECT_RANK, type Effect } from "@/lib/missions/registry/capability-meta";
import { NiveauApprobation, niveauPour } from "@/lib/missions/policy/guard";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE CONFIRMATION POUR TOUTE UNE MISSION — mais pas un chèque en blanc (§32, §33).
 *
 * ── LE PROBLÈME QUE ÇA RÉSOUT ────────────────────────────────────────────────────────────
 *
 * « Ne me demande pas 99 confirmations. » Une mission de trente-trois envois qui demande
 * trente-trois accords n'est pas prudente : elle est inutilisable, et le PDG finit par cliquer
 * sans lire, ce qui est PIRE que pas de confirmation du tout.
 *
 * ── CE QUI EMPÊCHE QUE ÇA DEVIENNE UN CHÈQUE EN BLANC ────────────────────────────────────
 *
 * L'accord porte sur un PÉRIMÈTRE, résumé par une empreinte. Si le périmètre change
 * matériellement — un destinataire de plus, un montant différent, une action externe ajoutée —
 * l'empreinte ne correspond plus, et la partie modifiée redemande son accord.
 *
 * ── CE QUI EST « MATÉRIEL », ET POURQUOI CE CHOIX ────────────────────────────────────────
 *
 * Est matériel ce qui change la CONSÉQUENCE : la capacité appelée, son effet, à qui elle
 * s'adresse, les montants, et le nombre d'itérations d'un éventail. N'est PAS matériel ce qui
 * change la présentation : le titre de l'étape, l'ordre des clés d'un objet, un espace.
 *
 * Le raisonnement est simple : si le PDG relisait, ces choses-là ne changeraient pas sa
 * décision. Les inclure ferait redemander un accord parce qu'on a corrigé une faute de frappe
 * dans un titre — et c'est ainsi qu'on entraîne quelqu'un à approuver sans lire.
 *
 * En revanche le CORPS d'un message est matériel : « on annonce une prime » et « on annonce un
 * gel des salaires » sont deux missions différentes derrière le même plan.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les champs d'entrée qui changent la conséquence. Explicites, jamais devinés. */
const CHAMPS_MATERIELS = [
  "to", "destinataire", "destinataires", "recipients", "cc", "bcc",
  "employeeId", "employeeIds", "userId", "personId", "personIds", "recordId",
  "sujet", "subject", "objet", "corps", "body", "message", "texte",
  "montant", "amount", "total", "devise", "currency",
  "dateEffet", "effectiveDate", "dueAt",
];

/**
 * LA SÉRIALISATION CANONIQUE — deux objets équivalents produisent le MÊME texte.
 *
 * Sans elle, `{a:1,b:2}` et `{b:2,a:1}` donneraient deux empreintes différentes, et le PDG
 * redemanderait son accord parce qu'un objet a été reconstruit dans un autre ordre. Le tri des
 * clés n'est donc pas une coquetterie : c'est ce qui rend l'empreinte STABLE.
 */
function canonique(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return `[${v.map(canonique).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonique(o[k])}`).join(",")}}`;
  }
  if (typeof v === "string") return JSON.stringify(v.trim());
  return JSON.stringify(v);
}

/** La projection MATÉRIELLE d'une étape : ce qui, changé, change la conséquence. */
function projeter(s: CompiledStep): Record<string, unknown> {
  const materiel: Record<string, unknown> = {};
  for (const champ of CHAMPS_MATERIELS) {
    if (Object.prototype.hasOwnProperty.call(s.input, champ)) materiel[champ] = s.input[champ];
  }
  return {
    key: s.key,
    capability: s.capability,
    nodeType: s.nodeType,
    effect: s.effect,
    input: materiel,
    // L'ÉVENTAIL EST MATÉRIEL PAR SA SOURCE, pas par son nombre : le nombre n'est pas connu à
    // l'approbation. Ce que le PDG approuve, c'est « un message à chaque personne de cette
    // liste » — si la liste change de source, ce n'est plus la même autorisation.
    forEach: s.forEach ? { from: s.forEach.from, path: s.forEach.path } : null,
  };
}

export interface PerimetreApprobation {
  /** Les clés d'étapes couvertes. Ce que l'accord débloque, et rien d'autre. */
  stepKeys: string[];
  niveau: NiveauApprobation;
  scopeHash: string;
  /** Une phrase, pour l'humain. Jamais un identifiant technique. */
  resume: string;
  /** Un ÉCHANTILLON de ce qui sera fait, pour inspecter sans tout dérouler. */
  echantillon: { stepKey: string; capability: string | null; apercu: Record<string, unknown> }[];
}

/**
 * LE PÉRIMÈTRE D'UNE MISSION — ce sur quoi porte l'accord.
 *
 * Seules les étapes qui EN ONT BESOIN y figurent. Faire approuver les lectures avec le reste
 * gonflerait le périmètre sans rien protéger, et rendrait le résumé illisible : « 312 étapes »
 * quand trois seulement sortent de l'entreprise.
 */
export function perimetre(mission: CompiledMission): PerimetreApprobation | null {
  const concernees = mission.steps.filter((s) => s.needsApproval);
  // LES PORTES ELLES-MÊMES. `stepKeys` répond à « qu'est-ce que cet accord débloque ? » — et il
  // débloque LA PORTE autant que les actes derrière elle. Sans cette ligne, la porte cherchait
  // un accord qui la nommait et n'en trouvait jamais : elle attendait indéfiniment un accord
  // pourtant donné. Elles ne figurent pas au RÉSUMÉ, en revanche : ce que l'humain doit lire,
  // ce sont les actes, pas les marqueurs de contrôle qui les précèdent.
  const portes = mission.steps.filter((s) => s.nodeType === "APPROVAL");
  if (concernees.length === 0 && portes.length === 0) return null;

  const effetMax = concernees.reduce<Effect>(
    (max, s) => (EFFECT_RANK[s.effect] > EFFECT_RANK[max] ? s.effect : max),
    "READ",
  );

  // Les étapes sont TRIÉES par clé avant l'empreinte : l'ordre du plan peut changer sans que
  // les conséquences changent, et une empreinte sensible à l'ordre redemanderait un accord
  // pour un simple réagencement.
  const projection = concernees.map(projeter).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const scopeHash = createHash("sha256")
    .update(canonique({ objective: mission.objective.trim(), steps: projection }))
    .digest("hex");

  const parCapacite = new Map<string, number>();
  for (const s of concernees) {
    const c = s.capability ?? s.nodeType;
    parCapacite.set(c, (parCapacite.get(c) ?? 0) + 1);
  }
  const details = [...parCapacite.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => (n > 1 ? `${c} ×${n}` : c))
    .join(", ");

  const eventails = concernees.filter((s) => s.forEach).length;
  return {
    stepKeys: [...new Set([...concernees, ...portes].map((s) => s.key))].sort(),
    niveau: niveauPour(effetMax),
    scopeHash,
    resume: `${concernees.length} étape(s) à autoriser : ${details}.`
      + (eventails > 0
        ? ` Dont ${eventails} déployée(s) sur une liste — le nombre exact d'envois dépendra de la liste au moment de l'exécution.`
        : ""),
    echantillon: concernees.slice(0, 5).map((s) => ({
      stepKey: s.key,
      capability: s.capability,
      apercu: projeter(s).input as Record<string, unknown>,
    })),
  };
}

/**
 * LE PÉRIMÈTRE A-T-IL CHANGÉ MATÉRIELLEMENT ?
 *
 * Rend les clés d'étapes qui ne sont PAS couvertes par l'accord donné. Une empreinte différente
 * ne réouvre pas toute la mission : elle réouvre la PARTIE modifiée (§33). Redemander l'accord
 * pour l'ensemble parce qu'une étape a bougé serait revenir aux 99 confirmations par un autre
 * chemin.
 */
export function nonCouvertes(
  mission: CompiledMission,
  accorde: { scopeHash: string; stepKeys: readonly string[] },
): string[] {
  const p = perimetre(mission);
  if (!p) return [];
  if (p.scopeHash === accorde.scopeHash) return [];

  const dejaVues = new Set(accorde.stepKeys);
  const concernees = mission.steps.filter((s) => s.needsApproval || s.nodeType === "APPROVAL");

  // Une étape déjà nommée dans l'accord ET dont la projection est inchangée reste couverte. On
  // ne peut le savoir qu'en comparant étape par étape : l'empreinte globale, elle, ne dit que
  // « quelque chose a bougé ».
  return concernees
    .filter((s) => !dejaVues.has(s.key))
    .map((s) => s.key)
    .sort();
}

/**
 * L'EMPREINTE D'UNE SEULE ÉTAPE — pour dire laquelle a changé, et pas seulement que quelque
 * chose a changé. C'est ce qui permet à l'écran d'afficher « le montant de la ligne 4 est passé
 * de X à Y » plutôt que « le plan a changé, re-validez tout ».
 */
export function empreinteEtape(s: CompiledStep): string {
  return createHash("sha256").update(canonique(projeter(s))).digest("hex").slice(0, 16);
}
