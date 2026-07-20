/**
 * Expurgation : aucun secret, mot de passe, token, clé, cookie ni donnée sensible ne
 * doit apparaître dans les preuves / logs / rapports (§16-17). On masque par NOM de clé
 * et on tronque les valeurs très longues.
 */

const SENSITIVE_KEY = /pass(word)?|secret|token|api[-_]?key|authorization|cookie|vapid|hash|salt|nin|cnas|iban|rib|ssn/i;
const MAX_STR = 500;

export function redact<T>(value: T, depth = 0): T {
  if (depth > 6) return "[…]" as unknown as T;
  if (typeof value === "string") return (value.length > MAX_STR ? value.slice(0, MAX_STR) + "…" : value) as unknown as T;
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => redact(v, depth + 1)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}
