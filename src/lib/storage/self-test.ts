import { randomUUID, createHash } from "crypto";
import { describeConfig, type ConfigDescription } from "./s3-config";
import { putObject, getObject, deleteObject, objectStorageConfigured } from "@/lib/regulatory/intelligence/upload/object-storage";

/**
 * LE TEST DE CONNEXION AU STOCKAGE — un aller-retour réel, pas une vérification de variables.
 *
 * « Les variables sont présentes » ne prouve rien : un bucket peut être mal nommé, une clé
 * périmée, une région fausse, un droit d'écriture absent. On écrit donc un petit objet, on le
 * relit, on compare son contenu OCTET POUR OCTET, puis on le supprime. C'est le seul test qui
 * répond vraiment à « est-ce que le stockage marche ? ».
 *
 * Les quatre étapes sont rendues séparément : quand ça casse, on veut savoir OÙ. Un PUT qui
 * passe et un GET qui échoue ne se corrigent pas du tout comme l'inverse.
 *
 * AUCUN SECRET N'EN SORT. Le rapport contient l'hôte, le bucket, la région — jamais une clé, ni
 * entière ni tronquée. Les erreurs remontées sont celles du fournisseur (code HTTP + code S3),
 * qui ne contiennent pas d'identifiant.
 */

export type StepName = "config" | "put" | "get" | "verify" | "delete";

export interface StepResult {
  step: StepName;
  label: string;
  ok: boolean;
  /** Durée de l'étape, en millisecondes — un stockage lointain se voit ici. */
  ms: number;
  detail?: string;
}

export interface SelfTestReport {
  ok: boolean;
  config: ConfigDescription;
  steps: StepResult[];
  /** Clé de l'objet de test — utile si un nettoyage manuel s'imposait. */
  testKey: string;
  /** L'objet de test a-t-il bien été retiré du bucket ? */
  cleaned: boolean;
}

const LABEL: Record<StepName, string> = {
  config: "Configuration présente",
  put: "Écriture d'un objet de test",
  get: "Relecture de l'objet",
  verify: "Contenu identique",
  delete: "Suppression de l'objet de test",
};

/** Message d'erreur exploitable, jamais l'objet d'erreur brut (qui peut porter une URL signée). */
function reason(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Ceinture et bretelles : on coupe tout ce qui ressemble à une signature ou à une clé, au cas
  // où un fournisseur en glisserait une dans son message d'erreur.
  return msg.replace(/X-Amz-[A-Za-z-]+=[^&\s]+/g, "X-Amz-…").slice(0, 300);
}

/**
 * Exécute l'aller-retour complet. Ne lève jamais : un test de diagnostic qui plante n'apprend
 * rien à celui qui le lance.
 */
export async function runStorageSelfTest(): Promise<SelfTestReport> {
  const config = describeConfig(process.env as Record<string, string | undefined>);
  const steps: StepResult[] = [];
  // Préfixe dédié et identifiant aléatoire : le test n'écrit jamais à côté d'un vrai fichier,
  // et deux tests simultanés ne se marchent pas dessus.
  const testKey = `_selftest/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.txt`;

  const step = async (name: StepName, fn: () => Promise<string | void>): Promise<boolean> => {
    const started = Date.now();
    try {
      const detail = await fn();
      steps.push({ step: name, label: LABEL[name], ok: true, ms: Date.now() - started, detail: detail || undefined });
      return true;
    } catch (err) {
      steps.push({ step: name, label: LABEL[name], ok: false, ms: Date.now() - started, detail: reason(err) });
      return false;
    }
  };

  const configured = await step("config", async () => {
    if (config.disabled) throw new Error("Le stockage objet est désactivé par S3_DISABLED : l'application écrit en base.");
    if (!objectStorageConfigured()) {
      throw new Error(`Configuration incomplète — il manque : ${config.missing.join(", ") || "toutes les variables S3_*"}.`);
    }
    return `${config.provider} · ${config.endpointHost} · bucket « ${config.bucket} » · région ${config.region}`;
  });
  if (!configured) return { ok: false, config, steps, testKey, cleaned: false };

  // Contenu non trivial : un octet unique passerait même si le stockage tronquait les corps.
  const payload = Buffer.from(`AMD Internal OS — test de stockage ${new Date().toISOString()} ${randomUUID()}`, "utf8");
  const expected = createHash("sha256").update(payload).digest("hex");

  const wrote = await step("put", async () => {
    await putObject(testKey, payload, "text/plain");
    return `${payload.length} octets écrits`;
  });

  let readBack: Buffer | null = null;
  if (wrote) {
    await step("get", async () => {
      readBack = await getObject(testKey);
      return `${readBack.length} octets relus`;
    });
  }

  if (readBack) {
    await step("verify", async () => {
      const got = createHash("sha256").update(readBack as Buffer).digest("hex");
      if (got !== expected) throw new Error("Le contenu relu diffère de celui écrit — stockage incohérent.");
      return "empreinte identique";
    });
  }

  // Le nettoyage est TOUJOURS tenté, même si une étape précédente a échoué : un PUT réussi suivi
  // d'un GET raté laisserait sinon un objet de test dans le bucket.
  let cleaned = false;
  if (wrote) {
    cleaned = await step("delete", async () => {
      await deleteObject(testKey); // ne lève jamais
      // On vérifie la disparition : `deleteObject` est silencieux par conception.
      try {
        await getObject(testKey);
        throw new Error("L'objet de test est encore lisible après suppression.");
      } catch (err) {
        if (err instanceof Error && err.message.includes("encore lisible")) throw err;
        return "objet supprimé";
      }
    });
  }

  return { ok: steps.every((s) => s.ok), config, steps, testKey, cleaned };
}
