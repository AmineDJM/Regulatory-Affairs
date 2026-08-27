import type { CapabilityBrief, CapabilityCatalog, MissionActor } from "@/lib/missions/ports";

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
const SYNONYMES: Record<string, string[]> = {
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
  anomalie: ["anomalie", "controle"],
  anomalies: ["anomalie", "controle"],
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

  // Un préfixe partagé rattrape les familles de mots que la découpe sépare (« notifi… »).
  if (score === 0) {
    for (const t of [...nom, ...domaine]) {
      for (const d of demande) {
        if (t.length >= 5 && d.length >= 5 && (t.startsWith(d.slice(0, 5)) || d.startsWith(t.slice(0, 5)))) {
          score += 2;
          break;
        }
      }
    }
  }
  return score;
}

export interface ResolutionOptions {
  /** Combien de capacités au maximum sont montrées au planner. */
  limite?: number;
  /** Le plancher par domaine retenu : ne jamais montrer un domaine avec une seule capacité. */
  parDomaine?: number;
  /** Des capacités que l'appelant sait indispensables (une reprise, un replan ciblé). */
  imposees?: readonly string[];
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
  const domaines: string[] = [];
  for (const n of pertinentes) {
    if (!domaines.includes(n.b.domain)) domaines.push(n.b.domain);
  }

  const retenues = new Map<string, CapabilityBrief>();
  const ajouter = (b: CapabilityBrief) => {
    if (!retenues.has(b.id) && retenues.size < limite) retenues.set(b.id, b);
  };

  for (const nom of opts.imposees ?? []) {
    const b = toutes.find((x) => x.id === nom);
    if (b) ajouter(b);
  }
  for (const n of pertinentes) ajouter(n.b);

  // LE PLANCHER PAR DOMAINE — compléter les domaines déjà retenus avec leurs capacités les
  // mieux classées, même à score nul : c'est là que vivent les lectures qui alimentent l'action.
  for (const d of domaines) {
    let compte = [...retenues.values()].filter((b) => b.domain === d).length;
    if (compte >= parDomaine) continue;
    for (const n of notes) {
      if (compte >= parDomaine || retenues.size >= limite) break;
      if (n.b.domain !== d || retenues.has(n.b.id)) continue;
      ajouter(n.b);
      compte += 1;
    }
  }

  // Rien n'a marqué : on montre les mieux classées plutôt que rien. Un planner sans capacité
  // ne produit pas un plan honnête, il produit un plan vide.
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
    .map((c) => `- ${c.id} [${c.domain} · effet ${c.effect}${c.batchable ? " · répétable" : ""}] — ${c.summary}`)
    .join("\n");
}
