/**
 * OÙ PASSE LE TEMPS D'UN TÉLÉVERSEMENT.
 *
 * « C'est lent » ne se corrige pas : on optimise au hasard, on livre, et c'est toujours lent. Il
 * faut savoir QUELLE étape coûte — recevoir les octets, les chiffrer, les pousser vers le bucket,
 * écrire la ligne en base — et le savoir depuis la production, pas depuis une machine de
 * développement où tout est local.
 *
 * Chaque envoi rapporte donc son propre découpage. Il part dans la réponse (l'écran peut le
 * montrer quand un envoi traîne) et dans le journal du serveur.
 *
 * Module PUR — testé.
 */

export interface Phase { name: string; ms: number }

export interface UploadTiming {
  phases: Phase[];
  totalMs: number;
  /** Où les octets ont réellement été écrits — la réponse la plus utile de toutes. */
  backend: "objet" | "base";
  bytes: number;
  /** Débit observé, en Mo/s — comparable d'un envoi à l'autre. */
  throughputMbs: number;
}

/** Chronomètre à étapes. `mark` clôt l'étape en cours et en ouvre une nouvelle. */
export function startTimer(now: () => number = () => Date.now()) {
  const t0 = now();
  let last = t0;
  const phases: Phase[] = [];
  return {
    mark(name: string) {
      const t = now();
      phases.push({ name, ms: t - last });
      last = t;
    },
    done(backend: "objet" | "base", bytes: number): UploadTiming {
      const totalMs = now() - t0;
      return {
        phases,
        totalMs,
        backend,
        bytes,
        // Un envoi instantané (contenu dédupliqué) ne doit pas rendre un débit infini.
        throughputMbs: totalMs > 0 ? Number(((bytes / 1048576) / (totalMs / 1000)).toFixed(2)) : 0,
      };
    },
  };
}

/**
 * Le découpage en une ligne lisible — celle qu'on colle dans un message.
 *
 * Les étapes sont triées de la plus COÛTEUSE à la plus légère : dans un diagnostic, la première
 * ligne doit déjà donner la réponse.
 */
export function formatTiming(t: UploadTiming): string {
  const top = [...t.phases].sort((a, b) => b.ms - a.ms).map((p) => `${p.name} ${p.ms} ms`);
  const mo = (t.bytes / 1048576).toFixed(1);
  return `${mo} Mo en ${t.totalMs} ms (${t.throughputMbs} Mo/s, stockage ${t.backend}) — ${top.join(" · ")}`;
}

/** L'étape la plus coûteuse — celle qu'il faut nommer quand on explique la lenteur. */
export function slowestPhase(t: UploadTiming): Phase | null {
  return t.phases.reduce<Phase | null>((worst, p) => (!worst || p.ms > worst.ms ? p : worst), null);
}
