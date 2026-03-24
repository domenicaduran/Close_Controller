import "server-only";

import {
  AuditActionType,
  AuditEntityType,
  Prisma,
  type User,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

type AuditLogInput = {
  user?: Pick<User, "id" | "name"> | null;
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel?: string | null;
  clientId?: string | null;
  periodInstanceId?: string | null;
  taskInstanceId?: string | null;
  metadata?: Record<string, unknown> | null;
};

function buildPayload(input: AuditLogInput): Prisma.AuditLogUncheckedCreateInput {
  return {
    userId: input.user?.id ?? null,
    userNameSnapshot: input.user?.name ?? null,
    actionType: input.actionType,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel ?? null,
    clientId: input.clientId ?? null,
    periodInstanceId: input.periodInstanceId ?? null,
    taskInstanceId: input.taskInstanceId ?? null,
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
  };
}

export async function createAuditLog(input: AuditLogInput) {
  await prisma.auditLog.create({
    data: buildPayload(input),
  });
}

export function buildAuditLogData(input: AuditLogInput): Prisma.AuditLogUncheckedCreateInput {
  return buildPayload(input);
}
