/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA GARDE DE SORTIE — rien ne quitte la maison pendant un test. Pas par convention : par
 * refus d'exécution.
 *
 * ── CE QUE ÇA EMPÊCHE, ET POURQUOI UNE CONSIGNE NE SUFFISAIT PAS ────────────────────────
 *
 * Adam sait envoyer un courriel, pousser une notification, écrire dans un agenda. Un banc qui
 * exerce ces chemins « pour de vrai » contacte des personnes réelles : Yacine reçoit une
 * relance qui n'existe pas, Regulatory reçoit un dossier qui n'est pas prêt. On ne rattrape pas
 * un courriel parti.
 *
 * La protection habituelle est une convention — « en test, on injecte un transport factice ».
 * Elle tient tant que personne n'oublie. Or l'oubli est exactement ce contre quoi on se
 * protège : un adaptateur remis à sa valeur de production le temps d'un débogage, un nouveau
 * canal branché sans relire la consigne, et l'envoi part. Une convention est une prière.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────────────────
 *
 * Chaque PRIMITIVE de sortie appelle `exigerSortieAutorisee` avant d'ouvrir quoi que ce soit.
 * En mode test, l'appel LÈVE. Le transport n'est jamais construit, la connexion jamais ouverte,
 * les identifiants jamais lus. Ce n'est pas un adaptateur qu'on remplace : c'est une porte qui
 * refuse, en amont du transport, quel que soit le transport.
 *
 * ── DEUX GARDES, ET LA SECONDE EST CELLE QUI DURE ───────────────────────────────────────
 *
 *   1. CELLE-CI, à l'exécution : elle refuse ici et maintenant.
 *   2. `garde.test.ts`, à la compilation morale : il remonte les imports et EXIGE que tout
 *      module atteignant un transport (`nodemailer`, `web-push`, l'API Graph, l'agenda Google)
 *      appelle cette garde. Brancher un nouveau canal sans elle fait TOMBER la suite — c'est
 *      ce qui rend la protection architecturale plutôt que disciplinaire.
 *
 * ── CE QUE LA GARDE N'EST PAS ───────────────────────────────────────────────────────────
 *
 * Ce n'est pas une politique d'envoi. `comms/policy.ts` décide si le PDG veut un brouillon,
 * une approbation ou un envoi direct — cela concerne la PRODUCTION et la volonté d'un humain.
 * La garde, elle, ne parle que du BANC : elle n'a aucun avis sur ce qui est permis en vrai, et
 * elle ne s'ouvre jamais « parce que la politique dit oui ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les gestes qui SORTENT — ceux dont on ne peut pas rappeler l'effet. */
export type ActeSortant =
  | "COURRIEL"
  | "NOTIFICATION_PUSH"
  | "INVITATION_AGENDA"
  | "ECRITURE_EXTERNE"
  | "PAIEMENT";

/** Ce qu'un envoi intercepté conserve — assez pour DIRE ce qui serait parti, à qui. */
export interface TentativeSortante {
  acte: ActeSortant;
  /** Le destinataire résolu : une adresse, un identifiant d'appareil, un calendrier. */
  cible: string;
  /** De quoi reconnaître le contenu sans le recopier en entier. */
  apercu?: string;
  /** L'origine, pour situer la tentative dans le banc. */
  origine?: string;
  quand: number;
}

/**
 * L'ERREUR LEVÉE. Un type nommé, pas un `Error` générique : un test qui l'attrape doit pouvoir
 * dire « c'est bien la garde qui a parlé » et non « quelque chose a échoué quelque part ».
 */
export class SortieInterdite extends Error {
  readonly acte: ActeSortant;
  readonly cible: string;
  constructor(t: TentativeSortante) {
    super(
      `SORTIE INTERDITE — ${t.acte} vers « ${t.cible} » bloqué : ce processus tourne en mode test. ` +
      `Adam aurait envoyé ceci${t.apercu ? ` : ${t.apercu}` : ""}. ` +
      `Aucun transport n'a été ouvert.`,
    );
    this.name = "SortieInterdite";
    this.acte = t.acte;
    this.cible = t.cible;
  }
}

/**
 * LES SIGNAUX DE MODE TEST — plusieurs, INDÉPENDANTS, et il suffit d'un.
 *
 * `NODE_ENV=test` et `VITEST` couvrent la suite unitaire. `PLAYWRIGHT` couvre le banc live, qui
 * démarre un vrai serveur : c'est LUI le cas dangereux, puisque tout y est vrai sauf
 * l'intention. `ADAM_SORTIE_INTERDITE` est le levier explicite, pour un environnement de
 * démonstration ou une reprise de banc.
 *
 * L'inverse — `ADAM_SORTIE_AUTORISEE=1` — existe pour un test qui veut vérifier que le chemin
 * de production FONCTIONNE (contre un serveur factice local, jamais contre l'extérieur). Il est
 * volontairement pénible à écrire, et `garde.test.ts` vérifie qu'aucun code de PRODUCTION ne le
 * pose : c'est une clé de test, pas une porte dérobée.
 */
export function sortiesInterdites(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ADAM_SORTIE_AUTORISEE === "1") return false;
  return (
    env.ADAM_SORTIE_INTERDITE === "1" ||
    env.NODE_ENV === "test" ||
    Boolean(env.VITEST) ||
    Boolean(env.PLAYWRIGHT) ||
    Boolean(env.PLAYWRIGHT_TEST_BASE_URL)
  );
}

/**
 * LE JOURNAL DES TENTATIVES — en mémoire, dans le processus qui tourne.
 *
 * Il n'est pas là pour l'audit (c'est `BusinessEvent` qui en tient le registre, §17) mais pour
 * que le banc puisse AFFIRMER quelque chose : « Adam aurait écrit à Regulatory, objet X, pièce
 * jointe Y ». Un test qui se contente de ne pas planter ne prouve pas qu'Adam avait préparé le
 * bon message.
 */
const tentatives: TentativeSortante[] = [];
/** Au-delà, on oublie les plus anciennes : un banc long ne doit pas gonfler indéfiniment. */
const TENTATIVES_MAX = 500;

export function tentativesSortantes(): readonly TentativeSortante[] {
  return tentatives;
}

export function oublierTentativesSortantes(): void {
  tentatives.length = 0;
}

/**
 * LA PORTE. À appeler AVANT d'ouvrir un transport, de lire un identifiant, de composer une
 * requête — pas juste avant l'envoi : un test qui échoue après avoir déchiffré un mot de passe
 * a déjà fait une chose de trop.
 */
export function exigerSortieAutorisee(
  acte: ActeSortant,
  cible: string,
  details: { apercu?: string; origine?: string } = {},
): void {
  if (!sortiesInterdites()) return;
  const t: TentativeSortante = { acte, cible, apercu: details.apercu, origine: details.origine, quand: Date.now() };
  tentatives.push(t);
  if (tentatives.length > TENTATIVES_MAX) tentatives.splice(0, tentatives.length - TENTATIVES_MAX);
  throw new SortieInterdite(t);
}

/**
 * LA VARIANTE QUI NE LÈVE PAS — pour les chemins « au mieux » (une notification poussée qui
 * échoue ne doit pas faire tomber une mission).
 *
 * Elle rend `false` quand la sortie est refusée, ET ENREGISTRE la tentative : l'appelant se
 * contente de ne rien faire, le banc garde quand même la trace de ce qui serait parti. Le
 * silence n'efface pas la preuve.
 */
export function sortieAutorisee(
  acte: ActeSortant,
  cible: string,
  details: { apercu?: string; origine?: string } = {},
): boolean {
  if (!sortiesInterdites()) return true;
  const t: TentativeSortante = { acte, cible, apercu: details.apercu, origine: details.origine, quand: Date.now() };
  tentatives.push(t);
  if (tentatives.length > TENTATIVES_MAX) tentatives.splice(0, tentatives.length - TENTATIVES_MAX);
  return false;
}
