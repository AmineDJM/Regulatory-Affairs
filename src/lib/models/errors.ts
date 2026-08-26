/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UN FOURNISSEUR RÉPOND QUAND ÇA SE PASSE MAL — et comment ne pas tomber pour si peu.
 *
 * Ces deux fonctions viennent de `openai-luna.ts`, où elles ont été écrites en réponse à des
 * pannes RÉELLES. Elles remontent ici parce que c'est leur vraie place : ce n'est pas une
 * connaissance du module CTD, c'est une connaissance du FOURNISSEUR — donc de la couche qui lui
 * parle. `openai-luna.ts` les réexporte, ses appelants et ses tests ne bougent pas.
 *
 * Les laisser en bas et les importer depuis la passerelle aurait fait dépendre l'infrastructure
 * modèle d'un module métier — l'inverse du sens de lecture, et une dépendance qu'on aurait fini
 * par contourner en dupliquant.
 *
 * Module PUR, sans aucun import : c'est ce qui permet de le tester sans réseau, et c'est la
 * propriété qui rend `src/lib/models/` emportable tel quel.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Le refus porte-t-il sur `temperature` ? (message d'erreur du fournisseur, formulations variées)
 *
 * Les modèles de RAISONNEMENT refusent ce paramètre. Sans cette détection, un rôle entier tombe
 * en panne à cause d'un réglage optionnel — alors qu'il suffit de le retirer et de rejouer.
 */
export function mentionsUnsupportedTemperature(body: string): boolean {
  const b = body.toLowerCase();
  if (!b.includes("temperature")) return false;
  return b.includes("unsupported") || b.includes("not supported") || b.includes("unrecognized")
    || b.includes("does not support") || b.includes("invalid_request_error") || b.includes("unknown parameter");
}

/**
 * RAISON EXACTE d'un refus de l'API, au lieu d'un code nu.
 *
 * « Erreur IA (HTTP 400) » n'apprend rien : un 400 peut être un texte trop long, un schéma refusé,
 * un contenu illisible. Le corps de la réponse porte toujours la raison — on la remonte jusqu'à la
 * notification, pour qu'une panne se NOMME au lieu de se deviner.
 */
export function providerErrorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; code?: string } };
    const msg = parsed.error?.message?.trim();
    if (msg) return `Erreur IA (HTTP ${status}) : ${msg.slice(0, 300)}`;
  } catch {
    /* corps non JSON — extrait brut ci-dessous */
  }
  const raw = body.replace(/\s+/g, " ").trim().slice(0, 200);
  return raw ? `Erreur IA (HTTP ${status}) : ${raw}` : `Erreur IA (HTTP ${status}).`;
}

/** Une panne passagère mérite un réessai ; un refus argumenté, non. */
export const isRetryableStatus = (status: number): boolean =>
  status === 429 || status === 529 || status >= 500;
