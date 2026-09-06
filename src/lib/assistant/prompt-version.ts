/**
 * LA VERSION DU PROMPT SYSTÈME D'ADAM (mandat 4 §33) — pur, sans import.
 *
 * Chaque tour la porte dans son contexte de mesure (`TurnContext.promptVersion`, donc dans la ligne
 * `[adam] turn` et dans `AssistantResult.turn`). C'est ce qui permet de relier une régression de
 * qualité ou de latence à un TEXTE de consigne, et non à une date approximative.
 *
 * À incrémenter à CHAQUE changement du texte système (`systemPrompt`, consignes de calcul, de
 * signaux, d'enseignement, de surveillance) ou des descriptions d'outils qui pèsent sur le choix du
 * modèle. Le format est `AAAA-MM-JJ.n` : la date du changement, puis un compteur dans la journée.
 */
export const ADAM_PROMPT_VERSION = "2026-09-06.1";
