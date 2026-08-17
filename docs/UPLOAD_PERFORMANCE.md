# Téléversement d'un gros dossier CTD — ce qui a été fait, et ce que la physique autorise

_Réf. demande : « J'ai un zip de 1.600.000 Ko mais il prend plusieurs minutes à se téléverser, je
veux qu'il se téléverse très rapidement en moins de 10 secondes ! Trouve la technologie nécessaire
pour le faire ! »_

---

## 1. L'arithmétique, d'abord

1,6 Go en 10 secondes, c'est **160 Mo/s soutenus**, soit **~1,3 Gbit/s de débit MONTANT** entre le
poste et le stockage, sans interruption.

| Débit montant du poste | Temps incompressible pour 1,6 Go |
| --- | --- |
| 10 Mbit/s | ~21 min |
| 50 Mbit/s | ~4 min 15 |
| 100 Mbit/s | ~2 min 8 |
| 500 Mbit/s | ~26 s |
| 1 Gbit/s | ~13 s |
| 1,3 Gbit/s | ~10 s |

**Aucune technologie ne fait passer 1,6 Go dans un tuyau qui ne les laisse pas passer.** Les
10 secondes ne sont atteignables que sur une liaison montante de l'ordre du gigabit. Ce que la
technologie peut faire — et c'est ce qui a été fait — c'est **supprimer tout ce qui empêchait
d'utiliser le débit réellement disponible**, et il y en avait beaucoup.

## 2. Ce qui ralentissait, et ce qui a changé

| Avant | Après |
| --- | --- |
| Les octets traversaient **l'application** puis **PostgreSQL** (une ligne `bytea` par tranche de 4 Mo), puis étaient **relus** pour reconstituer l'archive. Trois écritures pour un fichier. | Les octets vont **du navigateur au bucket**, directement. Ni le serveur ni la base ne sont sur le chemin. |
| Quand le stockage objet était configuré : **un seul PUT** de 1,6 Go. Un flux TCP unique n'utilise qu'une fraction du lien (sa fenêtre de congestion met des dizaines de secondes à s'ouvrir, et le moindre paquet perdu la divise par deux). | **Téléversement en plusieurs parties**, 32 Mo chacune, **6 en vol simultanément**. Plusieurs flux saturent le lien là où un seul plafonne. |
| Une coupure réseau à 90 % = **tout est à refaire**. | Une coupure ne coûte **qu'une partie** (32 Mo), retentée seule avec attente croissante. |
| Un envoi abandonné laissait ses tranches en base **indéfiniment**. | L'annulation libère les parties côté bucket (`AbortMultipartUpload`) et côté base. |

Ordre de grandeur observé sur ce type de bascule : le multipart parallèle donne **3 à 5 fois** le
débit d'un flux unique sur une liaison à latence normale, et davantage encore quand la latence est
élevée. Le chemin « base de données » était, lui, plafonné bien en deçà du lien.

## 3. Ce qu'il faut configurer pour que ce chemin s'active

Le mode rapide ne s'active **que si un stockage objet S3-compatible est configuré**. Sans lui,
l'application retombe sur l'envoi résumable en base — plus lent, mais fonctionnel.

### 3.1 Variables d'environnement (côté serveur uniquement)

```
S3_ENDPOINT=https://<compte>.r2.cloudflarestorage.com     # ou https://<ref>.supabase.co/storage/v1/s3
S3_BUCKET=<nom-du-bucket>
S3_ACCESS_KEY_ID=<clé>
S3_SECRET_ACCESS_KEY=<secret>
S3_REGION=auto
```

Aucun de ces noms ne doit être préfixé `NEXT_PUBLIC_` : les secrets restent côté serveur, et le
navigateur ne reçoit que des URL présignées, valables pour une opération et une durée limitée.

### 3.2 Règle CORS du bucket — **le point qui fait tout échouer si on l'oublie**

Le navigateur doit pouvoir écrire dans le bucket **et lire l'en-tête `ETag`** de chaque partie :
c'est cette empreinte qui permet de recoller le fichier. Sans `ExposeHeaders: ETag`, les parties
montent correctement… et la finalisation est impossible.

```json
[
  {
    "AllowedOrigins": ["https://<votre-domaine>"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

L'application le dit explicitement si le cas se présente : « le stockage n'expose pas l'en-tête
ETag (règle CORS « ExposeHeaders: ETag » manquante) ».

### 3.3 Réglages facultatifs

| Variable | Défaut | Effet |
| --- | --- | --- |
| `REG_DIRECT_PART_MB` | `32` | Taille d'une partie en envoi direct. Minimum imposé par S3 : 5 Mio. |
| `REG_DIRECT_CONCURRENCY` | `6` | Parties en vol simultanément. Au-delà de ~8, on sature surtout la mémoire du navigateur. |

⚠️ Ne pas confondre avec `REG_UPLOAD_PART_MB` (4 Mo), qui règle le chemin **résumable en base** :
là, grossir les parties **ralentit** (mesures dans `session.ts`). Les deux réglages vont en sens
inverse parce qu'ils n'ont pas le même goulot.

## 4. Comment vérifier le gain, chiffres en main

À chaque envoi direct multipart, la console du navigateur imprime la mesure réelle :

```
[upload] 1526 Mo en 47.3 s — 32.3 Mo/s (48 parties × 6 en parallèle)
```

C'est le chiffre à comparer au débit montant de la ligne (test de débit classique). S'ils
coïncident, **le lien est saturé et il n'y a plus rien à gagner côté logiciel** : le temps restant
est celui du tuyau.

## 5. Ce qui reste possible si les 10 secondes sont un vrai besoin

Par ordre de rapport résultat / effort :

1. **Vérifier le débit montant réel du site.** C'est la seule variable qui compte au premier ordre.
   Un raccordement fibre professionnel symétrique change tout ; aucun logiciel ne le remplace.
2. **Choisir une région de stockage proche.** Un bucket en Europe pour un poste à Alger, c'est
   ~40 ms d'aller-retour ; un bucket à l'autre bout du monde en coûte 250, et la latence pèse sur
   l'ouverture de chaque partie.
3. **Ne pas envoyer ce qui est déjà là.** L'empreinte du fichier est déjà calculée et transmise :
   un dossier redéposé à l'identique peut être reconnu sans qu'un octet reparte. C'est le seul
   moyen d'atteindre « moins de 10 secondes » indépendamment du débit — mais uniquement pour un
   contenu déjà connu.
4. **Compresser mieux en amont.** Un CTD est déjà majoritairement du PDF (peu compressible) ; le
   gain est réel surtout quand l'archive contient des images non optimisées.
