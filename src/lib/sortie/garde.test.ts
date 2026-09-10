import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  exigerSortieAutorisee, oublierTentativesSortantes, sortieAutorisee, SortieInterdite,
  sortiesInterdites, tentativesSortantes,
} from "./garde";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ZÉRO EFFET EXTERNE PENDANT UN TEST — et la preuve ne peut pas être une relecture.
 *
 * ── LES DEUX GARDES, ET LA SECONDE EST CELLE QUI DURE ───────────────────────────────────
 *
 * La première partie vérifie le comportement : la porte refuse, elle nomme ce qui serait parti,
 * elle ne s'ouvre pas parce qu'on a mis un faux transport. C'est nécessaire et insuffisant —
 * un test de comportement ne dit rien du canal qu'on branchera demain.
 *
 * La seconde REMONTE LES IMPORTS. Tout module qui atteint un transport de sortie
 * (`nodemailer`, `web-push`, l'API Graph) DOIT appeler la garde. Brancher un nouveau canal
 * sans elle fait tomber cette suite, avec le chemin fautif affiché. C'est ce qui transforme une
 * consigne — « pensez à injecter un mock » — en propriété du code.
 *
 * ── POURQUOI UNE CONVENTION NE SUFFISAIT PAS ────────────────────────────────────────────
 *
 * Parce que la faute est un OUBLI, pas une intention. Un adaptateur remis à sa valeur de
 * production le temps d'un débogage, un canal ajouté sans relire la doctrine, et Yacine reçoit
 * une relance qui n'existe pas. On ne rappelle pas un courriel.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

describe("la porte de sortie refuse, et dit ce qui serait parti", () => {
  beforeEach(() => oublierTentativesSortantes());
  afterEach(() => { delete process.env.ADAM_SORTIE_AUTORISEE; });

  it("sous vitest, les sorties sont interdites SANS qu'on ait rien à configurer", () => {
    // C'est le point : aucun `beforeAll` à écrire, aucun drapeau à poser. Un test qui oublie
    // de se protéger est protégé quand même.
    expect(sortiesInterdites()).toBe(true);
  });

  it("un envoi lève, et l'erreur NOMME le destinataire et le contenu", () => {
    let leve: unknown = null;
    try {
      exigerSortieAutorisee("COURRIEL", "regulatory@exemple.test", { apercu: "« Dossier Nivolex — pièces manquantes »" });
    } catch (e) { leve = e; }
    expect(leve).toBeInstanceOf(SortieInterdite);
    const err = leve as SortieInterdite;
    expect(err.acte).toBe("COURRIEL");
    expect(err.cible).toBe("regulatory@exemple.test");
    // « Adam aurait envoyé ceci » : le banc doit pouvoir MONTRER le message retenu, pas
    // seulement constater qu'il n'est pas parti.
    expect(err.message).toContain("regulatory@exemple.test");
    expect(err.message).toContain("Nivolex");
    expect(err.message).toContain("Aucun transport n'a été ouvert");
  });

  it("la variante « au mieux » ne lève pas mais ENREGISTRE quand même — le silence n'efface pas la preuve", () => {
    expect(sortieAutorisee("NOTIFICATION_PUSH", "u-42", { apercu: "Dossier bloqué" })).toBe(false);
    const t = tentativesSortantes();
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ acte: "NOTIFICATION_PUSH", cible: "u-42", apercu: "Dossier bloqué" });
  });

  it("chaque acte sortant est couvert, et chacun est enregistré séparément", () => {
    for (const acte of ["COURRIEL", "NOTIFICATION_PUSH", "INVITATION_AGENDA", "ECRITURE_EXTERNE", "PAIEMENT"] as const) {
      sortieAutorisee(acte, `cible-${acte}`);
    }
    expect(tentativesSortantes().map((t) => t.acte)).toEqual([
      "COURRIEL", "NOTIFICATION_PUSH", "INVITATION_AGENDA", "ECRITURE_EXTERNE", "PAIEMENT",
    ]);
  });

  /**
   * LE TROU MESURÉ SUR UN VRAI BANC — et il ne se rebouche pas avec une variable de plus.
   *
   * `npx tsx scripts/bench/chaine-humaine.ts` lance de VRAIES missions, sur de VRAIES lignes de
   * personnes, avec de VRAIES adresses. Aucun des signaux d'alors (`NODE_ENV`, `VITEST`,
   * `PLAYWRIGHT`) n'y était posé : la garde était DÉSARMÉE pendant tous ces bancs. Ce qui
   * protégeait n'était pas ce fichier, c'était l'espoir que chaque script soit inoffensif.
   *
   * Le signal est donc un FAIT du lancement — le script d'entrée vit sous `scripts/bench/` —
   * et pas une déclaration à ne pas oublier : un banc écrit demain est couvert sans rien faire.
   */
  it("un banc lancé par `tsx scripts/bench/…` arme la garde SANS qu'on ait rien à poser", () => {
    const nu = {} as NodeJS.ProcessEnv;
    expect(sortiesInterdites(nu, ["node", "/home/user/app/scripts/bench/chaine-humaine.ts"])).toBe(true);
    expect(sortiesInterdites(nu, ["node", "C:\\app\\scripts\\bench\\office.ts"])).toBe(true);
    expect(sortiesInterdites({ ...nu, npm_lifecycle_script: "tsx scripts/bench/adam.ts" }, ["node", "/x/npm-cli.js"])).toBe(true);

    // CE QU'IL NE FAUT SURTOUT PAS ARMER : le serveur de production. Une garde qui s'arme
    // partout bloquerait les envois réels — elle serait retirée dans la semaine.
    expect(sortiesInterdites(nu, ["node", "/app/.next/server/index.js"])).toBe(false);
    expect(sortiesInterdites(nu, ["node", "/app/scripts/seed.ts"])).toBe(false);
    // Un chemin qui CONTIENT le mot « bench » sans être un banc ne compte pas.
    expect(sortiesInterdites(nu, ["node", "/app/src/benchmarks/run.ts"])).toBe(false);
  });

  it("la clé d'ouverture existe, elle est explicite, et elle N'EST POSÉE PAR AUCUN CODE DE PRODUCTION", () => {
    // Un test peut vouloir exercer le chemin de production contre un serveur factice LOCAL.
    // La clé existe pour ça — mais si du code de production pouvait la poser, la garde
    // deviendrait décorative. Ce test vérifie les deux moitiés de cette phrase.
    process.env.ADAM_SORTIE_AUTORISEE = "1";
    expect(sortiesInterdites()).toBe(false);
    expect(() => exigerSortieAutorisee("COURRIEL", "x@y.z")).not.toThrow();
    delete process.env.ADAM_SORTIE_AUTORISEE;
    expect(sortiesInterdites()).toBe(true);

    const poseurs = fichiersSources()
      .filter((f) => !f.includes(`${path.sep}sortie${path.sep}`))
      .filter((f) => /ADAM_SORTIE_AUTORISEE\s*=/.test(readFileSync(f, "utf8")));
    expect(poseurs.map((f) => path.relative(process.cwd(), f))).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA GARDE D'IMPORTS — celle qui tient quand personne ne relit la doctrine.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const SRC = path.join(process.cwd(), "src");

/**
 * LES TRANSPORTS. Ce sont les paquets et les chemins par lesquels quelque chose SORT vraiment.
 * Chaque ajout ici est une décision : « ceci peut atteindre une personne réelle ».
 */
const TRANSPORTS = new Set(["nodemailer", "web-push"]);
/**
 * CE QUI OUVRE EFFECTIVEMENT UN CANAL.
 *
 * Première version : `\b(...|sendDraft)\(`. Elle a accusé `mail/provider.ts` — qui ne fait que
 * DÉCLARER l'interface. Une signature n'envoie rien ; confondre la déclaration avec l'appel
 * aurait forcé une garde décorative dans un fichier de types, et affaibli la règle en la
 * rendant absurde. Le détecteur vise donc :
 *
 *   • les invocations concrètes des transports (`transport.sendMail`, `webpush.sendNotification`) ;
 *   • toute IMPLÉMENTATION du contrat de messagerie (`implements MailProvider`) — c'est ce qui
 *     attrapera le prochain fournisseur, y compris s'il parle HTTP et n'importe aucun paquet.
 */
const APPELS_SORTANTS = /\btransport\.sendMail\s*\(|\bwebpush\.sendNotification\s*\(|\bimplements\s+MailProvider\b/;
/** L'appel de la garde, sous l'une ou l'autre de ses deux formes. */
const APPEL_GARDE = /\b(exigerSortieAutorisee|sortieAutorisee)\s*\(/;

function fichiersSources(dir: string = SRC, out: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const p = path.join(dir, nom);
    if (statSync(p).isDirectory()) {
      if (nom === "node_modules" || nom === "data") continue;
      fichiersSources(p, out);
    } else if (/\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom)) {
      out.push(p);
    }
  }
  return out;
}

const IMPORTS = /(?:^|\n)\s*import\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/g;

/**
 * LE CODE SANS SES COMMENTAIRES — et c'est une règle qui s'est attrapée elle-même.
 *
 * En documentant la troisième règle, j'ai CITÉ les motifs de la deuxième (`transport.sendMail(`,
 * `implements MailProvider`) dans un commentaire de `mail-smart.ts`. La deuxième règle s'est
 * alors déclenchée sur ma PROSE : elle « couvrait » le module pour une raison qui n'existait pas
 * dans son code. Une règle qui lit ses propres exemples ne mesure pas ce qu'elle croit mesurer —
 * le même défaut que le cliquet des lecteurs de champ, qui accrochait les exemples de sa
 * documentation. On juge donc le CODE, et lui seul.
 */
const codeSeul = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

function importsDe(fichier: string): string[] {
  const src = readFileSync(fichier, "utf8");
  const specs: string[] = [];
  for (const m of src.matchAll(IMPORTS)) specs.push(m[1]!);
  return specs;
}

describe("LA GARDE QUI COMPTE : aucun transport n'est atteignable sans la porte", () => {
  it("tout module qui importe un transport de sortie appelle la garde", () => {
    const fautifs: string[] = [];
    for (const f of fichiersSources()) {
      const specs = importsDe(f);
      if (!specs.some((s) => TRANSPORTS.has(s) || [...TRANSPORTS].some((t) => s.startsWith(`${t}/`)))) continue;
      const src = codeSeul(readFileSync(f, "utf8"));
      // Importer `nodemailer` pour CONSTRUIRE un MIME sans l'envoyer est légitime (`mail.ts` le
      // fait pour archiver la copie). Ce qui est exigé, c'est que le fichier porte la garde dès
      // lors qu'il peut aussi ouvrir un canal.
      if (!APPEL_GARDE.test(src)) fautifs.push(path.relative(process.cwd(), f));
    }
    expect(fautifs, `ces modules atteignent un transport SANS appeler la garde de sortie :\n  ${fautifs.join("\n  ")}`).toEqual([]);
  });

  it("tout module qui OUVRE un canal (send effectif) appelle la garde, même sans importer le paquet lui-même", () => {
    // Le fournisseur Graph n'importe aucun paquet : il parle HTTP. C'est exactement le cas que
    // la règle précédente laisserait passer — d'où celle-ci, qui juge l'APPEL, pas l'import.
    const fautifs: string[] = [];
    for (const f of fichiersSources()) {
      const src = codeSeul(readFileSync(f, "utf8"));
      if (!APPELS_SORTANTS.test(src)) continue;
      if (!APPEL_GARDE.test(src)) fautifs.push(path.relative(process.cwd(), f));
    }
    expect(fautifs, `ces modules ouvrent un canal SANS appeler la garde :\n  ${fautifs.join("\n  ")}`).toEqual([]);
  });

  /**
   * LA TROISIÈME RÈGLE, et c'est un émetteur RÉEL qui l'a exigée.
   *
   * `mail-smart.ts` — l'e-mail par API HTTPS, celui qui existe justement parce que les ports
   * SMTP sont filtrés — était le QUATRIÈME émetteur du dépôt et le SEUL sans garde. Les deux
   * règles ci-dessus ne pouvaient pas le voir : il n'importe aucun paquet de transport et
   * n'appelle aucune méthode reconnue, il fait un `fetch`. Une garde qui ne s'arme pas sur la
   * forme qu'on lui donne est désarmée en ayant l'air armée (§118.17), et c'est le pire des
   * deux — d'autant qu'un envoi réel pendant un banc est irréversible.
   *
   * LE FAIT sur lequel celle-ci s'arme ne dépend d'aucune bibliothèque : le module APPELLE LE
   * RÉSEAU et EXPORTE une fonction d'ENVOI. Un émetteur ajouté demain avec un fournisseur
   * qu'on ne connaît pas encore est attrapé sans que personne ait pensé à lui.
   *
   * CE QUI FERAIT TOMBER CETTE ASSERTION : supprimer l'APPEL de garde d'un émetteur — joué sur
   * `mail-smart.ts`, elle tombe en nommant le fichier. Ce qu'elle NE voit pas, parce qu'elle
   * lit la source : une garde présente mais neutralisée (`if (false && …)`). C'est le rôle du
   * banc de transport, qui APPELLE la fonction et exige le refus — les deux ensemble, jamais
   * l'une seule (§118.49 : vérifier un corps sans son appelant ne prouve rien).
   * Mesure : 2 modules répondent au fait, et les deux sont gardés.
   */
  it("tout module qui appelle le RÉSEAU et exporte un ENVOI appelle la garde", () => {
    const emetteur = /export\s+(?:async\s+)?function\s+(?:send|envoyer|pousser|notifier)[A-Z_]\w*/;
    const fautifs: string[] = [];
    let vus = 0;
    for (const f of fichiersSources()) {
      const src = codeSeul(readFileSync(f, "utf8"));
      if (!/\bfetch\s*\(/.test(src) || !emetteur.test(src)) continue;
      vus += 1;
      if (!APPEL_GARDE.test(src)) fautifs.push(path.relative(process.cwd(), f));
    }
    // Le compte est ASSERTÉ : si le détecteur cessait de reconnaître quoi que ce soit, la
    // liste des fautifs serait vide et le test passerait sur une garde qui ne regarde plus rien.
    expect(vus, "le détecteur d'émetteur ne reconnaît plus aucun module").toBeGreaterThanOrEqual(2);
    expect(fautifs, `ces modules appellent le réseau pour ENVOYER sans garde :\n  ${fautifs.join("\n  ")}`).toEqual([]);
  });

  it("la garde elle-même n'importe RIEN — sans quoi elle deviendrait impossible à poser partout", () => {
    // Une garde qui tire Prisma ne peut pas être appelée depuis un module léger, et on finirait
    // par l'omettre là où elle compte. Zéro import est la propriété qui la rend universelle.
    expect(importsDe(path.join(SRC, "lib/sortie/garde.ts"))).toEqual([]);
  });

  it("TOUT banc qui démarre un serveur le démarre AVEC les sorties interdites", () => {
    /**
     * LA FRONTIÈRE DE PROCESSUS EST LE TROU QU'ON NE VOIT PAS.
     *
     * `sortiesInterdites()` reconnaît `PLAYWRIGHT` — mais cette variable vit dans le processus
     * du BANC, pas dans le serveur Next qu'il lance. Un serveur démarré sans consigne se croit
     * en production : la garde ne verrait rien, et le banc live — où tout est vrai sauf
     * l'intention — enverrait pour de bon.
     *
     * Chaque configuration qui démarre un serveur doit donc lui POSER l'interdiction. Ce test
     * le vérifie sur toutes, présentes et futures : ajouter un banc sans cette ligne fait
     * tomber la suite ici, avec le nom du fichier.
     */
    const configs = readdirSync(process.cwd()).filter((f) => /^playwright.*\.config\.ts$/.test(f));
    expect(configs.length, "aucune configuration Playwright trouvée : le détecteur s'est désarmé").toBeGreaterThan(0);
    const sansGarde = configs.filter((f) => {
      const src = readFileSync(path.join(process.cwd(), f), "utf8");
      // Seules les configurations qui DÉMARRENT un serveur sont concernées : une configuration
      // qui se contente de piloter un serveur déjà lancé n'a rien à poser.
      if (!/webServer\s*:/.test(src)) return false;
      return !/ADAM_SORTIE_INTERDITE\s*:\s*["']1["']/.test(src);
    });
    expect(sansGarde, `ces bancs démarrent un serveur SANS interdire les sorties :\n  ${sansGarde.join("\n  ")}`).toEqual([]);
  });

  it("mesure consignée — effets externes réels pendant les tests", () => {
    /**
     * Le chiffre est un COMPTE, pas une opinion : combien de modules peuvent atteindre une
     * personne réelle, et combien d'entre eux passent par la porte.
     */
    const atteignants = fichiersSources().filter((f) => {
      const src = readFileSync(f, "utf8");
      const specs = importsDe(f);
      return specs.some((s) => TRANSPORTS.has(s)) || APPELS_SORTANTS.test(src);
    });
    const gardes = atteignants.filter((f) => APPEL_GARDE.test(readFileSync(f, "utf8")));

    consignerMesure("sortie_reelle_impossible_en_test", { n: atteignants.length, ok: gardes.length },
      "lib/sortie/garde.test.ts",
      "modules capables d'atteindre une personne réelle qui passent par la porte de sortie — la porte refuse à l'exécution, et ce test refuse à la relecture");

    expect(atteignants.length, "aucun transport détecté : le détecteur s'est désarmé tout seul").toBeGreaterThan(0);
    expect(gardes.length).toBe(atteignants.length);
  });
});
