# AMD Internal OS — Édition Streamlit (Adventum Pharma)

Version **Python / Streamlit** du logiciel interne d'Adventum, avec base de données
**SQLite autonome** (aucun serveur de base à installer). Couvre les 8 pôles métiers
avec contrôle d'accès **RBAC + row-level** appliqué côté serveur, dashboards, tables
avancées, import/export, upload de documents et journal d'audit.

> 🔗 Une version **Next.js/TypeScript + PostgreSQL** du même produit existe à la racine
> du dépôt. Cette édition Streamlit est **indépendante** et plus rapide à lancer.

---

## 🚀 Démarrage (2 minutes)

```bash
cd streamlit_app

# 1. Environnement virtuel + dépendances
python -m venv .venv
source .venv/bin/activate        # Windows : .venv\Scripts\activate
pip install -r requirements.txt

# 2. Lancer (la base SQLite est créée et peuplée automatiquement au 1er démarrage)
streamlit run app.py
```

L'application s'ouvre sur http://localhost:8501.

### Comptes de démonstration

Mot de passe pour **tous** les comptes : **`password123`**

| Email | Rôle | Accès |
|-------|------|-------|
| `direction@adventum.dz` | Direction | Tous les pôles |
| `regulatory@adventum.dz` | Resp. Regulatory | Toutes les molécules |
| `assistante1@adventum.dz` | Assistante | **Uniquement ses DCI assignées** |
| `logistique@adventum.dz` | Resp. Logistique | Logistique PCH |
| `commercial1@adventum.dz` | Commercial | Ses ventes uniquement |
| `delegue1@adventum.dz` | Délégué médical | Ses médecins / visites |
| `bd@adventum.dz` | Manager BD | Business Development |
| `finance@adventum.dz` | Resp. Budget | Budgets |
| `superadmin@adventum.dz` | Super Admin | Tout + administration |

> Connectez-vous avec `assistante1` puis `regulatory` pour voir le **masquage des lignes** Regulatory.

Recréer les données de démo à tout moment : `python -m amd.seed`

---

## ✨ Modules

Dashboard · Regulatory (workflow 17 étapes éditable, documents, commentaires) ·
Sponsoring (validation) · Budgets · Congrès internationaux & nationaux ·
Ventes (import CSV/Excel + export) · Logistique PCH (timeline) ·
Promotion médicale (médecins & visites scopés) · Business Development (pipeline) ·
Documents (bibliothèque scopée) · Notifications · Administration (utilisateurs, audit).

Transverses : recherche, tri, export CSV/Excel, badges de statut colorés, upload
drag & drop, audit log (qui / quoi / ancienne → nouvelle valeur / date).

---

## 🔐 Sécurité & RBAC

- **Permissions module/action** : `can(role, module, action)` (matrice `amd/rbac.py`).
- **Row-level scoping** : les `scope_*` renvoient des conditions SQLAlchemy ; les lignes
  non autorisées **ne sont jamais chargées** (filtrées en base). Une assistante ne voit
  que ses DCI, un délégué que ses médecins, un commercial que ses ventes.
- Mots de passe **bcrypt**, navigation filtrée par rôle, upload contrôlé (extension/taille),
  journal d'audit complet.

---

## 🧱 Architecture

```
streamlit_app/
├── app.py                 # auth + navigation RBAC (st.navigation)
├── amd/
│   ├── models.py          # 18 modèles SQLAlchemy (SQLite)
│   ├── db.py              # engine + session_scope
│   ├── rbac.py            # matrice de permissions + scoping
│   ├── auth.py            # bcrypt + session Streamlit
│   ├── labels.py          # libellés FR + couleurs de statut
│   ├── audit.py / notify  # journal d'audit + notifications
│   ├── ui.py              # KPI, pills, tables stylées, export
│   ├── storage.py         # stockage fichiers (local)
│   └── seed.py            # données de démonstration
├── views/                 # une vue par module (render())
└── tests/                 # tests RBAC + rendu des vues (pytest + AppTest)
```

---

## 🧪 Tests

```bash
pytest -q
```

23 tests : matrice de permissions, scoping row-level, rendu sans erreur de toutes les
vues, écran de connexion, et vérification que l'assistante voit moins de lignes que le
responsable.

---

## ☁️ Déploiement — Render (recommandé)

Un **Blueprint** [`render.yaml`](../render.yaml) est fourni à la racine du dépôt.

1. Pousser le dépôt sur GitHub (déjà fait).
2. Sur [dashboard.render.com](https://dashboard.render.com) : **New +  →  Blueprint**.
3. Connecter ce dépôt et **sélectionner la branche `claude/hopeful-goodall-phd0nb`**.
4. **Apply** — Render lit `render.yaml`, installe les dépendances et démarre l'app.

Réglages appliqués automatiquement par le blueprint :

| Paramètre | Valeur |
|-----------|--------|
| Root Directory | `streamlit_app` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `streamlit run app.py --server.port $PORT --server.address 0.0.0.0 --server.headless true` |
| Health check | `/_stcore/health` |
| Python | 3.12.7 |
| Plan | Free |

> **Création manuelle (si tu n'utilises pas le Blueprint)** : New + → **Web Service** →
> connecter le repo → Root Directory `streamlit_app`, Build `pip install -r requirements.txt`,
> Start `streamlit run app.py --server.port $PORT --server.address 0.0.0.0 --server.headless true`.

> ⚠️ Plan gratuit : disque **éphémère** (la base SQLite est re-créée + peuplée à chaque cold start)
> et mise en veille après ~15 min d'inactivité (1er accès ensuite ~50 s). Pour des données
> **persistantes**, ajoute un *Render Disk* et `AMD_DB_PATH` (bloc commenté dans `render.yaml`),
> ou branche un Postgres externe.

---

## ☁️ Déploiement — Streamlit Community Cloud (gratuit)

1. Poussez le dépôt sur GitHub.
2. Sur [share.streamlit.io](https://share.streamlit.io) : **New app** → sélectionnez le repo,
   branche, et **Main file path** = `streamlit_app/app.py`.
3. Déployez. La base SQLite est créée et peuplée au premier démarrage.

> ⚠️ Le stockage de Streamlit Cloud est éphémère : la base SQLite et les fichiers
> uploadés sont réinitialisés à chaque redéploiement. Pour une persistance durable en
> production, branchez une base externe (Postgres/Supabase) via SQLAlchemy ou utilisez
> l'édition Next.js du dépôt.

### Docker (alternative)

```bash
pip install -r requirements.txt
streamlit run app.py --server.port 8501 --server.address 0.0.0.0
```

---

© 2026 Adventum Pharma — AMD Internal OS (édition Streamlit)
