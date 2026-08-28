# Joignabilité depuis la production

Généré par `npx tsx scripts/audit-runtime-reachability.ts` — 2026-08-28T10:03:49.135Z
Périmètre : `src/lib/missions`, `src/lib/artifact`

## Niveau MODULE — « ce fichier est-il importé par de la production ? »

| classe | n |
|---|---|
| PRODUCTION | 65 |
| TEST_ONLY | 0 |
| ORPHAN | 0 |

Aucun module test-only.

## Niveau SYMBOLE — « cet export a-t-il un appelant ? »

`INDIRECT_VIA_PROD_MODULE` = appelé par un autre export du même module, lui-même joignable.
C'est le cas de `rendreDocx`, appelé par `rendre()` : le compter comme mort serait faux.

| classe | n |
|---|---|
| DIRECT_PROD_CALLER | 224 |
| INDIRECT_VIA_PROD_MODULE | 73 |
| TEST_ONLY | 13 |
| NO_CALLER | 7 |

