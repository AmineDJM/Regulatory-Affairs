## Frontière client / serveur — la règle qui casse les déploiements

Un composant `"use client"` est compilé **pour le navigateur**. S'il importe — même indirectement, à dix modules de distance — un module qui lit des fichiers (`fs`, `zlib`, `child_process`…), la compilation de production échoue avec **« Module not found: Can't resolve 'fs' »**. Le typecheck ne le voit pas.

- Les **actions serveur** (`"use server"`) ne comptent pas : Next.js les remplace par un appel distant. Un composant client peut les appeler librement.
- Ce sont les imports **ordinaires** (constantes, types *avec valeur*, fonctions utilitaires) qui posent problème.
- Pattern à suivre : sortir les fonctions **pures** dans un module dédié qui n'importe rien de lourd (ex. `src/lib/market/galenic.ts` et `text.ts` pour les normalisations pharma ; `molecule.ts` garde l'analyse qui lit les données et les **réexporte** pour le serveur).
- **`src/lib/client-bundle-guard.test.ts`** remonte les chaînes d'import — statiques ET dynamiques (`import("…")`), modules natifs ET paquets Node-only (`web-push`, `nodemailer`, `sharp`, `mupdf`…) — et fait échouer `npm test` en affichant le chemin fautif. Ne pas le désactiver : il existe parce que l'erreur est déjà passée en production, deux fois (`market/data.ts` par `fs`, puis `messaging.ts` par `web-push` via le registre d'événements). Un module serveur qui porte aussi des constantes d'écran se scinde : la part pure dans un fichier sans import (`messaging-ui.ts`), réexportée côté serveur.

