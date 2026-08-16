# Audit — messagerie existante et bascule vers Microsoft 365 / Exchange Online

> Rédigé avant d'écrire une ligne du nouveau module. Objectif : savoir ce qui existe, ce qui mérite
> d'être repris, et ce qui doit disparaître de l'architecture cible.

## 1. Ce qui existe aujourd'hui

### 1.1 Webmail Infomaniak (IMAP / SMTP) — `/courrier`

| Fichier | Rôle | Lignes |
|---|---|---|
| `src/lib/mail.ts` | Couche serveur : chiffrement du mot de passe, pool IMAP, disjoncteur, cache mémoire, lecture, envoi, contacts | 654 |
| `src/lib/actions/mail-actions.ts` | Connecter / déconnecter une boîte, signature, envoi | 93 |
| `src/app/(app)/courrier/mail-client.tsx` | Webmail 3 volets | 603 |
| `src/app/(app)/courrier/{page,connect-mailbox}.tsx` | Écran + formulaire de connexion | 76 |
| `src/app/api/mail/messages/route.ts` | Liste des messages | 27 |
| `src/app/api/admin/mail-diagnostic/route.ts` | Classement des erreurs IMAP brutes | — |
| `prisma` : `MailAccount` | 1 boîte par utilisateur : hôtes IMAP/SMTP, `passwordEnc` | — |

**Statut** : le module **n'est plus dans la navigation** (aucune entrée `/courrier` dans
`NAV_ITEMS`). Le code est là, atteignable par URL, mais il n'est plus proposé.

**Dépendances** : `imapflow`, `nodemailer`, `mailparser` (+ leurs `@types`).

### 1.2 Courrier « smart » (envoi transactionnel par API HTTPS)

`src/lib/mail-smart.ts`, `src/lib/actions/smart-mail-actions.ts`,
`src/app/api/mail/inbound/route.ts`, modèles `OutboundEmail` / `InboundEmail`, écran
`/admin/courrier`.

**Sans rapport avec la messagerie personnelle** : c'est l'envoi *sortant applicatif* (notifications,
courriers générés), volontairement indépendant de SMTP. **On n'y touche pas.**

## 2. Pourquoi l'architecture IMAP ne peut pas être la cible

Ce n'est pas une question de qualité de code — le module Infomaniak est soigné. C'est le **protocole**
qui impose sa forme, et cette forme ne survit pas au passage à Exchange Online :

1. **IMAP est une connexion, pas une API.** D'où le pool, le plafond de connexions simultanées, le
   disjoncteur, la revalidation NOOP, les réessais à back-off. La moitié de `mail.ts` existe pour
   compenser le fait qu'une boîte IMAP se **connecte** au lieu de se **requêter**. Microsoft Graph
   est du HTTPS sans état : tout cet appareillage disparaît.
2. **IMAP n'a pas de synchronisation incrémentale utilisable ici.** On recharge des enveloppes par
   `UID`, d'où le cache mémoire pour ne pas y retourner. Graph a les **delta queries** : on demande
   « ce qui a changé depuis ce jeton » et on obtient exactement cela.
3. **Un mot de passe d'application est stocké** (chiffré, mais stocké). Le cahier des charges exige
   **OAuth uniquement, jamais de mot de passe Microsoft**. Exchange Online désactive d'ailleurs
   l'authentification de base.
4. **Pas de conversation/thread** en IMAP sans reconstruction par en-têtes. Graph rend
   `conversationId` nativement.

**Conclusion** : le nouveau module n'hérite pas de `mail.ts`. Il est écrit à côté, et le legacy est
**isolé**, pas mélangé.

## 3. Ce qui est réutilisé

| Élément repris | D'où | Pourquoi |
|---|---|---|
| **Chiffrement de secret AES-256-GCM** | `encryptSecret` / `decryptSecret` de `mail.ts` | Bon, éprouvé — mais extrait dans `src/lib/crypto/secret-box.ts` pour ne plus dépendre du module IMAP. Sert désormais aux **jetons OAuth**. |
| **UX du webmail 3 volets** | `mail-client.tsx` | La disposition dossiers · liste · lecture est la bonne. Réécrite sur le nouveau modèle de données, pas copiée. |
| **Répondre / Répondre à tous / Transférer** (règles) | `mail-client.tsx` | La règle « ne pas se ré-adresser à soi-même » est juste. Elle est désormais **pure et testée** (`src/lib/mail/reply.ts`). |
| **Aperçu de pièce jointe interne** | `mail-client.tsx` | Aligné sur la politique « les documents restent dans AMD Internal OS ». |
| **Validation des pièces jointes** | `validateDriveUpload` | Déjà partagée avec le Drive : même règle partout. |
| **FileBlob + stockage objet** | `putBlob`, `drive/mirror.ts` | « Enregistrer dans Drive » passe par la couche existante — pas un second stockage. |

## 4. Ce qui est retiré de l'architecture cible

- Aucune dépendance du nouveau module à `imapflow` / `nodemailer` / `mailparser`.
- Aucun usage de `MailAccount` (mot de passe d'application) par le nouveau module.
- Pool, disjoncteur, cache mémoire IMAP : **sans objet** avec Graph.

Le legacy `/courrier` **n'est pas supprimé** dans ce chantier : une migration pilote Infomaniak est
en cours et couper l'ancien accès pendant ce temps serait gratuit. Il est simplement **isolé** —
aucun fichier du nouveau module ne l'importe, et l'inverse est vrai aussi.

## 5. Architecture cible

```
Écrans (React)  ──►  actions / routes  ──►  MailProvider  ──►  MicrosoftGraphMailProvider  ──►  Graph  ──►  Exchange Online
```

- **Aucun composant d'interface n'appelle Graph.** L'interface parle au provider ; le provider parle
  à Graph. Changer de fournisseur un jour = écrire une seconde implémentation.
- **Microsoft reste la source de vérité.** PostgreSQL ne garde que ce qui permet de fonctionner :
  la connexion de la personne, ses jetons chiffrés, les jetons de delta, l'état de synchronisation,
  et les liens vers l'ERP. **Aucune copie des corps de messages ni des pièces jointes.**
- **Isolation par personne** : chaque requête part de `mailConnection.userId = session.userId`.
  L'identifiant de boîte n'est jamais accepté depuis l'URL.

## 6. Modèle de données ajouté

| Modèle | Contenu | Ce qu'il ne contient PAS |
|---|---|---|
| `MailConnection` | 1 par utilisateur : adresse, `homeAccountId`, jetons **chiffrés**, expiration, scopes accordés, état | Aucun mot de passe, aucun jeton en clair |
| `MailFolderState` | par dossier : `deltaLink` chiffré, dernière synchro, compteurs | Aucun message |
| `MailLink` | pièce jointe enregistrée / message associé à un objet ERP : `messageId`, `entityType`, `entityId`, `driveNodeId` | Aucun contenu |

## 7. Sécurité — décisions prises

- **Permissions déléguées uniquement** : `Mail.ReadWrite`, `Mail.Send`, `offline_access`, `openid`,
  `profile`, `User.Read`. Aucune permission d'application (qui donnerait accès à **toutes** les
  boîtes de l'entreprise) — c'est explicitement hors périmètre du pilote.
- **Secrets serveur uniquement**, jamais de `NEXT_PUBLIC_`. Le `client_secret` ne quitte pas Render.
- **Jetons chiffrés au repos** (AES-256-GCM), déchiffrés à l'appel, jamais renvoyés au navigateur.
- **`state` OAuth signé et à durée de vie courte** : sans lui, un tiers peut faire connecter *sa*
  boîte au compte de quelqu'un d'autre (CSRF de connexion).
- **HTML des messages assaini** avant affichage, et rendu en **iframe sandbox** : un mail est du
  contenu envoyé par un inconnu ; c'est la surface d'attaque la plus évidente du module.
- **Aucun contenu de message dans les journaux** — les erreurs portent des identifiants, jamais des
  objets ou des corps.
- **Pièces jointes jamais exécutées** : elles sont servies avec un type neutre et un
  `Content-Disposition` d'attachement, ou ouvertes dans la visionneuse interne.

## 8. Ce qui reste à faire hors de l'application

Créer l'**App Registration** dans Microsoft Entra et poser quatre variables dans Render. Le détail
pas-à-pas est dans le rapport de livraison (section « Ce que vous devez faire dans Microsoft Entra »).
Rien d'autre : aucune modification DNS/MX n'est faite ni demandée par l'application.
