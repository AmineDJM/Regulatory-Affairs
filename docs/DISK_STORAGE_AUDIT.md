# Audit disque — AMD Internal OS (production Render)

**Date :** 17 août 2026 · **Nature :** LECTURE SEULE — rien n'a été supprimé, migré, vidé ni modifié.
**Portée :** analyse du code et de la configuration de déploiement. Les chiffres de la production
elle-même se relèvent avec `scripts/audit-disk.sh` (§ 2), qui n'exécute aucune commande destructrice.

---

## 1. Résumé exécutif

> **La conclusion principale de cet audit renverse la question posée.**
>
> `render.yaml` **ne déclare aucun disque persistant** (`disk:` / `mountPath` absents). Il n'y a
> donc pas de volume de 10 Go rempli par des documents. Ce que mesure le graphique « Disk Usage »
> est **le système de fichiers éphémère de l'instance web** — le code déployé, `node_modules`,
> `.next`, les caches de build et `/tmp`.
>
> **Les documents des utilisateurs ne sont pas sur ce disque.** Ils vivent dans **PostgreSQL**
> (`FileBlob.data`, `FileBlobChunk.data`, colonnes `Bytes`) ou, quand `S3_*` est configuré, dans le
> **bucket objet**. Chercher 6,3 Go de pièces jointes sur le disque Render, c'est chercher au
> mauvais endroit — et 17 utilisateurs ne produisent de toute façon pas ce volume.

### Les 6,3 Go, selon toute vraisemblance

Estimation par mesure de l'arborescence de build de ce dépôt (proxy fidèle du runtime Render) :

| Poste | Taille mesurée | Nature |
|---|---:|---|
| `node_modules` | **~1,0 Go** | dépendances de production **et** de build |
| `.next` (build + cache) | **~0,9 Go** | sortie de compilation + cache Next |
| Cache npm (`~/.npm`) | ~0,3–0,8 Go | téléchargements de `npm install` |
| Couches d'image / système / runtime Node | ~1–2 Go | base Render |
| **Builds ANTÉRIEURS conservés** | **variable — le suspect n°1** | Render garde des artefacts entre déploiements |
| `/tmp` (archives CTD, cache OCR) | 0 à plusieurs Go | **transitoire — voir § 7** |

**Réponse courte attendue à la fin de l'audit** (à compléter avec les chiffres réels du script) :

```
Les 6,3 Go sont principalement :
- ~X,X Go : node_modules (dépendances, dont ~44 Mo tesseract.js-core, ~276 Mo @next, ~45 Mo sharp/@img)
- ~X,X Go : .next (sortie de build + cache)
- ~X,X Go : cache npm + couches système
- ~X,X Go : artefacts de déploiements antérieurs
- ~X   Mo : /tmp (archives CTD en cours, cache de langues OCR)
```

> ⚠️ Ces proportions sont **estimées** à partir de l'arborescence locale. Le script du § 2 donne
> les chiffres exacts de la production. Aucune décision ne devrait être prise avant de l'avoir lancé.

**Après nettoyage/migration, l'utilisation normale devrait tourner autour de 2,5–3,5 Go**
(dépendances + un seul build + système), à condition qu'aucun artefact de déploiement antérieur ne
s'accumule et que `/tmp` soit vide entre deux ingestions CTD.

---

## 2. Disk usage actuel — comment relever les vrais chiffres

Script fourni : **`scripts/audit-disk.sh`**. Lecture seule, aucune commande destructrice
(ni `rm`, ni `truncate`, ni `VACUUM`).

```bash
bash scripts/audit-disk.sh
```

Il rapporte, dans l'ordre : les systèmes de fichiers montés (pour identifier ce que mesure le
graphique Render), l'existence ou non d'un disque persistant, le top 25 des dossiers de
l'application, les suspects habituels, **`/tmp` en détail** (avec les préfixes créés par le
logiciel), les fichiers de plus de 50 Mo, les logs sur disque, **la taille de PostgreSQL comptée à
part**, et les inodes.

---

## 3. Top consommateurs (analyse statique)

| # | Chemin | Taille | Origine | Fonction | Perm./Temp. | Nécessaire ? | Risque si supprimé |
|---|---|---:|---|---|---|---|---|
| 1 | `node_modules/` | ~1,0 Go | `npm install` | dépendances | permanent (runtime) | **oui** | l'app ne démarre plus |
| 2 | `.next/` | ~870 Mo | `next build` | app compilée | permanent (runtime) | **oui** | l'app ne démarre plus |
| 3 | `.next/cache/` | inclus | cache Next | accélère les rebuilds | temporaire | non | rebuild plus lent seulement |
| 4 | `node_modules/@next` | 276 Mo | build | compilateur/SWC | permanent | oui | build cassé |
| 5 | `node_modules/next` | 104 Mo | runtime | framework | permanent | oui | app cassée |
| 6 | `node_modules/@img` (sharp) | 45 Mo | OCR/images | prétraitement d'images | permanent | oui | OCR dégradé |
| 7 | `node_modules/tesseract.js-core` | 44 Mo | OCR local | moteur OCR de repli | permanent | oui si repli OCR utilisé | plus de repli OCR |
| 8 | `node_modules/@prisma` | 44 Mo | ORM | moteurs de requête | permanent | oui | base inaccessible |
| 9 | `node_modules/date-fns` | 37 Mo | dates | — | permanent | oui | app cassée |
| 10 | `node_modules/pdf-parse` | 35 Mo | extraction PDF | CTD | permanent | oui | extraction PDF cassée |
| 11 | `node_modules/lucide-react` | 33 Mo | icônes | UI | permanent (arborescence secouée au build) | oui | UI cassée |
| 12 | Cache npm `~/.npm` | 0,3–0,8 Go | `npm install` | cache de téléchargement | **temporaire** | **non** | réinstallation plus lente |
| 13 | `/tmp/reg-ctd-*` | 0 → taille du ZIP | assemblage d'archive CTD | upload en parties | **temporaire** | non après ingestion | **voir § 7** |
| 14 | `/tmp/reg-archive-*` | 0 → taille du ZIP | conservation de l'archive | archive originale | **temporaire** | non après écriture | **voir § 7** |
| 15 | `/tmp/amd-ocr-langs` | ~10–30 Mo | cache Tesseract | données de langue fra/eng/ara | temporaire (recréé) | non | premier OCR plus lent |
| 16 | `.git/` | variable | clone | historique | selon déploiement | non en runtime | perte d'historique local |
| 17 | Artefacts de déploiements antérieurs | **inconnu** | Render | — | temporaire | **non** | aucun |
| 18 | Chromium / Playwright | **absent** | — | non installé en prod | — | — | — |
| 19 | Logs sur disque | **aucun** | — | tout part sur stdout | — | — | — |
| 20 | Uploads permanents sur disque | **aucun** | — | tout va en base/objet | — | — | — |

**Points 18, 19, 20 confirmés par lecture du code** : aucun `winston`/`pino` vers fichier, aucun
répertoire `uploads/`, aucune installation Playwright dans `render.yaml`.

---

## 4. Persistent disk vs éphémère

| Question | Réponse |
|---|---|
| Quel volume le graphique Render mesure-t-il ? | Le **système de fichiers de l'instance** (aucun disque persistant déclaré) |
| Mount path du disque persistant | **aucun** — pas de section `disk:` dans `render.yaml` |
| Ce qui est réellement écrit dessus | code déployé, `node_modules`, `.next`, caches, `/tmp` |
| Ce qui survit à un redeploy | **rien** de ce qui est écrit à l'exécution — `/tmp` est reconstruit |
| Ce qui devrait être ailleurs | **rien n'est mal placé** : les documents sont déjà en base/objet |

> **Conséquence rassurante :** un redéploiement remet le compteur à zéro sur tout ce qui est
> transitoire. Si l'occupation retombe nettement après un déploiement, le coupable était bien
> `/tmp` ou un cache, pas des données métier.

---

## 5. Regulatory / OCR — facteur d'amplification disque

C'est **le seul endroit du logiciel qui écrit de gros fichiers locaux**.

### Le chemin d'un dossier CTD

1. **Réception en parties** → `RegulatoryUploadPart.data` (**PostgreSQL**, pas le disque).
2. **Assemblage** → `mkdtemp(tmpdir(), "reg-ctd-")` puis `archive.zip` (**disque éphémère**).
   Écrit **en flux** avec gestion de contre-pression — jamais l'archive entière en RAM.
3. **Ingestion** → lecture **en flux** (`yauzl`, une entrée à la fois).
4. **Conservation de l'archive** → `mkdtemp(tmpdir(), "reg-archive-")`, puis écriture vers
   FileBlob (base ou objet).
5. **Rendu d'images / OCR** → **en mémoire** (`sharp(...).toBuffer()`), **jamais sur disque**.

### Amplification pour un dossier de 500 Mo

| Étape | Disque | Base |
|---|---:|---:|
| Parties reçues | — | ~500 Mo (temporaire) |
| Assemblage `/tmp/reg-ctd-*` | **~500 Mo** | — |
| Conservation `/tmp/reg-archive-*` | **~500 Mo** | — |
| Contenu extrait | — | selon les pièces retenues |
| Images OCR | **0** (mémoire) | — |
| Blob final | — | ~500 Mo (ou bucket) |

**Facteur d'amplification disque ≈ ×1 à ×2 de la taille de l'archive**, transitoirement.
Un dossier de 500 Mo peut donc occuper **~1 Go de disque éphémère** pendant l'ingestion, et
**~1 Go de base** (parties + blob) avant nettoyage des parties.

> Un ZIP de **1,6 Go** (cas cité) mobilise donc jusqu'à **~3,2 Go de disque éphémère** et autant en
> base pendant l'opération. Sur 10 Go, **deux ingestions simultanées de cette taille suffisent à
> saturer** — c'est le scénario de rupture le plus probable, bien avant l'accumulation lente.

---

## 6. FileBlob / PostgreSQL / Supabase — les trois ne doivent pas être confondus

| Contenu | A. Disque Render | B. PostgreSQL | C. Objet (Supabase/R2) |
|---|:--:|:--:|:--:|
| Métadonnées (`FileBlob.sha256`, `size`, `iv`) | — | **✔ toujours** | — |
| Petits blobs (`FileBlob.data`) | — | **✔ si `S3_*` absent** | ✔ si configuré |
| Gros blobs (`FileBlobChunk.data`, tranches ~16 Mio) | — | **✔ si `S3_*` absent** | ✔ si configuré |
| Parties d'upload CTD (`RegulatoryUploadPart.data`) | — | **✔ toujours** (transitoire) | — |
| Drive (fichiers + versions) | — | ✔ ou | ✔ |
| Archives CTD originales | *temporaire seulement* | ✔ ou | ✔ |
| Pièces jointes des modules | — | ✔ ou | ✔ |

**Mécanisme déjà en place :** `FileBlob.storageKey` non nul ⇒ le contenu chiffré est **dans le
bucket**, la base ne garde que les métadonnées. Le basculement se fait par variables `S3_*` — et
**Supabase Storage étant S3-compatible, aucun développement n'est nécessaire pour l'activer.**
Le bucket ne reçoit que du **chiffré** (AES-GCM) ; il ne voit jamais le clair.

**Ce qui doit partir vers Supabase :** tous les blobs actuellement en base (`storageKey IS NULL`).
Le script du § 2 en donne le compte et le volume exacts.

---

## 7. Fichiers temporaires — fuites potentielles

Recensement exhaustif des écritures disque du code (hors tests) :

| Emplacement | Créé où | Nettoyé | Garanti ? | En cas d'exception | Orphelins possibles |
|---|---|---|---|---|---|
| `/tmp/reg-ctd-*` | `upload/session.ts:374` | `rm(tmpDir, recursive)` | **✔ `finally`** | nettoyé | non |
| `/tmp/reg-archive-*` | `ingest-dossier.ts:359` | `rm(kept.dir)` | **✔ `finally`** (dans la file d'écriture) | nettoyé | **⚠ voir ci-dessous** |
| `/tmp/amd-ocr-langs` | `ocr/lang-data.ts:21` | jamais | — (cache voulu) | — | non (borné, ~10–30 Mo) |

### ⚠ La seule fuite disque réelle identifiée

`ingest-dossier.ts` déplace l'archive dans `/tmp/reg-archive-*` puis **diffère** son écriture via
`enqueueArchive(...)`. Le `finally` qui supprime le répertoire vit **dans la tâche différée**. Si
le **processus s'arrête entre les deux** (redéploiement, OOM, arrêt d'instance), le répertoire
survit — jusqu'au prochain redéploiement, qui recrée `/tmp`.

- **Gravité : FAIBLE** — `/tmp` étant éphémère, un redéploiement efface la fuite.
- **Mais** sur une instance longue-durée traitant plusieurs gros dossiers, ces résidus
  s'accumulent et peuvent expliquer une occupation qui monte sans raison apparente.
- **Fuite BASE, plus sérieuse :** `RegulatoryUploadPart` n'est purgé qu'en cas de **succès**
  (`session.ts:411`). Une session **abandonnée** (onglet fermé, échec) laisse ses parties en base.
  Le script du § 2 les compte par statut.

---

## 8. Logs / cache / build

| Vérification | Résultat |
|---|---|
| Logs écrits dans des fichiers | **aucun** — tout part sur stdout (capté par Render) |
| Dossier `logs/`, `*.log`, dumps, crash reports | **aucun** dans le code |
| `.next/cache` sur un disque persistant | sans objet (pas de disque persistant) |
| `node_modules` sur un disque persistant | sans objet |
| Playwright / Chromium en production | **non installé** (absent de `render.yaml`) |
| Cache npm | présent sur l'instance, **récupérable** |

---

## 9. Croissance et délai avant saturation

| Source | Taille actuelle | Croissance | Dépend de | Risque 10 Go |
|---|---|---|---|---|
| `node_modules` + `.next` | ~1,9 Go | ~stable | ajout de dépendances | faible |
| Cache npm | 0,3–0,8 Go | par déploiement | fréquence des déploiements | **moyen** |
| Artefacts de déploiements antérieurs | inconnu | par déploiement | rétention Render | **à vérifier en priorité** |
| `/tmp` pendant une ingestion CTD | 0 → 2× la taille du ZIP | par pic | taille et concurrence | **ÉLEVÉ (pic)** |
| Base PostgreSQL (blobs) | à mesurer | linéaire avec les dépôts | volume documentaire | élevé à terme (**base**, pas disque) |

**« Combien de temps avant saturation ? »** — La question est mal posée pour ce disque :
l'occupation n'est **pas cumulative** (tout est éphémère et remis à zéro au déploiement). Le vrai
risque est un **pic** : deux ingestions CTD simultanées de 1,5 Go saturent les 10 Go en quelques
minutes. En revanche, **la base PostgreSQL, elle, croît vraiment** — c'est là que la limite se
posera, et c'est précisément ce que Supabase Storage vient résoudre.

> Estimation **approximative** : faute de mesures de production, la vitesse de croissance de la base
> ne peut pas être chiffrée ici. Le script du § 2 donne le point de départ.

---

## 10. Ce qui doit migrer vers Supabase

1. **Tous les `FileBlob` avec `storageKey IS NULL`** — le mécanisme existe déjà, il suffit de
   configurer `S3_*` sur le bucket Supabase et de faire basculer l'existant.
2. **Les nouveaux blobs** basculent automatiquement dès que `S3_*` est renseigné.
3. **Restent en base à dessein** : métadonnées (`sha256`, `size`, `iv`, `refCount`) — quelques
   octets par fichier, indispensables à la déduplication et au déchiffrement.
4. **Restent transitoirement sur Render** : `/tmp` pendant une ingestion CTD. C'est légitime, à
   condition de purger.

---

## 11. Espace récupérable immédiatement

| Poste | Récupérable | Risque |
|---|---:|---|
| Cache npm | 0,3–0,8 Go | aucun (réinstallation plus lente) |
| `.next/cache` | variable | aucun (rebuild plus lent) |
| Artefacts de déploiements antérieurs | **inconnu — sans doute le plus gros gisement** | aucun |
| `/tmp/reg-archive-*` résiduels | taille des ZIP concernés | aucun si aucune ingestion en cours |
| Parties d'upload abandonnées (**base**) | à mesurer | aucun si la session est morte |

**Le geste le plus efficace et le plus sûr reste un simple redéploiement** : il remet à zéro tout
l'éphémère, sans toucher à la moindre donnée.

---

## 12. Recommandations classées

### 🔴 CRITIQUE
1. **Lancer `scripts/audit-disk.sh` en production.** Tout ce document repose sur une analyse
   statique ; les proportions réelles doivent être confirmées avant toute action.
2. **Encadrer le pic d'ingestion CTD.** Deux gros dossiers simultanés saturent les 10 Go. À
   décider : sérialiser les ingestions, ou refuser au-delà d'un espace libre minimal.

### 🟠 IMPORTANT
3. **Configurer Supabase Storage (`S3_*`).** Aucun développement requis — le code sait déjà
   déporter le chiffré. C'est ce qui empêchera la base de gonfler.
4. **Purger les parties d'upload abandonnées** (`RegulatoryUploadPart` des sessions non
   `COMPLETED`), avec un TTL de 24–48 h. Fuite en **base**, pas sur disque.
5. **Balayer `/tmp/reg-*` au démarrage** de l'instance : effacer les résidus antérieurs au
   processus courant referme la fuite du § 7 sans risque (aucune ingestion en cours ne peut leur
   appartenir).

### 🟡 FAIBLE
6. Vérifier la rétention des builds Render (souvent le premier gisement).
7. Envisager `npm ci --omit=dev` en production si le build le permet.
8. Le cache OCR (~10–30 Mo) est borné et légitime : le laisser.

### Réponses aux questions posées
- **Faut-il encore un disque persistant Render pour le documentaire ?** **Non.** Il n'y en a pas
  aujourd'hui et le stockage documentaire n'en a pas besoin : base + objet suffisent.
- **Quels fichiers supprimer après traitement ?** Ceux du § 7 — déjà nettoyés, sauf la fenêtre
  d'arrêt brutal.
- **Un job de nettoyage automatique est-il nécessaire ?** **Oui, pour la base** (parties
  abandonnées, blobs `refCount = 0`), pas pour le disque.

---

## 13. Risques

| Risque | Probabilité | Impact |
|---|---|---|
| Saturation par pic d'ingestion CTD | moyenne | **service interrompu** |
| Croissance de la base par blobs non déportés | élevée | limite Postgres atteinte |
| Résidus `/tmp` après arrêt brutal | faible | occupation lente |
| Parties d'upload abandonnées en base | moyenne | base gonflée sans contenu utile |
| Suppression hâtive de `node_modules`/`.next` | — | **service cassé** ⚠ |

---

## 14. Plan de correction (à autoriser — RIEN N'A ÉTÉ FAIT)

1. Lancer `scripts/audit-disk.sh` et reporter les chiffres réels dans ce document.
2. Confirmer l'absence de disque persistant dans le tableau de bord Render.
3. Configurer `S3_*` sur Supabase Storage ; vérifier qu'un nouveau dépôt écrit bien dans le bucket.
4. Faire basculer les blobs existants (`storageKey IS NULL`) — opération à part, sur autorisation.
5. Ajouter le TTL des parties d'upload abandonnées.
6. Ajouter le balayage de `/tmp/reg-*` au démarrage.
7. Encadrer la concurrence des ingestions CTD.

> **Aucun fichier n'a été supprimé. Aucune base n'a été vidée ni « vacuumée ». Aucun blob n'a été
> migré. Aucun cache n'a été purgé. Aucun réglage disque n'a été modifié.**
> Audit strictement en lecture seule, conformément à la consigne — dans l'attente de votre feu vert.
