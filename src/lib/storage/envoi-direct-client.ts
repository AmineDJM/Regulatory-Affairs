/**
 * ENVOI DIRECT, CÔTÉ NAVIGATEUR — les parties partent au bucket, plusieurs à la fois.
 *
 * Module SANS import : il est chargé par des composants client (Drive, dossier CTD). Il ne
 * connaît ni le serveur ni S3 : il reçoit un PLAN (une adresse signée par partie manquante) et
 * pousse les octets. Ce qui est déjà reçu par le bucket ne repart pas — c'est le plan qui le dit.
 *
 * Ce que la personne voit pendant ce temps : un pourcentage qui ne recule jamais, le DÉBIT réel
 * et le TEMPS RESTANT, et un bouton Annuler qui coupe pour de bon (les requêtes en vol sont
 * avortées, pas seulement oubliées).
 */

export interface PlanClient {
  taillePartie: number;
  nbParties: number;
  recues: number[];
  urls: Record<number, string>;
  enParallele: number;
}

export interface Progres {
  envoyes: number;
  total: number;
  /** Débit mesuré sur les dernières secondes, en octets/s (0 tant qu'on ne sait pas). */
  debit: number;
  /** Secondes restantes estimées, ou `null` tant que le débit n'est pas mesurable. */
  resteS: number | null;
}

export class EnvoiAnnule extends Error {
  constructor() { super("Envoi annulé."); }
}

/** Une partie refusée parce que son adresse a expiré (403) : le plan doit être renouvelé. */
export class AdresseExpiree extends Error {
  constructor(public numero: number) { super(`Adresse de la partie ${numero} expirée.`); }
}

type PutPartie = (url: string, corps: Blob, onCharge: (octets: number) => void, signal: AbortSignal) => Promise<void>;

/**
 * Mesure du débit sur une FENÊTRE GLISSANTE (8 s). Une moyenne depuis le début promettrait
 * « 3 min » pendant qu'une connexion qui vient de chuter n'en mettra plus que vingt. Pur — testé.
 */
export class Debitmetre {
  private echantillons: { t: number; octets: number }[] = [];
  constructor(private fenetreMs = 8000) {}
  noter(t: number, octetsCumules: number): void {
    this.echantillons.push({ t, octets: octetsCumules });
    while (this.echantillons.length > 2 && t - this.echantillons[0].t > this.fenetreMs) this.echantillons.shift();
  }
  debit(): number {
    if (this.echantillons.length < 2) return 0;
    const a = this.echantillons[0], b = this.echantillons[this.echantillons.length - 1];
    const dt = (b.t - a.t) / 1000;
    return dt >= 0.5 ? Math.max(0, (b.octets - a.octets) / dt) : 0;
  }
}

/** « 12,4 Mo/s » — pur. */
export function debitLisible(octetsS: number): string {
  if (octetsS <= 0) return "—";
  const mo = octetsS / (1024 * 1024);
  return mo >= 1 ? `${mo.toFixed(1).replace(".", ",")} Mo/s` : `${Math.round(octetsS / 1024)} Ko/s`;
}

/** « ~2 min 30 s restantes » — pur. */
export function resteLisible(s: number | null): string {
  if (s === null || !Number.isFinite(s)) return "estimation…";
  if (s < 5) return "quelques secondes";
  if (s < 60) return `~${Math.round(s)} s restantes`;
  if (s < 3600) {
    const m = Math.floor(s / 60), r = Math.round(s % 60);
    return `~${m} min${r ? ` ${r} s` : ""} restantes`;
  }
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return `~${h} h ${m} min restantes`;
}

const putParXhr: PutPartie = (url, corps, onCharge, signal) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = 30 * 60_000;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onCharge(e.loaded); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      if (xhr.status === 403) return reject(new AdresseExpiree(0));
      reject(new Error(`le stockage a répondu ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("réseau indisponible (ou règle CORS du bucket absente)"));
    xhr.ontimeout = () => reject(new Error("délai dépassé"));
    xhr.onabort = () => reject(new EnvoiAnnule());
    const couper = () => { try { xhr.abort(); } catch { /* déjà terminée */ } };
    if (signal.aborted) return couper();
    signal.addEventListener("abort", couper, { once: true });
    xhr.send(corps);
  });

const pause = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) return reject(new EnvoiAnnule());
  const t = setTimeout(resolve, ms);
  signal.addEventListener("abort", () => { clearTimeout(t); reject(new EnvoiAnnule()); }, { once: true });
});

/**
 * Envoie les parties MANQUANTES du plan. Chaque partie se retente (cinq fois, attente croissante) ;
 * une adresse expirée fait demander un plan neuf (`renouveler`) au lieu d'échouer. Lève
 * `EnvoiAnnule` si le signal est coupé.
 */
export async function envoyerParties(opts: {
  fichier: Blob;
  plan: PlanClient;
  signal: AbortSignal;
  onProgres: (p: Progres) => void;
  renouveler?: () => Promise<PlanClient>;
  putPartie?: PutPartie;
  maintenant?: () => number;
}): Promise<void> {
  const { fichier, signal, onProgres } = opts;
  const put = opts.putPartie ?? putParXhr;
  const now = opts.maintenant ?? (() => Date.now());
  let plan = opts.plan;
  const total = fichier.size;
  const taille = (n: number) => (n < plan.nbParties ? plan.taillePartie : total - plan.taillePartie * (plan.nbParties - 1));

  const charge = new Map<number, number>();
  for (const n of plan.recues) charge.set(n, taille(n));
  const metre = new Debitmetre();
  let affiche = 0;
  const signaler = () => {
    let s = 0;
    for (const v of charge.values()) s += v;
    // Monotone : une partie rejouée remet son compteur à zéro, la barre ne recule pas pour autant.
    if (s > affiche) affiche = s;
    metre.noter(now(), affiche);
    const debit = metre.debit();
    onProgres({ envoyes: affiche, total, debit, resteS: debit > 0 ? (total - affiche) / debit : null });
  };
  signaler();

  const file = Object.keys(plan.urls).map(Number).sort((a, b) => a - b);
  let curseur = 0;
  let renouvellement: Promise<PlanClient> | null = null;

  const envoyerUne = async (n: number): Promise<void> => {
    const corps = fichier.slice((n - 1) * plan.taillePartie, (n - 1) * plan.taillePartie + taille(n));
    let derniere = "";
    for (let essai = 0; essai < 5; essai++) {
      if (signal.aborted) throw new EnvoiAnnule();
      try {
        await put(plan.urls[n], corps, (o) => { charge.set(n, o); signaler(); }, signal);
        charge.set(n, corps.size);
        signaler();
        return;
      } catch (e) {
        if (e instanceof EnvoiAnnule || signal.aborted) throw new EnvoiAnnule();
        charge.set(n, 0);
        if (e instanceof AdresseExpiree && opts.renouveler) {
          renouvellement ??= opts.renouveler().finally(() => { renouvellement = null; });
          const neuf = await renouvellement;
          plan = { ...plan, urls: { ...plan.urls, ...neuf.urls } };
          continue;
        }
        derniere = e instanceof Error ? e.message : "échec";
        if (essai < 4) await pause(Math.min(500 * 2 ** essai, 16_000), signal);
      }
    }
    throw new Error(`Partie ${n}/${plan.nbParties} : ${derniere}.`);
  };

  // À la première erreur définitive, plus aucune partie NEUVE ne part ; celles en vol finissent
  // (ou sont coupées par l'annulation) avant qu'on rende l'erreur.
  let echec: unknown = null;
  const travailleur = async () => {
    while (!echec && curseur < file.length) {
      const n = file[curseur++];
      try { await envoyerUne(n); } catch (e) { echec ??= e; }
    }
  };
  const nb = Math.max(1, Math.min(plan.enParallele, file.length));
  await Promise.all(Array.from({ length: nb }, () => travailleur()));
  if (echec) throw echec;
}
