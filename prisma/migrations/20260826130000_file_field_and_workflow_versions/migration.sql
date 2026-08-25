-- C3f — (1) champ personnalisé de type FICHIER (référence un document du Drive, sans copie) ;
--       (2) VERSIONS des circuits de validation : chaque enregistrement du builder prend un
--           instantané — l'historique se liste et se RESTAURE (rollback = rejouer un instantané
--           par le même chemin validé). Idempotent : rejouable sans effet sur une base à niveau.

ALTER TYPE "CustomFieldType" ADD VALUE IF NOT EXISTS 'FILE';

CREATE TABLE IF NOT EXISTS "WorkflowDefinitionVersion" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "savedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowDefinitionVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowDefinitionVersion_category_version_key" ON "WorkflowDefinitionVersion"("category", "version");
CREATE INDEX IF NOT EXISTS "WorkflowDefinitionVersion_category_idx" ON "WorkflowDefinitionVersion"("category");
