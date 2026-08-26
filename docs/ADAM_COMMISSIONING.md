# Mise en service d'Adam — ce qui reste à faire de vos mains

Tout le travail de code est fait et poussé. Ce qui suit ne peut PAS être fait depuis le dépôt :
ce sont des gestes dans des consoles auxquelles je n'ai pas accès (Google Cloud, Render). Chaque
ligne dit **où**, **quel champ exact**, **quelle valeur**, **pourquoi**, et **comment vérifier**.

Comptez **30 à 45 minutes**, une seule fois.

À tout moment, la commande qui dit où vous en êtes :

```bash
npm run adam:doctor
```

Elle répond depuis le serveur qui tourne — pas depuis un panneau de configuration où tout paraît
rempli. Elle n'affiche **aucun secret**, même tronqué : sa sortie se colle dans un message sans
avoir à la relire.

---

## Étape 1 — Créer l'identifiant OAuth de Google *(obligatoire)*

**Où** : [console.cloud.google.com](https://console.cloud.google.com) → votre projet → **APIs et
services** → **Identifiants** → **Créer des identifiants** → **ID client OAuth** → type
**Application Web**.

| Champ exact | Valeur exacte |
|---|---|
| Nom | `AMD Internal OS — Adam` |
| Origines JavaScript autorisées | `https://<votre-domaine-render>` |
| **URI de redirection autorisés** | `https://<votre-domaine-render>/api/google/callback` |

⚠️ L'URI de redirection doit être **au caractère près** celle que vous mettrez dans
`GOOGLE_REDIRECT_URI` à l'étape 3. Google compare la chaîne exacte : une barre oblique finale en
trop suffit à faire échouer la connexion, avec un message peu parlant.

**Activez ensuite ces API** (APIs et services → Bibliothèque) : **Gmail API**, **Google Calendar
API**, **Google Drive API**, **Google Docs API**, **Google Sheets API**, **Google Slides API**,
**People API**.

**Pourquoi** : sans identifiant OAuth, Adam n'a aucun moyen de demander l'accès à la boîte — il
n'y a même pas de bouton à cliquer.

**Comment vérifier** : Google affiche un **ID client** et un **secret client**. Gardez-les pour
l'étape 3.

---

## Étape 2 — Publier l'écran de consentement *(obligatoire)*

**Où** : Console Google Cloud → **APIs et services** → **Écran de consentement OAuth**.

- Type d'utilisateur : **Externe** (une adresse `@gmail.com` n'appartient pas à un domaine Workspace).
- Ajoutez l'adresse d'Adam en **utilisateur test** si vous restez en mode Test.
- Pour un usage durable : **Publier l'application**.

**Pourquoi** : en mode Test non publié, Google **révoque les jetons au bout de 7 jours**. Adam se
déconnecterait tout seul chaque semaine, sans erreur visible — juste un silence.

**Comment vérifier** : l'écran indique « En production ». Sinon, notez de reconnecter chaque
semaine.

---

## Étape 3 — Poser les variables sur Render *(obligatoire)*

**Où** : [dashboard.render.com](https://dashboard.render.com) → service **amd-internal-os** →
**Environment** → **Add Environment Variable**.

| Nom exact | Valeur exacte | Obligatoire |
|---|---|---|
| `GOOGLE_CLIENT_ID` | l'ID client de l'étape 1 (finit par `.apps.googleusercontent.com`) | **oui** |
| `GOOGLE_CLIENT_SECRET` | le secret client de l'étape 1 | **oui** |
| `GOOGLE_REDIRECT_URI` | `https://<votre-domaine-render>/api/google/callback` | **oui** |
| `GOOGLE_ADAM_EMAIL` | l'adresse Gmail d'Adam, en minuscules | fortement conseillé |
| `AUTH_SECRET` | déjà présent (généré par Render) | **oui** |

`GOOGLE_ADAM_EMAIL` n'est pas décoratif : c'est lui qui fait **refuser et révoquer** un
consentement donné par erreur depuis un autre compte Google. Sans lui, la première boîte
connectée fait foi — et si ce n'est pas la bonne, Adam lit le courrier de quelqu'un d'autre et
écrit en son nom.

**Comment vérifier** : après redéploiement, `npm run adam:doctor` affiche
`[ OK ] identifiants OAuth présents` et `compte attendu verrouillé par GOOGLE_ADAM_EMAIL`.

---

## Étape 4 — Connecter le compte, depuis l'écran *(obligatoire)*

**Où** : dans l'application → **My Chief of Staff** → **Réglages d'Adam** →
**Connecter le compte Google**.

Connectez-vous avec **l'adresse d'Adam**, acceptez les droits demandés.

**Pourquoi** : c'est le seul moment où un humain doit être dans la boucle — un consentement OAuth
passe par un navigateur, une conversation ne peut pas le porter.

**Comment vérifier** : la page affiche l'adresse connectée et **« Opérationnel »** ou
**« Dégradé »**. Si elle affiche `erreur=mauvais-compte`, c'est le verrou de l'étape 3 qui a fait
son travail : le consentement a déjà été révoqué, recommencez avec la bonne adresse.

---

## Étape 5 — Le push Gmail temps réel *(optionnel mais recommandé)*

Sans cette étape, Adam **fonctionne quand même** : la réconciliation périodique relève la boîte à
chaque battement du planificateur. Vous perdez seulement l'immédiateté — quelques minutes de
retard au lieu de quelques secondes.

**5a. Créer le sujet** — Console Google Cloud → **Pub/Sub** → **Sujets** → **Créer un sujet**.

| Champ | Valeur |
|---|---|
| ID du sujet | `adam-gmail` |

**5b. Autoriser Gmail à publier** — sur le sujet créé → onglet **Autorisations** → **Ajouter un
compte principal** :

| Champ exact | Valeur exacte |
|---|---|
| Nouveaux comptes principaux | `gmail-api-push@system.gserviceaccount.com` |
| Rôle | `Pub/Sub Publisher` |

Sans cette autorisation précise, Gmail refuse d'armer la veille — c'est l'oubli le plus fréquent.

**5c. Créer l'abonnement** — **Pub/Sub** → **Abonnements** → **Créer un abonnement** :

| Champ exact | Valeur exacte |
|---|---|
| ID de l'abonnement | `adam-gmail-push` |
| Sujet | `adam-gmail` |
| Type de distribution | **Push** |
| URL du point de terminaison | `https://<votre-domaine-render>/api/google/pubsub?token=<UN_SECRET_LONG>` |
| Activer l'authentification | **coché** |
| Compte de service | celui que vous choisissez (notez son adresse) |

Générez `<UN_SECRET_LONG>` avec `openssl rand -hex 32` — une valeur au hasard, longue, gardée
secrète.

**5d. Trois variables de plus sur Render** :

| Nom exact | Valeur exacte |
|---|---|
| `GOOGLE_PUBSUB_TOPIC` | `projects/<ID-DU-PROJET>/topics/adam-gmail` |
| `GOOGLE_PUBSUB_TOKEN` | le `<UN_SECRET_LONG>` de l'URL ci-dessus, **à l'identique** |
| `GOOGLE_PUBSUB_SERVICE_ACCOUNT` | l'adresse du compte de service de l'étape 5c |

**Pourquoi deux preuves** : ce point d'entrée est **public** — Google n'a pas de session. Le
secret dans l'URL écarte le bruit de fond ; le jeton signé par Google (vérifié pour de vrai,
signature comprise) prouve l'origine. L'un sans l'autre laisserait une porte ouverte sur
Internet.

**5e. Armer la veille** : Réglages d'Adam → **Réarmer la veille Gmail**.

**Comment vérifier** : la page affiche « armée jusqu'au … » (environ 7 jours). Le renouvellement
est ensuite automatique, un jour et demi avant l'échéance. `npm run adam:doctor` affiche
`[ OK ] veille Gmail armée`.

---

## Étape 6 — Vérifier, et seulement alors faire confiance

```bash
npm run adam:doctor
```

Visez **zéro ÉCHEC**. Une alerte est acceptable et le dit (« pas de push, la réconciliation prend
le relais »).

Puis, dans la conversation :

1. « **Adam, tu es connecté ?** » → il décrit son état réel, pas une formule.
2. Envoyez-vous un message depuis une autre adresse, attendez une minute, puis :
   « **Qu'est-ce que j'ai reçu ?** » → il doit le citer sans que vous ayez à dire « regarde tes mails ».
3. « **Prépare un message à \<quelqu'un\> pour lui dire bonjour.** » → il prépare, et **n'envoie pas**.
4. « **Envoie.** » → là seulement le message part, et vous recevez le reçu.

Si le point 3 envoie sans vous demander, **arrêtez tout** : Réglages d'Adam →
**Suspendre l'envoi**, et dites-le moi. Ce cas est couvert par 13 tests d'intégration et
16 tests adverses, mais c'est le genre de chose qu'on vérifie de ses yeux.

---

## Ce qui est déjà réglé, et que vous n'avez pas à faire

- **Aucune manipulation de base.** Les migrations sont appliquées par le déploiement.
- **Politique d'envoi** : `REQUIRE_APPROVAL` par défaut. Aucun geste pour l'obtenir.
- **Chiffrement des jetons** : au repos, avec la clé déjà présente sur Render.
- **Renouvellement de la veille** : automatique, avant expiration.
- **Reprise après incident** : trois filets — histoire incrémentale, liste récente si Google a
  purgé l'historique, réconciliation périodique.
- **Mémoire du build** : bornée et surveillée (`npm run build:measure`).

---

## Les commandes utiles, une fois en service

| Commande | Ce qu'elle fait |
|---|---|
| `npm run adam:doctor` | État complet, avec le geste exact pour chaque échec |
| `npm run build:measure` | Pic mémoire d'un build propre (garde anti-OOM) |
| `npm test` | Toute la suite, dont les tests de la frontière d'envoi |

Et dans l'application : **/chief-of-staff/reglages** pour le PDG (est-ce que ça marche ?),
**/admin/ai** pour l'exploitation (pourquoi ça ne marche pas ?).
