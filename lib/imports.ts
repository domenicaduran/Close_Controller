import { ImportType, PBCRequestStatus, Priority, RecurrenceType } from "@prisma/client";
import { parse as parseDateFns, parseISO, isValid } from "date-fns";
import * as XLSX from "xlsx";
import { z } from "zod";

const taskFieldSynonyms: Record<string, string[]> = {
  title: ["task", "item", "checklist item", "description", "task title"],
  description: ["details", "task description", "notes description"],
  category: ["category", "area", "section"],
  owner: ["owner", "assigned to", "preparer", "assignee"],
  dueDate: ["due", "due date", "deadline"],
  dueDay: ["due day", "day of month"],
  recurrence: ["recurrence", "frequency"],
  dependency: ["dependency", "depends on", "predecessor"],
  notes: ["notes", "comments", "memo"],
  priority: ["priority", "importance"],
};

const pbcFieldSynonyms: Record<string, string[]> = {
  requestNumber: ["pbc", "pbc #", "request #", "item #", "request number"],
  description: ["requested item", "description", "item"],
  requestedFrom: ["owner/contact", "requested from", "contact", "owner"],
  requestedDate: ["requested date", "date requested"],
  receivedDate: ["received date", "date received"],
  status: ["status", "pbc status"],
  notes: ["notes", "comments"],
};

const requiredFieldByImportType: Record<ImportType, string[]> = {
  TEMPLATE: ["title"],
  TASK_BATCH: ["title"],
  PBC_ITEMS: ["description"],
};

const taskImportSchema = z.object({
  title: z.string().trim().min(1, "Task title is required."),
  description: z.string().optional(),
  category: z.string().optional(),
  owner: z.string().optional(),
  dueDate: z.string().optional(),
  dueDay: z.string().optional(),
  recurrence: z.string().optional(),
  dependency: z.string().optional(),
  notes: z.string().optional(),
  priority: z.string().optional(),
});

const pbcImportSchema = z.object({
  requestNumber: z.string().optional(),
  description: z.string().trim().min(1, "Requested item is required."),
  requestedFrom: z.string().optional(),
  requestedDate: z.string().optional(),
  receivedDate: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export type ParsedImport = {
  headers: string[];
  rows: Record<string, string>[];
  headerSignature: string;
};

export type TolerantDateResult = {
  parsed: Date | null;
  isoValue: string | null;
  error: string | null;
};

export type ImportRowValidation = {
  rowNumber: number;
  original: Record<string, string>;
  mapped: Record<string, string>;
  normalized: Record<string, string | null>;
  valid: boolean;
  ignored: boolean;
  errors: string[];
};

export type ImportValidationResult = {
  mapping: Record<string, string>;
  errors: string[];
  rowResults: ImportRowValidation[];
  validRowCount: number;
  ignoredRowCount: number;
};

const MIN_IMPORT_YEAR = 2000;
const MAX_IMPORT_YEAR = 2100;

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function buildHeaderSignature(headers: string[]) {
  return headers.map(normalizeHeader).sort().join("|");
}

function sanitizeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r?\n/g, " ").trim();
}

function isPlausibleImportDate(date: Date) {
  const year = date.getUTCFullYear();
  return year >= MIN_IMPORT_YEAR && year <= MAX_IMPORT_YEAR;
}

function excelSerialToDate(serial: number) {
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;

  const date = new Date(
    Date.UTC(
      parsed.y,
      Math.max(0, (parsed.m ?? 1) - 1),
      parsed.d ?? 1,
      parsed.H ?? 0,
      parsed.M ?? 0,
      parsed.S ?? 0,
    ),
  );

  return isValid(date) ? date : null;
}

function isBlankRow(row: Record<string, string>) {
  return Object.values(row).every((value) => value.trim() === "");
}

export function parseSpreadsheet(_fileName: string, buffer: ArrayBuffer): ParsedImport {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: "",
  });

  const sanitizedRows = rows
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [String(key), sanitizeCell(value)]),
      ),
    )
    .filter((row) => !isBlankRow(row));

  const headers = Array.from(
    sanitizedRows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  return {
    headers,
    rows: sanitizedRows,
    headerSignature: buildHeaderSignature(headers),
  };
}

export function suggestMapping(headers: string[], importType: ImportType) {
  const synonymMap = importType === ImportType.PBC_ITEMS ? pbcFieldSynonyms : taskFieldSynonyms;
  const mapping: Record<string, string> = {};

  Object.entries(synonymMap).forEach(([field, synonyms]) => {
    const matchedHeader = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return synonyms.some((synonym) => normalized === synonym || normalized.includes(synonym));
    });

    if (matchedHeader) {
      mapping[field] = matchedHeader;
    }
  });

  return mapping;
}

export function parseTolerantDate(rawValue?: string | null): TolerantDateResult {
  const value = rawValue?.trim();
  if (!value) {
    return { parsed: null, isoValue: null, error: null };
  }

  if (/^\d+(\.\d+)?$/.test(value)) {
    const serial = Number(value);
    const excelDate = Number.isFinite(serial) ? excelSerialToDate(serial) : null;

    if (excelDate && isPlausibleImportDate(excelDate)) {
      return {
        parsed: excelDate,
        isoValue: excelDate.toISOString(),
        error: null,
      };
    }
  }

  const parsers = [
    () => parseISO(value),
    () => parseDateFns(value, "M/d/yyyy", new Date()),
    () => parseDateFns(value, "M/d/yy", new Date()),
    () => parseDateFns(value, "MM/dd/yyyy", new Date()),
    () => parseDateFns(value, "MM-dd-yyyy", new Date()),
    () => parseDateFns(value, "yyyy-MM-dd", new Date()),
    () => parseDateFns(value, "MMM d, yyyy", new Date()),
    () => parseDateFns(value, "MMMM d, yyyy", new Date()),
  ];

  for (const parser of parsers) {
    const parsed = parser();
    if (isValid(parsed) && isPlausibleImportDate(parsed)) {
      return {
        parsed,
        isoValue: parsed.toISOString(),
        error: null,
      };
    }
  }

  return {
    parsed: null,
    isoValue: null,
    error: `Invalid date value "${value}"`,
  };
}

function buildMappedRow(row: Record<string, string>, mapping: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(mapping).map(([field, header]) => [field, sanitizeCell(row[header] ?? "")]),
  );
}

export function validateImportRows(
  importType: ImportType,
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): ImportValidationResult {
  const errors: string[] = [];
  const requiredFields = requiredFieldByImportType[importType];

  for (const field of requiredFields) {
    if (!mapping[field]) {
      errors.push(`Missing required mapping for ${field}.`);
    }
  }

  const rowResults = rows.map((row, index) => {
    const rowNumber = index + 1;
    const mapped = buildMappedRow(row, mapping);

    if (isBlankRow(row)) {
      return {
        rowNumber,
        original: row,
        mapped,
        normalized: {},
        valid: true,
        ignored: true,
        errors: [],
      };
    }

    const schema = importType === ImportType.PBC_ITEMS ? pbcImportSchema : taskImportSchema;
    const result = schema.safeParse(mapped);
    const rowErrors: string[] = [];

    if (!result.success) {
      rowErrors.push(...result.error.issues.map((issue) => issue.message));
    }

    const normalized: Record<string, string | null> = {};
    for (const [field, value] of Object.entries(mapped)) {
      normalized[field] = value || null;
    }

    if (importType === ImportType.PBC_ITEMS) {
      const requestedDate = parseTolerantDate(mapped.requestedDate);
      const receivedDate = parseTolerantDate(mapped.receivedDate);

      normalized.requestedDate = requestedDate.isoValue;
      normalized.receivedDate = receivedDate.isoValue;

      if (requestedDate.error) rowErrors.push(requestedDate.error);
      if (receivedDate.error) rowErrors.push(receivedDate.error);
    } else {
      const dueDate = parseTolerantDate(mapped.dueDate);
      normalized.dueDate = dueDate.isoValue;
      if (dueDate.error) rowErrors.push(dueDate.error);

      if (mapped.dueDay) {
        const dueDay = Number(mapped.dueDay);
        if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
          rowErrors.push(`Invalid due day "${mapped.dueDay}"`);
        } else {
          normalized.dueDay = String(dueDay);
        }
      }
    }

    return {
      rowNumber,
      original: row,
      mapped,
      normalized,
      valid: rowErrors.length === 0,
      ignored: false,
      errors: rowErrors,
    };
  });

  const rowLevelErrors = rowResults.flatMap((row) =>
    row.errors.map((error) => `Row ${row.rowNumber}: ${error}`),
  );

  return {
    mapping,
    errors: [...errors, ...rowLevelErrors],
    rowResults,
    validRowCount: rowResults.filter((row) => row.valid && !row.ignored).length,
    ignoredRowCount: rowResults.filter((row) => row.ignored).length,
  };
}

export function normalizeRecurrence(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return RecurrenceType.MONTHLY;
  if (normalized.includes("quarter")) return RecurrenceType.QUARTERLY;
  if (normalized.includes("year")) return RecurrenceType.YEARLY;
  if (normalized.includes("one") || normalized.includes("ad hoc")) return RecurrenceType.ONE_TIME;
  return RecurrenceType.MONTHLY;
}

export function normalizePriority(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return Priority.MEDIUM;
  if (normalized.includes("critical")) return Priority.CRITICAL;
  if (normalized.includes("high")) return Priority.HIGH;
  if (normalized.includes("low")) return Priority.LOW;
  return Priority.MEDIUM;
}

export function normalizePBCStatus(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return PBCRequestStatus.NOT_REQUESTED;
  if (normalized.includes("clear")) return PBCRequestStatus.CLEARED;
  if (normalized.includes("review")) return PBCRequestStatus.UNDER_REVIEW;
  if (normalized.includes("received")) return PBCRequestStatus.RECEIVED;
  if (normalized.includes("requested")) return PBCRequestStatus.REQUESTED;
  return PBCRequestStatus.NOT_REQUESTED;
}
