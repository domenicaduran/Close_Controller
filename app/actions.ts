"use server";

import {
  CarryforwardBehavior,
  ImportStatus,
  ImportType,
  Priority,
  RecurrenceType,
  TaskSourceType,
  TaskStatus,
  WorkflowType,
} from "@prisma/client";
import {
  endOfMonth,
  endOfQuarter,
  endOfYear,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  normalizePBCStatus,
  normalizePriority,
  normalizeRecurrence,
  buildHeaderSignature,
  parseSpreadsheet,
  suggestMapping,
  validateImportRows,
} from "@/lib/imports";
import { prisma } from "@/lib/prisma";
import {
  buildPeriodKey,
  buildPeriodLabel,
  generatePeriodInstance,
} from "@/lib/workflow";
import {
  clientSchema,
  importUploadSchema,
  periodGenerationSchema,
  rollforwardSchema,
  templateSchema,
  templateTaskSchema,
} from "@/lib/validation";

function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalString(formData: FormData, key: string) {
  const value = stringValue(formData, key);
  return value || undefined;
}

function boolValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function numberOrUndefined(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function createClientAction(formData: FormData) {
  const parsed = clientSchema.safeParse({
    name: stringValue(formData, "name"),
    code: optionalString(formData, "code"),
    industry: optionalString(formData, "industry"),
    primaryContact: optionalString(formData, "primaryContact"),
    email: optionalString(formData, "email"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create client.");
  }

  await prisma.client.create({ data: parsed.data });
  revalidatePath("/clients");
  revalidatePath("/");
}

export async function updateClientAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const parsed = clientSchema.safeParse({
    name: stringValue(formData, "name"),
    code: optionalString(formData, "code"),
    industry: optionalString(formData, "industry"),
    primaryContact: optionalString(formData, "primaryContact"),
    email: optionalString(formData, "email"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not update client.");
  }

  await prisma.client.update({
    where: { id },
    data: parsed.data,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/");
}

export async function toggleClientArchiveAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const isArchived = stringValue(formData, "isArchived") === "true";

  await prisma.client.update({
    where: { id },
    data: { isArchived: !isArchived },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/");
}

export async function deleteClientAction(formData: FormData) {
  const id = stringValue(formData, "id");

  await prisma.client.delete({
    where: { id },
  });

  revalidatePath("/clients");
  revalidatePath("/tasks");
  revalidatePath("/periods");
  revalidatePath("/");
}

export async function createTemplateAction(formData: FormData) {
  const parsed = templateSchema.safeParse({
    name: stringValue(formData, "name"),
    workflowType: stringValue(formData, "workflowType") as WorkflowType,
    recurrenceType: stringValue(formData, "recurrenceType") as RecurrenceType,
    description: optionalString(formData, "description"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create template.");
  }

  const template = await prisma.workflowTemplate.create({
    data: parsed.data,
  });

  revalidatePath("/templates");
  redirect(`/templates/${template.id}`);
}

export async function updateTemplateAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const parsed = templateSchema.safeParse({
    name: stringValue(formData, "name"),
    workflowType: stringValue(formData, "workflowType") as WorkflowType,
    recurrenceType: stringValue(formData, "recurrenceType") as RecurrenceType,
    description: optionalString(formData, "description"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not update template.");
  }

  await prisma.workflowTemplate.update({
    where: { id },
    data: parsed.data,
  });

  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
  revalidatePath("/");
}

export async function assignTemplateToClientAction(formData: FormData) {
  const clientId = stringValue(formData, "clientId");
  const templateId = stringValue(formData, "templateId");

  await prisma.clientTemplateAssignment.upsert({
    where: {
      clientId_templateId: {
        clientId,
        templateId,
      },
    },
    update: {},
    create: { clientId, templateId },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

export async function removeTemplateAssignmentAction(formData: FormData) {
  const clientId = stringValue(formData, "clientId");
  const templateId = stringValue(formData, "templateId");

  await prisma.clientTemplateAssignment.delete({
    where: {
      clientId_templateId: {
        clientId,
        templateId,
      },
    },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

export async function createTemplateTaskAction(formData: FormData) {
  const templateId = stringValue(formData, "templateId");

  const parsed = templateTaskSchema.safeParse({
    title: stringValue(formData, "title"),
    description: optionalString(formData, "description"),
    category: optionalString(formData, "category"),
    defaultOwner: optionalString(formData, "defaultOwner"),
    recurrenceType: stringValue(formData, "recurrenceType") as RecurrenceType,
    dueDateRuleType: stringValue(formData, "dueDateRuleType"),
    dueDayOfMonth: numberOrUndefined(optionalString(formData, "dueDayOfMonth")),
    businessDayOffset: numberOrUndefined(optionalString(formData, "businessDayOffset")),
    fixedMonth: numberOrUndefined(optionalString(formData, "fixedMonth")),
    fixedDay: numberOrUndefined(optionalString(formData, "fixedDay")),
    offsetFromPeriodStart: numberOrUndefined(optionalString(formData, "offsetFromPeriodStart")),
    dependencyTemplateTaskId: optionalString(formData, "dependencyTemplateTaskId"),
    sortOrder: numberOrUndefined(optionalString(formData, "sortOrder")) ?? 0,
    carryforwardBehavior: stringValue(formData, "carryforwardBehavior"),
    evidenceRequired: boolValue(formData, "evidenceRequired"),
    reviewerRequired: boolValue(formData, "reviewerRequired"),
    copyNotesForward: boolValue(formData, "copyNotesForward"),
    defaultPriority: stringValue(formData, "defaultPriority"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create template task.");
  }

  await prisma.templateTask.create({
    data: {
      templateId,
      ...parsed.data,
      dependencyTemplateTaskId: parsed.data.dependencyTemplateTaskId || null,
    },
  });

  revalidatePath(`/templates/${templateId}`);
  revalidatePath("/templates");
}

export async function createPeriodAction(formData: FormData) {
  const parsed = periodGenerationSchema.safeParse({
    clientId: stringValue(formData, "clientId"),
    templateId: stringValue(formData, "templateId"),
    label: stringValue(formData, "label"),
    periodKey: stringValue(formData, "periodKey"),
    periodStart: stringValue(formData, "periodStart"),
    periodEnd: stringValue(formData, "periodEnd"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create period.");
  }

  const period = await generatePeriodInstance({
    clientId: parsed.data.clientId,
    templateId: parsed.data.templateId,
    label: parsed.data.label,
    periodKey: parsed.data.periodKey,
    periodStart: parseISO(parsed.data.periodStart),
    periodEnd: parseISO(parsed.data.periodEnd),
  });

  revalidatePath("/periods");
  revalidatePath("/");
  redirect(`/periods/${period.id}`);
}

export async function createSuggestedPeriodAction(formData: FormData) {
  const clientId = stringValue(formData, "clientId");
  const templateId = stringValue(formData, "templateId");
  const basisDate = parseISO(stringValue(formData, "basisDate"));

  const template = await prisma.workflowTemplate.findUniqueOrThrow({
    where: { id: templateId },
  });

  let periodStart = basisDate;
  let periodEnd = basisDate;

  if (template.recurrenceType === RecurrenceType.MONTHLY) {
    periodStart = startOfMonth(basisDate);
    periodEnd = endOfMonth(basisDate);
  } else if (template.recurrenceType === RecurrenceType.QUARTERLY) {
    periodStart = startOfQuarter(basisDate);
    periodEnd = endOfQuarter(basisDate);
  } else if (template.recurrenceType === RecurrenceType.YEARLY) {
    periodStart = startOfYear(basisDate);
    periodEnd = endOfYear(basisDate);
  }

  const period = await generatePeriodInstance({
    clientId,
    templateId,
    label: buildPeriodLabel(template, periodStart),
    periodKey: buildPeriodKey(template.recurrenceType, periodStart),
    periodStart,
    periodEnd,
  });

  revalidatePath("/periods");
  revalidatePath("/");
  redirect(`/periods/${period.id}`);
}

export async function rollforwardPeriodAction(formData: FormData) {
  const parsed = rollforwardSchema.safeParse({
    periodId: stringValue(formData, "periodId"),
    label: stringValue(formData, "label"),
    periodStart: stringValue(formData, "periodStart"),
    periodEnd: stringValue(formData, "periodEnd"),
    includeIncompleteTasks: boolValue(formData, "includeIncompleteTasks"),
    copyNotesFlaggedAsCarryforward: boolValue(formData, "copyNotesFlaggedAsCarryforward"),
    includeBlockedItems: boolValue(formData, "includeBlockedItems"),
    excludeCompletedOneTimeTasks: boolValue(formData, "excludeCompletedOneTimeTasks"),
  });

  if (!parsed.success) {
    throw new Error("Could not roll forward period.");
  }

  const sourcePeriod = await prisma.periodInstance.findUniqueOrThrow({
    where: { id: parsed.data.periodId },
    include: { template: true },
  });

  const periodStart = parseISO(parsed.data.periodStart);
  const periodEnd = parseISO(parsed.data.periodEnd);

  const period = await generatePeriodInstance({
    clientId: sourcePeriod.clientId,
    templateId: sourcePeriod.templateId,
    label: parsed.data.label,
    periodKey: buildPeriodKey(sourcePeriod.template.recurrenceType, periodStart, parsed.data.label),
    periodStart,
    periodEnd,
    sourcePeriodId: sourcePeriod.id,
    rollforwardOptions: {
      includeIncompleteTasks: parsed.data.includeIncompleteTasks ?? false,
      copyNotesFlaggedAsCarryforward: parsed.data.copyNotesFlaggedAsCarryforward ?? false,
      includeBlockedItems: parsed.data.includeBlockedItems ?? false,
      excludeCompletedOneTimeTasks: parsed.data.excludeCompletedOneTimeTasks ?? false,
    },
  });

  revalidatePath("/periods");
  revalidatePath(`/periods/${sourcePeriod.id}`);
  revalidatePath("/");
  redirect(`/periods/${period.id}`);
}

export async function setPeriodStatusAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const status = stringValue(formData, "status");

  await prisma.periodInstance.update({
    where: { id },
    data: { status: status as never },
  });

  revalidatePath(`/periods/${id}`);
  revalidatePath("/periods");
  revalidatePath("/");
}

export async function updateTaskStatusAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const periodId = stringValue(formData, "periodId");
  const status = stringValue(formData, "status") as TaskStatus;

  await prisma.taskInstance.update({
    where: { id },
    data: {
      status,
      completedAt: status === TaskStatus.COMPLETE ? new Date() : null,
    },
  });

  revalidatePath(`/periods/${periodId}`);
  revalidatePath("/periods");
  revalidatePath("/");
}

export async function updateTaskDetailsAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const periodId = stringValue(formData, "periodId");

  await prisma.taskInstance.update({
    where: { id },
    data: {
      assignee: optionalString(formData, "assignee") ?? null,
      dueDate: optionalString(formData, "dueDate")
        ? parseISO(stringValue(formData, "dueDate"))
        : null,
      notes: optionalString(formData, "notes") ?? null,
      blockedReason: optionalString(formData, "blockedReason") ?? null,
      reviewerSignoff: optionalString(formData, "reviewerSignoff") ?? null,
      reviewerSignedOffAt: optionalString(formData, "reviewerSignoff")
        ? new Date()
        : null,
      priority: stringValue(formData, "priority") as Priority,
    },
  });

  revalidatePath(`/periods/${periodId}`);
  revalidatePath("/periods");
}

export async function addTaskCommentAction(formData: FormData) {
  const taskInstanceId = stringValue(formData, "taskInstanceId");
  const periodId = stringValue(formData, "periodId");
  const body = stringValue(formData, "body");

  if (!body) return;

  await prisma.taskNote.create({
    data: { taskInstanceId, body },
  });

  revalidatePath(`/periods/${periodId}`);
}

export async function addEvidenceLinkAction(formData: FormData) {
  const taskInstanceId = stringValue(formData, "taskInstanceId");
  const periodId = stringValue(formData, "periodId");
  const label = stringValue(formData, "label");
  const url = stringValue(formData, "url");

  if (!label || !url) return;

  await prisma.evidenceLink.create({
    data: { taskInstanceId, label, url },
  });

  revalidatePath(`/periods/${periodId}`);
}

export async function uploadImportAction(formData: FormData) {
  const parsed = importUploadSchema.safeParse({
    importType: stringValue(formData, "importType") as ImportType,
  });

  if (!parsed.success) {
    throw new Error("Choose an import type.");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Upload a CSV or XLSX file.");
  }

  const buffer = await file.arrayBuffer();
  const parsedFile = parseSpreadsheet(file.name, buffer);
  const savedPreset = await prisma.importMappingPreset.findFirst({
    where: {
      importType: parsed.data.importType,
      headerSignature: parsedFile.headerSignature,
    },
    orderBy: [{ lastUsedAt: "desc" }, { updatedAt: "desc" }],
  });

  const mapping = savedPreset
    ? (JSON.parse(savedPreset.mappingJson) as Record<string, string>)
    : suggestMapping(parsedFile.headers, parsed.data.importType);
  const validation = validateImportRows(parsed.data.importType, parsedFile.rows, mapping);

  const batch = await prisma.importBatch.create({
    data: {
      fileName: file.name,
      importType: parsed.data.importType,
      headerSignature: parsedFile.headerSignature,
      status: validation.errors.length > 0 ? ImportStatus.PREVIEW : ImportStatus.VALIDATED,
      columnMappingJson: JSON.stringify(mapping),
      validationJson: JSON.stringify(validation.errors),
      rows: {
        create: validation.rowResults.map((rowResult) => ({
          rowNumber: rowResult.rowNumber,
          rawJson: JSON.stringify(rowResult.original),
          normalizedJson: JSON.stringify(rowResult.normalized),
          validationJson: JSON.stringify({
            valid: rowResult.valid,
            ignored: rowResult.ignored,
            errors: rowResult.errors,
            mapped: rowResult.mapped,
          }),
        })),
      },
    },
  });

  if (savedPreset) {
    await prisma.importMappingPreset.update({
      where: { id: savedPreset.id },
      data: { lastUsedAt: new Date() },
    });
  }

  revalidatePath("/imports");
  redirect(`/imports/${batch.id}`);
}

export async function saveImportMappingAction(formData: FormData) {
  const batchId = stringValue(formData, "batchId");
  const savePresetName = optionalString(formData, "presetName");
  const applyPresetId = optionalString(formData, "applyPresetId");

  const batch = await prisma.importBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });

  let mapping: Record<string, string>;

  if (applyPresetId) {
    const preset = await prisma.importMappingPreset.findUniqueOrThrow({
      where: { id: applyPresetId },
    });
    mapping = JSON.parse(preset.mappingJson) as Record<string, string>;
    await prisma.importMappingPreset.update({
      where: { id: preset.id },
      data: { lastUsedAt: new Date() },
    });
  } else {
    mapping = Object.fromEntries(
      Array.from(formData.entries())
        .filter(([key, value]) => key.startsWith("map:") && String(value))
        .map(([key, value]) => [key.replace("map:", ""), String(value)]),
    );
  }

  const rows = batch.rows.map((row) => JSON.parse(row.rawJson) as Record<string, string>);
  const validation = validateImportRows(batch.importType, rows, mapping);

  const operations = [
    prisma.importBatch.update({
      where: { id: batchId },
      data: {
        columnMappingJson: JSON.stringify(mapping),
        validationJson: JSON.stringify(validation.errors),
        status: validation.errors.length > 0 ? ImportStatus.PREVIEW : ImportStatus.VALIDATED,
      },
    }),
    ...batch.rows.map((row, index) =>
      prisma.importRow.update({
        where: { id: row.id },
        data: {
          normalizedJson: JSON.stringify(validation.rowResults[index]?.normalized ?? {}),
          validationJson: JSON.stringify({
            valid: validation.rowResults[index]?.valid ?? false,
            ignored: validation.rowResults[index]?.ignored ?? false,
            errors: validation.rowResults[index]?.errors ?? [],
            mapped: validation.rowResults[index]?.mapped ?? {},
          }),
        },
      }),
    ),
  ];

  await prisma.$transaction(operations);

  if (savePresetName) {
    await prisma.importMappingPreset.upsert({
      where: {
        importType_name: {
          importType: batch.importType,
          name: savePresetName,
        },
      },
      update: {
        headerSignature: batch.headerSignature ?? buildHeaderSignature(Object.keys(rows[0] ?? {})),
        mappingJson: JSON.stringify(mapping),
        lastUsedAt: new Date(),
      },
      create: {
        importType: batch.importType,
        name: savePresetName,
        headerSignature: batch.headerSignature ?? buildHeaderSignature(Object.keys(rows[0] ?? {})),
        mappingJson: JSON.stringify(mapping),
        lastUsedAt: new Date(),
      },
    });
  }

  revalidatePath(`/imports/${batchId}`);
  revalidatePath("/imports");
}

export async function commitImportBatchAction(formData: FormData) {
  const batchId = stringValue(formData, "batchId");
  const clientId = optionalString(formData, "clientId");
  const periodInstanceId = optionalString(formData, "periodInstanceId");
  const templateName = optionalString(formData, "templateName");
  const workflowType = (optionalString(formData, "workflowType") ?? "MONTH_END") as WorkflowType;
  const recurrenceType = (optionalString(formData, "recurrenceType") ?? "MONTHLY") as RecurrenceType;

  const batch = await prisma.importBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });

  const mapping = JSON.parse(batch.columnMappingJson ?? "{}") as Record<string, string>;
  const rawRows = batch.rows.map((row) => JSON.parse(row.rawJson) as Record<string, string>);
  const validation = validateImportRows(batch.importType, rawRows, mapping);

  if (validation.errors.length > 0) {
    throw new Error("Fix import mapping errors before committing.");
  }

  const validRows = validation.rowResults.filter((row) => row.valid && !row.ignored);

  await prisma.$transaction(async (tx) => {
    if (batch.importType === ImportType.TEMPLATE) {
      const template = await tx.workflowTemplate.create({
        data: {
          name: templateName || `${batch.fileName} Template`,
          workflowType,
          recurrenceType,
          description: `Imported from ${batch.fileName}`,
        },
      });

      for (const [index, row] of validRows.entries()) {
        await tx.templateTask.create({
          data: {
            templateId: template.id,
            title: row.normalized.title ?? "",
            description: row.normalized.description,
            category: row.normalized.category,
            defaultOwner: row.normalized.owner,
            recurrenceType: normalizeRecurrence(row.normalized.recurrence),
            dueDateRuleType: row.normalized.dueDay ? "DAY_OF_MONTH" : "NONE",
            dueDayOfMonth: row.normalized.dueDay ? Number(row.normalized.dueDay) : null,
            sortOrder: index + 1,
            carryforwardBehavior: CarryforwardBehavior.SURFACE_IF_INCOMPLETE,
            evidenceRequired: false,
            reviewerRequired: false,
            defaultPriority: normalizePriority(row.normalized.priority),
          },
        });
      }

      if (clientId) {
        await tx.clientTemplateAssignment.upsert({
          where: {
            clientId_templateId: {
              clientId,
              templateId: template.id,
            },
          },
          update: {},
          create: { clientId, templateId: template.id },
        });
      }
    } else if (batch.importType === ImportType.TASK_BATCH) {
      if (!clientId || !periodInstanceId) {
        throw new Error("Choose a client and target period before committing imported tasks.");
      }

      for (const [index, row] of validRows.entries()) {
        await tx.taskInstance.create({
          data: {
            periodInstanceId,
            title: row.normalized.title ?? "",
            description: row.normalized.description,
            category: row.normalized.category,
            assignee: row.normalized.owner,
            dueDate: row.normalized.dueDate ? new Date(row.normalized.dueDate) : null,
            notes: row.normalized.notes,
            sourceType: TaskSourceType.IMPORTED,
            priority: normalizePriority(row.normalized.priority),
            sortOrder: 500 + index,
            templateTaskSnapshot: JSON.stringify({
              importBatchId: batch.id,
              rowNumber: row.rowNumber,
              mapped: row.mapped,
              normalized: row.normalized,
            }),
          },
        });
      }
    } else if (batch.importType === ImportType.PBC_ITEMS) {
      if (!clientId || !periodInstanceId) {
        throw new Error("Choose a client and target period before committing PBC items.");
      }

      for (const row of validRows) {
        await tx.pBCRequestItem.create({
          data: {
            clientId,
            periodInstanceId,
            requestNumber: row.normalized.requestNumber,
            description: row.normalized.description ?? "",
            requestedFrom: row.normalized.requestedFrom,
            dateRequested: row.normalized.requestedDate ? new Date(row.normalized.requestedDate) : null,
            dateReceived: row.normalized.receivedDate ? new Date(row.normalized.receivedDate) : null,
            status: normalizePBCStatus(row.normalized.status),
            notes: row.normalized.notes,
          },
        });
      }
    }

    await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        clientId: clientId ?? null,
        status: ImportStatus.COMMITTED,
        committedAt: new Date(),
        validationJson: JSON.stringify(validation.errors),
      },
    });
  });

  revalidatePath("/imports");
  revalidatePath(`/imports/${batchId}`);
  revalidatePath("/templates");
  revalidatePath("/periods");
  revalidatePath("/");
}
