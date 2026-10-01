import { askModelJson } from "@/lib/models/gateway";
import type { ModelReply } from "@/lib/models/contract";
import { aiFeatureEnabled, logAiUsage, type AiUsageInput } from "@/lib/ai-settings";
import { aiConfigured, cleModeleRequise } from "@/lib/ai";
import { phraseIaNonConfiguree } from "@/lib/ia/cle-manquante";
import {
  promptArticle, promptOffre, refusConsigne, relireArticle, relireOffre, SCHEMA_ARTICLE, SCHEMA_OFFRE,
  type ArticleRedige, type DisponibiliteRedaction, type EntreeArticle, type EntreeOffre, type OffreRedigee, type Relecture,
  type ResultatRedaction,
} from "@/lib/site-web/redaction";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « RÉDIGER AVEC L'IA » — l'appel au modèle (§118.160). Serveur uniquement.
 *
 * Les RÈGLES (consigne, forme imposée, relecture) sont dans `site-web/redaction.ts`, pur. Ce
 * fichier ne fait que les quatre gestes qui touchent le monde : lire la bascule du Centre de
 * contrôle IA, savoir si un fournisseur est configuré, appeler le modèle, journaliser l'usage.
 *
 * Il vit HORS du domaine `site-web/` exprès : un domaine ne parle pas directement aux
 * fournisseurs (`providerLeaks`, `domains.ts`) — comme l'analyse des rapports terrain, l'appel
 * passe par un module transverse, et c'est l'ACTION qui garde le droit (`peutEcrireArticles`,
 * `peutPublierOffres`). Il n'écrit RIEN en base hors du journal d'usage : le texte revient dans
 * le formulaire, et c'est une personne qui l'enregistre ou le publie.
 *
 * ── LES DÉPENDANCES S'INJECTENT ─────────────────────────────────────────────────────────────
 *
 * La bascule est une ligne GLOBALE (`AiSetting`) et la suite tourne en parallèle sur une seule
 * base : la poser pour de vrai dans un test ferait tomber les autres processus (§118.132). Le
 * défaut est le VRAI branchement ; un banc injecte le sien, et un cliquet exige que l'action
 * appelle ces fonctions SANS rien injecter (§118.49).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface DependancesRedaction {
  fonctionActive: () => Promise<boolean>;
  configure: () => boolean;
  cle: () => string | null;
  appeler: <T>(role: "worker", prompt: string, schema: { name: string; schema: Record<string, unknown> }, opts: { system: string; maxOutputTokens: number; verbosity: "medium" }) => Promise<{ data: T | null; reply: ModelReply }>;
  journaliser: (u: AiUsageInput) => Promise<void>;
}

const REELLES: DependancesRedaction = {
  fonctionActive: () => aiFeatureEnabled("site_web"),
  configure: aiConfigured,
  cle: cleModeleRequise,
  appeler: (role, prompt, schema, opts) => askModelJson(role, prompt, schema, opts),
  journaliser: logAiUsage,
};

export type { ResultatRedaction };

/** Ce que la fonction rendra si on la demande — pour que l'écran n'offre pas un bouton qui refusera. */
export async function disponibiliteRedaction(deps: DependancesRedaction = REELLES): Promise<DisponibiliteRedaction> {
  if (!(await deps.fonctionActive())) {
    return { disponible: false, raison: "La rédaction par l'IA est coupée dans le Centre de contrôle IA (Administration › Centre de contrôle IA)." };
  }
  if (!deps.configure()) return { disponible: false, raison: phraseIaNonConfiguree(deps.cle(), "la rédaction par l'IA") };
  return { disponible: true, raison: null };
}

/**
 * LE CHEMIN COMMUN : consigne valable → bascule → fournisseur → appel → journal → relecture.
 * L'ordre compte : rien ne part chez le fournisseur tant qu'une porte de NOTRE côté peut refuser.
 */
async function rediger<T>(
  userId: string,
  consigne: string,
  composer: () => { system: string; prompt: string },
  schema: { name: string; schema: Record<string, unknown> },
  relire: (brut: unknown) => Relecture<T>,
  deps: DependancesRedaction,
): Promise<ResultatRedaction<T>> {
  const refus = refusConsigne(consigne);
  if (refus) return { ok: false, error: refus };
  const dispo = await disponibiliteRedaction(deps);
  if (!dispo.disponible) return { ok: false, error: dispo.raison ?? "Rédaction par l'IA indisponible." };

  const { system, prompt } = composer();
  const t0 = Date.now();
  let resultat: { data: unknown; reply: ModelReply } | null = null;
  let panne: string | null = null;
  try {
    resultat = await deps.appeler<unknown>("worker", prompt, schema, { system, maxOutputTokens: 6_000, verbosity: "medium" });
  } catch (e) {
    panne = e instanceof Error ? e.message : String(e);
  }
  const reply = resultat?.reply ?? null;
  const usage = reply?.usage;
  // La relecture AVANT le journal : un appel qui a répondu mais dont la réponse ne remplit pas le
  // formulaire n'est pas un succès de la FONCTION. Le compter « ok » ferait mentir le taux de
  // réussite du Centre de contrôle IA par son numérateur (§118.51).
  const relu = reply?.ok && resultat?.data != null ? relire(resultat.data) : null;
  await deps.journaliser({
    feature: "site_web",
    // Sans réponse (exception), le fournisseur reste celui que la clé désigne — le défaut du
    // journal écrirait « anthropic » sur un déploiement OpenAI.
    provider: usage?.provider ?? (deps.cle() === "ANTHROPIC_API_KEY" ? "anthropic" : "openai"),
    model: usage?.model ?? null,
    userId,
    ok: relu?.ok === true,
    latencyMs: Date.now() - t0,
    errorCode: panne
      ? "exception"
      : !reply?.ok ? (reply?.error ?? "error")
      : resultat?.data == null ? "invalid_json"
      : relu && !relu.ok ? "relecture"
      : null,
    llmCalls: 1,
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    cachedInputTokens: usage?.cachedInputTokens ?? null,
    reasoningTokens: usage?.reasoningTokens ?? null,
    costUsd: usage?.costUsd ?? null,
  });

  if (panne) return { ok: false, error: "Le service d'IA n'a pas répondu. Réessayez dans un instant — rien n'a été modifié." };
  if (!reply || !reply.ok) {
    if (reply && !reply.configured) return { ok: false, error: phraseIaNonConfiguree(deps.cle(), "la rédaction par l'IA") };
    return { ok: false, error: "Le service d'IA a refusé la demande. Réessayez, ou reformulez la consigne — rien n'a été modifié." };
  }
  const lu = relu ?? relire(resultat?.data);
  if (!lu.ok) return { ok: false, error: lu.raison };
  return { ok: true, champs: lu.champs, avertissements: lu.avertissements };
}

export function redigerArticle(userId: string, e: EntreeArticle, deps: DependancesRedaction = REELLES): Promise<ResultatRedaction<ArticleRedige>> {
  return rediger(userId, e.consigne, () => promptArticle(e), SCHEMA_ARTICLE, relireArticle, deps);
}

export function redigerOffre(userId: string, e: EntreeOffre, deps: DependancesRedaction = REELLES): Promise<ResultatRedaction<OffreRedigee>> {
  return rediger(userId, e.consigne, () => promptOffre(e), SCHEMA_OFFRE, relireOffre, deps);
}
