ALTER TABLE "ImportBatch" ADD COLUMN "headerSignature" TEXT;

CREATE TABLE "ImportMappingPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "headerSignature" TEXT NOT NULL,
    "mappingJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME
);

CREATE INDEX "ImportMappingPreset_importType_headerSignature_idx" ON "ImportMappingPreset"("importType", "headerSignature");
CREATE UNIQUE INDEX "ImportMappingPreset_importType_name_key" ON "ImportMappingPreset"("importType", "name");
