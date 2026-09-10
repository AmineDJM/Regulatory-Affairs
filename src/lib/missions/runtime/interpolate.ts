/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'INJECTION D'UN ÉLÉMENT DANS UNE ENTRÉE D'ÉTAPE — délibérément pauvre.
 *
 * ── CE QUE ÇA FAIT ───────────────────────────────────────────────────────────────────────
 *
 * Le planner écrit UNE étape « envoie à {{employe.email}} », et déclare qu'elle se déploie sur
 * une collection. Le moteur la démultiplie et remplace, dans chaque copie, `{{employe.email}}`
 * par la valeur du salarié courant.
 *
 * ── POURQUOI PAS UN MOTEUR DE GABARIT ────────────────────────────────────────────────────
 *
 * Parce qu'un vrai moteur de gabarit sait faire des conditions, des boucles et parfois appeler
 * du code — et que ces entrées viennent en partie d'un modèle. Ce qui est accepté ici tient en
 * une ligne : un nom, des points, des lettres. Pas d'appel, pas d'index, pas d'expression.
 *
 * Le résultat d'un chemin inconnu est `undefined`, JAMAIS la chaîne « {{employe.email}} » :
 * envoyer un e-mail à une adresse littérale « {{employe.email}} » serait pire qu'échouer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce que cette valeur offre RÉELLEMENT — pour qu'un refus montre ce qu'il a lu (§118.34). */
const cheminsDisponibles = (courant: unknown): string[] => {
  if (Array.isArray(courant)) return courant.length === 0 ? [] : [`0…${courant.length - 1}`];
  if (courant && typeof courant === "object") return Object.keys(courant as Record<string, unknown>).slice(0, 12);
  return [];
};

const MOTIF = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}/g;

/** Le mot exact `{{x.y}}` et rien d'autre — le cas où l'on remplace la VALEUR, pas le texte. */
const SEUL = /^\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}$/;

/**
 * LIT UN CHEMIN dans un objet — sans jamais traverser le prototype.
 *
 * `hasOwnProperty` n'est pas une précaution théorique : sans lui, `{{employe.constructor}}`
 * remonterait à des objets du langage, et un chemin fabriqué depuis une donnée non fiable
 * (§49 : un e-mail, un document) deviendrait un moyen d'exploration.
 */
export function lire(source: unknown, chemin: string): unknown {
  let courant: unknown = source;
  for (const segment of chemin.split(".")) {
    if (courant === null || typeof courant !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(courant, segment)) return undefined;
    courant = (courant as Record<string, unknown>)[segment];
  }
  return courant;
}

/**
 * REMPLACE LES RÉFÉRENCES DANS UNE VALEUR, quelle que soit sa profondeur.
 *
 * Le contexte est nommé (`{ employe: {...} }`) plutôt que plat : sans le préfixe, deux
 * expansions imbriquées écraseraient leurs champs de même nom, et l'on enverrait le message du
 * salarié au fournisseur sans que rien ne le signale.
 */
export interface OptionsInjection {
  /**
   * COMMENT UN CHEMIN SE LIT — `lire(contexte, chemin)` par défaut.
   *
   * L'éventail en pose un autre : sur un élément SCALAIRE, `{{as.champ}}` rend l'élément
   * lui-même (§118.71). Le passer en paramètre plutôt que de le coder ici garde `injecter`
   * indifférent à ce qu'il traverse — la tuyauterie entre étapes n'a pas cette règle, et la
   * lui donner ferait résoudre `{{lecture.texte}}` en « lecture » sur un résultat scalaire.
   */
  resoudre?: (chemin: string) => unknown;
  /** Le carnet des références qui n'ont RIEN rendu. Absent : on ne consigne pas. */
  absentes?: string[];
}

export function injecter(
  valeur: unknown,
  contexte: Record<string, unknown>,
  opts: OptionsInjection = {},
): unknown {
  const resoudre = opts.resoudre ?? ((chemin: string) => lire(contexte, chemin));
  const noter = (chemin: string, v: unknown) => {
    if (v === undefined && opts.absentes && !opts.absentes.includes(chemin)) opts.absentes.push(chemin);
    return v;
  };
  if (typeof valeur === "string") {
    const seul = SEUL.exec(valeur);
    // UN CHEMIN SEUL REND LA VALEUR TELLE QUELLE : un identifiant numérique reste un nombre,
    // une liste reste une liste. Les convertir en texte casserait les schémas d'entrée.
    if (seul) return noter(seul[1], resoudre(seul[1]));
    return valeur.replace(MOTIF, (brut, chemin: string) => {
      const v = noter(chemin, resoudre(chemin));
      if (v === undefined || v === null) return "";
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    });
  }
  if (Array.isArray(valeur)) return valeur.map((v) => injecter(v, contexte, opts));
  if (valeur && typeof valeur === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) out[k] = injecter(v, contexte, opts);
    return out;
  }
  return valeur;
}

export interface EntreeIteration {
  entree: Record<string, unknown>;
  /** Les références à l'élément qui n'ont RIEN rendu, avec ce que l'élément offre vraiment. */
  manquantes: { reference: string; disponibles: string[] }[];
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ENTRÉE D'UNE ITÉRATION D'ÉVENTAIL — et les deux défauts qu'elle portait (§118.71).
 *
 * ── MESURÉ LIVE, mission `cmttukkqf…` ──────────────────────────────────────────────────
 *
 * L'étape amont rend `destinataires: ["Amel Haddad", "Raihana Cherif"]` — des CHAÎNES. Le plan
 * écrit `recipientName: "{{regulatory.recipient}}"`, un CHAMP de l'élément. Deux conséquences,
 * chacune un défaut à part entière :
 *
 *   1. `lire` descend dans un scalaire et rend `undefined` ; l'objet reconstruit porte alors
 *      `recipientName: undefined`, que `JSON.stringify` EFFACE en base. La clé ne vaut pas
 *      « vide » — elle N'EXISTE PLUS. `send_message` a donc refusé « Destinataire « (rien) »
 *      introuvable » sur une itération dont la CLÉ D'ÉTAPE s'appelle `#Amel Haddad` : le moteur
 *      tenait la personne et l'avait perdue entre deux lignes de code. Deux collègues n'ont
 *      jamais reçu leur demande, l'éventail est sorti 2/2 en échec, le jalon a bloqué.
 *   2. Le refus désignait la mauvaise cause. La règle 20 du planificateur PROMET qu'un champ
 *      inventé « échoue à l'exécution en nommant les champs disponibles » ; ici il échouait en
 *      accusant l'annuaire. Le planificateur suivant est parti chercher une personne, alors
 *      que la personne était là et que c'est le CHEMIN qui était faux.
 *
 * ── CE QU'ON TRADUIT, ET CE QU'ON REFUSE DE DEVINER ────────────────────────────────────
 *
 * Sur un élément SCALAIRE, `{{as.nimportequoi}}` rend l'élément. Ce n'est pas un choix parmi
 * plusieurs lectures : un scalaire n'a AUCUN champ, donc la seule valeur qu'il puisse offrir
 * est lui-même — et c'est déjà exactement ce que `identiteIteration` en lit pour nommer la
 * fille. Traduire au lieu de refuser, comme `personnes/designation.ts` (§118.34).
 *
 * Sur un élément OBJET, on ne devine RIEN : un champ absent d'un objet qui en porte d'autres
 * est une vraie erreur de chemin, et la remplacer par l'objet entier mettrait `{"id":…,"nom":…}`
 * dans un destinataire. On la CONSIGNE avec les champs réellement disponibles, et l'appelant
 * fait échouer l'itération avant de payer l'appel de capacité.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function entreeIteration(
  modele: Record<string, unknown>,
  nom: string,
  element: unknown,
): EntreeIteration {
  const scalaire = element === null || typeof element !== "object";
  const absentes: string[] = [];
  const entree = injecter(modele, { [nom]: element }, {
    resoudre: (chemin) => {
      if (chemin !== nom && !chemin.startsWith(`${nom}.`)) return lire({ [nom]: element }, chemin);
      const suite = chemin === nom ? "" : chemin.slice(nom.length + 1);
      if (suite === "") return element;
      return scalaire ? element : lire(element, suite);
    },
    absentes,
  }) as Record<string, unknown>;
  return {
    entree,
    manquantes: absentes
      .filter((r) => r === nom || r.startsWith(`${nom}.`))
      .map((reference) => ({ reference, disponibles: cheminsDisponibles(element) })),
  };
}

/**
 * L'IDENTITÉ STABLE D'UNE ITÉRATION — ce qui va après le `#` dans la clé de l'étape fille.
 *
 * ── POURQUOI PAS SIMPLEMENT L'INDICE ─────────────────────────────────────────────────────
 *
 * Parce qu'une liste de trente-trois salariés relue trois jours plus tard peut ne pas revenir
 * dans le même ordre. Avec un indice, l'étape « voeux#7 », déjà envoyée à Alla, désignerait
 * soudain Redouane — et le moteur, voyant l'étape terminée, croirait Redouane servi.
 *
 * On prend donc une identité PORTÉE PAR LA DONNÉE, et l'indice seulement en dernier recours.
 */
export function identiteIteration(element: unknown, index: number): string {
  if (element === null || typeof element !== "object") return String(element ?? index);
  // L'ordre est celui de la STABILITÉ décroissante : un identifiant ne change jamais, une
  // adresse rarement, un nom parfois. Le nom figure quand même — il vaut infiniment mieux qu'un
  // index, qui, lui, change à chaque relecture de la liste dans un ordre différent.
  for (const champ of ["id", "employeeId", "userId", "email", "reference", "key", "nom", "name", "fullName"]) {
    const v = lire(element, champ);
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number") return String(v);
  }
  return `i${index}`;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA TUYAUTERIE ENTRE ÉTAPES — `{{cle_etape.chemin}}`, résolue par le moteur, jamais par le modèle.
 *
 * ── LE DÉFAUT MESURÉ ─────────────────────────────────────────────────────────────────────
 *
 * Le schéma du planificateur promettait depuis toujours : « Sortie d'une étape :
 * {{cle_etape.chemin}} ». Le moteur, lui, ne résolvait que les alias d'éventail
 * (`{{salarie.nom}}`). Une clé d'étape contient un deux-points (`analyse:coherence`) que le
 * motif ci-dessus n'acceptait même pas : `{{analyse:coherence.actionPaiement}}` partait donc
 * TEL QUEL vers l'outil, en toutes lettres. Sur le banc m5, quatre plans sur neuf composaient
 * leurs étapes ainsi — et tous échouaient à l'exécution, après l'accord du dirigeant.
 *
 * ── LES RÈGLES ───────────────────────────────────────────────────────────────────────────
 *
 *   • La clé d'étape est reconnue par le PLUS LONG PRÉFIXE parmi les clés de la mission : une
 *     clé peut contenir des points, et « recherche:contrat.resultats.0.id » se lit
 *     « étape recherche:contrat, chemin resultats.0.id ». Les indices numériques sont permis —
 *     un indice n'est pas une expression.
 *   • On DIAGNOSTIQUE avant d'injecter. Un chemin absent sur une étape aboutie est une faute
 *     de plan : l'étape échoue en nommant les champs disponibles, et la replanification a de
 *     quoi corriger. Une liste amont VIDE n'est pas une faute : il n'y a rien à traiter, l'étape
 *     est ignorée. Une étape amont non aboutie n'a pas de valeur : c'est dit, pas inventé.
 *   • Le résultat d'un chemin inconnu reste `undefined`, jamais la chaîne « {{…}} » : la règle
 *     du haut du fichier vaut ici aussi.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const MOTIF_REF = /\{\{\s*([A-Za-z0-9_][A-Za-z0-9_:\-.]*)\s*\}\}/g;
const SEUL_REF = /^\{\{\s*([A-Za-z0-9_][A-Za-z0-9_:\-.]*)\s*\}\}$/;

/** Toutes les références `{{…}}` d'une valeur, sans doublon, dans l'ordre de rencontre. */
export function referencesDe(valeur: unknown): string[] {
  const vues = new Set<string>();
  const visiter = (v: unknown): void => {
    if (typeof v === "string") {
      for (const m of v.matchAll(MOTIF_REF)) vues.add(m[1]);
    } else if (Array.isArray(v)) {
      v.forEach(visiter);
    } else if (v && typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach(visiter);
    }
  };
  visiter(valeur);
  return [...vues];
}

/**
 * QUELLE ÉTAPE UNE RÉFÉRENCE DÉSIGNE-T-ELLE ? Le plus long préfixe qui est une clé connue,
 * suivi d'un point ou de rien. `null` quand aucune clé ne correspond.
 */
export function resoudreReference(ref: string, cles: Iterable<string>): { cle: string; chemin: string } | null {
  let meilleure: string | null = null;
  for (const cle of cles) {
    if (ref === cle || ref.startsWith(`${cle}.`)) {
      if (meilleure === null || cle.length > meilleure.length) meilleure = cle;
    }
  }
  if (meilleure === null) return null;
  return { cle: meilleure, chemin: ref.length > meilleure.length ? ref.slice(meilleure.length + 1) : "" };
}

export type EtatReference = "OK" | "ETAPE_INCONNUE" | "ETAPE_NON_ABOUTIE" | "CHEMIN_ABSENT" | "COLLECTION_VIDE" | "PHRASE_ENTIERE";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE ÉTAPE QUI A RÉPONDU PAR UNE PHRASE N'A AUCUN CHAMP — donc la phrase EST sa valeur.
 *
 * ── LE DÉFAUT MESURÉ ────────────────────────────────────────────────────────────────────
 *
 * Cinquante-quatre outils du dépôt peuvent répondre par une PHRASE au lieu d'un objet :
 * « Aucune enveloppe budgétaire ne vous est ouverte. », « Aucun événement dans l'agenda du …
 * au … ». C'est la bonne réponse — honnête, lisible, et c'est celle qu'une personne veut. Sur
 * dix-huit d'entre eux, cette phrase entre AUSSI dans une mission : le planificateur, lui, a
 * écrit `{{lire:budget.totalDzd}}` en se fiant à la forme APPRISE — celle des jours où la
 * capacité a trouvé quelque chose. Le chemin se perdait donc dans une chaîne de caractères,
 * l'étape passait FAILED / INVALID_STEP / retryable:false, et TOUTE sa descendance restait
 * PENDING. Mesuré sur `directory_list` : dix étapes bloquées, dont les deux `send_message` qui
 * étaient l'objet du jalon, quatre personnes jamais sollicitées, zéro livrable (§118.99).
 *
 * ── CE QU'ON TRADUIT, ET POURQUOI CE N'EST PAS UNE DEVINETTE ────────────────────────────
 *
 * C'est §118.71 au niveau de l'ÉTAPE, avec le même raisonnement : une valeur scalaire n'a AUCUN
 * champ, donc la seule valeur qu'elle puisse offrir est elle-même. Le plan demandait « ce que
 * cette étape a produit » ; l'étape a produit cette phrase. Le WORKER en aval est un modèle : il
 * lit « Aucune enveloppe budgétaire ne vous est ouverte. » et le DIT. Échouer, au contraire, tue
 * une branche entière pour une réponse qui était juste.
 *
 * ── CE QU'ON REFUSE DE DEVINER ──────────────────────────────────────────────────────────
 *
 * Sur un OBJET, un champ absent parmi d'autres présents reste une vraie faute de chemin : y
 * substituer l'objet entier mettrait `{"nom":…,"email":…}` dans un destinataire (§118.71). Sur
 * une LISTE non plus : elle a une forme (des indices), et rendre le tableau entier à la place
 * d'un champ ferait passer un JSON pour une valeur. Et une phrase VIDE ne traduit rien — il n'y
 * a pas de valeur à offrir, l'absence reste une absence.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function phraseSansChamp(resultat: unknown): boolean {
  if (typeof resultat === "string") return resultat.trim() !== "";
  return typeof resultat === "number" || typeof resultat === "boolean";
}

export interface DiagnosticReference {
  ref: string;
  /** La clé d'étape reconnue — ou le premier segment quand aucune ne l'est. */
  etape: string;
  chemin: string;
  etat: EtatReference;
  /** Pour CHEMIN_ABSENT : ce que l'étape rend réellement à l'endroit où le chemin se perd. */
  disponibles: string[];
  /** Le statut de l'étape amont, pour le dire. */
  statut?: string;
}

export interface SortieAmont { status: string; result: unknown }

/**
 * DIAGNOSTIQUE chaque référence d'une valeur contre les sorties de la mission. Les alias
 * (`ignorer`) sont ceux d'un éventail non encore déployé : ils ne sont pas des étapes.
 */
export function diagnostiquerReferences(
  valeur: unknown,
  sorties: ReadonlyMap<string, SortieAmont>,
  ignorer: ReadonlySet<string> = new Set(),
): DiagnosticReference[] {
  const out: DiagnosticReference[] = [];
  for (const ref of referencesDe(valeur)) {
    const premier = ref.split(".")[0];
    if (ignorer.has(premier)) continue;
    const r = resoudreReference(ref, sorties.keys());
    if (!r) {
      out.push({ ref, etape: premier, chemin: "", etat: "ETAPE_INCONNUE", disponibles: [] });
      continue;
    }
    const amont = sorties.get(r.cle)!;
    if (amont.status !== "DONE") {
      out.push({ ref, etape: r.cle, chemin: r.chemin, etat: "ETAPE_NON_ABOUTIE", disponibles: [], statut: amont.status });
      continue;
    }
    if (r.chemin === "") {
      out.push({ ref, etape: r.cle, chemin: "", etat: "OK", disponibles: [] });
      continue;
    }
    // LA PHRASE EST LA VALEUR (voir `phraseSansChamp`). Ce n'est pas un chemin absent : il n'y a
    // aucun chemin à parcourir, et refuser ici tuerait la descendance d'une étape qui a répondu.
    if (phraseSansChamp(amont.result)) {
      out.push({ ref, etape: r.cle, chemin: r.chemin, etat: "PHRASE_ENTIERE", disponibles: [] });
      continue;
    }
    let courant: unknown = amont.result;
    let etat: EtatReference = "OK";
    let disponibles: string[] = [];
    for (const segment of r.chemin.split(".")) {
      if (Array.isArray(courant) && /^\d+$/.test(segment)) {
        const i = Number(segment);
        if (i >= courant.length) {
          etat = "COLLECTION_VIDE";
          break;
        }
        courant = courant[i];
        continue;
      }
      if (courant === null || typeof courant !== "object" || !Object.prototype.hasOwnProperty.call(courant, segment)) {
        etat = "CHEMIN_ABSENT";
        disponibles = cheminsDisponibles(courant);
        break;
      }
      courant = (courant as Record<string, unknown>)[segment];
    }
    if (etat === "OK" && courant === undefined) {
      etat = "CHEMIN_ABSENT";
    }
    out.push({ ref, etape: r.cle, chemin: r.chemin, etat, disponibles });
  }
  return out;
}

/**
 * INJECTE LES SORTIES D'ÉTAPES dans une valeur — après diagnostic, jamais à sa place.
 * Une référence seule rend la valeur telle quelle (un nombre reste un nombre, une liste une
 * liste) ; dans un texte, elle devient du texte. Une référence irrésolue devient `undefined`
 * (seule) ou une chaîne vide (dans un texte).
 */
export function injecterSorties(valeur: unknown, sorties: ReadonlyMap<string, unknown>): unknown {
  const valeurDe = (ref: string): unknown => {
    const r = resoudreReference(ref, sorties.keys());
    if (!r) return undefined;
    const base = sorties.get(r.cle);
    if (r.chemin === "") return base;
    // LA MÊME RÈGLE QUE LE DIAGNOSTIC, lue au même endroit : deux lectures du même fait dans
    // deux fonctions finiraient par ne plus dire la même chose, et le symptôme serait une étape
    // diagnostiquée résoluble qui reçoit `undefined` (§118.5).
    if (phraseSansChamp(base)) return base;
    return lire(base, r.chemin);
  };
  if (typeof valeur === "string") {
    const seul = SEUL_REF.exec(valeur);
    if (seul) return valeurDe(seul[1]);
    return valeur.replace(MOTIF_REF, (_brut, ref: string) => {
      const v = valeurDe(ref);
      if (v === undefined || v === null) return "";
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    });
  }
  if (Array.isArray(valeur)) return valeur.map((v) => injecterSorties(v, sorties));
  if (valeur && typeof valeur === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) out[k] = injecterSorties(v, sorties);
    return out;
  }
  return valeur;
}
