import type { ContratAction, ChampAction } from "./contrat";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CHEMIN GÉNÉRIQUE — ET CE QU'IL NE FRANCHIRA JAMAIS.
 *
 * `contrat.ts` rend 598 actions descriptibles sans une fiche écrite à la main. Ce module est
 * ce qui décide LESQUELLES un modèle peut déclencher, et avec quelles entrées.
 *
 * ── LE DANGER QUE LA MESURE A RÉVÉLÉ ─────────────────────────────────────────────────────
 *
 * En comparant la dérivation aux 520 ops déclarées à la main, 118 actions sont apparues
 * atteignables SEULEMENT par le chemin générique. L'échantillon commence ainsi :
 * `updateUserRole`, `setSecondaryRole`, `setRowGrants`, `setUserActive`, `superAdminDelete`,
 * `revokeSession`. Ce ne sont pas des trous de couverture : ce sont EXACTEMENT les gestes que
 * §118.6 interdit structurellement à l'agent. Le « gain » du chemin générique était, en tête
 * de liste, l'auto-escalade.
 *
 * ── POURQUOI PAS `policy/guard.ts` TEL QUEL ──────────────────────────────────────────────
 *
 * Il existe et il a raison, mais il reconnaît les capacités à leur NOM, avec des motifs écrits
 * pour des identifiants en serpent (`update_rule`, `create_user`). Passés sur des noms d'action
 * en camel, ils LAISSENT PASSER `updateUserRole` : aucun de `\brole\b`, `_role`, `role_` ne
 * s'accroche au milieu d'un mot. Une garde qui ne s'arme pas sur la convention qu'on lui donne
 * est une garde désarmée qui a l'air armée — le pire des deux (§118.17). On ne l'élargit pas
 * non plus : ses motifs servent des capacités de mission, et les élargir ferait refuser là-bas.
 *
 * ── SUR QUOI CELLE-CI S'ARME ─────────────────────────────────────────────────────────────
 *
 * Sur le MODÈLE ÉCRIT, lu dans la source (`prisma.user.update`). Un modèle ne se renomme pas
 * pour échapper à une garde, et une action ajoutée demain qui touche `UserAccess` est refusée
 * sans que personne ait pensé à elle. Le nom reste un FILET SECONDAIRE, pour les actions dont
 * on n'a pas su lire les écritures.
 *
 * La liste des modèles est fermée et EXHAUSTIVE au regard du schéma : le test exige que tout
 * modèle du schéma dont le nom porte identité, droit, session, invitation ou réglage soit
 * ICI — refusé — ou dans la liste des exceptions AVEC sa raison. Un modèle de droits ajouté
 * demain fait échouer le test au lieu d'ouvrir une porte en silence.
 *
 * ── ET CE QUE LE REFUS NE VEUT PAS DIRE ──────────────────────────────────────────────────
 *
 * Refusé À L'AGENT n'est pas « impossible ». Ces gestes vivent dans les écrans d'administration
 * et une personne les fait en trois clics. Le refus le DIT (§118.30 : nommer le remède), sans
 * quoi Adam répondrait « je ne peux pas » là où la bonne phrase est « c'est à vous de le faire,
 * ici ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LES MODÈLES QU'ÉCRIRE EST UNE AUTO-ESCALADE.
 *
 * Chaque entrée porte le geste qu'elle protège, parce que c'est ce texte qu'un humain lira.
 */
export const MODELES_INTERDITS: Readonly<Record<string, string>> = {
  user: "le compte, le rôle ou le mot de passe d'une personne",
  userAccess: "les droits de module d'une personne",
  rowGrant: "les accès ligne à ligne d'une personne",
  userSession: "les sessions ouvertes d'une personne",
  userInvite: "les invitations à créer un compte",
  userCompanyAccess: "le rattachement d'une personne à une société",
  userProductRange: "la gamme de produits qu'une personne peut voir",
  departmentBudgetAccess: "l'accès d'une personne au budget d'un département",
  medicalDirectoryAccess: "l'accès d'une personne à l'annuaire médical",
  regulatoryFeatureAccess: "l'accès d'une personne aux fonctions Regulatory",
  supplierUser: "les comptes fournisseurs",
  // Les RÉGLAGES portent les garde-fous eux-mêmes — la politique d'envoi d'Adam, la pause
  // sortante, les bascules de fonctionnalité. Le chemin générique ne sait pas distinguer un
  // réglage qui RESTREINT d'un réglage qui OUVRE ; il refuse donc les deux, et les gestes
  // légitimes gardent leurs ops déclarées (§118.15 : ce qui réduit reste disponible là).
  appSetting: "les réglages de l'application, dont les garde-fous d'Adam",
  aiSetting: "les réglages des modèles",
  featureFlag: "les bascules de fonctionnalité",
  riskSetting: "les seuils de risque",
  adoptionSetting: "les réglages d'adoption",
  sfeSettings: "les réglages SFE",
  assistantRule: "les règles enseignées à Adam — une règle est l'attestation d'une PERSONNE",
};

/**
 * LES MODÈLES QUE LE NOM DÉSIGNE MAIS QUI NE SONT PAS DES DROITS — et pourquoi.
 *
 * Sans cette liste, l'exhaustivité exigerait de refuser des gestes métier ordinaires, et un
 * refus à tort coûte plus cher que le défaut qu'on corrige (§118.27).
 */
export const MODELES_NON_SENSIBLES: Readonly<Record<string, string>> = {
  ArtifactSession: "une session d'édition de document — un espace de travail, aucun droit",
  RegulatoryUploadSession: "un lot de dépôt de fichiers Regulatory, aucun droit",
  SessionEvent: "la trace d'un événement de session — un journal qu'on lit, pas une porte",
  CalendarInvite: "une invitation à une RÉUNION, pas à un compte",
};

/** Filet SECONDAIRE : ce que le nom d'une action dit quand ses écritures n'ont pas été lues. */
const MOTIFS_NOM = [
  { test: /role|permission|grant|access|rbac|password|credential|token|secret/i, raison: "un droit ou un identifiant" },
  { test: /superadmin|super_admin/i, raison: "un pouvoir de Super Admin" },
  { test: /featureflag|killswitch|guard|bypass/i, raison: "un garde-fou" },
];

/**
 * CE CONTRAT EST-IL HORS DU CHEMIN GÉNÉRIQUE ? Rend `null` quand il est permis, sinon la
 * raison — jamais un booléen : un refus sans motif ne peut ni être compris, ni corrigé.
 */
export function interdictionGenerique(c: ContratAction): string | null {
  for (const modele of c.modelesEcrits) {
    const quoi = MODELES_INTERDITS[modele];
    if (quoi) {
      return `Cette action modifie ${quoi}. Adam ne touche jamais aux droits ni aux garde-fous, `
        + `même à la demande d'une personne qui en a le droit — c'est un refus de conception, pas `
        + `une limite technique. Ce geste se fait depuis l'écran d'administration.`;
    }
  }
  for (const m of MOTIFS_NOM) {
    if (m.test.test(c.fonction)) {
      return `Le nom de cette action désigne ${m.raison}, et le chemin générique n'y touche pas. `
        + `Ce geste se fait depuis l'écran d'administration.`;
    }
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────────────────────────────
// LA VALIDATION D'UNE ENTRÉE CONTRE SON CONTRAT
// ───────────────────────────────────────────────────────────────────────────────────────────

export interface EntreeRefusee {
  /** Ce qui ne va pas, en une phrase adressée à qui va corriger — modèle ou humain. */
  raison: string;
  /** Le champ en cause, quand il y en a un. */
  champ?: string;
}

/**
 * L'ENTRÉE PROPOSÉE TIENT-ELLE DANS LE CONTRAT ?
 *
 * Trois refus, et chacun existe parce que l'accepter produirait un faux succès plutôt qu'une
 * erreur : un champ INCONNU serait ignoré par l'action (« c'est fait » sans effet) ; un champ
 * OBLIGATOIRE manquant ferait échouer l'action pour une raison qu'on savait d'avance ; une
 * valeur HORS de l'énum déclaré serait refusée plus loin, après un aller-retour inutile.
 *
 * Ce qu'on ne refuse PAS : une valeur dont les valeurs admises n'ont pas été lues (`null`).
 * Une garde qui refuse ce qu'elle ne comprend pas est désactivée dans la semaine (§118.16).
 */
export function validerEntree(
  c: ContratAction,
  entree: Readonly<Record<string, unknown>>,
): EntreeRefusee[] {
  if (c.illisible) {
    return [{ raison: `Cette action ne s'appelle pas par le chemin générique : ${c.illisible}.` }];
  }
  const refus: EntreeRefusee[] = [];
  const connus = new Map<string, ChampAction>(c.champs.map((ch) => [ch.nom, ch]));

  for (const nom of Object.keys(entree)) {
    if (!connus.has(nom)) {
      refus.push({
        champ: nom,
        raison: `« ${nom} » n'est pas une entrée de cette action. Elle attend : `
          + `${c.champs.map((x) => x.nom).join(", ")}.`,
      });
    }
  }
  for (const ch of c.champs) {
    const v = entree[ch.nom];
    const absent = v === undefined || v === null || v === "";
    if (ch.obligatoire && absent) {
      refus.push({ champ: ch.nom, raison: `« ${ch.nom} » est obligatoire pour cette action.` });
      continue;
    }
    if (absent || !ch.valeurs) continue;
    const valeurs = Array.isArray(v) ? v : [v];
    for (const une of valeurs) {
      if (!ch.valeurs.includes(String(une))) {
        refus.push({
          champ: ch.nom,
          raison: `« ${String(une)} » n'est pas une valeur admise pour « ${ch.nom} » : `
            + `${ch.valeurs.join(", ")}.`,
        });
      }
    }
  }
  return refus;
}

/**
 * L'ENTRÉE, TRADUITE EN FORMULAIRE — la forme que 619 des 715 actions attendent.
 *
 * Une valeur `undefined` ou `null` n'est PAS écrite : un champ absent et un champ vide ne
 * disent pas la même chose à une action qui distingue « ne touche pas » de « efface » (§118.71,
 * où une clé effacée par `JSON.stringify` avait fait refuser un destinataire qu'on tenait).
 * Une LISTE devient plusieurs entrées du même nom, ce que `getAll` relit exactement.
 */
export function enFormulaire(entree: Readonly<Record<string, unknown>>): FormData {
  const fd = new FormData();
  for (const [cle, v] of Object.entries(entree)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) for (const une of v) fd.append(cle, String(une));
    else if (v instanceof Date) fd.append(cle, v.toISOString());
    else fd.append(cle, typeof v === "boolean" ? (v ? "on" : "") : String(v));
  }
  return fd;
}

// ───────────────────────────────────────────────────────────────────────────────────────────
// LA DÉCOUVERTE
// ───────────────────────────────────────────────────────────────────────────────────────────

const MOTS_VIDES = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "d", "l", "et", "ou", "a", "à", "au", "aux",
  "en", "dans", "pour", "par", "sur", "avec", "ce", "cet", "cette", "ces", "que", "qui", "quoi",
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "me", "moi", "te", "toi", "se", "son",
  "sa", "ses", "mon", "ma", "mes", "est", "sont", "peux", "peut", "veux", "veut", "fais", "fait",
  "faire", "stp", "svp", "merci", "the", "of", "to",
]);

/** Les mots utiles d'une phrase — accents repliés, mots vides retirés, deux lettres minimum. */
export function motsUtiles(texte: string): string[] {
  return texte
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length >= 3 && !MOTS_VIDES.has(m));
}

/** Les mots qu'un identifiant d'action porte : `bd-project-actions:createBdProject`. */
function motsDuContrat(c: ContratAction): string[] {
  return motsUtiles(
    `${c.fichier.replace(/-actions$/, "")} ${c.fonction.replace(/([a-z0-9])([A-Z])/g, "$1 $2")} `
    + `${c.porte.module ?? ""} ${c.porte.moduleFr ?? ""} ${c.champs.map((x) => x.nom).join(" ")}`,
  );
}

export interface CapaciteTrouvee {
  contrat: ContratAction;
  score: number;
  /** `null` si elle est ouverte au chemin générique, sinon pourquoi elle ne l'est pas. */
  interdiction: string | null;
}

/**
 * CHERCHER UNE CAPACITÉ — un tri par recouvrement de mots, pas une promesse de pertinence.
 *
 * Les interdites SONT rendues, avec leur motif. Les taire ferait répondre « je ne trouve rien »
 * là où la vérité est « je l'ai trouvée et je n'y touche pas » — un « je ne peux pas »
 * artificiel, et le défaut que ce dépôt a déjà payé deux fois (§118.59, §118.63).
 */
export function chercherCapacites(
  contrats: readonly ContratAction[],
  intention: string,
  limite = 8,
): CapaciteTrouvee[] {
  const mots = motsUtiles(intention);
  if (mots.length === 0) return [];
  const trouve: CapaciteTrouvee[] = [];
  for (const c of contrats) {
    const cible = motsDuContrat(c);
    let score = 0;
    for (const m of mots) {
      if (cible.includes(m)) score += 2;
      else if (cible.some((x) => x.startsWith(m) || m.startsWith(x))) score += 1;
    }
    if (score > 0) trouve.push({ contrat: c, score, interdiction: interdictionGenerique(c) });
  }
  return trouve
    .sort((a, b) => b.score - a.score || a.contrat.id.localeCompare(b.contrat.id))
    .slice(0, limite);
}
