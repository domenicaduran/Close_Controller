import {
  AuditActionType,
  AuditEntityType,
  CarryforwardBehavior,
  PBCRequestStatus,
  Priority,
  RecurrenceType,
  TaskSourceType,
  TaskStatus,
  UserRole,
  WorkflowType,
} from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { endOfMonth, startOfMonth } from "date-fns";

import { prisma } from "../lib/prisma";
import { buildPeriodKey, buildPeriodLabel, generatePeriodInstance } from "../lib/workflow";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

async function main() {
  await prisma.userSession.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.clientUserAccess.deleteMany();
  await prisma.evidenceLink.deleteMany();
  await prisma.taskNote.deleteMany();
  await prisma.taskInstance.deleteMany();
  await prisma.pBCRequestItem.deleteMany();
  await prisma.periodInstance.deleteMany();
  await prisma.importRow.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.templateTask.deleteMany();
  await prisma.clientTemplateAssignment.deleteMany();
  await prisma.workflowTemplate.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  const [domenica, alex, jordan] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Domenica Duran",
        email: "dedhern@gmail.com",
        title: "Controller",
        role: UserRole.ADMIN,
        passwordHash: hashPassword("CloseController1"),
      },
    }),
    prisma.user.create({
      data: {
        name: "Alex Rivera",
        email: "alex@closecontroller.local",
        title: "Accounting Manager",
        role: UserRole.MANAGER,
        passwordHash: hashPassword("CloseController1"),
      },
    }),
    prisma.user.create({
      data: {
        name: "Jordan Lee",
        email: "jordan@closecontroller.local",
        title: "Senior Accountant",
        role: UserRole.STAFF,
        passwordHash: hashPassword("CloseController1"),
      },
    }),
  ]);

  const [northwind, summit] = await Promise.all([
    prisma.client.create({
      data: {
        name: "Northwind Holdings",
        code: "NWH",
        industry: "Manufacturing",
        primaryContact: "Taylor Chen",
        email: "taylor@northwind.example",
      },
    }),
    prisma.client.create({
      data: {
        name: "Summit Health Group",
        code: "SHG",
        industry: "Healthcare",
        primaryContact: "Alex Rivera",
        email: "alex@summit.example",
      },
    }),
  ]);

  const monthEndTemplate = await prisma.workflowTemplate.create({
    data: {
      name: "Standard Month-End Close",
      workflowType: WorkflowType.MONTH_END,
      recurrenceType: RecurrenceType.MONTHLY,
      description: "Core monthly close checklist with reconciliations, review, and reporting.",
      tasks: {
        create: [
          {
            title: "Close subledgers",
            category: "Pre-close",
            defaultOwner: "Domenica",
            defaultOwnerUserId: domenica.id,
            recurrenceType: RecurrenceType.MONTHLY,
            dueDateRuleType: "OFFSET_FROM_PERIOD_START",
            offsetFromPeriodStart: 1,
            sortOrder: 10,
            carryforwardBehavior: CarryforwardBehavior.SURFACE_IF_INCOMPLETE,
            defaultPriority: Priority.HIGH,
          },
          {
            title: "Reconcile bank accounts",
            category: "Cash",
            defaultOwner: "Domenica",
            defaultOwnerUserId: domenica.id,
            recurrenceType: RecurrenceType.MONTHLY,
            dueDateRuleType: "DAY_OF_MONTH",
            dueDayOfMonth: 5,
            sortOrder: 20,
            carryforwardBehavior: CarryforwardBehavior.COPY_NOTES,
            evidenceRequired: true,
            defaultPriority: Priority.CRITICAL,
          },
          {
            title: "Prepare close package",
            category: "Reporting",
            defaultOwner: "Reviewer",
            defaultOwnerUserId: alex.id,
            recurrenceType: RecurrenceType.MONTHLY,
            dueDateRuleType: "BUSINESS_DAY_OFFSET_FROM_PERIOD_END",
            businessDayOffset: 3,
            sortOrder: 30,
            carryforwardBehavior: CarryforwardBehavior.SURFACE_IF_INCOMPLETE,
            reviewerRequired: true,
            defaultPriority: Priority.HIGH,
          },
        ],
      },
    },
    include: { tasks: true },
  });

  const quarterEndTemplate = await prisma.workflowTemplate.create({
    data: {
      name: "Quarter-End Close",
      workflowType: WorkflowType.QUARTER_END,
      recurrenceType: RecurrenceType.QUARTERLY,
      description: "Quarter close with flux analysis and disclosure review.",
      tasks: {
        create: [
          {
            title: "Prepare quarterly flux analysis",
            category: "Reporting",
            defaultOwner: "Domenica",
            defaultOwnerUserId: domenica.id,
            recurrenceType: RecurrenceType.QUARTERLY,
            dueDateRuleType: "BUSINESS_DAY_OFFSET_FROM_PERIOD_END",
            businessDayOffset: 5,
            sortOrder: 10,
            carryforwardBehavior: CarryforwardBehavior.SURFACE_IF_INCOMPLETE,
            defaultPriority: Priority.HIGH,
          },
          {
            title: "Review disclosure support",
            category: "Review",
            defaultOwner: "Reviewer",
            defaultOwnerUserId: alex.id,
            recurrenceType: RecurrenceType.QUARTERLY,
            dueDateRuleType: "BUSINESS_DAY_OFFSET_FROM_PERIOD_END",
            businessDayOffset: 7,
            sortOrder: 20,
            carryforwardBehavior: CarryforwardBehavior.COPY_NOTES,
            reviewerRequired: true,
            defaultPriority: Priority.CRITICAL,
          },
        ],
      },
    },
  });

  const auditTemplate = await prisma.workflowTemplate.create({
    data: {
      name: "Audit PBC Template",
      workflowType: WorkflowType.AUDIT_PBC,
      recurrenceType: RecurrenceType.YEARLY,
      description: "Baseline audit support request structure.",
      tasks: {
        create: [
          {
            title: "Refresh PBC tracker",
            category: "Audit",
            defaultOwner: "Domenica",
            defaultOwnerUserId: domenica.id,
            recurrenceType: RecurrenceType.YEARLY,
            dueDateRuleType: "OFFSET_FROM_PERIOD_START",
            offsetFromPeriodStart: 2,
            sortOrder: 10,
            carryforwardBehavior: CarryforwardBehavior.SURFACE_IF_INCOMPLETE,
            defaultPriority: Priority.HIGH,
          },
        ],
      },
    },
  });

  await prisma.clientTemplateAssignment.createMany({
    data: [
      { clientId: northwind.id, templateId: monthEndTemplate.id },
      { clientId: northwind.id, templateId: quarterEndTemplate.id },
      { clientId: northwind.id, templateId: auditTemplate.id },
      { clientId: summit.id, templateId: monthEndTemplate.id },
    ],
  });

  await prisma.clientUserAccess.createMany({
    data: [
      { clientId: northwind.id, userId: domenica.id, roleLabel: "Lead controller" },
      { clientId: northwind.id, userId: alex.id, roleLabel: "Reviewer" },
      { clientId: summit.id, userId: domenica.id, roleLabel: "Controller" },
      { clientId: summit.id, userId: jordan.id, roleLabel: "Preparer" },
    ],
  });

  const marchStart = startOfMonth(new Date("2026-03-01"));
  const marchEnd = endOfMonth(marchStart);

  const marchPeriod = await generatePeriodInstance({
    clientId: northwind.id,
    templateId: monthEndTemplate.id,
    label: buildPeriodLabel(monthEndTemplate, marchStart),
    periodKey: buildPeriodKey(monthEndTemplate.recurrenceType, marchStart),
    periodStart: marchStart,
    periodEnd: marchEnd,
  });

  const generatedTasks = await prisma.taskInstance.findMany({
    where: { periodInstanceId: marchPeriod.id },
    orderBy: { sortOrder: "asc" },
  });

  if (generatedTasks[0]) {
    await prisma.taskInstance.update({
      where: { id: generatedTasks[0].id },
      data: {
        status: TaskStatus.COMPLETE,
        completedAt: new Date("2026-04-01T09:00:00Z"),
        notes: "Subledgers closed and tie-out completed.",
        assigneeUserId: domenica.id,
      },
    });
  }

  if (generatedTasks[1]) {
    await prisma.taskInstance.update({
      where: { id: generatedTasks[1].id },
      data: {
        status: TaskStatus.BLOCKED,
        blockedReason: "Waiting on final bank statement download.",
        notes: "Treasury portal access expired during close week.",
        assigneeUserId: domenica.id,
      },
    });

    await prisma.taskNote.create({
      data: {
        taskInstanceId: generatedTasks[1].id,
        authorUserId: alex.id,
        body: "Need April 2 follow-up with treasury support for the March statement.",
      },
    });

    await prisma.evidenceLink.create({
      data: {
        taskInstanceId: generatedTasks[1].id,
        label: "Bank portal folder",
        url: "https://example.com/bank-portal",
      },
    });
  }

  await prisma.pBCRequestItem.createMany({
    data: [
      {
        clientId: northwind.id,
        periodInstanceId: marchPeriod.id,
        requestNumber: "PBC-01",
        description: "March bank reconciliations",
        requestedFrom: "Taylor Chen",
        dateRequested: new Date("2026-03-28"),
        status: PBCRequestStatus.REQUESTED,
        notes: "Expected with close package.",
      },
      {
        clientId: northwind.id,
        periodInstanceId: marchPeriod.id,
        requestNumber: "PBC-02",
        description: "Inventory rollforward support",
        requestedFrom: "Operations Controller",
        dateRequested: new Date("2026-03-29"),
        dateReceived: new Date("2026-04-03"),
        status: PBCRequestStatus.RECEIVED,
      },
    ],
  });

  const importedPbcBatch = await prisma.importBatch.create({
    data: {
      clientId: northwind.id,
      fileName: "sample-pbc-list.xlsx",
      importType: "PBC_ITEMS",
      status: "COMMITTED",
      committedAt: new Date(),
      rows: {
        create: [
          {
            rowNumber: 1,
            rawJson: JSON.stringify({
              "PBC #": "PBC-03",
              "Requested Item": "Legal letter",
              "Owner/Contact": "External Counsel",
              Status: "requested",
            }),
            normalizedJson: JSON.stringify({}),
          },
        ],
      },
    },
  });

  await prisma.importBatch.create({
    data: {
      clientId: summit.id,
      fileName: "sample-close-checklist.csv",
      importType: "TASK_BATCH",
      status: "COMMITTED",
      committedAt: new Date(),
      rows: {
        create: [
          {
            rowNumber: 1,
            rawJson: JSON.stringify({
              Task: "Roll forward deferred revenue schedule",
              Owner: "Alex Rivera",
              Priority: "High",
            }),
            normalizedJson: JSON.stringify({}),
          },
        ],
      },
    },
  });

  await prisma.taskInstance.create({
    data: {
      periodInstanceId: marchPeriod.id,
      title: "Imported checklist follow-up",
      description: "One-off imported task batch item from sample close checklist.",
      assignee: "Alex Rivera",
      assigneeUserId: alex.id,
      sourceType: TaskSourceType.IMPORTED,
      status: TaskStatus.WAITING_ON_CLIENT,
      priority: Priority.HIGH,
      sortOrder: 999,
      templateTaskSnapshot: JSON.stringify({ importBatchId: importedPbcBatch.id }),
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: domenica.id,
        userNameSnapshot: domenica.name,
        actionType: AuditActionType.CREATED,
        entityType: AuditEntityType.CLIENT,
        entityId: northwind.id,
        entityLabel: northwind.name,
        clientId: northwind.id,
      },
      {
        userId: domenica.id,
        userNameSnapshot: domenica.name,
        actionType: AuditActionType.CREATED,
        entityType: AuditEntityType.PERIOD,
        entityId: marchPeriod.id,
        entityLabel: marchPeriod.label,
        clientId: northwind.id,
        periodInstanceId: marchPeriod.id,
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
