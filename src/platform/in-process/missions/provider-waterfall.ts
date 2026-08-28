/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA CASCADE — où passent réellement les quatre-vingt-trois secondes.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────────────────
 *
 * Le premier run réel sur Render a rendu : 29 399 ms de planification, 83 504 ms au total. Le
 * second chiffre est le seul qui compte pour la personne qui attend, et cinquante-quatre
 * secondes n'étaient imputées à rien. Optimiser sans les avoir attribuées reviendrait à
 * deviner : on raccourcirait le morceau visible et l'on découvrirait ensuite qu'il pesait un
 * cinquième du total.
 *
 * ── LE RAISONNEUR INSTRUMENTÉ N'EST PAS UN SUBSTITUT ─────────────────────────────────────
 *
 * `RaisonneurInstrumente` DÉLÈGUE chaque appel au raisonneur de production, sans rien changer :
 * même modèle, même effort, même schéma, même réponse. Il note ce qui entre et ce qui sort.
 *
 * La distinction est capitale pour l'honnêteté du diagnostic : un mock REMPLACE et invalide la
 * preuve fournisseur ; un décorateur OBSERVE et la laisse intacte. C'est pour cela qu'il expose
 * `configured()` en le déléguant lui aussi — s'il répondait « oui » de lui-même, il aurait
 * commencé à mentir.
 *
 * ── CE QUE LA CASCADE SÉPARE ─────────────────────────────────────────────────────────────
 *
 * Chaque appel de modèle porte son `purpose`, qui vient du runtime lui-même : `mission.plan`,
 * `mission.worker`, `mission.judge`… C'est la ligne de partage réelle entre planification,
 * exécution des étapes de réflexion et jugement d'objectif. On ne la reconstruit pas, on la lit.
 *
 * Le reste — étapes de capacité, contrôle qualité, recours — vient du JOURNAL de la mission
 * (`MissionEvent`), qui horodate déjà tout. §17 : pas de second registre.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { prisma } from "@/lib/prisma";
import type { Reasoner, ReasonRequest, ReasonResult } from "@/lib/missions/ports";

export interface AppelModele {
  /** L'ordre d'émission — c'est lui qui montre les appels séquentiels. */
  seq: number;
  purpose: string;
  role: string;
  schemaName: string;
  /** Le poids du schéma IMPOSÉ au fournisseur, en caractères JSON. Un coût, pas un détail. */
  schemaChars: number;
  promptChars: number;
  systemChars: number;
  debutMs: number;
  finMs: number;
  latenceMs: number;
  modele: string | null;
  jetonsEntree: number | null;
  jetonsSortie: number | null;
  ok: boolean;
  erreur: string | null;
}

/**
 * LE DÉCORATEUR. Tout passe au vrai raisonneur ; rien n'est simulé, rien n'est raccourci.
 */
export class RaisonneurInstrumente implements Reasoner {
  readonly appels: AppelModele[] = [];
  private seq = 0;

  constructor(private readonly reel: Reasoner, private readonly t0: number) {}

  configured(): boolean {
    return this.reel.configured();
  }

  async reason<T>(req: ReasonRequest): Promise<ReasonResult<T>> {
    const seq = ++this.seq;
    const debut = Date.now();
    const r = await this.reel.reason<T>(req);
    const fin = Date.now();
    this.appels.push({
      seq,
      purpose: req.purpose,
      role: req.role,
      schemaName: req.schemaName,
      schemaChars: JSON.stringify(req.schema ?? {}).length,
      promptChars: (req.prompt ?? "").length,
      systemChars: (req.system ?? "").length,
      debutMs: debut - this.t0,
      finMs: fin - this.t0,
      latenceMs: r.latencyMs ?? fin - debut,
      modele: r.usage?.model ?? null,
      jetonsEntree: r.usage?.inputTokens ?? null,
      jetonsSortie: r.usage?.outputTokens ?? null,
      ok: r.ok,
      erreur: r.ok ? null : r.error ?? "échec",
    });
    return r;
  }

  /** Le temps réellement passé À ATTENDRE UN MODÈLE, appels chevauchants comptés une fois. */
  tempsModeleMs(): number {
    const seg = this.appels.map((a) => [a.debutMs, a.finMs] as const).sort((x, y) => x[0] - y[0]);
    let total = 0;
    let curDebut = -1;
    let curFin = -1;
    for (const [d, f] of seg) {
      if (d > curFin) { if (curFin > curDebut) total += curFin - curDebut; curDebut = d; curFin = f; }
      else curFin = Math.max(curFin, f);
    }
    if (curFin > curDebut) total += curFin - curDebut;
    return total;
  }

  /** Vrai quand deux appels se chevauchent — donc que du parallélisme a réellement eu lieu. */
  aDuParallelisme(): boolean {
    const tries = [...this.appels].sort((a, b) => a.debutMs - b.debutMs);
    return tries.some((a, i) => i > 0 && a.debutMs < tries[i - 1].finMs);
  }
}

export interface Phase {
  nom: string;
  debutMs: number;
  finMs: number;
  dureeMs: number;
  detail: string;
}

export interface Cascade {
  totalMs: number;
  phases: Phase[];
  appels: AppelModele[];
  /** Temps passé à attendre un modèle, chevauchements dédupliqués. */
  tempsModeleMs: number;
  /** Le reste : base, outils, sérialisation, moteur. C'est ce qui n'était imputé à rien. */
  tempsHorsModeleMs: number;
  parallelisme: boolean;
  /** Les appels dont la réponse n'a pas servi (échec, ou plan jeté à la reprise). */
  appelsSansEffet: number;
  catalogue: {
    ouvertes: number;
    montreesAuPlanner: number | null;
    /** Le coût en caractères des résumés RÉELLEMENT envoyés au planner. */
    resumeChars: number | null;
    /** Combien de capacités le plan compilé utilise VRAIMENT. */
    utilisees: number;
    /** Celles exposées et jamais retenues — le gras du catalogue pour CETTE mission. */
    exposeesInutiles: number | null;
  };
}

/**
 * RECONSTRUIT LA CASCADE depuis le journal de la mission et les appels observés.
 *
 * Le journal fait foi pour les phases du moteur : il est écrit par le runtime lui-même, au
 * moment où les choses arrivent. Le reconstruire par soustraction depuis les totaux donnerait
 * des durées plausibles et fausses.
 */
export async function cascade(
  missionId: string | null,
  instrument: RaisonneurInstrumente,
  t0: number,
  finMs: number,
  catalogue: Cascade["catalogue"],
): Promise<Cascade> {
  const phases: Phase[] = [];

  if (missionId) {
    const evts = await prisma.missionEvent.findMany({
      where: { missionId },
      select: { kind: true, summary: true, at: true },
      orderBy: { at: "asc" },
    }).catch(() => []);

    // Chaque événement ouvre une phase qui se ferme au suivant. C'est grossier pour un événement
    // isolé, et exact pour une suite — or c'est bien une SUITE qu'on cherche à expliquer.
    for (const [i, e] of evts.entries()) {
      const debut = e.at.getTime() - t0;
      const fin = i + 1 < evts.length ? evts[i + 1].at.getTime() - t0 : finMs;
      phases.push({
        nom: e.kind,
        debutMs: debut,
        finMs: fin,
        dureeMs: Math.max(0, fin - debut),
        detail: e.summary.slice(0, 120),
      });
    }

    // Les étapes portent leur propre horodatage de départ : c'est la seule façon de distinguer
    // une étape lente d'une étape qui a attendu son tour dans la file.
    const steps = await prisma.missionStep.findMany({
      where: { missionId },
      select: { key: true, nodeType: true, capability: true, status: true, startedAt: true, attempt: true },
      orderBy: { startedAt: "asc" },
    }).catch(() => []);
    for (const s of steps) {
      if (!s.startedAt) continue;
      phases.push({
        nom: `step:${s.nodeType}`,
        debutMs: s.startedAt.getTime() - t0,
        finMs: s.startedAt.getTime() - t0,
        dureeMs: 0, // le moteur n'horodate pas la FIN d'étape ; on le dit plutôt que de l'inventer
        detail: `${s.key} · ${s.capability ?? s.nodeType} · ${s.status}${s.attempt > 1 ? ` · essai ${s.attempt}` : ""}`,
      });
    }
  }

  const modele = instrument.tempsModeleMs();
  return {
    totalMs: finMs,
    phases: phases.sort((a, b) => a.debutMs - b.debutMs),
    appels: instrument.appels,
    tempsModeleMs: modele,
    tempsHorsModeleMs: Math.max(0, finMs - modele),
    parallelisme: instrument.aDuParallelisme(),
    appelsSansEffet: instrument.appels.filter((a) => !a.ok).length,
    catalogue,
  };
}

/** La cascade, rendue pour un humain qui cherche où sont passées les secondes. */
export function rendreCascade(c: Cascade): string[] {
  const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n}ms`);
  const barre = (d: number) => "█".repeat(Math.max(0, Math.min(40, Math.round((d / Math.max(1, c.totalMs)) * 40))));

  return [
    "── CASCADE ─────────────────────────────────────────────",
    `  total                        ${ms(c.totalMs)}`,
    `  dont attente modèle          ${ms(c.tempsModeleMs)} (${((c.tempsModeleMs / Math.max(1, c.totalMs)) * 100).toFixed(0)} %)`,
    `  dont hors modèle (base/outils/moteur)  ${ms(c.tempsHorsModeleMs)} (${((c.tempsHorsModeleMs / Math.max(1, c.totalMs)) * 100).toFixed(0)} %)`,
    `  parallélisme entre appels    ${c.parallelisme ? "OUI" : "NON — tous séquentiels"}`,
    `  appels sans effet            ${c.appelsSansEffet}`,
    "",
    "  APPELS DE MODÈLE (ordre d'émission)",
    "  seq  purpose                  rôle              début      durée    jetons e/s   schéma",
    ...c.appels.map((a) => "  " + [
      String(a.seq).padEnd(4),
      a.purpose.slice(0, 24).padEnd(25),
      a.role.slice(0, 17).padEnd(18),
      ms(a.debutMs).padStart(8),
      ms(a.latenceMs).padStart(8),
      `${a.jetonsEntree ?? "—"}/${a.jetonsSortie ?? "—"}`.padStart(12),
      String(a.schemaChars).padStart(8),
    ].join(" ")),
    "",
    "  PHASES DU MOTEUR (journal de mission)",
    ...c.phases.map((p) => `  ${ms(p.debutMs).padStart(8)}  ${p.nom.padEnd(18)} ${barre(p.dureeMs)} ${ms(p.dureeMs).padStart(8)}  ${p.detail}`),
    "",
    "  CATALOGUE DE CAPACITÉS",
    `    ouvertes (plafond lecture) ${c.catalogue.ouvertes}`,
    `    montrées au planner        ${c.catalogue.montreesAuPlanner ?? "—"}`,
    `    poids des résumés envoyés  ${c.catalogue.resumeChars !== null ? `${c.catalogue.resumeChars} caractères` : "—"}`,
    `    réellement utilisées       ${c.catalogue.utilisees}`,
    `    exposées et non retenues   ${c.catalogue.exposeesInutiles ?? "—"}`,
  ];
}
