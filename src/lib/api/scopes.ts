/**
 * PORTÉES DE L'API (« scopes ») — ce que l'INTÉGRATION a le droit de faire.
 *
 * À ne pas confondre avec les droits RBAC de l'ERP, qui disent ce qu'une PERSONNE voit. Les
 * deux se cumulent : un agent ne peut jamais dépasser ni la portée qu'on lui a donnée, ni les
 * droits de l'utilisateur au nom duquel il agit. C'est ce qui permet d'ouvrir tout l'ERP en
 * lecture à un assistant sans lui donner le moindre droit d'écriture, puis d'élargir plus tard
 * sans toucher aux comptes humains.
 *
 * Module PUR — testé.
 */

export const SCOPES = [
  "erp.read",
  "erp.search",
  "erp.write",
  "erp.documents.read",
  "erp.documents.write",
  "erp.workflow.execute",
  "erp.approve",
  "erp.admin",
] as const;

export type Scope = (typeof SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<Scope, string> = {
  "erp.read": "Lire les objets, leurs relations, leur historique et leurs workflows. Aucune écriture.",
  "erp.search": "Interroger la recherche globale et les listes filtrées.",
  "erp.write": "Créer et modifier des objets métier (hors validation et administration).",
  "erp.documents.read": "Lister les pièces jointes et télécharger leur contenu.",
  "erp.documents.write": "Téléverser une pièce jointe et la rattacher à un objet.",
  "erp.workflow.execute": "Faire avancer un circuit : soumettre, transmettre, exécuter une étape.",
  "erp.approve": "Décider une validation (approuver / refuser). Séparé de `erp.write` à dessein.",
  "erp.admin": "Administration : comptes, droits, réglages, purge. À n'accorder qu'exceptionnellement.",
};

/**
 * Profil LECTURE SEULE — voir toute l'entreprise, ne rien pouvoir changer.
 *
 * C'est le profil par défaut recommandé pour un assistant : il donne une vision globale sans
 * qu'une erreur de raisonnement puisse modifier quoi que ce soit.
 */
export const READ_ONLY_SCOPES: Scope[] = ["erp.read", "erp.search", "erp.documents.read"];

/** Portées qui autorisent une écriture — celles dont l'octroi mérite une décision explicite. */
export const WRITE_SCOPES: Scope[] = ["erp.write", "erp.documents.write", "erp.workflow.execute", "erp.approve", "erp.admin"];

export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}

/** Ne garde que les portées connues : une portée inventée ne doit jamais ouvrir quoi que ce soit. */
export function normalizeScopes(raw: unknown): Scope[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map(String).filter(isScope)));
}

/**
 * La portée demandée est-elle accordée ?
 *
 * `erp.admin` n'est PAS un joker : un agent d'administration n'obtient pas silencieusement le
 * droit d'approuver des validations métier. Chaque portée s'accorde pour ce qu'elle est.
 */
export function hasScope(granted: readonly string[], required: Scope): boolean {
  return granted.includes(required);
}

/** Toutes les portées requises par une opération sont-elles présentes ? */
export function hasAllScopes(granted: readonly string[], required: readonly Scope[]): boolean {
  return required.every((s) => hasScope(granted, s));
}

/** Ce client peut-il écrire quoi que ce soit ? Sert à afficher « lecture seule » sans ambiguïté. */
export function isReadOnly(granted: readonly string[]): boolean {
  return !WRITE_SCOPES.some((s) => granted.includes(s));
}
