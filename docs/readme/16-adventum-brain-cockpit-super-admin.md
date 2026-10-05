## 🧠 Adventum Brain (cockpit Super Admin)

**Une seule couche premium, visible du Super Admin uniquement** (`/adventum-brain`) — un **cockpit unique**
intégrant : **War Room** (KPIs + « ce qui mérite votre attention »), **Risk Radar** (détecteurs sur données
réelles → Risk Cards), **Root Cause** (drawer contextuel), **Knowledge Graph** (fiche 360 relationnelle, bascule
liste / graphe radial), **Autopilot Actions** (mini-confirmation, ne crée que Tâche/Notification), **Intelligence
Feed** (fil filtré par importance), **Process Intelligence** (lenteurs & blocages, charge par personne).

**Détecteurs Risk Radar (calculés à la volée — aucune table de risque)** : caution PCH proche d'expiration ·
congrès/sponsoring bloqués · médecin **KOL** non visité · ordre de dépense non réglé · **budget/enveloppe dépassé**
· information médicale en attente · directive échue · fournisseur silencieux · signal qualité/PV terrain ·
**rupture / stock bas PCH** · **retard de livraison** · **événement à faible présence** · **demande du secrétariat
en retard**.

> **Analyse EN CONTINU — Adventum Pulse** (`src/lib/adventum/pulse.ts`, table `IntelligenceSnapshot`) : un
> **instantané horaire** (au plus 1×/h, verrou de bucket) des agrégats Risk Radar + Process Intelligence est
> persisté par le **tick planifié** (`runScheduledJobs`) tant qu'un utilisateur est actif — et garanti frais à
> l'ouverture des cockpits. Deux effets : (1) **tendances** (deltas + mini-courbe) affichées via le bandeau
> `PulseStrip` en tête de Brain **et** de Process Intelligence ; (2) **alerte proactive** — dès qu'un **nouveau
> risque critique** apparaît vs l'instantané précédent, le Super Admin est notifié (cloche + push) même si
> personne n'a ouvert le module. Pur calcul déterministe, sans IA ni donnée simulée.

> **Réglage des seuils** (Super Admin), bornés et persistés (`RiskSetting`), lus à chaud. **Règle anti-bureaucratie** :
> Brain **lit, relie, résume, explique et propose** — il ne duplique aucun workflow et ne crée qu'après confirmation.

---

