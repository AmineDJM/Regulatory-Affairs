/**
 * `regulatory_intelligence` / `legal_intelligence` / `finance_intelligence` — Adam répond « qu'est-ce
 * qui cloche dans nos dossiers, nos contrats, nos budgets ? » depuis les règles de l'intelligence
 * métier (mandat 4 §27), jamais de mémoire : des SIGNAUX datés, gradués, chacun avec son calcul et
 * sa fiche. Sous les droits de la personne — la même porte que l'écran.
 *
 * Les outils LISENT. Relancer un fournisseur, dénoncer un contrat, régler un paiement restent des
 * gestes humains (ou des actions confirmées) : un signal dit ce qu'il y a à FAIRE, il ne le fait pas.
 */

import type { PowerTool } from "@/lib/assistant/power-tools";
import { faitCalcule, declarerProvenance } from "@/platform/in-process/fabric/provenance";
import {
  peutLireFinance, peutLireLegal, peutLireRegulatory, signauxFinance, signauxLegal, signauxRegulatory,
  LIBELLE_GRAVITE, type LectureIntelligence, type Signal,
} from "@/platform/in-process/intelligence";

type Acteur = Parameters<PowerTool["run"]>[1];

const str = (input: Record<string, unknown>, key: string): string => (typeof input[key] === "string" ? (input[key] as string).trim() : "");
const num = (input: Record<string, unknown>, key: string, defaut: number, min: number, max: number): number =>
  typeof input[key] === "number" && Number.isFinite(input[key] as number) ? Math.max(min, Math.min(max, Math.round(input[key] as number))) : defaut;

const GRAVITES = ["CRITIQUE", "HAUTE", "NORMALE", "BASSE"] as const;

function blocSignaux(titre: string, signaux: readonly Signal[]): Record<string, unknown> | null {
  if (!signaux.length) return null;
  return {
    kind: "table", title: titre,
    columns: [
      { key: "gravite", label: "gravité", numeric: false }, { key: "signal", label: "signal", numeric: false },
      { key: "echeance", label: "échéance", numeric: false }, { key: "montant", label: "montant (DZD)", numeric: true }, { key: "calcul", label: "calcul", numeric: false },
    ],
    rows: signaux.slice(0, 40).map((s) => ({ cells: {
      gravite: LIBELLE_GRAVITE[s.gravite], signal: s.titre, echeance: s.echeance ?? "—",
      montant: s.montant != null ? Math.round(s.montant).toLocaleString("fr-FR") : "—", calcul: s.calcul ?? "—",
    } })),
    total: signaux.length,
  };
}

function reponse(user: Acteur, outil: string, l: LectureIntelligence, input: Record<string, unknown>): string {
  const filtreGravite = GRAVITES.includes(str(input, "gravite") as (typeof GRAVITES)[number]) ? (str(input, "gravite") as Signal["gravite"]) : null;
  const code = str(input, "code");
  const limite = num(input, "limite", 30, 1, 60);
  const retenus = l.signaux.filter((s) => (!filtreGravite || s.gravite === filtreGravite) && (!code || s.code === code));
  const parCode: Record<string, number> = {};
  for (const s of l.signaux) parCode[s.code] = (parCode[s.code] ?? 0) + 1;
  // PAR ENTITÉ : chaque dossier, contrat ou enveloppe touché, avec sa pire gravité et ses codes —
  // pour que « quels dossiers sont en retard ? » cite TOUS les dossiers, pas les trente premiers signaux.
  const parEntite = new Map<string, { entite: string; type: string; gravite: Signal["gravite"]; codes: string[]; faits: string[]; fiche: string | null }>();
  for (const s of retenus) {
    if (!s.entite) continue;
    const cle = `${s.entite.type}:${s.entite.id}`;
    // Le FAIT par entité : le titre du signal, qui porte le chiffre (« Étape en retard de 40 j — dépôt »),
    // sans la répétition du nom de l'entité — c'est ce qu'une réponse « pour chacun » doit citer.
    const fait = s.titre.replace(new RegExp(`\\s*:\\s*${(s.entite.ref ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*$`), "");
    const e = parEntite.get(cle);
    if (!e) parEntite.set(cle, { entite: s.entite.ref ?? s.entite.id, type: s.entite.type, gravite: s.gravite, codes: [s.code], faits: [fait], fiche: s.href ?? null });
    else { if (!e.codes.includes(s.code)) e.codes.push(s.code); if (e.faits.length < 4 && !e.faits.includes(fait)) e.faits.push(fait); }
  }
  const titre = `${l.domaine === "REGULATORY" ? "Regulatory" : l.domaine === "LEGAL" ? "Legal" : "Finance"} — ${l.resume.phrase}`;
  const bloc = blocSignaux(titre, retenus);
  return JSON.stringify({
    source: `règles déterministes de l'intelligence ${l.domaine} (lecture ERP sous vos droits, calcul à ${l.calculeLe.slice(0, 16).replace("T", " ")} UTC, ${l.ms} ms)`,
    resume: l.resume.phrase,
    parGravite: l.resume.parGravite,
    parCode,
    portee: l.portee,
    limites: l.notes,
    filtre: [filtreGravite ? `gravité ${LIBELLE_GRAVITE[filtreGravite]}` : null, code ? `code ${code}` : null].filter(Boolean).join(" · ") || "tout",
    signaux: retenus.slice(0, limite).map((s) => ({
      gravite: s.gravite, code: s.code, titre: s.titre, detail: s.detail, calcul: s.calcul ?? null, echeance: s.echeance ?? null,
      montant: s.montant != null ? Math.round(s.montant) : null, entite: s.entite ?? null, fiche: s.href ?? null, aFaire: s.action ?? null,
    })),
    parEntite: [...parEntite.values()].slice(0, 80),
    tronque: retenus.length > limite ? `${retenus.length - limite} signal(aux) de plus — préciser gravite ou code, ou lire parEntite` : null,
    consigne: "Chaque signal porte son calcul : le citer tel quel. Ne rien conclure au-delà des signaux ; « rien à signaler » se dit avec la portée lue.",
    _blocs: bloc ? [bloc] : [],
    _blocsDecoratifs: true,
    _provenance: declarerProvenance([faitCalcule({
      outil, acteur: user.id, libelle: titre, valeur: l.signaux.length,
      entrees: Object.entries(l.portee).map(([k, v]) => `${k} : ${v}`), transformation: "règles déterministes datées (gravité, échéance, calcul)", formule: l.resume.phrase,
    })]),
  });
}

const proprietesCommunes = {
  gravite: { type: "string", enum: [...GRAVITES], description: "Ne montrer qu'une gravité. Optionnel." },
  code: { type: "string", description: "Ne montrer qu'un code de signal (voir `parCode` d'une première lecture). Optionnel." },
  limite: { type: "number", description: "Nombre de signaux détaillés (défaut 20, max 60)." },
} as const;

export const INTELLIGENCE_TOOLS: PowerTool[] = [
  {
    def: {
      name: "regulatory_intelligence",
      description:
        "LES SIGNAUX REGULATORY, calculés par des règles sur les dossiers visibles : étapes bloquées ou en retard (avec le nombre de jours), "
        + "pièces manquantes, dépôts dont la date cible est passée ou proche, partenaires/fournisseurs en retard sur ce qu'on attend d'eux, "
        + "réponses aux questions de l'agence attendues, dossiers sans activité ; et, dans l'espace d'analyse CTD : bloqueurs de soumission, "
        + "réserves ouvertes sans réponse, demandes fournisseur à relancer, obligations (CPP, GMP, AMM…) échues ou proches. Chaque signal dit "
        + "son calcul, son échéance et sa fiche. À appeler pour « quels dossiers sont en retard ? », « qu'est-ce qui bloque le dossier X ? », "
        + "« qui faut-il relancer ? ». Ne relance rien : la relance est un geste humain.",
      input_schema: {
        type: "object",
        properties: {
          ...proprietesCommunes,
          filtre: { type: "string", description: "Référence, DCI, marque ou partenaire pour restreindre. Optionnel." },
          horizonJours: { type: "number", description: "Horizon des échéances à venir (défaut 30)." },
        },
      },
    },
    allowed: (u) => peutLireRegulatory(u),
    label: "Signaux Regulatory calculés",
    run: async (input, user) => reponse(user, "regulatory_intelligence", await signauxRegulatory(user, { filtre: str(input, "filtre") || null, horizonJours: num(input, "horizonJours", 30, 1, 180) }), input),
  },
  {
    def: {
      name: "legal_intelligence",
      description:
        "LES SIGNAUX LEGAL, calculés par des règles sur les engagements ACTIFS visibles et les CLAUSES lues dans leur texte : échéances "
        + "(dépassée / imminente / proche), date limite de DÉNONCIATION = fin − préavis quand le contrat se reconduit tacitement, reconduction "
        + "acquise faute de dénonciation, obligations après terme (confidentialité, non-concurrence, exclusivité), avenants comparés clause par "
        + "clause (durée, pénalités, exclusivité…), risques (pénalité sans plafond, tacite sans préavis, droit étranger, responsabilité illimitée). "
        + "Chaque signal cite son calcul et l'extrait de clause. À appeler pour « quels contrats arrivent à échéance ? », « quand faut-il dénoncer "
        + "le contrat X ? », « quels risques dans nos contrats ? ». Un contrat sans texte indexé est dit « sans texte » : rien n'est inventé.",
      input_schema: {
        type: "object",
        properties: {
          ...proprietesCommunes,
          filtre: { type: "string", description: "Titre, contrepartie ou référence pour restreindre. Optionnel." },
          horizonJours: { type: "number", description: "Horizon des échéances à venir (défaut 90)." },
        },
      },
    },
    allowed: (u) => peutLireLegal(u),
    label: "Signaux Legal calculés",
    run: async (input, user) => reponse(user, "legal_intelligence", await signauxLegal(user, { filtre: str(input, "filtre") || null, horizonJours: num(input, "horizonJours", 90, 7, 365) }), input),
  },
  {
    def: {
      name: "finance_intelligence",
      description:
        "LES SIGNAUX FINANCE, calculés par des règles : enveloppes budgétaires consommées plus vite que le calendrier (rythme, projection "
        + "d'atterrissage, écart projeté), dépassements, catégories dépassées ; ordres de dépense réglés ou à régler SANS la facture exigée ; "
        + "échéances de paiement selon leur nature (date imposée / importante / modérée) ; factures sans bon de commande, BC sans facture, "
        + "facture qui s'écarte de son devis ou BC. Chaque signal porte son calcul (« 62 % consommé à 41 % du temps »). À appeler pour "
        + "« où en sont nos budgets ? », « qu'est-ce qui cloche côté paiements ? », « quels justificatifs manquent ? ». Ne règle rien.",
      input_schema: { type: "object", properties: { ...proprietesCommunes, horizonJours: { type: "number", description: "Horizon des échéances de paiement (défaut 30)." } } },
    },
    allowed: (u) => peutLireFinance(u),
    label: "Signaux Finance calculés",
    run: async (input, user) => reponse(user, "finance_intelligence", await signauxFinance(user, { horizonJours: num(input, "horizonJours", 30, 1, 180) }), input),
  },
];
