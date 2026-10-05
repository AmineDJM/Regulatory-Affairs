## 🗄️ Stockage des fichiers — S3-compatible (Supabase Storage)

**Le protocole, pas le fournisseur.** La couche de stockage parle **S3** : Supabase Storage,
Cloudflare R2, AWS S3, MinIO ou Backblaze répondent tous à la même interface. Il n'y a **aucun SDK
propriétaire** — les signatures AWS SigV4 sont calculées avec le crypto natif de Node. Changer de
fournisseur, c'est changer des variables d'environnement, pas du code.

**Ce qui part dans le bucket, et ce qui reste en base.** Les octets sont chiffrés **AES-256-GCM
avant de quitter le serveur**, puis dédupliqués par l'empreinte SHA-256 du **clair**. Le bucket ne
reçoit **jamais** que du chiffré : il porte les octets, il ne remplace pas la sécurité applicative.
La base conserve toujours les métadonnées (empreinte, taille, **IV**, compteur de références) —
sans elle, le contenu du bucket est inexploitable.

**Les permissions ne passent jamais par le bucket.** Il est **privé**. Aucun téléchargement ne se
fait par une URL d'objet : tout passe par les routes de l'application, qui appliquent le RBAC, le
cloisonnement par entité, les partages Drive et les droits Regulatory/CTD, puis journalisent
l'accès. Les seules URL présignées émises sont des **PUT à durée de vie courte**, pour que le
navigateur envoie une archive volumineuse directement au bucket — jamais des URL de lecture.

**Gros fichiers.** Trois chemins, selon la situation :
- **navigateur → bucket** en direct (URL présignée) pour les dossiers CTD : ni le serveur ni
  Postgres ne voient passer les octets ;
- **serveur → bucket en plusieurs parties** (16 Mio) dès qu'un contenu dépasse 32 Mo : le pic
  mémoire vaut une partie, qu'il s'agisse d'un PDF de 2 Mo ou d'une archive d'un gigaoctet.
  Les parties partent **en parallèle** (4 en vol par défaut, `S3_UPLOAD_CONCURRENCY`) : envoyées
  une par une, elles additionnaient leurs allers-retours et n'utilisaient jamais le débit
  disponible — un fichier de 500 Mo payait 31 attentes en série pour rien. L'ordre des ETags suit
  les **numéros de partie**, pas l'ordre des réponses (`uploadPartsBounded`, testé) ;
- **base, en tranches ordonnées**, quand le stockage objet n'est pas configuré.

**Repli et pannes.** Les fichiers déjà stockés en base **restent lisibles** quoi qu'il arrive : la
lecture choisit sa source d'après l'enregistrement (objet, valeur unique, ou tranches). En revanche,
si le stockage objet est configuré mais refuse d'écrire, l'enregistrement **échoue franchement** —
pas de repli discret vers la base, qui fabriquerait des blobs gigantesques dans Postgres à l'insu de
tout le monde jusqu'à saturer son disque. L'utilisateur voit un message clair, rien n'est corrompu.

⚠️ **`S3_ENDPOINT` doit porter le CHEMIN de l'API S3, pas seulement l'hôte.** Chez R2, AWS ou MinIO
l'endpoint est un hôte nu ; chez **Supabase**, l'API S3 vit sous `/storage/v1/s3` — la variable
s'écrit donc `https://<ref>.storage.supabase.co/storage/v1/s3`. Ce préfixe fait partie de
l'adresse : sans lui, **chaque écriture répond 404** alors que les clés, le bucket et la région
sont parfaitement bons. `hostAndPath` le conserve (testé sur les deux formes d'endpoint), le
diagnostic l'affiche, et un 404 dit maintenant sur quel chemin il a été obtenu.

**Vérifier ce que voit le SERVEUR** (shell de l'hébergeur, à la racine du dépôt) :
`npm run storage:check`. Il dit si la configuration est lisible **par le processus**, sous quels
noms (`S3_*` ou `REG_S3_*`), et **nomme ce qui manque**. « Les variables sont renseignées dans le
panneau » ne prouve rien : une variable ajoutée après le dernier déploiement, posée sur un autre
service, ou un conteneur non redémarré donnent un panneau vert et un `null` côté code. **Aucun
secret n'est affiché**, jamais — seulement des noms de variables, l'hôte, le bucket et la région.

**Vérifier que l'accès marche vraiment** : Administration → Stockage objet → **Tester la connexion**. Le test
écrit un objet dans un préfixe dédié (`_selftest/`), le relit, compare son contenu octet pour octet
et le supprime. « Les variables sont renseignées » ne prouve rien : un bucket mal nommé, une clé
périmée ou une région fausse donnent la même page verte. Aucun secret n'apparaît dans le rapport ni
dans les journaux.

**Le bucket est le stockage PAR DÉFAUT dès qu'il est configuré.** Il n'y a pas de bascule à
actionner ni de réglage à cocher : si `S3_ENDPOINT`/`S3_BUCKET`/les clés sont présents, tout
nouveau contenu part dans le bucket (`objectStorageConfigured()`), et la base ne reçoit plus
d'octets. Retirer les variables ramène au stockage en base — pour les **nouveaux** fichiers
seulement ; ceux déjà dans le bucket continuent d'être lus depuis le bucket.

**Migration de l'historique** (à faire **séparément**, quand la connexion est validée en
production) : `npm run blobs:migrate-r2` déplace vers le bucket le contenu des blobs déjà en base
et bascule leur `storageKey`. Il traite les **deux** formes de stockage en base — la valeur unique
(`FileBlob.data`) *et* les **tranches** (`FileBlobChunk`, au-delà de 16 Mo), c'est-à-dire justement
les plus gros fichiers : les oublier reviendrait à migrer le menu fretin et à laisser la base
pleine. Les gros blobs sont poussés **en flux**, tranche par tranche (mémoire bornée). Un blob
illisible est signalé et sauté, sans arrêter les autres. Le script est **idempotent** et se relance
sans risque. Rien n'est supprimé de Postgres automatiquement : l'espace n'est rendu au disque
qu'après un `VACUUM FULL "FileBlob", "FileBlobChunk";`, à lancer à la main. Tant que le script n'a
pas tourné, anciens et nouveaux fichiers coexistent sans incident.

---

