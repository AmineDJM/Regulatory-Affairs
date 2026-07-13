/**
 * Extraction TOLÉRANTE d'un objet JSON depuis une réponse IA. Utilisée par les agents, la revue
 * fond/forme et le simulateur d'examen. Gère :
 *   1. les blocs ```json … ``` et le texte/préambule autour ;
 *   2. les réponses TRONQUÉES (plafond de jetons atteint) — cause n°1 des « Réponse IA non
 *      exploitable » : on referme les chaînes et structures restées ouvertes pour récupérer ce
 *      qui a été produit (les schémas Zod en aval tolèrent les tableaux plus courts).
 * Renvoie l'objet parsé, ou `null` si vraiment irrécupérable.
 */
export function extractLooseJson(text: string): unknown | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  if (start === -1) return null;
  const raw = body.slice(start);

  // 1) Essai direct sur la tranche { … dernier « } ».
  const lastClose = raw.lastIndexOf("}");
  if (lastClose > 0) {
    try {
      return JSON.parse(raw.slice(0, lastClose + 1));
    } catch {
      /* réponse probablement tronquée → réparation ci-dessous */
    }
  }
  return repairAndParse(raw);
}

/** Referme chaînes et structures ouvertes d'un JSON tronqué, puis tente de parser. */
function repairAndParse(raw: string): unknown | null {
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; out += ch; continue; }
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") { if (stack[stack.length - 1] === ch) stack.pop(); }
    out += ch;
  }
  if (inStr) out += '"'; // chaîne tronquée → refermée

  // On rogne les fragments pendants de fin (élément incomplet), on referme, on retente ;
  // plusieurs passes couvrent les points de troncature usuels (dans une valeur, après une
  // virgule, après un « "clé": »).
  const closers = [...stack].reverse().join("");
  const trims = [
    (s: string) => s,
    (s: string) => s.replace(/,\s*$/, ""),                    // virgule pendante
    (s: string) => s.replace(/,?\s*"[^"]*"\s*:\s*$/, ""),      // « ,"clé": » sans valeur
    (s: string) => s.replace(/,?\s*"[^"]*"\s*:\s*"?[^"{}\[\]]*$/, ""), // valeur scalaire partielle
  ];
  for (const trim of trims) {
    const candidate = trim(out) + closers;
    try {
      return JSON.parse(candidate);
    } catch {
      /* passe suivante */
    }
  }
  return null;
}
