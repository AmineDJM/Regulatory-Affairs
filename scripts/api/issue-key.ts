/**
 * ÉMETTRE UNE CLÉ D'API pour un agent.
 *
 *   npx tsx scripts/api/issue-key.ts --name "ChatGPT lecture" --user <email> [--scopes erp.read,erp.search]
 *
 * La clé s'affiche UNE SEULE FOIS : seule son empreinte est conservée. Une clé qu'on peut
 * relire en base est une clé déjà compromise.
 *
 * Sans `--scopes`, le profil LECTURE SEULE s'applique — voir toute l'entreprise, ne rien
 * pouvoir changer. C'est le défaut volontaire : élargir est une décision, pas un oubli.
 */
import { PrismaClient } from "@prisma/client";
import { generateApiKey } from "../../src/lib/api/auth";
import { READ_ONLY_SCOPES, normalizeScopes } from "../../src/lib/api/scopes";

const prisma = new PrismaClient();

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function main() {
  const name = arg("name");
  const email = arg("user");
  if (!name || !email) {
    console.error("Usage : --name \"…\" --user <email> [--scopes erp.read,erp.search] [--expires 2027-01-01]");
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, role: true, isActive: true } });
  if (!user) { console.error(`Aucun utilisateur avec l'adresse ${email}.`); process.exit(1); }
  if (!user.isActive) { console.error("Cet utilisateur est désactivé : un agent ne peut pas agir en son nom."); process.exit(1); }

  const scopes = arg("scopes") ? normalizeScopes(arg("scopes")!.split(",")) : READ_ONLY_SCOPES;
  const expires = arg("expires");
  const { key, keyHash, keyPrefix } = generateApiKey();

  const client = await prisma.apiClient.create({
    data: {
      name, keyHash, keyPrefix, scopes,
      actAsUserId: user.id,
      expiresAt: expires ? new Date(expires) : null,
      note: `Émise en ligne de commande le ${new Date().toISOString()}`,
    },
    select: { id: true },
  });

  console.log(`\nClient créé : ${client.id}`);
  console.log(`Agit au nom de : ${user.name} (${user.role})`);
  console.log(`Portées        : ${scopes.join(", ")}`);
  console.log(`Expiration     : ${expires ?? "aucune"}`);
  console.log(`\n  ${key}\n`);
  console.log("⚠️  Cette clé ne sera plus jamais affichée. Copiez-la maintenant.\n");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
