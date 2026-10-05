## 💬 Messagerie interne (temps réel)

- **3 types** : message direct, **groupe** privé, **canal** d'équipe.
- markdown léger, **@mentions**, **réactions**, **réponses citées**, **épinglage**, favoris, édition/suppression,
  **pièces jointes** (Drive chiffré), **présence**, **« en train d'écrire… »**, **accusés de lecture / non-lus**,
  recherche, sourdine, rôles (OWNER/ADMIN/MEMBER).
- 🛡️ **Qui peut retirer un message : trois faits, une seule lecture.** `peutRetirerUnMessage` +
  `peutGererLaConversation` vivent dans `lib/messaging-ui.ts` (module PUR, importable par le navigateur) et sont
  lus par l'action serveur `deleteMessage` **et** par le bouton de l'écran. La règle : un rôle à **vue globale**
  (Super Admin, Direction), l'**auteur** du message, ou quelqu'un qui **gère** la conversation (OWNER/ADMIN).
  L'écran n'en lisait que deux — `canModerate` ignorait la vue globale — donc un Super Admin qui n'était ni
  auteur ni propriétaire du groupe **ne voyait jamais le bouton que l'action aurait accepté**. Qui a **quitté**
  la conversation ne modère plus ses anciens messages (comportement d'origine, préservé et désormais éprouvé).
  Le corps d'un message supprimé **n'est plus servi** (`mapMessage` : `body: ""`, réactions et pièces retirées) ;
  il reste « message supprimé » dans le fil.
- 🗑️ **Supprimer un groupe ou un canal** : `Administration → Messagerie & notifications` (Super Admin),
  par le patron canonique réversible (instantané → corbeille → audit, outil `delete_record` d'Adam compris).
  Un **tête-à-tête est refusé** — c'est l'échange privé de deux personnes. Une restauration rend le groupe
  **vide** (membres et messages partent en cascade), et la confirmation le DIT.
- 🔔 **Notification sonore** à la réception d'un message — un bip généré à la volée (Web Audio API), **débloqué au
  premier geste** de l'utilisateur (politique d'autoplay) et qui **retentit même quand l'onglet AMD est en
  arrière-plan** (vous êtes sur un autre site) grâce au **polling continu**.
- 📎 **Pièces jointes** : un fichier reçu ne se télécharge plus automatiquement au clic — le nom ouvre un **aperçu**
  (inline, nouvel onglet) et une **icône dédiée** permet le **téléchargement explicite**.
- 📁 **Trois façons de joindre**, sous un seul trombone (`composer.tsx`) : des **fichiers** de son
  ordinateur ; un **dossier** de son ordinateur — le navigateur ne sait pas envoyer un dossier, il
  rend ses fichiers à plat, alors on les rassemble en une **archive .zip** nommée d'après le dossier
  (JSZip chargé à la demande) ; et **depuis le Drive**.
- 🔗 **Depuis le Drive — sans recopier.** Le message porte une **référence** au nœud
  (`MessageAttachment.driveNodeId`, `blobId` restant nul) et les destinataires reçoivent un
  **`DriveShare` en LECTURE**. Recopier un contrat de 40 Mo dans cinq conversations stockerait cinq
  copies **et figerait cinq versions** — six mois plus tard, cinq personnes travaillent sur cinq
  fichiers différents et nul ne sait lequel fait foi. La référence ouvre toujours la **version
  courante**. Un **dossier** se partage comme un fichier (une liasse s'envoie d'un geste).
  Le serveur ne croit **rien** de ce que dit le client : il relit nom, taille et type **en base** et
  revérifie par `resolveDriveAccess` que l'expéditeur a réellement accès au nœud. L'octroi passe par
  `skipDuplicates` — poser un `VIEW` par-dessus un `EDIT` existant **retirerait l'édition** à
  quelqu'un en lui envoyant un message. Règles : `src/lib/messaging-attachments.ts` (module pur testé).
- 🚪 Un **partage nominatif ouvre le module Drive** à lui seul (`getAccess`) : sans cela, recevoir un
  document donnait un lien menant à un refus — l'accès existait en base, la porte du module le
  rendait inutile.
- **Types acceptés** : la même règle que le Drive — on refuse les **exécutables**, et rien d'autre.
  La liste blanche étroite d'origine rejetait une vidéo de congrès, un export `.msg`, un `.odt`, un
  `.7z` — que les gens envoyaient donc par WhatsApp, hors de l'outil. La **limite de taille** reste
  celle des pièces jointes (`maxUploadMb`), plus basse que le Drive : une conversation n'est pas un
  espace de stockage.
- **Accès gouverné par l'appartenance** (`ConversationMember`), **jamais** par scope RBAC — **même le Super Admin
  ne lit pas par-dessus l'épaule**. Un tiers non-membre reçoit **403**.
- **Temps réel sans WebSocket** : server actions + **UI optimiste** + **polling**, présence par heartbeat.

---

