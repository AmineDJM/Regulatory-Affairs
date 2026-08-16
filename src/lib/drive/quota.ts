/**
 * LES QUOTAS DU DRIVE, SANS PAYER UN BALAYAGE COMPLET À CHAQUE FICHIER.
 *
 * Le contrôle de capacité globale demandait la somme des tailles de TOUS les blobs — une agrégation
 * sans filtre, donc un parcours de toute la table — **à chaque téléversement**. Six fichiers en
 * parallèle, c'étaient six parcours simultanés avant que le premier octet ne soit écrit. La
 * personne, elle, voit « le téléversement est lent » sans que rien ne l'explique à l'écran.
 *
 * Deux idées :
 *   • la capacité globale se mesure en téra-octets et bouge lentement — la relire toutes les
 *     30 secondes suffit largement pour un garde-fou ;
 *   • entre deux lectures, on AJOUTE ce qu'on vient d'écrire. Le compte reste juste pendant une
 *     rafale, au lieu de dériver jusqu'à la prochaine relecture.
 *
 * Le quota PAR PERSONNE, lui, n'est pas mis en cache : c'est celui qui refuse un envoi, et refuser
 * à tort (ou accepter à tort) sur une valeur périmée serait incompréhensible pour l'utilisateur.
 * Il porte un index, il est bon marché.
 *
 * Partie décisionnelle PURE — testée.
 */

export const GB = 1024 ** 3;

export type QuotaVerdict = { ok: true } | { ok: false; error: string };

/**
 * Ce fichier peut-il être écrit ? Deux plafonds : celui de la personne, puis celui de la machine.
 * L'ordre compte — « votre quota est atteint » est actionnable, « la capacité globale est atteinte »
 * ne l'est que par l'administrateur.
 */
export function quotaVerdict(o: {
  userUsageBytes: number;
  physicalUsageBytes: number;
  fileSize: number;
  userQuotaGb: number;
  capacityGb: number;
}): QuotaVerdict {
  if (o.userUsageBytes + o.fileSize > o.userQuotaGb * GB) {
    return {
      ok: false,
      error: `Quota Drive dépassé (${o.userQuotaGb} Go par utilisateur). Libérez de l'espace ou demandez une augmentation au Super Admin.`,
    };
  }
  if (o.physicalUsageBytes + o.fileSize > o.capacityGb * GB) {
    return { ok: false, error: "Capacité globale du Drive atteinte. Contactez le Super Admin." };
  }
  return { ok: true };
}

/**
 * Une valeur coûteuse à calculer, gardée quelques secondes, et corrigeable entre deux lectures.
 *
 * L'horloge et le chargeur sont injectés : la fraîcheur se vérifie sans attendre trente secondes
 * dans un test, et sans base de données.
 */
export interface TtlCache<T> {
  get(): Promise<T>;
  /** Corrige la valeur en mémoire sans relire la source (ex. ajouter les octets qu'on vient d'écrire). */
  patch(fn: (current: T) => T): void;
  /** Oublie la valeur : la prochaine lecture ira à la source. */
  invalidate(): void;
}

export function makeTtlCache<T>(
  load: () => Promise<T>,
  ttlMs: number,
  clock: () => number = Date.now,
): TtlCache<T> {
  let value: { at: number; data: T } | null = null;
  let inFlight: Promise<T> | null = null;

  return {
    async get(): Promise<T> {
      const now = clock();
      if (value && now - value.at < ttlMs) return value.data;
      // Une seule lecture en vol : dix envois simultanés sur un cache froid ne doivent pas
      // déclencher dix parcours de table — c'est justement la situation qu'on veut supprimer.
      if (!inFlight) {
        inFlight = load().then(
          (data) => { value = { at: clock(), data }; inFlight = null; return data; },
          (err) => { inFlight = null; throw err; },
        );
      }
      return inFlight;
    },
    patch(fn) {
      if (value) value = { at: value.at, data: fn(value.data) };
    },
    invalidate() {
      value = null;
    },
  };
}
