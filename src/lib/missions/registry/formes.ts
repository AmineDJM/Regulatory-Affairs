/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA FORME DE SORTIE D'UNE CAPACITÉ — apprise de ce qu'elle a RÉELLEMENT rendu.
 *
 * ── LE DÉFAUT MESURÉ, ET IL COÛTAIT LA MOITIÉ DES COMPOSITIONS ──────────────────────────
 *
 * Une mission de composition enchaîne des étapes : la seconde consomme la sortie de la
 * première en écrivant `{{recherche:contrat.resultats}}`. Pour écrire cette référence, le
 * planificateur doit savoir quels CHAMPS l'étape amont produira.
 *
 * Il ne le savait presque jamais. La seule source était `SORTIES`, une table écrite à la main
 * dans `platform/in-process/missions/catalog.ts` : **six** capacités sur deux cent vingt-neuf.
 * Pour les deux cent vingt-trois autres, le planificateur devinait — et une référence devinée
 * tombe à l'exécution, où le moteur répond « l'étape a abouti mais ne rend pas ce champ »,
 * marque l'étape FAILED / INVALID_STEP / retryable:false, et la mission meurt.
 *
 * Sur le banc des deux cents missions, la famille COMPOSITION faisait 1 réussite sur 13, et la
 * plus grosse part de ces échecs était exactement cela : une référence morte.
 *
 * Le commentaire au-dessus de `SORTIES` raconte d'ailleurs le même incident, déjà payé une
 * fois : « le banc m6 a payé une erreur ICI : resultats:[{id}] alors que la capacité rend
 * driveNodeId ». La réponse avait été d'écrire la forme à la main pour cet outil-là. Six fois.
 *
 * ── POURQUOI APPRENDRE PLUTÔT QUE DÉCLARER ──────────────────────────────────────────────
 *
 * Une table écrite à la main pour deux cent vingt-neuf capacités ne serait pas remplie, et si
 * elle l'était elle vieillirait au premier changement d'outil — silencieusement, ce qui est le
 * pire des cas : le planificateur croirait savoir. C'est la même raison qui interdit ailleurs
 * une table « mot-clé → domaine » dans le résolveur.
 *
 * Or la matière existe déjà. `MissionStep` garde le `result` de chaque étape aboutie — c'est
 * la même table où le registre (§44) lit la fiabilité. On y lit donc aussi la FORME : les noms
 * de champs qu'une capacité a réellement produits. Pas de seconde table (§17), pas d'entretien,
 * et une capacité dont la sortie change réapprend sa forme toute seule.
 *
 * ── CE QUE LA FORME NE CONTIENT JAMAIS ──────────────────────────────────────────────────
 *
 * **Aucune valeur métier.** Uniquement des noms de champs et des types. Ces formes partent dans
 * le prompt du planificateur ; y laisser passer un montant, un nom de salarié ou une adresse
 * ferait fuiter par la description ce que les droits protègent dans les données. `formeDe` ne
 * lit que `Object.keys` et `typeof` — jamais une valeur. `formes.test.ts` le vérifie sur des
 * données piégées.
 *
 * ── ZÉRO OBSERVATION N'EST PAS UNE FORME VIDE ───────────────────────────────────────────
 *
 * Une capacité jamais exécutée rend `observations: 0`, et l'appelant DOIT dire « forme
 * inconnue » plutôt que d'affirmer qu'elle ne rend rien. C'est la même règle que la fiabilité :
 * jamais mesurée ≠ mauvaise. Affirmer une forme vide ferait refuser des plans corrects.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce qu'un champ de sortie est, vu de l'extérieur — son nom, son type, sa constance. */
export interface Champ {
  nom: string;
  /** Le type observé, en un mot : texte, nombre, booleen, liste, objet, nul. */
  type: string;
  /** Vrai quand le champ était présent dans TOUTES les exécutions observées. */
  toujours: boolean;
}

/** La forme d'une sortie : ce que le planificateur doit savoir pour écrire une référence. */
export interface Forme {
  nature: "OBJET" | "LISTE" | "VALEUR" | "VIDE";
  /** Les champs de la racine, quand la sortie est un objet. Triés : constants d'abord. */
  champs: Champ[];
  /**
   * LA LISTE PRINCIPALE — celle sur laquelle un éventail se déploie.
   *
   * C'est l'information la plus chère du lot : un `forEachPath` qui vise le mauvais chemin ne
   * produit rien, et les six entrées écrites à la main ne disaient guère que cela
   * (« éventail sur resultats »). On la déduit au lieu de la déclarer.
   */
  liste: { chemin: string; elements: Champ[] } | null;
  /** Combien d'exécutions ont servi. ZÉRO = on ne sait pas, et il faut le DIRE. */
  observations: number;
  /**
   * COMBIEN D'EXÉCUTIONS ONT RÉPONDU PAR UNE VALEUR SIMPLE — une phrase, un nombre — sans le
   * moindre champ.
   *
   * ── LE DÉFAUT MESURÉ, ET IL ÉTAIT DANS LE MÉCANISME ÉCRIT POUR §118.20 ────────────────
   *
   * `formeDe` choisissait UNE nature : dès qu'une seule exécution avait rendu un objet, la
   * forme était OBJET et les exécutions qui avaient répondu par une PHRASE disparaissaient de
   * ce que le planificateur lisait. Pire, `toujours` se calculait sur les seules exécutions
   * OBJET : une capacité qui a répondu par une phrase deux fois sur dix voyait ses champs
   * annoncés comme présents à CHAQUE FOIS. Une promesse fausse, dans la ligne même que le
   * planificateur lit pour décider s'il peut écrire une référence.
   *
   * Recensé : cinquante-quatre outils du dépôt peuvent répondre par une phrase, dont dix-huit
   * capacités de mission sans contrat déclaré. C'est le défaut de §118.20 — la forme dépend de
   * la donnée — reproduit par le mécanisme censé le rendre visible.
   *
   * Un COMPTE, pas un booléen : « deux fois sur dix » et « neuf fois sur dix » ne se planifient
   * pas de la même façon, et un booléen aurait effacé cette différence.
   */
  valeursSimples: number;
}

export const FORME_INCONNUE: Forme = { nature: "VIDE", champs: [], liste: null, observations: 0, valeursSimples: 0 };

/** Le plafond de champs retenus — un brief part dans un prompt, il ne peut pas tout porter. */
export const CHAMPS_MAX = 14;
/** Le plafond d'exécutions relues par capacité : au-delà, la forme ne bouge plus. */
export const OBSERVATIONS_MAX = 40;

const typeDe = (v: unknown): string => {
  if (v === null || v === undefined) return "nul";
  if (Array.isArray(v)) return "liste";
  switch (typeof v) {
    case "string": return "texte";
    case "number": return "nombre";
    case "boolean": return "booleen";
    case "object": return "objet";
    default: return "inconnu";
  }
};

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * LES CHAMPS D'UNE COLLECTION D'OBJETS — noms et types seulement.
 *
 * `toujours` compare au nombre d'objets VUS, pas au nombre d'exécutions : sur une liste de
 * cinquante éléments dont un seul porte `note`, `note` n'est pas un champ sur lequel on peut
 * compter, et le planificateur doit le savoir avant d'écrire `{{x.resultats.0.note}}`.
 */
/**
 * LE DÉNOMINATEUR DE `toujours` EST LE NOMBRE D'OBSERVATIONS, jamais le nombre d'OBJETS.
 *
 * `total` était `objets.length` : une capacité observée dix fois, dont deux réponses en phrase,
 * voyait ses champs marqués présents à chaque fois — la seule ligne que le planificateur lit
 * pour savoir sur quoi il peut compter portait une promesse fausse. Le dénominateur est donc
 * passé par l'appelant, qui seul sait combien d'exécutions ont réellement servi.
 */
function champsDe(objets: readonly Record<string, unknown>[], observations: number): Champ[] {
  const vus = new Map<string, { n: number; types: Set<string> }>();
  for (const o of objets) {
    for (const [nom, v] of Object.entries(o)) {
      // Un champ préfixé `_` est une plomberie interne (`_blocs`, `_provenance`) : il n'est pas
      // destiné à être référencé par une étape aval, et l'exposer inviterait à s'en servir.
      if (nom.startsWith("_")) continue;
      let e = vus.get(nom);
      if (!e) { e = { n: 0, types: new Set() }; vus.set(nom, e); }
      e.n += 1;
      e.types.add(typeDe(v));
    }
  }
  const total = Math.max(observations, objets.length);
  return [...vus.entries()]
    .map(([nom, e]) => ({
      nom,
      // Un champ qui a été vu tantôt texte tantôt nul reste « texte » : `nul` décrit une absence
      // de valeur, pas un type, et l'annoncer masquerait le type utile.
      type: [...e.types].filter((t) => t !== "nul")[0] ?? "nul",
      toujours: e.n === total,
    }))
    .sort((a, b) => Number(b.toujours) - Number(a.toujours) || a.nom.localeCompare(b.nom))
    .slice(0, CHAMPS_MAX);
}

/**
 * LA LISTE PRINCIPALE d'une sortie : le champ tableau d'objets le plus fourni.
 *
 * « Le plus fourni » et non « le premier » : une sortie porte souvent une petite liste
 * accessoire (`sources`, `alertes`) à côté de la vraie collection. Prendre la première ferait
 * déployer un éventail sur les avertissements.
 */
function listePrincipale(echantillons: readonly Record<string, unknown>[]): { chemin: string; elements: Champ[] } | null {
  const parChamp = new Map<string, Record<string, unknown>[]>();
  for (const o of echantillons) {
    for (const [nom, v] of Object.entries(o)) {
      if (nom.startsWith("_") || !Array.isArray(v)) continue;
      const objets = v.filter(estObjet);
      if (objets.length === 0) continue;
      const acc = parChamp.get(nom) ?? [];
      acc.push(...objets);
      parChamp.set(nom, acc);
    }
  }
  if (parChamp.size === 0) return null;
  const [chemin, objets] = [...parChamp.entries()].sort((a, b) => b[1].length - a[1].length)[0]!;
  // POUR UN ÉLÉMENT DE LISTE, « toujours » se juge sur les ÉLÉMENTS, pas sur les exécutions :
  // c'est chaque élément qui porte le champ que l'éventail lira.
  return { chemin, elements: champsDe(objets, objets.length) };
}

/**
 * APPREND LA FORME depuis des sorties réellement observées.
 *
 * Les entrées `null`/`undefined` sont IGNORÉES et non comptées : une étape aboutie qui n'a rien
 * rendu ne dit rien de la forme, et la compter ferait passer tous les champs pour occasionnels.
 */
export function formeDe(sorties: readonly unknown[]): Forme {
  const utiles = sorties.filter((s) => s !== null && s !== undefined).slice(0, OBSERVATIONS_MAX);
  if (utiles.length === 0) return FORME_INCONNUE;

  // LES RÉPONSES SANS AUCUN CHAMP SONT COMPTÉES, jamais absorbées par la nature dominante.
  const simples = utiles.filter((s) => !estObjet(s) && !Array.isArray(s)).length;

  const objets = utiles.filter(estObjet);
  if (objets.length > 0) {
    return {
      nature: "OBJET",
      champs: champsDe(objets, utiles.length),
      liste: listePrincipale(objets),
      observations: utiles.length,
      valeursSimples: simples,
    };
  }

  const listes = utiles.filter((s): s is unknown[] => Array.isArray(s));
  if (listes.length > 0) {
    const elements = listes.flat().filter(estObjet);
    return {
      nature: "LISTE",
      champs: [],
      // Une sortie qui EST une liste se déploie à la racine : le chemin est vide, et l'appelant
      // doit le dire ainsi — c'est le cas de `list_my_tasks`, écrit à la main jusqu'ici.
      liste: elements.length > 0 ? { chemin: "", elements: champsDe(elements, elements.length) } : null,
      observations: utiles.length,
      valeursSimples: simples,
    };
  }

  return { nature: "VALEUR", champs: [], liste: null, observations: utiles.length, valeursSimples: simples };
}

/**
 * DIT LA FORME EN UNE LIGNE, pour le brief du planificateur.
 *
 * Le format imite celui des six entrées écrites à la main — elles avaient trouvé la bonne
 * formulation, c'est leur ENTRETIEN qui était intenable. Un champ occasionnel porte « ? » :
 * le planificateur doit pouvoir distinguer ce sur quoi il peut compter.
 */
export function direForme(f: Forme): string | null {
  if (f.observations === 0) return null;
  const nom = (c: Champ) => `${c.nom}${c.toujours ? "" : "?"}`;
  const vu = `vu sur ${f.observations} exécution${f.observations > 1 ? "s" : ""}`;

  /**
   * ── QUAND UNE PART DES EXÉCUTIONS N'A RENDU AUCUN CHAMP ─────────────────────────────
   *
   * Ce n'est pas un détail de forme : c'est la branche « je n'ai rien trouvé » de la capacité,
   * et c'est celle qui tue les plans. On la dit avec son COMPTE — « 2 fois sur 10 » et « 9 fois
   * sur 10 » ne se planifient pas pareil — et on nomme le geste SÛR (§118.26, §118.30) :
   * référencer l'étape ENTIÈRE, que le moteur résout toujours, phrase comprise.
   */
  const partSimple = f.valeursSimples > 0
    ? ` — ATTENTION : ${f.valeursSimples} exécution${f.valeursSimples > 1 ? "s" : ""} sur ${f.observations} `
      + `${f.valeursSimples > 1 ? "ont" : "a"} répondu par une PHRASE, sans aucun champ (la branche « rien trouvé ») ; `
      + "pour ce cas, réfère l'étape ENTIÈRE « {{cle}} » plutôt qu'un champ"
    : "";

  if (f.nature === "LISTE") {
    const el = f.liste ? ` de { ${f.liste.elements.map(nom).join(", ")} }` : "";
    return `rend une LISTE à la racine${el} — éventail sur la racine${partSimple} (${vu})`;
  }
  if (f.nature === "VALEUR") {
    // Aucune exécution n'a rendu de champ : il n'y a rien à référencer, et le dire évite au
    // planificateur d'écrire un chemin que le moteur devra traduire.
    return `rend une valeur simple — AUCUN champ à référencer, réfère l'étape ENTIÈRE « {{cle}} » (${vu})`;
  }
  if (f.nature === "OBJET") {
    const racine = f.champs.map(nom).join(", ");
    const ev = f.liste
      ? ` — éventail sur « ${f.liste.chemin} », dont les éléments portent { ${f.liste.elements.map(nom).join(", ")} }`
      : "";
    /**
     * ── UNE SORTIE SANS AUCUN CHAMP GARANTI N'EST PAS UN CONTRAT ────────────────────────
     *
     * MESURÉ sur la chaîne humaine live. `resolve_person` rendait DEUX formes selon la donnée :
     * `{certain, candidats}` quand il trouvait, `{resultat, precision}` sinon. La forme apprise
     * était donc, honnêtement, `{ candidats?, certain?, precision?, resultat? }` — QUATRE champs
     * occasionnels et pas un seul sûr. Le planificateur, qui écrit ses références AVANT de
     * savoir ce que la recherche rendra, n'avait aucune bonne réponse. Il a parié deux fois :
     *
     *   « {{annuaire:amel.resultat}} » — champs disponibles : certain, candidats.
     *   « {{annuaire:yacine.candidats.0.nom}} » — champs disponibles : resultat, precision.
     *
     * Chaque pari perdu a coûté une étape morte ET une replanification entière (plan v4,
     * 46 étapes, 0,33 $ au lieu de 0,20 $).
     *
     * Le « ? » disait déjà la vérité, mais noyé dans une énumération il se lit comme un
     * catalogue d'options. Quand AUCUN champ n'est garanti, on le dit en clair et on nomme la
     * sortie sûre : l'éventail, dont les éléments, eux, ont des champs constants. C'est aussi
     * le signal que la capacité a un contrat à réparer — un module qui change de forme selon
     * son résultat est un contrat qu'aucun appelant ne peut honorer.
     */
    const aucunSur = f.champs.length > 0 && f.observations > 1 && f.champs.every((c) => !c.toujours);
    const alerte = aucunSur
      ? ` — ATTENTION : AUCUN de ces champs n'est présent à chaque fois ; n'écris de référence sur aucun`
        + (f.liste ? `, passe par l'éventail « ${f.liste.chemin} »` : `, fais-la lire par une étape WORKER`)
      : "";
    return `rend { ${racine} }${ev}${alerte}${partSimple} (${vu})`;
  }
  return null;
}

/**
 * LE CHEMIN EST-IL PLAUSIBLE dans cette forme ?
 *
 * Sert au compilateur à refuser une référence morte AVANT l'exécution. Trois réponses, et la
 * troisième est celle qui compte : `null` veut dire « je ne sais pas », et on ne refuse jamais
 * sur une ignorance. Refuser un plan correct parce qu'une capacité n'a jamais tourné serait
 * échanger un défaut contre un pire.
 */
export function cheminPlausible(f: Forme, chemin: string): boolean | null {
  if (f.observations === 0) return null;
  const segments = chemin.split(".").filter(Boolean);
  if (segments.length === 0) return true;

  const premier = segments[0]!;
  // Un index numérique en tête ne vaut que sur une sortie qui EST une liste.
  if (/^\d+$/.test(premier)) return f.nature === "LISTE" ? true : null;

  if (f.nature === "LISTE") {
    // `{{etape.nom}}` sur une liste racine : c'est l'élément qui porte le champ, et l'éventail
    // le résout à l'exécution. On ne tranche pas.
    return f.liste?.elements.some((c) => c.nom === premier) ? true : null;
  }
  if (f.nature !== "OBJET") return null;

  const connu = f.champs.some((c) => c.nom === premier);
  if (!connu) return false;
  if (segments.length === 1) return true;

  // Au-delà du premier segment on ne descend que dans la liste principale, la seule dont on
  // connaisse les éléments. Ailleurs, on s'abstient plutôt que d'inventer une profondeur.
  if (f.liste && premier === f.liste.chemin) {
    const suite = segments.slice(1).filter((s) => !/^\d+$/.test(s));
    if (suite.length === 0) return true;
    return f.liste.elements.some((c) => c.nom === suite[0]) ? true : false;
  }
  return null;
}
