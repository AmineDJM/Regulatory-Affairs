/**
 * LE SIGNAL — le vocabulaire commun de l'intelligence métier (mandat 4 §27). Pur, sans import :
 * Regulatory, Legal et Finance produisent chacun des signaux de cette forme, et la boîte de
 * décision, les outils d'Adam et l'écran les lisent sans connaître le domaine qui les a émis.
 *
 * Un signal DIT son calcul (`calcul`) : le lecteur peut refaire l'arithmétique ou relire la
 * clause. Sans calcul lisible, un signal est une opinion — et Adam n'en a pas.
 */

export type Gravite = "CRITIQUE" | "HAUTE" | "NORMALE" | "BASSE";
export const RANG_GRAVITE: Record<Gravite, number> = { CRITIQUE: 0, HAUTE: 1, NORMALE: 2, BASSE: 3 };
export const LIBELLE_GRAVITE: Record<Gravite, string> = { CRITIQUE: "critique", HAUTE: "haute", NORMALE: "normale", BASSE: "basse" };

export type DomaineSignal = "REGULATORY" | "LEGAL" | "FINANCE";

export interface Signal {
  code: string;
  gravite: Gravite;
  titre: string;
  detail: string;
  /** Le calcul, en clair : « 62 % consommé à 41 % du temps », « fin − préavis 6 mois ». */
  calcul?: string;
  /** ISO `AAAA-MM-JJ` quand le signal a une date. */
  echeance?: string | null;
  montant?: number | null;
  entite?: { type: string; id: string; ref?: string | null } | null;
  href?: string | null;
  /** Ce qu'il y a à FAIRE — une phrase pour Adam ou pour la personne. */
  action?: string | null;
  /**
   * LE GESTE DÉCLARÉ — la seule chose que le CODE peut proposer sur ce signal sans deviner.
   *
   * `action` dit déjà « ce qu'il y a à FAIRE », mais en PROSE française : en déduire un appel
   * d'outil serait deviner, et une table « phrase → geste » écrite à la main serait fausse au
   * premier signal ajouté, en silence (§118.73). Le marqueur est donc posé PAR L'AUTEUR du
   * signal, là où vit le savoir métier, et il ne répond qu'à une question : *une TÂCHE est-elle
   * le bon pas suivant ?* Le libellé, lui, n'est pas redit — c'est `action`, sinon deux endroits
   * nommeraient la même chose et finiraient par la nommer autrement (§118.5).
   *
   * CE QU'UNE TÂCHE N'EST PAS. Elle ne fait pas le geste : elle l'INSCRIT, sur un enregistrement
   * nommé, avec sa date. C'est ce qui la rend compatible avec « relancer le partenaire — jamais
   * automatiquement » : rien ne part, une ligne de suivi existe. Et c'est le remède que §118.57a
   * a déjà nommé — une promesse qui ne vit que dans une phrase meurt à la fin du tour.
   *
   * CE QUI NE LE PORTE JAMAIS : un signal dont la suite est une DÉCISION de la personne
   * (« décider : renouveler, renégocier ou laisser expirer »). Inscrire une tâche à la place
   * d'une décision déplace l'arbitrage au lieu de le servir.
   */
  tache?: true;
  domaine?: DomaineSignal;
}

/** TRIER des signaux : gravité, puis échéance, puis montant décroissant. */
export function trierSignaux<T extends Signal>(signaux: readonly T[]): T[] {
  return [...signaux].sort((a, b) => RANG_GRAVITE[a.gravite] - RANG_GRAVITE[b.gravite] || (a.echeance ?? "9999").localeCompare(b.echeance ?? "9999") || (b.montant ?? 0) - (a.montant ?? 0));
}

/** Un RÉSUMÉ chiffré : combien par gravité — ce qu'un PDG lit en premier. */
export function resumerSignaux(signaux: readonly Signal[]): { total: number; parGravite: Record<Gravite, number>; phrase: string } {
  const parGravite: Record<Gravite, number> = { CRITIQUE: 0, HAUTE: 0, NORMALE: 0, BASSE: 0 };
  for (const s of signaux) parGravite[s.gravite] += 1;
  const parts = (Object.keys(parGravite) as Gravite[]).filter((g) => parGravite[g] > 0).map((g) => `${parGravite[g]} ${LIBELLE_GRAVITE[g]}${parGravite[g] > 1 && g !== "BASSE" ? "s" : ""}`);
  return { total: signaux.length, parGravite, phrase: signaux.length ? `${signaux.length} ${signaux.length > 1 ? "signaux" : "signal"} (${parts.join(", ")})` : "aucun signal" };
}

/** Une gravité depuis un nombre de jours restants : dépassé → critique, sous 7 → haute, sous 30 → normale, sinon basse. */
export function graviteParJours(jours: number, seuils: { haute?: number; normale?: number } = {}): Gravite {
  if (jours < 0) return "CRITIQUE";
  if (jours <= (seuils.haute ?? 7)) return "HAUTE";
  if (jours <= (seuils.normale ?? 30)) return "NORMALE";
  return "BASSE";
}

export const JOUR_MS = 86_400_000;
export const joursEntre = (de: Date, a: Date): number => Math.floor((a.getTime() - de.getTime()) / JOUR_MS);
export const isoJour = (d: Date): string => d.toISOString().slice(0, 10);

/** Ce qu'une carte proposée a besoin de savoir — rien de plus que ce que le signal porte. */
export interface GesteDuSignal {
  /** Le code du signal, pour que la carte dise d'où elle vient et pour ne pas la proposer deux fois. */
  code: string;
  gravite: Gravite;
  /** L'intitulé de la tâche : `action`, tel que l'auteur du signal l'a écrit. */
  intitule: string;
  /** Le constat qui la justifie — titre, calcul, référence : ce qu'on relit dans six semaines. */
  pourquoi: string;
  /**
   * LA DATE, SEULEMENT QUAND ELLE EST ENCORE DEVANT NOUS.
   *
   * Mesuré sur la sonde live : le geste retenu sortait avec `dueDate = 2026-08-01` pour une
   * étape en retard de 40 jours — l'`echeance` d'un signal est la date à laquelle la chose
   * ÉTAIT due, et sur un signal de RETARD elle est dans le passé. La tâche naissait donc
   * en retard de quarante jours, ce qui fait mentir tout rapport de tâches en retard.
   *
   * Les deux autres conduites étaient pires. Inventer « aujourd'hui + 7 » fabriquerait une
   * échéance que personne n'a décidée (§118.16). Et garder la date passée par fidélité à la
   * donnée revient à préférer un champ FAUX à un champ absent. Le retard, lui, n'est pas
   * perdu : `pourquoi` porte « Étape en retard de 40 j » et son calcul — l'information
   * passe d'un champ faux à une phrase vraie.
   */
  echeance: string | null;
  /** La fiche de l'enregistrement concerné, pour la carte. */
  href: string | null;
}

/**
 * LE GESTE À PROPOSER POUR UN TOUR — au plus UN, et seulement quand rien n'est deviné.
 *
 * ── LE DÉFAUT QU'IL FERME (§118.123b, §118.125) ──────────────────────────────────────────
 *
 * Mesuré sur la sonde de conversation : « qu'est-ce qui bloque ? » rendait six blocages nommés,
 * sourcés, liés à leurs fiches — et ZÉRO proposition, trois passages sur trois. Trois niveaux de
 * pression de prompt n'y ont rien changé, et la trace a montré qu'aucun outil d'écriture n'était
 * même appelé. Un constat critique qui ne propose rien est un tableau de bord ; le geste est donc
 * une propriété du LOGICIEL, pas une prière adressée au prompt.
 *
 * ── CE QU'IL REFUSE DE FAIRE ─────────────────────────────────────────────────────────────
 *
 * Il ne LIT que ce que le signal déclare : pas de correspondance devinée depuis la prose
 * (§118.125), pas de destinataire inventé (§118.34 : collapser une liste choisirait une personne
 * à la place d'un humain). Il exige les quatre faits — le marqueur `tache`, une gravité qui le
 * mérite, une phrase à inscrire, un enregistrement nommé — et rend `null` dès qu'il en manque un.
 *
 * ── POURQUOI UN SEUL ─────────────────────────────────────────────────────────────────────
 *
 * Une proposition par ligne de constat redevient du bruit qu'on cesse de lire (§118.32), et sur
 * une liste de six blocages la personne ne veut pas six cartes : elle veut la SUIVANTE. Le tri
 * canonique (`trierSignaux` : gravité, puis échéance, puis montant) décide laquelle — pas l'ordre
 * dans lequel les règles se trouvent avoir tourné.
 */
export function gesteDuTour(signaux: readonly Signal[], aujourdHui: string): GesteDuSignal | null {
  const eligible = (s: Signal): boolean =>
    s.tache === true
    && (s.gravite === "CRITIQUE" || s.gravite === "HAUTE")
    && typeof s.action === "string" && s.action.trim().length > 0
    && Boolean(s.entite?.id);
  const retenu = trierSignaux(signaux.filter(eligible))[0];
  if (!retenu) return null;
  const ref = retenu.entite?.ref ?? retenu.entite?.id ?? "";
  return {
    code: retenu.code,
    gravite: retenu.gravite,
    intitule: retenu.action!.trim(),
    // LE POURQUOI VOYAGE AVEC LA TÂCHE. Sans lui, on relit dans six semaines « Obtenir les pièces
    // manquantes » sans savoir de quel dossier ni sur quel calcul — une tâche sans son constat est
    // une consigne orpheline.
    pourquoi: [retenu.titre, retenu.calcul ? `Calcul : ${retenu.calcul}` : null, ref ? `Référence : ${ref}` : null]
      .filter(Boolean).join(" — "),
    // `aujourdHui` est un jour ISO et le paramètre est OBLIGATOIRE : une valeur par défaut
    // (« si on ne me donne pas la date, je laisse passer ») réintroduirait le défaut en
    // silence chez le prochain appelant, et c'est exactement ce qu'un paramètre requis
    // empêche — le typecheck le réclame au point d'appel. Deux jours ISO se comparent
    // lexicographiquement, ce pour quoi `isoJour` existe.
    echeance: retenu.echeance && retenu.echeance >= aujourdHui ? retenu.echeance : null,
    href: retenu.href ?? null,
  };
}
