/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE SEUIL AD & PRO — au-delà de combien la Direction Générale valide-t-elle ?
 *
 * Module PUR au SOCLE, zéro import. Une seule règle, et TROIS couches en ont besoin sans avoir
 * le droit de se parler (§118.72, §118.97, §118.105, §118.128) :
 *
 *   • `lib/workflow/parcours.ts` — domaine `tasks` : les quatre circuits configurables, qui
 *     traduisent la règle en franchissement automatique de l'étape `dg` ;
 *   • `lib/promo-material/circuit.ts` — domaine `adpro` : le matériel promotionnel, qui n'a pas
 *     d'étapes en base et pose la question directement sur `REVIEW_DG` ;
 *   • `lib/ad-pro/centre.ts` et le CENTRE DE VALIDATION — qui doit dire, pour une demande, si
 *     elle relève du centre, et afficher le seuil qui l'y a envoyée.
 *
 * `tasks` et `adpro` sont deux domaines distincts (`platform/domains.ts`) : le second n'a pas le
 * droit d'importer le premier. **C'est exactement pourquoi la règle s'est retrouvée écrite DEUX
 * FOIS** (§118.138) — `dgRequis` dans `parcours.ts`, et la même arithmétique recopiée dans
 * `etapeApplicable`. Elles s'accordaient ; elles auraient divergé au premier ajustement, et le
 * symptôme aurait été le pire possible : un matériel promotionnel de 1,2 M franchissant la porte
 * du DG qu'un sponsoring du même montant respecte (§118.5).
 *
 * Pire : `dgRequis` PROMETTAIT ce partage dans sa propre prose — « lecture unique, partagée par
 * le circuit Ad & Pro et par le matériel promotionnel » — alors que son SEUL importeur du dépôt
 * était son propre test (§118.14, §118.49). Un commentaire qui affirme un partage que le code
 * n'a pas est une dette, pas une documentation (§118.116).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LA DIRECTION GÉNÉRALE DOIT-ELLE VALIDER CE MONTANT ?
 *
 * Trois lectures, et chacune porte sa raison :
 *
 * 1. **Aucun seuil réglé (null, 0, négatif) ⇒ aucune porte.** C'est la façon de DÉSARMER le
 *    contrôle, et elle doit être explicite : un seuil à 0 dit « plus aucune validation du DG »,
 *    pas « toutes les demandes passent par le DG ». L'écran le dit en ces termes.
 *
 * 2. **Montant INCONNU (null, 0, négatif) ⇒ la porte s'ouvre.** On ne franchit pas un contrôle
 *    sur une ABSENCE de donnée. L'erreur coûte une validation de trop, et elle se corrige d'un
 *    clic ; l'erreur inverse laisse sortir une dépense sans plafond connu, et elle ne se voit
 *    qu'après (§118.16 : une garde qui SUPPOSE une capacité absente coûte un refus honnête,
 *    une garde qui en PROMET une fait échouer la personne après le clic).
 *
 * 3. **« À partir de X » se lit STRICTEMENT au-dessus de X.** Une demande d'exactement 1 000 000
 *    DZD sous un seuil de 1 000 000 ne passe PAS par le DG. C'est la lecture que la Direction a
 *    validée au lot précédent, et elle est écrite ici pour ne pas être retranchée : au seuil
 *    exact, la demande est CONFORME à ce que la maison s'autorise sans arbitrage.
 */
export function porteDgRequise(
  montant: number | null | undefined,
  seuil: number | null | undefined,
): boolean {
  if (seuil == null || !(seuil > 0)) return false;
  if (montant == null || !(montant > 0)) return true;
  return montant > seuil;
}

/**
 * CE QUE LA PORTE COÛTE À UNE DEMANDE, DIT EN UNE PHRASE.
 *
 * Écrite ICI et pas dans chaque écran, pour la raison qui vaut partout dans ce dépôt : trois
 * écrans qui épellent la même réserve finissent par l'épeler de trois façons, et deux d'entre
 * elles seront fausses le jour où le seuil change de sens (§118.5, §104.17).
 *
 * Le montant INCONNU a sa propre phrase : dire « au-dessus de 1 000 000 DZD » sur une demande
 * sans montant serait faux, et c'est précisément le cas où la personne a besoin de comprendre
 * pourquoi son dossier s'est arrêté.
 */
export function motifPorteDg(
  montant: number | null | undefined,
  seuil: number | null | undefined,
): string | null {
  if (!porteDgRequise(montant, seuil)) return null;
  const s = (seuil as number).toLocaleString("fr-FR");
  if (montant == null || !(montant > 0)) {
    return `Montant non renseigné : la validation de la Direction Générale est requise par défaut (seuil : ${s} DZD). Renseignez le budget pour que la demande soit arbitrée sur son montant réel.`;
  }
  return `${montant.toLocaleString("fr-FR")} DZD : au-dessus du seuil de ${s} DZD, la validation de la Direction Générale est requise.`;
}
