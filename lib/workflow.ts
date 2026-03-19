import {
  Prisma,
  RecurrenceType,
  TaskSourceType,
  WorkflowTemplate,
} from "@prisma/client";
import {
  addDays,
  addMonths,
  addQuarters,
  addYears,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  getDay,
  setDate,
  setMonth,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "date-fns";

import { evaluateCarryforwardTask, RollforwardOptions } from "./rollforward";
import { prisma } from "./prisma";

type TemplateWithTasks = Prisma.WorkflowTemplateGetPayload<{
  include: {
    tasks: {
      include: {
        dependencyTemplateTask: true;
      };
    };
  };
}>;

export type GeneratePeriodInput = {
  clientId: string;
  templateId: string;
  label: string;
  periodKey: string;
  periodStart: Date;
  periodEnd: Date;
  sourcePeriodId?: string;
  rollforwardOptions?: RollforwardOptions;
};

function toBusinessDay(date: Date) {
  const day = getDay(date);
  if (day === 6) return addDays(date, -1);
  if (day === 0) return addDays(date, -2);
  return date;
}

export function calculateDueDate(
  task: TemplateWithTasks["tasks"][number],
  periodStart: Date,
  periodEnd: Date,
) {
  switch (task.dueDateRuleType) {
    case "DAY_OF_MONTH":
      return task.dueDayOfMonth
        ? setDate(startOfMonth(periodStart), task.dueDayOfMonth)
        : null;
    case "BUSINESS_DAY_OFFSET_FROM_PERIOD_END":
      return task.businessDayOffset !== null && task.businessDayOffset !== undefined
        ? toBusinessDay(addDays(periodEnd, task.businessDayOffset))
        : null;
    case "FIXED_CALENDAR_DATE":
      return task.fixedMonth && task.fixedDay
        ? setDate(setMonth(startOfYear(periodStart), task.fixedMonth - 1), task.fixedDay)
        : null;
    case "OFFSET_FROM_PERIOD_START":
      return task.offsetFromPeriodStart !== null &&
        task.offsetFromPeriodStart !== undefined
        ? addDays(periodStart, task.offsetFromPeriodStart)
        : null;
    default:
      return null;
  }
}

export function buildPeriodKey(
  recurrenceType: RecurrenceType,
  periodStart: Date,
  label?: string,
) {
  switch (recurrenceType) {
    case "MONTHLY":
      return format(periodStart, "yyyy-MM");
    case "QUARTERLY":
      return `Q${format(periodStart, "Q-yyyy")}`;
    case "YEARLY":
      return format(periodStart, "yyyy");
    case "ONE_TIME":
    default:
      return label?.toLowerCase().replace(/\s+/g, "-") ?? format(periodStart, "yyyy-MM-dd");
  }
}

export function buildPeriodLabel(template: WorkflowTemplate, periodStart: Date) {
  switch (template.recurrenceType) {
    case "MONTHLY":
      return format(periodStart, "MMMM yyyy");
    case "QUARTERLY":
      return `Q${format(periodStart, "Q yyyy")}`;
    case "YEARLY":
      if (template.workflowType === "AUDIT_PBC") {
        return `FY${format(periodStart, "yyyy")} Audit`;
      }
      return format(periodStart, "yyyy");
    case "ONE_TIME":
    default:
      return `${template.name} ${format(periodStart, "MMM d, yyyy")}`;
  }
}

export function inferNextPeriod(recurrenceType: RecurrenceType, periodStart: Date) {
  switch (recurrenceType) {
    case "MONTHLY":
      return {
        periodStart: startOfMonth(addMonths(periodStart, 1)),
        periodEnd: endOfMonth(addMonths(periodStart, 1)),
      };
    case "QUARTERLY":
      return {
        periodStart: startOfQuarter(addQuarters(periodStart, 1)),
        periodEnd: endOfQuarter(addQuarters(periodStart, 1)),
      };
    case "YEARLY":
      return {
        periodStart: startOfYear(addYears(periodStart, 1)),
        periodEnd: endOfYear(addYears(periodStart, 1)),
      };
    case "ONE_TIME":
    default:
      return {
        periodStart: addMonths(periodStart, 1),
        periodEnd: addMonths(periodStart, 1),
      };
  }
}

export async function generatePeriodInstance(input: GeneratePeriodInput) {
  const template = await prisma.workflowTemplate.findUniqueOrThrow({
    where: { id: input.templateId },
    include: {
      tasks: {
        where: { isActive: true },
        include: { dependencyTemplateTask: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const existingPeriod = await prisma.periodInstance.findFirst({
    where: {
      clientId: input.clientId,
      templateId: input.templateId,
      periodKey: input.periodKey,
    },
  });

  if (existingPeriod) {
    throw new Error("A period already exists for this client, template, and target period key.");
  }

  const templateSnapshot = JSON.stringify({
    template: {
      id: template.id,
      name: template.name,
      workflowType: template.workflowType,
      recurrenceType: template.recurrenceType,
      description: template.description,
    },
    tasks: template.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      defaultOwner: task.defaultOwner,
      recurrenceType: task.recurrenceType,
      dueDateRuleType: task.dueDateRuleType,
      carryforwardBehavior: task.carryforwardBehavior,
      copyNotesForward: task.copyNotesForward,
      evidenceRequired: task.evidenceRequired,
      reviewerRequired: task.reviewerRequired,
      defaultPriority: task.defaultPriority,
      sortOrder: task.sortOrder,
    })),
  });

  return prisma.$transaction(async (tx) => {
    const period = await tx.periodInstance.create({
      data: {
        clientId: input.clientId,
        templateId: input.templateId,
        label: input.label,
        periodKey: input.periodKey,
        workflowType: template.workflowType,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        sourcePeriodId: input.sourcePeriodId,
        templateSnapshot,
      },
    });

    const createdTasksByTemplateTask = new Map<string, string>();
    const generatedTemplateTaskIds = new Set<string>();

    for (const task of template.tasks) {
      const createdTask = await tx.taskInstance.create({
        data: {
          periodInstanceId: period.id,
          templateTaskId: task.id,
          title: task.title,
          description: task.description,
          category: task.category,
          assignee: task.defaultOwner,
          dueDate: calculateDueDate(task, input.periodStart, input.periodEnd),
          priority: task.defaultPriority,
          sortOrder: task.sortOrder,
          sourceType: TaskSourceType.TEMPLATE_GENERATED,
          evidenceRequired: task.evidenceRequired,
          reviewerRequired: task.reviewerRequired,
          templateTaskSnapshot: JSON.stringify(task),
        },
      });

      createdTasksByTemplateTask.set(task.id, createdTask.id);
      generatedTemplateTaskIds.add(task.id);
    }

    for (const task of template.tasks) {
      if (!task.dependencyTemplateTaskId) continue;

      const dependencyTaskId = createdTasksByTemplateTask.get(task.dependencyTemplateTaskId);
      const taskInstanceId = createdTasksByTemplateTask.get(task.id);

      if (dependencyTaskId && taskInstanceId) {
        await tx.taskInstance.update({
          where: { id: taskInstanceId },
          data: { dependencyTaskId },
        });
      }
    }

    if (input.sourcePeriodId && input.rollforwardOptions) {
      const priorTasks = await tx.taskInstance.findMany({
        where: { periodInstanceId: input.sourcePeriodId },
        include: {
          templateTask: true,
          comments: true,
        },
        orderBy: { sortOrder: "asc" },
      });

      for (const priorTask of priorTasks) {
        const decision = evaluateCarryforwardTask(
          priorTask,
          input.rollforwardOptions,
          generatedTemplateTaskIds,
        );

        if (!decision.createCarryforward) {
          continue;
        }

        const carryforwardTask = await tx.taskInstance.create({
          data: {
            periodInstanceId: period.id,
            templateTaskId: priorTask.templateTaskId,
            title: `${priorTask.title} (Carryforward)`,
            description: priorTask.description,
            category: priorTask.category,
            assignee: priorTask.assignee,
            dueDate: priorTask.dueDate,
            sourceType: TaskSourceType.CARRYFORWARD,
            priority: priorTask.priority,
            sortOrder: priorTask.sortOrder + 1000,
            carryforwardFromTaskId: priorTask.id,
            blockedReason: priorTask.blockedReason,
            notes: decision.copyNotes ? priorTask.notes : null,
            evidenceRequired: priorTask.evidenceRequired,
            reviewerRequired: priorTask.reviewerRequired,
            templateTaskSnapshot: priorTask.templateTaskSnapshot,
          },
        });

        if (decision.copyNotes && priorTask.comments.length > 0) {
          await tx.taskNote.createMany({
            data: priorTask.comments.map((comment) => ({
              taskInstanceId: carryforwardTask.id,
              body: comment.body,
              copiedForward: true,
            })),
          });
        }
      }
    }

    return period;
  });
}
