-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "industry" TEXT,
    "primaryContact" TEXT,
    "email" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL,
    "description" TEXT,
    "recurrenceType" TEXT NOT NULL,
    "periodLabelFormat" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClientTemplateAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientTemplateAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientTemplateAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemplateTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "defaultOwner" TEXT,
    "recurrenceType" TEXT NOT NULL,
    "dueDateRuleType" TEXT NOT NULL DEFAULT 'NONE',
    "dueDayOfMonth" INTEGER,
    "businessDayOffset" INTEGER,
    "fixedMonth" INTEGER,
    "fixedDay" INTEGER,
    "offsetFromPeriodStart" INTEGER,
    "dependencyTemplateTaskId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "carryforwardBehavior" TEXT NOT NULL DEFAULT 'NONE',
    "copyNotesForward" BOOLEAN NOT NULL DEFAULT false,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "reviewerRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultPriority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TemplateTask_dependencyTemplateTaskId_fkey" FOREIGN KEY ("dependencyTemplateTaskId") REFERENCES "TemplateTask" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "PeriodInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "templateSnapshot" TEXT NOT NULL,
    "sourcePeriodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PeriodInstance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PeriodInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PeriodInstance_sourcePeriodId_fkey" FOREIGN KEY ("sourcePeriodId") REFERENCES "PeriodInstance" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "TaskInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodInstanceId" TEXT NOT NULL,
    "templateTaskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "assignee" TEXT,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "completedAt" DATETIME,
    "notes" TEXT,
    "reviewerSignoff" TEXT,
    "reviewerSignedOffAt" DATETIME,
    "sourceType" TEXT NOT NULL DEFAULT 'TEMPLATE_GENERATED',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "blockedReason" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "carryforwardFromTaskId" TEXT,
    "dependencyTaskId" TEXT,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "reviewerRequired" BOOLEAN NOT NULL DEFAULT false,
    "templateTaskSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaskInstance_periodInstanceId_fkey" FOREIGN KEY ("periodInstanceId") REFERENCES "PeriodInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskInstance_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "TemplateTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskInstance_carryforwardFromTaskId_fkey" FOREIGN KEY ("carryforwardFromTaskId") REFERENCES "TaskInstance" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "TaskInstance_dependencyTaskId_fkey" FOREIGN KEY ("dependencyTaskId") REFERENCES "TaskInstance" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "TaskNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskInstanceId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "copiedForward" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskNote_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES "TaskInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskInstanceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceLink_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES "TaskInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT,
    "templateId" TEXT,
    "fileName" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "columnMappingJson" TEXT,
    "validationJson" TEXT,
    "committedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportBatch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImportBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importBatchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawJson" TEXT NOT NULL,
    "normalizedJson" TEXT,
    "validationJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PBCRequestItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "periodInstanceId" TEXT,
    "importBatchId" TEXT,
    "requestNumber" TEXT,
    "description" TEXT NOT NULL,
    "requestedFrom" TEXT,
    "dateRequested" DATETIME,
    "dateReceived" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
    "fileLink" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PBCRequestItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PBCRequestItem_periodInstanceId_fkey" FOREIGN KEY ("periodInstanceId") REFERENCES "PeriodInstance" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

-- CreateIndex
CREATE INDEX "Client_isArchived_name_idx" ON "Client"("isArchived", "name");

-- CreateIndex
CREATE INDEX "WorkflowTemplate_workflowType_isActive_idx" ON "WorkflowTemplate"("workflowType", "isActive");

-- CreateIndex
CREATE INDEX "ClientTemplateAssignment_templateId_idx" ON "ClientTemplateAssignment"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientTemplateAssignment_clientId_templateId_key" ON "ClientTemplateAssignment"("clientId", "templateId");

-- CreateIndex
CREATE INDEX "TemplateTask_templateId_sortOrder_idx" ON "TemplateTask"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "PeriodInstance_clientId_status_idx" ON "PeriodInstance"("clientId", "status");

-- CreateIndex
CREATE INDEX "PeriodInstance_templateId_periodStart_idx" ON "PeriodInstance"("templateId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodInstance_clientId_templateId_periodKey_key" ON "PeriodInstance"("clientId", "templateId", "periodKey");

-- CreateIndex
CREATE INDEX "TaskInstance_periodInstanceId_status_idx" ON "TaskInstance"("periodInstanceId", "status");

-- CreateIndex
CREATE INDEX "TaskInstance_dueDate_idx" ON "TaskInstance"("dueDate");

-- CreateIndex
CREATE INDEX "TaskInstance_sourceType_idx" ON "TaskInstance"("sourceType");

-- CreateIndex
CREATE INDEX "TaskNote_taskInstanceId_createdAt_idx" ON "TaskNote"("taskInstanceId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceLink_taskInstanceId_idx" ON "EvidenceLink"("taskInstanceId");

-- CreateIndex
CREATE INDEX "ImportBatch_status_importType_idx" ON "ImportBatch"("status", "importType");

-- CreateIndex
CREATE INDEX "ImportRow_importBatchId_rowNumber_idx" ON "ImportRow"("importBatchId", "rowNumber");

-- CreateIndex
CREATE INDEX "PBCRequestItem_clientId_status_idx" ON "PBCRequestItem"("clientId", "status");

-- CreateIndex
CREATE INDEX "PBCRequestItem_periodInstanceId_idx" ON "PBCRequestItem"("periodInstanceId");

