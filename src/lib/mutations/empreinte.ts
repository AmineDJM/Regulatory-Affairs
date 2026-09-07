/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'EMPREINTE RÉELLE D'UNE MUTATION NE DÉPASSE JAMAIS L'EMPREINTE DEMANDÉE.
 *
 * ── LE DÉFAUT MESURÉ ────────────────────────────────────────────────────────────────────
 *
 * Vrai chat, vraie base :
 *
 *   PDG   — « Retire l'adresse e-mail d'Allaeddine. »
 *   Adam  — « Je propose : SUPPRIMER DÉFINITIVEMENT l'employé Allaeddine ***. Confirmez-vous ? »
 *
 * Un champ demandé, un enregistrement entier proposé — avec ses pièces jointes, ses
 * commentaires et sa cascade non restaurable. Rien ne part sans clic ; mais la carte annonçait
 * « supprimer » sous une demande qui disait « retirer une adresse », et un clic réflexe
 * effaçait une personne. C'est le pire genre de défaut : l'action est PLUS LARGE que la
 * demande, et la carte le dit d'une façon qui ressemble à ce qui a été demandé.
 *
 * ── POURQUOI CE N'EST PAS UN CAS PARTICULIER ────────────────────────────────────────────
 *
 * La même faute a exactement la même forme partout :
 *
 *   « corrige son numéro dans l'annuaire »   → désactiver son COMPTE
 *   « change la cellule B12 »                → supprimer la LIGNE
 *   « supprime le dossier REG-2026-014 »     → un LOT de dossiers
 *
 * Une seule grandeur les ordonne : jusqu'où la mutation descend.
 *
 *     CHAMP  <  ENREGISTREMENT  <  LOT
 *
 * La règle tient en une ligne : la portée de l'OPÉRATION ne dépasse jamais la portée de la
 * DEMANDE. Elle ne juge ni le droit (c'est le RBAC), ni la cible (c'est `cible-designee.ts`),
 * ni l'opportunité (c'est la politique de confirmation). Elle répond à UNE question : ce qui
 * va être détruit est-il plus grand que ce qui a été demandé ?
 *
 * ── LE SILENCE N'INTERDIT RIEN ──────────────────────────────────────────────────────────
 *
 * `porteeDemandee` rend `null` sur tout ce qu'elle ne reconnaît pas à coup sûr, et un `null`
 * LAISSE PASSER. C'est la même discipline que `commands/nl.ts` (§104.5) : attraper une phrase
 * qu'on comprend mal est pire que ne rien attraper. Une règle qui refuserait « supprime
 * Allaeddine » parce qu'elle n'a pas su lire la demande serait abandonnée en une semaine, et
 * avec elle la protection qui compte.
 *
 * Seules les opérations DESTRUCTIVES ou qui réécrivent un enregistrement entier sont pesées.
 * Créer n'a pas d'empreinte à dépasser : « crée une tâche pour corriger l'adresse d'Allaeddine »
 * nomme un champ et propose une création — c'est parfaitement légitime, et une règle qui la
 * refuserait mesurerait la ressemblance des mots au lieu de l'effet.
 *
 * ── CE MODULE N'IMPORTE RIEN ────────────────────────────────────────────────────────────
 *
 * Ni Prisma, ni le registre, ni le modèle : il prend un texte et une portée, il rend un
 * verdict. Les adaptateurs (`porteeDeLOutil` ici, l'appelant Live Office ailleurs) sont ce qui
 * le branche sur une surface.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * UNE EMPREINTE A DEUX AXES, ET LES CONFONDRE REND LA RÈGLE FAUSSE.
 *
 * La PROFONDEUR dit quelle part d'un enregistrement est touchée ; la CARDINALITÉ dit combien
 * d'enregistrements. « Supprime ces trois dossiers » et « supprime le dossier REG-2026-014 »
 * ont la MÊME profondeur et des cardinalités opposées — les ranger sur une seule échelle
 * ferait refuser un lot parfaitement demandé. C'est la même distinction qu'au compilateur de
 * missions (§118.3 : « 33 destinataires dans une étape au lieu de 33 étapes »).
 *
 * `null` sur un axe = la demande ne le dit pas, et cet axe n'interdit alors rien.
 */
export type Profondeur = "CHAMP" | "ENREGISTREMENT";
export type Cardinalite = "UN" | "PLUSIEURS";

export interface Empreinte {
  profondeur: Profondeur | null;
  cardinalite: Cardinalite | null;
}

export const PROFONDEUR_LABEL: Record<Profondeur, string> = {
  CHAMP: "un champ",
  ENREGISTREMENT: "un enregistrement entier",
};

/** Le texte d'une demande, débarrassé de ses accents, de sa casse et de sa ponctuation. */
const normaliser = (t: string): string =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * LES VERBES QUI MUTENT. Un verbe seul ne dit pas la portée — c'est son OBJET qui la dit.
 * Le verbe sert donc uniquement à ouvrir la fenêtre dans laquelle on cherche cet objet.
 */
const VERBES = new RegExp(
  "(?:^| )(?:"
  + "retire[rz]?|enleve[rz]?|enlever|supprime[rz]?|supprimer|efface[rz]?|effacer|vide[rz]?|vider|ote[rz]?|oter|"
  + "desinscri[st]|retirons|supprimons|"
  + "change[rz]?|changer|modifie[rz]?|modifier|corrige[rz]?|corriger|remplace[rz]?|remplacer|"
  + "met[sz]? a jour|mettre a jour|actualise[rz]?|actualiser|rectifie[rz]?|rectifier|"
  + "ajoute[rz]?|ajouter|renseigne[rz]?|renseigner"
  + ")(?= )",
  "g",
);

/** La fenêtre où l'on cherche l'objet du verbe — assez pour « l'adresse e-mail de Yacine ». */
const FENETRE = 44;

/**
 * LES CHAMPS NOMMÉS SANS AMBIGUÏTÉ. Un attribut, jamais un enregistrement : personne n'appelle
 * un employé « un numéro de téléphone ».
 */
const CHAMPS_EXPLICITES = new RegExp(
  "\\b(?:"
  + "adresse (?:e ?mails?|mails?|electroniques?|postales?)|courriels?|"
  + "numeros? (?:de )?(?:telephone|portable|fax|compte|securite sociale)|telephones?|portables?|"
  + "logins?|identifiants?|mots? de passe|"
  + "dates? (?:de|cible|limite|d)|echeances?|"
  + "statuts?|priorites?|montants?|salaires?|intitules?|libelles?|"
  + "champs?|cellules?|commentaires?|"
  + "fonctions?|postes?|photos?|avatars?|signatures?"
  + ")\\b",
);

/**
 * LES CHAMPS QUE SEUL LE POSSESSIF DÉSIGNE. « son e-mail » est une adresse ; « ce mail » est un
 * message, donc un ENREGISTREMENT. Le déterminant fait toute la différence, et c'est pourquoi
 * les formes nues (« mail », « adresse ») ne figurent pas dans la liste explicite ci-dessus.
 */
const CHAMPS_POSSESSIFS = new RegExp(
  "\\b(?:son|sa|ses|leur|leurs|mon|ma|mes|notre|nos|votre|vos)"
  + " (?:e ?mails?|mails?|adresses?|numeros?|titres?|dates?|statuts?|telephones?|portables?"
  + "|logins?|identifiants?|fonctions?|postes?|photos?|signatures?)\\b",
);

/**
 * LES ENREGISTREMENTS. Ce que l'ERP compte en lignes : une personne, un dossier, une pièce.
 * `lignes?` en fait partie — dans un classeur, la ligne EST l'enregistrement de la cellule.
 */
const ENREGISTREMENTS = new RegExp(
  "\\b(?:"
  + "employes?|salaries?|collaborateurs?|personnes?|contacts?|comptes?|utilisateurs?|profils?|"
  + "dossiers?|produits?|documents?|fiches?|enregistrements?|entrees?|lignes?|"
  + "taches?|demandes?|factures?|devis|contrats?|courriers?|evenements?|reunions?|"
  + "paragraphes?|diapos?|diapositives?|pages?|feuilles?|onglets?|"
  + "hopitaux|hopital|etablissements?|societes?|entreprises?|fournisseurs?|clients?|"
  + "mails?|e mails?|messages?|notifications?"
  + ")\\b",
);

/** LES DÉTERMINANTS QUI COMPTENT. Le mot juste avant la tête dit à lui seul combien il y en a. */
const UN_SEUL = /\b(?:le|la|l|ce|cet|cette|un|une|mon|ma|son|sa|notre|votre|leur|du|de la|au)$/;
const PLUSIEURS_MOTS = /\b(?:les|ces|des|mes|tes|ses|nos|vos|leurs|tous|toutes|chaque|plusieurs|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|certains|certaines)$/;

/** La position du premier mot reconnu, ou l'infini. C'est elle qui départage — voir ci-dessous. */
const ou = (re: RegExp, texte: string): number => {
  const m = re.exec(texte);
  return m ? m.index : Number.POSITIVE_INFINITY;
};

/**
 * L'EMPREINTE QUE LA DEMANDE ÉNONCE — chaque axe, ou `null` quand elle ne l'énonce pas.
 *
 * On ne lit pas la phrase entière : on lit ce que chaque verbe de mutation gouverne. « Supprime
 * l'employé Allaeddine et corrige son numéro » ouvre deux fenêtres, l'une sur un enregistrement
 * et l'autre sur un champ — et rend donc la PLUS PROFONDE, parce que la demande autorise bien la
 * suppression. L'asymétrie est voulue : la règle protège d'un dépassement, pas d'un texte.
 */
export function empreinteDemandee(demande: string): Empreinte {
  const norm = ` ${normaliser(demande)} `;
  const bornes: number[] = [];
  VERBES.lastIndex = 0;
  for (let m = VERBES.exec(norm); m; m = VERBES.exec(norm)) bornes.push(m.index + m[0].length);
  if (bornes.length === 0) return { profondeur: null, cardinalite: null };

  const vue: Empreinte = { profondeur: null, cardinalite: null };
  for (let i = 0; i < bornes.length; i += 1) {
    const debut = bornes[i]!;
    const fin = Math.min(norm.length, bornes[i + 1] ?? debut + FENETRE, debut + FENETRE);
    const groupe = empreinteDuGroupe(norm.slice(debut, fin));
    if (groupe.profondeur === "ENREGISTREMENT") vue.profondeur = "ENREGISTREMENT";
    else if (groupe.profondeur === "CHAMP" && !vue.profondeur) vue.profondeur = "CHAMP";
    if (groupe.cardinalite === "PLUSIEURS") vue.cardinalite = "PLUSIEURS";
    else if (groupe.cardinalite === "UN" && !vue.cardinalite) vue.cardinalite = "UN";
  }
  return vue;
}

/**
 * LA TÊTE DU GROUPE NOMINAL DÉCIDE, ET ELLE EST LA PREMIÈRE.
 *
 * C'est ici que la première version se trompait, et le cas manqué était le cas fondateur :
 * « retire l'adresse e-mail d'Allaeddine » contient le mot « mail », qui est aussi le nom d'un
 * ENREGISTREMENT (un message). Tester « y a-t-il un nom d'enregistrement ? » avant « y a-t-il un
 * nom de champ ? » rendait ENREGISTREMENT — et laissait passer la suppression de la personne.
 *
 * Le français est à tête initiale : dans « l'adresse e-mail d'Allaeddine », « la date cible du
 * dossier », « le statut de la tâche », l'objet du verbe est le PREMIER nom ; ce qui suit le
 * complète. On ne compte donc pas les mots reconnus, on compare leurs POSITIONS, et le plus à
 * gauche gagne. « supprime l'employé Allaeddine » garde ENREGISTREMENT, « supprime ce mail »
 * aussi — leur premier nom n'a pas changé.
 */
function empreinteDuGroupe(objet: string): Empreinte {
  const champ = Math.min(ou(CHAMPS_EXPLICITES, objet), ou(CHAMPS_POSSESSIFS, objet));
  const enr = ou(ENREGISTREMENTS, objet);
  const tete = Math.min(champ, enr);
  if (tete === Number.POSITIVE_INFINITY) return { profondeur: null, cardinalite: null };
  return {
    profondeur: champ < enr ? "CHAMP" : "ENREGISTREMENT",
    cardinalite: cardinaliteDeLaTete(objet, tete),
  };
}

/**
 * COMBIEN ? Le déterminant qui précède la tête le dit, et son pluriel le confirme. Tout le reste
 * — « supprime ces trois dossiers », « supprime REG-001 et REG-002 » — rend `null` : la demande
 * porte peut-être sur plusieurs cibles, et une règle qui devinerait « un seul » refuserait le
 * lot que la personne vient de demander.
 */
function cardinaliteDeLaTete(objet: string, tete: number): Cardinalite | null {
  // Le possessif fait partie de la tête (« son e-mail ») : c'est LUI le déterminant.
  const depuisTete = objet.slice(tete);
  const poss = /^(?:son|sa|ses|leur|leurs|mon|ma|mes|notre|nos|votre|vos) /.exec(depuisTete);
  const avant = poss ? ` ${poss[0].trim()}` : objet.slice(0, tete).trimEnd();
  if (PLUSIEURS_MOTS.test(avant)) return "PLUSIEURS";
  const nom = /^[a-z0-9]+/.exec(poss ? depuisTete.slice(poss[0].length) : depuisTete);
  if (nom && /(?:s|x)$/.test(nom[0]) && !/(?:devis|fois|cas|prix|taux|corpus|colis)$/.test(nom[0])) return "PLUSIEURS";
  if (UN_SEUL.test(avant)) return "UN";
  return null;
}

/**
 * L'EMPREINTE D'UNE OPÉRATION D'ÉCRITURE — `profondeur: null` pour tout ce qui ne DÉTRUIT pas.
 *
 * Deux familles pèsent en profondeur :
 *   • la destruction d'un enregistrement (`delete_record`, `purge_record`) ;
 *   • la réécriture de l'état ENTIER d'un compte — désactiver coupe tous les accès, changer le
 *     rôle réécrit tous les droits ; l'empreinte n'est pas « un champ », c'est la personne.
 *
 * Tout le reste rend `null` et passe : `update_task`, `update_regulatory_product`,
 * `update_salary`… modifient le champ qu'on leur nomme, et une CRÉATION n'a pas d'empreinte à
 * dépasser — « crée une tâche pour corriger l'adresse d'Allaeddine » nomme un champ et propose
 * une création, ce qui est parfaitement légitime.
 *
 * `bulk_action` est le seul à porter une cardinalité PLUSIEURS ; sa profondeur est celle de
 * l'outil qu'il RÉPÈTE, jamais la sienne.
 */
export function empreinteDeLOutil(toolName: string, input?: unknown): Empreinte {
  /**
   * LIVE OFFICE — la même règle, sur des commandes au lieu de capacités.
   *
   * « Si je demande une cellule, Adam ne détruit pas la ligne. » Un lot `artifact_edit` porte
   * des commandes `format.operation` (`xlsx.valeur`, `xlsx.supprimer_ligne`…) ; celles qui
   * commencent par `supprimer_` détruisent un CONTENANT — une ligne, une colonne, une feuille,
   * un paragraphe, une diapo, des pages. Les autres écrivent DANS un contenant, donc un champ.
   * On lit ces noms comme des chaînes : le socle ne connaît pas `artifact/` et n'a pas à le
   * connaître.
   */
  if (toolName === "artifact_edit") {
    const cmds = input && typeof input === "object" ? (input as { commandes?: unknown }).commandes : null;
    const ops = Array.isArray(cmds)
      ? cmds.map((c) => (c && typeof c === "object" ? String((c as { op?: unknown }).op ?? "") : ""))
      : [];
    const detruitUnContenant = ops.some((op) => /^[a-z]+\.supprimer_/.test(op));
    return { profondeur: detruitUnContenant ? "ENREGISTREMENT" : null, cardinalite: "UN" };
  }
  if (toolName === "bulk_action") {
    const inner = input && typeof input === "object" && typeof (input as { tool?: unknown }).tool === "string"
      ? (input as { tool: string }).tool
      : null;
    return { profondeur: inner ? empreinteDeLOutil(inner).profondeur : null, cardinalite: "PLUSIEURS" };
  }
  switch (toolName) {
    case "delete_record":
    case "purge_record":
    case "set_account_active":
    case "set_account_role":
      return { profondeur: "ENREGISTREMENT", cardinalite: "UN" };
    default:
      return { profondeur: null, cardinalite: "UN" };
  }
}

/** L'opération plus étroite à proposer à la place — dite, pour que le refus soit utile. */
const PLUS_ETROIT: Record<string, string> = {
  delete_record: "modifiez le champ concerné sur la fiche, ou dites-moi lequel vider",
  purge_record: "modifiez le champ concerné sur la fiche, ou dites-moi lequel vider",
  set_account_active: "modifiez le champ concerné — désactiver le compte coupe TOUS ses accès",
  set_account_role: "modifiez le champ concerné — changer le rôle réécrit TOUS ses droits",
  artifact_edit: "écrivez DANS la cellule (ou le paragraphe) au lieu de supprimer ce qui la contient",
  // Un lot dont l'outil RÉPÉTÉ détruit des enregistrements peut dépasser sur les DEUX axes ;
  // sans cette ligne, le refus de profondeur retomberait sur la phrase générique.
  bulk_action: "modifiez le champ concerné sur chaque fiche, plutôt que de les supprimer",
};

export type VerdictEmpreinte = { ok: true } | { ok: false; axe: "PROFONDEUR" | "CARDINALITE"; refus: string };

/**
 * LE COUPE-CIRCUIT. Une variable, et tout repart comme avant — comme pour `cible-designee.ts`.
 * Il sert aussi à MESURER : sans lui, impossible de dire si un changement de comportement vient
 * de cette règle ou du non-déterminisme du modèle.
 */
export function empreinteMutationDesactivee(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ADAM_EMPREINTE_MUTATION_DISABLED === "1" || env.ADAM_EMPREINTE_MUTATION_DISABLED === "true";
}

/**
 * LA PORTE. `demande` est le texte de la personne, `toolName`/`input` l'écriture que le modèle a
 * choisie. Le refus est l'exception : il n'arrive que quand les DEUX empreintes sont connues sur
 * l'axe considéré ET que celle de l'opération est strictement plus large.
 */
export function verdictEmpreinte(demande: string, toolName: string, libelle?: string, input?: unknown): VerdictEmpreinte {
  if (empreinteMutationDesactivee()) return { ok: true };
  const op = empreinteDeLOutil(toolName, input);
  if (!op.profondeur && op.cardinalite !== "PLUSIEURS") return { ok: true };
  const veut = empreinteDemandee(demande);
  const quoi = libelle ? `« ${libelle} »` : `l'action « ${toolName} »`;

  if (op.profondeur === "ENREGISTREMENT" && veut.profondeur === "CHAMP") {
    return {
      ok: false, axe: "PROFONDEUR",
      refus:
        `Votre demande porte sur ${PROFONDEUR_LABEL.CHAMP} ; ${quoi} agit sur ${PROFONDEUR_LABEL.ENREGISTREMENT}. `
        + `Je ne fais pas plus large que ce qui est demandé : ${PLUS_ETROIT[toolName] ?? "reformulez au niveau voulu"}. `
        + `Rien n'a été modifié.`,
    };
  }
  if (op.cardinalite === "PLUSIEURS" && veut.cardinalite === "UN") {
    return {
      ok: false, axe: "CARDINALITE",
      refus:
        `Votre demande porte sur UNE cible ; ${quoi} en traite plusieurs d'un coup. `
        + `Je ne fais pas plus large que ce qui est demandé — nommez les cibles si vous en voulez plusieurs. `
        + `Rien n'a été modifié.`,
    };
  }
  return { ok: true };
}
