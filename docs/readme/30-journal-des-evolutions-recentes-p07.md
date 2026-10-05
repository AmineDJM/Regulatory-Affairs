  - **Autant de passages d'analyse que d'onglets ouverts.** Le planificateur avait bien son verrou,
    mais la route « analyser maintenant » appelait le runner directement, sans passer par lui.
    Chaque fin de téléversement, chaque rafraîchissement lançait donc son propre passage de deux
    minutes, prenant jusqu'à vingt jobs de front. Désormais **un seul passage à la fois** dans le
    processus, et la route **répond tout de suite** au lieu de tenir une requête HTTP ouverte
    pendant deux minutes pour une réponse que personne ne lit.
  - **Le ménage de la tentative précédente, payé d'avance.** L'ouverture de session supprimait les
    parties des envois abandonnés — des lignes de plusieurs Mo, parfois des centaines — avant de
    démarrer. Plus l'utilisateur réessayait, plus il y avait à nettoyer. L'abandon (ce qui libère
    la limite d'envois simultanés) reste immédiat ; les octets partent en fond, par paquets, avec
    un filet côté planificateur si un redéploiement interrompt le ménage.
  Et parce qu'un serveur occupé restera toujours possible, **l'ouverture de session réessaie** —
  c'était la seule étape de l'envoi qui n'avait aucune reprise, là où toutes les autres en ont
  depuis toujours. Quatre tentatives, attente croissante ; un refus motivé (quota, droits, fichier
  non-ZIP) s'affiche toujours immédiatement au lieu d'être confondu avec une lenteur.

- **Téléversement CTD deux fois plus rapide — en mesurant au lieu de supposer.** Trois corrections,
  toutes appuyées sur des mesures reproductibles (`scripts/bench/`) :
  - **L'archive originale quitte le chemin critique.** La conserver coûtait ~10 s par 60 Mo, soit
    **plus de la moitié** de la finalisation (et ~2 min pour 800 Mo). Or personne ne l'attend :
    elle sert à la traçabilité et au téléchargement, jamais à l'analyse, qui travaille sur les
    fichiers déjà stockés. L'ingestion rend donc la main dès que la version existe et l'archive
    rejoint la base **en fond**, écrite en flux depuis le disque (mémoire bornée à une tranche au
    lieu de l'archive entière) et **une à la fois** pour ne jamais monopoliser le pool de connexions.
    L'empreinte SHA-256, elle, est enregistrée **tout de suite** : la traçabilité ne dépend jamais
    du fond. Finalisation d'un dossier de 60 Mo : **16,5 s → 3,7 s**.
  - **Parties de 16 Mo → retour à 4 Mo : grossir les parties RALENTISSAIT.** Le pari « moins
    d'allers-retours = plus rapide » supposait que le coût dominant soit la poignée de main. C'est
    l'écriture des octets : Postgres plafonne à ~11 Mo/s et écrit d'autant moins vite qu'on lui
    présente une valeur `bytea` volumineuse d'un seul tenant. Mesuré à 8 envois parallèles sur le
    même ZIP de 60 Mo — 1 Mo : 8,2 s · 4 Mo : 9,0 s · 8 Mo : 10,8 s · **16 Mo : 16,3 s**. Sur un lien
    mobile, une partie de 16 Mo dépassait en plus le délai de garde de 90 s du navigateur : elle
    était renvoyée, et c'est ce qui faisait **reculer la barre de progression**. Le parallélisme,
    lui, paie vraiment (9,6 s à un seul envoi contre 4,3 s à quatre) — il est conservé.
  - **La barre de progression ne recule plus jamais.** Elle affiche le point le plus avancé atteint :
    une partie rejouée marque une pause, puis repart. Reculer laissait croire que le travail était
    perdu alors qu'il était simplement refait.
  Au passage, la suite de tests elle-même était en panne silencieuse : deux fichiers ne se
  **chargeaient** pas (résolution de `next/server` par next-auth), leurs tests ne s'exécutaient donc
  pas sans que le total le signale. Corrigé dans `vitest.config.ts` — 133 fichiers, **950 tests**.

- **L'analyse cesse d'attendre entre deux lots.** Le planificateur ne se déclenche qu'une fois par
  minute, or plusieurs jobs se re-mettent en file pour reprendre où ils en étaient : un dossier de
  262 fichiers avançait par paliers d'un lot **toutes les minutes** — un quart d'heure d'attente
  pure, sans que rien ne calcule. Un passage travaille désormais **tant qu'il reste du travail**,
  dans une enveloppe de temps bornée (`REG_JOBS_BUDGET_MS`, 2 min), en cédant la main entre chaque
  unité. Au passage : lot d'extraction 20 → **40** documents, parts d'analyse envoyées en parallèle
  au modèle 4 → **8** (c'est de l'attente réseau : doubler divise le temps sans coûter un jeton),
  et parties envoyées en parallèle 3 → **8**.
  ⚠️ Le gain suivant, bien plus grand, n'est pas dans le code : **activer le stockage objet**
  (`REG_S3_*`) fait envoyer l'archive DIRECTEMENT au bucket au lieu de la faire transiter par
  l'application puis par Postgres — diagnostic intégré : `/api/regulatory/intelligence/upload/diagnose`.

- **L'écran d'analyse se recentre sur sa raison d'être.** La **génération documentaire à partir
  de modèles à trous** (note de pré-soumission, formulaire d'enregistrement, demandes de
  modification/renouvellement/transfert) est retirée : elle produisait des coquilles à remplir à
  la main — pas du travail fait — et occupait une place que le pharmacien lit à chaque passage. Le
  parcours tient désormais en une ligne : **déposer le dossier → l'analyse le passe au crible
  (fond ET forme) → constats et réserves probables → tout lever → déposer à l'ANPP → charger les
  réserves reçues → répondre**. Les deux seuls documents qui restent produits sont ceux que le
  service ne peut pas obtenir autrement : le **rapport de constats** et la **lettre de réponse aux
  réserves** ; ils apparaissent dans une simple liste de téléchargement.

- **Les dossiers DÉJÀ en base sont rattrapés automatiquement.** Changer un défaut ne vaut que pour
  les nouvelles analyses : les dossiers déjà « En revue » seraient restés avec une revue de fond
  différée — voire jamais livrée (lot expiré, clé changée). Le planificateur repère désormais deux
  situations et les répare seul : une version dont la revue de fond **n'a rien livré** est relancée
  en **analyse immédiate**, et un pipeline **arrêté en chemin** (plus aucune tâche en file, aucun
  bilan) repart. Garde-fous : **une seule fois par version** (marqueur dans le journal d'audit —
  jamais de boucle payante), jamais par-dessus un travail en cours ni un lot encore en vol
  (< 26 h), deux versions par passage au plus, plafond budgétaire toujours actif, coupure par
  `REG_AI_CATCHUP=0`. → [référence](#4-coût--voir-réutiliser-plafonner)

- **La revue de fond passe en IMMÉDIAT par défaut.** Le différé (moitié prix, sous 24 h) était le
  défaut : un dossier affiché « en revue » pouvait donc l'être **sans ses constats les plus
  exigeants**, encore en attente chez le fournisseur — exactement l'impression de « dossier presque
  parfait » qu'on ne veut pas donner. On paie désormais plein tarif et on voit tout de suite ; le
  différé reste d'un clic (bouton « Réanalyser à moitié prix ») pour les grosses réanalyses lancées
  le soir. Aucun réglage d'hébergement : le défaut est dans le code.

- **« Analyse en cours » n'est plus une boîte noire.** Une carte vivante montre l'analyse du
  début à la fin : étape courante (réception → lecture des fichiers → OCR → données → conformité
  → revue de fond IA), pourcentage honnête, **temps restant estimé** au débit réel de lecture, et
  une barre qui balaie tant que ça avance. Elle s'actualise seule et — détail voulu — la regarder
  suffit à faire avancer l'analyse (chaque rafraîchissement réveille le planificateur). Sur la
  liste, le badge « Analyse en cours » affiche désormais le %. Au passage : le **Simulateur
  d'examen** ne renvoie plus « Sortie non conforme au schéma » — son schéma Zod rigide rejetait
  toute la simulation pour un détail (verdict en minuscules, question trop longue, 11ᵉ
  perspective) ; la sortie est désormais mise en forme avec tolérance.

- **Entraînement de l'IA : l'analyseur apprend de NOS produits passés.** Nouveau module (Super
  Admin, onglet « Entraînement IA ») : une étude de cas = un produit déjà déposé + son issue
  réelle à l'ANPP + la leçon retenue, et les pièces de son dossier déposées comme au corpus
  (l'envoi démarre tout seul). À chaque analyse, les 3 meilleurs précédents de la section sont
  injectés dans le prompt — issues instructives d'abord — pour calibrer la sévérité et anticiper
  les réserves ; un précédent ne fonde jamais une règle (frontière testée). Le corpus, lui, est
  devenu « déposer = utilisé » (fin du purgatoire d'activation, migration de rattrapage incluse)
  et réservé à l'administrateur. → [référence](#10-entraînement-de-lia--lécole-de-lanalyseur-super-admin)

- **Analyseur CTD « god mode » : la page devient une preuve, l'outil insiste tout seul, et les
  livrables sortent en un clic.** Chaque constat connaît désormais sa page **exacte** : carte des
  pages construite à l'extraction (native et OCR), offsets réels par part d'analyse, et surtout
  **ancrage de la citation** — l'extrait cité est recherché dans le texte, la page retrouvée prime
  l'estimation du modèle, une preuve introuvable rend `null` plutôt qu'une page inventée. À
  l'écran, la page est un **lien qui ouvre le PDF au bon endroit**, et les constats sont redessinés
  pour le pharmacien (gravité d'abord, compteurs, citation en exergue, badge DÉFENDABLE). Une
  section critique déclenche **automatiquement** les agents spécialistes concernés (max 4, jamais
  deux fois, débrayable). Le corpus devient **bilingue de fait** : recherche hybride plein-texte ∪
  embeddings — « durée de conservation » trouve enfin « shelf life ». Et quatre livrables : rapport
  de constats .docx, lettre de réponse aux réserves .docx (verbatim + réponses, jamais
  d'invention), **verdict GO/NO-GO** en tête de dossier avec réserves les plus probables, contrôle
  **notice en arabe** (décret n° 92-286, texte natif seulement), constat → **tâche** en un clic.
  → [référence](#9-pages-exactes-escalade-sémantique-livrables--god-mode-)

- **Analyseur CTD : couverture intégrale, examen visuel, coût enfin réel.** Quatre plafonds
  silencieux écartaient du contenu sans que rien ne distingue « analysé » de « analysé à 8 % » :
  120 parts d'analyse, 25 pages d'OCR, 60 pages de vision, 1 Go par fichier. Tous levés — la
  rastérisation passe **en flux** (une page vit à la fois), donc le nombre de pages ne compte
  plus. Le module de lecture des figures, qui n'était **appelé par personne**, est branché et
  porte en plus un **contrôle de forme** : capture d'écran, photo d'écran, scan illisible,
  filigrane « brouillon », signature absente — des défauts qu'aucune analyse de texte ne peut
  voir, puisque l'OCR d'une capture d'écran rend un texte impeccable. Et surtout : la revue
  passait par un modèle **non tracé**, si bien que la carte de coût montrait tout sauf l'analyse
  et que le plafond budgétaire ne plafonnait rien. Corrigé — et l'analyse part désormais en
  **différé à moitié prix** par défaut, en autant de lots que nécessaire pour lire la version
  entière. → [référence](#analyseur-ctd--réserves-anpp-corpus-et-coût)

- **Le cloisonnement par entité devient réel.** « Si je mets la vue Adventum, je veux voir que Adventum » n'était
  vrai que de Regulatory, des ventes, de la logistique, de la promotion médicale et des RH. Le **budget**,
  l'**Ad & Pro**, les **finances** et les **demandes** n'avaient aucune entité : basculer le sélecteur laissait voir
  les demandes d'une autre société. Le sélecteur n'était pas un cloisonnement, c'était une décoration. **Dix tables**
  reçoivent une entité ; les **RH n'en reçoivent pas**, délibérément — congés, paie et avances pendent d'un employé
  qui porte déjà la sienne. Le rattachement rétroactif **ne devine rien** (il se déduit du demandeur, et d'ailleurs
  de la **demande source** pour un ordre de dépense, qui est plus fiable). Un enregistrement **non rattaché reste
  visible partout** : le filtrer strictement le rendrait invisible depuis toutes les vues d'un salarié mono-entité,
  ce qui serait de la perte de travail, pas du cloisonnement. Et **moins de deux entités ⇒ aucun filtre**.
  → [référence](#dimension-multi-entités-sociétés-du-groupe)

- **Les accès aux budgets départementaux se règlent.** Le socle par rôle valait partout à la fois ; le Super Admin
  peut désormais ouvrir **département par département** (plus une règle générale), en distinguant **qui voit**, **qui
  édite le fonctionnement** et **qui édite les employés** — trois populations différentes. Les autorisations
  **s'ajoutent** et ne retirent jamais rien : poser la première ne doit pas priver les RH du budget des employés par
  effet de bord. → [référence](#budget-par-département--deux-natures-deux-responsables)

- **Chaque département a son budget — réglé par deux personnes différentes.** Le fonctionnement (**hors employés**)
  par l'**administrateur** ; les **employés et le recrutement** par les **ressources humaines**. Comme les deux
  responsables n'écrivent jamais la même ligne, l'un ne peut pas écraser l'autre. Les deux colonnes sont **côte à
  côte** — une case non modifiable est affichée **en lecture**, pas masquée : c'est la seule façon de voir ce que
  coûte réellement un département. La **masse salariale réelle** est calculée depuis la paie, jamais saisie.
  → [référence](#budget-par-département--deux-natures-deux-responsables)

- **On peut enfin corriger une demande Ad & Pro.** Il fallait supprimer et recommencer, en perdant la référence,
  les pièces jointes, les postes et l'avancement du circuit. Deux règles : **ce qui a fondé une décision ne se
  réécrit pas** (après décision, seule la Direction — et l'audit le note « APRÈS DÉCISION »), et **les champs de
  décision ne sont jamais modifiables ici** — d'où une liste blanche dont le formulaire ET la requête sont dérivés.
  Au passage, la Direction Marketing, le National Sales et la Direction peuvent **joindre un fichier à leur avis** ;
  les pièces sont contrôlées **avant** que le circuit n'avance, pour ne pas laisser une décision prise et sa
  justification perdue. → [référence](#ad--pro--corriger-une-demande-joindre-un-fichier-à-un-avis)

- **L'assistant cherche là où les mots sont écrits, et sait modifier une fiche produit.** Trois échecs remontés
  d'une conversation réelle, trois causes distinctes : la recherche Regulatory ignorait la **classe thérapeutique**
  (d'où zéro résultat sur « oncologie » ou « biosimilaire ») et plafonnait à 12 lignes ; aucun outil d'écriture
  n'existait (« je ne dispose pas d'un outil pour modifier une fiche produit » — c'était vrai) ; et six
  allers-retours ne suffisaient pas à lister un portefeuille. Le nouvel outil décrit un lot par **filtre**, pas par
  liste devinée, et **rejoue ce filtre à l'exécution** pour que ce qui change soit exactement ce qui a été montré.
  → [référence](#assistant--recherche-regulatory-complète-et-écriture-sur-les-produits)

- **Les conversations de l'assistant passent en production.** Fils persistants, historique par date, nouvelle
  conversation, suppression, droit à l'oubli : tout existait mais restait au stade **TEST**, donc invisible hors
  comptes de test. Les échanges, eux, étaient **déjà enregistrés** — la promotion rend visible un historique qui
  existait. Retour arrière immédiat depuis `/admin/versions`.
  → [référence](#assistant--mémoire-personnelle-cloisonnée-par-construction)

- **Force de vente : l'affectation devient un périmètre.** La matrice KAM × produit × cycle
  existait déjà dans « Prévisions & Force de vente » — mais **elle ne pilotait rien** : personne
  ne voyait « sa » gamme, et les formulaires proposaient tout le catalogue à tout le monde. Le
  portefeuille devient lisible depuis l'espace personnel (**gamme ville / hôpital**, produits et
  priorité P1/P2/P3), et sert de base au filtrage des formulaires. Un **superviseur** voit les
  siens **et** ceux de son équipe, sans confondre les deux. Quand le cycle en cours n'est pas
  encore arrêté, on **reporte le dernier connu en le disant** : sans report un délégué serait à
  vide le 1er du mois, sans le dire il croirait son portefeuille reconduit. Le paramétrage reste
  hors RH, à dessein — porter tel produit relève du business et change au fil des cycles.
  → [référence](#force-de-vente--gamme-et-produits-attribués)

- **Prise en charge : une ligne par personne.** Le module ne traite pas d'un congrès — il traite
  de **personnes** qu'on emmène quelque part. « Congrès nationaux/internationaux » devient donc
  **« Prises en charge Nationales/Internationales »**, et les participants cessent d'être un
  tableau JSON. Chacun porte désormais **l'avis du demandeur** (favorable · défavorable · pas
  d'avis), **la décision de la Direction prise personne par personne** — on en accorde une et on
  en écarte une autre sans refuser l'ensemble — et **sa propre liste de besoins** : l'une a
  besoin d'un visa et pas l'autre, l'une loge à l'hôtel et l'autre chez elle. Deux natures de
  besoins, qui ne se traitent pas pareil : une **pièce à fournir** qu'on collecte, et un
  **élément à acheter** (hôtellerie, transport, billet, restauration, inscription) qui passe par
  un devis. Le secrétariat enregistre les devis **tels qu'ils arrivent** — une agence chiffre le
  groupe entier —, chacun accepté ou refusé d'un bloc, et l'acceptation émet l'ordre de dépense.
  Le passage aux Finances est **refusé tant que quelque chose manque, en disant quoi**.
  → [référence](#prise-en-charge--personnes-besoins-et-devis)

- **Ad & Pro : de quoi est fait le montant.** Un sponsoring est rarement un simple chèque, un
  congrès rarement une simple inscription — il y a l'appui à l'association, mais aussi le stand, le
  symposium, les brochures produites pour l'occasion. Les modules ne portaient qu'un **montant
  global** : on ne savait ni de quoi il était fait, ni à qui allait l'argent. **Sponsoring et
  congrès nationaux** portent désormais des **postes** (stand · symposium · matériel promotionnel ·
  prestation · déplacement · autre), chacun avec son bénéficiaire et **son ordre de
  dépense** — parce que le stand se paie à l'organisateur, le matériel à l'agence et l'appui à
  l'association. La Direction accorde toujours **une enveloppe globale** ; les postes s'en
  répartissent, et l'écran affiche en permanence ce qui reste à affecter — ou **ce qui dépasse**.
  Un poste ajouté après la décision est **autorisé et tracé** : il fait apparaître le dépassement
  au lieu de le laisser découvrir à la facture. Le matériel promotionnel n'est jamais recopié ici :
  le poste **renvoie** à un `PromoMaterial` qui suit son propre circuit (visa publicitaire,
  conformité, agence, BAT). Sur un congrès, `hasBooth` / `hasSymposium` n'étaient que des
  **intentions jamais chiffrées** : l'écran signale désormais un stand ou un symposium annoncé que
  personne n'a budgété. → [référence](#ad--pro--postes-et-ventilation-de-lenveloppe)
- **Mobile : fin des superpositions.** Trois défauts donnaient la même impression de modules qui se
  marchent dessus. La **barre d'onglets était au-dessus des modales** (`z-60` contre `z-50`) : un
  bouton de validation en bas d'une feuille était visible mais intouchable. Le **verrou de
  défilement ne verrouillait rien** — il figeait le `body`, alors que le conteneur qui défile est
  le `<main>` ; on ouvrait le menu, on faisait glisser le doigt, et c'était la page derrière qui
  bougeait. Et trois écrans pleine hauteur recopiaient des **hauteurs écrites au jugé**
  (`100dvh-3.5rem`, `100dvh-7.5rem`) qui ne correspondaient à aucune barre réelle — d'où le champ
  de saisie de l'assistant caché derrière la barre d'onglets. Échelle de superposition unifiée,
  verrou compté sur le vrai conteneur, hauteurs **mesurées** et non devinées.
  → [référence](#mobile--superposition-défilement-et-hauteurs)

- **Analyseur CTD : la mémoire des réserves ANPP, un corpus qui se tient à jour, et un coût qu'on
  voit.** Refonte de fond en six lots. **(1) Bibliothèque des réserves ANPP** — une lettre reçue
  (PDF, scan, courriel) est lue *page par page en image* quand l'OCR ne suffit pas, décomposée en
  points avec leur **verbatim**, et rangée avec sa preuve (fichier, page, extrait). On peut alors
  demander « cette réserve, l'avons-nous déjà eue ? » et récupérer **la réponse qui avait été
  acceptée**. **(2) Apprentissage borné** : quand un même reproche revient trois fois, le système
  *propose* une règle — elle reste **sans effet** jusqu'à validation humaine, et sa confiance
  plafonne à 0,9 (une observation ne devient jamais une loi). **(3) Constats défendables** : chaque
  constat porte la règle appliquée, la **page**, l'**extrait exact**, les valeurs qui se
  contredisent, la recommandation, et les précédents ANPP comparables — l'écran dit aussi ce qui
  **manque** pour qu'il soit opposable. **(4) Corpus** : 43 sources cataloguées (ANPP, ICH, OMS,
  EMA), téléchargement et **veille quotidienne des pages ANPP** qui alerte quand un texte bouge ;
  les sources sous licence sont *citées, jamais copiées*, et une version ingérée reste **DRAFT**
  tant qu'un humain ne l'active pas. **(5) Multimodal** : les graphiques, chromatogrammes et
  tableaux d'image sont lus comme images, pas devinés depuis un OCR approximatif. **(6) Coût
  maîtrisé** : chaque appel est tracé au fichier près, un résultat déjà calculé n'est jamais
  repayé, un **plafond par dossier** arrête la dépense *et le dit*, et une **analyse différée à
  moitié prix** (résultats sous 24 h) est proposée pour les réanalyses complètes — même consigne,
  même exigence, seule la facturation change.
  → [référence](#analyseur-ctd--réserves-anpp-corpus-et-coût)
- **Assistant : plein écran, conversations, et une réponse qui s'écrit.** Fini le long silence
  suivi d'un pavé : vrai **streaming** (le texte remonte au fil de sa génération), étapes de
  lecture annoncées en direct, rail des conversations regroupées par ancienneté, bouton
  **arrêter** qui conserve ce qui a déjà été écrit. Les garanties ne bougent pas : identité
  issue de la session, assistant désactivé en « Vue exacte », toute action d'écriture
  interceptée et confirmée. → [référence](#assistant--plein-écran-conversations-réponse-en-flux)
- **Regulatory : colonne « niveau de process », et la variation obtenue fait foi.** Importation
  → Secondary → Primary → Full Process. Le niveau est désormais **calculé** à la lecture plutôt
  que recopié à l'écriture : une modification de la fiche ne peut plus diverger de la décision
  de l'ANPP. La cellule dit d'où vient la valeur (« déclaré » / « variation obtenue ») et
  signale une variation en attente sans la compter comme acquise.
  → [référence](#regulatory--niveau-de-process-la-variation-obtenue-fait-foi)
- **RH : quatre écrans, et les questions du quotidien.** La page à sept sections devient
  *À traiter* / *Équipe* / *Congés* / *Départements*. Sur le fond, ce qui manquait vraiment :
  **qui est absent aujourd'hui**, qui part dans les 14 jours, les **fins de période d'essai** et
  de contrat côte à côte, les soldes de congés à risque, et une **recherche** dans l'annuaire.
  → [référence](#rh--quatre-écrans-et-les-questions-du-quotidien)
- **Mobile : l'écran respire.** Cartes de premier niveau **bord à bord**, tableaux qui défilent
  bord à bord, marges réduites, titres compacts — et les tiroirs deviennent des **feuilles qui
  montent du bas**, avec une poignée, comme dans une application native.
  → [référence](#mobile--lécran-respire)

- **Budgets : un module simple — on regarde, on travaille, on règle.** Tout tenait sur un écran : sélecteur
  d'enveloppe, budget total et son réglage, période, export, édition, quatre indicateurs, un graphique, les
  catégories et leurs boutons, un formulaire de saisie, deux listes de dépenses, quatre tiroirs. On ne pouvait pas
  **consulter** son budget sans traverser tout ce qui le **modifie**. Désormais **trois écrans, un par intention** :
  la **vue d'ensemble** ne fait que lire (le reste à dépenser en grand, une jauge, un **camembert**, une **courbe**
  face au **rythme théorique**, des **barres** par catégorie) ; les **dépenses** mettent en premier ce qui est à
  imputer ; les **réglages** réunissent ce qui se paramètre. → [référence](#-budgets-enveloppes--sous-catégories)
- **Intelligence marché : la maille MOLÉCULE, et l'environnement concurrentiel.** On cherche par la case que l'on
  remplit — molécule, produit, ou laboratoire. Une molécule au sens métier est un **triplet molécule + dosage +
  forme** : l'amoxicilline 500 mg gélule et l'amoxicilline 1 g injectable ne s'affrontent pas sur le même marché.
  L'analyse répond : poids du marché, **part ville / part hôpital** en %, **parts de marché** de chaque laboratoire,
  concentration, et **fabriqué en Algérie ou importé**. Le vrai travail a été de réconcilier trois sources qui
  n'écrivent rien pareil — radical de molécule, forme galénique canonique (formes non reconnues : **32,6 % → 3,8 %**
  de la valeur), noyau de raison sociale. → [référence](#intelligence-marché--la-maille-molécule)
- **PCH : un appel d'offres lu par l'IA devient un tableau Excel prêt à chiffrer.** Téléverser le document suffit :
  OCR, extraction des produits, **puis enrichissement automatique de chaque ligne** (avant, il fallait cliquer
  ligne par ligne — sur quarante produits, personne ne le faisait). L'IA extrait en plus la **nature de l'unité**
  demandée (flacon, ampoule, seringue…) : c'est ce mot qui donne son sens à la quantité. Chaque ligne reçoit la
  taille du marché, le partage ville / hôpital, les principaux concurrents et leur part, et la **production locale
  ou importée**. Livrable : un **Excel en deux feuilles**, avec les **boîtes à fournir** arrondies au supérieur et
  les colonnes sans donnée laissées vides. → [référence](#pch--un-appel-doffres-lu-par-lia-devient-un-tableau-excel)

- **Version de TEST → version de PRODUCTION, validée d'un clic.** Toute nouveauté arrive au stade **TEST** :
  invisible de l'entreprise, visible du seul compte en **mode test**. Le Super Admin la parcourt puis la **valide en
  production** — ou la retire, le retour arrière est immédiat. Une clé inconnue est **auto-créée en TEST** : rien ne
  peut être livré par accident. L'écran `/admin/versions` classe les nouveautés en trois groupes, et un bandeau
  permanent rappelle le mode test. Les onglets de menu peuvent porter un drapeau : ils n'existent que pour ceux qui
  voient la nouveauté. → [référence](#versions-test--production-drapeaux-de-nouveautés)
- **Assistant : mémoire personnelle, cloisonnée par construction.** L'assistant se souvient de **sa** personne — son
  identité, son entité, son département, son **N+1 réel**, et une note distillée de ses échanges (réécrite tous les
  ~12 messages). Les conversations sont conservées : on les rouvre, on les supprime, ou on **efface tout** (droit à
  l'oubli). Le cloisonnement n'est pas une convention mais une **structure** : un module unique est la seule porte
  d'entrée, tout `where` porte le `userId` du demandeur, `AssistantMessage` porte lui aussi son propriétaire, et en
  **« Vue exacte »** l'assistant est **désactivé** — la mémoire d'une personne ne s'ouvre à personne, pas même à un
  administrateur. **8 tests tentent explicitement la fuite** (lire / écrire / supprimer le fil d'un autre en
  connaissant son identifiant exact) et vérifient qu'elle échoue. → [référence](#assistant--mémoire-personnelle-cloisonnée-par-construction)
- **Écran « Aujourd'hui » + point du matin.** Un accueil qui répond à une seule question : *que dois-je faire
  maintenant ?* Une action mise en avant, quatre suivantes, le reste replié. Aucune nouvelle source de données — le
  classement (`rankToday`, pure et testée) fait le travail : le retard passe devant et remonte avec sa durée, une
  **validation** (qui bloque un collègue) passe avant une tâche personnelle, et **chaque ligne dit pourquoi elle est
  là**. En tête, l'assistant écrit le **point du matin** en 3-5 phrases — un seul appel IA par personne et par jour.
  → [référence](#écran--aujourdhui--point-du-matin)
- **Courrier « smart » : envoi par API HTTPS, fin des blocages SMTP.** Les ports SMTP sont filtrés à peu près
  partout ; l'envoi passe désormais par une **API HTTPS sur le port 443**. Le code est **agnostique du fournisseur**
  (Resend / Postmark / Brevo) : changer de fournisseur = changer deux variables. Chaque envoi est **journalisé avec
  le motif exact du refus** — c'est précisément ce qui manquait. Réception par **webhook signé** (HMAC-SHA256 du
  corps brut, comparaison en temps constant, idempotent). ⚠️ Reste à faire **hors application** : ouvrir un compte
  fournisseur et **vérifier le domaine** (SPF + DKIM + DMARC en DNS) ; `/admin/courrier` dit précisément ce qui
  manque et permet un envoi de test. → [référence](#courrier--smart---envoi-par-api-https-sans-smtp)
- **Structure par DÉPARTEMENTS — hiérarchie N niveaux, responsables et validation par le N+1 réel.** L'entreprise
  se pense désormais par département (le **rôle** dit ce qu'on peut faire, le **département** sur quel périmètre et
  **qui valide**). `Department` gagne une hiérarchie sur **N niveaux**, un **responsable** et un **adjoint** ;
  `Employee.departmentId` devient le rattachement de référence (l'ancien champ texte reste en **cache de libellé**,
  donc rien de l'existant ne casse). La migration **reprend les données réelles** : chaque libellé distinct devient
  un vrai département et les employés y sont rattachés. Le **N+1 réel** se résout en cascade (manager de
  l'organigramme → responsable du département → responsable du parent), avec une règle stricte : *on ne se valide
  jamais soi-même*, et le chef d'un département est validé **par le dessus** (l'adjoint supplée une absence, il ne
  valide pas son chef). Deux nouvelles portées d'étape (`DEPARTMENT_MANAGER`, `DEPARTMENT_HEAD`) rendent les
  **circuits génériques** — plus besoin de recâbler un rôle à chaque réorganisation — avec **escalade** par la
  hiérarchie supérieure et **notification** du N+1 concerné. Gestion dans **RH** (`/rh/departements`) ; la fiche
  employé affiche le **N+1 effectif et sa provenance**. → [référence](#départements-sous-départements--hiérarchie-réelle-n1)
- **Congés : le DRH peut tout corriger, y compris l'historique** (`updateLeaveRequest`) — type, dates, jours, motif,
  décision et note d'une demande **déjà décidée**, avec **réajustement automatique du solde annuel**.
- **Budgets : graphiques de consommation** — barres comparatives (budget vs consommé, colorées par santé) en vue
  générale (**par enveloppe**) et dans une enveloppe (**par catégorie**).
- **Assistant : dictée vocale, lecture de pièces jointes et annonces pop-up.** Micro (Whisper → texte **éditable**)
  sur la page et dans la **bulle flottante** ; lecture d'**Excel complet / PowerPoint / Word / PDF / CSV**, y compris
  des fichiers **déjà dans le Drive** (référencés, sans re-téléversement) ; diffusion de notifications en **pop-up
  plein écran**.
- **Intelligence marché : explorateur produits ville + hôpital.** Recherche **temps réel** et filtres sur les
  produits IQVIA (ville) **et** les réceptions PCH (hôpital), sélection multiple et comparaison volume / valeur /
  prix moyen / croissance.
- **Drive « Accueil » façon vrai drive + téléversements fiables + thème plus vif.** Le **Drive** est renommé
  **« Accueil »** (onglet, navigation, fil d'Ariane, titre) et l'onglet **« Documents »** est retiré des onglets du
  Drive (tout est consolidé dans l'Accueil + les catégories partagées). **Glisser-déposer à la souris** (`drive-table`) :
  on attrape un fichier/dossier et on le lâche sur un **autre dossier** (rangement) ou sur une **pastille de catégorie**
  (déplacement vers la catégorie), avec pastille « Accueil (mon Drive) » pour revenir au personnel — s'appuie sur
  `moveNode` (RBAC + anti-cycle côté serveur), barre de dépôt + retour visuel + toast. La **visionneuse ZIP** navigue
  désormais **dossier par dossier** comme un explorateur (fil d'Ariane, entrée dans les sous-dossiers, aperçu inline),
  au lieu d'une liste plate de chemins. **Téléversements fiables** : les limites de taille (25 Mo Documents / 100 Mo
  Drive) faisaient échouer à 100 % l'envoi d'un ZIP de dossier entier → relevées à **200 Mo / 1 Go** (défauts + ligne
  `AppSetting` existante via migration `GREATEST`, jamais de baisse d'un réglage volontaire ; `putBlob` stocke déjà en
  tranches ~1 Go). **Thème** rafraîchi (science UX Apple HIG / Salesforce Lightning) : primaire **azur vif** accessible,
  accents et statuts plus lumineux, sidebar bleu profond, élévation « carte » plus douce.
- **RH — workflow par nature de demande.** Le module RH s'adapte à la **nature** de chaque demande : un **congé /
  absence / autorisation de sortie** (congé exceptionnel, sortie exceptionnelle, congé annuel…) affiche une décision
  **Accorder / Refuser** (`decideHrLeave`, nouveau statut `APPROVED` « Accordée ») au lieu du flux documentaire
  (Soumise → Prête → Remise). Classifieur `hrNature()` (`hr-request-flow.ts`) : DOCUMENT / APPROBATION / NOTE DE FRAIS /
  ENTREVUE. Un congé annuel accordé débite le solde (verrou `balanceAppliedAt`). Le flux documentaire (statut de
  préparation + « joindre le document ») reste réservé aux vraies demandes de document.
- **Adventum Autonomous Test Center (Administration → Test Center, Super Admin) — Phase 1 : fondation de sûreté.**
  Infrastructure de certification autonome, **conçue sécurité d'abord** : un run ne touche **aucune** donnée
  préexistante — il ne supprime **que** les ressources qu'il a lui-même créées, inscrites au fur et à mesure dans un
  **manifeste** (`TestArtifact`) par **ID exact**. Règle absolue : *jamais* de suppression par nom ni par préfixe
  (« ce n'est pas parce qu'un nom contient “test” qu'on le supprime »). Le nettoyage s'exécute en **ordre inverse de
  dépendance**, puis une **vérification post-nettoyage** re-interroge la base par ID pour prouver l'absence de tout
  résidu ; un modèle non pris en charge est **refusé** (pas deviné). Deux modes en phase 1 : **Audit lecture seule**
  (aucune écriture — réutilise le moteur de Diagnostic pour la santé/cohérence) et **Test synthétique sûr** (crée une
  identité **inactive** par rôle réel sur un domaine **non routable** `qa.adventum.invalid` — jamais de vrai e-mail ni
  de connexion possible —, exécute les smoke tests, puis **nettoie et vérifie**). **Production en lecture seule par
  défaut** : tout mode d'écriture y exige une confirmation explicite **+ phrase de sécurité**. Les **secrets/mots de
  passe/tokens/données RH** sont **expurgés** des rapports et journaux (`redact`). **Reprise sur interruption** : les
  runs restés en cours ou au nettoyage incomplet sont détectés et rejouables (jamais de nettoyage automatique
  silencieux). Chaque run porte un `TestRunMode`, un statut, un `cleanupStatus` vérifié, un score, des **constats**
  (`TestFinding`, preuves expurgées) et un historique. Livré **testé** : invariant de sûreté (leurre hors-manifeste
  préservé, modèle inconnu refusé) + run synthétique de bout en bout (créées = supprimées, 0 résidu vérifié en base).
  Fichiers : `src/lib/test-center/{types,redact,guard,manifest,synthetic,smoke,runner,recovery}.ts` (+ `README.md`
  d'architecture), actions `test-center-actions.ts`, requêtes `queries/test-center.ts`, page `/admin/test-center`,
  modèles Prisma `TestRun`/`TestArtifact`/`TestFinding`, onglet dans `ADMIN_TABS`.
  - **Phases 2→5 (GOD MODE) — l'audit devient certification.** Chaque run (les deux modes sûrs) enchaîne désormais
    smoke → **audit approfondi** → **infra** → **auto-validation du testeur** → **certification** :
    - **Invariants métier (§28)** indépendants de l'UI : 8 invariants prouvables (rôle RBAC connu, couplage
      instance-workflow, couplage validation décision↔date, montant ≥ 0, modules d'enveloppe ⊆ RBAC, marqueur de
      congés, intégrité référentielle congé→employé et audit→auteur) ; un invariant critique **bloque la certification**.
    - **Machines à états (§29)** : 6 objets métier déclarés (ordre de dépense, validation, instance workflow, congrès
      intl/national, événement, congé) — distribution vivante, violations de couplage structurel, et **couverture des
      transitions** réellement observées via le journal d'audit.
    - **Cohérence multi-oracles (§30)** : Σ(états)=total, liens `expenseOrderId` module↔finance, couverture d'audit.
    - **Environnements éphémères (§31)** : schéma PostgreSQL jetable (garde-fou `tc_eph_`, destruction vérifiée) ;
      **certification migrations & reprise (§35)** : migrations disque↔`_prisma_migrations` + **roundtrip
      sauvegarde→perte→restauration** prouvé dans un schéma jetable.
    - **GOD MODE — le testeur se valide lui-même (§27)** : moteur de **property-based testing** maison (générateurs
      semés + réduction §34), **mutation testing** (corruptions synthétiques → la suite doit toutes les tuer, 0
      survivant = suffisante), **tests métamorphiques** (dont robustesse de l'extraction JSON d'IA au bruit de
      formatage), **fuzzing** des validateurs d'upload (totalité + refus des exécutables), **détection d'instabilité**
      (reproductibilité), **Time Travel (§33)** (acquisition de congés idempotente, « une fois par période », sans
      toucher l'horloge serveur).
    - **Certification (§36)** : verdict **CERTIFIÉ / avec réserves / BLOQUÉ / NON CONCLUANT** (jamais un run incomplet
      présenté comme réussi), **paquet de preuves immuable** scellé par un **sha256** (commit, env, couverture,
      exclusions, résultats, manifeste, nettoyage, versions des modèles IA, empreinte des constats), et **différentiel
      (§32)** vs run précédent (améliorations / régressions). Dashboard : badge de certification, auto-validation,
      couvertures, différentiel, empreinte de preuve.
    Fichiers : `src/lib/test-center/{invariants/*,state-machines/*,oracles/*,coverage,deep-audit,ephemeral,
    migration-cert,infra-checks,god/*,certify,evidence,differential}.ts` ; migration `..._test_center_certification`.
    Tout est **pur ou lecture seule** hors identités synthétiques nettoyées ; aucune règle de sûreté §1 n'est enfreinte.
- **Diagnostic de plateforme (Administration → Diagnostic, Super Admin) — « le médecin » dopé à l'IA.** Onglet qui
  **sonde le fonctionnement réel** (lecture seule, données réelles, aucune simulation) : base de données + latence,
  IA/STT, stockage, notifications push ; **couverture des rôles critiques** (ex. plus aucun *National Sales* → les
  demandes de délégués resteraient bloquées au préliminaire) ; **files d'attente bloquées** (circuits Ad & Pro,
  ordres de dépense, demandes de validation en souffrance depuis > 21 j) ; **formats de fichiers acceptés par espace**
  — testés **en direct** sur les vrais validateurs (« cet espace refuse .svg/.heic/.mp4… ») ; **cohérence
  navigation ↔ RBAC** ; **volumétrie** par domaine ; **matrice rôles → modules**. Un **score de santé /100** et des
  **constats** classés (critique / à surveiller / info). Bouton **« Générer des idées » (IA)** : Claude analyse ces
  faits et rend des **corrections prioritaires, simplifications, améliorations et réglages rapides** concrets et
  spécifiques aux données. Fichiers : `src/lib/platform-audit/{engine,ai}.ts`, action `platform-audit-actions.ts`,
  page `/admin/diagnostic`, onglet dans `ADMIN_TABS`. Complète l'**auto-testeur CLI** (`npm run autotest`, cohérence
  statique + crawl navigateur) : le Diagnostic vit **dans l'app** et se concentre sur la santé **runtime** + les idées.
  - **Élévation « jury de design de classe mondiale ».** L'engine ajoute des **repères d'ergonomie** : densité de
    navigation (loi de Miller / nav Lightning), **rôles au périmètre de vue identique** (candidats à fusion — détecté
    réellement : Ventes = Logistique), cohérence des règles d'upload (*consistency* Apple HIG), **temps de réponse**
    d'une requête type, adéquation pharma. Le bouton « Idées » invoque un **jury d'experts** (Apple HIG · Microsoft
    Fluent 2 · Salesforce Lightning · WCAG 2.2 · heuristiques Nielsen) qui **note chaque axe /5** (responsivité,
    contenu/fond, forme/contenant, cohérence, navigation & vues, rôles, performance, résilience/hors-ligne, fichiers &
    formats, accessibilité, adéquation pharma) et rend points forts, corrections prioritaires et **inspirations à
    adopter**. Les axes navigateur sont réellement **mesurés** par le crawler `autotest:live` : temps de chargement,
    **débordement horizontal à 375 px** (responsivité mobile), **perte de connexion** (offline), erreurs console —
    constats `RESPONSIVE_OVERFLOW`, `SLOW_PAGE`, `OFFLINE_UNHANDLED`, `CONSOLE_ERRORS`.
- **Ad & Pro — routage intelligent : personne n'approuve sa propre demande.** À la création d'une demande
  (sponsoring / congrès / événement), on **saute** toute étape d'approbation au niveau ou en dessous du rang du
  créateur. Le **National Sales** désigne directement la Direction Marketing (sélecteur ajouté aux formulaires) et
  **saute son préliminaire** ; la **Direction Marketing**, la **Direction** ou le **Super Admin** **sautent préliminaire
  ET analyse** → validation définitive Direction. Logique centralisée dans `src/lib/workflow/origin.ts`
  (`adProOriginRank`/`adProInit`, testé) et câblée dans `createSponsoring`, `createCongressRequest`,
  `submitEventForApproval` ; le statut legacy de départ pilote à la fois les actions historiques et le moteur.
- **Auto-testeur dopé à l'IA (`npm run autotest`).** Outil sous `scripts/auto-test/` qui importe le **vrai** code
  RBAC/navigation et confronte pages ↔ gardes `requireModule` ↔ menu ↔ matrice rôles→modules : liens de menu morts,
  gardes de module inconnues, incohérences menu/réalité, modules orphelins (déterministe, aucun serveur ; code de
  sortie CI). Option **crawl en direct** (Playwright) : passe **anonyme** (détection de fuites d'accès), passes
  **par rôle** (comptes fournis ou semés jetables) comparant l'accès **réel** à l'accès prédit, dépôt de **pièces
  jointes jetables** (PDF+ZIP) dans les zones d'upload, capture des erreurs console / overlays Next. Option **triage
  IA** (`--ai`) réutilisant `src/lib/ai.ts`. Rapports `auto-test-report.{md,json}`.
- **Perf disque — écritures `lastSeenAt` throttlées (fin des pics « Disk Operations » réguliers).**
  `lastSeenAt` (session + présence messagerie) était réécrit **à chaque requête** ET **à chaque
  battement de polling** (~6 s) → un flux constant d'UPDATE Postgres (WAL) visible en pics réguliers
  sur l'hébergeur, même sans activité réelle. Un garde process-wide (`src/lib/touch-throttle.ts`) limite
  ces écritures à **≈ 1×/min** par session/utilisateur (granularité largement suffisante pour la présence
  et le « dernier clic ») — appliqué dans `session.ts` et `messaging.ts` (`touchPresence`).
- **Organigramme — vue « Carte » en glisser-déposer** (en plus de l'« Arbre ») : boîtes reliées par des
  connecteurs, placement automatique puis **positions mémorisées** (`Employee.orgX/orgY`), clic = fiche RH.
- **Lot « supervision & durcissement » (budget, paie, réunions, Regulatory, organigramme, annuaire).**
  ① **Budget — accès enveloppe STRICT** : la gouvernance globale (voir/gérer toutes les enveloppes) n'est
  plus conférée par un simple droit de module (`BUDGETS:DELETE` du bundle `MANAGE`) — seul le Super Admin ;
  sinon, strictement les listes d'accès par enveloppe (fuite corrigée, régression verrouillée). ② **Paie** :
  la fiche de paie devient **facultative** comme fichier. ③ **Réunions & appels** : onglet **« Passées »** —
  une réunion planifiée dont l'heure est dépassée quitte le listing actif (mais reste au Calendrier).
  ④ **Regulatory — supervision** : bascule *Nouveau→En cours* dès l'**étape 3 de la préparation** (« Demande
  du BV 25 % » de présoumission) faite ; **priorités colorées** ; **date cible de dépôt** + d'enregistrement ;
  **rôles superviseurs configurables** en Administration (Super Admin toujours inclus) — eux seuls priorisent/datent,
  sont notifiés (nouveau dossier / dépôt) et **demandent des MàJ de statut**. ⑤ **Administration — Organigramme** :
  arbre hiérarchique **éditable** branché sur RH (`Employee.managerId`), rattachement (N+1) + poste modifiables,
  garde anti-boucle. ⑥ **Annuaire médecins & pharmaciens** : filtre **Médecins / Pharmaciens** sur l'annuaire médical
  (le pharmacien = grade « Pharmacien »).
- **Fix accès (RBAC) : un « accès personnalisé » ne rétrécit plus la portée native d'un rôle.** Bug observé :
  un **National Sales** ne voyait « des fois » **pas** les demandes de **congrès internationaux à pré-valider**.
  Cause : dès qu'un compte recevait un **override** d'accès (matrice « façon Google Drive »), celui-ci **remplaçait**
  le défaut du rôle et retombait sur une portée `ASSIGNED` (le sélecteur de portée retombe sur ASSIGNED s'il n'est
  pas repositionné) — or `saveAccessMatrix`/`saveModuleAccess` par défaut à `ASSIGNED`. Le National Sales, qui a
  nativement la portée **ALL** sur les congrès (`defaultScope`), perdait donc sa visibilité et, à l'étape
  préliminaire, n'étant ni demandeur ni Direction Marketing, ne voyait plus rien. Correctif dans `getAccess`
  (`src/lib/rbac.ts`) : un override ne peut plus **rétrécir silencieusement** une portée que le rôle possède
  nativement en `ALL` (symétrique de la règle déjà en place pour le rôle secondaire). Test de non-régression
  ajouté (`rbac-access.test.ts`, cas National Sales en rôle principal + override).
- **RH « la totale » : contrat de travail pré-rempli par IA + acquisition automatique des congés + demandes par type.**
  **(1) Pré-remplissage du dossier employé depuis un contrat** — à la création d'un employé, un bloc
  **« Pré-remplir depuis un contrat de travail (IA) »** permet de téléverser le contrat (PDF ou image) :
  **OCR Mistral** (`ocrDocument`) puis **Claude** (`analyzeEmployeeContract`) extraient nom, poste, département,
  type de contrat, dates (embauche, début/fin de contrat, naissance), salaire de base, NIN, CNAS, coordonnées…
  Les champs se **pré-remplissent** dans le formulaire et **restent tous modifiables** avant l'enregistrement
  (rien n'est persisté tant que le RH n'a pas validé). Aucun document n'est stocké par l'IA — **les RH versent
  eux-mêmes les pièces**. Mécanique réutilisable : nouvelle prop `analyze` du composant `CreateRecordButton`.
  **(2) Acquisition automatique des congés — +2,5 j / mois** (barème algérien 30 j/an) : `accrueMonthlyLeave()`
  dans `src/lib/scheduled.ts` crédite chaque employé actif au passage d'un nouveau mois, de façon **idempotente**
  (marqueur `Employee.leaveAccruedThrough`), sans rétro-crédit à l'amorçage (le solde manuel existant est
  préservé). Le **solde reste modifiable manuellement** par les RH (champ « Solde congés » de la fiche).
  **(3) Chaque demande RH a son workflow selon le type** — le formulaire « Nouvelle demande » (Mon dossier RH)
  s'adapte : **congés** (annuel / sans solde / exceptionnel / maternité / arrêt maladie) demandent une **période**
  (début + fin, durée calculée) ; **arrêt maladie** rappelle de joindre le **certificat** ; **sortie exceptionnelle**
  ne demande qu'une **date** ; **note de frais** garde son mois + dépôt des originaux au **secrétariat** (accusé de
  réception verrouillant) ; **entrevue RH** garde la négociation de date ; **documents** (attestations…) restent
  simples. À l'approbation d'un **congé annuel**, le solde est **débité une seule fois** (verrou
  `HrDocumentRequest.balanceAppliedAt`). Champs `periodStart` / `periodEnd` / `periodDays` / `balanceAppliedAt` +
  `Employee.leaveAccruedThrough` (migration `20260717180000_rh_totale`).
- **PCH — Marché public : la chaîne complète appel d'offres → ventes réelles (OCR Mistral + IA + verrou prix).**
  Un appel d'offres se décompose en **lignes-produits** (`PchTenderLine`). Le bouton **« Analyser le
  document (IA) »** offre deux entrées : (a) **téléverser directement le document** (PDF ou image) —
  **OCR Mistral automatique** (`ocrDocument`, `analyzeTenderDocument`) puis extraction IA ; (b) coller un
  **texte** déjà extrait (`analyzeTenderText`). Dans les deux cas Claude **extrait** la liste des produits
  (désignation, DCI, dosage, forme, quantités) de façon ancrée, sans invention (helper commun
  `extractAndSaveLines`). Chaque ligne gère le **conditionnement** — quantité demandée en **unités** →
  **« boîte de N » → nombre de boîtes calculé** (⌈unités / N⌉, `parseBoxSize` déduit N du conditionnement
  reçu) —, un indicateur **« nous l'avons »**, notre **prix unitaire**, nos **fournisseurs**, et un **suivi
  commercial** (À étudier → Chiffré → Soumissionné → **Gagné** → Perdu) avec **prix d'attribution**. Le
  bouton **« Enrichir »** fait tout d'un coup (`src/lib/market/pch-lookup.ts`) : **① verrou prix** — le
  **prix unitaire de référence** est **verrouillé depuis les réceptions PCH 2025** (données réelles
  Pharmatool) en **vérifiant DCI + dosage + forme** (`pchReceptionPrice` → `refPriceDzd` + `refPriceSource`) ;
  **② présence à la nomenclature** vérifiée dosage + forme (`nomenclatureMatch`) ; **③ auto-détection de
  notre produit** dans le catalogue Regulatory (`matchOurProduct` → `ourProductId`, `registeredOurs`,
  « nous l'avons ») ; **④ concurrents** + **estimation de marché** via l'intelligence marché
  (`getRecommendations`). Une fois une ligne **Gagnée**, le bloc **« Ventes réelles »** permet de saisir
  les **bons de commande** comme **fractions** de la quantité attribuée (`createOrderFromLine` — chaque bon
  = une vente réelle, `PchOrder.lineId`), avec un **taux de réalisation** (unités vendues / attribuées, %).
  Chaque bon de commande alimente le bloc **Logistique** (dates d'**arrivée prévue / réelle**, client = PCH).
  Champs `refPriceDzd` / `refPriceSource` / `registeredOurs` + `PchOrder.lineId` (migration
  `20260717170000_pch_tender_totale`, après `20260717160000_pch_tender_lines`).
- **Information médicale (PRIM) → demandes à Regulatory.** Le pharmacien responsable de l'information
  médicale peut désormais **adresser des demandes** à l'équipe Regulatory (question réglementaire,
  demande de document, point sur un statut d'enregistrement, variation…), **rattachables à un dossier
  produit**, avec un **fil de discussion** et un cycle de statut **Ouverte → En cours → Répondue →
  Clôturée**. L'équipe Regulatory **prend en charge** (assignation auto au premier répondant), **répond**
  et change le statut ; des **notifications** préviennent l'équipe à la création et le demandeur à chaque
  réponse/changement de statut. Accès strict : le PRIM ne voit que **ses** demandes, Regulatory les voit
  **toutes** (helpers `canCreateRegRequest` / `canAnswerRegRequests` / `canSeeRegRequests`). Nouveaux
  modèles `RegulatoryRequest` / `RegulatoryRequestMessage` (migration `20260717150000_regulatory_request`),
  espace `/regulatory/requests` (entrée de menu côté information médicale + lien depuis le module
  Regulatory), référence `RRQ-AAAA-NNN`.
  **Émission réservée (configurable).** Seuls **le PRIM**, **le Super Admin** et les **rôles désignés en
  Administration** (`AppSetting.regRequestCreatorRoles`, carte « Demandes à Regulatory — Émetteurs
  autorisés » dans `/admin/settings`, action `setRegRequestCreatorRoles`) peuvent **créer** une demande —
  rôle porté en **principal OU secondaire**. L'équipe **Regulatory répond** aux demandes mais **n'en crée
  pas** (sauf si l'admin ajoute explicitement son rôle à la liste) : `canCreateRegRequest(user, creatorRoles)`
  ignore désormais `hasGlobalView`/`MEDICAL_INFO:CREATE` et s'appuie sur la liste configurée
  (migration `20260719120000_reg_request_creators`). Le bouton « Nouvelle demande » et la porte de création
  de l'action sont gardés par ce même helper.
- **Produits — canal de distribution Ville / Hôpital / les deux.** Nouvel attribut **canal**
  (`ProductChannel` : `RETAIL` = ville/officine, `HOSPITAL` = hospitalier, `BOTH` = les deux) porté par
  les **produits promus** (`PromoProduct`, catalogue Force de vente) et les **produits réglementaires**
  (`RegulatoryProduct`, registre). Sélecteur de canal dans le catalogue promo (création + édition en
  ligne) et dans les formulaires produit Regulatory (création + édition), badge de canal sur la fiche
  dossier. Libellés `PRODUCT_CHANNEL` (`src/lib/labels.ts`), migration
  `20260717140000_product_channel`. Base du filtrage ville/hôpital en segmentation et prise en charge.
- **Budgets — accès par enveloppe STRICTEMENT encadrés (visualisation vs gestion).** La **gouvernance
  globale** (créer / supprimer une enveloppe, régler le budget total et **décider qui voit ou gère
  chaque enveloppe**) est **exclusivement au Super Admin** (`canManageEnvelopes`). Les accès à une
  enveloppe sont à **deux niveaux**, **par rôle ET par personne précise** : **Visualisation** (consulter
  l'enveloppe et ses chiffres — `accessRoles` / `accessUserIds`) et **Gestion déléguée** (gérer le
  contenu de CETTE enveloppe : catégories, allocations, dépenses budgétaires — `managerRoles` /
  `managerUserIds`). Par défaut une enveloppe est **invisible** de tous **sauf du Super Admin**
  (encadrement strict). ⚠️ **Correctif de fuite** : un droit large sur le *module* Budget
  (`BUDGETS:DELETE`, présent dans le bundle `MANAGE` du rôle Finance/Budget et cochable dans la matrice
  d'accès) **ne confère PLUS** la visibilité de toutes les enveloppes — il fallait auparavant y être
  listé nommément ou par rôle, mais `canManageEnvelopes` retombait sur `BUDGETS:DELETE` et
  court-circuitait les listes. La délégation est **désormais uniquement par enveloppe** (listes ci-dessus).
  Un gestionnaire délégué gère le contenu **sans** pouvoir toucher au **montant**, à la **période** ni
  aux **listes d'accès** — modifier l'enveloppe elle-même et ses accès reste réservé au Super Admin. Toute
  modification des accès est **journalisée** (audit). Helpers `canViewEnvelope` / `canManageEnvelope`
  (`src/lib/rbac.ts`, régression verrouillée dans `rbac.test.ts`), enforcement dans `queries/budget.ts`
  (y c. `getBudgetCategoryOptions(viewer)` sur la Paie) + `budget-envelope-actions.ts`, éditeur d'accès
  dans `budget-board.tsx` (migration `20260717130000_budget_envelope_managers`).
- **Drive & Projets — confidentialité STRICTE (privés par conception).** Le **Drive** (fichiers) et les
  **Projets** (`DOSSIERS`) sont **cloisonnés** : chacun ne voit que **ses propres** fichiers / projets +
  ceux qu'on lui a **explicitement partagés ou confiés** (participation) — jamais l'ensemble de la
  société. Seule la **vue globale** (Super Admin / Direction) voit tout. ⚠️ **Correctif de fuite** :
  un compte ordinaire (ex. l'**Assistante de Direction**) pouvait se retrouver avec la portée **« tout »**
  sur ces deux modules via un **override de la matrice d'accès** (mode « personnalisé » réglé sur *toutes
  les lignes*), et voir alors **l'intégralité** des drives / projets. `getAccess` **neutralise désormais
  toute portée `ALL`** sur `DRIVE` et `DOSSIERS` **hors vue globale** (ramenée à `ASSIGNED`), quelle que
  soit son origine (override, réglage hérité, rôle secondaire). Les matrices d'accès (par utilisateur et
  « par module ») affichent ces deux modules comme **« Privé (assignées) »** — l'option *toutes les lignes*
  n'y est plus proposée (elle serait de toute façon ignorée). Enforcement : `getAccess` (`src/lib/rbac.ts`)
  + `scopeDossiers` / `getDriveListing` / `resolveDriveAccess` ; régression verrouillée dans
  `queries/drive-dossiers-scope.test.ts`. La délégation fine reste possible **par partage explicite**
  (Drive : lecteurs/éditeurs par fichier ; Projets : responsable/participants).
- **Drive — l'accès ÉDITEUR donne un vrai pouvoir d'écriture + commentaires par document.**
  **(1) Éditeur = écriture complète.** Ajouter quelqu'un en **« Éditeur »** sur un dossier ou un fichier
  lui permet désormais de **modifier, supprimer, renommer, déplacer ET téléverser / créer** dans l'élément
  partagé — même si le **rôle** de la personne n'a pas le droit module « Téléverser » / « Créer ». Un accès
  ÉDITEUR explicite (`DriveShare.access = EDIT`, hérité en descendant l'arbre) **suffit** : les actions
  d'écriture (`renameNode` / `moveNode` / `trashNode` / `deleteNode`, édition OnlyOffice, route
  `/api/drive/upload`, `createFolder` / `createOfficeNode` / `ensureDriveFolders`) s'appuient sur
  `resolveDriveAccess(...) === "EDIT"` ; le droit **module** n'est requis que pour créer/téléverser **à la
  racine** (espace perso). La page d'un document offre aussi **Renommer / Corbeille** aux éditeurs
  (`file-actions.tsx`). **(2) Commentaires par document.** Chaque fichier a son **fil de commentaires**
  (`DriveComment`, migration `20260719140000_drive_comments`) — utile pour tracer le **motif d'une
  modification**. Toute personne **ayant accès** au document peut commenter ; l'auteur (ou un éditeur /
  Super Admin) peut supprimer ; le **propriétaire est notifié**. UI `DriveComments` sur `/drive/[id]`,
  actions `drive-comment-actions.ts` (`postDriveComment` / `deleteDriveComment`).
- **Business Development — Présentation stratégique PPTX générée par IA (Claude).** Sur une étude de
  marché, un panneau **« Présentations stratégiques (IA) »** permet de **générer une présentation
  PowerPoint (.pptx)** analysée par Claude : l'IA reçoit **tout le contexte** de l'étude (toutes les
  lignes, acteurs, chiffres, commentaires) et renvoie une **analyse structurée ancrée** — synthèse
  factuelle, panorama, analyse **par produit**, paysage concurrentiel, opportunités/risques, **opinion**
  argumentée et **recommandation**. Garde-fous : l'IA **n'invente aucun chiffre** (droit au but, elle
  s'en tient aux données), et son **avis n'apparaît que** dans les champs « opinion / recommandation ».
  Un **angle/consignes** optionnel oriente l'analyse. Le fichier est **construit à la demande** au
  téléchargement (`pptxgenjs` : page de titre, tableau du marché, graphe des valeurs, une diapo par
  produit avec camembert des parts de marché, diapo opinion) — **téléchargeable et modifiable** dans
  PowerPoint. Enfin, on peut **ré-analyser en ajoutant des commentaires autant de fois que nécessaire** :
  chaque relance crée une **nouvelle version historisée** (téléchargeable individuellement). Modèles
  `MarketResearchPresentation` / `MarketResearchPresentationVersion` (migration
  `20260717120000_market_presentation`) ; analyse via le palier QUALITÉ (`askClaude`, surchargable
  `AI_MODEL`) ; route `/api/market-research/presentation/[versionId]`.
- **Business Development — Études de marché (Market Research).** Nouveau sous-espace `/business-development/etudes` :
  bouton **« New market research »** (titre + une ou plusieurs **molécules**, une par ligne → une ligne de
  tableau créée par molécule) puis un **tableau éditable façon tableur** aux colonnes exactes demandées —
  Classe thérapeutique, N, Produit, Marché (volume), Marché ($), Prix moyen/boîte $, **Nombre d'acteurs**,
  puis les **acteurs** (Player 1/2/3…, **non plafonnés**) avec **part de marché** et **statut
  Importation/Fabrication**, et Commentaires. **Enregistrement automatique** à la sortie de chaque champ,
  ajout/suppression de lignes et d'acteurs. Modèles `MarketResearch` / `MarketResearchRow` /
  `MarketResearchPlayer` (migration `20260717110000_market_research`).
  **Pré-remplissage Pharmatool + « Voir plus de détails » + export Excel.** Chaque ligne gagne un bouton
  **« Pré-remplir »** (✨) qui rapproche le produit d'une **DCI de l'intelligence marché** (IQVIA + PCH +
  Nomenclature via `getRecommendations()`) et remplit automatiquement **volume, valeur $, prix moyen/boîte**,
  un **commentaire nomenclature** (lignes enregistrées · fabricants/importateurs · recommandation) et les
  **acteurs** détectés (laboratoires **fabricants → Fabrication**, **importateurs → Importation**, seulement
  si la ligne n'en a pas encore). Le bouton **« Voir plus de détails »** déplie une **vue parts de marché**
  (barres de répartition par acteur, part cumulée) sous la ligne. Enfin un **export Excel (.xlsx)** au
  **format exact du modèle** (colonnes dynamiques `Player i / Market Share Player i (value) / Status Player i`)
  via `/api/market-research/[id]/export`. Prochain lot : **génération de présentation PPTX par IA (Claude)**.
- **Congrès — praticiens pris en charge reliés à l'annuaire.** La liste des personnes prises en charge
  d'un congrès (national/international) n'est plus une simple saisie libre : le panneau **« Personnes
  prises en charge »** propose trois modes — **« Depuis l'annuaire »** (recherche + sélection d'un
  praticien existant), **« Nouveau médecin »** (création *inline* d'un profil `MedicalDoctor` — nom,
  spécialité, secteur, **établissement** — directement rattaché, sans quitter le congrès) et **« Personne
  libre »** (comme avant). Chaque bénéficiaire issu de l'annuaire affiche son **établissement** et un
  badge « annuaire », et le profil créé est **réutilisable partout** (segmentation, tournées, historique).
  Le référentiel (annuaire, spécialités, établissements) est chargé à la demande via une action serveur ;
  les pièces d'identité et la demande de pièces restent inchangées.
- **Établissements médicaux (référentiel structuré).** L'« hôpital / clinique » d'un praticien
  n'est plus un simple texte libre : nouvelle entité **`MedicalInstitution`** (type — CHU, EPH, EHS,
  clinique privée, polyclinique, cabinet, centre de santé, pharmacie, grossiste… — secteur public/privé,
  wilaya, ville, adresse, contacts). Le médecin porte un **`institutionId`** (FK `SetNull`, libellé
  dénormalisé conservé pour la rétrocompatibilité). La **migration backfill** crée automatiquement un
  établissement par libellé distinct existant et rattache les praticiens (idempotente). L'annuaire
  Promotion médicale gagne un bouton **« Établissements »** (gestion CRUD complète, compteur de
  praticiens) et le formulaire médecin un **sélecteur d'établissement**. Socle du rattachement
  praticien→établissement réutilisé ensuite dans la prise en charge des congrès.
- **Force de vente — hiérarchie, affectations par KAM & pilotage terrain (SFE Phase 2/3).**
  Extension profonde du module `SALES_PLANNING` : on descend de la prévision produit jusqu'au **KAM
  individuel** et jusqu'au **réalisé terrain**. Trois nouveaux modèles — **`SalesTeam`** (équipe pilotée
  par un **superviseur national**, rattachable à une BU ou transverse), **`SalesRepProfile`**
  (**configuration individuelle** de chaque KAM : équipe, **capacité surchargée** jours×visites×%terrain,
  **ETP contractuel**, secteur, statut) et **`PromotionAssignment`** (matrice **KAM × produit × cycle**
  avec **rang de détail P1/P2/P3** et visites prévues, transverse aux BU). Trois onglets s'ajoutent :
  **(2) Affectations** — par KAM (groupé par équipe), on affecte des produits à un rang de détail avec un
  nombre de visites ; le **FTE et la charge** se calculent en direct (barre de charge, alerte surcharge),
  avec **synthèse par produit** et bouton **« Reporter le mois précédent »**. Chaque ligne porte le **nom du
  produit d'abord** (largeur plancher : ce sont les contrôles qui passent à la ligne sur un écran étroit,
  jamais le nom qui s'efface — voir le journal 2026-09 sur la collision `w-full` / `w-16`), et une
  **légende** dit ce que pèsent P1/P2/P3 dans le FTE, **d'après les poids du cycle** et non une constante. **(3) Équipes & KAM** —
  gestion des équipes (superviseur, BU, couleur) et **tableau de configuration de tous les KAM**.
  **(4) Pilotage** — cockpit **planifié vs réalisé** : par KAM (et sous-totaux d'équipe), capacité, panel
  (praticiens par palier de potentiel, **réutilise l'annuaire médical existant** `MedicalDoctor`),
  **fréquence cible** (Σ fréquence×effectif du panel selon le paramétrage), visites planifiées, **visites
  réellement réalisées le mois** (dérivées des `MedicalVisit` `COMPLETED`), **taux de réalisation** et
  **couverture** (praticiens visités / panel). Le **FTE affecté remonte automatiquement dans les
  Prévisions** (nouvelle colonne « FTE affecté » + écart vs FTE cible) : la boucle Direction → KAM →
  terrain est bouclée. **Profondeur d'accès** : les onglets et les données sont filtrés par rôle —
  configurateur (Direction / Manager promo / Super Admin) voit et édite tout ; **superviseur national**
  (`NATIONAL_SALES`, `SALES_PLANNING:READ`) voit et édite **ses équipes** (autorisation métier
  `canEditRep`, sans droit de configuration globale) ; **KAM** (`MEDICAL_DELEGATE`) voit **son** Pilotage.
  Tout reste **non bureaucratique** : le terrain ne saisit que ses visites, le reste est dérivé. Helpers
  purs testés (`src/lib/sfe.ts` : `repCapacity`, `assignmentEffort`, `fteFromEffort`, `panelRequiredVisits`,
  `resolveRepScope`, `canEditRep` — `src/lib/sfe.test.ts`). Migration idempotente `20260717090000_sfe_force_hierarchy`.
- **Nouveau module « Prévisions & Force de vente » (SFE) — l'espace prévisionnel de la Direction.**
  Première pierre d'un modèle **Société → BU (franchise) → Produit** pour piloter la force de vente.
  Nouveau module RBAC **`SALES_PLANNING`** (route `/planning`, accordé par défaut à la Direction et au
  Manager promotion médicale, ouvrable à tout rôle par le Super Admin dans Administration). Trois onglets :
  **(1) Prévisions** — une **grille façon tableur, par produit et par mois** (cycle mensuel `PromoCycle`),
  où la Direction saisit **FTE cible, couverture %, visites prévues, budget (DZD) et note** ; lignes
  **regroupées par BU** avec sous-totaux + total, **enregistrement automatique** à la sortie de chaque
  champ, KPIs (FTE cible total, ETP KAM disponibles, visites, capacité/KAM) et navigateur mois précédent/
  suivant. **(2) Catalogue** — gestion des **Business Units** (franchises : société, chef de BU, couleur)
  et des **produits promus** (BU + Direction Marketing), un produit étant l'**unité atomique d'affectation**
  (un KAM peut porter des produits de plusieurs BU). **(3) Paramètres** — **100 % configurables** :
  **capacité terrain** (jours/mois × visites/jour × % terrain, avec aperçu de la capacité nette), **poids
  des positions** de détail (P1/P2/P3) et **fréquence cible par palier de potentiel** (Très fort → Très
  faible). Modèles : `BusinessUnit`, `PromoProduct`, `PromoCycle`, `ProductForecast`, `SfeSettings`
  (migration idempotente `20260715080000_sfe_foundation`) ; helpers `src/lib/sfe.ts` (config fusionnée
  aux valeurs par défaut + `fieldVisitsCapacity`) ; actions `src/lib/actions/sales-planning-actions.ts`.
  **Vision (non bureaucratique)** : la Direction *prévoit* ici par produit ; le terrain ne saisira que ses
  **visites**, d'où le FTE/couverture *réels* seront **dérivés** — d'où la feuille de route **Phase 2**
  (matrice d'affectation KAM × produit × position × FTE, transversale aux BU) et **Phase 3** (panel par
  médecin + tournée assistée + FTE réel calculé à partir des visites).
- **Regulatory — « Statut de fabrication » + cycle de vie des variations.** La forme pharmaceutique
  gagne **« Capsule molle »**. L'ancien champ **« Type de produit » devient « Statut de fabrication »**
  avec 4 valeurs — **Importation, Secondary Packaging, Primary Packaging, Full Process** (nouveau champ
  `RegulatoryProduct.manufacturingStatus`, l'ancien `productType` conservé mais masqué). Nouveau **cycle
  de vie de variation** (`RegulatoryVariation`) : après la DE, un bouton **« Variation »** ouvre un dépôt
  vers un statut supérieur (date de dépôt, fabricant, note), suivi d'un statut **En attente → DE de
  variation obtenue / Annulé** ; à l'obtention, le **statut de fabrication du produit est promu** à la
  cible. Chaînable dans le temps (Importation → Secondary → Primary → Full Process). Panneau
  « Variations de fabrication » sur la fiche + colonne « Statut fab. » dans la liste.
- **Web Push (VAPID) auto-configuré + intégré partout.** Le push (gratuit et illimité — il passe
  par les services push des navigateurs) n'est **plus inerte** : si l'environnement ne fournit pas de
  clés `VAPID_*`, le serveur **génère une paire une seule fois et la persiste** (`AppSetting.vapidPublicKey`
  / `vapidPrivateKey`, clé privée jamais exposée). Il suffit à chaque utilisateur d'**activer les
  notifications** une fois (bouton dans le module Notifications) pour recevoir sur son appareil **même
  plateforme fermée** : **appels & appels vidéo** (notification qui **reste affichée + vibre**, façon
  sonnerie, un tag par appel), **messages**, **toutes les notifications** (validations, rappels
  « Me rappeler », affectations…) et les **pop-up d'annonce** de l'Administration — tout ce qui passe par
  `notifyUser` / `broadcastNotification` pousse désormais réellement. `PushPayload` gagne `tag` +
  `requireInteraction` (honorés par le service worker). Les variables d'environnement `VAPID_*` restent
  prioritaires si on veut fixer soi-même les clés.
- **Notifications en pop-up plein écran (depuis l'Administration).** Le compositeur de diffusion
  (Administration → Réglages) gagne une case **« Afficher en pop-up plein écran »** : la notification
  s'affiche alors dans une **grande fenêtre centrée** au milieu de l'écran du destinataire (façon alerte
  importante), en plus de la cloche. Elle **reste jusqu'à l'accusé de réception** (« J'ai compris »),
  s'enchaîne si plusieurs, et propose « Ouvrir » si un lien est fourni. Nouveau champ `Notification.popup`
  (migration idempotente), l'endpoint `/api/notifications/poll` renvoie aussi les pop-up non lues, et le
  composant `NotificationPopup` (monté dans le layout) les affiche et les marque lues à l'accusé.
- **Drive — un seul bouton « Importer » (UI).** Les deux boutons « Importer » et « Importer un dossier »
  sont **fusionnés** en un seul bouton **« Importer »** qui ouvre un petit menu (façon Google Drive) :
  **Fichiers ou ZIP** (un ou plusieurs fichiers, ZIP inclus — avec classement + accès) ou **Dossier**
  (arborescence exacte recréée dans le Drive). Composant `import-folder-button.tsx` retiré, sa logique
  repliée dans `upload-button.tsx`.
- **Module « Dossiers » renommé « Projets » · Stocks ouverts à tous les produits (2 sujets).**
  **(1) « Dossiers » → « Projets »** — le module de suivi de sujets ad hoc s'appelle désormais
  **Projets** partout dans l'interface (menu, titres, KPIs, création, notifications, journal d'audit,
  onboarding, assistant IA, suppression Super Admin). Seuls les **libellés utilisateur** changent : la
  **route `/dossiers`**, l'**entité `Dossier`**, la **clé RBAC `DOSSIERS`** et les liens existants
  restent inchangés (aucune migration, aucun lien cassé). Le mot « dossier » employé ailleurs (Drive,
  Mon dossier RH, dossiers Regulatory) n'est **pas** touché. **(2) Stocks — tous les produits** : la
  saisie d'un état de stock propose de nouveau **tous les produits Regulatory** (on a retiré le filtre
  « Décision obtenue »), quel que soit leur statut d'enregistrement.
- **Réunions (gestion des participants) · Courrier retiré · statut Teams · carillon de rappel · clic
  notif = lu (8 sujets, dont 3 déjà couverts).** **(1) Gestion des participants d'une réunion** —
  l'organisateur (et le Super Admin) peut **ajouter** (multi-sélection avec recherche), **retirer** des
  participants après création via un panneau **« Gérer les participants »** dans l'en-tête de la carte
  Participants (`manage-participants.tsx` → `addMeetingParticipants` / `removeMeetingParticipant`).
  **(2) Documents — visualiser / modifier / imprimer / supprimer** : déjà en place — `DocumentPreview`
  offre l'aperçu, l'impression (icône imprimante), le renommage, l'édition Office et la suppression,
  aussi bien dans le module **Documents** que sur les fichiers du **Drive** (visionneuse + actions de
  nœud). **(3) Accès (Administration) réellement connecté** : déjà le cas — `getAccess` lit
  `userAccess` **en direct à chaque requête** (`session.ts` l'appelle systématiquement, le JWT ne met
  **pas** l'accès en cache) ; une modification d'accès prend donc effet **au prochain chargement de
  page** de l'utilisateur concerné (il peut devoir rafraîchir). **(4) Drive = disque de l'ordinateur en
  temps réel** : impossible en application **web pure** (un navigateur ne peut pas lire en continu un
  dossier local en arrière-plan) ; on fournit l'**import de dossier** (arborescence exacte, déjà livré)
  et une resynchro « dossier vivant » tant que l'onglet est ouvert — une vraie synchro permanente
  exigerait un **agent bureau natif** (projet séparé). **(5) Boîte mail « Courrier » retirée** —
  entièrement supprimée du menu et de la plateforme (`/courrier` redirige vers Mon espace) ; Infomaniak
  reste dans son app dédiée. **(6) Statut façon Teams** — chaque utilisateur choisit son statut
  (Disponible, Occupé, Ne pas déranger, De retour bientôt, Absent, Hors ligne) **et** un message perso
  court, affiché dans la messagerie (en-tête de conversation + sélecteur en tête de liste) ; « Auto »
  repasse en présence automatique (`User.chatStatus` / `statusMessage`, `setMessagingStatus`).
  **(7) Carillon de rappel** — une **notification sonore** discrète et pro (petit arpège) + une notif
  bureau se déclenchent quand une notification non lue arrive (rappels « Me rappeler » compris)
  (`notification-chime.tsx` interroge `/api/notifications/poll`). **(8) Clic sur une notif = lu** —
  cliquer une notification la marque **lue** (et suit son lien) ; plus besoin de la coche par élément
  (« Tout marquer comme lu » conservé).
- **Drive (accès dossiers + import de dossier + fiabilité) · réunions verrouillées · téléversement
  déplaçable · rapports terrain épurés (6 sujets).** **(1) Accès des dossiers Drive éditables** — un
  bouton **« Gérer l'accès »** sur chaque dossier **et** fichier (pas seulement à l'import) ouvre le
  partage Lecture / Éditeur / Aucun ; l'accès posé sur un dossier est **hérité** par tout son contenu
  (résolution en remontant l'arbre, façon Google Drive). **(2) Import de DOSSIER** (sans ZIP) — on
  choisit un dossier de l'ordinateur, son **arborescence exacte** (dossiers dans dossiers…) est
  recréée dans le Drive puis chaque fichier téléversé au bon endroit (`webkitdirectory` →
  `ensureDriveFolders` recrée l'arbre sans doublon → envoi par fichier). **(3) Fiabilité des envois** —
  bouton **« Réessayer »** sur un lot en échec (relance seulement les fichiers ratés, sans perdre la
  file) + retentes portées à 5 avec backoff 0,5 → 4 s. **(4) Réunions** — seuls **l'organisateur**
  (et le Super Admin) peuvent modifier les paramètres/infos d'une réunion (plus la Direction).
  **(5) Fenêtre flottante de téléversement** — **déplaçable** partout à l'écran (glisser l'en-tête) et
  **réductible** en une petite bulle. **(6) Rapports terrain épurés** — même en vue Direction, plus de
  listes agrégées (pharmacovigilance, opportunités, objections…) : **juste les rapports, les uns après
  les autres**. Côté délégué, **hôpital/établissement** et **médecin** sont **optionnels** (champ libre).
- **Messagerie façon WhatsApp + Stocks affinés (3 sujets).** **(1) Présence en ligne / hors ligne
  avec heure exacte** — l'en-tête d'une conversation directe affiche **« En ligne »** (point vert) ou,
  hors ligne, **« Vu à HH:MM »** (heure exacte du dernier passage, « hier » / date au-delà), mis à jour
  en direct via le heartbeat existant (`lastSeenAt`). **(2) Accusés de lecture (coches)** — sur MES
  messages : **une coche** = envoyé, **deux coches** = distribué (le destinataire a synchronisé),
  **deux coches bleues** = lu ; calculé à partir de `ConversationMember.lastReadAt` (lu) et `lastSeenAt`
  (distribué), en groupe il faut que **tout le monde** ait vu/lu (aucune migration, données déjà là).
  **(3) Stocks — produits filtrés** : seuls les produits Regulatory au statut **« Décision obtenue »**
  (`DECISION_OBTAINED`) sont proposés pour saisir un état de stock (on ne suit que des produits
  réellement enregistrés).
- **Chat de réunion + validation à commentaire optionnel + badges de menu + « Mon dossier RH » autonome
  + Annexes PCH de retour (5 sujets).** **(1) Fil de discussion dans la réunion** — chaque réunion a
  désormais un **vrai chat** (comme les autres discussions) : **texte + pièces jointes intégrées**
  (stockées chiffrées via le backend Drive), ouvert à l'organisateur et aux participants ; les membres
  sont notifiés, l'auteur (ou l'organisateur) peut supprimer un message. Nouveaux `MeetingMessage` +
  `MeetingMessageAttachment`, route de service protégée par l'accès à la réunion. **(2) Décision de
  validation à commentaire OPTIONNEL** — Valider / Demander une modification / Refuser s'accompagnent d'un
  **commentaire facultatif** (le motif n'est **plus obligatoire**, même en cas de refus). **(3) Badges de
  notification par module** dans le menu — chaque entrée de la barre latérale affiche une **pastille** du
  nombre de notifications non lues **routées vers ce module** (via le lien de la notif → `moduleForPath`),
  qui décroît à mesure qu'on les lit. **(4) « Mon dossier RH » ressort de « Mon espace »** — de nouveau
  une **entrée de menu dédiée** (avec « Mes ordres de mission » en onglet), retirée des onglets de l'espace
  personnel. **(5) « Annexes PCH » de retour dans les Stocks** — 3ᵉ onglet **Stock annexes PCH** à côté de
  PCH et hôpitaux ; hôpitaux et annexes sont des **lieux nommés** (`StockAnnex.kind` = HOSPITAL | ANNEX)
  créés/supprimés **uniquement par le Super Admin** (comme les hôpitaux).
- **Liste de documents épurée + réunions présentiel & réponses d'invitation + Calendrier autonome
  (5 sujets).** **(1) Liste de documents refondue** — plus de badge « Interne » ni de rangée d'icônes
  entassées (qui débordaient dans les colonnes étroites) : le **nom** (plus petit) est **cliquable** et
  ouvre l'aperçu ; **toutes les actions** (imprimer, modifier dans l'éditeur Office, renommer,
  enregistrer/télécharger, supprimer) vivent dans la **barre d'outils de l'aperçu**. **(2) Réunions en
  PRÉSENTIEL** — à la création (et à la modification) on choisit **En ligne (lien)** ou **Présentiel** ;
  en présentiel on saisit un **lieu** (pas de lien) — nouveaux champs `Meeting.inPerson` + `location`.
  **(3) Réponse d'invitation façon agenda** — chaque invité peut répondre **Oui / Peut-être / Non** ;
  l'organisateur est notifié et voit le statut de chacun (nouveau `MeetingParticipant.response`, réutilise
  l'enum `CalendarInviteStatus`). **(4) Cartes de réunion** — titres et badges **bornés/tronqués** (fini le
  débordement hors des cartes « À venir »). **(5) « Calendrier »** ressort de « Mon espace » comme **module
  autonome** (entrée de menu dédiée).
- **Upload « Fichiers ou ZIP » partout + visionneuse ZIP dans le Drive + notifications bureau + écran
  anti-capture retiré (4 sujets).** **(1) Upload simplifié** — le composant de dépôt de documents
  (partagé par tous les modules) ne propose plus que **« Fichier(s) (tout type) »** ou **« ZIP »**
  (le mode « Dossier » webkitdirectory est retiré ; pour un dossier entier, on l'envoie compressé en
  .zip), avec un libellé clair. En **Regulatory**, tout dépôt reste répliqué automatiquement dans le
  **dossier Drive du produit** (le ZIP y est conservé **entier**). **(2) Visionneuse ZIP dans le Drive**
  — ouvrir un fichier `.zip` du Drive affiche désormais son **contenu** (liste des entrées + recherche)
  et permet de **visualiser** chaque fichier interne (image, PDF, texte, vidéo, audio) **inline** ou de
  le télécharger, sans décompresser l'archive (extraction serveur d'une entrée à la demande, bornée en
  taille, accès hérité de l'arbre Drive). **(3) Notifications sur l'ordinateur** — à la réception d'un
  message, si l'onglet n'est pas au premier plan, une **notification bureau** s'affiche (en plus du son) ;
  le bouton « Activer les notifications » fonctionne même sans clés VAPID (le Web Push reste le
  complément « navigateur fermé » quand `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` sont posées). **(4) Écran
  anti-capture retiré** — le voile plein écran « capture surveillée » (au raccourci ET à chaque perte de
  focus) est supprimé ; seule l'**alerte Super Admin** (audit + notification) est conservée.
- **« Mon dossier RH » intégré à « Mon espace » + coût IA Claude réduit drastiquement (2 sujets).**
  **(1) « Mon dossier RH » rejoint « Mon espace »** — plus d'entrée de menu séparée : « Mon dossier RH »
  et « Mes ordres de mission » deviennent des **onglets** de l'espace personnel (aux côtés de Mon travail,
  Mon espace, Dashboard, Calendrier, Directives), gardés par leur module comme avant. **(2) Conso de
  crédits Claude fortement réduite, à qualité préservée** — deux **paliers** de modèle (`ai.ts`) : palier
  **qualité** (`claude-sonnet-4-6`) réservé à ce qui l'exige vraiment (14 agents CTD sourcés, simulateur
  d'examen, réponse aux réserves, assistant conversationnel, Adventum Brain) ; palier **éco**
  (`claude-haiku-4-5`, ≈ 3× moins cher) pour les tâches **mécaniques**. Le **principal poste de coût** —
  la **revue de fond/forme par parts** (jusqu'à `REG_AI_MAX_CHUNKS`, défaut **120 appels/version**) —
  bascule sur le palier éco ; idem extraction de faits (jumeau), analyse des rapports vocaux, résumés de
  réunion, brouillons fournisseur, Q&R de dossier et suggestion proactive (nudge). **Prompt caching** du
  bloc system stable ajouté à `askClaude` (préfixe relu à ~0,1×). Garde-fous inchangés (sortie Zod,
  ancrage des preuves, citations RAG, constats PROJET non bloquants, contrôles critiques déterministes).
  Réglable par `AI_MODEL` / `AI_MODEL_CHEAP`.
- **Navigation, modules & flux de travail — téléversements non bloquants, séparation Rapports terrain,
  réorganisation Mon espace, chat de dossier (4 sujets).** **(1) Téléversements EN ARRIÈRE-PLAN,
  globaux** — un envoi bloquait la page et changer de module l'annulait ; un `BackgroundUploadProvider`
  monté dans la mise en page prend en charge **tous** les téléversements (Documents — utilisé dans
  ~16 pages —, Drive import simple **et** riche) : dès le clic « Téléverser », on peut **naviguer et
  continuer à travailler**, les fichiers montent **en parallèle** (XHR + progression réelle, retente
  réseau/5xx/429), une pastille flottante suit la progression partout. Le dossier CTD garde son moteur
  résumable par parties. **(2) Rapports terrain = module autonome** — séparé de Promotion médicale
  (nouveau module RBAC `FIELD_REPORTS`, **accès configurables séparément** dans Administration ; deux
  entrées de menu distinctes). Le **superviseur national** (National Sales) voit **tous** les rapports
  des délégués ; le délégué ne voit que les siens. **Saisie manuelle du nom du médecin** dans le compte
  rendu (jamais écrasée par l'IA). **(3) « Mon espace » réorganisé** — regroupe Mon travail, Mon espace,
  **Dashboard**, **Calendrier** et Directives (onglets) ; **« Dossiers » sort** comme module à part
  entière. **(4) « Suivi & discussion » d'un dossier = vrai chat** — pièces jointes **intégrées au fil**
  (comme la messagerie, stockées chiffrées), et **mentions (@)** limitées aux **participants** du
  dossier (notification dédiée). Nouveaux : `DossierMessage.mentionIds` + table
  `DossierMessageAttachment`, route de service protégée par l'appartenance.
- **Expérience & intelligence — chatbots propres, réserves, stocks, recherche, rappels, cerveau continu
  (9 sujets).** **(1) Chatbot « Discuter avec ce dossier » — réponse propre** : sortie nettoyée de tout
  markdown/caractère spécial (titres `##`, gras `**`, citations `>`, `---`, puces, émojis, `[P]/[C]`) tout en
  **préservant les citations numériques `[n]`** et la ponctuation française. **(2) Réserves ANPP — « Discuter
  avec les réserves »** : chat qui **rédige des réponses exigeantes**, scientifiquement/réglementairement
  justes, **uniquement à partir du dossier** ; **s'abstient** sur le prix / le commercial, **signale ce qu'il
  faut demander au fournisseur** — sourcé, texte brut, n'invente rien. **(3) Stocks — refonte** : fin des
  « annexes » (deux périmètres, **Stock PCH** + **Stock hôpitaux**) ; **hôpitaux créés par le Super Admin**, les
  autres rôles **enregistrent seulement des états** ; enregistrement pour un hôpital exigeant l'hôpital
  concerné (**corrige le « ça marche pas »**) ; **demande d'état de stock à un instant T** (Direction / Super
  Admin → délégué : tâche assignée + notification). **(4) Upload CTD illimité & rapide** : aucun plafond serveur
  sur le nombre de fichiers par module ; les échecs transitoires par fichier sont **réessayés avec backoff**.
  **(5) Bug création de demande via chatbot** : la référence utilisait `count()+1` (collision avec l'unicité
  après purge Corbeille) → **`buildRef` (max) + `createWithRetry` (P2002)**, généralisé aux **12 générateurs de
  références**. **(6) OCR Mistral vraiment utilisé** : la méthode d'extraction est **taguée** (`ocr-mistral` /
  `ocr-tesseract`) et un **diagnostic en ligne** le confirme — Mistral ne tourne que sur les scans (les PDF
  natifs n'en consomment pas). **(7) Recherche globale ultra-smart** : multi-termes (AND de OR insensible à la
  casse) couvrant dossiers CTD, discussions/messages, demandes du secrétariat, congrès, événements, directives.
  **(8) Rappels en un clic** (`Reminder` + sweep planifié) sur un dossier, un sujet ou une demande du
  secrétariat — notification cloche + push à l'échéance. **(9) Adventum Brain + Process Intelligence — analyse
  EN CONTINU (« Adventum Pulse »)** : instantané horaire persisté (`IntelligenceSnapshot`) des agrégats
  Risk Radar + Process Intelligence, **tendances** (bandeau `PulseStrip` : deltas + mini-courbe) et **alerte
  proactive** au Super Admin sur tout **nouveau risque critique** — même module fermé ; nouveau détecteur
  **« demande du secrétariat en retard »**.
- **Analyse CTD — jumeau numérique par IA, analyse plus exigeante, pièces admin hors CTD, gros fichiers
  blindés (5 sujets).** **(1) Compréhension par IA du jumeau numérique** — le jumeau n'est plus seulement
  déterministe (regex) : une couche IA **comprend le sens** et propose les faits que les règles ne savent pas
  saisir (composition, indications, posologie, spécifications, stabilité, procédé, adresses de site…). Chaque
  fait proposé cite une **preuve** dont on **vérifie l'ancrage** (l'extrait figure réellement dans le
  document → jamais d'invention), la clé est **bornée au catalogue**, la confiance est **plafonnée** (le
  déterministe prime à valeur égale), l'appel est **borné** (sections porteuses, un seul appel quel que soit
  le volume) et **non bloquant**. Tout fait reste **PROPOSED → revue humaine** (marqué « IA » dans les
  sources). **(2) Analyse beaucoup plus exigeante** — la revue de fond/forme et les 14 agents adoptent la
  posture d'un examinateur ANPP **sévère** : checklist explicite **fond** (cohérence ANPP/ICH, éléments
  manquants, incohérences DCI/dosage/lot/dates/unités, données non étayées, références périmées) **et forme**
  (signatures/dates/cachets, pagination, numérotation CTD, langue/traductions fr-ar, qualité scans/OCR,
  formats). Garde-fous inchangés (preuve exacte, Zod, jamais bloquant, abstention). **(3) Pièces
  administratives hors CTD** — `1.0` lettre d'accompagnement, `1.2` formulaire, `1.2.1` bordereau de
  versement sont fournies **de notre côté** (portail ANPP en ligne) : elles ne **pénalisent plus** la
  complétude CTD ni ne créent de bloqueur (filtrées du scoring, y compris des packs déjà amorcés — aucune
  migration), et apparaissent dans une **checklist séparée « Documents obligatoires pour l'enregistrement
  (hors CTD) »**. **(4) « Réponse IA non exploitable » corrigé** (simulateur d'examen & agents) — cause n°1 =
  réponse IA **tronquée** au plafond de jetons : extracteur JSON **tolérant** partagé (referme chaînes/
  structures ouvertes) + plafonds de jetons relevés. **(5) Worker thread pour les gros fichiers (>100 Mo)** —
  le parse natif (pdf-parse/mammoth/xlsx) tournait **synchronement** sur le thread du serveur → un fichier
  >100 Mo **figeait toute l'app** ; il est désormais **déchargé dans un worker thread** (transfert zéro-copie,
  timeout, **repli en ligne** si indisponible), les petits fichiers restant en ligne.
- **Analyse CTD — correctifs (crash Bases de données, classification « Module N », fluidité).** **(1)** Le
  crash serveur de **Administration → Bases de données** (`fmtBytes` exporté d'un composant client puis appelé
  côté serveur) est corrigé via un utilitaire **server-safe** (`formatBytes`). **(2)** Un fichier nommé
  **« Module 2 »** n'est plus classé en 3.2.x : le **module du nom de fichier prime** sur les mots-clés du
  contenu (un QOS cite des sections 3.2 sans en être). **(3)** L'app reste **fluide pendant l'extraction et
  l'analyse** : cession de la boucle d'événements (`setImmediate`) entre documents/lots (le thread n'est plus
  monopolisé).
- **Lot budgets/finances/regulatory/admin/perf (12 sujets).** **(1) Budgets découplés des Finances** — une
  ligne de dépense ajoutée depuis le module Budget (« + » réf. + montant) crée désormais une **ligne purement
  budgétaire** (`BudgetExpenseLine`) qui consomme la catégorie **sans** toucher la trésorerie ; le financier
  enregistre le mouvement réel s'il le souhaite. Les anciennes lignes (créées comme FinanceTransaction) sont
  **reprises** puis retirées des Finances (migration). **(2) Modification & suppression** des lignes budgétaires
  (sur les dépenses imputées : édition réf./montant/date + **ré-imputation** vers une autre (sous-)catégorie, ou
  corbeille ; la consommation se réajuste — `updateBudgetExpense`/`deleteBudgetExpense`). **(3) Regulatory — miroir Drive AUTOMATIQUE** : tout
  document officiellement téléversé sur un produit est répliqué dans le Drive (dossier du produit, partagé), **en
  arrière-plan** (upload ressenti instantané) — fin du bouton manuel. **(4) Finances & Promotion médicale —
  lignes modifiables + supprimables** (livre comptable : `updateTransaction`/`deleteTransaction`, trésorerie
  recalculée ; visites : édition complète de la ligne). **(5) Administration → onglet « Bases de données »**
  (Super Admin) : liste des bases porteuses de stockage + suppression **définitive** de fichiers/documents/dossiers
  + **ramasse-miettes** des blobs orphelins qui **libère réellement** l'espace disque (contenu dédupliqué).
  **(6) Process Intelligence — statuts corrigés** : états terminaux sponsoring (ANNULÉE/APPROUVÉE) exclus, et
  demandes administratives **supprimées** (suppression douce `deletedAt`) enfin masquées. **(7) Analyse CTD —
  ranking sémantique fin** : colonne **tsvector indexée (GIN, « french »)** générée à l'extraction ; la recherche
  du chatbot départage par `ts_rank_cd` (racinisation, fréquence, densité). **(8) Analyse CTD** — retrait du
  **formulaire de pré-soumission** (tout se fait sur la plateforme ANPP en ligne). **(9) Performance / upload** :
  lecture unique du binaire, miroir Drive non bloquant, concurrence d'upload 6, `getCompanies` mémoïsé par requête.
- **Budgets : catégories modifiables, attribution scopée & ré-attribuable, export Excel.** Le **module
  d'une catégorie de tête** est désormais **modifiable et ré-enregistrable** (un bug le laissait figé après
  création). À la **validation définitive** d'une dépense, la Direction choisit la **(sous-)catégorie**
  uniquement parmi les **enveloppes qui lui sont accessibles** (ouvertes par le Super Admin) ; et **toute
  dépense reste RÉ-ATTRIBUABLE** à une autre (sous-)catégorie à tout moment depuis le tableau des budgets.
  Enfin, **export Excel (.xlsx)** du budget avec le **taux de consommation** par catégorie + une feuille
  « Total enveloppes ». +6 tests (export relu par SheetJS, scoping des options par accès).
- **Validations, santé du chatbot, dépôt Drive Regulatory & lisibilité.** Cinq sujets. **(1) Accès
  temporaire de validation** — un validateur (ex. la Direction Marketing recevant un bon de commande à
  valider) obtient, LE TEMPS de décider, une LECTURE du module concerné (résolu depuis le libellé
  stocké OU l'URL de l'objet) + l'accès à la ligne liée, révoqué dès la décision ; et il **voit/prévisualise
  l'original SUR PLACE** dans la carte « À valider ». **(2) Test IA quotidien** — le planificateur interne
  ping l'API du chatbot une fois par jour (`aiSelfTest` → message d'erreur EXACT : clé/crédit/HTTP/réseau),
  journalise (`AiHealthCheck`) et **alerte tous les Super Admins** en cas de panne (message de rétablissement
  au retour) ; carte « Santé du chatbot » + bouton « Tester maintenant » au Centre de contrôle IA. **(3) Dépôt
  Regulatory → miroir Drive** — depuis une fiche produit, déposer un/plusieurs **fichiers**, un **dossier**
  entier ou une **archive ZIP** : le contenu est répliqué dans le Drive sous un dossier **nommé d'après le
  produit**, en conservant l'**arborescence exacte** (ZIP décompressé via l'inspecteur sécurisé ; re-dépôt =
  nouvelle version, pas de doublon ; dossier partagé en lecture avec les parties prenantes). **(4) Lisibilité
  Drive** — type de fichier **humain** (« Document Word » au lieu du MIME brut) et fin du débordement du
  panneau d'infos. +19 tests ciblés.
- **Analyse CTD — fin des fausses « sections manquantes », faits plus propres, chatbot de dossier musclé.**
  Trois chantiers sur un vrai dossier de 459 Mo (11 fichiers, dont un « Module 3.pdf » de 381 Mo). **(A)** Un PDF de
  module **consolidé** est désormais reconnu comme couvrant **plusieurs sous-sections** (`ctd/detect-sections.ts` :
  code CTD **corroboré par son titre**, frontières de mot ; un renvoi « voir 3.2.P.8 » ne compte pas) → stockées
  dans `containedSections`, la complétude **cesse de signaler ces sections comme manquantes à tort**. **(B)** Extraction
  de faits **anti-bruit** (`twin/extract-facts.ts`) : mot entier (« gel » ≠ « angel ») + **contexte borné à la phrase**
  qui écarte une voie « Intravenous » de canule PK, un stockage d'**échantillons** à –70 °C, une forme issue de
  « gélatine » ; **associations** de teneurs « 50 mg / 300 mg » captées (INN accentués compris). **(C)** Le chatbot
  **« Discuter avec ce dossier »** répond **sourcé (fichier · section · page EXACTE)** : décomposition question →
  termes + **synonymes FR/EN** + codes CTD, **récupération multi-termes classée**, **page résolue par décalage →
  `ocrPages.chars`** (sans ré-océrisation — la résolution précédente, basée sur un champ inexistant, ne marchait pas),
  **contexte enrichi** (faits, sections manquantes, inventaire) + **historique** pour les questions de suivi, citations
  `[n]` et **abstention** stricte. +32 tests ciblés.
- **Stockage des fichiers déporté vers S3/R2 — le disque Postgres arrête de gonfler.** Le backend de blobs
  (`lib/drive-storage.ts`, point unique qui touche les octets) stocke désormais le contenu **chiffré (AES-256-GCM,
  inchangé)** dans un **bucket S3/R2** quand `REG_S3_*` est configuré ; la base ne garde plus que les métadonnées
  (IV + SHA-256 + taille + compteur de refs + clé objet). **Rétrocompatible** : les blobs déjà en base restent lus
  depuis la colonne `data` (`storageKey` NULL) ; sans config, tout reste en base. Cela répond à la saturation du
  disque de la base (`No space left on device`) causée par le stockage des dossiers en base. Client objet S3
  **sans SDK** (SigV4 fait main) étendu avec `putObject`. Migration `FileBlob` (`data` nullable + `storageKey`).
  **Récupération de l'espace existant** : `npm run blobs:migrate-r2` déplace les blobs historiques vers R2 (un par
  un, mémoire bornée) puis `VACUUM FULL "FileBlob";` rend l'espace au disque. Test : aller-retour chiffré via un
  magasin objet en mémoire (`drive-storage.r2.test.ts`).
- **Regulatory Intelligence OS — téléversement « ultra-rapide » : upload DIRECT S3/R2 + pool DB réglable.**
  Deux leviers de vitesse, activés par variables d'environnement (absents → comportement inchangé, aucune régression) :
  - **Chantier 1 — envoi DIRECT (navigateur → bucket S3/R2), bypass serveur + Postgres.** Signatures **AWS SigV4
    faites main** (aucune dépendance SDK ; clé de signature vérifiée contre un vecteur connu), URL PUT présignée,
    puis le serveur **lit l'objet** pour l'inspecter/ingérer et **supprime l'archive temporaire**. Repli automatique
    sur l'upload résumable en base si non configuré. Env : `REG_S3_ENDPOINT`, `REG_S3_BUCKET`, `REG_S3_ACCESS_KEY_ID`,
    `REG_S3_SECRET_ACCESS_KEY`, `REG_S3_REGION` (défaut `auto`), `REG_S3_FORCE_PATH_STYLE` (défaut `1`).
    **À provisionner côté fournisseur** : le bucket + une règle **CORS** autorisant `PUT` depuis l'origine de l'app.
    Fichiers : `intelligence/upload/object-storage.ts`, `…/session.ts` (`startDirectUploadSession`/`finalizeDirectUploadSession`),
    route `api/…/upload/direct/[sessionId]/finalize`, `…/upload/session` (aiguillage direct/résumable), `ctd-upload.tsx`.
  - **Chantier 2 — pool de connexions DB + concurrence réglables.** `DB_CONNECTION_LIMIT` (+ `DB_POOL_TIMEOUT`) élargit
    le pool Prisma (défaut ~3 sur 1 vCPU → cause des 500 sous forte concurrence) ; `REG_UPLOAD_CONCURRENCY` aligne le
    nombre de parties envoyées en parallèle (surfacé au client). Fichiers : `lib/prisma.ts`, `…/upload/session.ts`.
  - Réglages d'envoi (déjà en place) : `REG_UPLOAD_PART_MB` (4 Mo), `REG_ZIP_MAX_ARCHIVE_MB` (10 Go), reprise résumable.
- **Regulatory Intelligence OS — pipeline CTD prouvé de bout en bout + correctif « les scans sont lus jusqu'au
  bout ».** Test d'intégration **réel** (base + OCR + moteur, aucune simulation) qui télécharge un dossier ZIP
  multi-formats (txt, docx, xlsx, **scan PNG océrisé**, exécutable **bloqué**) et observe **chaque** étape :
  décomposition sécurisée → **lecture de TOUS les fichiers** (texte natif *et* OCR réel du scan → « AMOXICILLINE »
  extrait) → classification CTD (1.0/1.2/3.2.P.8/1.4) → **jumeau numérique** (faits sourcés) → conflits → **règles**
  (bilan + constats) → `IN_REVIEW`, tous les jobs `DONE`. **Correctif de fond** : le contenu **océrisé** des scans
  alimente désormais réellement le jumeau, la revue IA et les agents (les statuts `OCR_COMPLETED`/`LOW_CONFIDENCE`
  étaient auparavant ignorés en aval — seul `TEXT_EXTRACTED` était lu) ; provenance OCR pondérée à la baisse pour
  départager les conflits en faveur de la couche texte native. Fichiers : `intelligence/pipeline.e2e.test.ts`,
  `intelligence/twin/build-facts.ts`, `intelligence/extract/extract-text.ts` (statuts textuels partagés),
  `intelligence/jobs/runner.ts`, `intelligence/agents/orchestrator.ts`.
- **Regulatory Intelligence OS — capacités centrales (G1→G14, au-delà de la fondation).** La fondation
  « Secure CTD Intake » (ci-dessous, phases 0→6) est conservée ; ce lot livre les **critères d'acceptation**
  du Regulatory Intelligence OS, chacun vérifié (tsc + tests + build), org-scopé, audité, avec **statut réel /
  simulé / restant** explicité :
  - **Jumeau numérique sourcé (G1)** : ~30 faits réglementaires (`RegulatoryFact` + occurrences avec document/
    section/extrait exact/confiance/méthode/statut humain) ; écran de revue/approbation.
  - **Détection de conflits (G2)** : comparaison des occurrences d'un même fait entre documents → `RegulatoryConflict`
    (valeurs concurrentes, criticité, action, valeur finale approuvée).
  - **Corpus versionné (G3)** + **RAG réel (G4)** : `RegulatorySource/Version/Section/CorpusApproval` administrables
    (import/approuver/activer/retirer) ; recherche **FTS `french` + trigram `pg_trgm`** sur le corpus **ACTIF** avec
    **citations exactes** (pgvector indisponible ici → socle prêt pour embeddings). Sans source active :
    « EXIGENCE NON CONFIRMÉE — REVUE HUMAINE REQUISE ».
  - **Moteur de règles administrable (G5)** : `RegulatoryRulePack`/`RegulatoryRule` versionnés, testables (cas golden),
    sourçables ; 8 rule packs ANPP amorçables ; **repli** sur les profils codés tant qu'aucun pack actif (aucune régression).
  - **14 agents spécialisés (G6)** : prompt versionné, périmètre limité, **Zod**, sources autorisées, **citations RAG**,
    **abstention** (aucune source active → pas d'invention), tests golden ; orchestrateur + panneau à la demande.
  - **Comparaison V1/V2 (G7)** : fichiers inchangés/ajoutés/supprimés/remplacés (chemin + SHA-256), diff de faits.
  - **Boucle fournisseur (G8)** : questions + **BROUILLON** d'e-mail (IA ou modèle, **jamais envoyé auto**), échéance,
    statut, relance, historique.
  - **Réserves ANPP (G9)** : lettre → **OCR réel** → décomposition en points (verbatim) → catégorisation → réponse
    proposée → **approbation** → multi-cycles.
  - **Documents produits** : rapport de constats et lettre de réponse aux réserves (`.docx`, pizzip).
    ⚠️ La génération à partir de **modèles à trous** (note de pré-soumission, formulaire
    d'enregistrement…) a été **retirée** — elle rendait des coquilles à remplir à la main.
  - **Reviewer Simulator (G11)** : stress test 10 perspectives — **simulation interne NON prédictive**.
  - **OCR RÉEL (G13)** — **deux moteurs, contrat commun** (`REG_OCR_ENGINE` = `auto`|`mistral`|`tesseract`) :
    1. **PRIMAIRE — Mistral OCR** (`mistral-ocr-latest`, cloud) quand `MISTRAL_API_KEY` est présent : **un appel
       réseau par document** (multi-pages géré côté serveur), rapide et précis. Le runner **parallélise** l'OCR
       (pool document `REG_OCR_CONCURRENCY`, lot `REG_OCR_BATCH`≈24) → dossier de 50-100 fichiers en **quelques
       minutes** (au lieu de 1-3 h). **Documents MASSIFS (8 000–10 000 pages) : DÉCOUPAGE automatique par tranches**
       de pages (`REG_OCR_CHUNK_PAGES`≈400, sous les limites Mistral 1000 pages/50 Mo) via mupdf (`ocr/pdf-split.ts`),
       tranches océrisées **en parallèle** (`REG_OCR_CHUNK_CONCURRENCY`≈4) puis **fusionnées** dans l'ordre. Une
       tranche qui échoue → pages vides signalées (revue), les autres passent ; toutes en échec → repli Tesseract.
       Service **tiers payant à la page**, réseau sortant requis.
    2. **REPLI/AUTO-HÉBERGÉ — tesseract.js** + mupdf (rastérisation PDF) + sharp, langue **locale** fr/en/ar
       (hors-ligne, séquentiel). Pré-traitement renforcé : **agrandissement ×2 des petits scans** (<1400 px —
       photo de téléphone, fax) + netteté. En mode `auto`, tout échec Mistral (réseau/quota) bascule dessus —
       **jamais de perte**.
    3. **DERNIER ÉTAGE — SECOURS VISION** (`ocr/vision-ocr.ts`) : les pages restées **vides ou douteuses** après
       le moteur OCR (quel qu'il soit) sont re-rastérisées et **transcrites par le modèle multimodal** (recopie
       fidèle, tableaux « | », manuscrit/tampons, schéma JSON strict) — par lots de 4 pages, **plafonné**
       (`REG_OCR_AI_PAGES`≈40/document, `REG_OCR_AI=0` coupe), **tracé au registre des coûts** (`trackedLuna`,
       step `ocr-vision` : budget du dossier respecté, cache = une page scannée ne se paie qu'une fois). Fusion
       **sans régression** : une transcription ne remplace une page que si elle apporte PLUS de texte. Branché sur
       le pipeline CTD (`ocrOne`), le **chat de dossier** (pièces jointes — seuil d'illisibilité abaissé à ~10
       caractères : seul le VIDE est écarté, avec son motif) et l'**ingestion des lettres de réserves**.
    Texte + confiance par page, natif vs OCR séparés, pages vides/faibles → **revue humaine**. Mistral ne score pas
    la confiance → page non vide présumée fiable (95), page vide → 0/revue. **Garde de taille** : un document >~48 Mo
    (`REG_MISTRAL_OCR_MAX_MB`) part directement en OCR local (Mistral le refuserait — pas d'appel payant inutile).
    **Diagnostic en ligne** (droit d'upload) : `GET /api/regulatory/intelligence/ocr/diagnose` confirme le moteur
    actif + PING réel de la clé Mistral avant un gros upload. Code : `ocr/{ocr-engine,mistral-ocr,vision-ocr}.ts`.
  - **Upload résumable (G14)** : session + parties (chemin d'upload borné à **une partie** en RAM), reprise,
    vérif taille + **SHA-256**, finalisation explicite (assemblage en flux), quotas org, concurrence, nettoyage.
    Charge mesurée (RSS) : 50/150/300 Mo — pic UPLOAD ≈ une partie ; pic FINALISATION croît avec la taille.
  - **Lifecycle (G12)** : chronologie (soumission/séquences/modifications/renouvellements/version approuvée),
    opérations NEW/REPLACE/DELETE/APPEND, **analyse d'impact déterministe**, obligations & certificats expirants.
  - **PERSISTENCE & RÉUTILISATION** — tout ce que l'analyse produit reste durablement en base (aucune purge
    après traitement) : documents classés CTD, **texte extrait/OCR** (`RegulatoryExtraction`), **faits du jumeau**
    + occurrences sourcées (`RegulatoryFact`/`…Occurrence`, décisions humaines incluses), **bilan** (`RegulatoryAssessment`)
    et **constats** (`RegulatoryFinding`), archive d'origine figée (SHA-256). Une **couche de connaissance**
    (`knowledge/dossier-knowledge.ts`) expose une surface de LECTURE stable pour la suite — **pré-remplissage de
    formulaire de présoumission**, **préparation automatique de dossier**, **réponses aux réserves** — et pour
    l'**interrogation par le chatbot** : `getDossierKnowledge` (snapshot), `getApprovedFactMap` (faits validés →
    formulaire), `getDossierDocuments` (par module/section CTD), `searchDossierContent` (recherche plein texte,
    **extrait calculé côté base** → tient même sur un document océrisé de 10 000 pages).
  - **« Discuter avec ce dossier » — chatbot SOURCÉ (fichier · section · page)** (`knowledge/dossier-chat.ts`,
    panneau `chat-panel.tsx`) : à chaque question, on **décompose** la question en termes saillants + **synonymes
    FR/EN** du domaine + codes CTD (`expandQueryTerms`), on **récupère multi-termes classé** les passages des
    documents réellement lus (`searchDossierPassages` — score = nb de termes distincts, extrait ET décalage du 1ᵉʳ
    terme calculés **côté base**), et on résout la **PAGE EXACTE** de chaque extrait par le **décalage → `ocrPages.chars`**
    (`pageForOffset`, sans ré-océrisation). Le modèle ne reçoit que ces extraits + un **CONTEXTE structuré** (faits
    avec valeur retenue/conflit, complétude, **sections requises encore manquantes**, inventaire des documents avec
    sous-sections contenues et état d'extraction) et l'**historique récent** (questions de suivi) ; il doit **citer
    [n]**, distinguer proposé/confirmé, et **s'abstenir** si l'info n'y est pas (contenu traité en donnée non fiable —
    anti-injection). Sans clé IA : les sources restent affichées, **aucune réponse simulée**. La version AGENT
    (`knowledge/dossier-agent.ts`) est une **messagerie persistante** (`knowledge/dossier-thread.ts`,
    `RegulatoryDossierChatMessage`) : fil par dossier × utilisateur rechargé au montage, historique reconstruit **côté
    serveur**, pièces soumises conservées avec leur texte extrait et **re-présentées à l'agent** aux tours suivants ;
    pièce illisible = motif exact remonté, réponse sur le reste (jamais d'échec global).
  - **PDF de module CONSOLIDÉ → détection MULTI-SECTIONS** (`ctd/detect-sections.ts`) : un « Module 3.pdf » couvre
    en réalité 3.2.S / 3.2.P / 3.2.P.5 / 3.2.P.8… Un balayage précis (code CTD **corroboré par son titre** à ≤90 car.,
    frontières de mot — un simple renvoi « voir 3.2.P.8 » ne compte pas) renseigne `RegulatoryDocument.containedSections`
    (persisté, backfillé à la relance) ; la complétude et le jumeau **cessent de signaler ces sous-sections comme
    « manquantes » à tort**.
  - **Extraction de faits — anti-bruit** (`twin/extract-facts.ts`) : recherche par **mot entier** (« gel » ne matche
    plus « angel ») + **contexte borné à la phrase** (`localCtx`) qui **écarte** une voie « Intravenous » venant d'une
    canule/prélèvement PK, un stockage d'**échantillons** à –70 °C (≠ conservation du produit), une forme issue de
    « gélatine »… et **capte les associations** de teneurs « 50 mg / 300 mg » (y compris rédigées « … et … », INN
    accentués compris) sans confondre avec une posologie.
  - **Stockage blobs — jusqu'à ~1 Go/fichier** : contenu chiffré AES-256-GCM ; un gros fichier est écrit **EN
    TRANCHES** ordonnées (`FileBlobChunk`, `REG_BLOB_CHUNK_MB`≈16) plutôt qu'en un bytea unique — pas d'encodage
    hex géant → mémoire bornée en écriture **et** lecture. Plafond par fichier `REG_MAX_PG_FILE_MB` (défaut **950 Mo**).
    NB honnête : *océriser* un PDF proche d'1 Go reste borné par la RAM (mupdf charge le PDF) — prévoir ≥ 4 Go, ou activer le stockage objet.
  - Réalités infra assumées : stockage = **blobs Postgres chiffrés** (pas S3) ; IA = **opt-in sur clé** (abstention
    honnête sinon, aucune simulation). Code : `src/lib/regulatory/intelligence/{twin,corpus,rules,agents,diff,ocr,
    upload,docgen,reserves,supplier,simulator,lifecycle,knowledge}` ; admin corpus/règles `src/app/(app)/admin/regulatory-corpus/`.
- **Regulatory Intelligence OS** — **analyseur de dossier CTD (phases 0→6).** Onglet **Analyse CTD**
  sous Regulatory → Enregistrement, débloqué **par organisation** par le Super Admin
  (`RegulatoryFeatureAccess`, bascule dans Administration → Réglages). Circuit : dépôt d'un **dossier CTD
  en ZIP** → **inspection sécurisée** (anti ZIP-bomb, path traversal, exécutables/macros refusés, chemins
  vérifiés) → chaque fichier **conservé chiffré** (blob SHA-256), **archive originale figée** → **extraction
  de texte** (txt/docx/xlsx ; PDF via pdf-parse ; scans → OCR requis) + **détection MIME** (octets magiques)
  → **classification CTD déterministe** (module 1 Algérie + 2-5 ICH ; code/mots-clés/module, avec évidence)
  + **nom de fichier proposé** → **moteur de règles déterministe** : complétude par type de procédure,
  **bloqueurs critiques** (section obligatoire manquante, dossier vide), **jamais de fausse conformité**
  (un score élevé ne rachète pas un bloqueur) → **constats** (sécurité/complétude/extraction/classification)
  + **bilan de conformité** → **revue IA optionnelle** (fond/forme) **encadrée** : sortie **validée par Zod**,
  **anti-injection de prompt**, statut **PROJET — REVUE HUMAINE REQUISE**, **jamais bloquante**, active
  seulement si `ANTHROPIC_API_KEY` (aucune simulation sinon). **Analyse PAR PARTS de ~10 pages** (`agents/chunk-text.ts`)
  sur **TOUS** les documents lisibles (natif + OCR), sections prioritaires d'abord, **parallélisée**
  (`REG_AI_CONCURRENCY`) et **robuste** (une part en échec n'arrête pas les autres) ; bornée en coût
  (`REG_AI_MAX_CHUNKS` parts/version, 0 = illimité) et en volume de constats (`REG_AI_MAX_FINDINGS`, plus
  sévères d'abord) → **revue humaine** (constat pris en compte /
  résolu / **levé avec justification** par un rôle d'approbation ; nom proposé **approuvé**) → **porte de
  soumission** (« prêt pour revue »/« soumis » **verrouillés** tant qu'un bloqueur reste ouvert). Traitement
  **asynchrone Node-first** (`RegulatoryJob` + runner : verrou, reprise, lots, réessais) branché sur le
  planificateur interne (+ déclenchement immédiat après upload). Tout est **org-scopé**, **audité**
  (`RegulatoryAuditLog`), **testé** (inspecteur ZIP, ingestion, extraction, MIME, classification golden,
  moteur de règles, agent IA, porte de soumission). Cartographie détaillée : `docs/regulatory-intelligence/`.
  Code : `src/lib/regulatory/intelligence/` (`access`, `ingest`, `extract`, `ctd`, `rules`, `twin`, `agents`,
  `jobs`, `lifecycle`) + workspace `src/app/(app)/regulatory/enregistrement/analyse/`.
- **Lot T** — **Regulatory : Enregistrement ANPP (phase 1 — base de connaissance + expertise du bot).**
  **Base de connaissance réglementaire** algérienne intégrée (`src/lib/regulatory/anpp-knowledge.ts`) : droits
  d'enregistrement (bordereaux de versement), délais légaux par phase, pièces, **dossier CTD (5 modules ICH)**,
  formulaire de pré-soumission, modifications (mineure/modérée/majeure), décision (validité 5 ans), motifs de refus,
  références légales (décret 20-325 ; arrêtés 10/05/2021 et 03/10/2021). **L'assistant IA devient EXPERT** de ce
  cadre pour tout utilisateur ayant accès à Regulatory (digest injecté dans le system prompt — réponses fondées sur
  les articles, sans invention). **Onglet « Enregistrement (CTD) »** sous Regulatory, **masqué** tant que le Super
  Admin ne l'a pas débloqué (`AppSetting.regEnrollmentEnabled`, bascule dans Administration → Réglages) ; il affiche
  le **référentiel** complet. *Phase 2 à venir : analyseur de dossier CTD (décompression ZIP → lecture/renommage →
  analyse IA fond/forme vs loi algérienne + UE → préparation des formulaires).*
- **Lot S** — **Anti-blocage Infomaniak définitif : disjoncteur + cache.** Complète le Lot R. Quand Infomaniak
  sature (≥ `MAIL_BREAKER_THRESHOLD` échecs), un **disjoncteur** s'ouvre et la plateforme **arrête totalement** de
  le contacter pendant un temps de repos (`MAIL_BREAKER_COOLDOWN_MS`) — insister aggrave/prolonge le blocage IP ;
  au repos, l'IP se débloque seule. Pendant ce temps, la boîte est servie depuis un **cache mémoire** (dernière
  liste synchronisée + messages déjà ouverts) → l'utilisateur **voit toujours ses mails**, bandeau ambre « dernière
  synchronisation » + **nouvelle tentative auto**. Le **cache frais** fusionne aussi les chargements rapprochés
  (moins de connexions). `src/lib/mail.ts` (`loadInbox`/`getMessage` cache-aware, disjoncteur), route
  `/api/mail/messages` (`stale`/`syncedAt`), `courrier/mail-client.tsx` (bandeau + retry). Purge du cache à la
  déconnexion de la boîte.
- **Lot R** — **Fiabilité e-mail : fin des « command failed » à répétition.** Cause : sur l'hébergeur, **toutes** les
  boîtes sortent par la **même IP** ; Infomaniak limite les connexions IMAP **par IP** — plusieurs utilisateurs
  actifs (ou une rafale de reconnexions) saturaient l'IP → erreur en continu. Le verrou par compte existant ne
  bornait pas la concurrence **globale**. Ajouts (`src/lib/mail.ts`) : **plafond global** de connexions IMAP
  simultanées (`MAIL_MAX_CONCURRENCY`, défaut 3, file d'attente au-delà) · **plafond de connexions chaudes**
  (`MAIL_MAX_POOL`, éviction LRU) · **revalidation NOOP** d'une connexion inactive avant réutilisation (plus de
  « command failed » sur socket mort) · **réessais à back-off exponentiel** (0,4 → 0,8 → 1,6 s) sur erreur
  transitoire. Résultat : l'écrasante majorité des aléas fournisseur se résorbent **sans erreur visible**.
- **Lot Q** — **Téléversement de documents refondu** (dossiers CTD & tous objets métier). Avant : **un** fichier à
  la fois via action serveur (lent, re-rendu complet à chaque envoi, whitelist d'extensions restrictive → l'import
