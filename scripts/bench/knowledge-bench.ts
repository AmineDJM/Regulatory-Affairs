import { performance } from "node:perf_hooks";
import { buildCorpus, type CorpusFile } from "./corpus-build";
import { QUESTIONS, type CorpusPiece } from "./corpus-def";
import { draftFromBytes } from "@/lib/knowledge/sources/drive";
import { ingestFast, type IngestResult } from "@/lib/knowledge/ingest";
import { retrieve } from "@/lib/knowledge/retrieve";
import { search } from "@/lib/knowledge/retrieval";
import { rerank, FUNNEL } from "@/lib/knowledge/rerank";
import { fold } from "@/lib/knowledge/text";
import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BANC — ce que la chaîne fait vraiment, mesuré, pas supposé.
 *
 * ── CE QU'IL MESURE ─────────────────────────────────────────────────────────────────────
 *
 *   EXTRACTION  vitesse par format, et surtout JUSTESSE : chaque marqueur écrit d'avance
 *               figure-t-il dans le texte extrait ? Un parseur rapide qui rend du charabia est
 *               pire qu'un parseur lent, parce qu'il est silencieux.
 *   ROUTAGE     le barreau choisi est-il celui qu'on attendait ? Un document lisible parti vers
 *               la vision est de l'argent brûlé ; un scan resté en natif est du texte perdu.
 *   DOUBLON     un même contenu déposé deux fois produit-il deux index ?
 *   VERSION     un même emplacement re-déposé produit-il une version LIÉE, pas un orphelin ?
 *   RECHERCHE   sur des questions à réponse connue : le bon document remonte-t-il, à quel rang,
 *               et l'extrait rendu contient-il vraiment la réponse ?
 *
 * ── CE QU'IL NE MESURE PAS, ET IL FAUT LE DIRE ──────────────────────────────────────────
 *
 * Aucune clé de modèle n'est disponible ici. Donc : pas de vision, pas de classification, pas
 * d'embeddings. La recherche mesurée est la recherche DÉTERMINISTE — exact, lexical,
 * métadonnées. C'est déjà la moitié du système, et c'est la moitié qui doit marcher sans
 * dépendre de personne ; mais un chiffre de rappel obtenu ici n'est PAS le rappel du système
 * complet, et l'audit ne doit pas les confondre.
 *
 * ── OÙ ÇA ÉCRIT ─────────────────────────────────────────────────────────────────────────
 *
 * Dans la base pointée par `DATABASE_URL`, sous `sourceId` préfixé `bench/` — jamais ailleurs,
 * jamais sur un identifiant qui pourrait être celui d'un vrai fichier. Rien n'est supprimé : le
 * banc est IDEMPOTENT par l'empreinte, donc le relancer met à jour au lieu d'empiler.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Préfixe de cloisonnement. Il rend les éléments du banc reconnaissables et jamais confondables. */
const PREFIX = "bench/corpus/";

/** Le banc voit tout : mesurer la RECHERCHE, pas les droits — qui ont leurs propres tests. */
const voitTout = async (items: { itemId: string }[]) => new Set(items.map((i) => i.itemId));

const ms = (n: number) => `${n.toFixed(1)} ms`;
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)} %` : "—");

interface MesureExtraction {
  piece: CorpusPiece;
  octets: number;
  extractionMs: number;
  ingestMs: number;
  texteLong: number;
  morceaux: number;
  route: string;
  routeAttendue: string;
  routeOk: boolean;
  marqueursTrouves: number;
  marqueursManquants: string[];
  outcome: IngestResult["outcome"] | "ECHEC";
  itemId: string | null;
}

/**
 * L'IDENTIFIANT DE SOURCE — et c'est ici que les deux cas tordus se jouent vraiment.
 *
 * Le dédoublonnage de l'ERP est indexé sur `(sourceType, sourceId)` : c'est l'EMPLACEMENT qui
 * identifie, l'empreinte ne servant qu'à savoir si le contenu de cet emplacement a bougé. Les
 * deux cas doivent donc être modélisés comme ils se produisent réellement dans le Drive :
 *
 *   COPIE (`doublon`)       un SECOND fichier, donc un autre emplacement, mêmes octets.
 *                           C'est ce qui arrive quand quelqu'un duplique un document.
 *   RE-DÉPÔT (`version`)    le MÊME fichier, nouveau contenu — le geste « je téléverse la v2
 *                           par-dessus ». Même emplacement, donc même `sourceId`.
 *
 * Les mélanger rendrait le banc muet sur les deux : une copie rangée sous le même identifiant
 * paraîtrait dédupliquée alors qu'elle ne l'a jamais été, et une révision rangée ailleurs
 * paraîtrait ignorée alors qu'elle est simplement classée comme un nouveau document.
 */
function sourceIdDe(p: CorpusPiece): string {
  // Le créneau de révision est le SIEN, pas celui de sa source. Les faire partager un
  // identifiant paraissait fidèle — c'est le même fichier, après tout — mais rendait le banc
  // instable : à chaque exécution, la source réécrivait le créneau, la révision le réécrivait
  // derrière, et le compteur de versions grimpait de deux sans que rien n'ait changé. Le banc
  // sème donc le créneau lui-même, juste avant, ce qui reproduit le geste réel — téléverser la
  // v2 par-dessus la v1 — sans dépendre de l'ordre des autres pièces.
  if (p.lien?.type === "version") return `${PREFIX}revision/${p.lien.de}`;
  return `${PREFIX}${p.id}`;
}

async function mesurerIngestion(files: CorpusFile[]): Promise<MesureExtraction[]> {
  const out: MesureExtraction[] = [];
  for (const f of files) {
    const sourceId = sourceIdDe(f.piece);

    // LE GESTE RÉEL, REPRODUIT : la v1 est déposée, PUIS la v2 par-dessus. Sans cette semence,
    // la révision arriverait dans un créneau vide et serait classée « created » — le banc
    // conclurait à l'absence de versionnement alors qu'on ne lui a jamais donné de v1 à
    // remplacer.
    if (f.piece.lien?.type === "version") {
      const src = files.find((x) => x.piece.id === f.piece.lien!.de);
      if (src) await ingestFast((await draftFromBytes(src.buffer, src.nom, "drive_file", sourceId)).input);
    }

    const t0 = performance.now();
    const draft = await draftFromBytes(f.buffer, f.nom, "drive_file", sourceId);
    const extractionMs = performance.now() - t0;

    const texte = draft.input.text ?? "";
    const plie = fold(texte);
    const manquants = f.piece.attendu.marqueurs.filter((m) => !plie.includes(fold(m)));

    const t1 = performance.now();
    const res = await ingestFast(draft.input);
    const ingestMs = performance.now() - t1;

    // Le routage attendu s'exprime en deux mots ; la décision, elle, nomme un barreau précis.
    // `native` couvre tout ce que le code lit seul ; `vision` couvre `luna` et au-delà.
    const routeReelle = draft.route.use;
    const routeOk = f.piece.attendu.extraction === "native"
      ? routeReelle === "native"
      : routeReelle === "luna" || routeReelle === "terra" || routeReelle === "ocr";

    out.push({
      piece: f.piece,
      octets: f.buffer.length,
      extractionMs,
      ingestMs,
      texteLong: texte.length,
      morceaux: draft.input.chunks?.length ?? 0,
      route: routeReelle,
      routeAttendue: f.piece.attendu.extraction,
      routeOk,
      marqueursTrouves: f.piece.attendu.marqueurs.length - manquants.length,
      marqueursManquants: manquants,
      outcome: res?.outcome ?? "ECHEC",
      itemId: res?.itemId ?? null,
    });
  }
  return out;
}

/**
 * DEUX MESURES, ET IL FAUT LES DEUX — c'est la leçon de la première exécution.
 *
 * Le banc rapportait 8 % de rappel et la conclusion évidente était « l'index est mauvais ».
 * Elle était fausse. En rejouant les mêmes questions directement contre l'index, le rappel
 * montait à 80 % : ce n'est pas la recherche qui échouait, c'est le ROUTEUR qui décidait, pour
 * 23 questions sur 25, qu'il n'y avait pas lieu de chercher — et `retrieve` rendait alors une
 * liste vide en 0,0 ms, indiscernable d'une recherche infructueuse.
 *
 * Un seul chiffre ne pouvait pas distinguer les deux, donc il désignait le mauvais coupable.
 * On en mesure désormais deux :
 *
 *   INDEX     recherche + reclassement appelés directement. Répond à « le document est-il
 *             retrouvable ? » — c'est la qualité de l'indexation et du classement.
 *   BOUT EN   `retrieve` complet, routage compris. Répond à « le système le retrouve-t-il ? »
 *   BOUT      — c'est ce que l'utilisateur vit.
 *
 * L'écart entre les deux EST le coût du routage, et il se lit d'un coup d'œil.
 */
interface MesureRecherche {
  q: string;
  attendu: string;
  /** Rang dans `retrieve` complet — `null` si absent des cinq rendus. */
  rang: number | null;
  /** Rang quand on interroge l'index directement, routage court-circuité. */
  rangIndex: number | null;
  reponseDansExtrait: boolean;
  totalMs: number;
  indexMs: number;
  /** Le routeur a-t-il refusé d'ouvrir les documents ? */
  routeurAEcarte: boolean;
  mode: string;
  rappeles: number;
  gardes: number;
  premier: string | null;
}

async function mesurerRecherche(idParPiece: Map<string, string>): Promise<MesureRecherche[]> {
  const out: MesureRecherche[] = [];
  for (const question of QUESTIONS) {
    const cible = idParPiece.get(question.attendu);
    const r = await retrieve(
      { question: question.q, sourceTypes: ["drive_file"], limit: 5 },
      voitTout,
    );
    const rang = cible ? r.hits.findIndex((h) => h.itemId === cible) : -1;

    // LA MÊME QUESTION, POSÉE DIRECTEMENT À L'INDEX. C'est le témoin : sans lui, un échec de
    // routage et un échec d'indexation rendent le même chiffre.
    const tIdx = performance.now();
    const bruts = await search({ text: question.q, sourceTypes: ["drive_file"], limit: FUNNEL.afterHybrid }, voitTout);
    const classes = rerank(bruts, question.q, { limit: 5 });
    const indexMs = performance.now() - tIdx;
    const rangIndex = cible ? classes.findIndex((h) => h.itemId === cible) : -1;

    // L'extrait jugé est celui que l'INDEX rend : il existe même quand le routeur a écarté la
    // recherche, donc la question « l'extrait porte-t-il la réponse ? » reste posable.
    const extrait = rangIndex >= 0 ? (classes[rangIndex]?.snippet ?? "") : "";
    out.push({
      q: question.q,
      attendu: question.attendu,
      rang: rang >= 0 ? rang + 1 : null,
      rangIndex: rangIndex >= 0 ? rangIndex + 1 : null,
      reponseDansExtrait: fold(extrait).includes(fold(question.reponse)),
      totalMs: r.timings.totalMs,
      indexMs,
      routeurAEcarte: r.skipped === true,
      mode: r.route.route,
      rappeles: bruts.length,
      gardes: classes.length,
      premier: r.hits[0]?.snippet.slice(0, 48) ?? null,
    });
  }
  return out;
}

function rapportIngestion(m: MesureExtraction[]): void {
  console.log("\n══ INGESTION ═══════════════════════════════════════════════════════════════════\n");
  console.log("format     octets   extract    ingest  texte  morc  route     marqueurs  résultat");
  console.log("─".repeat(96));
  for (const r of m) {
    const marq = `${r.marqueursTrouves}/${r.piece.attendu.marqueurs.length}`;
    const drapeau = !r.routeOk ? " ⚠ROUTE" : r.marqueursManquants.length ? " ⚠TEXTE" : "";
    console.log(
      `${r.piece.format.padEnd(9)} ${String(r.octets).padStart(7)} ${ms(r.extractionMs).padStart(9)} `
      + `${ms(r.ingestMs).padStart(9)} ${String(r.texteLong).padStart(6)} ${String(r.morceaux).padStart(5)} `
      + `${r.route.padEnd(8)} ${marq.padStart(9)}  ${r.outcome}${drapeau}`,
    );
  }

  // ── PAR FORMAT. C'est la vue qui sert : « le PPTX coûte-t-il cher ? » n'a de sens qu'agrégé.
  console.log("\n── vitesse par format (extraction seule) ──");
  const parFormat = new Map<string, number[]>();
  for (const r of m) parFormat.set(r.piece.format, [...(parFormat.get(r.piece.format) ?? []), r.extractionMs]);
  for (const [f, xs] of [...parFormat].sort()) {
    const tri = [...xs].sort((a, b) => a - b);
    const moy = xs.reduce((a, b) => a + b, 0) / xs.length;
    console.log(`  ${f.padEnd(10)} n=${String(xs.length).padStart(2)}  médiane ${ms(tri[Math.floor(tri.length / 2)]!).padStart(9)}  moyenne ${ms(moy).padStart(9)}  max ${ms(tri[tri.length - 1]!).padStart(9)}`);
  }

  const routesFausses = m.filter((r) => !r.routeOk);
  const texteIncomplet = m.filter((r) => r.marqueursManquants.length);
  const attendus = m.reduce((n, r) => n + r.piece.attendu.marqueurs.length, 0);
  const trouves = m.reduce((n, r) => n + r.marqueursTrouves, 0);

  console.log("\n── justesse ──");
  console.log(`  routage correct     ${m.length - routesFausses.length}/${m.length}  (${pct(m.length - routesFausses.length, m.length)})`);
  console.log(`  marqueurs retrouvés ${trouves}/${attendus}  (${pct(trouves, attendus)})`);
  for (const r of routesFausses) console.log(`  ⚠ route ${r.piece.id} : attendu ${r.routeAttendue}, obtenu ${r.route}`);
  for (const r of texteIncomplet) console.log(`  ⚠ texte ${r.piece.id} : manquent ${r.marqueursManquants.map((x) => `« ${x} »`).join(", ")}`);
}

async function rapportCasTordus(m: MesureExtraction[]): Promise<void> {
  console.log("\n══ LES CAS TORDUS ══════════════════════════════════════════════════════════════\n");

  for (const r of m.filter((x) => x.piece.lien)) {
    const lien = r.piece.lien!;
    const source = m.find((x) => x.piece.id === lien.de);
    if (lien.type === "doublon") {
      const memeItem = source?.itemId === r.itemId;
      console.log(`DOUBLON  ${r.piece.id}`);
      console.log(`  copie du même contenu sous un autre emplacement → outcome « ${r.outcome} »`);
      console.log(`  ${memeItem ? "✔ un seul élément indexé" : "✘ DEUX éléments indexés pour un contenu identique"}`);
    } else {
      const item = r.itemId ? await prisma.knowledgeItem.findUnique({
        where: { id: r.itemId },
        select: { version: true, supersedesId: true, isCurrent: true },
      }) : null;
      const lie = Boolean(item?.supersedesId);
      console.log(`VERSION  ${r.piece.id}`);
      console.log(`  re-dépôt au même emplacement → outcome « ${r.outcome} », version ${item?.version ?? "?"}`);
      console.log(`  ${lie ? "✔ liée à la version précédente (supersedesId)" : "✘ orpheline : l'historique est rompu"}`);
      if (item) {
        const anciennes = await prisma.knowledgeItem.count({
          where: { sourceId: { startsWith: `${PREFIX}${lien.de}#v` } },
        });
        console.log(`  ${anciennes > 0 ? "✔" : "✘"} ${anciennes} version(s) antérieure(s) conservée(s), non écrasée(s)`);
      }
    }
  }

  // FAUTES DE NOM et MULTILINGUE se jugent à la recherche, pas à l'ingestion : ce qui compte
  // n'est pas que le texte fautif soit extrait — il l'est toujours — mais qu'on retrouve le
  // document en écrivant le nom CORRECTEMENT. C'est mesuré plus bas.
  const fautes = m.find((x) => x.piece.id === "fautes");
  if (fautes) console.log(`\nFAUTES DE NOM  texte extrait : ${fautes.texteLong} caractères — la résolution se juge à la recherche.`);
  const multi = m.filter((x) => x.piece.langue && x.piece.langue !== "fr");
  console.log(`MULTILINGUE    ${multi.length} pièces non francophones : ${multi.map((x) => `${x.piece.id} (${x.piece.langue}, ${x.texteLong} car.)`).join(", ")}`);
}

function rapportRecherche(m: MesureRecherche[]): void {
  console.log("\n══ RECHERCHE DÉTERMINISTE ══════════════════════════════════════════════════════\n");
  console.log("index  bout   rép.  latence   mode          question");
  console.log("─".repeat(104));
  for (const r of m) {
    const idx = r.rangIndex ? `#${r.rangIndex}` : "—";
    const bout = r.rang ? `#${r.rang}` : r.routeurAEcarte ? "écar." : "—";
    console.log(
      `${idx.padStart(5)}  ${bout.padStart(5)}  ${r.reponseDansExtrait ? " ✔ " : " · "}  ${ms(r.totalMs).padStart(8)}  `
      + `${r.mode.padEnd(13)} ${r.q.slice(0, 48)}`,
    );
  }

  const idxTrouve = m.filter((r) => r.rangIndex !== null);
  const idxTop1 = m.filter((r) => r.rangIndex === 1);
  const boutTrouve = m.filter((r) => r.rang !== null);
  const ecartes = m.filter((r) => r.routeurAEcarte);
  const avecReponse = m.filter((r) => r.reponseDansExtrait);
  const lat = m.map((r) => r.indexMs).sort((a, b) => a - b);

  console.log("\n── l'index, interrogé directement ──");
  console.log(`  rappel @5        ${idxTrouve.length}/${m.length}  (${pct(idxTrouve.length, m.length)})`);
  console.log(`  précision @1     ${idxTop1.length}/${m.length}  (${pct(idxTop1.length, m.length)})`);
  console.log(`  réponse dans l'extrait  ${avecReponse.length}/${m.length}  (${pct(avecReponse.length, m.length)})`);
  console.log(`  latence          médiane ${ms(lat[Math.floor(lat.length / 2)]!)} · p90 ${ms(lat[Math.floor(lat.length * 0.9)]!)} · max ${ms(lat[lat.length - 1]!)}`);

  console.log("\n── le système complet, routage compris ──");
  console.log(`  rappel @5        ${boutTrouve.length}/${m.length}  (${pct(boutTrouve.length, m.length)})`);
  console.log(`  écartés par le routeur AVANT toute recherche : ${ecartes.length}/${m.length}  (${pct(ecartes.length, m.length)})`);
  const perdus = m.filter((r) => r.rangIndex !== null && r.rang === null);
  console.log(`  ⇒ ${perdus.length} question(s) dont la réponse EST indexée et retrouvable, mais que le système ne rend pas.`);

  for (const r of m.filter((x) => x.rangIndex === null)) {
    console.log(`  ✘ index : « ${r.q.slice(0, 62)} » (attendu ${r.attendu}, ${r.rappeles} rappelé(s))`);
  }
  for (const r of perdus) {
    console.log(`  ⚠ routage : « ${r.q.slice(0, 56)} » → ${r.mode} (l'index l'avait au rang #${r.rangIndex})`);
  }
}

async function main(): Promise<void> {
  console.log("Construction du corpus…");
  const files = await buildCorpus();
  console.log(`${files.length} fichiers, ${(files.reduce((n, f) => n + f.buffer.length, 0) / 1024).toFixed(0)} Ko`);

  const t0 = performance.now();
  const mesures = await mesurerIngestion(files);
  const totalIngestion = performance.now() - t0;

  rapportIngestion(mesures);
  await rapportCasTordus(mesures);

  const octets = mesures.reduce((n, r) => n + r.octets, 0);
  console.log("\n── débit d'ensemble ──");
  console.log(`  ${files.length} fichiers · ${(octets / 1024).toFixed(0)} Ko en ${(totalIngestion / 1000).toFixed(2)} s`);
  console.log(`  soit ${(totalIngestion / files.length).toFixed(0)} ms par fichier en séquentiel`);

  const idParPiece = new Map<string, string>();
  for (const r of mesures) if (r.itemId) idParPiece.set(r.piece.id, r.itemId);
  rapportRecherche(await mesurerRecherche(idParPiece));

  // ── CE QUE LE BANC N'A PAS MESURÉ. Dit ici, pas en note de bas de page.
  const cle = Boolean(process.env.OPENAI_API_KEY);
  console.log("\n══ NON MESURÉ ══════════════════════════════════════════════════════════════════\n");
  console.log(`  clé de modèle : ${cle ? "présente" : "ABSENTE"} → vision, classification et embeddings ${cle ? "mesurables" : "NON exécutés"}.`);
  console.log("  le rappel ci-dessus est celui de la recherche déterministe seule (exact + lexical + métadonnées).");
  console.log("  le contenu est écrit pour le banc : il mesure la mécanique, pas la pertinence sur le fonds réel d'Adventum.");

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
