## 🚀 Démarrage local

### Prérequis
- **Node.js ≥ 18** · une base **PostgreSQL** accessible

### Installation

```bash
# 1) Dépendances (le .npmrc force legacy-peer-deps : imapflow tire nodemailer 9)
npm install

# 2) Variables d'environnement
cp .env.example .env
#   → renseigner au minimum DATABASE_URL et AUTH_SECRET (openssl rand -base64 32)

# 3) Base : migrations + compte Super Admin initial (AUCUNE donnée de démo)
npm run db:deploy
ADMIN_EMAIL="vous@adventum.dz" ADMIN_PASSWORD="MotDePasse123!" npm run db:bootstrap

# 4) Lancement
npm run dev            # http://localhost:3000
```

### Premier compte

`db:bootstrap` crée **uniquement** votre Super Admin (idempotent). Connectez-vous, puis dans **Administration** :
créez les comptes de l'équipe, attribuez les accès (onglet × action × ligne), suivez connexions/sessions.

---

