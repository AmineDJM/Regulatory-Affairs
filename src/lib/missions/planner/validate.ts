/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA VÉRIFICATION DU SCHÉMA — parce qu'« imposé au fournisseur » n'est pas « garanti ».
 *
 * ── POURQUOI CE FICHIER EXISTE ALORS QUE LE MODE STRICT EXISTE ──────────────────────────
 *
 * Les sorties structurées strictes garantissent la conformité… quand elles sont réellement
 * actives. Ce dépôt a déjà vu deux fois un paramètre partir sans effet et être découvert par
 * une erreur en production — un `reasoning_effort` sur la mauvaise porte, un `temperature`
 * refusé par le modèle. La leçon retenue et écrite dans `gateway.ts` était : poser la question
 * ICI plutôt que de la laisser poser par le fournisseur, après.
 *
 * Le même raisonnement s'applique à la conformité. Un jour où le mode strict serait désactivé,
 * dégradé, ou non pris en charge par un modèle de repli, le runtime recevrait un objet
 * PLAUSIBLE auquel il manquerait un champ. Le compilateur le refuserait peut-être — ou pire,
 * l'accepterait avec un champ à `undefined`, et la faute se manifesterait trois étapes plus loin.
 *
 * ── CE QU'IL VÉRIFIE, ET RIEN D'AUTRE ───────────────────────────────────────────────────
 *
 * Le sous-ensemble de JSON Schema que le mode strict autorise : type, enum, required,
 * additionalProperties: false, items, `anyOf`, et les types nullables écrits `["string","null"]`.
 * Il ne gère ni `$ref`, ni `oneOf`, ni les bornes numériques — parce que le mode strict ne les
 * autorise pas non plus, et prétendre les gérer inviterait à écrire des schémas qui ne
 * passeraient pas chez le fournisseur.
 *
 * ── `anyOf` A ÉTÉ AJOUTÉ, ET LA DISTINCTION AVEC `oneOf` EST LOAD-BEARING ────────────────
 *
 * Le sous-ensemble strict admet `anyOf` (imbriqué, jamais à la racine) et refuse `oneOf`. Les
 * deux se ressemblent assez pour qu'on les confonde, et se confondre ici produirait exactement
 * ce que l'en-tête ci-dessus interdit : un schéma qui passe nos tests et que le fournisseur
 * rejette. `anyOf` est donc géré ; `oneOf` reste absent, volontairement.
 *
 * ── COMMENT UNE VARIANTE EST CHOISIE, ET POURQUOI CE N'EST PAS « LA PREMIÈRE QUI PASSE » ──
 *
 * On retient la variante qui produit le MOINS d'écarts. Sur des variantes discriminées par un
 * `const` (`nodeType`), cela revient à choisir la bonne : les autres échouent d'emblée sur le
 * discriminant. Mais quand AUCUNE ne passe, ce choix change tout pour le lecteur — il reçoit
 * les écarts de la variante la plus proche (« il manque `capability` ») au lieu du cumul de
 * toutes (« il manque capability, waitEvent, waitAsk, outputFields… »), qui ne désigne rien.
 *
 * ── LE SECOND USAGE, ET IL COMPTE AUTANT ────────────────────────────────────────────────
 *
 * Un test qui fait rendre à un faux raisonneur un objet écrit à la main teste ce que le
 * développeur a imaginé, pas ce qu'un fournisseur peut produire. En faisant passer le même
 * objet par cette vérification, le test prouve que sa réponse EST une réponse possible — ce qui
 * transforme un décor en banc d'essai.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface EcartSchema {
  /** Le chemin dans l'objet, en notation pointée. Vide pour la racine. */
  chemin: string;
  probleme: string;
}

const typeDe = (v: unknown): string => {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v as number)) return "integer";
  return typeof v;
};

const accepte = (attendu: string, reel: string): boolean =>
  attendu === reel
  || (attendu === "number" && reel === "integer")
  // `typeof 4 === "number"` : un entier satisfait aussi bien « number » qu'« integer ».
  || (attendu === "integer" && reel === "integer");

/**
 * VÉRIFIE UNE VALEUR CONTRE UN SCHÉMA STRICT.
 *
 * Rend la liste des écarts — vide quand tout va bien. Une LISTE plutôt qu'un booléen : quand un
 * plan de trois cents étapes est refusé, « non conforme » ne dit pas quoi corriger, alors que
 * « steps.12.capability : attendu string|null, reçu number » le dit exactement.
 */
export function verifierSchema(valeur: unknown, schema: Record<string, unknown>, chemin = ""): EcartSchema[] {
  const ecarts: EcartSchema[] = [];
  const ici = (probleme: string) => ecarts.push({ chemin, probleme });

  // ── LES VARIANTES : on retient la PLUS PROCHE, pas la première ────────────────────
  if (Array.isArray(schema.anyOf)) {
    const variantes = schema.anyOf as Record<string, unknown>[];
    if (variantes.length === 0) return [{ chemin, probleme: "anyOf vide" }];
    let meilleure = verifierSchema(valeur, variantes[0], chemin);
    for (const v of variantes.slice(1)) {
      if (meilleure.length === 0) break;
      const essai = verifierSchema(valeur, v, chemin);
      if (essai.length < meilleure.length) meilleure = essai;
    }
    return meilleure;
  }

  const attendus = Array.isArray(schema.type)
    ? (schema.type as string[])
    : typeof schema.type === "string"
      ? [schema.type]
      : [];

  const reel = typeDe(valeur);
  if (attendus.length > 0 && !attendus.some((t) => accepte(t, reel))) {
    ici(`attendu ${attendus.join("|")}, reçu ${reel}`);
    // On s'arrête là pour cette branche : descendre dans un objet qui n'en est pas un
    // produirait une avalanche d'écarts dérivés qui masquerait la cause.
    return ecarts;
  }

  if (Array.isArray(schema.enum) && !(schema.enum as unknown[]).includes(valeur)) {
    ici(`« ${String(valeur)} » hors des valeurs permises (${(schema.enum as unknown[]).join(", ")})`);
  }

  if (reel === "object" && schema.properties) {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    const obj = valeur as Record<string, unknown>;
    const requis = Array.isArray(schema.required) ? (schema.required as string[]) : [];

    for (const r of requis) {
      if (!Object.prototype.hasOwnProperty.call(obj, r)) {
        ici(`champ obligatoire absent : « ${r} »`);
      }
    }

    // LE MODE STRICT INTERDIT LES CHAMPS EN TROP, et c'est une vraie protection : un champ
    // inattendu signale presque toujours que le modèle a inventé une structure — donc que la
    // suite du traitement lira autre chose que ce qu'elle croit lire.
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(obj)) {
        if (!props[k]) ici(`champ inattendu : « ${k} »`);
      }
    }

    for (const [k, sousSchema] of Object.entries(props)) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      ecarts.push(...verifierSchema(obj[k], sousSchema, chemin ? `${chemin}.${k}` : k));
    }
  }

  if (reel === "array" && schema.items) {
    const items = schema.items as Record<string, unknown>;
    (valeur as unknown[]).forEach((v, i) => {
      ecarts.push(...verifierSchema(v, items, `${chemin}[${i}]`));
    });
  }

  return ecarts;
}

/** Un message court, prêt à remonter dans une erreur. Les cinq premiers écarts suffisent. */
export function resumerEcarts(ecarts: readonly EcartSchema[]): string {
  return ecarts
    .slice(0, 5)
    .map((e) => `${e.chemin || "(racine)"} : ${e.probleme}`)
    .join(" ; ")
    + (ecarts.length > 5 ? ` (+${ecarts.length - 5} autres)` : "");
}
