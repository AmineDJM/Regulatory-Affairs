/**
 * ADAM DOCTOR — le diagnostic de MISE EN SERVICE, exécuté depuis le serveur qui tourne.
 *
 *   npm run adam:doctor
 *
 * « C'est configuré dans le panneau Render » ne prouve rien : ce qui compte est ce que le
 * PROCESSUS voit. Une variable ajoutée après le dernier déploiement, posée sur un autre service,
 * ou un conteneur non redémarré donnent tous un écran vert côté panneau et un `undefined` côté
 * code. Ce script répond depuis l'intérieur, et il répond en français.
 *
 * Il est SANS EFFET DE BORD : il lit, il ne répare rien, il n'envoie rien, il ne touche à aucune
 * donnée. On peut le lancer en pleine production sans y réfléchir.
 *
 * AUCUN SECRET N'EST AFFICHÉ — jamais, même tronqué. Seulement des NOMS de variables et des
 * états. C'est ce qui permet de coller la sortie dans un message sans se relire.
 *
 * Code de sortie : 1 si au moins un contrôle est en ÉCHEC (utilisable en CI ou en script de
 * déploiement), 0 sinon — un AVERTISSEMENT ne fait pas échouer.
 */
import { prisma } from "../src/lib/prisma";
import { resolveGoogleConfig, missingGoogleVars, GOOGLE_SCOPES, SCOPE_PURPOSE } from "../src/lib/google/config";
import { adamHealth } from "../src/lib/google/health";
import { parityStats } from "../src/lib/assistant/action-registry";

type Level = "PASS" | "WARN" | "FAIL";
const rows: { level: Level; area: string; message: string; fix?: string }[] = [];

const add = (level: Level, area: string, message: string, fix?: string) => {
  rows.push({ level, area, message, fix });
};

async function main(): Promise<void> {
  const env = process.env as Record<string, string | undefined>;

  // ── 1. Base de données ────────────────────────────────────────────────────────────────
  try {
    await prisma.$queryRaw`SELECT 1`;
    add("PASS", "Base de données", "connexion établie");
  } catch (e) {
    add("FAIL", "Base de données", `injoignable : ${(e as Error).message.slice(0, 120)}`,
      "Vérifier DATABASE_URL et que l'instance Postgres est démarrée.");
    // Sans base, tout le reste est du bruit : on s'arrête proprement.
    render();
    return;
  }

  // ── 2. Migrations : les tables d'Adam existent-elles VRAIMENT ? ───────────────────────
  // Le schéma Prisma peut être à jour dans le dépôt et absent de la base : c'est le cas
  // classique d'un déploiement où `migrate deploy` n'a pas tourné.
  for (const [label, probe] of [
    ["CommunicationPolicy", () => prisma.communicationPolicy.count()],
    ["GoogleConnection", () => prisma.googleConnection.count()],
    ["GmailIngestionState", () => prisma.gmailIngestionState.count()],
    ["EmailRecord", () => prisma.emailRecord.count()],
    ["OutboundMailIntent", () => prisma.outboundMailIntent.count()],
    ["Mission", () => prisma.mission.count()],
  ] as [string, () => Promise<number>][]) {
    try {
      await probe();
      add("PASS", "Migrations", `table ${label} présente`);
    } catch {
      add("FAIL", "Migrations", `table ${label} ABSENTE`,
        "Lancer `npm run db:deploy` (prisma migrate deploy) sur l'environnement concerné.");
    }
  }

  // ── 3. Chiffrement des jetons ────────────────────────────────────────────────────────
  // On ne teste PAS la valeur de la clé : on vérifie qu'un aller-retour scellé/ouvert
  // fonctionne. C'est la seule preuve utile, et elle ne révèle rien.
  const hasKey = Boolean(env.MAIL_ENCRYPTION_KEY || env.DRIVE_ENCRYPTION_KEY || env.AUTH_SECRET);
  if (!hasKey) {
    add("FAIL", "Chiffrement", "aucune clé de chiffrement disponible pour les jetons",
      "Définir AUTH_SECRET (ou MAIL_ENCRYPTION_KEY) sur l'hébergeur.");
  } else {
    try {
      const { sealSecret, openSecret } = await import("../src/lib/crypto/secret-box");
      const probe = `adam-doctor-${Date.now()}`;
      const round = openSecret(sealSecret(probe));
      if (round === probe) add("PASS", "Chiffrement", "aller-retour des jetons vérifié (AES-256-GCM)");
      else add("FAIL", "Chiffrement", "l'aller-retour ne rend pas la valeur d'origine",
        "La clé a probablement changé : les jetons déjà stockés sont illisibles, reconnecter le compte Google.");
    } catch (e) {
      add("FAIL", "Chiffrement", `échec : ${(e as Error).message.slice(0, 120)}`);
    }
  }

  // ── 4. Configuration Google ──────────────────────────────────────────────────────────
  const cfg = resolveGoogleConfig(env);
  const missing = missingGoogleVars(env);
  if (!cfg) {
    add("FAIL", "Config Google", `variables manquantes : ${missing.join(", ")}`,
      "Renseigner GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI sur l'hébergeur, puis redéployer.");
  } else {
    add("PASS", "Config Google", "identifiants OAuth présents");
    if (!cfg.adamEmail) {
      add("WARN", "Config Google", "GOOGLE_ADAM_EMAIL absent : n'importe quel compte Google pourra être branché",
        "Renseigner GOOGLE_ADAM_EMAIL pour que le retour OAuth refuse (et révoque) un autre compte.");
    } else {
      add("PASS", "Config Google", "compte attendu verrouillé par GOOGLE_ADAM_EMAIL");
    }
    if (!cfg.pubsubTopic) {
      add("WARN", "Push Gmail", "GOOGLE_PUBSUB_TOPIC absent : aucun push, seule la réconciliation périodique alimente Adam",
        "Créer un sujet Pub/Sub et renseigner GOOGLE_PUBSUB_TOPIC (projects/<id>/topics/<topic>).");
    } else {
      add("PASS", "Push Gmail", "sujet Pub/Sub configuré");
    }
    if (!env.GOOGLE_PUBSUB_TOKEN && !env.GOOGLE_PUBSUB_SERVICE_ACCOUNT) {
      add("WARN", "Push Gmail", "ni secret d'URL ni compte de service attendu : le point d'entrée refusera tout push",
        "Renseigner GOOGLE_PUBSUB_TOKEN (secret dans l'URL d'abonnement) et/ou GOOGLE_PUBSUB_SERVICE_ACCOUNT.");
    }
  }

  // ── 5. État réel de la connexion, de la veille et de l'ingestion ─────────────────────
  const h = await adamHealth();

  if (!h.connection.connected && h.connection.status === "none") {
    add("WARN", "Connexion", "aucun compte Google connecté",
      "Ouvrir /chief-of-staff/reglages et cliquer « Connecter le compte Google ».");
  } else {
    add(h.connection.paused ? "WARN" : "PASS", "Connexion",
      `${h.connection.address ?? "?"}${h.connection.paused ? " (en pause)" : ""}`,
      h.connection.paused ? "Réactiver depuis /chief-of-staff/reglages." : undefined);

    if (!h.connection.hasRefreshToken) {
      add("FAIL", "Connexion", "aucun jeton de rafraîchissement : l'accès expirera sans reprise possible",
        "Reconnecter le compte (le consentement doit être donné avec access_type=offline).");
    } else {
      add("PASS", "Connexion", "jeton de rafraîchissement présent");
    }

    if (h.connection.missingScopes.length) {
      add("WARN", "Droits", `${h.connection.missingScopes.length} droit(s) manquant(s) sur ${GOOGLE_SCOPES.length}`,
        `Reconnecter pour compléter : ${h.connection.missingScopes.map((s) => SCOPE_PURPOSE[s] ?? s).join(" ; ")}`);
    } else {
      add("PASS", "Droits", `les ${GOOGLE_SCOPES.length} droits nécessaires sont accordés`);
    }

    if (h.watch.armed) {
      add("PASS", "Veille Gmail", `armée jusqu'au ${h.watch.expiresAt?.toISOString() ?? "?"}`);
    } else {
      add("WARN", "Veille Gmail", "non armée — Adam n'est prévenu de rien en temps réel",
        "Bouton « Réarmer la veille Gmail » dans /chief-of-staff/reglages (nécessite GOOGLE_PUBSUB_TOPIC).");
    }
    if (h.watch.lastError) {
      add("WARN", "Veille Gmail", `dernière tentative en échec : ${h.watch.lastError}`);
    }

    add(h.ingestion.hasHistoryMarker ? "PASS" : "WARN", "Ingestion",
      h.ingestion.hasHistoryMarker
        ? `point d'histoire posé — ${h.ingestion.last24h} message(s) ingéré(s) sur 24 h`
        : "aucun point d'histoire : la première synchronisation n'a pas encore eu lieu",
      h.ingestion.hasHistoryMarker ? undefined : "Se produit tout seul au prochain battement du planificateur.");
  }

  // ── 6. Politique d'envoi et coupe-circuits ───────────────────────────────────────────
  add(h.outbound.policy === "REQUIRE_APPROVAL" ? "PASS" : "WARN", "Politique d'envoi",
    `${h.outbound.policy}${h.outbound.policy === "AUTO_SEND" ? " — Adam envoie SANS demander" : ""}`,
    h.outbound.policy === "AUTO_SEND" ? "Revenir à « Approbation requise » depuis les réglages si ce n'est pas voulu." : undefined);

  if (h.outbound.outboundPaused) add("WARN", "Coupe-circuit", "envoi SUSPENDU (volontaire) — rien ne part");
  if (h.outbound.inboundPaused) add("WARN", "Coupe-circuit", "lecture SUSPENDUE (volontaire) — Adam n'ingère plus");
  if (h.outbound.awaitingApproval > 0) {
    add("WARN", "File d'attente", `${h.outbound.awaitingApproval} message(s) attendent votre accord`,
      "Les traiter depuis la conversation du Chief of Staff.");
  }
  if (h.outbound.approvedNotSent > 0) {
    add("WARN", "File d'attente", `${h.outbound.approvedNotSent} message(s) approuvé(s) non partis`,
      "Normalement transitoire ; s'ils s'accumulent, vérifier les coupe-circuits et l'accès Gmail.");
  }

  // ── 7. Planificateur ─────────────────────────────────────────────────────────────────
  if (env.SCHEDULER_DISABLED === "1") {
    add("FAIL", "Planificateur", "SCHEDULER_DISABLED=1 : le battement d'Adam ne tourne pas",
      "Retirer la variable pour que la veille se renouvelle et que la boîte soit relevée.");
  } else {
    add("PASS", "Planificateur", "actif (veille, histoire, réconciliation à chaque battement)");
  }

  // ── 8. Parité des actions (calcul pur, aucun appel réseau) ───────────────────────────
  const p = parityStats();
  add(p.gap === 0 ? "PASS" : "FAIL", "Parité ERP",
    `natives=${p.native} couvertes=${p.covered} trous=${p.gap} exclues=${p.excluded}`,
    p.gap > 0 ? "Classer les actions manquantes dans src/lib/assistant/action-registry.ts." : undefined);

  // ── 9. IA ────────────────────────────────────────────────────────────────────────────
  if (!env.ANTHROPIC_API_KEY) {
    add("FAIL", "Moteur IA", "ANTHROPIC_API_KEY absente : le Chief ne peut pas raisonner",
      "Renseigner la clé sur l'hébergeur.");
  } else {
    add("PASS", "Moteur IA", "clé Anthropic présente");
  }

  render();
}

function render(): void {
  const mark = (l: Level) => (l === "PASS" ? "  OK   " : l === "WARN" ? " ALERTE" : " ECHEC ");

  console.log("\n══════════════ ADAM DOCTOR ══════════════\n");
  let area = "";
  for (const r of rows) {
    if (r.area !== area) {
      area = r.area;
      console.log(`\n── ${area}`);
    }
    console.log(`[${mark(r.level)}] ${r.message}`);
    if (r.fix && r.level !== "PASS") console.log(`           → ${r.fix}`);
  }

  const fails = rows.filter((r) => r.level === "FAIL").length;
  const warns = rows.filter((r) => r.level === "WARN").length;
  console.log("\n─────────────────────────────────────────");
  console.log(`${rows.length - fails - warns} OK · ${warns} alerte(s) · ${fails} echec(s)`);
  console.log(
    fails > 0
      ? "ADAM N'EST PAS OPERATIONNEL — corriger les echecs ci-dessus."
      : warns > 0
        ? "ADAM FONCTIONNE, en mode degrade — voir les alertes."
        : "ADAM EST OPERATIONNEL.",
  );
  console.log("─────────────────────────────────────────\n");

  void prisma.$disconnect();
  if (fails > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("adam:doctor a echoue :", e instanceof Error ? e.message : e);
  void prisma.$disconnect();
  process.exitCode = 1;
});
