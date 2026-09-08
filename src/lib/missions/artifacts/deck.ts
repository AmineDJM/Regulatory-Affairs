import type { SpecDeck, SpecDiapo } from "@/lib/artifact/decks/build";
import type { ArtefactSpec, FeuilleSpec } from "@/lib/missions/artifacts/spec";
import { ligneDeTotaux } from "@/lib/missions/artifacts/totaux";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE DECK D'UNE MISSION PASSE PAR LE MÊME CONSTRUCTEUR QUE LES AUTRES (§118.5, §118.60).
 *
 * ── DEUX CONSTRUCTEURS DE DECKS, ET LE MAUVAIS ÉTAIT CELUI DES MISSIONS ─────────────────
 *
 * `artifact/decks/build.ts` est le constructeur « une idée par diapositive » : ses règles
 * éditoriales sont BLOQUANTES (titre d'une ligne, six puces au plus, jamais de diapositive
 * vide, jamais un tableau de quarante lignes), il RELIT le fichier produit avec l'adaptateur de
 * production et le soumet à `controlerAvantLivraison`. Il a de vrais appelants : la capacité
 * `artifact.deck_build` d'Adam, et la fabrique de dossiers de comité.
 *
 * `rendrePptx`, lui, dessinait ses diapositives à la main — et c'est LUI qui produit le deck
 * qu'une mission envoie. Deux exigences de qualité selon l'origine du fichier, et celle des
 * missions prenait du retard : sept puces d'un côté, six de l'autre, pour la MÊME règle.
 *
 * Ce module ne dessine rien. Il TRADUIT une `ArtefactSpec` en `SpecDeck`, et c'est le
 * constructeur unique qui fait le reste.
 *
 * ── LA TRADUCTION DOIT PRODUIRE UNE SPEC LÉGALE, PAS ESPÉRER QU'ELLE LE SOIT ────────────
 *
 * Le constructeur REFUSE une spec hors règles (octets vides, `ok: false`). Si la traduction se
 * contentait de recopier, un modèle un peu bavard tuerait le livrable — un refus à tort, pire
 * que le défaut qu'on corrige (§118.27). Le travail est donc ici, et il ne consiste jamais à
 * jeter : une section de treize puces devient TROIS diapositives, un paragraphe trop long
 * devient le CORPS d'une diapositive au lieu d'une puce, et un tableau de quarante lignes
 * montre ses douze premières EN LE DISANT. Rien ne disparaît en silence (§118.52).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les bornes du constructeur, recopiées ici parce que c'est ce qu'on doit SATISFAIRE (§118.19). */
const MAX_PUCES = 6;
const MAX_MOTS_PUCE = 25;
const MAX_MOTS_TITRE = 14;
const MAX_MOTS_TEXTE = 90;
const MAX_LIGNES_TABLEAU = 12;
const MAX_COLONNES_TABLEAU = 8;
const MAX_DIAPOS = 250;
/** Au-delà, un deck cesse d'être un deck : les tableaux restants sont NOMMÉS, pas tus. */
const MAX_FEUILLES = 4;

const mots = (t: string): number => t.trim().split(/\s+/).filter(Boolean).length;

/**
 * UN TITRE TIENT SUR UNE LIGNE. Quand il déborde, on prend sa PREMIÈRE PHRASE — c'est presque
 * toujours l'idée ; et si elle déborde encore, ses treize premiers mots suivis d'un signe qui
 * dit qu'on a coupé. Le texte entier survit dans les notes du présentateur.
 */
export function titreCourt(brut: string): string {
  const t = brut.trim().replace(/\s+/g, " ");
  if (mots(t) <= MAX_MOTS_TITRE) return t;
  const phrase = (/^[^.!?]+[.!?]?/.exec(t)?.[0] ?? t).trim().replace(/[.!?]$/, "");
  if (mots(phrase) <= MAX_MOTS_TITRE) return phrase;
  return `${phrase.split(/\s+/).slice(0, MAX_MOTS_TITRE - 1).join(" ")}…`;
}

/** Un titre de suite : « Perspectives (2/3) ». Le suffixe compte dans les mots, donc on raccourcit d'abord. */
const titreSuite = (base: string, i: number, n: number): string =>
  // Sans suite, le titre passe QUAND MÊME par `titreCourt` : l'oublier ici laissait un
  // en-tête de trente mots franchir la traduction et faire refuser le deck entier.
  n <= 1 ? titreCourt(base) : `${titreCourt(base).split(/\s+/).slice(0, MAX_MOTS_TITRE - 1).join(" ")} (${i}/${n})`;

const paquets = <T>(items: T[], taille: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += taille) out.push(items.slice(i, i + taille));
  return out.length > 0 ? out : [[]];
};

/** Un texte long découpé en morceaux qui tiennent chacun sur une diapositive. */
function morceaux(texte: string, maxMots: number): string[] {
  const m = texte.trim().split(/\s+/).filter(Boolean);
  if (m.length <= maxMots) return [texte.trim()];
  const out: string[] = [];
  for (let i = 0; i < m.length; i += maxMots) out.push(m.slice(i, i + maxMots).join(" "));
  return out;
}

/** Le tableau d'une feuille, borné — et ce qui reste dehors est dit sur la diapositive même. */
function diapoTableau(f: FeuilleSpec): SpecDiapo {
  const colonnes = f.columns.slice(0, MAX_COLONNES_TABLEAU);
  const donnees = f.rows.slice(0, MAX_LIGNES_TABLEAU - 1).map((r) => colonnes.map((c) => String(r[c.key] ?? "")));
  // LA LIGNE DE TOTAUX EST CALCULÉE (§118.59) : le deck n'a pas de formules, et la promotion
  // aurait fait disparaître de la diapositive le total que le classeur affiche.
  const totaux = ligneDeTotaux(f);
  const lignes = totaux
    ? [...donnees, colonnes.map((c, i) => (i === 0 ? totaux.libelle : String(totaux.valeurs[c.key] ?? "")))]
    : f.rows.slice(0, MAX_LIGNES_TABLEAU).map((r) => colonnes.map((c) => String(r[c.key] ?? "")));
  const resteLignes = f.rows.length - (totaux ? donnees.length : lignes.length);
  const resteColonnes = f.columns.length - colonnes.length;
  // LE COMPTE VA DANS LE TITRE, PAS DANS LES NOTES. Les notes sont pour le présentateur ;
  // l'assemblée, elle, voit la diapositive — et « 12 premières lignes » sans le total se lit
  // comme le tableau entier.
  const dehors = [
    resteLignes > 0 ? `${totaux ? donnees.length : lignes.length} lignes sur ${f.rows.length}` : null,
    resteColonnes > 0 ? `${colonnes.length} colonnes sur ${f.columns.length}` : null,
  ].filter(Boolean).join(", ");
  return {
    titre: titreCourt(dehors ? `${f.name} — ${dehors}` : f.name),
    tableau: { colonnes: colonnes.map((c) => c.header), lignes },
    notes: dehors ? `${dehors} — le détail complet est dans le classeur joint.` : undefined,
  };
}

/**
 * TRADUIT LE LIVRABLE EN DECK. Le résultat satisfait les règles du constructeur par
 * construction — `deck.test.ts` le vérifie en poussant chaque borne.
 */
export function versDeckExecutif(spec: ArtefactSpec, maintenant = new Date()): SpecDeck {
  const diapos: SpecDiapo[] = [];

  for (const s of spec.summary ?? []) {
    const items = [...s.bullets, ...s.paragraphs].map((t) => t.trim()).filter(Boolean);
    // UNE PUCE EST UNE PUCE, UN PARAGRAPHE EST UN CORPS. Mettre un paragraphe de soixante mots
    // derrière une puce est ce qui produit les diapositives illisibles qu'on projette en comité.
    const puces = items.filter((t) => mots(t) <= MAX_MOTS_PUCE);
    const longs = items.filter((t) => mots(t) > MAX_MOTS_PUCE);

    const groupes = puces.length > 0 ? paquets(puces, MAX_PUCES) : [];
    const corps = longs.flatMap((t) => morceaux(t, MAX_MOTS_TEXTE));
    const total = groupes.length + corps.length;
    let n = 0;
    for (const g of groupes) diapos.push({ titre: titreSuite(s.heading, ++n, total), puces: g });
    for (const c of corps) diapos.push({ titre: titreSuite(s.heading, ++n, total), texte: c, notes: c });
  }

  const feuilles = spec.sheets ?? [];
  for (const f of feuilles.slice(0, MAX_FEUILLES)) if (f.rows.length > 0) diapos.push(diapoTableau(f));

  // LA DIAPOSITIVE DES SOURCES — la première question posée en séance est « d'où vient ce
  // chiffre ». Ce qui n'a pas tenu dans le deck y figure aussi : sans cela, le lecteur croit
  // avoir tout vu.
  const dehors = feuilles.length > MAX_FEUILLES
    ? [`${feuilles.length - MAX_FEUILLES} tableau(x) dans le classeur : ${feuilles.slice(MAX_FEUILLES).map((f) => f.name).join(", ")}`]
    : [];
  const sources = [...(spec.sources ?? []), ...dehors].map((t) => t.trim()).filter(Boolean);
  const sourcesCourtes = sources.flatMap((t) => (mots(t) <= MAX_MOTS_PUCE ? [t] : morceaux(t, MAX_MOTS_PUCE)));
  const groupesSources = sourcesCourtes.length > 0 ? paquets(sourcesCourtes, MAX_PUCES) : [];
  groupesSources.forEach((g, i) => diapos.push({ titre: titreSuite("Sources", i + 1, groupesSources.length), puces: g }));

  // UN DECK SANS DIAPOSITIVE EST REFUSÉ par le constructeur, et il aurait raison. Le cas
  // existe : des sections dont le titre est rempli et le contenu vide. On DIT alors ce qui
  // s'est passé plutôt que de livrer un fichier vide ou de lever une exception que personne ne
  // rattache à sa cause.
  if (diapos.length === 0) {
    diapos.push({
      titre: titreCourt(spec.title),
      puces: ["Aucun contenu n'a été fourni pour ce livrable : ni synthèse, ni tableau, ni source."],
    });
  }

  // LE PLAFOND DE DIAPOSITIVES EST BLOQUANT chez le constructeur : on le respecte ICI, et la
  // dernière diapositive dit ce qui n'a pas été montré plutôt que de le laisser disparaître.
  if (diapos.length > MAX_DIAPOS) {
    const retirees = diapos.length - (MAX_DIAPOS - 1);
    diapos.length = MAX_DIAPOS - 1;
    diapos.push({ titre: "Suite", puces: [`${retirees} diapositives n'ont pas été retenues — le détail est dans le rapport et le classeur joints.`] });
  }

  return {
    titre: spec.title,
    sousTitre: maintenant.toLocaleDateString("fr-FR"),
    auteur: "Adam",
    diapos,
    theme: { couleur: "0B2545", couleurTexte: "26313D" },
  };
}
