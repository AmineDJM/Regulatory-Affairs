/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE LOTEUR DE LECTURES — N demandes logiques, K requêtes physiques (fabric F6).
 *
 * ── LE COÛT QUE CE MODULE SUPPRIME ──────────────────────────────────────────────────────
 *
 * L'hydratation des CANDIDATS se payait à la pièce : la recherche de contenu rend vingt
 * identifiants, et la boucle qui les vérifie faisait vingt `findUnique` — un aller-retour
 * SQL par document, en série. Vingt candidats = vingt requêtes ; mille = mille. Le loteur
 * RASSEMBLE les demandes d'un même tour de boucle d'événements et les sert en UNE requête
 * `findMany` (découpée par `tailleMax` au-delà) : mille demandes logiques deviennent une
 * poignée d'appels physiques — la cible §20 du mandat, MESURÉE et non affirmée.
 *
 * ── CE QUE LE LOTEUR N'EST PAS ──────────────────────────────────────────────────────────
 *
 * Ce n'est PAS un cache : rien ne survit au vidage d'un lot. Deux lectures du même
 * identifiant dans deux tours différents refont deux lectures — la fraîcheur ne se négocie
 * pas ici (les états qui méritent d'être gardés ont `hot-state.ts`). Et ce n'est PAS un
 * contournement de droits : le loteur rend des LIGNES ; l'ACL se vérifie chez l'appelant,
 * nœud par nœud, exactement comme avant.
 *
 * L'instance se crée PAR OPÉRATION (une recherche, une vague de mission) : la mesure
 * {logiques, physiques} est alors EXACTE pour cette opération-là, au lieu d'un compteur
 * global brouillé par les voisins.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { prisma } from "@/lib/prisma";

export interface MesureLoteur {
  /** Les demandes reçues (`charger`), une par identifiant demandé. */
  logiques: number;
  /** Les requêtes SQL réellement parties. C'est le chiffre que le lot fait chuter. */
  physiques: number;
  /** Les vidages de lot (un vidage peut coûter plusieurs requêtes si le lot dépasse tailleMax). */
  lots: number;
}

export interface Loteur<V> {
  /** Demande UNE ligne ; les demandes d'un même tour partent ensemble. `null` = absente. */
  charger(id: string): Promise<V | null>;
  mesure(): MesureLoteur;
}

/**
 * Fabrique un loteur sur un chargeur PAR LOT (`ids -> Map<id, ligne>`).
 *
 * Le rassemblement se fait à la microtâche : tout ce qui est demandé dans le même tour de
 * boucle (un `Promise.all` sur les candidats, des étapes parallèles d'une même vague) part
 * dans le même lot. Un identifiant demandé deux fois dans le même lot n'est chargé qu'une
 * fois — mais compte deux demandes logiques : la mesure dit ce qu'on a évité de payer.
 */
export function creerLoteur<V>(
  chargeur: (ids: readonly string[]) => Promise<Map<string, V>>,
  opts: { tailleMax?: number } = {},
): Loteur<V> {
  const tailleMax = Math.max(1, opts.tailleMax ?? 200);
  const mesure: MesureLoteur = { logiques: 0, physiques: 0, lots: 0 };
  let enAttente: Map<string, { resolve: (v: V | null) => void; reject: (e: unknown) => void }[]> | null = null;

  const vider = async (): Promise<void> => {
    const lot = enAttente;
    enAttente = null;
    if (!lot || lot.size === 0) return;
    mesure.lots += 1;
    const ids = [...lot.keys()];
    try {
      const resultat = new Map<string, V>();
      for (let i = 0; i < ids.length; i += tailleMax) {
        mesure.physiques += 1;
        const tranche = await chargeur(ids.slice(i, i + tailleMax));
        for (const [k, v] of tranche) resultat.set(k, v);
      }
      for (const [id, attentes] of lot) {
        const v = resultat.get(id) ?? null;
        for (const a of attentes) a.resolve(v);
      }
    } catch (e) {
      for (const attentes of lot.values()) for (const a of attentes) a.reject(e);
    }
  };

  return {
    charger(id: string): Promise<V | null> {
      mesure.logiques += 1;
      return new Promise<V | null>((resolve, reject) => {
        if (!enAttente) {
          enAttente = new Map();
          queueMicrotask(() => { void vider(); });
        }
        const deja = enAttente.get(id);
        if (deja) deja.push({ resolve, reject });
        else enAttente.set(id, [{ resolve, reject }]);
      });
    },
    mesure: () => ({ ...mesure }),
  };
}

/**
 * LE LOTEUR DES NŒUDS DU DRIVE — l'hydratation des candidats rendus par `chercherContenu`
 * et `documentsLies`. Une instance PAR RECHERCHE : sa mesure est celle de cette recherche.
 */
export function loteurNoeudsDrive(): Loteur<{ id: string; name: string; isTrashed: boolean }> {
  return creerLoteur(async (ids) => {
    const rows = await prisma.driveNode.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, name: true, isTrashed: true },
    });
    return new Map(rows.map((r) => [r.id, r]));
  });
}
