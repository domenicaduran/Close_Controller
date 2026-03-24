"use server";

import {
  AuditActionType,
  AuditEntityType,
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
  accessibleClientIdsForUser,
  isAdmin,
  clearSession,
  createSession,
  findUserByOwnerLabel,
  requireAdmin,
  requireClientAccess,
  requireClientManagementAccess,
  requireManagerOrAdmin,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
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
  createManualPeriodInstance,
  generatePeriodInstance,
} from "@/lib/workflow";
import {
  clientSchema,
  importUploadSchema,
  loginSchema,
  manualTaskSchema,
  periodGenerationSchema,
  rollforwardSchema,
  templateSchema,
  templateTaskSchema,
  userSchema,
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

async function resolveUserChoice(userId?: string, fallbackLabel?: string) {
  const normalizedUserId = userId?.trim();
  const normalizedLabel = fallbackLabel?.trim();

  if (normalizedUserId) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: normalizedUserId },
      select: { id: true, name: true },
    });

    return {
      userId: user.id,
      label: user.name,
    };
  }

  return {
    userId: null,
    label: normalizedLabel || null,
  };
}

export async function bootstrapUserAction(formData: FormData) {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    throw new Error("Initial setup is already complete.");
  }

  const parsed = userSchema.safeParse({
    name: stringValue(formData, "name"),
    email: stringValue(formData, "email"),
    title: optionalString(formData, "title"),
    role: "ADMIN",
    password: stringValue(formData, "password"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create user.");
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      title: parsed.data.title ?? null,
      role: parsed.data.role as never,
      passwordHash: hashPassword(parsed.data.password),
    },
  });

  await createSession(user.id);
  redirect("/");
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: stringValue(formData, "email"),
    password: stringValue(formData, "password"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not sign in.");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (!user || !user.isActive || !verifyPassword(parsed.data.password, user.passwordHash)) {
    throw new Error("Email or password is incorrect.");
  }

  await createSession(user.id);
  await createAuditLog({
    user,
    actionType: AuditActionType.SIGNED_IN,
    entityType: AuditEntityType.SESSION,
    entityId: user.id,
    entityLabel: user.email,
    metadata: {
      email: user.email,
    },
  });
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function createUserAction(formData: FormData) {
  const currentUser = await requireAdmin();

  const parsed = userSchema.safeParse({
    name: stringValue(formData, "name"),
    email: stringValue(formData, "email"),
    title: optionalString(formData, "title"),
    password: stringValue(formData, "password"),
    role: stringValue(formData, "role"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create team member.");
  }

  const createdUser = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      title: parsed.data.title ?? null,
      role: parsed.data.role as never,
      passwordHash: hashPassword(parsed.data.password),
    },
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.CREATED,
    entityType: AuditEntityType.USER,
    entityId: createdUser.id,
    entityLabel: createdUser.name,
    metadata: {
      email: createdUser.email,
      role: createdUser.role,
    },
  });

  revalidatePath("/team");
  revalidatePath("/clients");
}

export async function updateUserAction(formData: FormData) {
  const currentUser = await requireAdmin();

  const id = stringValue(formData, "id");
  const name = stringValue(formData, "name");
  const email = stringValue(formData, "email").toLowerCase();
  const title = optionalString(formData, "title");
  const password = optionalString(formData, "password");
  const isActive = stringValue(formData, "isActive") === "true";
  const role = stringValue(formData, "role");

  if (!name) throw new Error("Name is required.");
  if (!email) throw new Error("Email is required.");

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      name,
      email,
      title: title ?? null,
      isActive,
      role: role as never,
      ...(password ? { passwordHash: hashPassword(password) } : {}),
    },
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.UPDATED,
    entityType: AuditEntityType.USER,
    entityId: updatedUser.id,
    entityLabel: updatedUser.name,
    metadata: {
      email: updatedUser.email,
      role: updatedUser.role,
      passwordReset: Boolean(password),
    },
  });

  revalidatePath("/team");
  revalidatePath("/tasks");
  revalidatePath("/clients");
}

export async function toggleUserArchiveAction(formData: FormData) {
  const currentUser = await requireAdmin();
  const id = stringValue(formData, "id");
  const isActive = stringValue(formData, "isActive") === "true";

  if (currentUser.id === id && isActive) {
    throw new Error("You cannot archive the account you are currently using.");
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { isActive: !isActive },
  });

  await createAuditLog({
    user: currentUser,
    actionType: isActive ? AuditActionType.ARCHIVED : AuditActionType.RESTORED,
    entityType: AuditEntityType.USER,
    entityId: updatedUser.id,
    entityLabel: updatedUser.name,
    metadata: {
      email: updatedUser.email,
      isActive: updatedUser.isActive,
    },
  });

  revalidatePath("/team");
  revalidatePath("/tasks");
  revalidatePath("/clients");
}

export async function deleteUserAction(formData: FormData) {
  const currentUser = await requireAdmin();
  const id = stringValue(formData, "id");

  if (currentUser.id === id) {
    throw new Error("You cannot delete the account you are currently using.");
  }

  const userToDelete = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, email: true },
  });

  await prisma.user.delete({
    where: { id },
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.DELETED,
    entityType: AuditEntityType.USER,
    entityId: userToDelete.id,
    entityLabel: userToDelete.name,
    metadata: {
      email: userToDelete.email,
    },
  });

  revalidatePath("/team");
  revalidatePath("/tasks");
  revalidatePath("/clients");
}

export async function assignUserToClientAction(formData: FormData) {
  const currentUser = await requireAdmin();

  const clientId = stringValue(formData, "clientId");
  const userId = stringValue(formData, "userId");
  const roleLabel = optionalString(formData, "roleLabel");

  const membership = await prisma.clientUserAccess.upsert({
    where: {
      clientId_userId: {
        clientId,
        userId,
      },
    },
    update: {
      roleLabel: roleLabel ?? null,
    },
    create: {
      clientId,
      userId,
      roleLabel: roleLabel ?? null,
    },
  });

  const [client, user] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }),
  ]);

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.ASSIGNED,
    entityType: AuditEntityType.TEAM_MEMBERSHIP,
    entityId: membership.id,
    entityLabel: `${user.name} -> ${client.name}`,
    clientId,
    metadata: {
      clientName: client.name,
      userName: user.name,
      roleLabel: roleLabel ?? null,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/team");
}

export async function removeUserFromClientAction(formData: FormData) {
  const currentUser = await requireAdmin();

  const clientId = stringValue(formData, "clientId");
  const userId = stringValue(formData, "userId");

  const [client, user] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }),
  ]);

  await prisma.clientUserAccess.delete({
    where: {
      clientId_userId: {
        clientId,
        userId,
      },
    },
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.UNASSIGNED,
    entityType: AuditEntityType.TEAM_MEMBERSHIP,
    entityId: `${clientId}:${userId}`,
    entityLabel: `${user.name} -> ${client.name}`,
    clientId,
    metadata: {
      clientName: client.name,
      userName: user.name,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/team");
}

export async function createClientAction(formData: FormData) {
  const currentUser = await requireAdmin();
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

  const client = await prisma.client.create({ data: parsed.data });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.CREATED,
    entityType: AuditEntityType.CLIENT,
    entityId: client.id,
    entityLabel: client.name,
    clientId: client.id,
  });
  revalidatePath("/clients");
  revalidatePath("/");
}

export async function updateClientAction(formData: FormData) {
  const currentUser = await requireAdmin();
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

  const client = await prisma.client.update({
    where: { id },
    data: parsed.data,
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.UPDATED,
    entityType: AuditEntityType.CLIENT,
    entityId: client.id,
    entityLabel: client.name,
    clientId: client.id,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/");
}

export async function toggleClientArchiveAction(formData: FormData) {
  const currentUser = await requireAdmin();
  const id = stringValue(formData, "id");
  const isArchived = stringValue(formData, "isArchived") === "true";

  const client = await prisma.client.update({
    where: { id },
    data: { isArchived: !isArchived },
  });

  await createAuditLog({
    user: currentUser,
    actionType: isArchived ? AuditActionType.RESTORED : AuditActionType.ARCHIVED,
    entityType: AuditEntityType.CLIENT,
    entityId: client.id,
    entityLabel: client.name,
    clientId: client.id,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/");
}

export async function deleteClientAction(formData: FormData) {
  const currentUser = await requireAdmin();
  const id = stringValue(formData, "id");

  const client = await prisma.client.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true },
  });

  await prisma.client.delete({
    where: { id },
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.DELETED,
    entityType: AuditEntityType.CLIENT,
    entityId: client.id,
    entityLabel: client.name,
    clientId: client.id,
  });

  revalidatePath("/clients");
  revalidatePath("/tasks");
  revalidatePath("/periods");
  revalidatePath("/");
}

export async function createManualTaskAction(formData: FormData) {
  const parsed = manualTaskSchema.safeParse({
    periodInstanceId: stringValue(formData, "periodInstanceId"),
    title: stringValue(formData, "title"),
    description: optionalString(formData, "description"),
    category: optionalString(formData, "category"),
    assignee: optionalString(formData, "assignee"),
    assigneeUserId: optionalString(formData, "assigneeUserId"),
    dueDate: optionalString(formData, "dueDate"),
    notes: optionalString(formData, "notes"),
    blockedReason: optionalString(formData, "blockedReason"),
    priority: stringValue(formData, "priority") as Priority,
    status: stringValue(formData, "status") as TaskStatus,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create task.");
  }

  const period = await prisma.periodInstance.findUniqueOrThrow({
    where: { id: parsed.data.periodInstanceId },
    include: { taskInstances: { select: { sortOrder: true } } },
  });
  const currentUser = await requireClientManagementAccess(period.clientId);

  const nextSortOrder =
    Math.max(0, ...period.taskInstances.map((task) => task.sortOrder)) + 10;
  const assignment = await resolveUserChoice(parsed.data.assigneeUserId, parsed.data.assignee);

  const task = await prisma.taskInstance.create({
    data: {
      periodInstanceId: parsed.data.periodInstanceId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      category: parsed.data.category ?? null,
      assignee: assignment.label,
      assigneeUserId: assignment.userId,
      dueDate: parsed.data.dueDate ? parseISO(parsed.data.dueDate) : null,
      notes: parsed.data.notes ?? null,
      blockedReason: parsed.data.blockedReason ?? null,
      sourceType: TaskSourceType.MANUAL,
      priority: parsed.data.priority,
      status: parsed.data.status,
      lastOpenStatus: parsed.data.status === TaskStatus.COMPLETE ? TaskStatus.NOT_STARTED : parsed.data.status,
      completedAt: parsed.data.status === TaskStatus.COMPLETE ? new Date() : null,
      sortOrder: nextSortOrder,
      templateTaskSnapshot: JSON.stringify({
        createdFrom: "manual",
        periodId: period.id,
      }),
    },
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.CREATED,
    entityType: AuditEntityType.TASK,
    entityId: task.id,
    entityLabel: task.title,
    clientId: period.clientId,
    periodInstanceId: period.id,
    taskInstanceId: task.id,
    metadata: {
      sourceType: task.sourceType,
      status: task.status,
    },
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${task.id}`);
  revalidatePath(`/periods/${period.id}`);
  revalidatePath("/periods");
  revalidatePath("/");
  redirect(`/tasks/${task.id}`);
}

export async function bulkUpdateTasksAction(formData: FormData) {
  const currentUser = await requireManagerOrAdmin();
  const taskIds = formData
    .getAll("taskIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (taskIds.length === 0) return;

  const assignee = optionalString(formData, "assignee");
  const assigneeUserId = optionalString(formData, "assigneeUserId");
  const statusValue = optionalString(formData, "status") as TaskStatus | undefined;
  const dueDateValue = optionalString(formData, "dueDate");

  const updates: {
    assignee?: string | null;
    assigneeUserId?: string | null;
    status?: TaskStatus;
    completedAt?: Date | null;
    dueDate?: Date | null;
  } = {};

  if (assigneeUserId || assignee) {
    const assignment = await resolveUserChoice(assigneeUserId, assignee);
    updates.assignee = assignment.label;
    updates.assigneeUserId = assignment.userId;
  }

  if (dueDateValue) {
    updates.dueDate = parseISO(dueDateValue);
  }

  if (!statusValue && Object.keys(updates).length === 0) return;

  const selectedTasks = await prisma.taskInstance.findMany({
    where: { id: { in: taskIds } },
    select: {
      id: true,
      periodInstanceId: true,
      status: true,
      lastOpenStatus: true,
      periodInstance: { select: { clientId: true } },
    },
  });

  if (!isAdmin(currentUser)) {
    const accessibleClientIds = new Set(await accessibleClientIdsForUser(currentUser));
    if (selectedTasks.some((task) => !accessibleClientIds.has(task.periodInstance.clientId))) {
      throw new Error("You do not have access to update one or more selected tasks.");
    }
  }

  if (statusValue) {
    await prisma.$transaction(
      selectedTasks.map((task) =>
        prisma.taskInstance.update({
          where: { id: task.id },
          data:
            statusValue === TaskStatus.COMPLETE
              ? {
                  ...updates,
                  status: TaskStatus.COMPLETE,
                  lastOpenStatus:
                    task.status === TaskStatus.COMPLETE
                      ? task.lastOpenStatus ?? TaskStatus.NOT_STARTED
                      : task.status,
                  completedAt: new Date(),
                }
              : {
                  ...updates,
                  status: statusValue,
                  lastOpenStatus: statusValue,
                  completedAt: null,
                },
        }),
      ),
    );
  } else {
    await prisma.taskInstance.updateMany({
      where: { id: { in: taskIds } },
      data: updates,
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/periods");
  revalidatePath("/");

  for (const periodId of new Set(selectedTasks.map((task) => task.periodInstanceId))) {
    revalidatePath(`/periods/${periodId}`);
  }
}

export async function createTemplateAction(formData: FormData) {
  const currentUser = await requireAdmin();
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

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.CREATED,
    entityType: AuditEntityType.TEMPLATE,
    entityId: template.id,
    entityLabel: template.name,
  });

  revalidatePath("/templates");
  redirect(`/templates/${template.id}`);
}

export async function updateTemplateAction(formData: FormData) {
  const currentUser = await requireAdmin();
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

  const template = await prisma.workflowTemplate.update({
    where: { id },
    data: parsed.data,
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.UPDATED,
    entityType: AuditEntityType.TEMPLATE,
    entityId: template.id,
    entityLabel: template.name,
  });

  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
  revalidatePath("/");
}

export async function deleteTemplateAction(formData: FormData) {
  const currentUser = await requireAdmin();
  const id = stringValue(formData, "id");
  const template = await prisma.workflowTemplate.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true },
  });

  try {
    await prisma.workflowTemplate.delete({
      where: { id },
    });
  } catch {
    throw new Error("This template cannot be deleted because it is already tied to generated periods.");
  }

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.DELETED,
    entityType: AuditEntityType.TEMPLATE,
    entityId: template.id,
    entityLabel: template.name,
  });

  revalidatePath("/templates");
  revalidatePath("/clients");
  revalidatePath("/");
  redirect("/templates");
}

export async function assignTemplateToClientAction(formData: FormData) {
  const currentUser = await requireAdmin();
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

  const [client, template] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true } }),
    prisma.workflowTemplate.findUniqueOrThrow({ where: { id: templateId }, select: { name: true } }),
  ]);

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.ASSIGNED,
    entityType: AuditEntityType.TEMPLATE,
    entityId: templateId,
    entityLabel: template.name,
    clientId,
    metadata: {
      clientName: client.name,
      templateName: template.name,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

export async function removeTemplateAssignmentAction(formData: FormData) {
  const currentUser = await requireAdmin();
  const clientId = stringValue(formData, "clientId");
  const templateId = stringValue(formData, "templateId");

  const [client, template] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true } }),
    prisma.workflowTemplate.findUniqueOrThrow({ where: { id: templateId }, select: { name: true } }),
  ]);

  await prisma.clientTemplateAssignment.delete({
    where: {
      clientId_templateId: {
        clientId,
        templateId,
      },
    },
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.UNASSIGNED,
    entityType: AuditEntityType.TEMPLATE,
    entityId: templateId,
    entityLabel: template.name,
    clientId,
    metadata: {
      clientName: client.name,
      templateName: template.name,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

export async function createTemplateTaskAction(formData: FormData) {
  const currentUser = await requireAdmin();
  const templateId = stringValue(formData, "templateId");

  const parsed = templateTaskSchema.safeParse({
    title: stringValue(formData, "title"),
    description: optionalString(formData, "description"),
    category: optionalString(formData, "category"),
    defaultOwner: optionalString(formData, "defaultOwner"),
    defaultOwnerUserId: optionalString(formData, "defaultOwnerUserId"),
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

  const defaultOwner = await resolveUserChoice(parsed.data.defaultOwnerUserId, parsed.data.defaultOwner);

  const templateTask = await prisma.templateTask.create({
    data: {
      templateId,
      ...parsed.data,
      defaultOwner: defaultOwner.label,
      defaultOwnerUserId: defaultOwner.userId,
      dependencyTemplateTaskId: parsed.data.dependencyTemplateTaskId || null,
    },
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.CREATED,
    entityType: AuditEntityType.TEMPLATE_TASK,
    entityId: templateTask.id,
    entityLabel: templateTask.title,
    metadata: {
      templateId,
    },
  });

  revalidatePath(`/templates/${templateId}`);
  revalidatePath("/templates");
}

export async function updateTemplateTaskAction(formData: FormData) {
  const currentUser = await requireAdmin();
  const id = stringValue(formData, "id");
  const templateId = stringValue(formData, "templateId");

  const parsed = templateTaskSchema.safeParse({
    title: stringValue(formData, "title"),
    description: optionalString(formData, "description"),
    category: optionalString(formData, "category"),
    defaultOwner: optionalString(formData, "defaultOwner"),
    defaultOwnerUserId: optionalString(formData, "defaultOwnerUserId"),
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
    throw new Error(parsed.error.issues[0]?.message ?? "Could not update template task.");
  }

  const defaultOwner = await resolveUserChoice(parsed.data.defaultOwnerUserId, parsed.data.defaultOwner);

  const templateTask = await prisma.templateTask.update({
    where: { id },
    data: {
      ...parsed.data,
      defaultOwner: defaultOwner.label,
      defaultOwnerUserId: defaultOwner.userId,
      dependencyTemplateTaskId:
        parsed.data.dependencyTemplateTaskId && parsed.data.dependencyTemplateTaskId !== id
          ? parsed.data.dependencyTemplateTaskId
          : null,
    },
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.UPDATED,
    entityType: AuditEntityType.TEMPLATE_TASK,
    entityId: templateTask.id,
    entityLabel: templateTask.title,
    metadata: {
      templateId,
    },
  });

  revalidatePath(`/templates/${templateId}`);
  revalidatePath("/templates");
}

export async function deleteTemplateTaskAction(formData: FormData) {
  const currentUser = await requireAdmin();
  const id = stringValue(formData, "id");
  const templateId = stringValue(formData, "templateId");
  const templateTask = await prisma.templateTask.findUniqueOrThrow({
    where: { id },
    select: { id: true, title: true },
  });

  await prisma.$transaction([
    prisma.templateTask.updateMany({
      where: { dependencyTemplateTaskId: id },
      data: { dependencyTemplateTaskId: null },
    }),
    prisma.templateTask.delete({
      where: { id },
    }),
  ]);

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.DELETED,
    entityType: AuditEntityType.TEMPLATE_TASK,
    entityId: templateTask.id,
    entityLabel: templateTask.title,
    metadata: {
      templateId,
    },
  });

  revalidatePath(`/templates/${templateId}`);
  revalidatePath("/templates");
}

export async function createPeriodAction(formData: FormData) {
  const parsed = periodGenerationSchema.safeParse({
    clientId: stringValue(formData, "clientId"),
    templateId: optionalString(formData, "templateId"),
    label: stringValue(formData, "label"),
    periodKey: stringValue(formData, "periodKey"),
    periodStart: stringValue(formData, "periodStart"),
    periodEnd: stringValue(formData, "periodEnd"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not create period.");
  }

  const currentUser = await requireClientManagementAccess(parsed.data.clientId);

  const period = parsed.data.templateId
    ? await generatePeriodInstance({
        clientId: parsed.data.clientId,
        templateId: parsed.data.templateId,
        label: parsed.data.label,
        periodKey: parsed.data.periodKey,
        periodStart: parseISO(parsed.data.periodStart),
        periodEnd: parseISO(parsed.data.periodEnd),
      })
    : await createManualPeriodInstance({
        clientId: parsed.data.clientId,
        label: parsed.data.label,
        periodKey: parsed.data.periodKey,
        periodStart: parseISO(parsed.data.periodStart),
        periodEnd: parseISO(parsed.data.periodEnd),
      });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.CREATED,
    entityType: AuditEntityType.PERIOD,
    entityId: period.id,
    entityLabel: period.label,
    clientId: period.clientId,
    periodInstanceId: period.id,
    metadata: {
      workflowType: period.workflowType,
      templateId: period.templateId,
    },
  });

  revalidatePath("/periods");
  revalidatePath("/");
  redirect(`/periods/${period.id}`);
}

export async function createSuggestedPeriodAction(formData: FormData) {
  const clientId = stringValue(formData, "clientId");
  const templateId = stringValue(formData, "templateId");
  const basisDateRaw = stringValue(formData, "basisDate");

  if (!clientId) {
    throw new Error("Choose a client.");
  }

  if (!templateId) {
    throw new Error("Choose a template.");
  }

  if (!basisDateRaw) {
    throw new Error("Basis date is required.");
  }

  const currentUser = await requireClientManagementAccess(clientId);

  const basisDate = parseISO(basisDateRaw);

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

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.CREATED,
    entityType: AuditEntityType.PERIOD,
    entityId: period.id,
    entityLabel: period.label,
    clientId: period.clientId,
    periodInstanceId: period.id,
    metadata: {
      workflowType: period.workflowType,
      templateId: period.templateId,
      generatedFrom: "suggested",
    },
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
  const currentUser = await requireClientManagementAccess(sourcePeriod.clientId);

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

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.ROLLED_FORWARD,
    entityType: AuditEntityType.PERIOD,
    entityId: period.id,
    entityLabel: period.label,
    clientId: period.clientId,
    periodInstanceId: period.id,
    metadata: {
      sourcePeriodId: sourcePeriod.id,
      sourcePeriodLabel: sourcePeriod.label,
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

  const currentPeriod = await prisma.periodInstance.findUniqueOrThrow({
    where: { id },
    select: { id: true, label: true, status: true, clientId: true },
  });
  const currentUser = await requireClientManagementAccess(currentPeriod.clientId);

  await prisma.periodInstance.update({
    where: { id },
    data: { status: status as never },
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.STATUS_CHANGED,
    entityType: AuditEntityType.PERIOD,
    entityId: currentPeriod.id,
    entityLabel: currentPeriod.label,
    clientId: currentPeriod.clientId,
    periodInstanceId: currentPeriod.id,
    metadata: {
      from: currentPeriod.status,
      to: status,
    },
  });

  revalidatePath(`/periods/${id}`);
  revalidatePath("/periods");
  revalidatePath("/");
}

export async function togglePeriodArchiveAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const currentStatus = stringValue(formData, "currentStatus");
  const nextStatus = currentStatus === "ARCHIVED" ? "OPEN" : "ARCHIVED";

  const period = await prisma.periodInstance.findUniqueOrThrow({
    where: { id },
    select: { id: true, label: true, clientId: true },
  });
  const currentUser = await requireClientManagementAccess(period.clientId);

  await prisma.periodInstance.update({
    where: { id },
    data: { status: nextStatus as never },
  });

  await createAuditLog({
    user: currentUser,
    actionType: currentStatus === "ARCHIVED" ? AuditActionType.RESTORED : AuditActionType.ARCHIVED,
    entityType: AuditEntityType.PERIOD,
    entityId: period.id,
    entityLabel: period.label,
    clientId: period.clientId,
    periodInstanceId: period.id,
  });

  revalidatePath("/periods");
  revalidatePath(`/periods/${id}`);
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function deletePeriodAction(formData: FormData) {
  const id = stringValue(formData, "id");

  const period = await prisma.periodInstance.findUnique({
    where: { id },
    select: {
      id: true,
      label: true,
      clientId: true,
      sourcePeriodId: true,
      taskInstances: {
        select: { id: true },
      },
    },
  });

  if (!period) {
    throw new Error("Period not found.");
  }
  const currentUser = await requireClientManagementAccess(period.clientId);

  const taskIds = period.taskInstances.map((task) => task.id);

  await prisma.$transaction(async (tx) => {
    if (taskIds.length > 0) {
      await tx.taskInstance.updateMany({
        where: {
          carryforwardFromTaskId: { in: taskIds },
        },
        data: {
          carryforwardFromTaskId: null,
        },
      });

      await tx.taskInstance.updateMany({
        where: {
          dependencyTaskId: { in: taskIds },
        },
        data: {
          dependencyTaskId: null,
        },
      });
    }

    await tx.periodInstance.updateMany({
      where: { sourcePeriodId: id },
      data: { sourcePeriodId: null },
    });

    await tx.pBCRequestItem.deleteMany({
      where: { periodInstanceId: id },
    });

    await tx.periodInstance.delete({
      where: { id },
    });
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.DELETED,
    entityType: AuditEntityType.PERIOD,
    entityId: period.id,
    entityLabel: period.label,
    clientId: period.clientId,
    periodInstanceId: period.id,
    metadata: {
      sourcePeriodId: period.sourcePeriodId,
    },
  });

  revalidatePath("/periods");
  revalidatePath(`/periods/${id}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  redirect("/periods");
}

export async function updateTaskStatusAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const periodId = stringValue(formData, "periodId");
  const status = stringValue(formData, "status") as TaskStatus;

  const task = await prisma.taskInstance.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      lastOpenStatus: true,
      periodInstance: { select: { clientId: true } },
    },
  });
  const currentUser = await requireClientAccess(task.periodInstance.clientId);

  await prisma.taskInstance.update({
    where: { id },
    data: {
      status,
      lastOpenStatus:
        status === TaskStatus.COMPLETE
          ? task.status === TaskStatus.COMPLETE
            ? task.lastOpenStatus ?? TaskStatus.NOT_STARTED
            : task.status
          : status,
      completedAt: status === TaskStatus.COMPLETE ? new Date() : null,
    },
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.STATUS_CHANGED,
    entityType: AuditEntityType.TASK,
    entityId: task.id,
    entityLabel: task.title,
    clientId: task.periodInstance.clientId,
    periodInstanceId: periodId,
    taskInstanceId: task.id,
    metadata: {
      from: task.status,
      to: status,
    },
  });

  revalidatePath(`/periods/${periodId}`);
  revalidatePath("/periods");
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function toggleTaskCompletionAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const periodId = stringValue(formData, "periodId");

  const task = await prisma.taskInstance.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      lastOpenStatus: true,
      periodInstance: { select: { clientId: true } },
    },
  });
  const currentUser = await requireClientAccess(task.periodInstance.clientId);

  const restoring = task.status === TaskStatus.COMPLETE;
  const restoredStatus = task.lastOpenStatus ?? TaskStatus.NOT_STARTED;

  await prisma.taskInstance.update({
    where: { id },
    data: restoring
      ? {
          status: restoredStatus,
          lastOpenStatus: restoredStatus,
          completedAt: null,
        }
      : {
          status: TaskStatus.COMPLETE,
          lastOpenStatus: task.status,
          completedAt: new Date(),
        },
  });

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.STATUS_CHANGED,
    entityType: AuditEntityType.TASK,
    entityId: task.id,
    entityLabel: task.title,
    clientId: task.periodInstance.clientId,
    periodInstanceId: periodId,
    taskInstanceId: task.id,
    metadata: {
      from: task.status,
      to: restoring ? restoredStatus : TaskStatus.COMPLETE,
    },
  });

  revalidatePath(`/periods/${periodId}`);
  revalidatePath("/periods");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/");
}

export async function updateTaskDetailsAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const periodId = stringValue(formData, "periodId");
  const task = await prisma.taskInstance.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      title: true,
      periodInstance: { select: { clientId: true } },
    },
  });
  const currentUser = await requireClientAccess(task.periodInstance.clientId);
  const assignment = await resolveUserChoice(
    optionalString(formData, "assigneeUserId"),
    optionalString(formData, "assignee"),
  );

  await prisma.taskInstance.update({
    where: { id },
    data: {
      assignee: assignment.label,
      assigneeUserId: assignment.userId,
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

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.UPDATED,
    entityType: AuditEntityType.TASK,
    entityId: task.id,
    entityLabel: task.title,
    clientId: task.periodInstance.clientId,
    periodInstanceId: periodId,
    taskInstanceId: task.id,
  });

  revalidatePath(`/periods/${periodId}`);
  revalidatePath("/periods");
}

export async function deleteTaskAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const periodId = stringValue(formData, "periodId");
  const task = await prisma.taskInstance.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      title: true,
      periodInstance: { select: { clientId: true } },
    },
  });
  const currentUser = await requireClientManagementAccess(task.periodInstance.clientId);

  await prisma.$transaction([
    prisma.taskInstance.updateMany({
      where: { carryforwardFromTaskId: id },
      data: { carryforwardFromTaskId: null },
    }),
    prisma.taskInstance.updateMany({
      where: { dependencyTaskId: id },
      data: { dependencyTaskId: null },
    }),
    prisma.taskInstance.delete({
      where: { id },
    }),
  ]);

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.DELETED,
    entityType: AuditEntityType.TASK,
    entityId: task.id,
    entityLabel: task.title,
    clientId: task.periodInstance.clientId,
    periodInstanceId: periodId,
    taskInstanceId: task.id,
  });

  revalidatePath("/tasks");
  revalidatePath(`/periods/${periodId}`);
  revalidatePath("/periods");
  revalidatePath("/");
}

export async function addTaskCommentAction(formData: FormData) {
  const user = await requireUser();
  const taskInstanceId = stringValue(formData, "taskInstanceId");
  const periodId = stringValue(formData, "periodId");
  const body = stringValue(formData, "body");

  if (!body) return;

  const task = await prisma.taskInstance.findUniqueOrThrow({
    where: { id: taskInstanceId },
    select: {
      id: true,
      title: true,
      periodInstance: { select: { clientId: true } },
    },
  });
  await requireClientAccess(task.periodInstance.clientId);

  await prisma.taskNote.create({
    data: { taskInstanceId, body, authorUserId: user.id },
  });

  await createAuditLog({
    user,
    actionType: AuditActionType.UPDATED,
    entityType: AuditEntityType.TASK,
    entityId: task.id,
    entityLabel: task.title,
    clientId: task.periodInstance.clientId,
    periodInstanceId: periodId,
    taskInstanceId: task.id,
    metadata: {
      added: "comment",
    },
  });

  revalidatePath(`/periods/${periodId}`);
}

export async function addEvidenceLinkAction(formData: FormData) {
  const user = await requireUser();
  const taskInstanceId = stringValue(formData, "taskInstanceId");
  const periodId = stringValue(formData, "periodId");
  const label = stringValue(formData, "label");
  const url = stringValue(formData, "url");

  if (!label || !url) return;

  const task = await prisma.taskInstance.findUniqueOrThrow({
    where: { id: taskInstanceId },
    select: {
      id: true,
      title: true,
      periodInstance: { select: { clientId: true } },
    },
  });
  await requireClientAccess(task.periodInstance.clientId);

  await prisma.evidenceLink.create({
    data: { taskInstanceId, label, url },
  });

  await createAuditLog({
    user,
    actionType: AuditActionType.UPDATED,
    entityType: AuditEntityType.TASK,
    entityId: task.id,
    entityLabel: task.title,
    clientId: task.periodInstance.clientId,
    periodInstanceId: periodId,
    taskInstanceId: task.id,
    metadata: {
      added: "evidenceLink",
      label,
    },
  });

  revalidatePath(`/periods/${periodId}`);
}

export async function uploadImportAction(formData: FormData) {
  const currentUser = await requireManagerOrAdmin();
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

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.CREATED,
    entityType: AuditEntityType.IMPORT_BATCH,
    entityId: batch.id,
    entityLabel: batch.fileName,
    metadata: {
      importType: batch.importType,
      status: batch.status,
    },
  });

  revalidatePath("/imports");
  redirect(`/imports/${batch.id}`);
}

export async function saveImportMappingAction(formData: FormData) {
  await requireManagerOrAdmin();
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
  const currentUser = await requireManagerOrAdmin();
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

  if (clientId) {
    await requireClientManagementAccess(clientId);
  }

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
        const owner = await findUserByOwnerLabel(row.normalized.owner);
        await tx.templateTask.create({
          data: {
            templateId: template.id,
            title: row.normalized.title ?? "",
            description: row.normalized.description,
            category: row.normalized.category,
            defaultOwner: row.normalized.owner,
            defaultOwnerUserId: owner?.id ?? null,
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
        const owner = await findUserByOwnerLabel(row.normalized.owner);
        await tx.taskInstance.create({
          data: {
            periodInstanceId,
            title: row.normalized.title ?? "",
            description: row.normalized.description,
            category: row.normalized.category,
            assignee: row.normalized.owner,
            assigneeUserId: owner?.id ?? null,
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

  await createAuditLog({
    user: currentUser,
    actionType: AuditActionType.IMPORTED,
    entityType: AuditEntityType.IMPORT_BATCH,
    entityId: batch.id,
    entityLabel: batch.fileName,
    clientId: clientId ?? undefined,
    periodInstanceId: periodInstanceId ?? undefined,
    metadata: {
      importType: batch.importType,
      validRows: validRows.length,
    },
  });

  revalidatePath("/imports");
  revalidatePath(`/imports/${batchId}`);
  revalidatePath("/templates");
  revalidatePath("/periods");
  revalidatePath("/");
}
