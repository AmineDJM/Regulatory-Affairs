/**
 * PROFONDEUR ADAPTATIVE & CONTINUITÉ SÉMANTIQUE — les deux détecteurs PURS de la couche
 * « maximum intelligence at maximum speed ».
 *
 * 1. `isHighStakesQuestion` — la profondeur suit l'ENJEU, pas la longueur de la question :
 *    « Est-ce qu'on doit lancer Pembro ? » (cinq mots) mérite une seconde passe critique ;
 *    « quel âge a Khaled ? » n'en mérite aucune. Détection DÉTERMINISTE (décision demandée,
 *    recommandation, réorganisation, recrutement, gros montant écrit en clair) — elle décide
 *    d'AJOUTER du calcul, jamais d'en retirer : une question ordinaire garde exactement le
 *    même moteur qu'avant.
 *
 * 2. `conversationWorkingSet` — le fil actif de la conversation : les RÉFÉRENCES et les termes
 *    cités récemment, les plus récents d'abord, pour que « et le fournisseur ? », « fais pareil
 *    pour Nivo », « pourquoi ? » se résolvent sans relancer toute la compréhension. Extraction
 *    déterministe (formats de référence réels de l'ERP + termes « entre guillemets ») — le
 *    modèle reçoit une carte, pas une devinette.
 */

export interface WorkingSetTurn {
  role: string;
  content: string;
}

/** Les préfixes de référence RÉELS de l'ERP (buildRef) — la carte d'identité d'un dossier. */
const REF_RE = /\b(?:AO|AUT|CMD|CONS|DEM|DIM|DIR|DOS|FIN|FORM|MP|OD|PAY|PIE|REC|REG|REQ|SPO|SUP|VAL)-\d{4}-\d{1,6}\b/gi;

/** Un terme cité « entre guillemets français » — noms de produits, de fichiers, de personnes. */
const QUOTED_RE = /«\s*([^»\n]{2,48}?)\s*»/g;

/**
 * Construit le bloc « ENTITÉS ACTIVES » à partir des derniers tours de conversation : jusqu'à
 * 8 entités, les plus récemment mentionnées d'abord. Renvoie null quand il n'y a rien — pas de
 * bloc fantôme dans le prompt.
 */
export function conversationWorkingSet(turns: WorkingSetTurn[], opts: { maxTurns?: number; maxEntities?: number } = {}): string | null {
  const maxTurns = opts.maxTurns ?? 60;
  const maxEntities = opts.maxEntities ?? 8;
  const recent = turns.slice(-maxTurns);

  // Parcours du plus RÉCENT au plus ancien : la première rencontre gagne l'ordre.
  const seen = new Set<string>();
  const entities: string[] = [];
  const push = (raw: string) => {
    const label = raw.trim().replace(/\s+/g, " ");
    if (!label) return;
    const key = label.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    if (entities.length < maxEntities) entities.push(label);
  };

  for (let i = recent.length - 1; i >= 0 && entities.length < maxEntities; i--) {
    const text = recent[i]?.content ?? "";
    for (const m of text.matchAll(REF_RE)) push(m[0].toUpperCase());
    for (const m of text.matchAll(QUOTED_RE)) push(`« ${m[1]} »`);
  }

  if (entities.length === 0) return null;
  return `ENTITÉS ACTIVES DE LA CONVERSATION (les plus récentes d'abord) — « il », « elle », « ce dossier »,
« le fournisseur », « pourquoi ? », « fais pareil pour… » se résolvent D'ABORD contre cette liste,
sauf indication contraire de l'utilisateur :
${entities.join(" · ")}`;
}

/**
 * La question engage-t-elle une DÉCISION (recruter, lancer, réorganiser, trancher, recommander)
 * ou un montant qui se compte en millions ? Alors la conclusion mérite une SECONDE PASSE
 * critique avant remise — davantage de raisonnement quand l'enjeu le justifie.
 */
const HIGH_STAKES_RES: RegExp[] = [
  // Une décision est demandée.
  /\b(dois[- ]je|doit[- ]on|devrais[- ]je|devrait[- ]on|faut[- ]il|est[- ]ce qu(?:'|e )on doit)\b/i,
  // Une recommandation ou un arbitrage est demandé.
  /\b(recommand\w*|ta recommandation|ton avis sur|arbitr\w*|go\s*\/\s*no[- ]?go|tranche[rz]?)\b/i,
  // Les gestes structurants de l'entreprise.
  /\b(recrut\w*|licenci\w*|réorganis\w*|reorganis\w*|restructur\w*|augment\w* (?:le |son |sa )?salaire|lancer? (?:le |la |l')?(?:produit|dossier)|abandonn\w* (?:le |la |l'))\b/i,
  // Une analyse stratégique explicitement demandée.
  /\b(analyse[- ]moi|analyse (?:complète|approfondie|stratégique)|étudie[- ]moi|compare[- ]moi .{0,40}\bet décide\b)\b/i,
  // Un montant écrit en millions / milliards.
  /\b\d[\d\s.,]{0,12}\s*(?:millions?|milliards?)\b/i,
];

export function isHighStakesQuestion(question: string): boolean {
  const q = (question ?? "").slice(0, 2_000);
  if (q.trim().length < 8) return false;
  return HIGH_STAKES_RES.some((re) => re.test(q));
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY PLANNER — comprendre LA QUESTION MÉTIER avant de choisir les outils.
//
// Le planner est DÉTERMINISTE et GÉNÉRAL (mots-clés de domaine et d'intention — jamais un nom
// d'entreprise, de personne ou de produit en dur) : il produit une CARTE compacte injectée au
// prompt. La panne réelle qu'il corrige : après « les produits Kwality et leurs statuts »,
// « Et les produits SD ? » repartait de zéro — au lieu de comprendre MÊME DOMAINE, MÊME
// INTENTION, entité substituée. Le plan est un GPS, pas une loi : la question réelle prime.
// ─────────────────────────────────────────────────────────────────────────────

export interface QueryPlan {
  domaine: string | null;
  intention: string | null;
  /** « Et X ? » — la question ne porte que la NOUVELLE entité : hériter domaine + intention. */
  suiviElliptique: boolean;
  entites: string[];
  besoinHistorique: boolean;
  besoinInvestigation: boolean;
}

/** Repli de la QUESTION avant tout motif : minuscules, accents retirés, apostrophes → espaces —
 *  `\b` (ASCII) redevient fiable, et les motifs s'écrivent une seule fois, sans accents. */
const foldQuestion = (q: string): string =>
  q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, " ");

/** Domaines par mots-clés (sur texte REPLIÉ) — l'ordre compte (le premier qui matche gagne). */
const DOMAIN_RES: [string, RegExp][] = [
  ["REGULATORY", /\b(dossiers? (reg|reglementaires?)|anpp|ctd|presoumission|enregistrement|depot du dossier|reserves?|dci|amm|portefeuille|produits?\b.{0,40}\b(statuts?|partenaire)|partenaire\b.{0,30}\bproduits?)/],
  ["RH", /\b(salaries?|employes?|conges?|salaire|paie|contrat de travail|anciennete|recrutement|departements?)\b/],
  ["FINANCES", /\b(paiements?|reglements?|factures?|tresorerie|budgets?|encaissements?|decaissements?|bons? de commande|bc|devis)\b/],
  ["ÉVÉNEMENTS", /\b(evenements?|congres|journee (nationale|internationale)|sponsoring|societe savante|symposium|salon|seminaire)\b/],
  ["DRIVE", /\b(drive|dossier partage|fichiers?|documents? dans|uploade?|televerse)\b/],
  ["TÂCHES", /\b(taches?|to[- ]?do|en retard sur)\b/],
];

/** Intentions par motifs (texte replié) — générales, jamais liées à une entité précise. */
const INTENT_RES: [string, RegExp][] = [
  ["CHARGE_PERSONNE", /\bcombien de (dossiers?|taches?|produits?)\b.{0,40}\b(gere|porte|responsable|assigne)|charge de travail\b/],
  ["ASSIGNATION_DIRECTE", /\ba qui (est|sont)\b.{0,40}\b(assigne|confie|attribue)|\bqui (gere|porte|est responsable d)\b/],
  ["PORTEFEUILLE_PARTENAIRE", /\b(produits?|portefeuille|dossiers?)\b.{0,50}\b(de|du|d|chez)\b|leurs? statuts?\b/],
  ["ÉTAT_DOSSIER", /\bou en (est|etait|sont)\b|\bstatut (de|du|d)\b|\bavancement\b/],
  ["DATE_ÉVÉNEMENT", /\b(quand|quelle date|c est quand)\b/],
  ["EXPLORATION_DRIVE", /\bqui a (uploade|depose|cree|mis)\b|\bcombien de\b.{0,40}\b(dans|dedans)\b/],
  ["CATCH_UP", /\bqu est[- ]ce qui a change\b|\bdepuis (lundi|mardi|mercredi|jeudi|vendredi|hier|la semaine)\b|\bcatch[- ]?up\b/],
  ["DEMANDE_TIERS", /\b(demande a|dis a|rappelle a)\s+\S+.{0,60}\bde\b/],
];

/** « Et X ? », « même chose pour X », « pareil pour X », « aussi » — l'ellipse conversationnelle. */
const ELLIPTICAL_RE = /^\s*(et\b|m[êe]me chose\b|pareil\b|idem\b|aussi\b|également\b)/i;

/** Entités candidates de la question : références ERP, termes cités, Mots Capitalisés en série. */
function extractEntities(q: string): string[] {
  const out: string[] = [];
  const push = (s: string) => { const t = s.trim(); if (t && !out.some((x) => x.toUpperCase() === t.toUpperCase())) out.push(t); };
  for (const m of q.matchAll(REF_RE)) push(m[0].toUpperCase());
  for (const m of q.matchAll(QUOTED_RE)) push(m[1]);
  // Séquences capitalisées / sigles hors début de phrase — « les produits SD Pharma » → « SD Pharma ».
  for (const m of q.matchAll(/(?<![.!?]\s)(?<!^)\b([A-ZÀ-Ý][A-Za-zà-ÿ0-9]*(?:[ -][A-ZÀ-Ý][A-Za-zà-ÿ0-9]*)*)\b/gu)) {
    const cand = m[1];
    if (cand.length >= 2 && !/^(Et|Le|La|Les|Un|Une|Des|Du|De|D|Qu|Que|Qui|Quand|Combien|Comment|Pourquoi|Est|Sont|Avec|Pour|Dans|Sur)$/.test(cand)) push(cand);
  }
  return out.slice(0, 5);
}

/**
 * Le plan d'UNE question, avec l'historique des questions PRÉCÉDENTES de l'utilisateur pour
 * hériter le contexte d'une ellipse. Pur, sans réseau — testé sur les pannes réelles.
 */
export function queryPlan(question: string, previousUserQuestions: string[] = []): QueryPlan {
  const q = (question ?? "").slice(0, 1_000).trim();
  const f = foldQuestion(q);
  const domainOf = (s: string) => DOMAIN_RES.find(([, re]) => re.test(foldQuestion(s)))?.[0] ?? null;
  const intentOf = (s: string) => INTENT_RES.find(([, re]) => re.test(foldQuestion(s)))?.[0] ?? null;

  let domaine = domainOf(q);
  let intention = intentOf(q);
  // « Les dossiers que gère X » / « à qui est assigné le dossier Y » : dans l'idiome de l'ERP,
  // le « dossier » que l'on GÈRE est le dossier Regulatory — règle d'inférence générale, pas
  // un nom en dur.
  if (!domaine && /\bdossiers?\b/.test(f) && (intention === "CHARGE_PERSONNE" || intention === "ASSIGNATION_DIRECTE" || intention === "ÉTAT_DOSSIER")) {
    domaine = "REGULATORY";
  }
  const elliptical = ELLIPTICAL_RE.test(q) && q.length <= 90;

  let suiviElliptique = false;
  if (elliptical) {
    // Hériter du DERNIER plan interprétable des questions précédentes.
    for (let i = previousUserQuestions.length - 1; i >= 0; i--) {
      const prev = previousUserQuestions[i] ?? "";
      const pd = domainOf(prev);
      const pi = intentOf(prev);
      if (pd || pi) {
        suiviElliptique = true;
        if (!domaine || domaine === pd) domaine = domaine ?? pd;
        intention = intention && intention !== "PORTEFEUILLE_PARTENAIRE" ? intention : (pi ?? intention);
        break;
      }
    }
  }

  return {
    domaine,
    intention,
    suiviElliptique,
    entites: extractEntities(q),
    besoinHistorique: /\b(ou en etai(t|ent)|le \d{1,2}(er)? (janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)|l an dernier|l annee derniere|historique)\b/.test(f),
    besoinInvestigation: /\b(qui a .{0,60}\b(et|\?).{0,40}combien|combien de .{0,40}(dans|dedans)|quand est|retrouve[- ]?(moi|nous)|cherche partout|creuse|enquete)\b/.test(f),
  };
}

/** Le bloc PROMPT du plan — null quand le plan n'apporte rien (pas de bloc fantôme). */
export function queryPlanContext(plan: QueryPlan): string | null {
  if (!plan.domaine && !plan.intention && !plan.suiviElliptique && !plan.besoinHistorique && !plan.besoinInvestigation) return null;
  const lines: string[] = ["PLAN DE LA QUESTION (calcul déterministe — un GPS, pas une loi : la question réelle prime) :"];
  if (plan.domaine || plan.intention) {
    lines.push(`- Domaine probable : ${plan.domaine ?? "?"} · Intention probable : ${plan.intention ?? "?"}`);
  }
  if (plan.suiviElliptique) {
    lines.push(
      `- SUIVI ELLIPTIQUE DÉTECTÉ (« et… ? », « pareil pour… ») : MÊME domaine et MÊME intention que la question`
      + ` précédente, avec la NOUVELLE entité${plan.entites.length ? ` (${plan.entites.join(", ")})` : ""} substituée`
      + ` à l'ancienne. NE PAS repartir de zéro, NE PAS changer de domaine, NE PAS élargir la question.`,
    );
  } else if (plan.entites.length) {
    lines.push(`- Entités de la question : ${plan.entites.join(" · ")}`);
  }
  if (plan.besoinHistorique) lines.push("- État PASSÉ demandé → time_travel / what_changed, pas l'état actuel seul.");
  if (plan.besoinInvestigation) {
    lines.push("- La question IMPLIQUE une investigation complète EN UN TOUR : explorer (recursif/multi-sources) puis répondre à TOUTES les parties — ne pas demander la permission d'explorer.");
  }
  return lines.join("\n");
}
