/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « IA NON CONFIGURÉE » — UNE SEULE PHRASE, ET LE BON NOM DE CLÉ (§118.128).
 *
 * ── LE DÉFAUT MESURÉ ─────────────────────────────────────────────────────────────────────
 *
 * HUIT écrans annonçaient « Ajoutez la clé ANTHROPIC_API_KEY » sur un déploiement qui tourne
 * chez OpenAI — le dépôt lit `OPENAI_API_KEY` 38 fois contre 14 pour l'autre, et c'est
 * `bindingFor(ROLE_QUALITE).provider` qui tranche. L'administrateur pose donc la variable que
 * l'écran nomme, RIEN ne change, et il en conclut que le produit est cassé. **Un refus qui
 * nomme un remède FAUX est pire qu'un refus qui n'en nomme aucun** (§118.121) : le second fait
 * chercher, le premier fait perdre confiance.
 *
 * Et le mécanisme qui l'empêche existait : `cleModeleRequise()` (`lib/ai.ts`) rend le nom lu
 * dans le registre, et son propre en-tête raconte l'histoire — « Trois écrans annonçaient
 * ANTHROPIC_API_KEY sur un déploiement OpenAI. Chacun avait recopié le nom. Le renvoyer d'ici
 * évite la quatrième recopie. » Il y en avait HUIT. §118.14 dans sa forme la plus nette : la
 * brique est écrite, juste, testée — et le chemin naturel passe à côté.
 *
 * ── POURQUOI CE MODULE EST AU SOCLE, SANS UN SEUL IMPORT ─────────────────────────────────
 *
 * Le NOM de la clé se lit dans le registre des modèles, donc côté SERVEUR. La PHRASE, elle,
 * s'affiche dans cinq composants `"use client"` — et un composant client qui importerait
 * `lib/ai.ts` tirerait la passerelle de modèles dans le navigateur, c'est-à-dire l'erreur
 * « Module not found: Can't resolve 'fs' » que ce dépôt a déjà payée deux fois. Les deux côtés
 * ont besoin de la même phrase et n'ont pas le droit de se parler : c'est exactement le
 * critère du socle (§118.72, §118.97). Le nom voyage donc en PROP ou dans la réponse d'une
 * route — comme `aiConfigured` le fait déjà —, et la phrase se compose ici.
 *
 * ── CE QU'IL NE FAIT PAS ─────────────────────────────────────────────────────────────────
 *
 * Il ne DEVINE aucun nom de clé : il reçoit celui que le registre a lu. Sans lui, il ne dirait
 * rien de faux — il dirait « la clé du fournisseur de raisonnement », qui est vrai et moins
 * utile, plutôt qu'un nom inventé qui serait faux et actionnable (§118.16).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Le geste EXACT qui lève le refus, quand on connaît le nom de la clé. */
export function phraseIaNonConfiguree(cle: string | null | undefined, pourQuoi: string): string {
  const nom = typeof cle === "string" && cle.trim().length > 0 ? cle.trim() : null;
  return nom
    ? `IA non configurée. Ajoutez la clé ${nom} dans Render (Settings → Environment) pour activer ${pourQuoi}.`
    // Le nom n'a pas traversé : on ne le fabrique pas. Dire « la clé du fournisseur » envoie au
    // bon endroit sans nommer une variable que personne ne trouvera (§118.26).
    : `IA non configurée : la clé du fournisseur de raisonnement est absente des variables d'environnement (Render → Settings → Environment). ${pourQuoi[0].toUpperCase()}${pourQuoi.slice(1)} restera indisponible tant qu'elle manque.`;
}

/** La même chose en une ligne courte — pour une infobulle ou un libellé désactivé. */
export function courtIaNonConfiguree(cle: string | null | undefined): string {
  const nom = typeof cle === "string" && cle.trim().length > 0 ? cle.trim() : null;
  return nom ? `IA non configurée (${nom} absente)` : "IA non configurée (clé du fournisseur de raisonnement absente)";
}
