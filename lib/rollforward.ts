import {
  CarryforwardBehavior,
  RecurrenceType,
  TaskSourceType,
  TaskStatus,
} from "@prisma/client";

export type RollforwardOptions = {
  includeIncompleteTasks: boolean;
  copyNotesFlaggedAsCarryforward: boolean;
  includeBlockedItems: boolean;
  excludeCompletedOneTimeTasks: boolean;
};

export type RollforwardCandidateTask = {
  id: string;
  title: string;
  status: TaskStatus;
  sourceType: TaskSourceType;
  templateTaskId: string | null;
  sortOrder: number;
  notes: string | null;
  blockedReason: string | null;
  dueDate: Date | null;
  assignee: string | null;
  assigneeUserId?: string | null;
  priority: string;
  description: string | null;
  category: string | null;
  evidenceRequired: boolean;
  reviewerRequired: boolean;
  templateTaskSnapshot: string;
  comments: Array<{ body: string; authorUserId?: string | null }>;
  templateTask: null | {
    recurrenceType: RecurrenceType;
    carryforwardBehavior: CarryforwardBehavior;
    copyNotesForward: boolean;
  };
};

export type CarryforwardDecision = {
  createCarryforward: boolean;
  copyNotes: boolean;
  reason: string;
};

export function evaluateCarryforwardTask(
  task: RollforwardCandidateTask,
  options: RollforwardOptions,
  generatedTemplateTaskIds: Set<string>,
): CarryforwardDecision {
  const templateTask = task.templateTask;
  const isOneTimeTemplateTask = templateTask?.recurrenceType === RecurrenceType.ONE_TIME;
  const isBlocked = task.status === TaskStatus.BLOCKED;
  const isComplete = task.status === TaskStatus.COMPLETE;
  const carriesNotes =
    options.copyNotesFlaggedAsCarryforward &&
    Boolean(
      templateTask?.copyNotesForward ||
        templateTask?.carryforwardBehavior === CarryforwardBehavior.COPY_NOTES,
    );

  if (
    templateTask &&
    templateTask.recurrenceType !== RecurrenceType.ONE_TIME &&
    task.templateTaskId &&
    generatedTemplateTaskIds.has(task.templateTaskId)
  ) {
    return {
      createCarryforward: false,
      copyNotes: false,
      reason: "Recurring template task is already generated for the target period.",
    };
  }

  if (isComplete) {
    if (
      isOneTimeTemplateTask &&
      !options.excludeCompletedOneTimeTasks &&
      templateTask?.carryforwardBehavior !== CarryforwardBehavior.NONE
    ) {
      return {
        createCarryforward: true,
        copyNotes: carriesNotes,
        reason: "Completed one-time task explicitly allowed into rollforward.",
      };
    }

    return {
      createCarryforward: false,
      copyNotes: false,
      reason: "Completed tasks are not carried forward.",
    };
  }

  if (isBlocked && !options.includeBlockedItems) {
    return {
      createCarryforward: false,
      copyNotes: false,
      reason: "Blocked items are excluded by rollforward options.",
    };
  }

  if (!isBlocked && !options.includeIncompleteTasks) {
    return {
      createCarryforward: false,
      copyNotes: false,
      reason: "Incomplete tasks are excluded by rollforward options.",
    };
  }

  if (
    isOneTimeTemplateTask &&
    templateTask?.carryforwardBehavior === CarryforwardBehavior.NONE
  ) {
    return {
      createCarryforward: false,
      copyNotes: false,
      reason: "One-time task is not marked for carryforward.",
    };
  }

  return {
    createCarryforward: true,
    copyNotes: carriesNotes,
    reason: "Unresolved prior task should be carried forward.",
  };
}
