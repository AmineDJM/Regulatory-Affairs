# Audit UI / UX & charte graphique — ERP + Adam

**Périmètre** : toute la plateforme — la charte de l'ERP (`src/app/globals.css`), celle d'Adam
(`src/app/chief.css`), les 161 pages de `src/app/(app)/`, le kit de composants, les accès
(menu, gardes, modules masqués), l'accessibilité, le responsive.

**Méthode** : tout ce qui suit est **compté sur le code** (grep/find reproductibles) ou **calculé**
(contrastes WCAG 2.1 sur les valeurs HSL exactes des deux chartes). Aucun chiffre à l'impression.
Date de mesure : 2026-08-30, branche `claude/hopeful-goodall-phd0nb`.

---

## 1. L'état de référence — deux chartes, toutes deux réelles

### 1.1 ERP (`globals.css`, 384 lignes)

La charte existe, elle est **écrite et outillée** — ce n'est pas un vœu :

| Jeton | Valeur | Rôle |
|---|---|---|
| `--primary` | `215 100% 54%` (#1677FF) | LA couleur de marque, unique — doctrine « 5–10 % de l'écran » |
| `--background` | `216 38% 97%` (#F6F8FB) | blanc cassé bleuté |
| `--foreground` | `217 33% 12%` | texte principal |
| `--muted-foreground` | `216 14% 47%` | texte secondaire |
| `--success / --warning / --destructive / --info` | `152 56% 36%` / `35 88% 45%` / `356 68% 51%` / `212 84% 48%` | statuts sémantiques, seules couleurs vives autorisées hors marque |
| `--sidebar` | `214 54% 13%` (#0F1E32) | bleu nuit du menu |
| `--radius` | 0.625rem | arrondi unique |

Plus : Inter via `next/font` (chiffres tabulaires justifiés en commentaire), racine mobile à
106,25 % (17 px) sous 1024 px, variables `--app-chrome-*` mesurées, échelle z-index documentée
(30→200), utilitaires `.surface`, `.table-clean`, `.badge-soft`, `.focus-ring`,
`table.mobile-cards`, plein écran `amd-focus`, et l'exception **assumée** `.ik-mail`
(rose #BC0055 / bleu #0098FF, l'identité Infomaniak scopée au module Courrier).
`tailwind.config.ts` ne mappe **que** des jetons sémantiques `hsl(var(--*))` — l'architecture
est la bonne.

La règle affichée : *« Toute couleur vit ici — aucune valeur en dur dans un écran. »*
C'est contre elle que la section 3 mesure.

### 1.2 Adam (`chief.css`, 375 lignes)

Système **autonome et cohérent**, préfixe `--chief-*` sous `.chief-root` :
accent **indigo** `245 72% 58%` (délibérément distinct de l'azur ERP, même famille), trois
niveaux de texte, hiérarchie de rayons 14/18/24 px (contrôle/carte/feuille), jetons de
mouvement (140/220/320 ms, `cubic-bezier(0.32,0.72,0,1)`), conversation plafonnée à 820 px,
cibles tactiles 44 px. Pas de `font-family` propre : Adam **hérite d'Inter** — un seul
caractère typographique pour toute la plateforme, deux accents. C'est le bon dessin.

---

## 2. Ce qui tient — mesuré

| Propriété | Mesure |
|---|---|
| Colonne vertébrale des statuts | `labels.ts` : **352 déclarations `tone:`** vers 6 tons sémantiques ; `StatusBadge` fait le pont ; **248 usages `<Badge>`** ; 231 fichiers importent `labels` |
| Workspace Adam fidèle à sa charte | `blocks.css` : **168** `var(--chief-*)` pour **4** hex ; `blocks-godmode.css` : **161** pour **0** |
| Iconographie | **lucide-react seul**, 428 fichiers, zéro bibliothèque concurrente |
| Kit partagé adopté | `PageHeader` **122** fichiers, `.surface` **110**, `EmptyState` **73**, `KpiCard` **49** |
| Étanchéité ERP ↔ Adam | `src/components/chief/` importe **0** composant de `src/components/ui/` |
| Gardes d'accès | **161/161 pages** portent une garde effective (`requireModule`, `userCan`, redirection, ou lectures RBAC-scopées — les 2 dernières vérifiées une à une : `search` passe par `globalSearch(user,…)`, `messagerie` par `mailAccess(user,…)`) |
| Menu = droits, côté serveur | `(app)/layout.tsx` : `accessibleModules(user)` × `visibleModules(hiddenModules)` × drapeaux de features × portes (`regEnrollment`, `pipeline`) — une entrée interdite **n'est jamais envoyée au navigateur** |
| Sécurité du sélecteur d'entité | portée revalidée serveur (« le cookie est une demande, pas une autorisation ») |
| Page « aucun accès » | existe, ne se refuse jamais elle-même (pas de boucle), donne le compte de modules et la sortie |
| Étendue du RBAC | 40 modules, 19 rôles ; modules masqués = état de service (menu), pas un droit — doctrine écrite dans le layout |
| Contrastes qui passent | texte principal 15,9–17,1:1 ; toute la barre latérale ≥ 5,15:1 ; `chief-accent` 6,24:1 ; rose Courrier 6,42:1 ; badge purple 5,92:1 ; `info` 4,55:1 ; `destructive` plein 4,86:1 |

**L'architecture est saine.** Les défauts ci-dessous sont des écarts *à* la charte, pas
l'absence de charte — c'est une position bien plus facile à corriger.

---

## 3. Les écarts — par famille, en chiffres

### A. La règle « aucune couleur en dur » est violée en périphérie

| Écart | Mesure |
|---|---|
| Hex codés en dur dans les TSX | **124** occurrences (têtes : `#94a3b8` ×26, `#2563eb` ×10, `#e2e8f0` ×6, `#7c3aed` ×6, `#dc2626` ×5, `#64748b` ×5, `#16a34a` ×5, `#0ea5e9` ×5) |
| Palette Tailwind brute (`amber-500`…) | **342** occurrences dans **52 fichiers** (amber 137, emerald 42, slate 40, blue 36, purple 20, sky 13, neutral 12, red 10, rose 9…) |
| Pires fichiers | `missions/mission-runtime-panel.tsx` **25**, `regulatory/enregistrement/analyse/[dossierId]/page.tsx` **21**, `drive/file-glyph.tsx` **13**, `mission-runtime-controls.tsx` **10** |
| Cartes de tons locales court-circuitant `labels.ts` | **16 fichiers** (27 lignes de classes couleur), dont des hex dans du code (`research-table.tsx` : `#f59e0b`, `#0ea5e9`) |
| Le ton `purple` du composant canonique | `ui/badge.tsx` : `bg-purple-100 text-purple-700` — le **seul** des 6 tons hors jetons |
| Live Office | `blocks/artifact.css` : **32 hex bruts pour 8 jetons** — la surface artefact ne parle pas la langue de `chief.css`, au rebours de ses deux voisines (§2) |

Lecture honnête : 342 + 124 ≈ 470 points de couleur hors charte, mais **concentrés** — 4
fichiers portent 69 occurrences ; l'amber (137) vient surtout d'états « attention » qui ont un
jeton dédié (`--warning`) inutilisé à ces endroits.

### B. Contrastes — calculés (WCAG 2.1, seuil AA 4,5:1 texte normal / 3:1 grand texte)

Échecs, du plus grave au plus discutable :

| Paire | Ratio | Verdict |
|---|---|---|
| `warning` sur badge `warning/10` | **2,64** | FAIL AA **et** AA-grand — les badges « Attente paiement BV », « Attente ANPP », « Réponse aux réserves »… sont en `text-xs` |
| `warning` plein sur carte | **2,91** | FAIL AA et AA-grand |
| vert `.ik-mail` #3EBF4D sur blanc | **2,40** | FAIL — palette Infomaniak recopiée telle quelle |
| orange `.ik-mail` #FF8500 sur blanc | **2,44** | FAIL |
| `#94a3b8` (slate-400, ×26 en dur) sur blanc | **2,56** | FAIL — du texte secondaire illisible |
| bleu `.ik-mail` #0098FF sur blanc | **3,03** | FAIL AA (passe grand texte) |
| `chief-text-tertiary` sur fond Adam | **3,04** | FAIL AA — acceptable **seulement** si cantonné aux horodatages/légendes grands |
| `success` sur badge `success/10` | **3,60** | FAIL AA (badges 12 px) |
| `success` plein sur carte | **4,05** | FAIL AA de peu |
| blanc sur `--primary` (tous les boutons) | **4,15** | FAIL AA (passe AA-grand ; l'azur #1677FF est un bleu Ant Design, limite connue) |
| `destructive` sur badge `/10` | **4,18** | FAIL AA de peu |
| `muted-foreground` sur `--background` | **4,40** | FAIL de peu (passe sur carte blanche : 4,73) |

Le motif est net : **les tons clairs des statuts (badges `/10`) et le `warning` sont le
problème** — pas la structure. Un assombrissement de 2 jetons (`--warning`, `--success`) et une
règle « texte de badge = variante foncée » règlent 6 lignes d'un coup.

### C. Le mode sombre fantôme

- `tailwind.config.ts` déclare `darkMode: ["class"]` ; **aucun bloc `.dark`** n'existe dans
  `globals.css` → l'app est claire, point.
- **33 classes `dark:` mortes** traînent dans 7 fichiers (`ask-chief`, `file-glyph`,
  `requester-window`, `regulatory-table`, `presentation-panel`, `mail-client`,
  `import-mapping-sheet`) — du code qui ment sur ce que fait la plateforme.
- `layout.tsx` déclare `theme-color` **sombre `#0b1220`** pour `prefers-color-scheme: dark` :
  un utilisateur en OS sombre a le chrome du navigateur sombre **autour d'une app claire**.

À trancher : soit le sombre est un chantier voulu (alors il manque tout), soit il ne l'est pas
(alors ces 33 classes et ce `theme-color` se suppriment). L'entre-deux actuel est le pire état.

### D. Typographie hors échelle

- `text-[0.6875rem]` (11 px) : **265 occurrences** — c'est un cran de facto de l'échelle,
  jamais tokenisé.
- `text-[0.625rem]` (10 px) : **63** ; `text-[0.5625rem]` (**9 px**) : **13** — sous le
  plancher lisible.
- Tailles en **px** éparses (13px ×4, 12.5px ×2, 10.5px ×2, 19/17/15px) : elles **échappent** à
  la racine 106,25 % du mobile — le mécanisme documenté dans `globals.css` ne les agrandit pas.

### E. Accessibilité structurelle

| Point | Mesure |
|---|---|
| `focus-visible` | **15 usages dans 4 fichiers** (input ×10, chief-header ×3, button ×1, document-preview ×1) ; l'utilitaire `.focus-ring` prévu par la charte : **2 fichiers**. La navigation clavier repose presque partout sur le style navigateur par défaut |
| `aria-live` | **0** — aucun retour dynamique (envoi de formulaire, fin d'analyse, erreur) n'est annoncé aux lecteurs d'écran ; il n'existe d'ailleurs **aucun système de toast** (choix assumable, mais l'équivalent inline n'est pas annoncé non plus) |
| `aria-*` statiques | 194 occurrences — les libellés existent |
| `<img>` sans `alt` | 1 |
| `<button>` bruts | **595** contre 203 fichiers important `ui/button` — la moitié de la surface interactive ne bénéficie ni des variantes ni du focus du composant |
| Texte 9 px | 13 occurrences (cf. D) |

### F. Utilitaires déclarés, jamais adoptés

`.badge-soft` : **0 usage**. `.table-clean` : **2**. `table.mobile-cards` : **1**.
`.focus-ring` : **2**. Une charte qui déclare des outils que personne ne prend, c'est du poids
mort ou un défaut d'évangélisation — dans les deux cas, à trancher (supprimer ou imposer).

### G. Accès — deux fragilités de discipline, zéro trou constaté

1. La garde est **une discipline par page** (`requireModule` etc.), pas une carte de routes :
   les 161 pages actuelles passent, mais **aucun test ne balaie** `src/app/(app)/**/page.tsx`
   pour exiger une garde — une 162ᵉ page oubliée échouerait en silence (les tests d'accès
   existants — `rbac.test.ts`, `validation-access.test.ts`, `budget-access.test.ts` — couvrent
   la couche lib, pas l'inventaire des pages).
2. Le **masquage de module** ne filtre que le menu (doctrine écrite : « le masquage n'est pas
   un droit »). C'est cohérent — mais la page reste servie par URL directe à qui a le droit
   module : à documenter comme voulu, pour que personne ne le « corrige » un jour en croyant
   fermer un trou.

---

## 4. La charte cible — les décisions

1. **Deux jetons s'assombrissent, aucune refonte** : `--warning` `35 88% 45%` → ~`32 95% 37%`
   (≥ 4,5:1 plein et ≥ 4,5:1 sur `/10`) ; `--success` `152 56% 36%` → ~`152 60% 30%`. Les
   badges gardent leurs fonds pastel : seul le **texte** fonce. `--destructive` gagne ~3 % de
   sombre pour passer le badge (4,18 → ≥ 4,5).
2. **`--primary` reste #1677FF** (identité) ; les boutons pleins passent en `font-medium` ≥
   14 px (déjà le cas) et on l'assume en AA-grand, **ou** on fonce d'un cran (`215 100% 48%`,
   ~4,9:1) — décision d'identité à prendre par le propriétaire, pas par un lot technique.
3. **Un cran `text-2xs` (11 px) entre dans l'échelle Tailwind** ; les 63 × 10 px remontent à
   11 px ; les 13 × 9 px disparaissent ; les tailles en px passent en rem.
4. **Le ton `purple` devient un jeton** (`--special` ou `--tag-purple`) — badge.tsx n'a plus
   une seule classe de palette brute.
5. **Le sombre est déclaré hors périmètre** (jusqu'à décision contraire) : purge des 33
   `dark:`, `theme-color` unique clair. Le jour où le sombre devient un chantier, il commence
   par `globals.css`, pas par des classes éparses.
6. **`.ik-mail`** : l'identité Infomaniak est gardée pour les **accents** (boutons, actifs),
   mais ses verts/oranges/bleus ne portent plus de **texte** sur blanc — variantes foncées
   locales (mêmes teintes, L abaissé).
7. **`artifact.css` migre sur `--chief-*`** comme ses deux voisines.
8. **Utilitaires morts** : `.badge-soft` supprimé (le composant `Badge` a gagné) ;
   `.table-clean` / `.mobile-cards` soit adoptés sur les tableaux qui en relèvent, soit retirés.

## 5. Plan de correction — par lots, chacun vérifiable

| Lot | Contenu | Vérification |
|---|---|---|
| **U1 — Jetons de contraste** | décisions 1, 2, 4 : 4 valeurs dans `globals.css` + 1 ton dans `badge.tsx` | script de contraste (repris de cet audit) ajouté en **test** : toute paire déclarée < 4,5:1 fait échouer la suite |
| **U2 — Purge du sombre fantôme** | décision 5 : 33 classes, 7 fichiers, 1 `theme-color` | grep `dark:` = 0 ; build propre |
| **U3 — Échelle typo** | décision 3 : ajout `text-2xs`, remplacement mécanique des 265 + 63 + 13 + px | grep `text-\[0\.` = 0 hors exceptions nommées |
| **U4 — Résorption palette brute** | les 4 pires fichiers d'abord (69 occ.), puis famille amber→`warning` (137) ; cartes locales → `labels.ts`/`StatusBadge` | compteur global 342 → < 100 (U4a), < 30 (U4b) ; **cliquet** en test comme la frontière Adam |
| **U5 — Focus & annonces** | `.focus-ring` posé sur `ui/*` + surfaces interactives chief ; région `aria-live` unique dans le layout, alimentée par les retours d'actions | axe-core sur 5 écrans types ; grep focus-visible ≥ 40 fichiers |
| **U6 — artifact.css → jetons** | décision 7 | hex bruts 32 → 0 |
| **U7 — Cliquet d'accès** | test qui balaie `src/app/(app)/**/page.tsx` et exige un motif de garde (liste d'exemptions nommées : `no-access`) | le test échoue si une page nouvelle est sans garde |
| **U8 — `.ik-mail` lisible** | décision 6 | contrastes recalculés ≥ 4,5 sur le texte |

Ordre U1 → U2 → U7 d'abord : trois lots **petits** (≤ 10 fichiers chacun) qui ferment le plus
grave (badges illisibles, incohérence sombre, garde non outillée). U4 est le seul gros lot et
il a son cliquet, comme la dette de frontière — le chiffre ne peut que descendre.

---

*Audit réalisé en lecture seule ; aucune correction incluse dans ce lot. Les commandes de
mesure sont reproductibles depuis ce document (grep/find sur `src/`, script de contraste WCAG
sur les HSL des deux chartes).*
