import {
  CarryforwardBehavior,
  PBCRequestStatus,
  Priority,
  RecurrenceType,
  TaskSourceType,
  TaskStatus,
  WorkflowType,
} from "@prisma/client";
import { endOfMonth, startOfMonth } from "date-fns";

import { prisma } from "../lib/prisma";
import { buildPeriodKey, buildPeriodLabel, generatePeriodInstance } from "../lib/workflow";

async function main() {
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
      },
    });

    await prisma.taskNote.create({
      data: {
        taskInstanceId: generatedTasks[1].id,
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
      sourceType: TaskSourceType.IMPORTED,
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      sortOrder: 999,
      templateTaskSnapshot: JSON.stringify({ importBatchId: importedPbcBatch.id }),
    },
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
