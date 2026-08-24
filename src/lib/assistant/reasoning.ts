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
