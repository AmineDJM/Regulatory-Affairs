/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PORTE DE CONCURRENCE — combien d'appels de modèle EN MÊME TEMPS, décidé par les FAITS.
 *
 * ── POURQUOI UNE PORTE, ET POURQUOI ADAPTATIVE ───────────────────────────────────────────
 *
 * Une mission massive déploie des dizaines de workers ; chacun appelle un modèle. Sans porte,
 * le parallélisme est décidé par le code appelant — c'est-à-dire par personne : trente étapes
 * prêtes font trente requêtes simultanées, le fournisseur rend 429, et chaque 429 est un appel
 * PAYÉ en latence qui n'a rien produit. Une limite FIXE n'est pas mieux : trop basse elle bride
 * les jours calmes, trop haute elle ne protège pas les jours chargés — et la bonne valeur
 * change avec le palier de facturation du compte.
 *
 * La porte s'adapte donc sur ce que le fournisseur DIT :
 *   • les en-têtes `x-ratelimit-remaining-*` — le solde réel, requêtes ET jetons ;
 *   • `Retry-After` sur un 429 — l'ordre explicite d'attendre ;
 *   • et la santé LOCALE (retard de boucle d'événements) — un nœud saturé qui continue
 *     d'admettre des appels ne les sert plus, il les fait juste attendre à l'intérieur.
 *
 * AIMD, comme TCP : un 429 DIVISE la capacité (le fournisseur a parlé), une série de succès
 * l'AUGMENTE d'un cran (prudence dans la reprise). C'est l'algorithme le plus éprouvé du monde
 * pour ce problème exact, et il tient en trente lignes.
 *
 * ── LA RÉSERVATION DE JETONS (§61) ───────────────────────────────────────────────────────
 *
 * Le plafond du fournisseur porte AUSSI sur les jetons par minute. Trente appels « sous la
 * limite de requêtes » peuvent la crever ensemble. Chaque admission RÉSERVE donc son estimation
 * (entrée estimée + plafond de sortie) contre la fenêtre observée ; la libération rend la
 * réservation. Quand la fenêtre ne suffit plus, l'admission ATTEND le reset annoncé plutôt que
 * d'aller cueillir le 429.
 *
 * ── CE QUE CE MODULE N'EST PAS ───────────────────────────────────────────────────────────
 *
 * Pas un ordonnanceur (le scheduler existe, §39), pas une file de priorité, pas un budget de
 * coût (les plafonds de mission vivent dans le runtime). C'est un ROBINET, au seul endroit par
 * où tous les appels passent déjà : la passerelle. Aucun minuteur d'entretien — le module ne
 * fait rien tant que personne n'appelle.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const env = (k: string): string => (process.env[k] ?? "").trim();

const entier = (k: string, defaut: number, min: number, max: number): number => {
  const n = Number(env(k));
  return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : defaut;
};

/** Le plafond CONFIGURÉ — la capacité AIMD ne le dépasse jamais. */
function plafondConfigure(): number {
  return entier("ADAM_MODEL_CONCURRENCY", 8, 1, 64);
}

/**
 * « 6m0s », « 1s », « 250ms », « 12.5s » → millisecondes. Le vocabulaire des en-têtes
 * `x-ratelimit-reset-*` d'OpenAI. Rend `null` sur tout ce qui ne se lit pas À COUP SÛR —
 * un délai deviné est pire qu'un délai absent.
 */
export function lireDuree(brut: string | null | undefined): number | null {
  const s = (brut ?? "").trim().toLowerCase();
  if (!s) return null;
  // Un nombre nu est des SECONDES (forme de `Retry-After`).
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000);
  let total = 0;
  let lu = false;
  const re = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    lu = true;
    const n = Number(m[1]);
    total += m[2] === "ms" ? n : m[2] === "s" ? n * 1000 : m[2] === "m" ? n * 60_000 : n * 3_600_000;
  }
  return lu ? Math.round(total) : null;
}

interface Fenetre {
  restant: number | null;
  limite: number | null;
  /** L'instant où le fournisseur annonce le retour à plein — au-delà, la fenêtre est périmée. */
  resetA: number | null;
}

interface EtatPorte {
  capacite: number;
  enVol: number;
  file: { resolve: () => void }[];
  pauseJusqua: number;
  requetes: Fenetre;
  jetons: Fenetre;
  jetonsReserves: number;
  succesDAffilee: number;
  /** La dernière mesure du retard de boucle d'événements, et quand elle a été prise. */
  lagMs: number;
  lagMesureA: number;
  // Compteurs d'observabilité — des faits, pas des impressions.
  attentes: number;
  refus429: number;
  retrecissements: number;
  attentesJetons: number;
  /**
   * LA COMPTABILITÉ DE LA RÉSERVATION (§61) ET DU COÛT (§17) — cumulée sur le processus.
   *
   * `estimes` est ce que la porte a provisionné, `reels` ce que le fournisseur a facturé
   * (entrée + sortie) : l'écart dit si l'estimation « 4 caractères par jeton + plafond de
   * sortie » est du bon ORDRE — la seule exigence qu'elle a. `caches` compte les jetons
   * d'entrée servis depuis le cache de prompt, `webSearch` les recherches web facturées.
   *
   * `coutUsd` est la somme des coûts EXACTS rendus par les adaptateurs ; dès qu'UN appel n'a
   * pas de tarif (`costUsd: null`), `appelsSansPrix` monte et le total doit être annoncé
   * INCONNU — jamais un total partiel présenté comme complet (§78).
   */
  conso: {
    appels: number; estimes: number; reels: number;
    entree: number; sortie: number; caches: number; webSearch: number;
    coutUsd: number; appelsSansPrix: number;
  };
  /**
   * LES DERNIERS EN-TÊTES OBSERVÉS du fournisseur — des NOMBRES et des durées, jamais un
   * contenu, jamais une clé. C'est la preuve « le contrôleur s'ajuste à de vraies valeurs »
   * qu'un rapport de run peut imprimer sans rien exposer.
   */
  observations: {
    a: number;
    limitRequests: number | null; remainingRequests: number | null; resetRequestsMs: number | null;
    limitTokens: number | null; remainingTokens: number | null; resetTokensMs: number | null;
    retryAfterMs: number | null;
  }[];
}

function neuf(): EtatPorte {
  return {
    capacite: plafondConfigure(),
    enVol: 0,
    file: [],
    pauseJusqua: 0,
    requetes: { restant: null, limite: null, resetA: null },
    jetons: { restant: null, limite: null, resetA: null },
    jetonsReserves: 0,
    succesDAffilee: 0,
    lagMs: 0,
    lagMesureA: 0,
    attentes: 0,
    refus429: 0,
    retrecissements: 0,
    attentesJetons: 0,
    conso: {
      appels: 0, estimes: 0, reels: 0,
      entree: 0, sortie: 0, caches: 0, webSearch: 0,
      coutUsd: 0, appelsSansPrix: 0,
    },
    observations: [],
  };
}

let etat = neuf();

/** Après combien de succès d'affilée la capacité regagne UN cran. */
const SUCCES_PAR_CRAN = 10;
/** Sous ce ratio de solde de requêtes, on retrécit AVANT le 429. */
const RATIO_ALERTE = 0.1;
/** Un retard de boucle au-delà de ce seuil dit « ce nœud est saturé » — on serre localement. */
const LAG_SEUIL_MS = 200;
/** Sonde de retard au plus toutes les N ms — jamais de minuteur permanent. */
const LAG_PERIODE_MS = 5_000;
/** Une attente en file ne dure jamais plus que ça : un verrou fuité ne gèle pas le produit. */
const ATTENTE_MAX_MS = 120_000;

function maintenant(): number {
  return Date.now();
}

/**
 * LA CAPACITÉ EFFECTIVE — l'AIMD, corrigé de la santé locale. Un nœud dont la boucle
 * d'événements a 200 ms de retard n'a rien à gagner à admettre huit appels : ils attendront
 * DEDANS au lieu d'attendre DEHORS, là où on les compte.
 */
function capaciteEffective(): number {
  return etat.lagMs > LAG_SEUIL_MS ? Math.min(etat.capacite, 2) : etat.capacite;
}

/** Mesure ponctuelle du retard de boucle — seulement quand on nous appelle, jamais en tâche de fond. */
function sonderLag(): void {
  const t = maintenant();
  if (t - etat.lagMesureA < LAG_PERIODE_MS) return;
  etat.lagMesureA = t;
  const t0 = maintenant();
  setTimeout(() => {
    etat.lagMs = Math.max(0, maintenant() - t0 - 1); // ~1 ms de plancher setTimeout
  }, 0);
}

function dormir(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** La prochaine place se donne — appelé à chaque libération. */
function servirLaFile(): void {
  while (etat.file.length > 0 && etat.enVol < capaciteEffective() && maintenant() >= etat.pauseJusqua) {
    const suivant = etat.file.shift();
    if (!suivant) break;
    etat.enVol++;
    suivant.resolve();
  }
}

/**
 * PREND UNE PLACE — et la RESERVATION de jetons qui va avec.
 *
 * Rend la fonction de libération ; l'appelant la tient dans un `finally`, sinon la place fuit.
 * L'attente couvre trois causes, dans l'ordre : la pause ordonnée (429/Retry-After), la
 * capacité, puis la fenêtre de jetons.
 */
export async function prendrePlace(estimationJetons = 0): Promise<() => void> {
  sonderLag();

  // 1) La pause ordonnée par le fournisseur se respecte AVANT tout.
  for (;;) {
    const reste = etat.pauseJusqua - maintenant();
    if (reste <= 0) break;
    await dormir(Math.min(reste, 5_000));
  }

  // 2) La place. FIFO strict : les étapes d'une mission ne se doublent pas entre elles.
  if (etat.enVol >= capaciteEffective() || etat.file.length > 0) {
    etat.attentes++;
    await new Promise<void>((resolve) => {
      const billet = { resolve };
      etat.file.push(billet);
      servirLaFile();
      // LE FILET : une place jamais rendue (bug d'appelant) ne gèle pas tout le produit.
      // On force le passage après ATTENTE_MAX et on le DIT — un gel silencieux est pire.
      setTimeout(() => {
        const i = etat.file.indexOf(billet);
        if (i >= 0) {
          etat.file.splice(i, 1);
          etat.enVol++;
          console.warn("[models] porte de concurrence : attente maximale atteinte, passage forcé (place probablement fuitée en amont)");
          resolve();
        }
      }, ATTENTE_MAX_MS).unref?.();
    });
  } else {
    etat.enVol++;
  }

  // 3) La fenêtre de jetons (§61). On ne réserve que si le fournisseur nous a DIT son solde :
  // sans fenêtre observée, réserver serait de l'invention.
  if (estimationJetons > 0 && etat.jetons.restant != null) {
    const resetA = etat.jetons.resetA;
    if (etat.jetonsReserves + estimationJetons > etat.jetons.restant && resetA != null && resetA > maintenant()) {
      etat.attentesJetons++;
      await dormir(Math.min(resetA - maintenant(), 60_000));
      // Au reset annoncé, la fenêtre est périmée : on repart sur « inconnu » jusqu'aux
      // prochains en-têtes, plutôt que de raisonner sur un solde d'avant.
      etat.jetons = { restant: null, limite: null, resetA: null };
    }
    etat.jetonsReserves += estimationJetons;
  } else {
    estimationJetons = 0;
  }

  let rendu = false;
  return () => {
    if (rendu) return; // idempotent : un double release ne crée pas de place fantôme
    rendu = true;
    etat.enVol = Math.max(0, etat.enVol - 1);
    etat.jetonsReserves = Math.max(0, etat.jetonsReserves - estimationJetons);
    servirLaFile();
  };
}

/**
 * LES EN-TÊTES D'UNE RÉPONSE — le fournisseur dit son solde, on l'écoute.
 *
 * Accepte un `Headers` ou un objet nu (les tests n'ont pas à fabriquer des réponses HTTP).
 */
export function noterEnTetes(h: Headers | Record<string, string | null | undefined>): void {
  const lire = (nom: string): string | null => {
    if (typeof (h as Headers).get === "function") return (h as Headers).get(nom);
    const objet = h as Record<string, string | null | undefined>;
    return objet[nom] ?? objet[nom.toLowerCase()] ?? null;
  };
  const nombre = (nom: string): number | null => {
    const n = Number(lire(nom));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const t = maintenant();
  const reqRestant = nombre("x-ratelimit-remaining-requests");
  const reqLimite = nombre("x-ratelimit-limit-requests");
  const reqReset = lireDuree(lire("x-ratelimit-reset-requests"));
  if (reqRestant != null) {
    etat.requetes = { restant: reqRestant, limite: reqLimite, resetA: reqReset != null ? t + reqReset : etat.requetes.resetA };
    // LE RETRÉCISSEMENT PRÉVENTIF : sous 10 % de solde, on ne va pas cueillir le 429.
    if (reqLimite != null && reqLimite > 0 && reqRestant / reqLimite < RATIO_ALERTE && etat.capacite > 1) {
      etat.capacite = Math.max(1, Math.floor(etat.capacite / 2));
      etat.retrecissements++;
      etat.succesDAffilee = 0;
    }
  }

  const jetRestant = nombre("x-ratelimit-remaining-tokens");
  const jetLimite = nombre("x-ratelimit-limit-tokens");
  const jetReset = lireDuree(lire("x-ratelimit-reset-tokens"));
  if (jetRestant != null) {
    etat.jetons = { restant: jetRestant, limite: jetLimite, resetA: jetReset != null ? t + jetReset : etat.jetons.resetA };
  }

  // L'ÉCHANTILLON D'OBSERVATIONS — des nombres, pour que le rapport de run puisse PROUVER que
  // le contrôleur a lu de vraies valeurs fournisseur. Borné aux 20 dernières.
  if (reqRestant != null || jetRestant != null) {
    etat.observations.push({
      a: t,
      limitRequests: reqLimite, remainingRequests: reqRestant, resetRequestsMs: reqReset,
      limitTokens: jetLimite, remainingTokens: jetRestant, resetTokensMs: jetReset,
      retryAfterMs: lireDuree(lire("retry-after")),
    });
    if (etat.observations.length > 20) etat.observations.shift();
  }
}

/**
 * UN 429 — l'ordre d'attendre. La capacité se DIVISE (AIMD), et la pause vaut ce que le
 * fournisseur demande (`Retry-After`, ou le reset des requêtes), jamais moins de deux secondes.
 */
export function noter429(retryAfter: string | null | undefined, resetRequetes?: string | null): void {
  etat.refus429++;
  etat.succesDAffilee = 0;
  etat.capacite = Math.max(1, Math.floor(etat.capacite / 2));
  const demande = lireDuree(retryAfter) ?? lireDuree(resetRequetes) ?? 2_000;
  etat.pauseJusqua = Math.max(etat.pauseJusqua, maintenant() + Math.max(2_000, demande));
}

/**
 * LA CONSOMMATION RÉELLE D'UN APPEL, face à son estimation (§61). Poussée par la passerelle
 * après chaque réponse : c'est ce qui rend l'écart estimation/réalité, le cache, les
 * recherches web et le COÛT du run imprimables au rapport — mesurés, jamais estimés.
 */
export function noterConsommation(
  estimes: number,
  usage: {
    inputTokens: number; outputTokens: number; cachedInputTokens?: number;
    costUsd?: number | null; webSearchCalls?: number;
  },
): void {
  const entree = Math.max(0, Math.round(usage.inputTokens));
  const sortie = Math.max(0, Math.round(usage.outputTokens));
  etat.conso.appels += 1;
  etat.conso.estimes += Math.max(0, Math.round(estimes));
  etat.conso.reels += entree + sortie;
  etat.conso.entree += entree;
  etat.conso.sortie += sortie;
  etat.conso.caches += Math.max(0, Math.round(usage.cachedInputTokens ?? 0));
  etat.conso.webSearch += Math.max(0, Math.round(usage.webSearchCalls ?? 0));
  // LE COÛT EST EXACT OU INCONNU (§78) : un appel sans tarif ne met pas zéro dans la somme —
  // il rend le TOTAL inannonçable, et `appelsSansPrix` dit pourquoi.
  if (usage.costUsd == null) etat.conso.appelsSansPrix += 1;
  else etat.conso.coutUsd += usage.costUsd;
}

/** Un succès. Dix d'affilée regagnent UN cran de capacité — l'additif de l'AIMD. */
export function noterSucces(): void {
  etat.succesDAffilee++;
  if (etat.succesDAffilee >= SUCCES_PAR_CRAN && etat.capacite < plafondConfigure()) {
    etat.capacite++;
    etat.succesDAffilee = 0;
  }
}

/** L'état de la porte — pour l'observabilité et les tests. Des nombres, jamais du contenu. */
export function etatPorte(): {
  capacite: number;
  capaciteEffective: number;
  enVol: number;
  enFile: number;
  pauseMs: number;
  requetesRestantes: number | null;
  jetonsRestants: number | null;
  jetonsReserves: number;
  lagMs: number;
  attentes: number;
  refus429: number;
  retrecissements: number;
  attentesJetons: number;
  conso: EtatPorte["conso"];
  observations: EtatPorte["observations"];
} {
  return {
    capacite: etat.capacite,
    capaciteEffective: capaciteEffective(),
    enVol: etat.enVol,
    enFile: etat.file.length,
    pauseMs: Math.max(0, etat.pauseJusqua - maintenant()),
    requetesRestantes: etat.requetes.restant,
    jetonsRestants: etat.jetons.restant,
    jetonsReserves: etat.jetonsReserves,
    lagMs: etat.lagMs,
    attentes: etat.attentes,
    refus429: etat.refus429,
    retrecissements: etat.retrecissements,
    attentesJetons: etat.attentesJetons,
    conso: { ...etat.conso },
    observations: [...etat.observations],
  };
}

/** Les tests repartent d'un état neuf — la porte est un singleton de processus. */
export function reinitialiserPorte(): void {
  for (const w of etat.file) w.resolve(); // ne jamais laisser une promesse pendante
  etat = neuf();
}

/**
 * L'ESTIMATION DE JETONS D'UN APPEL — grossière et ASSUMÉE comme telle.
 *
 * Quatre caractères par jeton est l'ordre de grandeur des tokenizers GPT sur du texte mêlé
 * français/anglais. La réservation n'a pas besoin d'être juste au jeton : elle a besoin d'être
 * du BON ORDRE pour que trente appels ne crèvent pas ensemble une fenêtre qui n'en logeait que
 * dix. La sortie est comptée au PLAFOND envoyé — c'est ce que le fournisseur provisionne.
 */
export function estimerJetons(caracteresEntree: number, plafondSortie: number | null | undefined): number {
  return Math.ceil(caracteresEntree / 4) + Math.max(0, plafondSortie ?? 0);
}
