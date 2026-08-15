/**
 * ERREURS DE L'API — une enveloppe unique, lisible par un agent.
 *
 * Un agent ne lit pas un message pour le comprendre, il l'utilise pour DÉCIDER : réessayer,
 * demander une portée, corriger son appel, ou renoncer. Chaque erreur porte donc un `code`
 * stable, un message en français, et — quand c'est utile — ce qu'il faut faire pour la lever
 * (`hint`, `requiredScopes`, `fields`).
 *
 * Module PUR — testé.
 */

export const API_ERROR_CODES = {
  UNAUTHENTICATED: 401,
  INVALID_KEY: 401,
  KEY_EXPIRED: 401,
  CLIENT_DISABLED: 403,
  MISSING_SCOPE: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  IDEMPOTENCY_MISMATCH: 409,
  VERSION_CONFLICT: 409,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_CODES;

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Ce qu'il faut faire pour lever l'erreur — pas seulement ce qui s'est passé. */
    hint?: string;
    requiredScopes?: string[];
    fields?: Record<string, string>;
    correlationId?: string;
  };
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly hint?: string;
  readonly requiredScopes?: string[];
  readonly fields?: Record<string, string>;

  constructor(code: ApiErrorCode, message: string, extra: { hint?: string; requiredScopes?: string[]; fields?: Record<string, string> } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = API_ERROR_CODES[code];
    this.hint = extra.hint;
    this.requiredScopes = extra.requiredScopes;
    this.fields = extra.fields;
  }

  body(correlationId?: string): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.hint ? { hint: this.hint } : {}),
        ...(this.requiredScopes ? { requiredScopes: this.requiredScopes } : {}),
        ...(this.fields ? { fields: this.fields } : {}),
        ...(correlationId ? { correlationId } : {}),
      },
    };
  }
}

/** Raccourcis des refus les plus fréquents, pour que le message reste le même partout. */
export const errors = {
  unauthenticated: (): ApiError =>
    new ApiError("UNAUTHENTICATED", "Clé d'API absente.", {
      hint: "Envoyez l'en-tête « Authorization: Bearer <clé> ».",
    }),
  invalidKey: (): ApiError =>
    new ApiError("INVALID_KEY", "Clé d'API inconnue ou révoquée.", {
      hint: "Vérifiez la clé, ou faites-en émettre une nouvelle en Administration → API.",
    }),
  expired: (): ApiError => new ApiError("KEY_EXPIRED", "Cette clé d'API a expiré."),
  disabled: (): ApiError => new ApiError("CLIENT_DISABLED", "Ce client d'API est désactivé."),
  missingScope: (required: string[], granted: readonly string[]): ApiError =>
    new ApiError("MISSING_SCOPE", `Portée insuffisante : il manque « ${required.filter((r) => !granted.includes(r)).join(", ")} ».`, {
      requiredScopes: required,
      hint: "Les portées s'accordent client par client : demandez l'ajout de la portée manquante.",
    }),
  forbidden: (message = "L'utilisateur au nom duquel vous agissez n'a pas ce droit."): ApiError =>
    new ApiError("FORBIDDEN", message, {
      hint: "La portée de l'API ne remplace pas les droits de la personne : les deux doivent autoriser l'appel.",
    }),
  notFound: (what = "Objet"): ApiError =>
    new ApiError("NOT_FOUND", `${what} introuvable — ou hors de votre portée.`, {
      hint: "Un objet que l'utilisateur n'a pas le droit de voir répond « introuvable » : la réponse ne révèle pas son existence.",
    }),
  validation: (message: string, fields?: Record<string, string>): ApiError =>
    new ApiError("VALIDATION_FAILED", message, { fields }),
  idempotencyMismatch: (): ApiError =>
    new ApiError("IDEMPOTENCY_MISMATCH", "Cette clé d'idempotence a déjà servi avec un contenu différent.", {
      hint: "Réutilisez la même clé pour rejouer EXACTEMENT la même requête, sinon changez de clé.",
    }),
  versionConflict: (): ApiError =>
    new ApiError("VERSION_CONFLICT", "L'objet a changé depuis votre lecture.", {
      hint: "Relisez l'objet, reportez votre modification sur la version à jour, puis renvoyez.",
    }),
  internal: (): ApiError => new ApiError("INTERNAL", "Erreur interne."),
};

/** Un refus du métier (ActionResult non-ok) devient une erreur d'API lisible telle quelle. */
export function fromActionResult(result: { ok: boolean; error?: string }): ApiError {
  const message = result.error ?? "Action refusée.";
  // Les refus de droits de l'ERP se distinguent d'une donnée invalide : l'agent n'y répond pas
  // de la même façon (demander une permission ≠ corriger son appel).
  const denied = /non autorisé|réservé|pas le droit|autorisation|seule?s? /i.test(message);
  return new ApiError(denied ? "FORBIDDEN" : "VALIDATION_FAILED", message);
}
