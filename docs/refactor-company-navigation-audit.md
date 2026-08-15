# Refonte « navigation par pôles » + simplification Ad & Pro — AUDIT PRÉALABLE

> Document exigé **avant toute modification de code**. Il constate l'existant, propose la cible,
> et surtout **distingue ce qui se déplace de ce qui se migre** — la différence entre un chantier
> d'une semaine et un chantier d'un mois.
>
> Sources : lecture du code, `docs/api/ERP_AUDIT.md` (généré), `docs/api/erp-map.json`,
> `prisma/schema.prisma`, `README.md`.

---

## 0. Le constat qui change tout

**Trois des cinq chantiers demandés n'exigent aucune migration de données.**

| Chantier | Nature réelle | Migration ? |
|---|---|---|
| Nouvelle sidebar par pôles | Présentation | **Non** |
| Regulatory → 2 portes | Présentation (routes existantes) | **Non** |
| Business Development → 2 portes | Présentation | **Non** |
| Sales & Marketing (7 sous-modules) | Présentation | **Non** |
| **Supply Chain & Logistics** | **Présentation** — voir § 11 | **Non** |
| Épingles personnelles | Nouveau modèle (1 table) | Oui, additive |
| **Ad & Pro unifié** | **Façade métier** — voir § 10 | Additive seulement |
| Matrice de délégation | Nouveau modèle (1 table) + garde | Oui, additive |

La découverte principale est au § 11 : **le pôle Supply Chain existe déjà en base**, sous le nom
`LogisticsOrder`, avec sa machine à états complète. Il n'est simplement pas présenté comme un pôle.

---

## 1. Navigation actuelle

Source unique : `NAVIGATION` dans `src/lib/labels.ts` (l. 1178), consommée par
`src/app/(app)/layout.tsx` (l. 59) qui filtre **côté serveur** sur les modules accessibles, puis
rendue par `src/components/layout/sidebar.tsx`.

Quatre groupes plats : `Pilotage` · `Pôles` · `Transverse` · `Système`.

| Groupe | Entrées | Problème |
|---|---|---|
| Pilotage | Mon espace, Calendrier, Mon dossier RH, Assistant IA, Projets | OK |
| **Pôles** | **13 entrées à plat** : Regulatory, Ad & Pro, Budgets, Moyens généraux, Finances, RH, Ventes & Marchés, Stocks, Promotion médicale, Prévisions & Force de vente, Rapports terrain, Information médicale, Business Development, Explorateur produits | **C'est le problème.** 13 entrées de même niveau, sans hiérarchie : l'utilisateur voit l'architecture technique, pas son entreprise. |
| Transverse | Validations, Réunions, Drive, Bureau du secrétariat, Feedback | OK |
| Système | Adventum Brain, **Administration** | Ambiguïté avec l'administration d'entreprise |

**Mécanisme d'onglets déjà en place** (`NavItem.tabs`) : une entrée peut fusionner plusieurs
sous-modules, elle est visible si **au moins un** onglet est accessible, et son lien pointe vers le
premier onglet autorisé. C'est exactement la sémantique demandée pour les pôles — **elle existe
déjà**, il faut la promouvoir d'un niveau (onglets → sous-modules de sidebar).

---

## 2. Navigation cible

```
ÉPINGLÉS                    ← nouveau, par utilisateur, réordonnable

PILOTAGE
  Mon espace · Calendrier · Mon dossier RH · Assistant IA · Projets

PÔLES MÉTIER
  REGULATORY                     (2)  → ouvert par défaut
    Suivi des dossiers
    Analyse CTD
  ADMINISTRATION                 (3)  → ouvert par défaut
    Moyens généraux · Finances · Ressources humaines
  SALES & MARKETING              (7)  → replié, chevron
    Ventes · Promotion médicale · Force de vente · Annuaire
    Rapports terrain · Ad & Pro · Information médicale
  BUSINESS DEVELOPMENT           (2)  → ouvert par défaut
    Market Intelligence · Marchés PCH
  SUPPLY CHAIN & LOGISTICS       (2)  → ouvert par défaut
    Commandes & logistique · Stocks

TRANSVERSE
  Validations · Réunions & appels · Drive · Bureau du secrétariat · Feedback

SYSTÈME
  Console d'Administration · Adventum Brain
```

Règle d'ouverture : **≤ 5 sous-modules accessibles → ouvert ; > 5 → replié avec chevron.** Le
décompte porte sur les sous-modules **que cet utilisateur voit**, pas sur le total.

⚠️ **Budgets** n'apparaît pas dans la cible fournie. Proposition : le rattacher à
**Administration** (4 sous-modules, reste ≤ 5). À confirmer.

---

## 3. Mapping ancien → nouveau

| Entrée actuelle | Route (inchangée) | Pôle cible | Migration |
|---|---|---|---|
| Regulatory | `/regulatory` | Regulatory › **Suivi des dossiers** | — |
| *(onglet CTD existant)* | `/regulatory/enregistrement` | Regulatory › **Analyse CTD** | — |
| Moyens généraux | `/moyens-generaux` | Administration | — |
| Finances | `/finances` | Administration | — |
| Ressources humaines | `/rh` | Administration | — |
| Budgets | `/budgets` | Administration *(à confirmer)* | — |
| Ventes & Marchés | `/sales` | Sales & Marketing › **Ventes** | — |
| Promotion médicale | `/medical` | Sales & Marketing › Promotion médicale | — |
| Prévisions & Force de vente | `/planning` | Sales & Marketing › **Force de vente** | — |
| *(médecins/établissements)* | `/medical` (sous-vues) | Sales & Marketing › **Annuaire** | route à extraire |
| Rapports terrain | `/field-reports` | Sales & Marketing › Rapports terrain | — |
| Ad & Pro | `/sponsoring` | Sales & Marketing › **Ad & Pro** | § 10 |
| Information médicale | `/information-medicale` | Sales & Marketing › Information médicale | — |
| Business Development | `/business-development` | BD › **Market Intelligence** | — |
| Explorateur produits | `/business-development/marche/produits` | BD › Market Intelligence *(sous-vue)* | — |
| *(onglet PCH)* | `/pch` | BD › **Marchés PCH** | — |
| *(onglet Logistique)* | `/logistics` | **Supply Chain** › Commandes & logistique | — |
| Stocks | `/stocks` | **Supply Chain** › Stocks | — |
| Administration | `/admin` | Système › **Console d'Administration** | libellé |

**Aucune route ne change.** Les liens historiques des notifications restent valides — condition
posée au § 9 de la demande, satisfaite sans redirection.

---

## 4. Composants / pages / routes concernés

| Fichier | Rôle | Modification |
|---|---|---|
| `src/lib/labels.ts` → `NAVIGATION` | Registre unique | **Ajout** d'une hiérarchie `pole` + sous-entrées |
| `src/app/(app)/layout.tsx` (l. 52-68) | Construit la nav filtrée serveur | Étendre au filtrage hiérarchique |
| `src/components/layout/sidebar.tsx` (115 l.) | Rendu | Réécriture du rendu : pôles pliables + épingles |
| `src/components/layout/mobile-tabbar.tsx` (163 l.) | Barre mobile | Vérifier la cohérence des cibles |
| `src/components/layout/command-palette.tsx` | Palette ⌘K | Consomme `navItems` — suit automatiquement |
| `src/lib/nav-tabs.ts` → `visibleTabs` | Filtrage onglets | Réutilisé tel quel |
| `src/lib/labels.ts` → `moduleForPath` | Route → module (badges) | Étendre aux nouvelles entrées |
| `src/lib/labels.ts` → `firstAccessibleHref` | Atterrissage anti-boucle | Adapter à la hiérarchie |

---

## 5. Modèles Prisma concernés

**Aucun modifié pour la navigation.** Un seul modèle **ajouté** :

```prisma
model UserPinnedNav {
  id        String   @id @default(cuid())
  userId    String
  /// Clé STABLE de la destination (route canonique), jamais un libellé.
  key       String
  position  Int      @default(0)
  createdAt DateTime @default(now())
  @@unique([userId, key])
  @@index([userId, position])
}
```

Vérifié : **aucune structure d'épingles de navigation n'existe**. `MessageBookmark` et
`Conversation.isPinned` concernent la messagerie et ne sont pas réutilisables.

Pour Ad & Pro et Supply Chain, voir §§ 10 et 11 — modèles **existants**, non modifiés.

---

## 6. Actions serveur concernées

| Action | Fichier | Sort |
|---|---|---|
| *(nouvelles)* `pinNavItem`, `unpinNavItem`, `reorderPinnedNav` | `lib/actions/nav-actions.ts` | À créer |
| Toutes les actions Ad & Pro (`sponsoring-actions`, `congress-*`, `event-actions`, `ad-pro-item-actions`, `care-actions`) | inchangées | **Réutilisées telles quelles** par la façade |
| `lib/workflow/engine.ts` | inchangé | Le moteur reste ; c'est la **configuration** des étapes qui s'allège (§ 10.3) |

**Contrainte respectée** : aucune seconde logique métier. La façade Ad & Pro appelle les actions
existantes ; elle ne les remplace pas.

---

## 7. Queries concernées

| Query | Usage | Modification |
|---|---|---|
| `getAccess` (`rbac.ts`) | Droits effectifs, mémoïsé par requête | Réutilisé — **source unique** de la nav |
| `visibleTabs` (`nav-tabs.ts`) | Filtrage par droit + drapeau | Réutilisé |
| `getMyCompanies`, `myCompanyScope` | Cloisonnement entités | Inchangés |
| *(nouvelle)* `getPinnedNav(user)` | Épingles filtrées par droit | À créer — **1 requête**, jointe au chargement du layout |

**Performance** : la nav se construit déjà à partir de `getAccess` (mémoïsé par requête). Les
épingles ajoutent **une seule** requête au layout, pas une par entrée.

---

## 8. Dépendances RBAC

La navigation est — et doit rester — une **projection** de `getAccess`, jamais une source de droit.

| Mécanisme | Où | Effet sur la nav |
|---|---|---|
| `PERMISSIONS[role][module]` | `rbac.ts` l. 71 | Base |
| `UserAccess` (overrides) | `getAccess` | Peut ouvrir/fermer un module |
| `secondaryRole` | `getAccess` | Cumule les droits |
| `RowGrant` (accès ligne) | `grantsFor` | N'affecte pas la nav (mais les listes) |
| Accès implicites (`GENERAL_MEANS` via RH, `BUDGETS` via enveloppe) | `getAccess` | Déjà pris en compte |
| Entité courante (cookie validé) | `myCompanyScope` | N'affecte pas la nav |
| Drapeaux de version | `featureEnabled` | Masque un onglet non livré |

**Règles à tenir :**
1. Un pôle n'apparaît que s'il a **≥ 1 sous-module accessible**.
2. Un sous-module interdit n'est **jamais envoyé au client** (filtrage serveur, déjà en place).
3. Une épingle vers une destination devenue inaccessible **disparaît** — elle n'ouvre rien.

---

## 9. Risques de migration

| Risque | Gravité | Parade |
|---|---|---|
| Liens de notification cassés | **Élevée** | **Nulle** : aucune route ne change |
| `moduleForPath` ne retrouve plus le module → badges perdus | Moyenne | Test dédié sur les routes existantes |
| `firstAccessibleHref` renvoie une page refusée → boucle de redirection | **Élevée** | Test : pour chaque rôle, la destination doit être `canView` |
| Recherche globale : « Congrès international » introuvable | Moyenne | **Alias de libellés** : garder les anciens termes comme synonymes (§ 12) |
| Épingle utilisée pour contourner le RBAC | **Critique** | L'épingle ne porte qu'une **clé de route** ; la garde de page reste seule juge |
| Perte de granularité Ad & Pro | **Critique** | Façade au-dessus des modèles, **zéro fusion physique** (§ 10) |
| Paiement hors circuit | **Critique** | Garde serveur unique sur l'émission d'ordre de dépense (§ 10.5) |

---

## 10. Proposition — refonte Ad & Pro

### 10.1 L'existant

Cinq modèles porteurs, **tous vivants et référencés** :

| Modèle | Rôle | Enfants |
|---|---|---|
| `SponsoringRequest` | Sponsoring | `AdProItem`, `CareBeneficiary`, `CareQuote` |
| `CongressNational` | Congrès Algérie | idem |
| `CongressInternational` | Congrès étranger | idem |
| `Event` | Événement | idem |
| `Training` | Formation | `AdProItem` |

Ils partagent **déjà** un socle commun, ce qui est le point décisif :

- **`AdProItem`** — le poste de dépense, avec **5 FK nullables** (une par parent) et une
  contrainte `AdProItem_one_parent`. C'est **déjà** le dénominateur commun.
- **`CareBeneficiary` / `CareQuote`** — les personnes prises en charge, partagées.
- Champs de circuit identiques sur les 4 premiers : `requestStatus`, `productManagerId`,
  `preliminaryById/At/Note`, `finalById/At/Note`, `finalAmount`, `expenseOrderId`.

### 10.2 Stratégie retenue : **façade, pas fusion**

**Ne PAS fusionner physiquement les tables.** Raisons :

1. Les 5 modèles portent des champs métier **irréductibles** (`CongressInternational` a hôtel,
   vol, visa ; `Event` a capacité et lien de réunion). Une table unique les rendrait tous
   nullables — on perdrait les contraintes qui font aujourd'hui la qualité des données.
2. `AdProItem` **impose déjà** l'unicité du parent : la cohérence est garantie en base.
3. Une fusion est **irréversible**. Une façade se corrige.

**Ce qu'on construit** : `src/lib/ad-pro/dossier.ts` — un objet métier `AdProDossier` lu depuis
les 5 tables, avec `natures: AdProNature[]` (multi-valeur), et **une seule** liste de postes.

Le multi-natures demandé (« Événement + Prise en charge internationale + Sponsoring ») s'obtient
par un **lien de rattachement** additif :

```prisma
model AdProLink {
  id         String   @id @default(cuid())
  /// Les deux faces d'une même opération, dans n'importe quel sens.
  aType      String   // SPONSORING | CONGRESS_NATIONAL | CONGRESS_INTERNATIONAL | EVENT | TRAINING
  aId        String
  bType      String
  bId        String
  reason     String?
  createdById String?
  createdAt  DateTime @default(now())
  @@unique([aType, aId, bType, bId])
}
```

Une demande « multi-natures » est donc un **groupe de dossiers liés**, présenté comme un seul
dans l'interface. Aucune donnée existante n'est touchée ; l'historique reste lisible tel quel.

### 10.3 Circuit cible

Actuel : `AWAITING_PRELIMINARY` → `PRELIMINARY_APPROVED` → `AWAITING_FINAL` → `APPROVED`
(trois clics de trois personnes qui ont déjà décidé ensemble).

Cible :

```
DEMANDE → DÉCISION AUTORISÉE → EXÉCUTION → [INFO MÉDICALE] → FINANCES → PAIEMENT
```

Les étapes `preliminaryBy` / `productManager` **ne disparaissent pas** : elles deviennent des
**avis facultatifs** (consultation), enregistrables mais non bloquants. Les colonnes restent —
donc **l'historique des dossiers déjà instruits reste intact et lisible**.

Nouveauté : une décision peut être enregistrée comme **« prise en réunion »** — décideur, date,
montant, note, participants optionnels — en **un seul geste**, au lieu de trois validations
factices.

### 10.4 Matrice de délégation (configurable, jamais codée en dur)

```prisma
model DelegationRule {
  id            String   @id @default(cuid())
  companyId     String?          // null = toutes les entités
  departmentId  String?          // null = tous les départements
  natures       String[]         // vide = toutes les natures
  minAmount     Decimal  @db.Decimal(14,2) @default(0)
  maxAmount     Decimal? @db.Decimal(14,2) // null = sans plafond
  /// Qui décide à ce niveau — par rôle et/ou nommément.
  deciderRoles  String[]
  deciderUserIds String[]
  /// Deux décideurs distincts exigés (cas sensibles).
  requiresTwo   Boolean  @default(false)
  label         String
  isActive      Boolean  @default(true)
  sortOrder     Int      @default(0)
}
```

Module pur `src/lib/ad-pro/delegation.ts` : `resolveAuthority({ amount, natures, companyId,
departmentId })` → `{ rule, deciders, requiresTwo, reason }`. **Testé.** Le système sait dire
*qui* peut décider, *pourquoi*, *jusqu'à quel montant*, *pour quelle nature*.

Les seuils donnés en exemple dans la demande ne sont **pas** codés : ils sont des lignes de
`DelegationRule`, éditables en Console d'Administration.

**Garde serveur obligatoire** : `decideAdProDossier` recalcule l'autorité **côté serveur** à
partir du montant réel. Une URL forgée ou un appel direct par une personne non habilitée est
refusé — le droit ne vient jamais du client.

### 10.5 Garde de paiement (règle critique)

Point d'étranglement unique : **l'émission de l'ordre de dépense** (`createExpenseOrder`, déjà
appelé par tous les circuits Ad & Pro). On y ajoute une garde `canPayAdProItem(item)` qui exige,
cumulativement :

1. dossier **autorisé** par une règle de délégation valide ;
2. poste **rattaché** à ce dossier et non annulé ;
3. obligations **Information médicale** remplies **si applicable** (`MedicalInfoDeclaration`
   validée) ;
4. **justificatifs** obligatoires présents (devis/facture selon la nature) ;
5. ordre de dépense **valide** (montant ≤ montant accordé).

Un refus dit **laquelle** des cinq conditions manque. Le comptable ne peut pas la contourner :
la garde est dans l'action serveur, pas dans l'écran.

### 10.6 Traçabilité — inventaire de contrôle

Les 25 éléments listés au § 7.6 de la demande sont **tous déjà portés** par les modèles actuels
(créateur, entité, département, montants demandé/accordé, décideur, dates, pièces, devis,
fournisseurs, postes, bénéficiaires, décisions individuelles, audit) — **sauf trois**, à ajouter :

| Manquant | Où l'ajouter |
|---|---|
| **Niveau d'autorité utilisé** | `decisionRuleId` + `decisionRuleLabel` sur les 5 modèles (additif) |
| **Nature(s) multiples** | `AdProLink` (§ 10.2) |
| **« Décision prise en réunion »** + participants | `decisionMode` + `decisionParticipantIds` (additif) |

---

## 11. Proposition — Supply Chain & Logistics

### 11.1 La découverte

**Le pôle existe déjà en base.** `LogisticsOrder` porte :

`reference · product · dci · dosage · pharmaceuticalForm · supplier · country ·
quantityOrdered · quantityReceived · quantityDelivered · orderDate · estimatedDeparture ·
actualDeparture · estimatedArrival · actualArrival · customsDate · pchDeliveryDate ·
status · carrier · incoterm · invoiceNumber · blAwbNumber · orderValue · currency ·
exchangeRate · owner · companyId`

Et `LogisticsStatus` est **exactement** la machine à états demandée :

```
ORDERED → PRODUCTION → SHIPPED → ARRIVED_TERMINAL → CUSTOMS → DELIVERED   (+ BLOCKED)
```

La fiche commande demandée au § 8.1 est donc **déjà remplissable à 100 %** avec les champs
existants. **Rien à modéliser.**

### 11.2 Le lien PCH → Sales → Supply

`PchOrder` porte déjà `tenderId` + `lineId` : **le bon de commande est déjà rattaché au marché**.
Le seul chaînon manquant est `PchOrder → LogisticsOrder` :

```prisma
// Additif, nullable : aucune donnée existante n'est touchée.
model PchOrder {
  logisticsOrderId String?
  logisticsOrder   LogisticsOrder? @relation(...)
}
```

Flux cible, **sans aucune ressaisie** :

```
Marché PCH gagné (PchTender)
   └→ PchOrder (tenderId, lineId)        ← existe déjà
        └→ LogisticsOrder                ← lien à ajouter
             └→ StockSnapshot            ← existe déjà (productId)
```

### 11.3 Ce qu'il reste à faire

1. Promouvoir `/logistics` et `/stocks` en pôle (présentation).
2. Enrichir la fiche commande `/logistics/[id]` : frise des 6 états, ETA vs réel, documents.
3. Ajouter le lien `PchOrder.logisticsOrderId` + le bouton « Créer la commande logistique » depuis
   un marché gagné (pré-remplissage, pas ressaisie).

---

## 12. Déplaçable sans aucune migration

- Toute la sidebar (pôles, hiérarchie, chevrons, ordre, libellés).
- Regulatory → 2 portes (`/regulatory` et `/regulatory/enregistrement` existent).
- Business Development → 2 portes (`/business-development`, `/pch` existent).
- Sales & Marketing → 6 des 7 sous-modules (routes existantes).
- Supply Chain → 2 sous-modules (routes existantes).
- « Administration » → « Console d'Administration » (libellé).
- Alias de recherche (« Congrès international » → Prise en charge internationale) : table de
  synonymes en constante, aucune donnée touchée.

**Environ 80 % de l'effet visuel demandé s'obtient sans toucher à une seule table.**

---

## 13. Nécessitant une évolution de modèle (toutes additives)

| # | Évolution | Table | Destructif ? |
|---|---|---|---|
| 1 | `UserPinnedNav` | nouvelle | non |
| 2 | `DelegationRule` | nouvelle | non |
| 3 | `AdProLink` (multi-natures) | nouvelle | non |
| 4 | `decisionRuleId` / `decisionRuleLabel` / `decisionMode` / `decisionParticipantIds` | 5 modèles Ad & Pro | non (colonnes nullables) |
| 5 | `PchOrder.logisticsOrderId` | existante | non (colonne nullable) |
| 6 | `Annuaire` : extraction d'une route dédiée | aucune | non |

**Aucune suppression, aucun renommage, aucun `NOT NULL` ajouté.** Toutes les migrations sont
idempotentes (`IF NOT EXISTS`) et rétrocompatibles : l'application actuelle continuerait de
fonctionner sur le schéma migré.

---

## 14. Ordre de livraison proposé

| Lot | Contenu | Risque | Valeur perçue |
|---|---|---|---|
| **A** | Sidebar par pôles + Console d'Administration + alias de recherche | Faible | **Très forte** |
| **B** | Épingles personnelles (modèle, actions, drag & drop, mobile) | Faible | Forte |
| **C** | Supply Chain : pôle + fiche commande enrichie + lien PCH→Logistique | Moyen | Forte |
| **D** | Ad & Pro : matrice de délégation + décision unique + garde de paiement | **Élevé** | **Très forte** |
| **E** | Ad & Pro : façade multi-natures (`AdProLink`) + workspace unifié | Élevé | Moyenne |
| **F** | Assistant IA : nouvelle taxonomie + compatibilité anciens termes | Faible | Moyenne |
| **G** | README + tests de bout en bout | Faible | — |

Les lots A et B sont **sans risque de perte de donnée** et produisent l'essentiel de l'impression
« logiciel plus simple ». Le lot D est celui qui touche à l'argent : il vient après, seul, avec
ses tests.

---

## 15. Questions ouvertes (réponse attendue avant les lots D/E)

1. **Budgets** — le rattacher à Administration, ou le laisser en pôle autonome ?
2. **Annuaire** — extraire une route `/annuaire` dédiée, ou rester un onglet de Promotion médicale ?
3. **Seuils de délégation** — quels montants et quels décideurs pour la configuration initiale ?
   (Le mécanisme est configurable ; il faut une première ligne pour démarrer.)
4. **Double validation** — dans quels cas précis l'exiger (montant ? nature ? entité ?)
5. **Avis facultatifs** — le chef de produit doit-il rester **notifié** même quand son avis n'est
   plus bloquant ? (Recommandation : oui, notification sans blocage.)
