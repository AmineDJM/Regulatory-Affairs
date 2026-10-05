## 📝 Édition Office (OnlyOffice) & impression

Édition **Word / Excel / PowerPoint** directement dans l'app, **sans dépendance cloud externe** — dans le **Drive**
comme sur **toutes les pièces jointes des modules**.

- Bouton **« Éditer dans Office »** sur les fichiers éditables (Drive → `/drive/[id]/edit` ; Documents → `/documents/[id]/edit`,
  **plein écran**, sauvegarde = nouvelle version). Visible uniquement aux personnes ayant le **droit de modifier**.
- **Chargement plus rapide** et **mode plein écran** de l'éditeur.
- Aperçu in-app (lecture seule) **et 🖨️ impression** conservés pour PDF / Word / Excel / PowerPoint / images **partout**
  (`src/lib/print-document.ts` : iframe same-origin, repli `window.open`).
- Config **signée en JWT HS256** (`src/lib/onlyoffice.ts`) ; le Document Server lit le fichier via un **jeton signé**
  (`edit` Drive / `docedit` Documents) et **rappelle** la sauvegarde sur `/api/onlyoffice/callback`.
- **Inerte** tant que les variables ne sont pas posées (aucun bouton « Éditer »).

> ⚠️ **Déploiement** : le Document Server doit être un **Web Service public** ; `JWT_SECRET` **identique** à
> `ONLYOFFICE_JWT_SECRET` ; `APP_URL` = URL **publique** de l'app (pour le callback).

---

