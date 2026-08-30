# Adam — voix temps réel & Context OS : rapport de mesure

**Branche** `claude/hopeful-goodall-phd0nb` · commits `5ec992b`, `f626e03`, `7a96773`, `e3f9637`

Ce rapport couvre deux missions menées ensemble parce qu'elles demandent la même chose sous deux
angles : **REBUILD ADAM LIVE VOICE UX** et **ADAM CONTEXT OS**. Les chemins rapides vocaux (§7 de
la première) et les *fast paths* (§9 de la seconde) sont le même mécanisme ; la survie du contexte
(§8 vocale) et le WorkingSet (§15/§16) sont le même module. La voix est donc traitée comme une
**modalité** du Context OS, ce que le champ `modality` de `CompiledContext` impliquait déjà.

> **Règle tenue tout du long** : aucun gain n'est annoncé sans mesure. Là où un chiffre est
> projeté plutôt qu'observé, c'est écrit. Là où une section de mission n'est pas faite, c'est
> écrit aussi — en fin de document, sans enrobage.

---

## 1. La mesure de référence (§1 des deux missions)

Mesurée sur un compte réel de la base, droits effectifs résolus (`scripts/context-baseline.ts`).
**Les caractères sont exacts. Les tokens sont estimés** — aucun tokeniseur de fournisseur n'est
installé dans ce dépôt, et les décisions prises avec ce chiffre sont des décisions de *ratio*.

| Bloc envoyé à chaque tour | Caractères | Tokens (est.) |
|---|---:|---:|
| Prompt système — texte | 43 084 | 15 421 |
| **Schémas d'outils — texte** | **55 553** | **23 316** |
| **Total fixe par tour — texte** | **98 637** | **38 737** |
| Contexte — voix | 7 888 | 2 773 |
| Schémas d'outils — voix | 28 096 | 11 481 |
| **Total fixe par tour — voix** | **35 984** | **14 254** |

**77 outils** exposés en texte, **34** en voix — à chaque tour, quelle que soit la question.

### Le résultat le plus important de l'audit

**Le prompt n'était pas le premier poste de dépense : les schémas d'outils le sont, à 60 %.**

La mission vocale demandait de réduire un prompt de ~12 000 caractères. La mesure montre que ce
prompt est le petit côté du problème : le PDG n'a pas encore ouvert la bouche que 23 316 tokens
sont dépensés à expliquer au modèle comment lire une fiche de paie — alors qu'il demande si Deepak
a répondu.

Et ce n'est pas qu'une question de facture : soixante-dix-sept descriptions d'outils, c'est aussi
soixante-dix-sept occasions de choisir le mauvais.

---

## 2. Routage — avant / après, sur deux bancs distincts

Deux corpus, et ils ne disent pas la même chose.

### Banc d'apprentissage — 158 demandes (`golden-corpus.ts`)

Dont **29 verbatim du PDG** (transcriptions réelles de ce projet) et 129 construites pour couvrir
les domaines que les transcriptions n'atteignent pas. La provenance est étiquetée par cas et
comptée séparément.

| | Avant | Après |
|---|---:|---:|
| Justesse de route | **78,5 %** | **100 %** |
| … sur le verbatim PDG | 82,8 % | **100 %** |
| Justesse de domaine | 80,4 % | **100 %** |
| **Confusions lire ↔ agir** | **8** | **0** |

> **Ce corpus a servi à régler le routeur.** Son score est un score d'apprentissage : il vérifie
> qu'on n'a rien cassé, il ne prouve pas qu'on généralise. C'est pourquoi il y en a un second.

### Banc réservé — 40 demandes inédites (`holdout-corpus.ts`)

Écrit **après** le gel du routeur, jamais utilisé pour le régler, exécuté **une seule fois**.

| | Résultat |
|---|---:|
| Justesse de route | **85,0 %** |
| Justesse de domaine | **95,0 %** |
| Confusions lire ↔ agir | **0** |

**Et le point qui compte le plus : les six échecs retombent tous sur le chemin généraliste ou
structuré. Aucun ne retombe sur un raccourci ni sur une action.** Manquer un raccourci coûte une
seconde ; répondre vite et à côté coûte la confiance. L'asymétrie conçue à dessein tient sur des
phrases jamais vues — et un test l'exige explicitement, cas par cas.

Les six manques sont conservés en échec dans le banc. Les corriger reviendrait à transformer le
jeu réservé en jeu d'apprentissage, et à perdre la seule mesure honnête dont on dispose.

### Ce que le banc a trouvé, et qu'aucune relecture n'aurait vu

| Énoncé | Partait vers | Cause |
|---|---|---|
| « Pourquoi Deepak ne répond pas ? » | boîte mail | le mot « répond » |
| « Compare l'avancement de X et Y » | fiche de X | « avancement » |
| « Combien de paiements en attente ? » | file de décisions du PDG | « en attente » |
| « Quels documents sont arrivés ? » | messagerie | « arrivés » |
| « Paie la facture de Pharmagene » | domaine RH | « la paie » et « paie » sont le même mot |
| « Peux-tu envoyer le mail à Deepak ? » | chemin généraliste | le verbe n'était plus en tête |
| « Quelque chose de nouveau dans la boîte ? » | boîte filtrée sur « nouveau » | « de » pris pour un expéditeur |
| « Raltegravir », « Nintedanib » | aucun domaine | 1ʳᵉ cause d'erreur de domaine |

Les DCI se reconnaissent désormais à leurs **segments-clés OMS** (`-vir`, `-nib`, `-mab`,
`-prazole`…) : c'est la nomenclature officielle, pas une heuristique de fortune, et elle attrape
les molécules que ce dépôt ne connaît pas encore. Les entités réellement présentes en base
(`ctx.knownEntities`) restent prioritaires.

### Trois de mes propres attentes étaient fausses

Corrigées, et signalées comme telles :

- **« Donne-moi les salariés et leurs e-mails »** n'est pas une action. C'est un ordre
  grammatical, mais une lecture : rien n'est créé, modifié ni envoyé. Le classer en écriture
  l'aurait fait passer par les gardes de confirmation. → `ACTION` veut dire **« ça mute »**, pas
  « c'est à l'impératif ».
- **« Qui m'a écrit ce matin ? »** — Gmail *est* la source canonique déterministe.
- **« Faut-il recruter ? »** demande un jugement, pas un fait.

---

## 3. Schémas d'outils — le vrai levier (§23, §24)

| | Outils | Tokens (est.) |
|---|---:|---:|
| Catalogue complet | 77 | 23 316 |
| Domaine MAIL | 11 | 3 568 |
| Domaine REGULATORY | 10 | 3 086 |
| Domaine FINANCE | 8 | 2 785 |
| Domaine HR | 12 | 3 402 |
| Domaine DRIVE | 17 | 5 324 |

**Sur les 158 demandes du banc : 3 683 928 → 554 967 tokens de schémas, soit −84,9 %.**
Et **42 demandes (26,6 %) n'appellent aucun modèle** — le code répond.

### La parité est garantie par trois mécanismes, pas par une intention

1. **Tout outil est classé.** `tool-shortlist.test.ts` échoue si un seul outil du registre manque
   au classement. Un outil ajouté demain sans classement casse la CI — il ne disparaît pas en
   silence du champ de vision d'Adam.
2. **Un socle de quatre outils est toujours présent** : chercher partout, ouvrir une fiche,
   identifier une personne, **retenir**. Avec eux, un domaine mal deviné coûte un tour de plus,
   jamais un « je ne peux pas ». (`remember` est dans le socle parce que c'est le seul transverse
   dont l'absence ne se rattrape pas au tour suivant.)
3. **`list_more_tools` existe.** La liste courte est un **ordre de présentation**, pas une
   amputation. Un outil non classé est d'ailleurs **conservé**, jamais écarté : le défaut penche
   du côté sûr.

### Un défaut trouvé par le test, pas par la relecture

La première version ajoutait le jeu `GENERAL` à *tous* les domaines : les vingt-deux outils
transverses repartaient dans chaque liste et la « liste courte » ne raccourcissait rien. Le test
l'a montré en une ligne — raisonnement profond et requête simple rendaient exactement le même
nombre d'outils.

---

## 4. Distribution mesurée (§28)

Mesurée sur le banc, **pas forcée** :

| Route | Part |
|---|---:|
| `FAST_DETERMINISTIC` | 26,6 % |
| `STRUCTURED_QUERY` | 22,2 % |
| `HYBRID_RETRIEVAL` | 21,5 % |
| `ACTION` | 15,2 % |
| `DEEP_REASONING` | 14,6 % |

Déterministe + structuré = **48,8 %**, en dessous de la cible indicative de 70–80 %. La mission dit
de ne pas forcer ces pourcentages, et le banc contient délibérément beaucoup de cas difficiles ;
le chiffre de production sera donné par le mode ombre, sur les vraies demandes.

### Une cinquième route, assumée

La mission en cite quatre. `ACTION` a été ajoutée : « Assigne les Nintedanib à Raihana » n'est ni
une lecture rapide, ni une requête, ni une recherche, ni un raisonnement — c'est une écriture, et
l'architecture cible se termine précisément sur un *Action Engine*. Sans elle, toutes les écritures
tombaient dans `DEEP_REASONING` et gonflaient artificiellement la part de « raisonnement profond »
— exactement la statistique que §28 demande de mesurer sans la fausser.

---

## 5. Voix — ce qui est construit et testé

**184 tests** sur les modules voix + contexte, **3 516** sur l'ensemble du dépôt.

| Section | Module | Ce qu'il garantit |
|---|---|---|
| §1 | `voice/turn-metrics.ts` | Attribution **ordonnée** des pannes : audio → transcription → détection de tour → compréhension → outil → restitution, en s'arrêtant au **premier** étage cassé. Sans cet arrêt, un micro saturé produirait quatre échecs pour une panne, et le tableau accuserait toujours le dernier maillon. |
| §1 | `VoiceTurnLog` + migration | Un enregistrement **par tour**, pas par session. Aucun audio stocké ; la transcription finale l'est, sans quoi on ne distingue pas une panne d'oreille d'une panne de compréhension. |
| §5 | `voice/uncertainty.ts` | Tolérance **asymétrique** : une lecture passe sur un signal médiocre, une suppression exige un signal franc. La saturation compte comme un doute *même* quand le fournisseur annonce une confiance haute — c'est précisément le cas où sa confiance est mensongère. Un outil inconnu est traité comme une écriture. |
| §7 | `voice/fast-path.ts` | Les six formes nommées par la mission, chacune testée verbatim. |
| §8 §15 §16 | `context/working-set.ts` | « Relance-la » résout « la ». Branches suspendues restaurables, **une seule versée au contexte**. Rendu testé **sous 80 tokens** après vingt tours et vingt fils. |
| §10 | `voice/delivery.ts` | `RECEIVED → WORKING → RESULT_READY → DELIVERING → DELIVERED`, deux invariants testés : **on sort toujours** (« je n'ai pas pu » est une restitution, le silence n'en est pas une) et **on ne dit qu'une fois** (`DELIVERING` est le verrou d'unicité). |
| §12 §16 | `VOICE_SLO` | Budgets par segment ; première réponse rapide ≤ 1,5 s. Un tour n'est un succès que s'il a été entendu, compris, servi par la bonne source, **restitué tout seul**, et sans bavardage. |

### Les seuils de latence sont des **cibles**, pas des mesures

`VOICE_SLO` définit les budgets et le code sait juger un tour contre eux. **Aucune latence réelle
n'a été mesurée** : cela demande des appels sur vrai matériel, qui n'existe pas dans ce
conteneur. Le dispositif est prêt à produire ces chiffres dès le premier appel réel.

---

## 6. Mode ombre — branché, sans changer le comportement (§30)

Le nouveau routeur tourne à côté des **deux** boucles de l'assistant (texte et flux), dans un
`finally` — donc sur tous les chemins de sortie, y compris l'erreur, qui est justement le tour
qu'on veut pouvoir expliquer. Il ne décide de rien. Toute exception y est avalée : un tableau de
bord qui casse le produit qu'il observe est pire que pas de tableau de bord.

**La question qu'il pose est la seule qui décide de la bascule :**

> « Sur les tours réels, la liste courte contenait-elle **toujours** l'outil que le chemin actuel
> a effectivement appelé ? »

Ce n'est pas une opinion : le chemin actuel voit les 77 outils et choisit ; on vérifie après coup.
Un manque est **nommé**, pas constaté — on sait quel outil et quel domaine corriger.

Le seuil exige **deux** conditions : ≥ 99 % de couverture **et** ≥ 200 tours. Cent pour cent sur
dix tours ne prouve rien, et un test l'exige. Un tour jugé déterministe qui appelle quand même un
outil est compté comme un **manque**, pas absous : c'est l'information la plus précieuse du
dispositif, elle dit que le raccourci se serait trompé.

Le journal ne porte **jamais** le texte de l'énoncé — seulement sa longueur et la route. Ce
journal sert à régler un aiguillage, pas à relire les conversations du PDG ; un test le vérifie.

**Ce qu'il mesurera est un plancher** : la boucle texte n'a pas encore de jeu de travail, donc les
formes qui dépendent du contexte (« Et Raihana ? », « Envoie-le », « Alors ? ») n'y prennent pas
leur raccourci. La version branchée fera mieux, jamais moins bien.

---

## 7. Ce qui n'est PAS fait

Les deux missions comptent 48 sections. Voici celles qui ne sont pas traitées, sans enrobage.

### Mission vocale

| § | Non fait | Pourquoi |
|---|---|---|
| 2 | Panneau de diagnostic micro | Demande du matériel réel et une UI ; le modèle de données (`inputPeak`, `clipped`, `inputDevice`) existe et l'attend. |
| 3 | Réglage de la VAD sur enregistrements | La mission exige de régler « sur des conversations enregistrées, pas au jugé ». Il n'y en a aucune ici. Régler au jugé serait faire exactement ce qu'elle interdit. |
| 4 | Banc de transcription + vocabulaire personnalisé | Demande de l'audio réel. |
| 6 | Réduction du prompt vocal | **Mesuré (7 888 car. de contexte + 11 481 tokens de schémas), pas encore réduit.** La liste courte s'applique au texte ; son portage vocal reste à faire. |
| 9, 11 | Zéro bruit interne, parler moins | Le critère est codé dans `evaluateTurn` (bavardage = échec) ; le *façonnage* des réponses ne l'est pas. |
| 13 | Red team écho / faux barge-in | Demande du matériel. |
| 14 | États d'UI de reconnexion | Non fait. |
| 15 | ≥ 100 scénarios parlés réels | Demande du matériel. Le banc de **routage** existe (198 cas) ; le banc **vocal** non. |
| 17 | Abstraction `VoiceRealtimeProvider` | Non fait. |
| 18 | E2E sur vrai matériel + enregistrement opt-in | Demande du matériel. |
| 1 | Vue de débogage vocal dans `/admin/ai` | Le modèle et les calculs existent ; l'écran non. |

### Mission Context OS

| § | Non fait | Pourquoi |
|---|---|---|
| 2 | Projection `CompanyState` élargie | L'outil `company_state` existe déjà ; la projection liée Personne↔Produit↔Mission↔Fil↔Engagement n'a pas été étendue. |
| 4 | Mémoire d'événements temporels normalisée | `what_changed` couvre une partie ; la table d'événements normalisée n'est pas faite. |
| 5 | Hiérarchie L0–L3 formalisée | L0 existe (WorkingSet). L1–L3 restent implicites dans les outils. |
| 6 | `ContextCompiler` en un seul point d'entrée | Ses **pièces** existent (routeur, budgets, jeu de travail, liste courte) ; le `compile()` unique qui les assemble n'est pas écrit. |
| 11, 12, 13 | Récupération hybride, reranking, Recall@K / MRR | Non fait. La recherche sémantique Drive existante n'a pas été refondue en pipeline lexical + vecteurs + fusion + reranker. |
| 17 | Préchargement prédictif | Non fait. |
| 18 | Module d'autorité + contradictions | L'échelle d'autorité existe (`budget.ts`, `CANONICAL > PROJECTION > PROVIDER > EVIDENCE > INFERRED`) et pilote le classement ; le **moteur de contradiction** non. |
| 19 | Invalidation par événement | Non fait. |
| 20, 21 | Routeur de modèles | Le routeur choisit une *route* et un *budget*, pas encore un modèle. |
| 22 | Cache de préfixe stable | Non fait — la séparation doctrine stable / jeu de travail dynamique le prépare. |
| 25 | Projections en tâche de fond | Non fait. |
| 27 | Tableaux de bord | Les données existent ; les écrans non. |

### Et le point le plus important

**Ni la liste courte ni le routeur ne sont branchés sur le chemin de production.** Seul le mode
ombre l'est, et il n'influence rien.

C'est délibéré et c'est ce que §30 demande — « run in shadow mode… then cut over once benchmarks
pass. Do not destabilize production Adam ». Couper 69 outils sur le chemin critique de l'assistant
de toute l'entreprise sur la foi d'un banc de 158 phrases serait exactement le raisonnement qui
casse les produits. Le banc dit que la direction est bonne ; il ne dit pas que la couverture est
complète.

**La bascule s'autorisera d'elle-même** : 200 tours réels, 99 % de couverture, et la liste des
outils manquants nommés un par un.

---

## 8. Vérification

- `npx tsc --noEmit` — propre
- `npm run lint` — aucun avertissement
- `rm -rf .next && npm run build` — build propre (l'avertissement du CLAUDE.md sur le cache `.next` est respecté)
- `npx vitest run` — **3 516 tests passés**, 23 ignorés, 0 échec
- Migration `20260828090000_voice_turn_log` **enregistrée** via `db:deploy` (et non appliquée à la main — l'audit d'infrastructure du Test Center échouerait sinon)

> Note : un passage antérieur de la suite complète a montré 7 échecs dans `workflow/engine.test.ts`
> et les ordres de dépense, dus à des collisions de `reference` unique sous exécution parallèle.
> Instabilité préexistante sur une séquence partagée, sans rapport avec ces modules ; le passage
> suivant, comme les précédents, est vert.

---

# ADDENDUM — ACTIVATION DU ROUTEUR (26 août 2026)

Ce qui précède décrivait un routeur **en mode ombre**. L'autorisation de la mission a levé cette
réserve, mais **partiellement**, et c'est le fond du sujet :

> « I authorize the new router/tool-shortlist to become ACTIVE now for safe READ-ONLY operations.
> I authorize a 20% canary for the remaining READ-ONLY traffic. I do NOT authorize migration of
> sensitive mutation execution to the new path yet. »

## 1. Ce qui est ACTIF, et ce qui ne l'est pas

| Chemin | Trafic | Statut |
|---|---|---|
| `FAST_READ` — annuaire, Gmail, agenda, fiche canonique, file de décisions | 25,9 % du corpus | **ACTIF**, sans tirage au sort |
| `SHORTLIST` — le reste des lectures | 8,9 % (canary 20 %) | **ACTIF**, borné |
| `LEGACY` — mutations + lectures hors canary | 65,2 % | **INCHANGÉ** |

Les mutations sensibles — envoi de mail, modification ERP, suppression, paiement, salaire, RH,
permissions, comptes — restent sur le chemin prouvé, avec RBAC, approbation, audit et idempotence.
`rollout.test.ts` le vérifie sur huit formulations, **canary ouvert à 100 %** pour prouver que le
pourcentage n'y change rien.

Le cas qui résume la règle : **« Envoie-le »** est classé `FAST_DETERMINISTIC` par le routeur, mais
il EXPÉDIE UN MAIL. Il est nommément renvoyé sur `LEGACY`. C'est le seul endroit où « rapide » et
« sûr » se contredisent, et la sécurité l'emporte.

## 2. CORRECTION D'UNE MESURE FAUSSE

Le rapport ci-dessus publiait : *« 23 316 tokens de schémas d'outils, soit 60 % du contexte fixe »*.

**Ce chiffre était faux.** Il pesait `powerToolsFor(user)` — les 77 outils de POUVOIR — alors que la
boucle envoie la liste ENTIÈRE : lectures + pouvoirs + export + super-admin + écritures, soit **159
définitions**. La mesure corrigée, sur le même compte :

| Bloc | Caractères | Tokens (est.) |
|---|---|---|
| Prompt système — texte | 43 430 | 15 542 |
| **Schémas d'outils — texte** | **219 232** | **93 025** |
| · dont outils de pouvoir (l'ancien chiffre) | 55 840 | 23 411 |
| TOTAL fixe par tour | 262 662 | **108 567** |

**Les schémas ne sont pas 60 % du contexte fixe : ils en sont 85,7 %.** L'ancienne mesure le
sous-estimait d'un facteur quatre. La conclusion qualitative ne change pas — elle se renforce : le
prompt système n'est pas le problème principal, et §13/§14 (« attaquer le prompt système »)
travailleraient sur les 14,3 % restants.

## 3. Le gain RÉELLEMENT branché

Mesuré sur le corpus d'apprentissage (158 demandes), avec la décision d'aiguillage exacte et le
canary à 20 % :

- avant : **14 697 950** tokens de schémas (93 025 × 158)
- après : **10 614 507** tokens (moyenne 67 180 / tour)
- **écart : 27,8 % de schémas en moins**

Ce n'est pas les 86 % de la projection : cette projection portait sur des **plafonds de budget**
et supposait le routeur actif partout. Ici, 65 % du trafic reste délibérément sur l'ancien chemin.
Le reste du gain est **autorisé mais pas encore pris** — il viendra de l'élargissement du canary,
et seulement si la garde reste verte.

⚠ La distribution du corpus d'apprentissage n'est pas celle de la production. Le chiffre qui
comptera est celui du mode ombre en conditions réelles.

## 4. Le jeu réservé, toujours honnête

Après le travail sur l'annuaire (qui a ajouté deux formes rapides et corrigé un vrai bug) :

| Corpus | Route | Domaine | Confusions lire/agir |
|---|---|---|---|
| TRAIN / GOLDEN (158) | 100,0 % | 100,0 % | 0 |
| **HELD-OUT (40)** | **85,0 %** | **95,0 %** | **0** |

**Le jeu réservé n'a pas bougé** — mêmes six échecs qu'avant ce lot (h-01, h-02, h-14, h-17, h-19,
h-31). Il n'a pas été touché, et aucun seuil n'a été desserré. C'est ce qui rend son chiffre lisible.

Corrigé au passage : le banc annonçait « 40 demandes, dont 29 verbatim et 129 construites » sur le
jeu réservé — la provenance était empruntée au corpus d'apprentissage. Un en-tête faux au-dessus de
chiffres justes. Elle est désormais comptée sur le corpus réellement passé, et un sous-score sans
population affiche « — » au lieu de « 0,0 % ».

## 5. Le repli automatique (§8)

`guardStatus()` tient une fenêtre glissante de 500 tours. Au-delà de 50 échantillons : mauvais outil
> 1 % ou outil manquant > 1 % → **tout repart sur `LEGACY`**, sans intervention.

**Sa limite, dite franchement** : la fenêtre est **en mémoire du processus**. Avec plusieurs
instances, chacune protège son propre trafic, pas le trafic global. C'est un compromis acceptable à
20 % sur des lectures ; **elle devra devenir partagée avant d'autoriser la moindre mutation**.

Le repli seul ne déclenche pas la garde : §4 exige qu'un raté devienne généraliste, et punir le
repli reviendrait à punir la sécurité elle-même.

## 6. L'échappatoire enfin exécutée

`list_more_tools` était **déclaré sans code derrière** — une promesse non tenue. Sans lui, la liste
courte aurait été une amputation : le jour où le routeur se trompe de domaine, une capacité
disparaît en silence.

`context/discovery.ts` l'exécute : il rouvre un domaine EN COURS de boucle, n'accorde aucun droit
(chaque outil revérifie à l'exécution), ne révèle jamais un outil fermé à cette personne, et
**compte chaque appel comme « outil manquant »**. L'échappatoire répare le tour ; le compteur
répare le routeur.

## 7. L'espace de travail génératif

La conversation ne rend plus la donnée en texte seul. Le serveur traduit la sortie d'une source
canonique en **blocs typés** (`workspace/protocol.ts`), et le client ne sait rendre que ces
blocs-là : fiche de contact, annuaire, messages, agenda, file de décisions, fiche canonique,
tableau, chronologie.

**Le modèle n'écrit aucun balisage.** C'est la réponse directe à l'incident où « Bonsoir, ça va ? »
a produit vingt-sept résultats bruts à l'écran, dont six lignes de salaire : une forme non reconnue
**ne compose rien**, et la réponse reste du texte. `compose.test.ts` verrouille ce cas exact.

Vérifié à l'écran (rendu réel, 900 px et 390 px) : aucun débordement horizontal. Sur téléphone,
l'annuaire n'est **pas** un tableau rétréci — un tableau à trois colonnes sur 390 px écrivait
l'adresse une lettre par ligne — mais une liste de fiches.

## 8. Ce qui n'est PAS fait

- **La garde est par instance** (cf. §5). À rendre partagée avant toute mutation.
- **Le canary n'a pas bougé de 20 %.** §9 exige 200 tours réels, ≥ 99 % de couverture et 0 misroute
  dangereux avant 50 %. `readyForNextStep()` refuse tant que les DEUX conditions ne sont pas tenues.
- **§13/§14 (déplacer les règles du prompt système)** : non fait. La mesure corrigée montre que ce
  chantier porte sur 14,3 % du contexte fixe, pas sur la majorité.
- **Renderers restants** : composeur de mail, comparaison de documents, plan de mission, brief de
  réunion. Le protocole les accueille ; ils n'ont pas de rendu.

## 9. Vérification de ce lot

- `npx tsc --noEmit` — propre
- `npm run lint` — aucun avertissement
- `npx vitest run` — **3 667 tests passés**, 23 ignorés, 0 échec
- `rm -rf .next && npm run build` — build propre
- `npx playwright test` — **13 passés**
- Banc de routage rejoué sur les deux corpus (§4 ci-dessus)

---

## 10. Audit voix — VIRAGE NATIF (2026-08-30)

Compte rendu utilisateur : « parfois Adam ne répond pas ; parfois je parle et Adam continue de
parler ; parfois Adam se tait alors que je parle ; interruptions peu naturelles ; latence
ressentie trop élevée. » Audit complet du code voix (WebRTC, VAD, barge-in, restitution,
reconnexion), comparé aux recommandations OpenAI Realtime actuelles (GA `gpt-realtime`).

### 10.1 Cause(s) racine(s)

Le correctif §233 avait pris le contrôle de l'interruption **côté client** (`interrupt_response:
false`) et exigeait des **mots transcrits** pour confirmer une coupure tant que le haut-parleur
jouait — une auto-protection contre l'écho. Il a **sur-corrigé** :

1. **« Adam continue de parler quand je l'interromps » (racine principale).** La coupure
   attendait l'arrivée des mots de la transcription parallèle (`gpt-4o-mini-transcribe`, 0,4–1,5 s
   de retard). Une vraie interruption traînait donc jusqu'à 1,5 s. C'est aussi une **violation de
   la règle « la transcription parallèle ne doit jamais bloquer le temps réel »** : le barge-in
   DÉPENDAIT du STT.
2. **« Adam se tait alors que je parle » / « interruptions peu naturelles ».** `semantic_vad`
   avec `eagerness: auto` clôturait le tour sur une hésitation française (« alors… euh… »), et le
   va-et-vient coupure/relance stuttérait.
3. **Voix féminine** (`marin`) là où l'appel exécutif voulait une voix masculine posée.
4. Les silences (« Adam ne répond pas ») étaient déjà couverts par le watchdog de restitution et
   la garde de tour bloqué (§232) — conservés intacts.

### 10.2 Correctifs (natifs, STT-indépendants)

| # | Correctif | Fichier | Avant → Après |
|---|---|---|---|
| 1 | Interruption NATIVE | `voice-tuning.ts` `buildTurnDetection` | `interrupt_response: false` → **`true`** (le serveur coupe la génération dès qu'il entend la parole ; recommandation OpenAI) |
| 2 | Barge-in client rapide, sans les mots | `voice-tuning.ts` `bargeInDecision` | la porte « haut-parleur actif → seuls des mots coupent » est **supprimée** ; une parole soutenue **≥ 180 ms** coupe (avant : ≥ 400 ms **ET** mots requis) |
| 3 | Seuils | `voice-tuning.ts` | `BARGE_IN_SUSTAIN_MS` 400 → **180**, `BARGE_IN_NOISE_MS` 350 → **140** |
| 4 | VAD pour hésitations FR | `voice-tuning.ts` | `eagerness: auto` → **`low`** ; `server_vad silence` 500 → 600 ms |
| 5 | Voix masculine | `voice-realtime.ts` | défaut `marin` (F) → **`cedar`** (M, naturelle GA) ; `OPENAI_REALTIME_VOICE` surcharge |
| 6 | Repli mesuré | `voice-tuning.ts` | `OPENAI_VOICE_INTERRUPT=client` rend l'interruption au client (interrupt_response:false) **si un écho réel se met à couper Adam** — le seul cas où le natif serait à revoir |

Conservés **intacts** (orthogonaux, et ils marchent) : propriété de la réponse + watchdog
(§232, « jamais muet »), hygiène des événements périmés, debounce par segment, suppression du
bruit committé, reconnexion à quota respecté. Le geste de coupure reste `response.cancel` +
`output_audio_buffer.clear` + `conversation.item.truncate` (§6 de la demande).

### 10.3 Le compromis, dit honnêtement

`interrupt_response: true` **délègue la robustesse à l'écho** à l'annulation d'écho du navigateur
(`echoCancellation: true`, déjà en place) + au classifieur `semantic_vad`. C'est la recommandation
OpenAI et ce que l'utilisateur a demandé explicitement. Le risque résiduel — un écho résiduel qui
couperait Adam — n'a **pas pu être mesuré micro réel dans cet environnement** (pas de clé, pas de
navigateur). D'où le repli `OPENAI_VOICE_INTERRUPT=client` : une variable, aucun redéploiement.
C'est le **seul point à re-vérifier lors d'un vrai appel**.

### 10.4 Métriques (déjà instrumentées, `turn-metrics.ts` + `call-provider.tsx`)

Toutes les mesures demandées existent et sont journalisées à la fermeture de session
(`voice_session_closed`) : `user_speech_ended → response_started → first_audio` (frise
horodatée), `barge_in_confirmed` (latence interruption→coupure), `false_barge_in_ignored` (faux
speech_started), `watchdog_recovered`/`turn_watchdog_recovered`/`delivery_failed` (réponses
perdues), `voice_reconnect` (reconnexions), `deliveriesReady`/`deliveriesDone` (SLO de
restitution). Aucune nouvelle métrique n'était nécessaire — l'observabilité §241 les couvre déjà.

### 10.5 Mesure AVANT/APRÈS (déterministe, sur le VRAI pipeline d'événements)

Live impossible ici ; la mesure honnête est le **banc déterministe** (`handleEvent`, horloges
simulées) — le même qui prouve cette couche depuis §232.

| Scénario | AVANT | APRÈS |
|---|---|---|
| Interruption réelle, transcription lente (aucun mot encore) | **jamais coupée** sur la durée (`bargeInDecision` → `wait` tant que le haut-parleur joue) | **coupée à 180 ms** (`response.cancel` + `clear` + `truncate`) — `voice-pipeline.test.ts` |
| Interruption avec mot (« Attends ») | coupe à l'arrivée du mot | coupe à l'arrivée du mot (inchangé, accélérateur) |
| Salve brève < 140 ms (clic/écho) | ignorée | ignorée (inchangé) |
| `interrupt_response` par défaut | `false` | `true` — `voice-tuning.test.ts` |
| `eagerness` par défaut | `auto` | `low` (hésitations FR) |
| Voix par défaut | `marin` (F) | `cedar` (M) |

### 10.6 Tests ajoutés / mis à jour

- **`voice-scenarios.test.ts` (NOUVEAU, 9 tests)** : la liste EXACTE demandée — phrase courte,
  phrase longue (intégrité), silence au milieu d'une phrase, interruption d'Adam (mots ET durée),
  faux bruit, interruption puis changement de sujet (zéro fuite de l'ancienne réponse), plusieurs
  interruptions successives (une par segment), jamais muet après un tour valide.
- **`voice-tuning.test.ts`** : golden barge-in réécrit pour la politique native (parole soutenue
  coupe même en plein son) ; `buildTurnDetection` : défauts natifs (`interrupt_response: true`,
  `eagerness: low`) + repli `OPENAI_VOICE_INTERRUPT=client`.
- **`voice-pipeline.test.ts`** : le golden « écho » est INVERSÉ (parole soutenue → coupe), + un
  test dédié du faux barge-in bref.

Suite voix : **53 + 9 = 62 tests verts**. Aucune régression sur la propriété de la réponse ni sur
l'hygiène des événements périmés (leurs golden §232/§233 passent inchangés).
