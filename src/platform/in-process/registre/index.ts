import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { capabilityMeta } from "@/lib/missions/registry/capability-meta";
import { contratDepuisSchema } from "@/lib/missions/registry/input-contract";
import { percentile } from "@/lib/calcul/rigueur";
import {
  AUCUNE_MESURE, composerFiche, detecterManque, interroger, sommaireRegistre,
  type FicheCapacite, type Mesures, type Requete,
} from "@/lib/registre/fiche";
import { classer, feuilleDeRoute, type Manque } from "@/lib/registre/manques";

/**
 * CE QUE LE PONT PUBLIE — et pourquoi il réexporte les TYPES.
 *
 * Adam ne doit pas importer `@/lib/registre/` directement : la frontière Adam ↔ ERP se compte, et
 * un `import type` la franchit comme un autre (`boundary.test.ts`). Le pont est le passage prévu ;
 * il rend donc la forme des fiches et des manques disponible sans que l'outil ait à connaître le
 * moteur qui les produit.
 */
export type { FicheCapacite, Mesures, Requete, Reponse, Ecartee, NiveauRisque, ClasseDepense } from "@/lib/registre/fiche";
export type { Manque, NatureManque, LigneFeuilleDeRoute } from "@/lib/registre/manques";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PONT DU REGISTRE (mandat 6 §44) — là où les fiches rencontrent le RÉEL.
 *
 * ── LES TROIS MATÉRIAUX, ET AUCUN N'EST INVENTÉ ICI ─────────────────────────────────────
 *
 *   1. LA LISTE DES CAPACITÉS vient de `POWER_TOOLS` — le registre d'outils réel, pas une
 *      seconde liste qui divergerait. Ce que la personne a le DROIT d'appeler vient de
 *      `assistantToolsFor(user)` : exactement la liste que la conversation envoie au modèle.
 *   2. LES MÉTADONNÉES viennent de `capabilityMeta` — le même registre que le compilateur.
 *   3. LES MESURES viennent de `MissionStep` : des étapes réellement exécutées, avec leur
 *      statut, leur nombre de tentatives et leurs horodatages. Rien d'auto-déclaré.
 *
 * ── POURQUOI LES MESURES NE PEUVENT VENIR QUE DE LÀ ─────────────────────────────────────
 *
 * `MissionStep` est la seule table où une capacité laisse une trace COMPLÈTE : ce qui a été
 * tenté, ce qui a réussi, ce qui a été rejoué, et combien de temps cela a pris. Un compteur
 * maison à côté serait un second registre (§17) — il divergerait, et le jour où les deux
 * chiffres ne coïncideraient plus, personne ne saurait lequel croire.
 *
 * La conversation, elle, n'écrit pas d'étape : les capacités appelées en conversation ne sont
 * donc PAS comptées ici. C'est une limite, elle est dite — `echantillon` porte le nombre exact
 * d'appels vus, et une capacité que seule la conversation utilise reste « jamais mesurée ».
 *
 * ── LE JOURNAL DES MANQUES EST CELUI QUI EXISTE (§17) ───────────────────────────────────
 *
 * Un manque n'a pas de table. Il vit dans le `detail` de l'événement `STEP_FAILED` que le
 * moteur écrit déjà, et la feuille de route est une LECTURE de ces événements. Une table
 * « CapabilityGap » aurait dit la même chose une seconde fois, et aurait divergé le premier
 * jour où quelqu'un aurait oublié de l'écrire dans un chemin d'échec.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LE REGISTRE D'OUTILS EST CHARGÉ À LA DEMANDE — et c'est structurel, pas une optimisation.
 *
 * `power-tools.ts` publie l'outil `registre_capacites`, qui appelle ce pont : un import statique
 * en sens inverse ferait un cycle de modules, et le pattern retenu ailleurs (le pont des skills)
 * est celui-ci — le type au chargement, la valeur à l'appel.
 */
interface OutilVu { name: string; description: string; input_schema?: unknown; label?: string }

/**
 * TOUTE LA SURFACE, PAS SEULEMENT LES OUTILS DE POUVOIR.
 *
 * ── LE DÉFAUT MESURÉ, ET IL RENDAIT LE REGISTRE FAUX ────────────────────────────────────
 *
 * La première version ne recensait que `POWER_TOOLS` — 138 capacités. Or la surface réelle
 * offerte à une personne en compte plus de deux cents : les lectures de base, les écritures, les
 * outils super-admin et les schémas d'opérations par domaine n'y figurent pas.
 *
 * Conséquence constatée au banc d'autonomie (§43) : un plan appelant `search_people` — une
 * lecture parfaitement autorisée — était compté comme une CAPACITÉ HORS DROIT, parce qu'elle
 * n'existait tout simplement pas dans le registre. Un registre incomplet ne dit pas « je ne sais
 * pas » : il dit « ça n'existe pas », ce qui est la pire des deux réponses.
 *
 * La liste est donc l'UNION de deux sources : `assistantToolsFor(user)` (la surface exacte de
 * cette personne, donc autorisée par construction) et `POWER_TOOLS` (qui apporte, en plus, les
 * capacités qu'elle N'A PAS le droit d'appeler — c'est ce qui permet de dire « cela existe,
 * vous n'y avez pas droit »).
 *
 * LA LIMITE, DITE : une capacité hors `POWER_TOOLS` que cette personne n'a pas le droit
 * d'appeler n'apparaît pas. Le registre ne peut pas l'inventer — la seule liste complète est
 * celle que l'on construit POUR quelqu'un.
 */
async function registreDOutils(user: CurrentUser): Promise<{ tools: OutilVu[]; autorisees: Set<string>; estEcriture: (n: string) => boolean }> {
  const [{ POWER_TOOLS }, assistant] = await Promise.all([
    import("@/lib/assistant/power-tools"),
    import("@/lib/assistant"),
  ]);
  const siennes = assistant.assistantToolsFor(user);
  const autorisees = new Set(siennes.map((d) => d.name));
  const parNom = new Map<string, OutilVu>();
  for (const d of siennes) parNom.set(d.name, { name: d.name, description: d.description, input_schema: (d as { input_schema?: unknown }).input_schema });
  for (const t of POWER_TOOLS) {
    const vu = parNom.get(t.def.name);
    // Un outil de pouvoir apporte son LIBELLÉ, que la définition envoyée au modèle ne porte pas.
    if (vu) { vu.label = t.label; continue; }
    parNom.set(t.def.name, { name: t.def.name, description: t.def.description, input_schema: (t.def as { input_schema?: unknown }).input_schema, label: t.label });
  }
  return { tools: [...parNom.values()], autorisees, estEcriture: (n: string) => assistant.RESOLVER_WRITE_NAMES.has(n) };
}

/** Le plafond de lignes lues pour mesurer. Une mesure bornée qui dit sa borne vaut mieux qu'un scan. */
export const ETAPES_MESUREES_MAX = 20_000;
/** La fenêtre par défaut : trois mois. Au-delà, la fiabilité d'une capacité qui a changé ne veut rien dire. */
export const FENETRE_MESURE_JOURS = 90;

interface LigneEtape {
  capability: string | null;
  status: string;
  attempt: number;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

/**
 * CE QUI A ÉTÉ OBSERVÉ, PAR CAPACITÉ — lu sur les étapes de mission réellement exécutées.
 *
 * Seuls `DONE` et `FAILED` comptent : une étape `PENDING` ou `WAITING` n'a rien prouvé, et la
 * compter en échec ferait passer pour fragile une capacité qui n'a simplement pas encore tourné.
 */
export async function mesuresParCapacite(opts: { depuis?: Date; limite?: number } = {}): Promise<Map<string, Mesures>> {
  const depuis = opts.depuis ?? new Date(Date.now() - FENETRE_MESURE_JOURS * 86_400_000);
  const lignes = (await prisma.missionStep.findMany({
    where: { capability: { not: null }, status: { in: ["DONE", "FAILED"] }, startedAt: { gte: depuis } },
    select: { capability: true, status: true, attempt: true, error: true, startedAt: true, completedAt: true },
    orderBy: { startedAt: "desc" },
    take: Math.min(opts.limite ?? ETAPES_MESUREES_MAX, ETAPES_MESUREES_MAX),
  })) as LigneEtape[];

  const brut = new Map<string, { m: Mesures; durees: number[] }>();
  for (const l of lignes) {
    const nom = l.capability;
    if (!nom) continue;
    let e = brut.get(nom);
    if (!e) { e = { m: { ...AUCUNE_MESURE }, durees: [] }; brut.set(nom, e); }
    const m = e.m;
    m.appels += 1;
    if (l.attempt > 1) m.reprises += 1;
    const quand = (l.completedAt ?? l.startedAt)?.toISOString() ?? null;
    if (l.status === "DONE") {
      m.succes += 1;
      // Les lignes arrivent du plus récent au plus ancien : le premier vu est le dernier arrivé.
      if (!m.dernierSuccesLe) m.dernierSuccesLe = quand;
    } else {
      m.echecs += 1;
      if (!m.dernierEchec && l.error) { m.dernierEchec = l.error; m.dernierEchecLe = quand; }
    }
    if (l.startedAt && l.completedAt) {
      const d = l.completedAt.getTime() - l.startedAt.getTime();
      // UNE DURÉE NÉGATIVE OU NULLE N'EST PAS UNE MESURE. Elle arrive quand la reprise réécrit
      // `startedAt` sans que `completedAt` bouge ; la compter ferait un p50 de zéro milliseconde.
      if (d > 0) e.durees.push(d);
    }
  }

  const out = new Map<string, Mesures>();
  for (const [nom, { m, durees }] of brut) {
    if (durees.length >= 3) {
      m.p50Ms = Math.round(percentile(durees, 50));
      m.p90Ms = Math.round(percentile(durees, 90));
    }
    out.set(nom, m);
  }
  return out;
}

export interface OptionsFiches {
  /** Les mesures, si l'appelant les a déjà lues (une seule requête pour plusieurs interrogations). */
  mesures?: Map<string, Mesures>;
  /** Ne composer que ces capacités — pour une fiche unique, sans construire les cent soixante-cinq. */
  seulement?: readonly string[];
}

/**
 * COMPOSE LES FICHES POUR UNE PERSONNE.
 *
 * Toutes les capacités du registre y figurent, mais `autorisee` dit la vérité pour CETTE
 * personne. Montrer qu'une capacité existe sans y donner accès n'est pas une fuite — c'est ce
 * qui permet de répondre « cela existe, vous n'y avez pas droit » au lieu de « rien ne sait le
 * faire », deux phrases qui appellent des suites opposées (§44 : une permission n'est pas une
 * dette technique). Aucune donnée métier ne transite : seulement le nom et le résumé de l'outil.
 */
export async function fichesDe(user: CurrentUser, opts: OptionsFiches = {}): Promise<FicheCapacite[]> {
  const [mesures, { tools, autorisees, estEcriture }] = await Promise.all([
    opts.mesures ? Promise.resolve(opts.mesures) : mesuresParCapacite(),
    registreDOutils(user),
  ]);
  const filtre = opts.seulement ? new Set(opts.seulement) : null;

  const fiches: FicheCapacite[] = [];
  for (const t of tools) {
    const nom = t.name;
    if (filtre && !filtre.has(nom)) continue;
    const m = capabilityMeta(nom, estEcriture);
    const entrees = contratDepuisSchema(t.input_schema);
    fiches.push(composerFiche({
      id: nom,
      domaine: m.domain,
      primitive: m.primitive,
      resume: t.label ? `${t.label}. ${t.description}` : t.description,
      effet: m.effect,
      rejouable: m.idempotent,
      groupable: m.batchable,
      confirmation: m.confirmation,
      latence: m.latency,
      contrat: m.contrat,
      declaree: m.declared,
      entrees: entrees?.champs ?? null,
      mesures: mesures.get(nom) ?? null,
      autorisee: autorisees.has(nom),
    }));
  }
  return fiches;
}

/** INTERROGER LE REGISTRE POUR UNE PERSONNE — la question posée pendant une mission. */
export async function interrogerRegistre(user: CurrentUser, q: Requete): Promise<ReturnType<typeof interroger>> {
  return interroger(await fichesDe(user), q);
}

/** LA FICHE D'UNE CAPACITÉ — composée à la demande, mesures comprises. */
export async function ficheDe(user: CurrentUser, capacite: string): Promise<FicheCapacite | null> {
  const fiches = await fichesDe(user, { seulement: [capacite] });
  return fiches[0] ?? null;
}

/** L'ÉTAT DU REGISTRE — combien de capacités, et surtout combien n'ont jamais été mesurées. */
export async function sommaireDe(user: CurrentUser): Promise<ReturnType<typeof sommaireRegistre>> {
  return sommaireRegistre(await fichesDe(user));
}

/**
 * LE MANQUE DÉTECTÉ AVANT DE TENTER — « rien ne sait faire ça » se sait sans échouer d'abord.
 */
export async function manquePour(user: CurrentUser, besoin: string, q: Requete = {}): Promise<Manque | null> {
  return detecterManque(besoin, await fichesDe(user), { autoriseeSeulement: true, ...q });
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA FEUILLE DE ROUTE — une LECTURE du journal des missions, jamais une table de plus.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Les événements où un manque peut se lire. `STEP_FAILED` porte le classement dans son détail. */
const KINDS_ECHEC = ["STEP_FAILED", "CAPABILITY_GAP"];
export const EVENEMENTS_LUS_MAX = 5_000;

interface DetailEchec { manque?: unknown; stepKey?: unknown; errorKind?: unknown }

/**
 * LES MANQUES OBSERVÉS. Le classement a normalement été fait au moment de l'échec et vit dans
 * `detail.manque` ; pour les événements ANTÉRIEURS à ce mécanisme, on reclasse à la lecture, à
 * partir du résumé — ce qui évite de perdre l'historique sans jamais réécrire le journal.
 */
export async function manquesObserves(opts: { depuis?: Date; limite?: number } = {}): Promise<(Manque & { quand: string })[]> {
  const depuis = opts.depuis ?? new Date(Date.now() - FENETRE_MESURE_JOURS * 86_400_000);
  const events = await prisma.missionEvent.findMany({
    where: { kind: { in: KINDS_ECHEC }, at: { gte: depuis } },
    select: { kind: true, summary: true, detail: true, at: true },
    orderBy: { at: "desc" },
    take: Math.min(opts.limite ?? EVENEMENTS_LUS_MAX, EVENEMENTS_LUS_MAX),
  });

  const out: (Manque & { quand: string })[] = [];
  for (const e of events) {
    const d = (e.detail ?? {}) as DetailEchec;
    const dejaClasse = d.manque as Manque | undefined;
    if (dejaClasse && typeof dejaClasse === "object" && typeof dejaClasse.nature === "string") {
      out.push({ ...dejaClasse, quand: e.at.toISOString() });
      continue;
    }
    // Le résumé a la forme « Étape « X » en échec : MESSAGE ». On reprend le message seul :
    // classer le libellé de l'étape rangerait la moitié des échecs sur le mot du titre.
    const message = e.summary.includes(" en échec : ") ? e.summary.split(" en échec : ").slice(1).join(" en échec : ") : e.summary;
    const ou = typeof d.stepKey === "string" ? d.stepKey : null;
    out.push({ ...classer(message, { etape: ou }), quand: e.at.toISOString() });
  }
  return out;
}

/** LA FEUILLE DE ROUTE TECHNIQUE — ce que les échecs réels réclament, classé par fréquence. */
export async function feuilleDeRouteErp(opts: { depuis?: Date; limite?: number } = {}): Promise<ReturnType<typeof feuilleDeRoute>> {
  return feuilleDeRoute(await manquesObserves(opts));
}
