/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES ENTRÉES D'UN WORKER, RENDUES SANS EN PERDRE UNE — et en DISANT ce qui est coupé.
 *
 * ── LE DÉFAUT MESURÉ, ET IL COÛTAIT LA MISSION ENTIÈRE (§89) ─────────────────────────────
 *
 * Le prompt écrivait `JSON.stringify(input, null, 2).slice(0, 6000)`. Une coupe BRUTE, au
 * milieu du JSON, sans un mot. Sur la chaîne humaine, l'étape de consolidation recevait :
 *
 *     { nivolex: <8 800 caractères>, trastuzex: <8 800 caractères>,
 *       reponseKhaled: { contenu: "Prix de cession Nivolex 84 500 DZD…" },
 *       reponseSofiane: { contenu: "AO-2026-114 (Nivolex, attribué)…" } }
 *
 * Les deux dossiers ERP mangeaient les 6 000 caractères. Les deux RÉPONSES HUMAINES — trois
 * lignes chacune, la seule chose que la mission était allée chercher — n'atteignaient jamais le
 * modèle. Il a écrit, honnêtement, « prix de cession : non fourni ». Le classeur et le deck ont
 * été bâtis là-dessus : 0 chiffre du jeu d'essai sur 6, trois runs de suite.
 *
 * `WorkerRun.input` gardait l'entrée COMPLÈTE — c'est ce qui a fait croire trois fois que le
 * modèle ignorait ce qu'on lui donnait. Le prompt, lui, ne l'avait jamais reçue.
 *
 * ── LES TROIS PROPRIÉTÉS QUI REMPLACENT LA COUPE ────────────────────────────────────────
 *
 * 1. **Aucune clé ne disparaît.** Le budget se répartit ENTRE les clés, il ne se consomme pas
 *    dans l'ordre. Une réponse de trois lignes n'est jamais évincée par un dossier de neuf
 *    mille caractères.
 * 2. **La part est équitable au sens max-min.** On sert d'abord les petites valeurs, qui
 *    tiennent entièrement ; leur surplus va aux grandes. Personne n'est coupé tant qu'il reste
 *    de la place, et ce qui est coupé l'est au plus près du nécessaire.
 * 3. **Une coupe se DIT, à l'endroit exact où elle a lieu**, avec la seule phrase qui compte :
 *    ce qui manque ici n'est pas absent du monde. C'est la différence entre « je n'ai pas
 *    l'information » et « l'information n'existe pas » — la seconde est un faux, et c'est
 *    exactement celui que la coupe silencieuse fabriquait.
 *
 * Module PUR : le compilateur et les tests s'en servent sans tirer Prisma ni le fournisseur.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Le budget par bloc du prompt d'un worker. Inchangé — c'est la RÉPARTITION qui était fausse. */
export const BUDGET_BLOC = 6000;

/** Le plancher sous lequel une valeur ne se lit plus : mieux vaut la dire coupée que la hacher. */
export const PART_MINIMALE = 160;

const marque = (garde: number, total: number): string =>
  `\n… [COUPÉ ICI : ${garde} caractères sur ${total}. Le reste n'est PAS dans ce prompt — `
  + `son absence ici ne prouve rien, ne conclus pas qu'il n'existe pas.]`;

/**
 * RÉPARTIT UN BUDGET DE CARACTÈRES ENTRE DES VALEURS, au sens max-min.
 *
 * Rend, pour chaque clé et dans l'ordre reçu, le texte à afficher — entier ou coupé et dit.
 */
export function repartir(
  valeurs: readonly { cle: string; texte: string }[],
  budget = BUDGET_BLOC,
): { cle: string; texte: string; coupe: boolean }[] {
  if (valeurs.length === 0) return [];
  const parts = new Map<string, { texte: string; coupe: boolean }>();

  // Les petites d'abord : ce qui tient entièrement libère sa place pour les grandes.
  const ordre = [...valeurs].sort((a, b) => a.texte.length - b.texte.length);
  let reste = Math.max(budget, PART_MINIMALE * ordre.length);
  let aServir = ordre.length;

  for (const v of ordre) {
    const part = Math.max(PART_MINIMALE, Math.floor(reste / aServir));
    if (v.texte.length <= part) {
      parts.set(v.cle, { texte: v.texte, coupe: false });
      reste -= v.texte.length;
    } else {
      const garde = Math.max(PART_MINIMALE, part);
      parts.set(v.cle, { texte: v.texte.slice(0, garde) + marque(garde, v.texte.length), coupe: true });
      reste -= garde;
    }
    aServir -= 1;
    if (reste < 0) reste = 0;
  }

  return valeurs.map((v) => ({ cle: v.cle, ...parts.get(v.cle)! }));
}

/**
 * REND UN OBJET D'ENTRÉES pour un prompt : une clé par bloc, aucune perdue, coupes annoncées.
 *
 * On n'imprime PAS le JSON d'un bloc : un objet tronqué au milieu produit un JSON invalide que
 * le modèle doit deviner. Chaque valeur est rendue seule, sous son nom, et ce qui est coupé
 * l'est à la fin de SA valeur.
 */
export function rendreEntrees(input: Record<string, unknown>, budget = BUDGET_BLOC): string {
  const valeurs = Object.entries(input).map(([cle, v]) => ({
    cle,
    texte: typeof v === "string" ? v : JSON.stringify(v, null, 2) ?? String(v),
  }));
  return repartir(valeurs, budget).map((p) => `${p.cle} :\n${p.texte}`).join("\n\n");
}
