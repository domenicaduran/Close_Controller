import test from "node:test";
import assert from "node:assert/strict";

import {
  CarryforwardBehavior,
  RecurrenceType,
  TaskSourceType,
  TaskStatus,
} from "@prisma/client";

import { evaluateCarryforwardTask, RollforwardOptions } from "../lib/rollforward";

const defaultOptions: RollforwardOptions = {
  includeIncompleteTasks: true,
  copyNotesFlaggedAsCarryforward: true,
  includeBlockedItems: true,
  excludeCompletedOneTimeTasks: true,
};

function buildTask(overrides: Partial<Parameters<typeof evaluateCarryforwardTask>[0]> = {}) {
  return {
    id: "task_1",
    title: "Reconcile cash",
    status: TaskStatus.IN_PROGRESS,
    sourceType: TaskSourceType.TEMPLATE_GENERATED,
    templateTaskId: "template_task_1",
    sortOrder: 10,
    notes: "Carry this note",
    blockedReason: null,
    dueDate: new Date("2026-03-05"),
    assignee: "Domenica",
    priority: "HIGH",
    description: "Task description",
    category: "Cash",
    evidenceRequired: false,
    reviewerRequired: false,
    templateTaskSnapshot: "{}",
    comments: [{ body: "Comment to copy" }],
    templateTask: {
      recurrenceType: RecurrenceType.MONTHLY,
      carryforwardBehavior: CarryforwardBehavior.COPY_NOTES,
      copyNotesForward: true,
    },
    ...overrides,
  };
}

test("does not create a duplicate carryforward for recurring template tasks already generated in target period", () => {
  const decision = evaluateCarryforwardTask(
    buildTask(),
    defaultOptions,
    new Set(["template_task_1"]),
  );

  assert.equal(decision.createCarryforward, false);
});

test("includes blocked tasks only when blocked items are enabled", () => {
  const blockedTask = buildTask({ status: TaskStatus.BLOCKED });

  const excluded = evaluateCarryforwardTask(
    blockedTask,
    { ...defaultOptions, includeBlockedItems: false },
    new Set(),
  );
  const included = evaluateCarryforwardTask(
    blockedTask,
    { ...defaultOptions, includeBlockedItems: true },
    new Set(),
  );

  assert.equal(excluded.createCarryforward, false);
  assert.equal(included.createCarryforward, true);
});

test("copies notes only when the rollforward option is enabled and the template task is flagged", () => {
  const decision = evaluateCarryforwardTask(
    buildTask(),
    { ...defaultOptions, copyNotesFlaggedAsCarryforward: true },
    new Set(),
  );

  const noCopyDecision = evaluateCarryforwardTask(
    buildTask(),
    { ...defaultOptions, copyNotesFlaggedAsCarryforward: false },
    new Set(),
  );

  assert.equal(decision.copyNotes, true);
  assert.equal(noCopyDecision.copyNotes, false);
});

test("excludes completed one-time tasks by default", () => {
  const oneTimeCompletedTask = buildTask({
    status: TaskStatus.COMPLETE,
    templateTask: {
      recurrenceType: RecurrenceType.ONE_TIME,
      carryforwardBehavior: CarryforwardBehavior.ALWAYS_CREATE,
      copyNotesForward: true,
    },
  });

  const excluded = evaluateCarryforwardTask(
    oneTimeCompletedTask,
    { ...defaultOptions, excludeCompletedOneTimeTasks: true },
    new Set(),
  );

  const included = evaluateCarryforwardTask(
    oneTimeCompletedTask,
    { ...defaultOptions, excludeCompletedOneTimeTasks: false },
    new Set(),
  );

  assert.equal(excluded.createCarryforward, false);
  assert.equal(included.createCarryforward, true);
});
