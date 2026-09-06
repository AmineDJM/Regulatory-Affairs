import type { CapabilityBrief, CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import { decrireEntrees } from "@/lib/missions/registry/input-contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RÉSOLVEUR DE CAPACITÉS (§3) — ce que le planner a le droit de VOIR.
 *
 * ── LE DÉFAUT QU'IL CORRIGE ──────────────────────────────────────────────────────────────
 *
 * La façon évidente de faire planifier un modèle est de lui envoyer tous les outils. Avec cent
 * soixante-cinq capacités, cela coûte des dizaines de milliers de jetons par appel, dilue
 * l'attention sur des outils sans rapport, et — le plus coûteux — rend la mesure inutile : on
 * ne sait plus si un mauvais plan vient du modèle ou du bruit qu'on lui a servi.
 *
 * ── LE PRINCIPE : LA PERTINENCE SE CALCULE, ELLE NE SE CODE PAS EN DUR ───────────────────
 *
 * On aurait pu écrire une table « mot-clé → domaine ». Elle aurait vieilli en silence : une
 * capacité ajoutée un mardi resterait invisible au planner jusqu'à ce que quelqu'un pense à
 * l'inscrire. Ici le score se calcule sur ce que la capacité DIT d'elle-même (son nom, son
 * domaine, sa phrase de résumé) confronté à ce que la personne a demandé. Une nouvelle capacité
 * correctement résumée devient trouvable le jour même, sans toucher à ce fichier.
 *
 * Il reste un petit dictionnaire de SYNONYMES, et il est assumé : « voeux » ne partage aucun
 * mot avec « envoie un e-mail préparé », et pourtant c'est bien de cela qu'il s'agit. Il ne
 * porte que des mots de la langue, jamais un nom de capacité — sinon on retomberait sur la
 * table qui vieillit.
 *
 * ── LA SÉCURITÉ EST EN AMONT, PAS ICI ────────────────────────────────────────────────────
 *
 * Ce fichier n'accorde RIEN. `catalog.brief(actor)` a déjà filtré par les droits de la personne :
 * ce qui n'y est pas ne peut pas être proposé, quel que soit le score. Le résolveur ne fait que
 * RÉDUIRE un ensemble déjà autorisé — c'est-à-dire qu'un bug ici coûte un mauvais plan, jamais
 * une élévation de privilège.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Mots vides français et anglais — ils apparaissent partout et ne discriminent rien. */
const VIDES = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "a", "à", "au", "aux", "en",
  "pour", "par", "sur", "dans", "avec", "sans", "que", "qui", "quoi", "dont", "ce", "cet",
  "cette", "ces", "son", "sa", "ses", "leur", "leurs", "il", "elle", "ils", "elles", "je",
  "tu", "nous", "vous", "on", "est", "sont", "etre", "avoir", "fait", "faire", "puis",
  "ensuite", "alors", "tous", "toutes", "tout", "toute", "chaque", "plus", "moins", "the",
  "and", "for", "with", "from", "then", "each", "all", "lui", "moi", "y", "d", "l", "s", "n",
  "qu", "c", "j", "m", "t", "quand", "lorsque", "aussi", "bien", "tres", "peu", "me", "te",
]);

/**
 * LES SYNONYMES — de la langue vers le vocabulaire des capacités.
 *
 * Chaque entrée est là parce qu'un mot courant de la maison ne se retrouve dans AUCUN résumé de
 * capacité. Ajouter ici un nom de capacité serait une faute : ce dictionnaire traduit du
 * français vers du français.
 */
export const SYNONYMES: Record<string, string[]> = {
  // « chacun », « individuellement », « un par un » disent une LISTE : c'est la capacité qui
  // ÉNUMÈRE qu'il faut montrer au planner, pas seulement celle qui envoie. Sans ces entrées, une
  // mission d'envoi individuel recevait de quoi écrire et rien pour savoir à qui.
  chacun: ["liste", "list", "individuel"],
  chacune: ["liste", "list", "individuel"],
  individuellement: ["liste", "list", "individuel"],
  individuel: ["liste", "list"],
  individuels: ["liste", "list"],
  liste: ["liste", "list"],
  lister: ["liste", "list"],
  voeux: ["email", "message", "envoi"],
  bonne: ["email"],
  annee: ["email"],
  mail: ["email", "courriel"],
  mails: ["email", "courriel"],
  courriel: ["email"],
  ecrire: ["email", "message"],
  ecris: ["email", "message"],
  envoie: ["email", "message", "envoi"],
  envoyer: ["email", "message", "envoi"],
  prevenir: ["notification", "message"],
  previens: ["notification", "message"],
  salaries: ["employe", "personnel", "rh", "effectif"],
  salarie: ["employe", "personnel", "rh"],
  employes: ["employe", "personnel", "rh", "effectif"],
  collaborateurs: ["employe", "personnel", "rh"],
  equipe: ["employe", "personnel", "rh"],
  contrat: ["contrat", "legal", "rh"],
  contrats: ["contrat", "legal", "rh"],
  cdi: ["contrat", "rh"],
  cdd: ["contrat", "rh"],
  courriers: ["courrier", "document", "drive"],
  courrier: ["courrier", "document", "drive"],
  classer: ["document", "drive", "classement"],
  classement: ["document", "drive"],
  ranger: ["document", "drive", "classement"],
  fichier: ["document", "drive"],
  fichiers: ["document", "drive"],
  dossier: ["document", "drive", "dossier"],
  dossiers: ["document", "drive", "dossier"],
  tableau: ["export", "excel", "tableur"],
  excel: ["export", "tableur"],
  chiffres: ["montant", "budget", "finance"],
  marche: ["marche", "pch", "appel"],
  marches: ["marche", "pch", "appel"],
  vente: ["vente", "commercial", "marche"],
  ventes: ["vente", "commercial", "marche"],
  kpi: ["indicateur", "performance", "activite"],
  kpis: ["indicateur", "performance", "activite"],
  performance: ["indicateur", "activite"],
  relancer: ["relance", "rappel", "tache"],
  relance: ["rappel", "tache"],
  demande: ["tache", "demande"],
  demander: ["tache", "demande"],
  reunion: ["agenda", "calendrier", "reunion"],
  facture: ["facture", "finance", "paiement"],
  factures: ["facture", "finance", "paiement"],
  paiement: ["paiement", "finance"],
  budget: ["budget", "finance"],
  stock: ["stock", "logistique"],
  stocks: ["stock", "logistique"],
  anomalie: ["anomalie", "controle", "statistique"],
  anomalies: ["anomalie", "controle", "statistique"],

  // ── LE VOCABULAIRE DU DOUTE, DE LA FORME ET DU LIVRABLE ────────────────────────────────
  //
  // Ajouté après le banc des deux cents missions, où STATISTIQUES faisait 0/17, REPRESENTATION
  // 2/17 et la cause dominante était « le plan ne prévoit pas CALCUL ». Le planificateur ne
  // refusait pas de calculer : `calcul_statistiques` ne lui était PAS MONTRÉE, parce qu'une
  // personne ne demande jamais « une significativité » — elle demande si l'écart est
  // « significatif ou du bruit », si les mois sont « anormaux », s'il y a un « lien » entre deux
  // choses. Aucun de ces mots n'apparaît dans un résumé de capacité.
  //
  // C'est exactement ce que ce dictionnaire est fait pour : il traduit du français vers du
  // français, jamais vers un nom de capacité. Chaque mot de droite a été VÉRIFIÉ présent dans
  // au moins un résumé du catalogue réel — une traduction vers un mot que personne n'emploie
  // ne ferait rien marquer et donnerait l'illusion d'avoir corrigé quelque chose.
  significatif: ["statistique", "significativite", "regression"],
  significative: ["statistique", "significativite", "regression"],
  significativement: ["statistique", "significativite"],
  bruit: ["statistique", "significativite"],
  hasard: ["statistique", "significativite"],
  aleatoire: ["statistique", "significativite"],
  correlation: ["statistique", "regression"],
  correlations: ["statistique", "regression"],
  correle: ["statistique", "regression"],
  lien: ["statistique", "regression"],
  anormal: ["anomalie", "statistique"],
  anormaux: ["anomalie", "statistique"],
  anormale: ["anomalie", "statistique"],
  aberrant: ["anomalie", "statistique"],
  aberrants: ["anomalie", "statistique"],
  inhabituel: ["anomalie", "statistique"],
  inhabituels: ["anomalie", "statistique"],
  tendance: ["tendance", "serie", "statistique"],
  tendances: ["tendance", "serie", "statistique"],
  degrade: ["tendance", "serie", "statistique"],
  degradent: ["tendance", "serie", "statistique"],
  evolution: ["tendance", "serie"],
  evolue: ["tendance", "serie"],
  prevision: ["serie", "statistique"],
  prevoir: ["serie", "statistique"],
  projeter: ["serie", "statistique"],
  echantillon: ["statistique", "significativite"],
  // La forme : « montre-moi », « tableau de bord », « graphique » veulent une REPRÉSENTATION.
  graphique: ["graphique", "representation"],
  graphiques: ["graphique", "representation"],
  visualiser: ["graphique", "representation"],
  visualisation: ["graphique", "representation"],
  bord: ["graphique", "representation", "tableau"],
  courbe: ["graphique", "representation"],
  camembert: ["graphique", "representation"],
  histogramme: ["graphique", "representation"],
  ventilation: ["repartition", "graphique"],
  repartition: ["repartition", "graphique"],
  // Le livrable : « rédige », « note », « synthèse » veulent un DOCUMENT, pas une lecture.
  rediger: ["rapport", "synthese", "document"],
  redige: ["rapport", "synthese", "document"],
  note: ["rapport", "synthese", "document"],
  synthese: ["rapport", "synthese", "document"],
  memo: ["rapport", "synthese", "document"],
  compte: ["rapport", "synthese"],
  rendu: ["rapport", "synthese"],
};

/** Repli d'accents et découpe en jetons signifiants. */
export function jetons(texte: string): string[] {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !VIDES.has(t));
}

/** Les jetons de la demande, ENRICHIS des synonymes — c'est ce qu'on confronte aux capacités. */
export function jetonsEtendus(texte: string): Set<string> {
  const out = new Set<string>();
  for (const t of jetons(texte)) {
    out.add(t);
    // Un radical court capte les accords : « salaries » → « salarie » → « employe ».
    if (t.length > 4) out.add(t.slice(0, t.length - 1));
    for (const s of SYNONYMES[t] ?? []) out.add(s);
  }
  return out;
}

/**
 * LE SCORE D'UNE CAPACITÉ.
 *
 * Le nom pèse plus lourd que le résumé, et le domaine plus lourd qu'un mot isolé du résumé :
 * un outil qui s'APPELLE « send_email » est plus sûrement le bon outil qu'un outil dont le
 * résumé mentionne un e-mail en passant.
 */
export function scoreCapacite(brief: CapabilityBrief, demande: Set<string>): number {
  let score = 0;
  const nom = jetons(brief.id);
  const resume = jetons(brief.summary);
  const domaine = jetons(brief.domain);

  for (const t of nom) if (demande.has(t)) score += 4;
  for (const t of domaine) if (demande.has(t)) score += 3;
  for (const t of resume) if (demande.has(t)) score += 1;

  // ── LE PRÉFIXE COMPTE AUSSI DANS LE RÉSUMÉ, ET C'EST CE QUI MANQUAIT ────────────────────
  //
  // DÉFAUT MESURÉ AU BANC DES DEUX CENTS MISSIONS. « Est-ce que l'écart est SIGNIFICATIF ou du
  // bruit ? » ne marquait pas `calcul_statistiques`, dont le résumé porte pourtant
  // « SIGNIFICATIVITÉ ». Les deux mots sont la même famille ; l'égalité stricte les sépare, et
  // `jetonsEtendus` produit « significati » d'un côté, « significativite » de l'autre.
  //
  // Le rattrapage par préfixe existait déjà — mais seulement quand le score valait ZÉRO, et
  // seulement sur le nom et le domaine. Or c'est précisément dans le RÉSUMÉ que vit le
  // vocabulaire métier d'une capacité, et une capacité qui marque 1 point par ailleurs n'avait
  // droit à aucun rattrapage. Conséquence : STATISTIQUES 0/17, et « le plan ne prévoit pas
  // CALCUL » en tête des causes d'échec du banc — le planificateur ne voyait pas le moteur.
  //
  // Le poids reste MOINDRE qu'une correspondance exacte : un préfixe partagé est un indice, pas
  // une preuve. Il élargit ce qu'on MONTRE au planificateur ; il ne décide de rien à sa place,
  // et la sélection reste bornée par `limite`.
  const PREFIXE_MIN = 5;
  const parPrefixe = (mots: readonly string[]): number => {
    let n = 0;
    for (const t of mots) {
      if (t.length < PREFIXE_MIN || demande.has(t)) continue;
      for (const d of demande) {
        if (d.length >= PREFIXE_MIN && (t.startsWith(d.slice(0, PREFIXE_MIN)) || d.startsWith(t.slice(0, PREFIXE_MIN)))) { n += 1; break; }
      }
    }
    return n;
  };
  score += parPrefixe(nom) * 2;
  score += parPrefixe(domaine) * 1.5;
  score += parPrefixe(resume) * 0.5;
  return score;
}

export interface ResolutionOptions {
  /** Combien de capacités au maximum sont montrées au planner. */
  limite?: number;
  /** Le plancher par domaine retenu : ne jamais montrer un domaine avec une seule capacité. */
  parDomaine?: number;
  /** Des capacités que l'appelant sait indispensables (une reprise, un replan ciblé). */
  imposees?: readonly string[];
  /** Combien de domaines participent au tourniquet. Au-delà, la sélection se dilue. */
  maxDomaines?: number;
  /**
   * LE SEUIL DE PERTINENCE, en fraction du meilleur score.
   *
   * Il ne s'applique qu'au REMPLISSAGE des places restantes, après le tourniquet par domaine.
   * Relatif et non absolu : une demande écrite avec les mots du catalogue marque haut partout,
   * une demande orale marque bas partout, et un seuil fixe trancherait au mauvais endroit dans
   * l'un des deux cas.
   */
  seuilRelatif?: number;
  /** Le plancher absolu — en dessous, un seul mot commun ne fait pas une pertinence. */
  seuilMinimum?: number;
}

export interface Resolution {
  /** Ce que le planner verra, dans l'ordre de pertinence. */
  capacites: CapabilityBrief[];
  /** Les domaines retenus, du plus pertinent au moins. */
  domaines: string[];
  metriques: {
    /** Le nombre de capacités OUVERTES à cette personne — le dénominateur honnête. */
    capacitesAutorisees: number;
    /** Ce qu'on a réellement montré (§3 `plannerCapabilitiesExposed`). */
    plannerCapabilitiesExposed: number;
    /** Combien de capacités ont obtenu un score non nul. */
    capacitesPertinentes: number;
    /** Les jetons économisés : le catalogue complet moins ce qu'on envoie. */
    jetonsEvites: number;
  };
}

/** Les gestes de suivi d'un chef de cabinet — montrés au planificateur quelle que soit la demande (sous droits). */
export const SUIVI_UNIVERSEL: readonly string[] = ["create_task", "plan_reminder", "send_message", "watch_entity", "create_calendar_event"];

const poidsBrief = (b: CapabilityBrief): number =>
  Math.ceil((b.id.length + b.summary.length + b.domain.length + 24) / 3.6);

/**
 * RÉSOUT LES CAPACITÉS PERTINENTES POUR UN OBJECTIF.
 *
 * L'ordre compte : on classe, on garde les domaines des meilleures, puis on complète chaque
 * domaine retenu jusqu'à son plancher. Ce dernier point n'est pas cosmétique — montrer
 * `send_email` sans montrer `directory_list` produit un plan qui envoie un e-mail à personne.
 */
export function resoudreCapacites(
  objectif: string,
  catalogue: CapabilityCatalog,
  acteur: MissionActor,
  opts: ResolutionOptions = {},
): Resolution {
  const limite = opts.limite ?? 28;
  const parDomaine = opts.parDomaine ?? 3;
  const toutes = catalogue.brief(acteur);
  const demande = jetonsEtendus(objectif);

  const notes = toutes
    .map((b) => ({ b, score: scoreCapacite(b, demande) }))
    .sort((x, y) => y.score - x.score || x.b.id.localeCompare(y.b.id));

  const pertinentes = notes.filter((n) => n.score > 0);

  // LES DOMAINES RETENUS : ceux des capacités qui ont réellement marqué. Si rien ne marque —
  // une demande formulée dans des mots qu'aucune capacité n'emploie — on ne devine pas : on
  // prend les mieux classées, et `gaps` dira au planner ce qu'il n'a pas trouvé.
  // LES DOMAINES SONT CLASSÉS PAR LEUR MEILLEUR SCORE, et bornés. Sans borne, une demande qui
  // effleure douze domaines donne à chacun une part égale du tourniquet : le domaine central
  // n'obtient qu'une capacité, et onze domaines sans rapport en obtiennent une aussi.
  const meilleurParDomaine = new Map<string, number>();
  for (const n of pertinentes) {
    meilleurParDomaine.set(n.b.domain, Math.max(meilleurParDomaine.get(n.b.domain) ?? 0, n.score));
  }
  const domaines = [...meilleurParDomaine.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, opts.maxDomaines ?? 5)
    .map(([d]) => d);

  const retenues = new Map<string, CapabilityBrief>();
  const ajouter = (b: CapabilityBrief): boolean => {
    if (retenues.has(b.id) || retenues.size >= limite) return false;
    retenues.set(b.id, b);
    return true;
  };

  for (const nom of opts.imposees ?? []) {
    const b = toutes.find((x) => x.id === nom);
    if (b) ajouter(b);
  }

  /**
   * ── LES GESTES DE SUIVI SONT TOUJOURS VISIBLES ─────────────────────────────────────────
   *
   * Mesuré sur le banc : « fais en sorte qu'on ne rate aucune échéance réglementaire critique »
   * a reçu quinze capacités — paie, salaires, médecins — et AUCUNE pour poser un rappel ou une
   * tâche : le mot « échéance » n'apparaît pas dans le résumé de `plan_reminder`. Le planificateur
   * a écrit, honnêtement, « aucune capacité ne permet de créer les rappels » — et la mission s'est
   * conclue sans suivi. Un chef de cabinet finit presque toute mission par un geste de suivi
   * (une tâche, un rappel, un message, une surveillance, une réunion) : ces cinq-là ne se
   * gagnent pas au score, elles sont là — sous les droits de la personne, jamais au-delà — et
   * elles COMPTENT dans la limite : la borne de §3 reste stricte, ce sont les dernières du
   * classement global qui leur cèdent la place, pas la lisibilité du catalogue.
   */
  for (const nom of SUIVI_UNIVERSEL) {
    const b = toutes.find((x) => x.id === nom);
    if (b) ajouter(b);
  }

  // ── LA SÉLECTION EST UN TOURNIQUET ENTRE DOMAINES, PAS UN CLASSEMENT GLOBAL ──────────
  //
  // La première écriture prenait simplement les mieux classées. Sur cent soixante-cinq outils,
  // « envoie un message à chaque salarié » remplissait ses vingt-huit places avec des capacités
  // de MESSAGERIE — et `directory_list`, qui produit la liste sans laquelle il n'y a personne à
  // qui écrire, arrivait vingt-neuvième. Le planner recevait de quoi envoyer et rien pour savoir
  // à qui : le plan qui en sort est cohérent et inexécutable.
  //
  // Le tourniquet garantit qu'un domaine PERTINENT est représenté avant qu'un autre domaine
  // pertinent ne prenne une deuxième, troisième et quatrième place.
  const classees = new Map<string, { b: CapabilityBrief; score: number }[]>();
  for (const n of notes) {
    classees.set(n.b.domain, [...(classees.get(n.b.domain) ?? []), n]);
  }

  // Le tourniquet ne prend que le PLANCHER par domaine ; le reste des places revient au
  // classement global. Sans cette borne, cinq domaines se partageraient les vingt-huit places à
  // parts égales, et la cinquième capacité d'un domaine marginal passerait devant la deuxième du
  // domaine central.
  for (let rang = 0; rang < parDomaine && retenues.size < limite; rang++) {
    for (const d of domaines) {
      if (retenues.size >= limite) break;
      const liste = classees.get(d) ?? [];
      // Au premier tour on prend la meilleure de chaque domaine pertinent ; aux tours suivants
      // on complète. Le PLANCHER (`parDomaine`) autorise à prendre une capacité qui n'a rien
      // marqué : c'est là que vivent les lectures qui alimentent l'action — `directory_list` ne
      // parle pas de « bonne année », et c'est pourtant elle qui donne la liste des gens.
      const candidate = liste.find((n) => !retenues.has(n.b.id));
      if (candidate) ajouter(candidate.b);
    }
  }

  /**
   * ── LE SEUIL DE PERTINENCE — ce qui reste des places ne se donne pas au premier venu ────
   *
   * Cette boucle remplissait jusqu'à la limite tout ce qui marquait ne serait-ce qu'UN point.
   * Un run réel l'a chiffré : 28 capacités montrées au planner, 3 à 5 réellement retenues dans
   * le plan compilé, pour 9 095 caractères de résumés — de l'ordre de 2 300 jetons dans CHAQUE
   * prompt de planification, dont les entrées mesuraient 4 200 à 5 100. Près de la moitié du
   * prompt décrivait des outils que le plan n'a pas utilisés.
   *
   * Le coût n'est pas que financier. Vingt-trois capacités hors sujet sont vingt-trois pistes
   * qu'un modèle examine avant de les écarter — et c'est du temps de réflexion, donc de la
   * latence, sur le maillon le plus lent de la chaîne.
   *
   * ── POURQUOI CE SEUIL NE CACHE PAS UNE CAPACITÉ UTILE ───────────────────────────────────
   *
   * Il ne s'applique QU'À CETTE BOUCLE. Les capacités imposées sont déjà entrées ; le
   * tourniquet par domaine, qui est la vraie garde — celle qui fait passer `directory_list`
   * devant la cinquième capacité de messagerie — a déjà rempli son plancher AVANT. Ce qu'on
   * coupe ici, c'est la QUEUE : ce qui a effleuré un mot de la demande sans jamais la
   * concerner. Un score relatif plutôt qu'absolu, parce qu'une demande formulée avec les mots
   * exacts du catalogue marque haut partout, et une demande orale marque bas partout.
   */
  const meilleur = pertinentes[0]?.score ?? 0;
  const seuil = Math.max(opts.seuilMinimum ?? 2, meilleur * (opts.seuilRelatif ?? 0.25));
  for (const n of pertinentes) {
    if (retenues.size >= limite) break;
    if (n.score < seuil) break; // `pertinentes` est trié : tout ce qui suit est plus faible.
    ajouter(n.b);
  }

  // Rien n'a marqué — une demande formulée dans des mots qu'aucune capacité n'emploie. On montre
  // les mieux classées plutôt que rien : un planner sans capacité ne produit pas un plan honnête,
  // il produit un plan vide.
  if (retenues.size === 0) for (const n of notes.slice(0, limite)) ajouter(n.b);


  const capacites = [...retenues.values()];
  const totalCatalogue = toutes.reduce((s, b) => s + poidsBrief(b), 0);
  const totalMontre = capacites.reduce((s, b) => s + poidsBrief(b), 0);

  return {
    capacites,
    domaines,
    metriques: {
      capacitesAutorisees: toutes.length,
      plannerCapabilitiesExposed: capacites.length,
      capacitesPertinentes: pertinentes.length,
      jetonsEvites: Math.max(0, totalCatalogue - totalMontre),
    },
  };
}

/** Les capacités, mises en forme pour le prompt. Une ligne chacune — c'est tout le propos. */
export function listerPourPlanner(capacites: readonly CapabilityBrief[]): string {
  return capacites
    .map((c) => `- ${c.id} [${c.primitive ? `${c.primitive.toLowerCase()} · ` : ""}${c.domain} · effet ${c.effect}${c.batchable ? " · répétable" : ""}] — ${c.summary}`
      // LE CONTRAT D'ENTRÉE, SUR LA MÊME LIGNE. C'est ce qui remplace la devinette des clés
      // (`message` pour `body`) par une lecture : le planificateur ne peut plus ignorer ce que
      // l'outil lit, et le compilateur refuse ce qui s'en écarte (INVALID_INPUT).
      + (c.entrees ? ` — ${decrireEntrees(c.entrees)}` : ""))
    .join("\n");
}
