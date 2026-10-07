import { callLuna, lunaModel } from "@/lib/openai-luna";
import {
  postLinkedInDeSecours, postLinkedInValide, emploiticConfigure, RAISON_EMPLOITIC_NON_CONFIGURE,
  type ContenuPostLinkedIn,
} from "@/lib/recruitment/diffusion";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA DIFFUSION D'UNE OFFRE DE RECRUTEMENT — ce qui touche à un FOURNISSEUR (Direction, 07/10).
 *
 *   • LinkedIn : Luna (palier économique, schéma strict, ~20 s au plus) rédige un post propre SELON L'ENTITÉ ;
 *     `postLinkedInValide` le juge, sinon le post de secours part, écrit sans modèle. Rien n'est publié ici :
 *     aucune API LinkedIn n'est configurée — la personne publie elle-même, par le lien de partage.
 *   • Emploitic : le point d'extension. Tant que `EMPLOITIC_API_KEY` manque, il répond « non configuré » ;
 *     l'appel réel se branchera ici le jour où l'API sera décrite — aucun point d'entrée n'est inventé.
 *
 * Hors des domaines, à dessein (comme `demande-devis-depot.ts`) : un module de domaine qui importerait le
 * fournisseur ferait échouer `platform/domains.test.ts`. Les règles vivent, pures, dans `recruitment/diffusion.ts`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Au-delà, le post de secours part : on n'attend pas Luna plus longtemps qu'un clic patient. */
const DELAI_LUNA_MS = 20_000;

const SYSTEME = `Tu es chargée de communication RH d'un laboratoire pharmaceutique algérien. Tu rédiges un POST LINKEDIN d'offre d'emploi, au nom de la société indiquée ("societe").

RÈGLES IMPÉRATIVES
- Réponds UNIQUEMENT par l'objet JSON du schéma, en français, ton professionnel, chaleureux et sobre (secteur pharmaceutique en Algérie), vouvoiement des candidats.
- "texte" : 600 à 1 400 caractères. Une accroche d'une ligne qui nomme la société et l'intitulé EXACT du poste ; puis le contexte (département, lieu, type de contrat s'ils sont fournis) ; puis 3 à 5 puces "• " sur les missions clés et 3 à 5 sur le profil recherché, reformulées à partir des données fournies ; puis l'appel à candidater. Si "lien" est fourni, termine par "Pour postuler : " suivi du lien EXACT. Pas d'émojis en excès (deux au plus), pas de mots-dièse dans "texte".
- N'INVENTE JAMAIS : ni mission, ni exigence, ni avantage, ni date, ni lieu, ni chiffre, ni nom. Seulement ce que portent les données. Une donnée absente est simplement omise.
- Ne mentionne JAMAIS de salaire ni de rémunération, sauf s'ils figurent dans "avantages". Jamais de référence interne, jamais de circuit interne (validations, RH, Direction).
- "motsDiese" : 3 à 5 mots-dièse pertinents (le métier, le secteur pharmaceutique, l'Algérie, le recrutement), sans espace, chacun commençant par #.`;

const SCHEMA = {
  name: "post_linkedin_offre",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["texte", "motsDiese"],
    properties: {
      texte: { type: "string" },
      motsDiese: { type: "array", items: { type: "string" } },
    },
  },
};

/** RÉDIGER LE POST — Luna d'abord, le post de secours si elle se tait, tarde ou se trompe. Ne lève jamais. */
export async function redigerPostLinkedIn(c: ContenuPostLinkedIn): Promise<{ texte: string; parLuna: boolean }> {
  const secours = postLinkedInDeSecours(c);
  try {
    const r = await Promise.race([
      callLuna<unknown>({ system: SYSTEME, user: JSON.stringify(c), jsonSchema: SCHEMA, maxOutputTokens: 1200, model: lunaModel() }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), DELAI_LUNA_MS)),
    ]);
    if (!r || !r.ok) return { texte: secours, parLuna: false };
    let brut: unknown = r.data;
    if (brut === undefined) { try { brut = JSON.parse(r.text); } catch { brut = null; } }
    const texte = postLinkedInValide(brut, c);
    return texte ? { texte, parLuna: true } : { texte: secours, parLuna: false };
  } catch {
    return { texte: secours, parLuna: false };
  }
}

export type EnvoiEmploitic =
  | { ok: true; url: string | null }
  | { ok: false; nonConfigure: boolean; error: string };

/**
 * ENVOYER L'OFFRE À EMPLOITIC — le point d'extension. Sans clé : « non configuré ». Avec une clé, l'intégration
 * reste à écrire contre la documentation de l'API Emploitic : on le DIT plutôt que de prétendre avoir envoyé.
 */
export async function envoyerAEmploitic(
  _offre: { titre: string; texte: string; lien: string | null },
  env: Record<string, string | undefined> = process.env,
): Promise<EnvoiEmploitic> {
  if (!emploiticConfigure(env)) return { ok: false, nonConfigure: true, error: RAISON_EMPLOITIC_NON_CONFIGURE };
  return {
    ok: false, nonConfigure: false,
    error: "La clé Emploitic est posée, mais l'envoi n'est pas encore branché : l'intégration attend la documentation de l'API.",
  };
}
