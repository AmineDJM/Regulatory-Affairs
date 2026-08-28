/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LE RUNTIME DOIT SAVOIR D'UNE CAPACITÉ — au-delà de son schéma d'entrée.
 *
 * ── LE PROBLÈME ──────────────────────────────────────────────────────────────────────────
 *
 * Un outil déclare aujourd'hui son nom, sa description, son schéma et son droit d'accès. C'est
 * assez pour qu'un modèle l'appelle dans une conversation. Ce n'est pas assez pour qu'un MOTEUR
 * le planifie : celui-ci doit savoir, sans demander à personne, si l'appel écrit ou lit, s'il
 * peut être rejoué sans dommage, s'il se groupe, s'il exige une confirmation, et combien de
 * temps il prend.
 *
 * ── POURQUOI PAS UNE RÉÉCRITURE DES 165 OUTILS ──────────────────────────────────────────
 *
 * Parce qu'une métadonnée recopiée à la main 165 fois est une métadonnée fausse à 160
 * endroits six mois plus tard. Le registre procède donc en trois temps :
 *
 *   1. ce qu'une capacité DÉCLARE explicitement fait foi ;
 *   2. à défaut, on DÉRIVE des sources de vérité qui existent déjà — la liste des écritures du
 *      résolveur, le registre d'actions natives, la politique de confirmation ;
 *   3. et si rien ne dit, le défaut est le plus PRUDENT possible : effet inconnu ⇒ traité comme
 *      une écriture externe, donc non rejouable et sous confirmation.
 *
 * Le défaut prudent est le point important. Un outil ajouté demain par quelqu'un qui n'a pas lu
 * ce fichier ne devient pas automatiquement rejouable en masse sans confirmation — il devient
 * inutilisable en masse tant que personne ne l'a qualifié, ce qui est le bon sens inverse.
 *
 * ── §8 : AJOUTER UN DOMAINE DOIT AUGMENTER ADAM ─────────────────────────────────────────
 *
 * Un nouveau domaine publie ses capacités avec leurs métadonnées. Le planner les voit, le
 * compiler les valide, le moteur les exécute. Aucun paragraphe n'est ajouté au prompt d'Adam.
 * C'est l'invariant que ce fichier existe pour rendre vrai.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * L'EFFET D'UNE CAPACITÉ — la seule métadonnée dont tout le reste découle.
 *
 * L'ordre est celui de la gravité croissante, et il est utilisé : une mission dont l'effet
 * maximal est `READ` n'a besoin d'aucune approbation, une mission qui atteint
 * `EXTERNAL_COMMUNICATION` en demande une.
 */
export const EFFECTS = [
  "READ",
  "ANALYZE",
  "PREPARE",
  "INTERNAL_REVERSIBLE_WRITE",
  "EXTERNAL_COMMUNICATION",
  "FINANCIAL_COMMITMENT",
  "HR_SENSITIVE",
  "DESTRUCTIVE",
  "SECURITY_ADMIN",
] as const;
export type Effect = (typeof EFFECTS)[number];

/** La gravité, pour comparer deux effets. Plus haut = plus irréversible. */
export const EFFECT_RANK: Record<Effect, number> = {
  READ: 0,
  ANALYZE: 1,
  PREPARE: 2,
  INTERNAL_REVERSIBLE_WRITE: 3,
  EXTERNAL_COMMUNICATION: 4,
  FINANCIAL_COMMITMENT: 5,
  HR_SENSITIVE: 6,
  DESTRUCTIVE: 7,
  SECURITY_ADMIN: 8,
};

/** L'ordre de grandeur de la latence — sert au pool, pas à l'affichage. */
export type LatencyClass = "LOW" | "MEDIUM" | "HIGH";

export interface CapabilityMeta {
  id: string;
  domain: string;
  effect: Effect;
  /**
   * PEUT-ON LA REJOUER SANS DOMMAGE ?
   *
   * Attention au sens exact : `idempotent: true` signifie que DEUX appels identiques
   * produisent le même état final — pas qu'ils sont gratuits. Une lecture l'est toujours ; un
   * envoi d'e-mail ne l'est JAMAIS par lui-même, il le devient par la clé d'idempotence que le
   * moteur pose autour de lui.
   */
  idempotent: boolean;
  /** Peut-on la déployer en éventail sur une collection ? */
  batchable: boolean;
  latency: LatencyClass;
  /** POLICY_ENGINE = c'est la politique qui tranche ; ALWAYS = toujours ; NEVER = jamais. */
  confirmation: "POLICY_ENGINE" | "ALWAYS" | "NEVER";
  /** Vrai quand la métadonnée a été DÉCLARÉE ; faux quand elle a été dérivée ou devinée. */
  declared: boolean;
}

/**
 * LES CAPACITÉS DÉCLARÉES.
 *
 * On ne déclare pas les 165 outils : on déclare celles que le runtime dispatche réellement,
 * plus celles dont le défaut prudent serait faux au point de gêner (les grandes lectures).
 * Le reste est dérivé, et le test d'architecture exige qu'une capacité UTILISÉE par une
 * mission soit déclarée — c'est là que la rigueur est nécessaire, pas partout.
 */
export const DECLARED: Record<string, Omit<CapabilityMeta, "id" | "declared">> = {
  // ─────────── Lectures canoniques ───────────
  directory_lookup: { domain: "directory", effect: "READ", idempotent: true, batchable: true, latency: "LOW", confirmation: "NEVER" },
  directory_list: { domain: "directory", effect: "READ", idempotent: true, batchable: false, latency: "LOW", confirmation: "NEVER" },
  inspect_record: { domain: "platform", effect: "READ", idempotent: true, batchable: true, latency: "LOW", confirmation: "NEVER" },
  search_everything: { domain: "platform", effect: "READ", idempotent: true, batchable: false, latency: "MEDIUM", confirmation: "NEVER" },
  read_hr_overview: { domain: "hr", effect: "READ", idempotent: true, batchable: false, latency: "LOW", confirmation: "NEVER" },
  employee_360: { domain: "hr", effect: "READ", idempotent: true, batchable: true, latency: "MEDIUM", confirmation: "NEVER" },
  product_economics: { domain: "regulatory", effect: "READ", idempotent: true, batchable: true, latency: "MEDIUM", confirmation: "NEVER" },
  pch_market_status: { domain: "pch", effect: "READ", idempotent: true, batchable: true, latency: "MEDIUM", confirmation: "NEVER" },
  business_story: { domain: "pch", effect: "READ", idempotent: true, batchable: true, latency: "HIGH", confirmation: "NEVER" },
  regulatory_portfolio: { domain: "regulatory", effect: "READ", idempotent: true, batchable: true, latency: "MEDIUM", confirmation: "NEVER" },
  read_finances: { domain: "finance", effect: "READ", idempotent: true, batchable: false, latency: "MEDIUM", confirmation: "NEVER" },
  gmail_search: { domain: "mail", effect: "READ", idempotent: true, batchable: false, latency: "MEDIUM", confirmation: "NEVER" },
  read_calendar: { domain: "calendar", effect: "READ", idempotent: true, batchable: false, latency: "LOW", confirmation: "NEVER" },
  list_pending_decisions: { domain: "tasks", effect: "READ", idempotent: true, batchable: false, latency: "LOW", confirmation: "NEVER" },

  // ─────────── Communications et écritures ───────────
  //
  // ── CES NOMS SONT CEUX DU REGISTRE RÉEL, ET C'EST UNE CORRECTION ───────────────────────
  //
  // La première version de cette table nommait `prepare_mail`, `send_erp_message`,
  // `notify_person` et `create_task_request` : des noms PLAUSIBLES, écrits d'après l'intention,
  // et qui n'existaient nulle part. Rien ne tombait — `capabilityMeta` dérive prudemment un nom
  // inconnu — mais la dérivation prudente rend `batchable: false`, ce qui aurait fait REFUSER
  // par le compilateur le déploiement en éventail de la mission la plus banale du produit
  // (« écris à chaque salarié »), avec un message parlant d'une capacité qui n'existe pas.
  //
  // `catalog.test.ts` interdit désormais qu'une capacité déclarée ici n'ait pas d'outil réel.
  //
  // `idempotent: false` est la VÉRITÉ de ces outils : rappeler `send_message` deux fois envoie
  // deux messages. C'est le MOTEUR qui rend l'ÉTAPE idempotente, en posant une clé unique autour
  // de l'appel. Confondre les deux ferait croire qu'un rejeu est sans danger.
  gmail_prepare_mail: { domain: "mail", effect: "PREPARE", idempotent: false, batchable: true, latency: "MEDIUM", confirmation: "NEVER" },
  send_email: { domain: "mail", effect: "EXTERNAL_COMMUNICATION", idempotent: false, batchable: true, latency: "MEDIUM", confirmation: "POLICY_ENGINE" },
  send_message: { domain: "messaging", effect: "INTERNAL_REVERSIBLE_WRITE", idempotent: false, batchable: true, latency: "LOW", confirmation: "POLICY_ENGINE" },
  create_task: { domain: "tasks", effect: "INTERNAL_REVERSIBLE_WRITE", idempotent: false, batchable: true, latency: "LOW", confirmation: "POLICY_ENGINE" },
  create_admin_request: { domain: "tasks", effect: "INTERNAL_REVERSIBLE_WRITE", idempotent: false, batchable: true, latency: "LOW", confirmation: "POLICY_ENGINE" },
  create_calendar_event: { domain: "calendar", effect: "INTERNAL_REVERSIBLE_WRITE", idempotent: false, batchable: true, latency: "LOW", confirmation: "POLICY_ENGINE" },
  search_people: { domain: "directory", effect: "READ", idempotent: true, batchable: true, latency: "LOW", confirmation: "NEVER" },
  search_drive: { domain: "drive", effect: "READ", idempotent: true, batchable: true, latency: "MEDIUM", confirmation: "NEVER" },
  read_document: { domain: "drive", effect: "READ", idempotent: true, batchable: true, latency: "MEDIUM", confirmation: "NEVER" },
  create_report: { domain: "office", effect: "PREPARE", idempotent: false, batchable: false, latency: "HIGH", confirmation: "NEVER" },
};

/**
 * LES ÉCRITURES CONNUES, PAR PRÉFIXE.
 *
 * Une dérivation grossière mais HONNÊTE : elle classe du côté prudent. `delete_*` est
 * destructif, `send_*` communique, `create_*` / `update_*` écrivent. Elle n'est utilisée que
 * lorsque rien n'a été déclaré, et elle ne peut que RENFORCER la garde, jamais l'affaiblir.
 */
/**
 * LE DOMAINE D'UNE CAPACITÉ NON DÉCLARÉE, DÉDUIT DE SON NOM.
 *
 * ── POURQUOI « inconnu » NE POUVAIT PAS RESTER ──────────────────────────────────────────
 *
 * Le résolveur (§3) sélectionne les capacités en TOURNIQUET entre domaines, pour garantir qu'un
 * domaine pertinent soit représenté. Tant que les cent quarante capacités non déclarées
 * partageaient le domaine « inconnu », ce domaine unique raflait une part entière du tourniquet
 * et y déversait n'importe quoi — `update_hospital` et `update_salary` se retrouvaient devant le
 * planner d'une mission de messagerie.
 *
 * La déduction ci-dessous est grossière et le restera : elle sert à REGROUPER, pas à décider.
 * Aucune garde ne s'appuie dessus — l'effet, lui, continue d'être dérivé prudemment.
 */
export function domaineDeduit(name: string): string {
  const n = name.toLowerCase();
  const table: [RegExp, string][] = [
    [/mail|email|gmail|courriel/, "mail"],
    [/message|messaging|notification|notify/, "messaging"],
    [/drive|document|file|folder|piece/, "drive"],
    [/employee|employe|hr|rh|salary|salaire|paie|payroll|conge|leave|recruit/, "hr"],
    [/task|tache|request|demande|todo|reminder|rappel|workflow|validation/, "tasks"],
    [/regulatory|dossier|ctd|anpp|product|produit|molecule/, "regulatory"],
    [/pch|tender|marche|hospital|hopital|stock/, "pch"],
    [/finance|payment|paiement|invoice|facture|budget|treasury|tresorerie|expense/, "finance"],
    [/legal|contract|contrat|courrier/, "legal"],
    [/calendar|agenda|meeting|reunion|slot/, "calendar"],
    [/directory|annuaire|person|people|contact|medecin|doctor/, "directory"],
    [/promo|adpro|ad_pro|event|sponsor|congress/, "adpro"],
    [/report|export|excel|docx|pptx|pdf|deliverable|livrable/, "office"],
    [/account|user|role|permission|admin|setting|parametre/, "platform"],
    [/search|inspect|find|read|list|show/, "platform"],
  ];
  for (const [motif, domaine] of table) if (motif.test(n)) return domaine;
  return "autre";
}

const PREFIXES: { test: (n: string) => boolean; effect: Effect }[] = [
  { test: (n) => n.startsWith("delete_") || n.includes("_delete") || n.startsWith("purge_"), effect: "DESTRUCTIVE" },
  { test: (n) => n.startsWith("send_") || n.startsWith("email_") || n.startsWith("mail_"), effect: "EXTERNAL_COMMUNICATION" },
  { test: (n) => n.includes("permission") || n.includes("role") || n.includes("account"), effect: "SECURITY_ADMIN" },
  { test: (n) => n.includes("salary") || n.includes("paie") || n.includes("payroll") || n.includes("contract"), effect: "HR_SENSITIVE" },
  { test: (n) => n.includes("payment") || n.includes("invoice") || n.includes("facture"), effect: "FINANCIAL_COMMITMENT" },
  { test: (n) => n.startsWith("prepare_") || n.startsWith("draft_"), effect: "PREPARE" },
  { test: (n) => n.startsWith("read_") || n.startsWith("list_") || n.startsWith("get_") || n.startsWith("search_") || n.startsWith("inspect_"), effect: "READ" },
];

/**
 * LA MÉTADONNÉE D'UNE CAPACITÉ — déclarée, dérivée, ou prudente.
 *
 * `estEcriture` vient de l'appelant : c'est la liste que le résolveur d'outils tient déjà
 * (`RESOLVER_WRITE_NAMES`). On la CONSULTE plutôt que de la recopier — deux listes d'écritures
 * divergent, et celle qui diverge est toujours celle qui gardait.
 */
export function capabilityMeta(name: string, estEcriture?: (n: string) => boolean): CapabilityMeta {
  const declared = Object.prototype.hasOwnProperty.call(DECLARED, name) ? DECLARED[name] : null;
  if (declared) return { id: name, declared: true, ...declared };

  // Dérivation. L'ordre compte : la liste d'écritures du résolveur l'emporte sur le préfixe,
  // parce qu'elle est tenue par le code qui exécute, et non par une convention de nommage.
  const ecrit = estEcriture?.(name) ?? false;
  const parPrefixe = PREFIXES.find((p) => p.test(name))?.effect;

  const effect: Effect = ecrit
    ? (parPrefixe && EFFECT_RANK[parPrefixe] >= EFFECT_RANK.INTERNAL_REVERSIBLE_WRITE
        ? parPrefixe
        : "INTERNAL_REVERSIBLE_WRITE")
    // PAS D'ÉCRITURE CONNUE ET AUCUN PRÉFIXE RECONNU ⇒ on ne sait pas. Le défaut prudent est
    // `EXTERNAL_COMMUNICATION` : non rejouable, sous confirmation, non groupable. Une capacité
    // inconnue ne part donc jamais en masse sans que quelqu'un l'ait qualifiée.
    : (parPrefixe ?? "EXTERNAL_COMMUNICATION");

  const lecture = EFFECT_RANK[effect] <= EFFECT_RANK.ANALYZE;
  return {
    id: name,
    domain: domaineDeduit(name),
    effect,
    idempotent: lecture,
    batchable: lecture,
    latency: "MEDIUM",
    confirmation: lecture ? "NEVER" : "POLICY_ENGINE",
    declared: false,
  };
}

/** L'effet le plus grave d'un ensemble — ce qui décide du niveau d'approbation d'une mission. */
export function effetMaximal(effets: readonly Effect[]): Effect {
  return effets.reduce<Effect>((max, e) => (EFFECT_RANK[e] > EFFECT_RANK[max] ? e : max), "READ");
}

/** Une capacité dont l'effet est au moins une écriture — donc qui laisse une trace. */
export function ecritQuelqueChose(m: CapabilityMeta): boolean {
  return EFFECT_RANK[m.effect] >= EFFECT_RANK.INTERNAL_REVERSIBLE_WRITE;
}
