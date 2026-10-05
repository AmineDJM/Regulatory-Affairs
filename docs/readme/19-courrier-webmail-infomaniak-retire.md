## 📧 Courrier — webmail Infomaniak (retiré)

> **Retiré de la plateforme** : `/courrier` redirige vers Mon espace, le module n'est plus au menu et son back-end
> IMAP/SMTP reste dormant (`app/(app)/courrier/page.tsx`). La messagerie e-mail est désormais **Microsoft 365**
> (`/messagerie`, Pilotage — drapeau `MICROSOFT_MAIL`, configuration Entra, liste pilote). Ce qui suit décrit
> l'ancien webmail, pour mémoire.

Boîte mail **par utilisateur**, connectée à la plateforme (une seule entité).

- **IMAP** (lecture) + **SMTP** (envoi) via `imapflow` / `nodemailer` / `mailparser`, mot de passe d'application
  **chiffré AES-256-GCM** au repos (`MailAccount`).
- ⚡ **Connexion IMAP réutilisée (pool par compte, `withImap`)** : la boîte reste connectée entre deux actions
  (TTL ~90 s) au lieu de se reconnecter (TLS + login) à **chaque** lecture / actualisation / ouverture — chargement
  quasi instantané, et **moins** de « too many connections » (c'est l'ouvrir/fermer en rafale qui les provoque).
- 🧯 **Robustesse anti « command failed »** (IP partagée de l'hébergeur) : **plafond global** de connexions IMAP
  simultanées tous comptes confondus (`MAIL_MAX_CONCURRENCY`, file d'attente au-delà) + **plafond de connexions
  chaudes** (`MAIL_MAX_POOL`, éviction LRU) → l'IP ne sature jamais les limites Infomaniak ; **revalidation NOOP**
  d'une connexion inactive avant réutilisation ; **réessais à back-off exponentiel** sur erreur transitoire
  (limite de connexions / IP momentanément bloquée) → l'immense majorité se résorbe sans erreur visible.
- 🛡️ **Disjoncteur + cache (solution définitive anti-blocage)** : quand Infomaniak sature (≥ N échecs), un
  **disjoncteur** s'ouvre et on **cesse totalement** de le solliciter pendant un temps de repos
  (`MAIL_BREAKER_COOLDOWN_MS`) — c'est le fait d'insister qui prolonge un blocage IP ; l'IP « refroidit » et se
  débloque seule. Pendant ce temps, la boîte est servie depuis un **cache mémoire** (dernier contenu synchronisé,
  liste + messages déjà ouverts) → l'utilisateur **voit toujours ses mails**, avec un bandeau ambre « dernière
  synchronisation » et **nouvelle tentative automatique**. Le cache frais (`MAIL_CACHE_FRESH_MS`) **fusionne** aussi
  les chargements rapprochés (moins de connexions). Résultat : plus de blocage bloquant, jamais.
- 🎨 **Thème Infomaniak exact** (scopé `.ik-mail` dans `globals.css`, couleurs kMail open-source : rose `#BC0055`
  par défaut ou bleu `#0098FF` au choix, container/statuts exacts) — boutons et états de sélection façon Infomaniak Mail.
- Webmail **3 volets** (dossiers · liste · lecture/composition), aperçu HTML en **iframe sandbox**, **grand écran
  immersif** (superpose l'app **+** plein écran natif du navigateur : on ne voit que l'interface e-mail).
- **Dossiers** commutables : **Réception · Envoyés · Corbeille · Brouillons · Indésirables · Archives**.
- 🔎 **Recherche** plein-texte (IMAP SEARCH sur expéditeur / destinataire / Cc / objet / contenu) — retrouve aussi
  les **correspondants externes** à la société.
- 🎚️ **Filtres** rapides (**Tous / Non lus**), effacement de la recherche en un clic, **limite de mails chargés élevée**.
- ↩️ **Répondre**, **Répondre à tous** (sans se ré-adresser à soi-même), **Transférer** (citation du message d'origine).
- 👥 **Carnet de contacts** (collègues + correspondants récents internes/externes) avec **autocomplétion**.
- 📎 **Pièces jointes** : **à l'envoi** (bouton « Joindre », multi-fichiers, retrait/tailles, validées comme les
  téléversements Drive/Documents), et **aperçu** des pièces reçues (PDF / image / texte) avant téléchargement ; **« Lier à un dossier »**.
- ✍️ **Signature** personnalisable (bouton « Signature », aperçu en direct) — insérée automatiquement en bas des
  nouveaux messages, réponses et transferts (au-dessus de la citation).
- 🛡️ **Anti double-envoi** (verrou synchrone) ; couche serveur `src/lib/mail.ts`, routes `/api/mail/{messages,message,attachment,contacts}` (auth + scoping).
- 🤖 **Connecté à l'Assistant IA** : lire / résumer / chercher dans **votre** boîte, **rédiger** un e-mail (envoyé après confirmation).

> Par défaut, les serveurs pointent sur `mail.infomaniak.com` (IMAP 993 / SMTP 465) — modifiables par utilisateur.
> Un **endpoint de diagnostic** (admin) classe les erreurs IMAP brutes d'Infomaniak pour un dépannage rapide.

---

