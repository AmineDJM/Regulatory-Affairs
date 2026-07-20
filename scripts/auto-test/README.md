# Auto-testeur AMD

Testeur automatique de cohérence de la plateforme. Il confronte les **trois sources de
vérité** de l'application — les **pages** réelles, la **garde** de chaque page
(`requireModule`), et la **navigation + matrice RBAC rôles → modules** — puis, en option,
**pilote un navigateur** pour vérifier l'accès réel de chaque rôle à 100 % des pages.

Objectif : détecter les incohérences backend ↔ frontend ↔ console d'administration ↔ rôles
(liens de menu morts, gardes de module erronées, fuites d'accès, écarts RBAC réels), avec
des **rapports clairs** et un **code de sortie** exploitable en CI.

## Utilisation

```bash
# 1) Audit statique (aucun serveur requis) — instantané, déterministe
npm run autotest

# 2) Crawl en direct contre une instance en marche (Playwright requis)
npm run autotest:live -- --base-url=http://localhost:3000
#    · passe ANONYME : chaque page doit rediriger vers /login (sinon = fuite d'accès)
#    · passes PAR RÔLE : comptes fournis ou semés (voir ci-dessous)

# 3) Triage IA des constats (réutilise ANTHROPIC_API_KEY de l'app)
npm run autotest -- --ai
```

### Comptes pour les passes par rôle

- **Fournis** — variable `AUTOTEST_CREDENTIALS` (JSON) :
  ```bash
  AUTOTEST_CREDENTIALS='[{"role":"MEDICAL_DELEGATE","email":"a@x.dz","password":"…"},
                         {"role":"DIRECTION","email":"b@x.dz","password":"…"}]' \
  npm run autotest:live -- --base-url=https://mon-instance
  ```
- **Semés** (local/dev uniquement) — `--seed` crée un compte jetable par rôle
  (`autotest+<role>@autotest.invalid`, mot de passe aléatoire), lance le crawl, puis
  **supprime** ces comptes à la fin :
  ```bash
  npm run autotest:live -- --base-url=http://localhost:3000 --seed
  ```

## Ce qui est vérifié

| Constat | Gravité | Signification |
|---|---|---|
| `NAV_BROKEN_LINK` | 🔴 bug | Une entrée de menu pointe vers une route sans page (404). |
| `BAD_MODULE_GATE` | 🔴 bug | `requireModule("X")` avec un module inconnu (garde morte). |
| `AUTH_LEAK` *(live)* | 🔴 bug | Une page s'ouvre **sans authentification**. |
| `PAGE_ERROR` *(live)* | 🔴 bug | Erreur d'exécution / overlay Next sur une page. |
| `NAV_MODULE_MISMATCH` | 🟠 | Le module annoncé au menu ≠ la garde réelle de la page. |
| `MODULEFORPATH_MISMATCH` | 🟠 | `moduleForPath()` ≠ garde réelle (badge/onglet actif incohérent). |
| `NO_MODULE_GATE` | 🟠 | Page sans garde de module explicite (à confirmer). |
| `LIVE_RBAC_MISMATCH` *(live)* | 🟠 | Accès réel d'un rôle ≠ accès prédit par le moteur RBAC. |
| `LOGIN_FAILED` *(live)* | 🟠 | Connexion impossible pour un compte de test. |
| `MODULE_WITHOUT_PAGE` | 🔵 | Module RBAC ne gardant aucune page (permission éventuellement inutilisée). |

Le crawl en direct dépose aussi une **pièce jointe jetable** (PDF + ZIP valides, générés à
la volée puis supprimés) dans les zones d'upload rencontrées, **sans soumettre** le
formulaire (aucune donnée n'est modifiée).

## Sorties

- `auto-test-report.md` — rapport lisible : synthèse, constats triés, matrice rôles → modules.
- `auto-test-report.json` — détail machine (routes, gardes, constats, matrice, crawl).
- Code de sortie `1` si au moins un **bug** (🔴) — utilisable comme garde CI.

## Fichiers

- `lib.ts` — découverte des pages, extraction des gardes, audit de cohérence, matrice RBAC, rendu.
- `run.ts` — orchestrateur CLI (`--live`, `--seed`, `--ai`, `--base-url=`, `--out=`).
- `live.ts` — crawl Playwright (passe anonyme + passes par rôle, uploads jetables).
- `ai.ts` — triage IA optionnel (réutilise `src/lib/ai.ts`).

> Le tout importe le **vrai** code RBAC/navigation de l'application (`src/lib/rbac.ts`,
> `src/lib/labels.ts`) : la matrice reflète la réalité, jamais une copie qui dériverait.
