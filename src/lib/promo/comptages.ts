import { lienStockPromo } from "@/lib/chemins/stock-promo";
import { etatValidite, parseQuantity } from "@/lib/promo/stock";
import { peutVoirStockDe, tientLeMagasin, type FaitsStock } from "@/lib/promo/stock-acces";
import type { PromoFamille } from "@/lib/promo/catalogue";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * COMPTAGES, ALERTES, TABLEAU DE BORD, REFONTES — la règle pure de l'étape 5 (§118.168).
 *
 * Les décisions de la Direction (01/10/2026) : « le directeur des opérations […] peut demander des
 * comptages, ponctuels ou récurrents, par famille » ; des ALERTES (seuil, rupture, péremption à
 * trente jours, dotations non confirmées) ; un TABLEAU DE BORD (valeur, consommation, articles
 * dormants) ; des propositions de REFONTE pour les supports durables.
 *
 * ── COMPTER EST UNE ATTESTATION ────────────────────────────────────────────────────────────
 *
 * « J'ai compté 40 fiches » se dit par celui qui les a entre les mains, comme « je l'ai reçu »
 * (§118.164) : ni le directeur qui demande, ni le Super Admin ne comptent à la place de quelqu'un.
 * Le Super Admin ANNULE un comptage qu'il juge inutile ; il corrige un solde par le geste qui est
 * le sien (« Corriger »), et ce geste dit alors son nom, pas celui du délégué.
 *
 * ── L'ÉCART SE LIT AU MOMENT DE LA SAISIE ──────────────────────────────────────────────────
 *
 * Le registre peut bouger entre la demande et la saisie (une visite, une dotation) : l'écart se
 * calcule contre le solde relu SOUS LE VERROU de l'article au moment de la saisie. Le calculer
 * contre le solde du jour de la demande ferait passer chaque remise faite entre-temps pour un
 * manquant — et la correction retirerait des fiches déjà retirées.
 *
 * Module PUR — aucune base, aucune session. Testé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type CibleComptage = "PERSONNE" | "EQUIPE" | "MAGASIN";
export type FrequenceComptage = "HEBDOMADAIRE" | "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL";
export type StatutComptage = "DEMANDE" | "SAISI" | "ANNULE";
export type StatutRefonte = "OUVERTE" | "RETENUE" | "ECARTEE";

export const CIBLES_COMPTAGE: readonly CibleComptage[] = ["PERSONNE", "EQUIPE", "MAGASIN"];
export const FREQUENCES_COMPTAGE: readonly FrequenceComptage[] = ["HEBDOMADAIRE", "MENSUEL", "TRIMESTRIEL", "SEMESTRIEL"];

export const CIBLE_COMPTAGE_LABEL: Record<CibleComptage, string> = {
  PERSONNE: "Une personne",
  EQUIPE: "Toute mon équipe",
  MAGASIN: "Le magasin central",
};

export const FREQUENCE_COMPTAGE_LABEL: Record<FrequenceComptage, string> = {
  HEBDOMADAIRE: "Chaque semaine",
  MENSUEL: "Chaque mois",
  TRIMESTRIEL: "Chaque trimestre",
  SEMESTRIEL: "Chaque semestre",
};

export const STATUT_COMPTAGE_LABEL: Record<StatutComptage, string> = {
  DEMANDE: "À compter",
  SAISI: "Compté",
  ANNULE: "Annulé",
};

export const STATUT_REFONTE_LABEL: Record<StatutRefonte, string> = {
  OUVERTE: "Proposée",
  RETENUE: "Retenue",
  ECARTEE: "Écartée",
};

/** « consommables », « durables », ou « tout ce qui se compte » — pour les phrases. */
export function libelleFamilleComptage(famille: PromoFamille | null): string {
  if (famille === "CONSOMMABLE") return "consommables";
  if (famille === "DURABLE") return "durables";
  return "tout le matériel";
}

/** Une famille qu'on peut compter : rien pour un support numérique (pas de quantité). */
export function familleComptable(famille: string | null | undefined): famille is "CONSOMMABLE" | "DURABLE" {
  return famille === "CONSOMMABLE" || famille === "DURABLE";
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// QUI PEUT QUOI
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * DEMANDER UN COMPTAGE à un détenteur (`null` = le magasin).
 *
 * Le directeur des opérations, pour les personnes de SES équipes — « la gestion du matériel de ses
 * équipes » ; pour le magasin, s'il a la VUE GLOBALE (sans elle il ne voit pas le magasin, et le
 * résultat du comptage lui montrerait ses soldes). Le Super Admin, pour tout le monde. Un
 * superviseur voit le stock de ses KAM ; il ne le fait pas compter — la Direction a confié cette
 * gestion au directeur des opérations, pas à chaque échelon.
 */
export function peutDemanderComptage(f: FaitsStock, detenteur: string | null): boolean {
  if (f.superAdmin) return true;
  if (!f.directeurDesOperations || !f.module.modifier) return false;
  if (detenteur === null) return f.vueGlobale;
  return f.equipe.has(detenteur);
}

/** Demander à TOUTE son équipe d'un coup — il faut en avoir une. */
export function peutDemanderAEquipe(f: FaitsStock): boolean {
  return (f.superAdmin || (f.directeurDesOperations && f.module.modifier)) && f.equipe.size > 0;
}

/** La personne a-t-elle quelqu'un à qui demander un comptage ? (bouton « Demander un comptage ») */
export function peutDemanderDesComptages(f: FaitsStock): boolean {
  return peutDemanderAEquipe(f) || peutDemanderComptage(f, null);
}

/**
 * SAISIR un comptage : celui qui détient le matériel, et lui seul — c'est son attestation. Le
 * magasin se compte par qui le tient (sa gestionnaire, ou le Super Admin qui le tient à défaut),
 * comme un retour au magasin se confirme par elle (§118.164).
 */
export function peutSaisirComptage(f: FaitsStock, detenteur: string | null): boolean {
  if (detenteur === null) return tientLeMagasin(f) && (f.superAdmin || f.module.modifier);
  return detenteur === f.userId && f.module.voir;
}

/** ANNULER un comptage encore à faire : son demandeur, ou le Super Admin. */
export function peutAnnulerComptage(f: FaitsStock, demandeurId: string): boolean {
  return f.superAdmin || (demandeurId === f.userId && f.module.voir);
}

/** SUSPENDRE, REPRENDRE ou SUPPRIMER une récurrence : son auteur, ou le Super Admin. */
export function peutGererRecurrence(f: FaitsStock, auteurId: string | null): boolean {
  return f.superAdmin || (auteurId !== null && auteurId === f.userId && f.module.modifier);
}

/**
 * VOIR un comptage : qui voit le stock de ce détenteur (la même règle que ses soldes — le résultat
 * d'un comptage montre un solde), ou qui l'a demandé.
 */
export function peutVoirComptage(f: FaitsStock, c: { holderId: string | null; demandeurId: string }): boolean {
  return c.demandeurId === f.userId || peutVoirStockDe(f, c.holderId);
}

/** PROPOSER UNE REFONTE : un support DURABLE, par quiconque voit le stock. */
export function peutProposerRefonte(f: FaitsStock, famille: string): boolean {
  return famille === "DURABLE" && (f.superAdmin || f.module.voir);
}

/** DÉCIDER d'une refonte (retenir, écarter) : la Direction Marketing qui tient le magasin, ou le Super Admin. */
export function peutDeciderRefonte(f: FaitsStock): boolean {
  return f.superAdmin || (f.gereLeMagasin && f.module.modifier);
}

/** LE TABLEAU DE BORD : le Super Admin, la vue globale, la gestionnaire du magasin. */
export function peutVoirTableauDeBord(f: FaitsStock): boolean {
  return f.superAdmin || f.vueGlobale || (f.gereLeMagasin && f.module.voir);
}

export const REFUS_COMPTAGE = {
  demander: "Un comptage se demande par le directeur des opérations, pour les personnes de ses équipes (et pour le magasin s'il a la vue globale du stock) — ou par le Super Admin.",
  saisir: "Seul celui qui détient le matériel le compte : c'est son attestation. Le magasin se compte par sa gestionnaire (la Direction Marketing).",
  annuler: "Seul celui qui a demandé ce comptage (ou le Super Admin) peut l'annuler.",
  recurrence: "Seul l'auteur de cette récurrence (ou le Super Admin) peut la suspendre, la reprendre ou la supprimer.",
  refonte: "Une refonte se propose pour un support DURABLE (banner, présentoir, stand), par qui a accès au stock.",
  decider: "Retenir ou écarter une refonte revient à la Direction Marketing, qui tient le magasin — ou au Super Admin.",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LES ÉCHÉANCES
// ═══════════════════════════════════════════════════════════════════════════════════════════

const JOUR_MS = 86_400_000;
const MOIS_PAR_FREQUENCE: Record<Exclude<FrequenceComptage, "HEBDOMADAIRE">, number> = {
  MENSUEL: 1,
  TRIMESTRIEL: 3,
  SEMESTRIEL: 6,
};

/**
 * LA k-IÈME OCCURRENCE d'une récurrence, calculée DEPUIS L'ANCRE — jamais depuis l'occurrence
 * précédente. Un mensuel ancré au 31 janvier donne le 28 (ou 29) février, puis le 31 mars : le
 * calculer pas à pas ferait glisser au 28 pour toujours, sans que personne l'ait voulu.
 */
export function occurrenceComptage(ancre: Date, frequence: FrequenceComptage, k: number): Date {
  if (frequence === "HEBDOMADAIRE") return new Date(ancre.getTime() + k * 7 * JOUR_MS);
  const mois = ancre.getUTCMonth() + k * MOIS_PAR_FREQUENCE[frequence];
  const annee = ancre.getUTCFullYear() + Math.floor(mois / 12);
  const m = ((mois % 12) + 12) % 12;
  const dernierJour = new Date(Date.UTC(annee, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    annee, m, Math.min(ancre.getUTCDate(), dernierJour),
    ancre.getUTCHours(), ancre.getUTCMinutes(), ancre.getUTCSeconds(), ancre.getUTCMilliseconds(),
  ));
}

/**
 * LA PROCHAINE ÉCHÉANCE, STRICTEMENT APRÈS `apres` — et la première, pas une rattrapée : une
 * récurrence restée trois mois en pause reprend à la prochaine date à venir, elle ne fait pas
 * trois comptages d'un coup. « Strictement » : sinon une récurrence qui vient de partir serait
 * aussitôt due, et repartirait à chaque battement.
 */
export function prochaineEcheanceComptage(ancre: Date, frequence: FrequenceComptage, apres: Date): Date {
  if (ancre.getTime() > apres.getTime()) return ancre;
  let k: number;
  if (frequence === "HEBDOMADAIRE") {
    k = Math.floor((apres.getTime() - ancre.getTime()) / (7 * JOUR_MS));
  } else {
    const ecartMois = (apres.getUTCFullYear() - ancre.getUTCFullYear()) * 12 + (apres.getUTCMonth() - ancre.getUTCMonth());
    k = Math.floor(ecartMois / MOIS_PAR_FREQUENCE[frequence]) - 1;
  }
  k = Math.max(0, k);
  // Quelques pas au plus : l'estimation tombe à une ou deux occurrences près.
  while (occurrenceComptage(ancre, frequence, k).getTime() <= apres.getTime()) k += 1;
  while (k > 0 && occurrenceComptage(ancre, frequence, k - 1).getTime() > apres.getTime()) k -= 1;
  return occurrenceComptage(ancre, frequence, k);
}

/** L'échéance d'un comptage : minuit UTC du jour qui tombe `delaiJours` après le déclenchement. */
export function echeanceDuComptage(declencheLe: Date, delaiJours: number): Date {
  const jours = Math.max(1, Math.min(60, Math.floor(delaiJours)));
  return new Date(Date.UTC(declencheLe.getUTCFullYear(), declencheLe.getUTCMonth(), declencheLe.getUTCDate() + jours));
}

/** En retard : le jour de l'échéance est INCLUSIF — le comptage attendu le 12 est en retard le 13. */
export function comptageEnRetard(echeance: Date, maintenant: Date): boolean {
  return maintenant.getTime() >= echeance.getTime() + JOUR_MS;
}

/** Le délai saisi pour une récurrence : 1 à 60 jours — au-delà, ce n'est plus une échéance. */
export function lireDelaiJours(brut: string | null | undefined): number | null {
  const n = parseQuantity(brut);
  if (n == null || !Number.isInteger(n) || n < 1 || n > 60) return null;
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA SAISIE D'UN COMPTAGE
// ═══════════════════════════════════════════════════════════════════════════════════════════

export interface LigneSaisie {
  itemId: string;
  compte: number;
}

/** Un article tel que le comptage le voit : sa famille, s'il est actif, et le solde du détenteur. */
export interface ArticleAComptabiliser {
  itemId: string;
  famille: string;
  actif: boolean;
  /** Le solde du détenteur pour cet article, tous lots confondus. */
  solde: number;
}

/**
 * CE QUI DOIT ÊTRE COMPTÉ, et ce qui peut s'ajouter — une seule règle pour le formulaire (qui
 * dessine les lignes) et pour l'action (qui refuse une saisie incomplète). Deux règles finiraient
 * par diverger, et le symptôme serait un formulaire que l'action refuse « article manquant » sans
 * que la personne puisse voir lequel (§118.5).
 *
 *   • DOIT être compté : tout article de la famille dont le registre attribue un solde NON NUL au
 *     détenteur — archivé compris, car un article archivé encore en main existe physiquement ;
 *     négatif compris, car c'est précisément une anomalie qu'un comptage referme ;
 *   • PEUT s'ajouter (« j'en ai trouvé ») : un article ACTIF de la famille que le registre ne lui
 *     attribue pas.
 */
export function partitionComptage(articles: readonly ArticleAComptabiliser[], famille: PromoFamille | null):
  { attendus: string[]; ajoutables: string[] } {
  const attendus: string[] = [];
  const ajoutables: string[] = [];
  for (const a of articles) {
    if (!familleComptable(a.famille)) continue;
    if (famille && a.famille !== famille) continue;
    if (a.solde !== 0) attendus.push(a.itemId);
    else if (a.actif) ajoutables.push(a.itemId);
  }
  return { attendus, ajoutables };
}

/**
 * DEUX COMPTAGES OUVERTS SE RECOUVRENT-ILS ? Même détenteur, et des familles qui se chevauchent
 * (l'une couvre « tout », ou les deux la même). Deux comptages ouverts sur les mêmes articles
 * feraient compter deux fois — et le second corrigerait le premier.
 */
export function comptagesSeRecouvrent(a: { holderId: string | null; famille: PromoFamille | null }, b: { holderId: string | null; famille: PromoFamille | null }): boolean {
  if (a.holderId !== b.holderId) return false;
  return a.famille === null || b.famille === null || a.famille === b.famille;
}

/**
 * LIRE UNE SAISIE DE COMPTAGE — tout ce qui manque, en une fois (§118.18).
 *
 *   • chaque article que le registre attribue au détenteur (`attendus`) doit avoir sa ligne : un
 *     article oublié garderait son solde en silence, et le comptage se lirait comme complet ;
 *   • « 0 » est une réponse (tout a disparu) ; RIEN n'en est pas une ;
 *   • un article TROUVÉ que le registre ne lui attribue pas s'ajoute s'il est connu (`connus`) —
 *     à zéro il n'apporte rien, on l'ignore ;
 *   • une quantité négative, illisible ou en double est refusée, jamais devinée.
 *
 * `nomDe` sert les phrases : un refus qui dit « la ligne 4 » renvoie la personne compter ses lignes.
 */
export function lireSaisieComptage(
  saisie: readonly { itemId: string; compte: string }[],
  attendus: ReadonlySet<string>,
  connus: ReadonlySet<string>,
  nomDe: (itemId: string) => string,
): { ok: true; lignes: LigneSaisie[] } | { ok: false; faute: string } {
  const vus = new Set<string>();
  const lignes: LigneSaisie[] = [];
  const fautes: string[] = [];
  for (const s of saisie) {
    const id = s.itemId.trim();
    if (!id) continue;
    if (vus.has(id)) { fautes.push(`« ${nomDe(id)} » apparaît deux fois`); continue; }
    vus.add(id);
    if (!attendus.has(id) && !connus.has(id)) { fautes.push(`« ${nomDe(id)} » n'est pas un article qu'on peut compter ici`); continue; }
    const brut = s.compte.trim();
    if (!brut) {
      if (attendus.has(id)) fautes.push(`« ${nomDe(id)} » : dites combien vous en avez (0 compris)`);
      continue;
    }
    const n = parseQuantity(brut);
    if (n == null || n < 0) { fautes.push(`« ${nomDe(id)} » : quantité illisible (« ${brut} »)`); continue; }
    if (!attendus.has(id) && n === 0) continue;
    lignes.push({ itemId: id, compte: Math.round(n * 1000) / 1000 });
  }
  const oublies = [...attendus].filter((id) => !vus.has(id));
  if (oublies.length) {
    fautes.push(
      `${oublies.length} article(s) de votre stock n'ont pas de ligne (${oublies.slice(0, 3).map((id) => `« ${nomDe(id)} »`).join(", ")}${oublies.length > 3 ? "…" : ""}) — s'il vient d'arriver, rechargez la page pour le compter aussi`,
    );
  }
  if (fautes.length) return { ok: false, faute: `${fautes.join(" ; ")}.` };
  if (!lignes.length) return { ok: false, faute: "Rien à compter : aucune ligne n'a été saisie." };
  return { ok: true, lignes };
}

/** Le résumé d'un comptage saisi, pour la notification et le journal : « 3 écarts : −15, +2, −1 ». */
export function resumeEcarts(lignes: readonly { libelle: string; ecart: number }[]): string {
  const ecarts = lignes.filter((l) => l.ecart !== 0);
  if (!ecarts.length) return `${lignes.length} article(s) comptés, aucun écart avec le registre.`;
  const nb = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n).toLocaleString("fr-FR", { maximumFractionDigits: 3 })}`;
  const premiers = ecarts.slice(0, 4).map((l) => `« ${l.libelle} » ${nb(l.ecart)}`).join(", ");
  return `${lignes.length} article(s) comptés, ${ecarts.length} écart(s) corrigé(s) au registre : ${premiers}${ecarts.length > 4 ? `, et ${ecarts.length - 4} autre(s)` : ""}.`;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LES ALERTES
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Une dotation non confirmée depuis ce nombre de jours alerte celui qui l'a lancée (le rappel au destinataire part au troisième jour). */
export const JOURS_ALERTE_EN_ROUTE = 7;

export type GenreAlerte = "SEUIL" | "RUPTURE" | "PEREMPTION" | "PERIME" | "SUPPORT" | "EN_ROUTE" | "COMPTAGE";

export const GENRE_ALERTE_LABEL: Record<GenreAlerte, string> = {
  SEUIL: "Sous le seuil",
  RUPTURE: "Rupture au magasin",
  PEREMPTION: "Expire dans 30 jours",
  PERIME: "Lot périmé encore en main",
  SUPPORT: "Support numérique",
  EN_ROUTE: "Envoi non confirmé",
  COMPTAGE: "Comptage en retard",
};

/** Le destinataire `MAGASIN` désigne les gestionnaires du magasin, résolus par l'appelant. */
export const POUR_LE_MAGASIN = "MAGASIN";

export interface Alerte {
  /** La clé de déduplication — une alerte part à l'ENTRÉE dans l'état, pas à chaque battement. */
  cle: string;
  genre: GenreAlerte;
  texte: string;
  lien: string;
  /** Qui la reçoit : des identifiants de personnes, ou `MAGASIN`. */
  pour: string[];
  /** Le détenteur concerné (`null` = le magasin) — sert au cloisonnement du tableau de bord. */
  detenteur: string | null;
}

export interface EntreeAlertes {
  articles: { itemId: string; libelle: string; seuil: number | null; auMagasin: number; actif: boolean }[];
  /** Les soldes positifs par lot et par détenteur, pour les lots qui ont une fin de validité. */
  lotsDates: { itemId: string; lotId: string; numero: number; libelle: string; holderId: string | null; quantite: number; valableJusquau: Date }[];
  supports: { itemId: string; libelle: string; valableJusquau: Date | null; actif: boolean }[];
  transferts: { id: string; itemId: string; libelle: string; deId: string | null; versId: string | null; initiateurId: string; quantite: number; createdAt: Date }[];
  comptages: { id: string; holderId: string | null; demandeurId: string; famille: PromoFamille | null; echeance: Date; createdAt: Date }[];
  /** Le nom d'une personne (ou « le magasin » pour `null`), pour les phrases. */
  nomDe: (id: string | null) => string;
}

const nb = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
const jourFr = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const cleDet = (h: string | null) => h ?? "magasin";
const LIEN_MAGASIN = lienStockPromo("magasin");
const LIEN_MOI = lienStockPromo("moi");
const LIEN_COMPTAGES = lienStockPromo("comptages");

/**
 * LES ALERTES EN VIGUEUR — calculées depuis des faits, par une seule fonction : le battement qui
 * les envoie et le tableau de bord qui les montre lisent la MÊME liste (§118.5). Deux calculs du
 * même état finiraient par alerter sur ce que l'écran ne montre pas.
 *
 *   • SEUIL — le magasin est passé sous le seuil propre à l'article (sans seuil : jamais) ;
 *   • RUPTURE — le magasin n'en a plus (seuil ou non : la rupture se dit toujours) ;
 *   • PÉREMPTION — un lot en main expire dans trente jours : on le prévient TANT QU'il se remet ;
 *   • PÉRIMÉ — un lot dont la validité est passée est encore en main : il se déclare détruit ;
 *   • SUPPORT — un support numérique expire bientôt, ou a expiré et reste actif ;
 *   • EN_ROUTE — un envoi attend depuis sept jours la confirmation de son destinataire ;
 *   • COMPTAGE — un comptage n'est pas saisi à son échéance.
 *
 * Chaque clé porte l'identifiant de l'ARTICLE (ou du comptage) en second : c'est ce qui permet au
 * battement de borner une passe à un périmètre sans retirer les clés des autres.
 */
export function alertesDuStock(e: EntreeAlertes, maintenant: Date): Alerte[] {
  const alertes: Alerte[] = [];
  for (const a of e.articles) {
    if (!a.actif) continue;
    if (a.auMagasin <= 0) {
      alertes.push({
        cle: `rupture:${a.itemId}`, genre: "RUPTURE", lien: LIEN_MAGASIN, pour: [POUR_LE_MAGASIN], detenteur: null,
        texte: `« ${a.libelle} » : le magasin n'en a plus.`,
      });
    } else if (a.seuil != null && a.seuil > 0 && a.auMagasin <= a.seuil) {
      alertes.push({
        cle: `seuil:${a.itemId}`, genre: "SEUIL", lien: LIEN_MAGASIN, pour: [POUR_LE_MAGASIN], detenteur: null,
        texte: `« ${a.libelle} » : plus que ${nb(a.auMagasin)} au magasin (seuil ${nb(a.seuil)}).`,
      });
    }
  }
  for (const l of e.lotsDates) {
    if (!(l.quantite > 0)) continue;
    const etat = etatValidite(l.valableJusquau, maintenant);
    if (etat !== "BIENTOT" && etat !== "PERIME") continue;
    const chez = l.holderId === null ? "au magasin" : `chez ${e.nomDe(l.holderId)}`;
    alertes.push(etat === "BIENTOT"
      ? {
          cle: `peremption:${l.itemId}:${l.lotId}:${cleDet(l.holderId)}`, genre: "PEREMPTION",
          lien: l.holderId === null ? LIEN_MAGASIN : LIEN_MOI,
          pour: [l.holderId ?? POUR_LE_MAGASIN], detenteur: l.holderId,
          texte: `« ${l.libelle} », lot ${l.numero} : ${nb(l.quantite)} ${chez} expirent le ${jourFr(l.valableJusquau)} — ils partent en premier, distribuez-les avant.`,
        }
      : {
          cle: `perime:${l.itemId}:${l.lotId}:${cleDet(l.holderId)}`, genre: "PERIME",
          lien: l.holderId === null ? LIEN_MAGASIN : LIEN_MOI,
          pour: [l.holderId ?? POUR_LE_MAGASIN], detenteur: l.holderId,
          texte: `« ${l.libelle} », lot ${l.numero} : ${nb(l.quantite)} ${chez} sont périmés depuis le ${jourFr(l.valableJusquau)} — ils ne se remettent plus : déclarez-les détruits (Perte).`,
        });
  }
  for (const s of e.supports) {
    if (!s.actif || !s.valableJusquau) continue;
    const etat = etatValidite(s.valableJusquau, maintenant);
    if (etat !== "BIENTOT" && etat !== "PERIME") continue;
    alertes.push({
      cle: `support:${s.itemId}:${etat}`, genre: "SUPPORT", lien: LIEN_MAGASIN, pour: [POUR_LE_MAGASIN], detenteur: null,
      texte: etat === "BIENTOT"
        ? `Support numérique « ${s.libelle} » : valable jusqu'au ${jourFr(s.valableJusquau)} — à renouveler ou à archiver.`
        : `Support numérique « ${s.libelle} » : expiré depuis le ${jourFr(s.valableJusquau)} et toujours proposé — archivez-le ou prolongez sa validité.`,
    });
  }
  for (const t of e.transferts) {
    const jours = Math.floor((maintenant.getTime() - t.createdAt.getTime()) / JOUR_MS);
    if (jours < JOURS_ALERTE_EN_ROUTE) continue;
    const pour = new Set<string>([t.initiateurId]);
    if (t.deId === null || t.versId === null) pour.add(POUR_LE_MAGASIN);
    alertes.push({
      cle: `enroute:${t.itemId}:${t.id}`, genre: "EN_ROUTE",
      lien: t.deId === null || t.versId === null ? LIEN_MAGASIN : LIEN_MOI,
      pour: [...pour], detenteur: t.deId,
      texte: `${nb(t.quantite)} × « ${t.libelle} » envoyé(s) par ${e.nomDe(t.deId)} à ${e.nomDe(t.versId)} il y a ${jours} jours : toujours pas confirmé(s). Tant que rien n'est confirmé, ce matériel n'est chez personne — relancez, ou annulez l'envoi.`,
    });
  }
  for (const c of e.comptages) {
    if (!comptageEnRetard(c.echeance, maintenant)) continue;
    alertes.push({
      cle: `comptage:${c.id}`, genre: "COMPTAGE", lien: LIEN_COMPTAGES,
      pour: [...new Set([c.holderId ?? POUR_LE_MAGASIN, c.demandeurId])], detenteur: c.holderId,
      texte: `Le comptage (${libelleFamilleComptage(c.famille)}) demandé ${c.holderId === null ? "au magasin" : `à ${e.nomDe(c.holderId)}`} le ${jourFr(c.createdAt)} était attendu le ${jourFr(c.echeance)} : il n'est pas encore saisi.`,
    });
  }
  return alertes;
}

/** Une clé appartient-elle au périmètre d'une passe bornée ? (son second segment, article ou comptage) */
export function cleDansLePerimetre(cle: string, perimetre: { itemIds: ReadonlySet<string>; comptageIds: ReadonlySet<string> }): boolean {
  const [genre, id] = cle.split(":");
  if (!id) return false;
  return genre === "comptage" ? perimetre.comptageIds.has(id) : perimetre.itemIds.has(id);
}

/**
 * LE MESSAGE D'UNE PERSONNE pour une passe — une seule notification, jamais une par alerte :
 * vingt notifications d'un coup se lisent comme du bruit, et l'on coupe les notifications du
 * stock pour toujours (§118.32). Une alerte seule garde son texte et son lien exacts.
 */
export function messageDAlertes(alertes: readonly Alerte[]): { titre: string; corps: string; lien: string } | null {
  if (!alertes.length) return null;
  if (alertes.length === 1) {
    const a = alertes[0]!;
    return { titre: `Stock promotionnel — ${GENRE_ALERTE_LABEL[a.genre]}`, corps: a.texte, lien: a.lien };
  }
  const premieres = alertes.slice(0, 5).map((a) => `• ${a.texte}`).join("\n");
  const reste = alertes.length > 5 ? `\n… et ${alertes.length - 5} autre(s), sur le tableau de bord du stock.` : "";
  const lien = alertes.every((a) => a.lien === alertes[0]!.lien) ? alertes[0]!.lien : lienStockPromo("tableau");
  return { titre: `Stock promotionnel — ${alertes.length} alertes`, corps: `${premieres}${reste}`, lien };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LE TABLEAU DE BORD
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Fenêtre de la consommation, et seuil au-delà duquel un article sans sortie est « dormant ». */
export const JOURS_TABLEAU = 90;

export interface LigneValeur {
  quantite: number;
  coutUnitaire: number | null;
}

/**
 * LA VALEUR D'UN STOCK — les soldes POSITIFS par lot, au coût de leur lot. Ce qui n'a pas de coût
 * connu n'est pas compté à zéro : il est COMPTÉ À PART, et l'écran le dit. Une valeur qui tairait
 * les unités sans coût se lirait comme la valeur du stock entier.
 */
export function valeurDuStock(lignes: readonly LigneValeur[]): { valeur: number; unitesValorisees: number; unitesSansCout: number } {
  let valeur = 0;
  let valorisees = 0;
  let sansCout = 0;
  for (const l of lignes) {
    if (!(l.quantite > 0)) continue;
    if (l.coutUnitaire == null) sansCout += l.quantite;
    else { valeur += l.quantite * l.coutUnitaire; valorisees += l.quantite; }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  return { valeur: r2(valeur), unitesValorisees: r3(valorisees), unitesSansCout: r3(sansCout) };
}

/**
 * UN ARTICLE DORMANT — du stock en main, et aucune SORTIE (remise, envoi, réservation d'événement)
 * depuis `JOURS_TABLEAU` jours. Un article reçu il y a dix jours n'est pas dormant : il n'a pas eu
 * le temps de servir — sans cette condition, chaque arrivage neuf s'afficherait comme un stock mort.
 */
export function estDormant(a: { quantite: number; premiereEntree: Date | null; derniereSortie: Date | null }, maintenant: Date): boolean {
  if (!(a.quantite > 0)) return false;
  const limite = maintenant.getTime() - JOURS_TABLEAU * JOUR_MS;
  if (!a.premiereEntree || a.premiereEntree.getTime() > limite) return false;
  return !a.derniereSortie || a.derniereSortie.getTime() <= limite;
}
