## 🗄️ Base de données & migrations

- **93 modèles**, **86 enums**, **69 migrations**.
- `prisma migrate deploy` s'exécute **au déploiement** (les migrations en attente s'appliquent toutes seules).
- En local, `prisma migrate dev` étant interactif, on génère le SQL ainsi :

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_ma_migration
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/<dossier>/migration.sql
npx prisma migrate deploy
```

**Chaîne (extrait récent)** : … → `doctor_segmentation` → `envelope_module` → `budget_total_access` →
`regulatory_dosage_unit` → `admin_requests_batch_g` → `envelope_multi_module` → `budget_category_module` →
`national_sales_role` → `event_request_workflow` → `budget_subcategories_user_access`.

> ⚠️ **PostgreSQL 16** : `ALTER TYPE … ADD VALUE` est transactionnel mais la nouvelle valeur d'enum **ne peut pas
> être utilisée dans la même migration**. Les migrations sont donc écrites **à la main** (SQL idempotent :
> `ADD COLUMN IF NOT EXISTS`, `ADD VALUE IF NOT EXISTS`, contraintes en bloc `DO $$ … EXCEPTION …`).

---

