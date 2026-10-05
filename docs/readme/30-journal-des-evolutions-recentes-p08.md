  « s'arrêtait » au bout de quelques fichiers). Désormais : **plusieurs fichiers OU un dossier entier**
  (`webkitdirectory`), **tous types** sauf exécutables (`validateDocumentUpload`), **sans limite de nombre**,
  envoyés **en parallèle** (concurrence 4) via une **route en flux** `POST /api/documents/upload` (hors limite des
  Server Actions) → **beaucoup plus rapide**, avec **file d'attente** et état par fichier (⏳/✓/✗ + réessai).
  Logique de persistance partagée `persistUploadedDocument` (`src/lib/documents.ts`). Amélioration **transverse** :
  le composant `DocumentUpload` est partagé par ~15 modules (Regulatory, Demandes, Dossiers, Sponsoring, Congrès,
  Logistique, Finances, Info médicale, RH, Missions…).
- **Lot P** — **Signature e-mail** (`MailAccount.signature`) : éditable depuis le Courrier (bouton « Signature »
  dans la barre latérale, aperçu en direct), **insérée automatiquement** en bas des nouveaux messages, réponses et
  transferts (au-dessus de la citation, curseur au début) — pas de double-ajout côté serveur. **Réunions
  modifiables** : l'organisateur (ou une vue globale) peut **modifier titre, objet, lien, type (vidéo/audio) et
  horaire** d'une réunion non terminée (`updateMeeting`, bouton « Modifier ») ; changer l'horaire **ré-arme** le
  rappel « 30 min avant ». Horaire saisi/affiché à l'heure d'Alger.
- **Lot O** — **Drive : téléchargement dossiers & sélection multiple en ZIP**. Télécharger un **dossier** génère
  désormais une **archive ZIP** de tout son contenu (récursif, arborescence préservée) au lieu d'une erreur ·
  **cases à cocher** sur chaque ligne + « Tout sélectionner » → **« Télécharger (ZIP) »** regroupe plusieurs
  fichiers **et/ou** dossiers en une seule archive (`/api/drive/zip?ids=…`) · accès vérifié sur chaque élément de
  tête (`resolveDriveAccess` + `canViewDrive`), descendants hérités, éléments en corbeille ignorés, garde-fou
  mémoire 800 Mo, journal d'audit `EXPORT`. Pièces jointes d'e-mail : la composition accepte déjà l'ajout de
  fichiers (bouton « Joindre » + validation des limites d'upload).
- **Lot N** — **Compteur d'activité** : pause après **10 min** sans interaction (au lieu de 60 s), reprise au
  mouvement (alimente le score d'adoption) · **Garde anti-capture** (`ScreenGuard`) : flou dissuasif à la détection
  d'une capture (Impr.écran, raccourcis macOS/Windows) et à la perte de focus, **alerte Super Admin** (notification
  + journal d'audit module « Sécurité » : qui, quoi, où). NB : un navigateur ne peut pas *empêcher* une capture —
  couche dissuasive + traçable (blocage dur = app bureau native).
- **Lot M** — **Courrier plus rapide & aux couleurs d'Infomaniak** : **pool de connexions IMAP** par compte (boîte
  gardée au chaud → chargement/lecture quasi instantanés, moins de « too many connections ») · **thème Infomaniak
  exact** (couleurs kMail : rose `#BC0055` / bleu `#0098FF` au choix) scopé au module · **grand écran immersif**
  (superposition app + plein écran natif du navigateur : on ne voit que l'e-mail).
- **Lot L** — **Dimension multi-entités** (sociétés du groupe) : modèle `Company` dynamique (Adventum, Pharmagène +
  Nᵉ entité), **sélecteur d'entité** dans la barre supérieure (Toutes / une entité), `companyId` sur 10 domaines
  (Regulatory, appels d'offres PCH, RH, Ad & Pro, promotion médicale, Finances, Information médicale, Stocks,
  Logistique, Ventes), filtre de liste + menu « Entité » sur les formulaires, **gestion en Administration → Entités**.
  Ad & Pro : **type de matériel** (Présentoir, Stand/Booth, Poster, Vidéo, … ; enum `MaterialType`).
- **Lot K** — Regulatory : **Détenteur de DE** + **variation d'enregistrement** (fabricant obligatoire en
  fabrication locale) · **Corbeille des suppressions définitives** (restaurable, Super Admin) + purge des
  **demandes de validation** · Administration : **Stockage Drive exact** (capacité/quota modifiables et appliqués)
  + **dernière activité au clic près** · **Paie RH** (matrice × mois, fiche de paie, notification employé à +24 h,
  transfert budget avec résumé) · **éléments de salaire** de l'employé (3 champs confidentiels) · FIX **fuseau des
  réunions** (10 h ≠ 11 h).
- **Lot J** — **Verrou notes de frais** (traitement RH bloqué avant l'accusé de réception des originaux par le
  secrétariat) · archives **« Dossier traité »** dans le Drive (RH, secrétariat, PRIM) · FIX grave : supprimer des
  demandes RH effaçait l'employé (corbeille par demande + type dédié + avertissement).
- **Lot I** — **Notes de frais** (mois obligatoire, validation mois demandé/suivant, avertissement originaux) ·
  **Entrevue avec les RH** (dates négociées → rendez-vous au calendrier).
- **Lot H** — **Logistique / Stocks séparés** + refonte Stocks en **états datés** (3 onglets, graphique/tableau) ·
  module **Courses** multi-points (secrétariat → chauffeur, checklist) · demandes de Mon dossier RH **traitées
  dans RH** · suppression médecin/visite · méta documents sur une ligne · **périodes d'essai**.
- **Moteur de workflow no-code** (4 catégories Ad & Pro) : étapes/pouvoirs/notifications éditables par le Super
  Admin, avis défavorables non éliminatoires, méta + historique réservés au Super Admin, rôles secondaires
  cumulés partout (`anyRoleFilter`).
- **Rôle National Sales** — nouveau rôle (capacités du délégué médical + **approbation préliminaire** des demandes
  Ad & Pro / événements avec **choix de la Direction Marketing**). Portée ALL pour voir toutes les demandes.
- **Étape préliminaire réservée au National Sales** — le choix de la Direction Marketing ne se fait plus via la Direction
  Marketing ; il est réservé au National Sales (Super Admin en secours). La **décision finale** reste à la Direction.
- **Workflow de prise en charge étendu aux Événements** — le module Events reçoit le **même circuit** que les
  congrès (soumission → National Sales → Direction Marketing → Direction → information médicale → Finances).
- **Impliquer une tierce personne** — étendu du sponsoring aux **congrès et événements**, avec **dossier de suivi
  auto-créé** indiquant l'événement (sans budget) et une demande dans l'espace de la personne.
- **Budgets** — **sous-catégories** (ex. Table ronde sous Événement), **vue consolidée du total des enveloppes**,
  **accès par personne** (en plus des rôles), attribution auto des dépenses à la catégorie du module.
- **Bureau du secrétariat** — dans la fenêtre de **30 min** (tous types de demandes), le demandeur peut modifier
  **tous les champs** qu'il a saisis (plus seulement la description) ou supprimer sa demande.
- **Messagerie** — **notification sonore** qui fonctionne en arrière-plan ; **aperçu / téléchargement** des pièces
  jointes (plus de téléchargement automatique au clic).
- **Information médicale** — le PRIM **visualise les pièces de l'événement source**, **upload** de la déclaration
  (non obligatoire), affichage du **demandeur**.

