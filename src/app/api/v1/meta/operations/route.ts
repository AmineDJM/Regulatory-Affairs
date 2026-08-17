import { handle } from "@/lib/api/http";
import { describeOperations } from "@/lib/api/registry/operations";

/**
 * LE CATALOGUE DES OPÉRATIONS — ce qu'un agent peut faire, et avec quels paramètres.
 *
 * Un agent qui découvre l'API doit pouvoir lire ses capacités plutôt que les deviner : chaque
 * opération donne son nom, sa portée, ses paramètres et leur type. Lisible avec `erp.read` :
 * connaître la liste ne donne aucun pouvoir — l'exécution exige la portée de l'opération.
 */
export const GET = handle(
  { operationId: "list_operations", scopes: ["erp.read"] },
  async () => ({ operations: describeOperations() }),
);
