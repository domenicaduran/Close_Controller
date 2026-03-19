import { ImportType } from "@prisma/client";

export const TASK_IMPORT_FIELDS = [
  ["title", "Task Title"],
  ["description", "Description"],
  ["category", "Category"],
  ["owner", "Owner"],
  ["dueDate", "Due Date"],
  ["dueDay", "Due Day"],
  ["recurrence", "Recurrence"],
  ["dependency", "Dependency"],
  ["notes", "Notes"],
  ["priority", "Priority"],
] as const;

export const PBC_IMPORT_FIELDS = [
  ["requestNumber", "PBC Number"],
  ["description", "Requested Item"],
  ["requestedFrom", "Requested From"],
  ["requestedDate", "Requested Date"],
  ["receivedDate", "Received Date"],
  ["status", "Status"],
  ["notes", "Notes"],
] as const;

export function getImportFields(importType: ImportType) {
  return importType === ImportType.PBC_ITEMS ? PBC_IMPORT_FIELDS : TASK_IMPORT_FIELDS;
}
