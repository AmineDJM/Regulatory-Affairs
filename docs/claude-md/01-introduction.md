# AMD Internal OS — instructions projet

ERP interne Adventum Pharma. Next.js 14 (App Router) + Prisma + PostgreSQL, UI en français, devise DZD. Aucune donnée simulée. Vérification avant commit : `npm run typecheck && npm run build && npm test`, puis `npx next lint` — Render le lance AVANT le build (`build:render`) alors qu'ici `next build` l'ignore : une seule erreur de lint bloque tout déploiement, sans rien signaler de notre côté (§118.155) (Postgres local : `pg_ctlcluster 16 main start` si down). Migrations : SQL manuel idempotent dans `prisma/migrations/` + `db:deploy`.

⚠️ **`npm run build` réutilise le cache `.next`** et peut donc rater une erreur que le serveur de déploiement, lui, verra (il part d'un dossier vide). Après avoir touché aux **imports d'un composant client**, vérifier sur un build propre : `rm -rf .next && npm run build`.

