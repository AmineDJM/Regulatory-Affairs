import fs from "node:fs";
import path from "node:path";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA CARTE DES DOMAINES (§1) — un monolithe MODULAIRE, pas une constellation de services.
 *
 * ── LES QUATRE COUCHES ───────────────────────────────────────────────────────────────────
 *
 *   L0  SOCLE      `prisma`, `session`, `rbac`, `utils`, `crypto`, `platform`… L'infrastructure.
 *                  N'importe AUCUN domaine, AUCUNE façade. Vérifié durement, sans plafond.
 *   L1  DOMAINES   Les quinze métiers. Ne doivent ni s'importer entre eux, ni remonter vers une
 *                  façade. Deux cliquets : `crossings` et `domainToFacade`.
 *   L2  FAÇADES    `queries/` (lectures), `api/registry/` (écritures), `links/`. Elles EXISTENT
 *                  pour traverser les domaines : les compter comme des violations n'aurait aucun
 *                  sens. Elles sont le passage AUTORISÉ, et le seul.
 *   L3  ADAM       Consomme les façades et, pour l'instant, les domaines. Il a son propre
 *                  cliquet, dans `boundary.test.ts` — voir ci-dessous.
 *
 * Une couche ne parle qu'à celles du dessous. C'est tout le modèle.
 *
 * ── CE QUE CE FICHIER MESURE, ET CE QU'IL NE MESURE PAS ──────────────────────────────────
 *
 * Il mesure la couche métier. Il ne mesure PAS la frontière Adam ↔ ERP, qui a son propre cliquet
 * (`boundary-scan.ts`) et son propre plafond — deux questions différentes, deux chiffres
 * différents, et les mélanger empêcherait de faire baisser l'un sans masquer l'autre.
 *
 * ── LA RÈGLE, EN UNE PHRASE ──────────────────────────────────────────────────────────────
 *
 * « Une petite modification métier doit idéalement rester dans son module. » Un domaine qui
 * importe dix fichiers d'un autre n'est pas un module : c'est la moitié d'un module, et la
 * moindre retouche chez le voisin le casse.
 *
 * ── POURQUOI UN CLIQUET PLUTÔT QU'UN INTERDIT ────────────────────────────────────────────
 *
 * Le même raisonnement que pour la frontière Adam ↔ ERP : interdire d'un coup exigerait une
 * réécriture aveugle, que la mission proscrit explicitement. On MESURE, on empêche de grossir, on
 * fait baisser lot après lot. À tout instant le produit marche, et le chiffre dit où l'on en est.
 *
 * Deux choses échappent au cliquet et sont exigées à ZÉRO, parce qu'elles ne se corrigent pas
 * « progressivement » : les CYCLES (§1 les nomme explicitement) et la PROPRETÉ DU SOCLE. Cette
 * seconde est ce qui empêche de tricher avec le reste : sans elle, il suffirait de déplacer un
 * fichier gênant dans `utils/` pour faire baisser le compteur sans rien avoir assaini.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LES DOMAINES. Chacun est un préfixe de chemin, et l'ordre compte : le PREMIER qui correspond
 * gagne. `finances/` et `finance/` coexistent dans l'arbre (dette historique) et sont donc
 * déclarés comme UN seul domaine — les séparer compterait comme « inter-domaine » ce qui n'est
 * qu'une incohérence de nommage.
 */
export const DOMAINS: { name: string; paths: string[] }[] = [
  { name: "regulatory", paths: ["src/lib/regulatory/", "src/lib/products/", "src/lib/market/"] },
  { name: "finance", paths: ["src/lib/finance/", "src/lib/finances/", "src/lib/payments/", "src/lib/budget/"] },
  { name: "hr", paths: ["src/lib/hr/", "src/lib/recruitment/", "src/lib/org/"] },
  { name: "drive", paths: ["src/lib/drive/", "src/lib/files/", "src/lib/storage/"] },
  { name: "mail", paths: ["src/lib/mail/", "src/lib/mail-register/", "src/lib/comms/"] },
  { name: "tasks", paths: ["src/lib/tasks/", "src/lib/workflow/", "src/lib/validations/"] },
  { name: "legal", paths: ["src/lib/legal/"] },
  { name: "knowledge", paths: ["src/lib/knowledge/"] },
  { name: "scheduler", paths: ["src/lib/scheduler/"] },
  { name: "adam", paths: ["src/lib/assistant/", "src/lib/models/", "src/lib/assistant.ts"] },
  { name: "google", paths: ["src/lib/google/"] },
  { name: "directory", paths: ["src/lib/directory/", "src/lib/contacts/", "src/lib/medical/"] },
  { name: "adpro", paths: ["src/lib/ad-pro/", "src/lib/promo/", "src/lib/promo-material/"] },
  { name: "general-means", paths: ["src/lib/general-means/"] },
  { name: "office", paths: ["src/lib/office/", "src/lib/pdf/"] },
];

/**
 * L3 — ADAM. Il est déclaré comme un domaine ci-dessus (pour être MESURÉ), mais il vit au-dessus
 * des façades : `assistant/power-tools.ts → queries/hr` est le chemin VOULU, pas une entorse.
 * D'où cette exception, et elle seule, dans le compte des inversions de couche.
 */
const ADAM_DOMAIN = "adam";

/**
 * L0 — LE SOCLE. Tout le monde a le droit, et le compter n'apprendrait rien.
 *
 * La liste reste courte et défendable : ce sont des INFRASTRUCTURES (base, session, droits,
 * chiffrement) ou des utilitaires sans métier. Y figurer n'est pas un passe-droit mais une
 * OBLIGATION : `scanSocle()` échoue si l'un de ces fichiers importe un domaine ou une façade.
 *
 * `api/registry/entities` y est parce qu'il n'est qu'un CATALOGUE déclaratif — modèle Prisma,
 * module RBAC, champs — sans une ligne de métier. Le reste de `api/registry/` (les opérations
 * d'écriture) est bien une façade, lui, et reste en L2.
 */
const SOCLE = [
  "src/lib/prisma", "src/lib/session", "src/lib/rbac", "src/lib/utils", "src/lib/labels",
  "src/lib/crypto/", "src/lib/ai-text", "src/lib/name-match", "src/platform/",
  "src/lib/api/registry/entities",
];

/**
 * L2 — LES FAÇADES TRANSVERSES. Elles traversent les domaines par CONSTRUCTION : `queries/` est
 * la couche de lecture canonique, `api/registry/` celle d'écriture. Leur reprocher de connaître
 * plusieurs métiers reviendrait à leur reprocher d'exister.
 *
 * Ce qui est surveillé, c'est le SENS : un domaine ne remonte pas vers une façade (`domainToFacade`).
 */
const FACADES = ["src/lib/queries/", "src/lib/api/", "src/lib/links/"];

/**
 * LE PONT ADAM ↔ ERP — le seul fichier de `src/platform/` autorisé à connaître l'ERP, par
 * dessein. `boundary.test.ts` détient la même liste et la même justification.
 */
const BRIDGE = ["src/platform/in-process/"];

/**
 * LES FOURNISSEURS EXTERNES, qui doivent rester ISOLÉS (§1).
 *
 * Un domaine métier qui importe directement le client OpenAI ou le SDK Google se lie à un
 * fournisseur : le changer devient un chantier au lieu d'un remplacement. Ces modules ont des
 * façades (`models/`, `google/`) ; les traverser est une violation d'un genre particulier, qu'on
 * compte à part parce qu'elle se corrige différemment.
 */
const PROVIDERS = ["src/lib/openai-luna", "src/lib/ai", "src/lib/anthropic", "src/lib/drive-storage"];

export interface DomainViolation {
  from: string;
  to: string;
  fromDomain: string;
  toDomain: string;
}

export interface DomainReport {
  /** Un domaine qui fouille dans un autre. */
  crossings: DomainViolation[];
  /** Un domaine métier qui parle directement à un fournisseur externe. */
  providerLeaks: DomainViolation[];
  /** Un domaine (hors Adam) qui remonte vers une façade — inversion de couche. */
  domainToFacade: DomainViolation[];
  /** Un fichier du socle qui connaît un domaine ou une façade. Doit rester VIDE. */
  socleLeaks: DomainViolation[];
  /** Les couples (A → B) et leur volume — dit par où commencer. */
  perPair: Map<string, number>;
  /** Les fichiers les plus poreux. */
  perFile: Map<string, number>;
  /** Les cycles A → B → A. Ce sont les plus coûteux : plus rien ne se modifie séparément. */
  cycles: string[];
}

/**
 * Un seul motif pour `import … from` ET `export … from` : la seconde forme crée exactement la
 * même dépendance, et l'avoir oubliée est une vraie faille — c'est ainsi qu'un module « neutre »
 * peut réexporter la moitié d'un domaine sans qu'aucun compteur ne bouge.
 */
const STATIC_RE = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)\s*from\s*["']([^"']+)["']/g;
const DYNAMIC_RE = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** À quel domaine appartient ce chemin ? `null` = socle, façade, page, composant ou hors carte. */
export function domainOf(file: string): string | null {
  for (const d of DOMAINS) {
    if (d.paths.some((p) => file.startsWith(p))) return d.name;
  }
  return null;
}

/** Un préfixe de la liste, en tolérant que `src/lib/prisma` désigne `src/lib/prisma.ts`. */
const inList = (f: string, list: string[]): boolean =>
  list.some((s) => f.startsWith(s) || f === `${s}.ts` || f === `${s}.tsx`);

const isSocle = (t: string): boolean => inList(t, SOCLE);
const isFacade = (t: string): boolean => inList(t, FACADES);
const isProvider = (t: string): boolean => PROVIDERS.some((s) => t === s || t.startsWith(`${s}/`));

/**
 * SCANNE LES DÉPENDANCES ENTRE COUCHES.
 *
 * Les TESTS sont exclus, pour la même raison que dans le cliquet de frontière : un test a le
 * droit de fabriquer un jeu de données depuis n'importe où, et il est souvent la seule
 * « racine de composition » légitime (c'est lui qui assemble un vrai transport avec un faux
 * dépôt). Ce qu'on protège, c'est le code qui part en production.
 */
export function scanDomains(root = process.cwd()): DomainReport {
  const cwd = process.cwd();
  process.chdir(root);
  try {
    const files = [...walk("src/lib"), ...walk("src/platform")]
      .map((f) => f.split(path.sep).join("/"))
      .filter((f) => !/\.test\.tsx?$/.test(f));

    const crossings: DomainViolation[] = [];
    const providerLeaks: DomainViolation[] = [];
    const domainToFacade: DomainViolation[] = [];
    const socleLeaks: DomainViolation[] = [];
    const perPair = new Map<string, number>();
    const perFile = new Map<string, number>();
    const edges = new Map<string, Set<string>>();

    for (const file of files) {
      const fromDomain = domainOf(file);
      const fromSocle = isSocle(file) && !BRIDGE.some((b) => file.startsWith(b));

      const src = fs.readFileSync(file, "utf8");
      const specs: string[] = [];
      for (const m of src.matchAll(STATIC_RE)) specs.push(m[1]);
      for (const m of src.matchAll(DYNAMIC_RE)) specs.push(m[1]);

      for (const spec of specs) {
        if (!spec.startsWith("@/")) continue;
        const target = spec.replace("@/", "src/");

        // ── L0 : le socle ne connaît ni domaine ni façade. Zéro toléré. ──────────────────
        if (fromSocle) {
          const td = domainOf(target);
          if (td || isFacade(target)) {
            socleLeaks.push({ from: file, to: target, fromDomain: "socle", toDomain: td ?? "façade" });
          }
          continue;
        }

        if (!fromDomain) continue;
        if (isSocle(target)) continue;

        // ── L1 → L2 : un domaine ne remonte pas vers une façade. Adam, lui, est AU-DESSUS. ─
        if (isFacade(target)) {
          if (fromDomain !== ADAM_DOMAIN) {
            domainToFacade.push({ from: file, to: target, fromDomain, toDomain: "façade" });
          }
          continue;
        }

        if (isProvider(target)) {
          // `models/` EST la façade des fournisseurs : lui interdire d'y toucher n'aurait aucun
          // sens. Idem pour `google/`, façade du SDK Google.
          if (fromDomain === ADAM_DOMAIN && target.startsWith("src/lib/ai")) continue;
          if (fromDomain === "google") continue;
          providerLeaks.push({ from: file, to: target, fromDomain, toDomain: "provider" });
          continue;
        }

        const toDomain = domainOf(target) ?? domainOf(`${target}/`);
        if (!toDomain || toDomain === fromDomain) continue;

        crossings.push({ from: file, to: target, fromDomain, toDomain });
        const pair = `${fromDomain} → ${toDomain}`;
        perPair.set(pair, (perPair.get(pair) ?? 0) + 1);
        perFile.set(file, (perFile.get(file) ?? 0) + 1);
        if (!edges.has(fromDomain)) edges.set(fromDomain, new Set());
        edges.get(fromDomain)!.add(toDomain);
      }
    }

    return { crossings, providerLeaks, domainToFacade, socleLeaks, perPair, perFile, cycles: findCycles(edges) };
  } finally {
    process.chdir(cwd);
  }
}

/**
 * LES CYCLES À DEUX DOMAINES — A importe B et B importe A.
 *
 * On s'arrête aux cycles de longueur 2 délibérément. Ce sont les seuls qu'on sache CORRIGER
 * simplement (une inversion de dépendance), et ce sont de loin les plus fréquents. Détecter des
 * cycles de longueur 5 produirait une liste impressionnante et inexploitable.
 */
function findCycles(edges: Map<string, Set<string>>): string[] {
  const out = new Set<string>();
  for (const [a, targets] of edges) {
    for (const b of targets) {
      if (edges.get(b)?.has(a)) {
        // Trié pour que « a ↔ b » et « b ↔ a » ne comptent qu'une fois.
        out.add([a, b].sort().join(" ↔ "));
      }
    }
  }
  return [...out].sort();
}

/** Les arêtes exactes d'un cycle — sans elles, « google ↔ mail » ne dit pas quoi corriger. */
export function cycleEdges(r: DomainReport, cycle: string): DomainViolation[] {
  const [a, b] = cycle.split(" ↔ ");
  return r.crossings.filter(
    (v) => (v.fromDomain === a && v.toDomain === b) || (v.fromDomain === b && v.toDomain === a),
  );
}

/** Le rapport, tel qu'on le lit dans un terminal. */
export function formatDomains(r: DomainReport, topN = 12): string {
  const pairs = [...r.perPair.entries()].sort((a, b) => b[1] - a[1]);
  const files = [...r.perFile.entries()].sort((a, b) => b[1] - a[1]);
  return [
    "ARCHITECTURE — DÉPENDANCES ENTRE COUCHES",
    `  traversées inter-domaines   : ${r.crossings.length}`,
    `  fuites vers un fournisseur  : ${r.providerLeaks.length}`,
    `  domaine → façade (inversion): ${r.domainToFacade.length}`,
    `  fuites du socle (doit être 0): ${r.socleLeaks.length}`,
    `  cycles à deux domaines      : ${r.cycles.length}${r.cycles.length ? ` (${r.cycles.join(", ")})` : ""}`,
    "",
    `LES ${topN} COUPLES LES PLUS LIÉS :`,
    ...pairs.slice(0, topN).map(([p, n]) => `  ${String(n).padStart(3)}  ${p}`),
    "",
    `LES ${topN} FICHIERS LES PLUS POREUX :`,
    ...files.slice(0, topN).map(([f, n]) => `  ${String(n).padStart(3)}  ${f}`),
  ].join("\n");
}
