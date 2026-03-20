-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClientUserAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientUserAccess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientUserAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TaskInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodInstanceId" TEXT NOT NULL,
    "templateTaskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "assignee" TEXT,
    "assigneeUserId" TEXT,
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
    CONSTRAINT "TaskInstance_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskInstance_carryforwardFromTaskId_fkey" FOREIGN KEY ("carryforwardFromTaskId") REFERENCES "TaskInstance" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "TaskInstance_dependencyTaskId_fkey" FOREIGN KEY ("dependencyTaskId") REFERENCES "TaskInstance" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_TaskInstance" ("assignee", "blockedReason", "carryforwardFromTaskId", "category", "completedAt", "createdAt", "dependencyTaskId", "description", "dueDate", "evidenceRequired", "id", "notes", "periodInstanceId", "priority", "reviewerRequired", "reviewerSignedOffAt", "reviewerSignoff", "sortOrder", "sourceType", "status", "templateTaskId", "templateTaskSnapshot", "title", "updatedAt") SELECT "assignee", "blockedReason", "carryforwardFromTaskId", "category", "completedAt", "createdAt", "dependencyTaskId", "description", "dueDate", "evidenceRequired", "id", "notes", "periodInstanceId", "priority", "reviewerRequired", "reviewerSignedOffAt", "reviewerSignoff", "sortOrder", "sourceType", "status", "templateTaskId", "templateTaskSnapshot", "title", "updatedAt" FROM "TaskInstance";
DROP TABLE "TaskInstance";
ALTER TABLE "new_TaskInstance" RENAME TO "TaskInstance";
CREATE INDEX "TaskInstance_periodInstanceId_status_idx" ON "TaskInstance"("periodInstanceId", "status");
CREATE INDEX "TaskInstance_dueDate_idx" ON "TaskInstance"("dueDate");
CREATE INDEX "TaskInstance_sourceType_idx" ON "TaskInstance"("sourceType");
CREATE INDEX "TaskInstance_assigneeUserId_idx" ON "TaskInstance"("assigneeUserId");
CREATE TABLE "new_TaskNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskInstanceId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "copiedForward" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskNote_taskInstanceId_fkey" FOREIGN KEY ("taskInstanceId") REFERENCES "TaskInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TaskNote" ("body", "copiedForward", "createdAt", "id", "taskInstanceId") SELECT "body", "copiedForward", "createdAt", "id", "taskInstanceId" FROM "TaskNote";
DROP TABLE "TaskNote";
ALTER TABLE "new_TaskNote" RENAME TO "TaskNote";
CREATE INDEX "TaskNote_taskInstanceId_createdAt_idx" ON "TaskNote"("taskInstanceId", "createdAt");
CREATE INDEX "TaskNote_authorUserId_idx" ON "TaskNote"("authorUserId");
CREATE TABLE "new_TemplateTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "defaultOwner" TEXT,
    "defaultOwnerUserId" TEXT,
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
    CONSTRAINT "TemplateTask_defaultOwnerUserId_fkey" FOREIGN KEY ("defaultOwnerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TemplateTask_dependencyTemplateTaskId_fkey" FOREIGN KEY ("dependencyTemplateTaskId") REFERENCES "TemplateTask" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_TemplateTask" ("businessDayOffset", "carryforwardBehavior", "category", "copyNotesForward", "createdAt", "defaultOwner", "defaultPriority", "dependencyTemplateTaskId", "description", "dueDateRuleType", "dueDayOfMonth", "evidenceRequired", "fixedDay", "fixedMonth", "id", "isActive", "offsetFromPeriodStart", "recurrenceType", "reviewerRequired", "sortOrder", "templateId", "title", "updatedAt") SELECT "businessDayOffset", "carryforwardBehavior", "category", "copyNotesForward", "createdAt", "defaultOwner", "defaultPriority", "dependencyTemplateTaskId", "description", "dueDateRuleType", "dueDayOfMonth", "evidenceRequired", "fixedDay", "fixedMonth", "id", "isActive", "offsetFromPeriodStart", "recurrenceType", "reviewerRequired", "sortOrder", "templateId", "title", "updatedAt" FROM "TemplateTask";
DROP TABLE "TemplateTask";
ALTER TABLE "new_TemplateTask" RENAME TO "TemplateTask";
CREATE INDEX "TemplateTask_templateId_sortOrder_idx" ON "TemplateTask"("templateId", "sortOrder");
CREATE INDEX "TemplateTask_defaultOwnerUserId_idx" ON "TemplateTask"("defaultOwnerUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isActive_name_idx" ON "User"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "ClientUserAccess_userId_idx" ON "ClientUserAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientUserAccess_clientId_userId_key" ON "ClientUserAccess"("clientId", "userId");
