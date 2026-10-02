import type { AdProItemKind } from "@prisma/client";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA BILLETTERIE D'UN POSTE : QUI VOYAGE, QUAND (§118.175).
 *
 * « Lorsqu'on met la prise en charge de la billetterie dans les postes d'une demande, on doit
 * pouvoir sélectionner à chaque fois le nom de la personne, la date de départ, de retour,
 * téléverser le passeport, etc. — et donner de la flexibilité : on modifie les dates plus tard,
 * ou on n'a pas les informations à l'avance. Les demandes de réservation vont à l'assistante de
 * direction et ouvrent un sujet » (Direction, 01/10).
 *
 * Module PUR : la lecture d'un voyageur saisi, ce qui manque pour réserver, et les phrases que
 * l'assistante lira dans le sujet. Aucune base, aucune session.
 *
 * ── LA FLEXIBILITÉ EST UNE PROPRIÉTÉ, PAS UN OUBLI ─────────────────────────────────────────
 *
 * Aucune date n'est obligatoire : on prend en charge un médecin avant de savoir quand il part.
 * Mais une réservation sur des dates inconnues ne se fait pas — l'assistante devrait rappeler.
 * D'où DEUX questions distinctes : « le voyageur est-il enregistré ? » (un nom suffit) et
 * « peut-on réserver ? » (ce qui manque est NOMMÉ, voyageur par voyageur, et la demande part
 * quand même — l'assistante sait alors ce qu'elle attend, au lieu de le découvrir).
 *
 * ── LE NOM SE SAISIT, IL NE SE DEVINE PAS ──────────────────────────────────────────────────
 *
 * Le formulaire propose les noms que la demande porte déjà (les médecins concernés, les
 * personnes prises en charge) — c'est la « sélection » demandée. Mais un voyageur ne se
 * RATTACHE pas à une fiche de l'annuaire d'après son nom : deux « Dr Benali » existent, et
 * rapprocher par ressemblance écrirait le voyage de l'un sur la fiche de l'autre (§118.85).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Les natures dont le poste porte des voyageurs. FERMÉE : la Direction a parlé de la billetterie.
 * L'hôtellerie en porterait peut-être aussi — c'est une décision de la Direction, et elle tient
 * en une ligne ici.
 */
export const NATURES_A_VOYAGEURS = ["TICKETING"] as const satisfies readonly AdProItemKind[];

export function porteDesVoyageurs(kind: AdProItemKind | string): boolean {
  return (NATURES_A_VOYAGEURS as readonly string[]).includes(kind);
}

export interface SaisieVoyageur {
  nom: string | null;
  villeDepart: string | null;
  villeArrivee: string | null;
  /** AAAA-MM-JJ ; vide = pas encore connue. */
  dateDepart: string | null;
  dateRetour: string | null;
  notes: string | null;
}

export interface VoyageurLu {
  nom: string;
  villeDepart: string | null;
  villeArrivee: string | null;
  dateDepart: Date | null;
  dateRetour: Date | null;
  notes: string | null;
}

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

function lireJour(v: string | null): { ok: true; date: Date | null } | { ok: false } {
  const t = (v ?? "").trim();
  if (!t) return { ok: true, date: null };
  if (!JOUR.test(t)) return { ok: false };
  const d = new Date(`${t}T00:00:00.000Z`);
  // « 2026-02-31 » se lit, mais n'existe pas : on refuse plutôt que d'écrire le 3 mars.
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? { ok: false } : { ok: true, date: d };
}

const texte = (v: string | null, max = 200) => {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : null;
};

/** Lit un voyageur saisi. Tout ce qui ne va pas se dit en une fois (§118.18). */
export function lireVoyageur(s: SaisieVoyageur): { ok: true; voyageur: VoyageurLu } | { ok: false; error: string } {
  const fautes: string[] = [];
  const nom = texte(s.nom, 160);
  if (!nom) fautes.push("le nom de la personne");
  const depart = lireJour(s.dateDepart);
  const retour = lireJour(s.dateRetour);
  if (!depart.ok) fautes.push("une date de départ lisible (AAAA-MM-JJ)");
  if (!retour.ok) fautes.push("une date de retour lisible (AAAA-MM-JJ)");
  if (fautes.length) return { ok: false, error: `Voyageur incomplet — il manque ${fautes.join(", ")}.` };
  const dDepart = depart.ok ? depart.date : null;
  const dRetour = retour.ok ? retour.date : null;
  if (dDepart && dRetour && dRetour.getTime() < dDepart.getTime()) {
    return { ok: false, error: "La date de retour précède la date de départ." };
  }
  return {
    ok: true,
    voyageur: {
      nom: nom!, villeDepart: texte(s.villeDepart, 120), villeArrivee: texte(s.villeArrivee, 120),
      dateDepart: dDepart, dateRetour: dRetour, notes: texte(s.notes, 1000),
    },
  };
}

export interface VoyageurPourReservation {
  nom: string;
  villeDepart: string | null;
  villeArrivee: string | null;
  dateDepart: Date | null;
  dateRetour: Date | null;
  passeport: boolean;
  notes: string | null;
}

/** CE QUI MANQUE POUR RÉSERVER — nommé voyageur par voyageur. Vide = tout est là. */
export function manquesPourReserver(v: VoyageurPourReservation): string[] {
  const m: string[] = [];
  if (!v.dateDepart) m.push("date de départ");
  if (!v.villeDepart || !v.villeArrivee) m.push("trajet");
  if (!v.passeport) m.push("passeport");
  return m;
}

/** Un jour lu par une personne : JJ/MM/AAAA, ou « à confirmer » — jamais un vide qui se lirait « rien ». */
export function jourLisible(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : "à confirmer";
}

/** LA LIGNE QUE L'ASSISTANTE LIT dans le sujet — un voyageur, ce qu'on sait, ce qui manque. */
export function ligneVoyageur(v: VoyageurPourReservation): string {
  const trajet = v.villeDepart || v.villeArrivee ? `${v.villeDepart ?? "?"} → ${v.villeArrivee ?? "?"}` : "trajet à confirmer";
  const dates = `aller ${jourLisible(v.dateDepart)}, retour ${jourLisible(v.dateRetour)}`;
  const manque = manquesPourReserver(v);
  return `• ${v.nom} — ${trajet} — ${dates}${v.passeport ? " — passeport joint" : ""}${manque.length ? ` (manque : ${manque.join(", ")})` : ""}${v.notes ? ` — ${v.notes}` : ""}`;
}

/**
 * CE QUI A CHANGÉ SUR UN VOYAGEUR — la phrase écrite dans le sujet de réservation quand on
 * modifie un voyageur après la demande (« on modifie les dates plus tard »). Vide = rien n'a
 * bougé : un enregistrement à l'identique ne dérange personne. Les précisions comptent — elles
 * sont dans la ligne que l'assistante lit (`ligneVoyageur`).
 */
export function changementsVoyageur(avant: VoyageurLu, apres: VoyageurLu): string[] {
  const out: string[] = [];
  const t = (v: string | null) => v ?? "—";
  if (avant.nom !== apres.nom) out.push(`nom : ${avant.nom} → ${apres.nom}`);
  if (avant.villeDepart !== apres.villeDepart || avant.villeArrivee !== apres.villeArrivee) {
    out.push(`trajet : ${t(avant.villeDepart)} → ${t(avant.villeArrivee)} devient ${t(apres.villeDepart)} → ${t(apres.villeArrivee)}`);
  }
  const memeJour = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
  if (!memeJour(avant.dateDepart, apres.dateDepart)) out.push(`aller : ${jourLisible(avant.dateDepart)} → ${jourLisible(apres.dateDepart)}`);
  if (!memeJour(avant.dateRetour, apres.dateRetour)) out.push(`retour : ${jourLisible(avant.dateRetour)} → ${jourLisible(apres.dateRetour)}`);
  if ((avant.notes ?? "") !== (apres.notes ?? "")) out.push(`précisions : ${apres.notes ?? "retirées"}`);
  return out;
}
