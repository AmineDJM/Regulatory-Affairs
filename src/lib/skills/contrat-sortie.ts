/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE CAPACITÉ TIENT SON CONTRAT — module PUR, sans un seul import.
 *
 * ── LA QUESTION QUI A FAIT ÉCRIRE CE FICHIER ────────────────────────────────────────────
 *
 * §118.20 recensait onze capacités dont la FORME de sortie changeait selon ce qu'elles
 * trouvaient. Elles ont été réparées une à une — et c'est là que la bonne objection tombe :
 * réparer quinze capacités à la main ne protège pas la seizième, et ne protège SURTOUT PAS une
 * capacité qu'Adam crée lui-même (§36 : micro-outil promu, connecteur déclaré par manifeste,
 * playbook enseigné). Le cœur n'a pas à être modifié pour qu'un skill existe ; il n'a donc
 * aucun endroit où l'on pourrait aller « corriger » sa forme.
 *
 * Ce qu'un skill DÉCLARE, en revanche, le code peut le vérifier : `sorties.cles` existe dans le
 * manifeste depuis le début, il est lu pour décrire l'outil au modèle… et personne ne le
 * confrontait à ce que l'exécution rendait vraiment. Une capacité pouvait donc annoncer
 * `{ montant, devise }` et livrer `{ erreur }` — exactement le défaut de §118.20, mais du côté
 * où l'on ne peut pas éditer le code fautif.
 *
 * ── CE QU'IL FAIT, ET CE QU'IL NE FAIT SURTOUT PAS ──────────────────────────────────────
 *
 * Il CONSTATE, il ne répare pas. Ajouter les clés manquantes avec des `null` fabriquerait une
 * sortie que la capacité n'a jamais produite : le plan croirait tenir une valeur, et le faux
 * succès serait pire que l'écart. Il ne refuse pas non plus l'appel — une capacité qui rend
 * quelque chose d'utile sous un nom inattendu vaut mieux que rien (§118.27 : un refus à tort
 * coûte plus cher que le défaut qu'on corrige).
 *
 * Il DIT, à l'endroit exact, ce qui manque : le modèle le lit, le journal le garde, et l'écart
 * devient une dette nommée au lieu d'une étape morte trois semaines plus tard.
 *
 * ── POURQUOI IL SE TAIT SI SOUVENT ──────────────────────────────────────────────────────
 *
 * Rien de déclaré → rien à vérifier ; sortie qui n'est pas un objet → on ne sait pas lire, et
 * une garde qui refuse ce qu'elle ne comprend pas est désactivée dans la semaine (§118.16) ; un
 * échec annoncé (`ok: false`) n'a pas à porter les clés du succès — c'est le contrat du cas
 * PLEIN qu'on vérifie, pas celui du refus.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface EcartDeContrat {
  /** Les clés annoncées par le manifeste et absentes du résultat. */
  manquantes: string[];
  /** La phrase à joindre à la sortie — jamais `null` quand `manquantes` n'est pas vide. */
  phrase: string;
}

/**
 * L'ÉCART entre ce qu'une capacité ANNONCE et ce qu'elle REND. `null` quand il n'y a rien à
 * dire — le cas de très loin le plus fréquent, et c'est voulu.
 */
export function ecartDeContrat(args: {
  outil: string;
  /** `sorties.cles` du manifeste. Vide ou absent : la capacité n'a rien promis. */
  clesDeclarees?: readonly string[];
  /** Le résultat réel de l'exécution. */
  resultat: unknown;
  /** L'exécution s'est-elle déclarée en succès ? Un échec ne doit pas les clés du succès. */
  ok: boolean;
}): EcartDeContrat | null {
  if (!args.ok) return null;
  const declarees = (args.clesDeclarees ?? []).map((c) => c.trim()).filter(Boolean);
  if (declarees.length === 0) return null;
  const r = args.resultat;
  if (typeof r !== "object" || r === null || Array.isArray(r)) return null;
  const presentes = new Set(Object.keys(r as Record<string, unknown>));
  const manquantes = declarees.filter((c) => !presentes.has(c));
  if (manquantes.length === 0) return null;
  return {
    manquantes,
    phrase: `⚠️ CONTRAT NON TENU par « ${args.outil} » : il annonce ${declarees.map((c) => `« ${c} »`).join(", ")} `
      + `et n'a pas rendu ${manquantes.map((c) => `« ${c} »`).join(", ")}. Ne PAS référencer ces clés — `
      + "elles n'existent pas dans ce résultat. Ce qui est là est là ; rien n'a été comblé.",
  };
}
