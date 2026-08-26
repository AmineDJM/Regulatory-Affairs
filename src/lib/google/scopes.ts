/**
 * LES DROITS GOOGLE, COMPARÉS POUR CE QU'ILS SONT — et non pour comment ils sont écrits.
 *
 * LE BOGUE QUE CE MODULE EXISTE POUR FERMER. On demande à Google les droits d'identité sous
 * leurs noms courts — `openid email profile` — parce que c'est la forme prescrite par OpenID
 * Connect et celle que la console Google affiche. Google, lui, RÉPOND avec les URI canoniques :
 *
 *     openid https://www.googleapis.com/auth/userinfo.email
 *            https://www.googleapis.com/auth/userinfo.profile …
 *
 * Une comparaison de chaînes (`GOOGLE_SCOPES.filter((s) => !granted.includes(s))`) ne retrouve
 * donc JAMAIS « email » ni « profile » dans ce que Google a réellement accordé. L'écran annonçait
 * deux droits manquants, éternellement, quel que soit le nombre de reconnexions — et la
 * reconnexion ne pouvait rien y faire, puisque le droit était accordé depuis le début.
 *
 * Le remède n'est pas de retirer l'alerte : c'est de comparer des DROITS, pas des libellés.
 *
 * DEUX RELATIONS, et elles sont distinctes :
 *   1. l'ÉQUIVALENCE — deux écritures du même droit (`email` ≡ `…/userinfo.email`) ;
 *   2. l'INCLUSION — un droit accordé plus large en couvre un plus étroit
 *      (`https://mail.google.com/` couvre `gmail.modify`). Sans elle, un consentement PLUS
 *      généreux que demandé serait signalé comme incomplet, ce qui est exactement faux.
 *
 * Module PUR : aucune base, aucun réseau. Il se mesure sur des chaînes fixes.
 */

/** Retire ce qui ne porte aucun sens : espaces, casse d'hôte, barre oblique finale. */
function tidy(scope: string): string {
  return scope.trim().replace(/\/+$/, "");
}

/**
 * Les ÉQUIVALENCES d'écriture. Chaque clé et sa valeur désignent le même droit ; la valeur est
 * la forme retenue comme canonique.
 *
 * `openid` n'a pas d'URI : Google le rend tel quel. Il figure ici pour que la table se lise
 * comme la liste complète des droits d'identité, sans exception tacite.
 */
const ALIASES: Record<string, string> = {
  openid: "openid",
  email: "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.email": "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/plus.me": "https://www.googleapis.com/auth/userinfo.profile",
  profile: "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.profile": "https://www.googleapis.com/auth/userinfo.profile",
};

/**
 * Les INCLUSIONS : `couvert` ← [ceux qui le couvrent].
 *
 * Ces droits ne sont PAS demandés par Adam (voir `GOOGLE_SCOPES` : le moindre privilège reste la
 * règle). Ils sont ici parce qu'un compte peut les avoir accordés autrement — un consentement
 * plus ancien, une autre application du même projet, un administrateur de domaine — et qu'un
 * droit plus large ne doit pas se lire comme un droit manquant.
 */
const COVERED_BY: Record<string, readonly string[]> = {
  "https://www.googleapis.com/auth/gmail.modify": ["https://mail.google.com"],
  "https://www.googleapis.com/auth/gmail.readonly": [
    "https://mail.google.com",
    "https://www.googleapis.com/auth/gmail.modify",
  ],
  "https://www.googleapis.com/auth/gmail.send": [
    "https://mail.google.com",
    "https://www.googleapis.com/auth/gmail.modify",
  ],
  "https://www.googleapis.com/auth/drive.file": ["https://www.googleapis.com/auth/drive"],
  "https://www.googleapis.com/auth/drive.readonly": ["https://www.googleapis.com/auth/drive"],
  "https://www.googleapis.com/auth/calendar.events": ["https://www.googleapis.com/auth/calendar"],
  "https://www.googleapis.com/auth/calendar.readonly": ["https://www.googleapis.com/auth/calendar"],
  "https://www.googleapis.com/auth/contacts.readonly": ["https://www.googleapis.com/auth/contacts"],
};

/** La forme CANONIQUE d'un droit : celle sous laquelle on le compare. */
export function canonicalScope(scope: string): string {
  const t = tidy(scope);
  return ALIASES[t] ?? ALIASES[t.toLowerCase()] ?? t;
}

/**
 * Découpe et canonise ce que Google a rendu — `"a b  c"` ou déjà un tableau.
 *
 * Le champ `scope` d'une réponse de jeton est une chaîne séparée par des espaces ; certains
 * enregistrements anciens portent une virgule. Les deux se lisent ici, sans que l'appelant ait
 * à savoir lequel il tient.
 */
export function normalizeScopes(raw: string | readonly string[] | null | undefined): string[] {
  if (!raw) return [];
  const parts = Array.isArray(raw) ? raw : String(raw).split(/[\s,]+/);
  const out = new Set<string>();
  for (const p of parts) {
    const c = canonicalScope(p);
    if (c) out.add(c);
  }
  return [...out];
}

/**
 * Le droit demandé est-il SATISFAIT par ce qui a été accordé ?
 *
 * Deux façons de l'être : la même écriture canonique, ou un droit accordé qui l'englobe.
 */
export function isScopeSatisfied(requested: string, grantedCanonical: ReadonlySet<string>): boolean {
  const want = canonicalScope(requested);
  if (grantedCanonical.has(want)) return true;
  return (COVERED_BY[want] ?? []).some((wider) => grantedCanonical.has(canonicalScope(wider)));
}

/**
 * LES DROITS RÉELLEMENT MANQUANTS, rendus SOUS LA FORME DEMANDÉE.
 *
 * On rend `email`, pas `https://www.googleapis.com/auth/userinfo.email` : l'écran doit nommer le
 * droit tel qu'il sera redemandé, sinon la personne cherche dans la console Google une ligne qui
 * ne s'y appelle pas ainsi.
 */
export function computeMissingScopes(
  requested: readonly string[],
  granted: string | readonly string[] | null | undefined,
): string[] {
  const have = new Set(normalizeScopes(granted));
  return requested.filter((r) => !isScopeSatisfied(r, have));
}

/**
 * L'UNION des droits, pour une RECONNEXION INCRÉMENTALE.
 *
 * Google renvoie normalement l'ensemble cumulé quand la demande porte `include_granted_scopes`,
 * mais ce n'est pas une garantie du protocole : un consentement partiel, ou un échange de jeton
 * qui ne mentionne que le sous-ensemble demandé, ferait alors OUBLIER des droits pourtant
 * toujours accordés — et l'écran réclamerait de reconnecter pour un droit que le compte possède.
 * On ne perd donc jamais un droit connu : on ajoute.
 */
export function mergeGrantedScopes(
  previous: string | readonly string[] | null | undefined,
  incoming: string | readonly string[] | null | undefined,
): string {
  const union = new Set([...normalizeScopes(previous), ...normalizeScopes(incoming)]);
  return [...union].sort().join(" ");
}
