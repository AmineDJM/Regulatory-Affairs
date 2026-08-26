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
