/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * FAIRE PASSER `fetch` PAR LE MANDATAIRE — préchargement de BANC, jamais du produit.
 *
 * ── LE DÉFAUT MESURÉ ─────────────────────────────────────────────────────────────────────
 *
 * Dans ce conteneur, `curl https://api.openai.com/v1/chat/completions` rend 200 : le mandataire
 * remplace l'en-tête d'autorisation par de vrais identifiants. Le MÊME appel depuis l'ERP rend
 * `HTTP 401 — Incorrect API key provided`. La cause n'est ni la clé ni le réseau : le `fetch`
 * global de Node (undici) N'HONORE PAS `HTTPS_PROXY`, contrairement à curl. Les appels de
 * modèle sortaient donc en direct, sans jamais croiser le mandataire qui les aurait signés.
 *
 * Conséquence pratique : tout banc LIVE — celui qui a produit la moitié des leçons de ce
 * dépôt — était injouable ici, et l'échec ressemblait à une clé manquante. Un diagnostic
 * plausible et faux, comme d'habitude (§118.76).
 *
 * ── POURQUOI CE FICHIER N'EST PAS DU CODE DE PRODUCTION ──────────────────────────────────
 *
 * Le produit tourne sur Render, sans mandataire, avec sa vraie clé : router son `fetch` vers
 * un mandataire local serait un défaut là-bas. Ce réglage appartient donc à l'ENVIRONNEMENT
 * d'exécution du banc, pas au code — d'où un préchargement (`node --require`) qu'on n'active
 * que lorsqu'on lance un banc ici.
 *
 * ── CE QU'IL NE FAIT PAS ─────────────────────────────────────────────────────────────────
 *
 * Il ne touche NI à la vérification TLS (le magasin de certificats vient de
 * `NODE_EXTRA_CA_CERTS`, posé par l'environnement), NI aux variables de mandataire : il les
 * LIT. Sans `HTTPS_PROXY`, il ne fait rien et le dit — se taire laisserait croire qu'il a
 * agi.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (!proxy) {
  console.info("[banc] aucun HTTPS_PROXY : `fetch` reste en direct (c'est le cas en production).");
} else {
  const { ProxyAgent, setGlobalDispatcher } = require("undici");
  setGlobalDispatcher(new ProxyAgent(proxy));
  console.info(`[banc] fetch routé par le mandataire ${proxy} — les appels de modèle seront signés par lui.`);
}
