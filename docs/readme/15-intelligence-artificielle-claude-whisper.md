## 🤖 Intelligence artificielle (Claude + Whisper)

La couche IA (`src/lib/ai.ts`) est **serveur uniquement** ; sans clé, elle renvoie `configured:false` et l'UI
affiche proprement « IA non configurée » — **aucune fonctionnalité ne casse**.

- **Assistant IA** — **module à part entière** (entrée de menu dédiée, page plein écran
  `/assistant` ; l'ancienne bulle flottante a été retirée). **Boucle agent Claude**,
  comprend l'app et les données **filtrées par les droits**. **Proactif** sur les messages non lus. Outils de
  **lecture** (annuaire, tâches, médecins, produits, **e-mails de sa boîte**, **calendrier**…) exécutés et
  **scopés** ; outils d'**écriture** **jamais** exécutés seuls → **carte de confirmation**. **Anti-formulaire** — il
  crée en langage naturel : tâche, demande administrative, **message**, **e-mail**, **rendez-vous**, dossier,
  **demande de congrès**, **demande RH** (note de frais, ordre de mission, congés annuel/sans solde/maladie/maternité,
  attestations, entrevue…), **demande de sponsoring**, **événement**, **demande de matériel promotionnel**. Chaque
  action réutilise l'action métier existante (mêmes circuits/notifications) et est **revérifiée RBAC** par module.
  Garde-fous : n'invente jamais médecin/produit/adresse, **avertit sur les dates passées**, **texte simple**,
  **robuste** (timeout + retry, ne lève jamais).
  **Lecture de pièces jointes** — on peut joindre des fichiers à la conversation (`/assistant`) : **glisser-déposer**
  ou bouton trombone pour un fichier local, **ou référencer un fichier du Drive** (bouton dossier → sélecteur ;
  **aucun téléchargement + re-téléversement**). Le contenu est extrait **côté serveur** — **Excel complet** (toutes
  les feuilles), **PowerPoint** (texte des diapositives), **Word**, **PDF** (couche texte), **CSV/texte** — puis
  injecté dans le message pour que l'assistant s'appuie dessus (résumé, extraction de chiffres, comparaison). Fichiers
  du Drive lus **après contrôle d'accès** ; formats scannés/binaires hérités signalés (`lib/assistant-files.ts`).
  **Export Excel** — `export_excel` produit un vrai `.xlsx` (dossiers réglementaires, annuaire, courriers,
  recrutement, effectif, comptes) et le dépose dans le **Drive personnel** du demandeur, dossier « Exports IA » :
  il doit vivre là où les autorisations existent déjà, pas dans un lien qui traîne. Le contenu ne dépasse
  **jamais** ce que la personne a le droit de lire, et l'export de l'effectif ne porte **aucune** colonne de
  rémunération — un classeur circule sans ses droits d'accès. Même nom le même jour = nouvelle **version**.
  **Réglages de la plateforme et fiches Regulatory** — `read_platform_settings` / `update_platform_setting`
  (Super Admin) et `update_regulatory_product` (droit `REGULATORY:UPDATE`). Ce qui rend cela tenable est une
  **liste blanche déclarative, typée et bornée** (`lib/assistant/admin-write.ts`) : ce qui n'y figure pas n'est
  pas écrivable, la **console d'administration ne se masque jamais**, une **liste remplace** l'ancienne (la carte
  de confirmation le dit), verrouiller un dossier annonce sa conséquence, et **chaque valeur est relue** avant
  d'atteindre la base — la confirmation de l'utilisateur ne remplace pas la validation, personne ne relit une
  énumération dans une carte de confirmation. Rôles et modules se désignent par leur **nom français**.
  **Dictée vocale** — un bouton micro dans la zone de saisie : on parle, l'audio est transcrit (**Whisper**,
  `POST /api/assistant/transcribe`, audio non conservé) et le texte arrive **dans le champ, ÉDITABLE** — on relit /
  corrige avant d'envoyer. Affiché seulement si `OPENAI_API_KEY` est configurée, et soumis à l'interrupteur « voix ».
- **Rapports terrain vocaux** (`/field-reports`) — *Parler → Whisper → Claude (champs structurés) → relecture →
  validation*. **L'IA ne valide jamais seule.** 100 % utilisable en saisie manuelle sans clé.
- **Comptes-rendus de réunion** — transcription + synthèse IA des appels.
- **Process Intelligence** & **Adventum Brain** — synthèses et explications à la demande (Super Admin).

> Clés : `ANTHROPIC_API_KEY` (Claude), `OPENAI_API_KEY` (Whisper). Posées sur Render, jamais côté client.

### Centre de contrôle IA (Super Admin · `/admin` → onglet IA)

Pilotage de l'IA **sans toucher au code** : **interrupteur général** + **bascule par fonction** (dont « Rédaction du
site » depuis 10/2026), **état des clés** (lecture seule), **tableau de bord d'usage** (volume, taux de succès,
latence, derniers échecs via `AiUsageLog`). Un cliquet exige que chaque bascule de `AiSetting` soit lue par l'action,
offerte par l'écran ET rejouée par l'op d'Adam : une bascule oubliée serait ÉTEINTE à chaque réglage, l'action
réécrivant toutes les colonnes.

---

