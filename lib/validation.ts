import { ImportType, RecurrenceType, WorkflowType } from "@prisma/client";
import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().min(1, "Client name is required."),
  code: z.string().optional(),
  industry: z.string().optional(),
  primaryContact: z.string().optional(),
  email: z.string().email("Email must be valid.").optional().or(z.literal("")),
});

export const templateSchema = z.object({
  name: z.string().min(1, "Template name is required."),
  workflowType: z.nativeEnum(WorkflowType),
  recurrenceType: z.nativeEnum(RecurrenceType),
  description: z.string().optional(),
});

export const templateTaskSchema = z.object({
  title: z.string().min(1, "Task title is required."),
  description: z.string().optional(),
  category: z.string().optional(),
  defaultOwner: z.string().optional(),
  recurrenceType: z.nativeEnum(RecurrenceType),
  dueDateRuleType: z.enum([
    "NONE",
    "DAY_OF_MONTH",
    "BUSINESS_DAY_OFFSET_FROM_PERIOD_END",
    "FIXED_CALENDAR_DATE",
    "OFFSET_FROM_PERIOD_START",
  ]),
  dueDayOfMonth: z.coerce.number().int().optional(),
  businessDayOffset: z.coerce.number().int().optional(),
  fixedMonth: z.coerce.number().int().optional(),
  fixedDay: z.coerce.number().int().optional(),
  offsetFromPeriodStart: z.coerce.number().int().optional(),
  dependencyTemplateTaskId: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
  carryforwardBehavior: z.enum(["NONE", "SURFACE_IF_INCOMPLETE", "ALWAYS_CREATE", "COPY_NOTES"]),
  evidenceRequired: z.boolean().optional(),
  reviewerRequired: z.boolean().optional(),
  copyNotesForward: z.boolean().optional(),
  defaultPriority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
});

export const periodGenerationSchema = z.object({
  clientId: z.string().min(1),
  templateId: z.string().min(1),
  label: z.string().min(1),
  periodKey: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

export const rollforwardSchema = z.object({
  periodId: z.string().min(1),
  label: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  includeIncompleteTasks: z.boolean().optional(),
  copyNotesFlaggedAsCarryforward: z.boolean().optional(),
  includeBlockedItems: z.boolean().optional(),
  excludeCompletedOneTimeTasks: z.boolean().optional(),
});

export const importUploadSchema = z.object({
  importType: z.nativeEnum(ImportType),
});
