/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * OÙ EN EST LE CIRCUIT — ce que chaque validateur a dit, lu pour le DEMANDEUR (Direction, 06/10).
 *
 * « J'ai demandé des validations, ça a été validé, et chez moi c'est toujours "En attente". » Le
 * statut était juste : une validation demandée depuis le secrétariat à DEUX validateurs est un
 * circuit séquentiel — le premier valide, la demande passe au second, et elle n'est validée qu'avec
 * les deux accords. Mais l'écran de l'assistante ne montrait que ce statut global, et le motif du
 * premier SANS son auteur : « Je valide… » sous « En attente », sans dire qui avait validé ni qui
 * restait à attendre. Une phrase juste qu'on lit fausse.
 *
 * Une seule lecture, pure, pour l'écran ET pour la notification au demandeur : par validateur,
 * ✓ validé / ✗ refusé / ⏳ en attente (à son tour, ou après un autre), avec la date et le motif ; et
 * un résumé d'une ligne — « Validé par A — en attente de B ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type EtatEtape = "VALIDE" | "REFUSE" | "A_CORRIGER" | "A_SON_TOUR" | "EN_FILE" | "SANS_OBJET";

export interface EtapeDuCircuit {
  order: number;
  status: string;
  validateur: string;
  motif: string | null;
  decideeLe: Date | null;
}

export interface LigneDuCircuit {
  validateur: string;
  etat: EtatEtape;
  libelle: string;
  motif: string | null;
  decideeLe: Date | null;
}

export interface CircuitLu {
  lignes: LigneDuCircuit[];
  resume: string;
}

/** « A », « A et B », « A, B et C ». */
export function enumerer(noms: readonly string[]): string {
  if (noms.length <= 1) return noms[0] ?? "";
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

/** Le circuit dit en clair : « Séquentiel » ne dit pas à l'assistante qu'il faut les deux accords. */
export function libelleDuMode(mode: string, nbEtapes: number): string | null {
  if (nbEtapes < 2) return null;
  return mode === "PARALLEL" ? "les validateurs décident en même temps" : "les validateurs décident l'un après l'autre";
}

function etatDe(
  e: EtapeDuCircuit,
  d: { status: string; mode: string; currentOrder: number },
): EtatEtape {
  if (e.status === "APPROVED") return "VALIDE";
  if (e.status === "REJECTED") return "REFUSE";
  if (e.status === "CHANGES_REQUESTED") return "A_CORRIGER";
  if (e.status !== "PENDING") return "SANS_OBJET";
  // Étape encore ouverte : sa place dépend de la demande.
  if (d.status === "CHANGES_REQUESTED") return "EN_FILE";
  if (d.status !== "PENDING") return "SANS_OBJET";
  if (d.mode === "PARALLEL" || e.order <= d.currentOrder) return "A_SON_TOUR";
  return "EN_FILE";
}

/**
 * LE CIRCUIT LU — `steps` dans l'ordre du circuit. Les libellés disent ce que l'écran doit dire ;
 * l'icône (✓ ✗ ⏳) se choisit sur `etat`.
 */
export function lireCircuit(d: {
  status: string;
  mode: string;
  currentOrder: number;
  steps: readonly EtapeDuCircuit[];
}): CircuitLu {
  const etapes = [...d.steps].sort((a, b) => a.order - b.order);
  const lignes: LigneDuCircuit[] = etapes.map((e) => {
    const etat = etatDe(e, d);
    let libelle: string;
    switch (etat) {
      case "VALIDE": libelle = "Validé"; break;
      case "REFUSE": libelle = "Refusé"; break;
      case "A_CORRIGER": libelle = "Correction demandée"; break;
      case "A_SON_TOUR": libelle = "En attente de sa décision"; break;
      case "EN_FILE": {
        if (d.status === "CHANGES_REQUESTED") { libelle = "En attente de la correction"; break; }
        const avant = etapes.filter((x) => x.order < e.order && x.status === "PENDING").map((x) => x.validateur);
        libelle = avant.length > 0 ? `En attente — après ${enumerer(avant)}` : "En attente";
        break;
      }
      default: libelle = "Non sollicité";
    }
    return { validateur: e.validateur, etat, libelle, motif: e.motif, decideeLe: e.decideeLe };
  });

  const noms = (etat: EtatEtape) => lignes.filter((l) => l.etat === etat).map((l) => l.validateur);
  const valides = noms("VALIDE");
  let resume: string;
  switch (d.status) {
    case "APPROVED":
      resume = valides.length > 0 ? `Validé par ${enumerer(valides)}.` : "Validé.";
      break;
    case "REJECTED":
      resume = noms("REFUSE").length > 0 ? `Refusé par ${enumerer(noms("REFUSE"))}.` : "Refusé.";
      break;
    case "CHANGES_REQUESTED":
      resume = noms("A_CORRIGER").length > 0
        ? `Correction demandée par ${enumerer(noms("A_CORRIGER"))} — le circuit reprendra à la resoumission.`
        : "Correction demandée.";
      break;
    case "CANCELLED":
      resume = "Demande de validation retirée.";
      break;
    default: {
      const aSonTour = noms("A_SON_TOUR");
      const enFile = noms("EN_FILE");
      const attente = aSonTour.length > 0
        ? `en attente de ${enumerer(aSonTour)}${enFile.length > 0 ? `, puis de ${enumerer(enFile)}` : ""}`
        : enFile.length > 0 ? `en attente de ${enumerer(enFile)}` : "en attente";
      // L'accord de CHACUN est requis : le dire évite de lire un premier « je valide » comme la fin.
      const chacun = lignes.length > 1 ? " — l'accord de chaque validateur est requis" : "";
      resume = valides.length > 0
        ? `Validé par ${enumerer(valides)} — ${attente}${chacun}.`
        : `${attente.charAt(0).toUpperCase()}${attente.slice(1)}${chacun}.`;
    }
  }
  return { lignes, resume };
}
