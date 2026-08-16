/**
 * DIAGNOSTIC DU STOCKAGE OBJET — depuis le serveur qui tourne réellement.
 *
 *   npm run storage:check
 *
 * « Les variables sont renseignées dans le panneau de l'hébergeur » ne prouve rien : ce qui compte
 * est ce que le PROCESSUS voit. Une variable ajoutée après le dernier déploiement, posée sur un
 * autre service, ou un conteneur non redémarré donnent tous le même écran vert côté panneau et un
 * `null` côté code. Ce script répond depuis l'intérieur.
 *
 * AUCUN SECRET N'EST AFFICHÉ — jamais, même tronqué. Seulement des NOMS de variables, l'hôte, le
 * bucket et la région. C'est ce qui permet de coller la sortie dans un message sans réfléchir.
 */
import { describeConfig } from "../src/lib/storage/s3-config";

const d = describeConfig(process.env as Record<string, string | undefined>);

// Les NOMS des variables présentes dans l'environnement (jamais leurs valeurs).
const present = Object.keys(process.env).filter((k) => /^(REG_)?S3_/.test(k)).sort();

console.log("");
console.log("── Stockage objet — ce que voit ce processus ──────────────────");
console.log(`  Configuré           : ${d.configured ? "OUI" : "NON"}`);
console.log(`  Interrupteur d'arrêt: ${d.disabled ? "ACTIF (S3_DISABLED) — c'est la cause" : "inactif"}`);
console.log(`  Variables lues sous : ${d.variableSource === "none" ? "— (aucune trouvée)" : `${d.variableSource}_*`}`);
console.log(`  Présentes ici       : ${present.length ? present.join(", ") : "AUCUNE variable S3_* ni REG_S3_*"}`);
if (d.missing.length) console.log(`  MANQUANTES          : ${d.missing.join(", ")}`);
if (d.configured) {
  console.log(`  Hôte                : ${d.endpointHost}`);
  console.log(`  Bucket              : ${d.bucket}`);
  console.log(`  Région              : ${d.region}`);
  console.log(`  Style d'URL         : ${d.pathStyle ? "chemin (Supabase/MinIO)" : "sous-domaine"}`);
  console.log(`  Fournisseur (indic.): ${d.provider}`);
}
console.log("──────────────────────────────────────────────────────────────");

if (!d.configured) {
  console.log("");
  console.log("Que faire :");
  if (present.length === 0) {
    console.log("  • Ce conteneur n'a AUCUNE variable S3. Elles sont sur un autre service, ou ont");
    console.log("    été ajoutées APRÈS le dernier déploiement — un redéploiement les injectera.");
  } else if (d.disabled) {
    console.log("  • Retirez (ou mettez à 0) S3_DISABLED, puis redéployez.");
  } else {
    console.log(`  • Ajoutez ${d.missing.join(", ")} au service, puis redéployez.`);
  }
  console.log("  • Vérifiez aussi côté application : Administration → Stockage objet → Tester la connexion.");
  process.exit(1);
}
console.log("");
console.log("La configuration est lisible. Testez l'accès réel avec :");
console.log("  Administration → Stockage objet → Tester la connexion (PUT / GET / comparaison / DELETE).");
