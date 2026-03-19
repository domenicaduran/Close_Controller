-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."WorkflowType" AS ENUM ('MONTH_END', 'QUARTER_END', 'YEAR_END', 'AUDIT_PBC', 'TAX', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "public"."RecurrenceType" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "public"."DueDateRuleType" AS ENUM ('NONE', 'DAY_OF_MONTH', 'BUSINESS_DAY_OFFSET_FROM_PERIOD_END', 'FIXED_CALENDAR_DATE', 'OFFSET_FROM_PERIOD_START');

-- CreateEnum
CREATE TYPE "public"."CarryforwardBehavior" AS ENUM ('NONE', 'SURFACE_IF_INCOMPLETE', 'ALWAYS_CREATE', 'COPY_NOTES');

-- CreateEnum
CREATE TYPE "public"."PeriodStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'WAITING_ON_CLIENT', 'COMPLETE');

-- CreateEnum
CREATE TYPE "public"."TaskSourceType" AS ENUM ('TEMPLATE_GENERATED', 'IMPORTED', 'CARRYFORWARD', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."ImportType" AS ENUM ('TEMPLATE', 'TASK_BATCH', 'PBC_ITEMS');

-- CreateEnum
CREATE TYPE "public"."ImportStatus" AS ENUM ('PREVIEW', 'VALIDATED', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."PBCRequestStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'RECEIVED', 'UNDER_REVIEW', 'CLEARED');

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "industry" TEXT,
    "primaryContact" TEXT,
    "email" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workflowType" "public"."WorkflowType" NOT NULL,
    "description" TEXT,
    "recurrenceType" "public"."RecurrenceType" NOT NULL,
    "periodLabelFormat" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientTemplateAssignment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientTemplateAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TemplateTask" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "defaultOwner" TEXT,
    "recurrenceType" "public"."RecurrenceType" NOT NULL,
    "dueDateRuleType" "public"."DueDateRuleType" NOT NULL DEFAULT 'NONE',
    "dueDayOfMonth" INTEGER,
    "businessDayOffset" INTEGER,
    "fixedMonth" INTEGER,
    "fixedDay" INTEGER,
    "offsetFromPeriodStart" INTEGER,
    "dependencyTemplateTaskId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "carryforwardBehavior" "public"."CarryforwardBehavior" NOT NULL DEFAULT 'NONE',
    "copyNotesForward" BOOLEAN NOT NULL DEFAULT false,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "reviewerRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultPriority" "public"."Priority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PeriodInstance" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "workflowType" "public"."WorkflowType" NOT NULL,
    "status" "public"."PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "templateSnapshot" TEXT NOT NULL,
    "sourcePeriodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaskInstance" (
    "id" TEXT NOT NULL,
    "periodInstanceId" TEXT NOT NULL,
    "templateTaskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "assignee" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "reviewerSignoff" TEXT,
    "reviewerSignedOffAt" TIMESTAMP(3),
    "sourceType" "public"."TaskSourceType" NOT NULL DEFAULT 'TEMPLATE_GENERATED',
    "priority" "public"."Priority" NOT NULL DEFAULT 'MEDIUM',
    "blockedReason" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "carryforwardFromTaskId" TEXT,
    "dependencyTaskId" TEXT,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "reviewerRequired" BOOLEAN NOT NULL DEFAULT false,
    "templateTaskSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaskNote" (
    "id" TEXT NOT NULL,
    "taskInstanceId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "copiedForward" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EvidenceLink" (
    "id" TEXT NOT NULL,
    "taskInstanceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportBatch" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "templateId" TEXT,
    "fileName" TEXT NOT NULL,
    "importType" "public"."ImportType" NOT NULL,
    "headerSignature" TEXT,
    "status" "public"."ImportStatus" NOT NULL DEFAULT 'PREVIEW',
    "columnMappingJson" TEXT,
    "validationJson" TEXT,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportMappingPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "importType" "public"."ImportType" NOT NULL,
    "headerSignature" TEXT NOT NULL,
    "mappingJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ImportMappingPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportRow" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawJson" TEXT NOT NULL,
    "normalizedJson" TEXT,
    "validationJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PBCRequestItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "periodInstanceId" TEXT,
    "importBatchId" TEXT,
    "requestNumber" TEXT,
    "description" TEXT NOT NULL,
    "requestedFrom" TEXT,
    "dateRequested" TIMESTAMP(3),
    "dateReceived" TIMESTAMP(3),
    "status" "public"."PBCRequestStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "fileLink" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PBCRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "public"."Client"("code");

-- CreateIndex
CREATE INDEX "Client_isArchived_name_idx" ON "public"."Client"("isArchived", "name");

-- CreateIndex
CREATE INDEX "WorkflowTemplate_workflowType_isActive_idx" ON "public"."WorkflowTemplate"("workflowType", "isActive");

-- CreateIndex
CREATE INDEX "ClientTemplateAssignment_templateId_idx" ON "public"."ClientTemplateAssignment"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientTemplateAssignment_clientId_templateId_key" ON "public"."ClientTemplateAssignment"("clientId", "templateId");

-- CreateIndex
CREATE INDEX "TemplateTask_templateId_sortOrder_idx" ON "public"."TemplateTask"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "PeriodInstance_clientId_status_idx" ON "public"."PeriodInstance"("clientId", "status");

-- CreateIndex
CREATE INDEX "PeriodInstance_templateId_periodStart_idx" ON "public"."PeriodInstance"("templateId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodInstance_clientId_templateId_periodKey_key" ON "public"."PeriodInstance"("clientId", "templateId", "periodKey");

-- CreateIndex
CREATE INDEX "TaskInstance_periodInstanceId_status_idx" ON "public"."TaskInstance"("periodInstanceId", "status");

-- CreateIndex
CREATE INDEX "TaskInstance_dueDate_idx" ON "public"."TaskInstance"("dueDate");

-- CreateIndex
CREATE INDEX "TaskInstance_sourceType_idx" ON "public"."TaskInstance"("sourceType");

-- CreateIndex
CREATE INDEX "TaskNote_taskInstanceId_createdAt_idx" ON "public"."TaskNote"("taskInstanceId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceLink_taskInstanceId_idx" ON "public"."EvidenceLink"("taskInstanceId");

-- CreateIndex
CREATE INDEX "ImportBatch_status_importType_idx" ON "public"."ImportBatch"("status", "importType");

-- CreateIndex
CREATE INDEX "ImportMappingPreset_importType_headerSignature_idx" ON "public"."ImportMappingPreset"("importType", "headerSignature");

-- CreateIndex
CREATE UNIQUE INDEX "ImportMappingPreset_importType_name_key" ON "public"."ImportMappingPreset"("importType", "name");

-- CreateIndex
CREATE INDEX "ImportRow_importBatchId_rowNumber_idx" ON "public"."ImportRow"("importBatchId", "rowNumber");

-- CreateIndex
CREATE INDEX "PBCRequestItem_clientId_status_idx" ON "public"."PBCRequestItem"("clientId", "status");

-- CreateIndex
CREATE INDEX "PBCRequestItem_periodInstanceId_idx" ON "public"."PBCRequestItem"("periodInstanceId");

-- AddForeignKey
ALTER TABLE "public"."ClientTemplateAssignment" ADD CONSTRAINT "ClientTemplateAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientTemplateAssignment" ADD CONSTRAINT "ClientTemplateAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TemplateTask" ADD CONSTRAINT "TemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TemplateTask" ADD CONSTRAINT "TemplateTask_dependencyTemplateTaskId_fkey" FOREIGN KEY ("dependencyTemplateTaskId") REFERENCES "public"."TemplateTask"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."PeriodInstance" ADD CONSTRAINT "PeriodInstance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PeriodInstance" ADD CONSTRAINT "PeriodInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PeriodInstance" ADD CONSTRAINT "PeriodInstance_sourcePeriodId_fkey" FOREIGN KEY ("sourcePeriodId") REFERENCES "public"."PeriodInstance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."TaskInstance" ADD CONSTRAINT "TaskInstance_periodInstanceId_fkey" FOREIGN KEY ("periodInstanceId") REFERENCES "public"."PeriodInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskInstance" ADD CONSTRAINT "TaskInstance_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "public"."TemplateTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskInstance" ADD CONSTRAINT "TaskInstance_carryforwardFromTaskId_fkey" FOREIGN KEY ("carryforwardFromTaskId") REFERENCES "public"."TaskInstance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."TaskInstance" ADD CONSTRAINT "TaskInstance_dependencyTaskId_fkey" FOREIGN KEY ("dependencyTaskId") REFERENCES "public"."TaskInstance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."TaskNote" ADD CONSTRAINT "TaskNote_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES "public"."TaskInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EvidenceLink" ADD CONSTRAINT "EvidenceLink_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES "public"."TaskInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportBatch" ADD CONSTRAINT "ImportBatch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportBatch" ADD CONSTRAINT "ImportBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."WorkflowTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportRow" ADD CONSTRAINT "ImportRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "public"."ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PBCRequestItem" ADD CONSTRAINT "PBCRequestItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PBCRequestItem" ADD CONSTRAINT "PBCRequestItem_periodInstanceId_fkey" FOREIGN KEY ("periodInstanceId") REFERENCES "public"."PeriodInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

