/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE PANNE TEMPORAIRE N'EST PAS UN ÉCHEC — module PUR, zéro import.
 *
 * ── LE DÉFAUT QU'IL FERME ────────────────────────────────────────────────────────────────
 *
 * La file comptait chaque exception comme un essai, et au quatrième elle envoyait le travail en
 * BOÎTE MORTE. Or la cause la plus fréquente d'un échec d'enrichissement n'est pas le document :
 * c'est le FOURNISSEUR — clé absente, interrupteur général coupé, limite de débit, réseau. Quatre
 * essais à 30 s, 1 min, 2 min d'intervalle, et une coupure de cinq minutes suffisait à condamner
 * TOUS les travaux en cours. Pire : la mort d'un travail faisait passer le DOCUMENT en échec,
 * c'est-à-dire qu'une vectorisation ratée retirait des « retrouvables » un fichier qu'on trouvait
 * parfaitement par son texte.
 *
 * ── LA RÈGLE ─────────────────────────────────────────────────────────────────────────────
 *
 * Ce qui dépend de l'ENVIRONNEMENT (fournisseur, clé, interrupteur, réseau, base momentanément
 * injoignable) ATTEND : le travail repart en file sans consommer d'essai. Ce qui dépend du
 * DOCUMENT (format refusé, fichier absent du stockage, réponse inexploitable) compte ses essais et
 * finit en boîte morte — c'est là qu'un humain doit regarder.
 *
 * La lecture du motif est une liste FERMÉE de formes connues. Un motif inconnu n'est PAS
 * temporaire : le croire ferait tourner pour toujours un travail qui ne peut pas réussir, en
 * coûtant à chaque tour. L'erreur va dans le sens qui s'arrête.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce qu'un étage LÈVE quand il sait que la cause est dans l'environnement, pas dans le document. */
export class PanneTemporaire extends Error {
  readonly temporaire = true as const;
  constructor(message: string) {
    super(message);
    this.name = "PanneTemporaire";
  }
}

/** Les formes de motif qu'on sait temporaires. Chacune porte sa raison. */
const MOTIFS_TEMPORAIRES: readonly RegExp[] = [
  /interrupteur g[ée]n[ée]ral/i,                 // l'IA coupée depuis « Contrôle de l'IA »
  /non configur[ée]e?/i,                          // la clé du fournisseur absente
  /cl[ée] du fournisseur/i,
  /HTTP (401|403|408|409|425|429|5\d\d)\b/,       // clé refusée, délai, débit, panne du fournisseur
  /r[ée]seau|d[ée]lai d[ée]pass[ée]|timeout|timed out/i,
  /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up/i,
  /can't reach database|connection terminated|too many connections|fetching a new connection/i,
  /embeddings indisponibles|vectorisation indisponible/i, // l'ancien motif de l'étage `embed`
];

/** La cause est-elle dans l'environnement ? Une exception typée l'emporte sur la lecture du texte. */
export function estPanneTemporaire(err: unknown): boolean {
  if (err instanceof PanneTemporaire) return true;
  if (err && typeof err === "object" && (err as { temporaire?: unknown }).temporaire === true) return true;
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!msg) return false;
  return MOTIFS_TEMPORAIRES.some((re) => re.test(msg));
}

/** Combien de fois un travail peut ATTENDRE une panne temporaire avant qu'on la déclare persistante. */
export const REPORTS_MAX = 20;

/**
 * L'attente avant de retenter après une panne temporaire : 15 min, doublée, plafonnée à 6 h. Vingt
 * reports couvrent ainsi environ quatre jours de panne du fournisseur — au-delà, ce n'est plus une
 * panne passagère, et le travail rejoint la boîte morte avec un motif qui le DIT.
 */
export function delaiReportMs(reports: number): number {
  return Math.min(15 * 60_000 * 2 ** Math.max(0, reports), 6 * 60 * 60_000);
}
