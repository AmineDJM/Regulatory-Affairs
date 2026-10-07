## 🧠 Adventum Brain (cockpit Super Admin)

**Une seule couche premium, visible du Super Admin uniquement** (`/adventum-brain`). **Refonte du 07/10 (maquette
validée)** : l'ancien cockpit à panneaux (War Room, Knowledge Graph/Relations, Intelligence Feed, bandeau
`PulseStrip`) est retiré au profit de **quatre vues** qui LISENT ce que la passe horaire et le briefing ont gardé —
aucun calcul au rendu (`lib/adventum/brain-read.ts`) :

- **Ce matin** — le **briefing du jour** (écrit à **7 h, heure d'Alger**, par le planificateur après la passe
  horaire — `runBrainBriefingIfDue`, `lib/brain-briefing.ts` ; « Régénérer » le réécrit à la demande,
  `regenererBriefing`). Il part des risques **ouverts** de `BrainRisk`, les confie à Luna (sortie JSON stricte, délai
  borné) et retombe sur un **briefing de règles** si le modèle est absent, lent ou hors forme (`lib/adventum/briefing.ts`,
  pur). **Chaque phrase porte ses sources** = des clés de risque, rendues en puces cliquables ; une clé inventée est
  écartée à la lecture. Gardé un par jour (`BrainBriefing`). Sous le briefing : ce qui attend une décision.
- **Risques** — des risques **qui ont une vie** (`BrainRisk`, clé stable détecteur + objet ; `lib/adventum/lifecycle.ts`,
  règles pures `lifecycle-rules.ts`) : **NOUVEAU → PRIS EN CHARGE → RÉSOLU**, ou **IGNORÉ jusqu'au…** (`agirSurRisque`).
  Un risque que le détecteur ne voit plus est **résolu automatiquement** ; un ignoré échu et toujours vu redevient
  nouveau ; un résolu qui réapparaît redevient nouveau — tout de suite s'il avait été résolu automatiquement, après
  **24 h de grâce** s'il a été marqué résolu par une personne. Résolus des 14 derniers jours affichés.
- **Demander** — une question libre (`askBrain`), réponse ancrée et **sourcée** (puces module/document), les actions
  proposées passant par la confirmation canonique ; les questions sont gardées (`BrainQuestion`).
- **Historique** — les briefings des jours précédents.

**Détecteurs** (données réelles, aucune donnée simulée — `lib/adventum/risks.ts` + `risks-plus.ts` ajoutés le 07/10) :
caution PCH proche d'expiration · congrès/sponsoring bloqués · médecin **KOL** non visité · ordre de dépense non
réglé · **budget/enveloppe dépassé** · information médicale en attente · directive échue · fournisseur silencieux ·
signal qualité/PV terrain · **rupture / stock bas PCH** · **retard de livraison** · **événement à faible présence** ·
**demande du secrétariat en retard** ; et depuis le 07/10 : **stock face aux AO attribués** (reste à livrer) ·
**recrutement validé non diffusé** · **couverture terrain H·A·B sous le seuil** (après mi-cycle) · **Ad & Pro sur des
médecins C/D** au-delà d'un maximum · **BC non signé** · **plan de tournée non validé** à l'approche de sa période ·
**coût IA qui dérape** · **dossier bloqué à une étape** au-delà de son délai cible (Process Intelligence).

> **Seuils** (Super Admin, `RiskSetting`, migration `20270115180000_brain_process` — défauts : recrutement non diffusé
> 3 j, couverture min. 50 %, Ad & Pro C/D max. 25 %, BC non signé 5 j, plan de tournée 3 j avant, dérive IA 50 %,
> étape bloquée 14 j) ; part pure dans `lib/adventum/risk-thresholds.ts` (formulaire client sans base).

> **Analyse EN CONTINU — Adventum Pulse** (`src/lib/adventum/pulse.ts`, table `IntelligenceSnapshot`) : la passe
> **horaire** (`runScheduledJobs`, au plus 1×/h, verrou de bucket) calcule les risques, les **réconcilie** dans
> `BrainRisk` et persiste l'instantané des agrégats ; **alerte proactive** au Super Admin (cloche + push) dès qu'un
> **nouveau risque critique** apparaît. Pur calcul déterministe.

> **Règle anti-bureaucratie** : Brain **lit, relie, résume, explique et propose** — il ne duplique aucun workflow et
> ne crée qu'après confirmation.

### Process Intelligence (`/process-intelligence`, Super Admin — `requireModule("PROCESS_INTELLIGENCE")`)

Refonte du 07/10 : le temps **réellement** passé à chaque étape, lu dans le **journal** des circuits et non plus
« l'âge depuis la dernière modification » (un commentaire ne remet plus le compteur à zéro) — `lib/process/mining.ts`
(pur, testé) : chaque événement qui fait avancer (accord, refus, renvoi, clôture) ferme un segment attribué à son
étape ; un renvoi ouvre « Correction (demandeur) ». Sources (`lib/queries/process-intelligence.ts`) : Ad & Pro
(`WorkflowStepEvent`), validations (`ValidationStep`), demandes de paiement, demandes d'achat, recrutement
(`RecruitmentApproval`), et à défaut les changements de statut de l'`AuditLog`. **Trois vues** (`?vue=`) : **Circuits**
(temps par étape, en cours bloqués), **Personnes**, **Plateforme** (adoption par module) ; période 30 j / 90 j / 12 mois
(`?p=`). **« Régler »** pose le **délai cible d'une étape** (`ProcessStepSla`, `process-intelligence-actions.ts`,
journalisé ; vide = retour à la limite par défaut de 14 j) — au-delà, le dossier compte parmi les bloqués et Brain le
signale. L'ancienne synthèse IA (`/api/process-intelligence/synthesis`) est retirée.

---

