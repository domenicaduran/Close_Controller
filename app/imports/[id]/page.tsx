import { notFound } from "next/navigation";

import { commitImportBatchAction, saveImportMappingAction } from "@/app/actions";
import {
  accessibleClientIdsForUser,
  isAdmin,
  isManagerOrAdmin,
  requireUser,
} from "@/lib/auth";
import { getImportFields } from "@/lib/import-config";
import { prisma } from "@/lib/prisma";
import { Button, Field, Input, PageHeader, Panel, Select, StatusBadge } from "@/components/ui";

function parseRowValidation(json: string | null) {
  if (!json) {
    return {
      valid: false,
      ignored: false,
      errors: [] as string[],
      mapped: {} as Record<string, string>,
    };
  }

  return JSON.parse(json) as {
    valid: boolean;
    ignored: boolean;
    errors: string[];
    mapped: Record<string, string>;
  };
}

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await requireUser();
  if (!isManagerOrAdmin(currentUser)) notFound();
  const accessibleClientIds = await accessibleClientIdsForUser(currentUser);

  const [batch, clients, periods] = await Promise.all([
    prisma.importBatch.findUnique({
      where: { id },
      include: { rows: { orderBy: { rowNumber: "asc" } } },
    }),
    prisma.client.findMany({
      where: {
        isArchived: false,
        ...(isAdmin(currentUser) ? {} : { id: { in: accessibleClientIds } }),
      },
      orderBy: { name: "asc" },
    }),
    prisma.periodInstance.findMany({
      where: isAdmin(currentUser) ? undefined : { clientId: { in: accessibleClientIds } },
      include: { client: true },
      orderBy: { periodStart: "desc" },
    }),
  ]);

  if (!batch) notFound();
  if (!isAdmin(currentUser) && batch.clientId && !accessibleClientIds.includes(batch.clientId)) notFound();

  const filteredPresets = await prisma.importMappingPreset.findMany({
    where: {
      importType: batch.importType,
    },
    orderBy: [{ lastUsedAt: "desc" }, { name: "asc" }],
  });

  const mapping = JSON.parse(batch.columnMappingJson ?? "{}") as Record<string, string>;
  const validationErrors = JSON.parse(batch.validationJson ?? "[]") as string[];
  const fields = getImportFields(batch.importType);
  const previewRows = batch.rows.map((row) => {
    const original = JSON.parse(row.rawJson) as Record<string, string>;
    const normalized = JSON.parse(row.normalizedJson ?? "{}") as Record<string, string | null>;
    const validation = parseRowValidation(row.validationJson);

    return {
      id: row.id,
      rowNumber: row.rowNumber,
      original,
      normalized,
      validation,
    };
  });

  const headers = Array.from(
    previewRows.reduce((set, row) => {
      Object.keys(row.original).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const validRows = previewRows.filter((row) => row.validation.valid && !row.validation.ignored).length;
  const ignoredRows = previewRows.filter((row) => row.validation.ignored).length;

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={batch.fileName}
        description="Review original source rows, inspect mapped values, resolve validation issues, and commit the validated import."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Mapping Workspace" subtitle="Map source columns, apply a saved preset, and save this mapping for reuse later.">
          <form action={saveImportMappingAction} className="grid gap-4">
            <input type="hidden" name="batchId" value={batch.id} />

            <Field label="Apply saved mapping">
              <Select name="applyPresetId" defaultValue="">
                <option value="">No preset</option>
                {filteredPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </Select>
            </Field>

            {fields.map(([field, label]) => (
              <Field key={field} label={label}>
                <Select name={`map:${field}`} defaultValue={mapping[field] ?? ""}>
                  <option value="">Ignore column</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}

            <Field label="Save mapping preset as">
              <Input name="presetName" placeholder="Monthly close export layout" />
            </Field>

            <Button type="submit">Revalidate Mapping</Button>
          </form>
        </Panel>

        <Panel title="Commit Import" subtitle="Write only validated rows into the selected target.">
          <form action={commitImportBatchAction} className="grid gap-4">
            <input type="hidden" name="batchId" value={batch.id} />

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Rows</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{previewRows.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Valid</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{validRows}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ignored Blank</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{ignoredRows}</p>
              </div>
            </div>

            <Field label="Client">
              <Select name="clientId" defaultValue="">
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </Field>

            {batch.importType !== "TEMPLATE" ? (
              <Field label="Target period">
                <Select name="periodInstanceId" defaultValue="">
                  <option value="">Select period</option>
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.client.name} - {period.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {batch.importType === "TEMPLATE" ? (
              <>
                <Field label="Template name">
                  <Input name="templateName" placeholder="Imported Month-End Checklist" />
                </Field>
                <Field label="Workflow type">
                  <Select name="workflowType" defaultValue="MONTH_END">
                    <option value="MONTH_END">Month-End Close</option>
                    <option value="QUARTER_END">Quarter-End Close</option>
                    <option value="YEAR_END">Year-End Close</option>
                    <option value="AUDIT_PBC">Audit PBC</option>
                    <option value="TAX">Monthly Tax</option>
                    <option value="ONE_OFF">One-Off Project</option>
                  </Select>
                </Field>
                <Field label="Recurrence">
                  <Select name="recurrenceType" defaultValue="MONTHLY">
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="ONE_TIME">One-Time</option>
                  </Select>
                </Field>
              </>
            ) : null}

            {validationErrors.length > 0 ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <p className="font-semibold">Resolve validation issues before import commit:</p>
                <ul className="mt-2 list-disc pl-5">
                  {validationErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                All non-blank rows validate successfully and are ready to import.
              </div>
            )}

            <Button type="submit" disabled={validationErrors.length > 0 || batch.status === "COMMITTED"}>
              {batch.status === "COMMITTED" ? "Already Committed" : "Commit Validated Rows"}
            </Button>
          </form>
        </Panel>
      </div>

      <Panel title="Preview Grid" subtitle="Original row values, mapped values, and row-level validation side by side.">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Row</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Original Row</th>
                <th className="px-4 py-3 font-medium">Mapped Values</th>
                <th className="px-4 py-3 font-medium">Errors</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200 align-top text-slate-700">
                  <td className="px-4 py-4 font-semibold text-slate-950">{row.rowNumber}</td>
                  <td className="px-4 py-4">
                    {row.validation.ignored ? (
                      <StatusBadge status="IGNORED" />
                    ) : row.validation.valid ? (
                      <StatusBadge status="COMPLETE" />
                    ) : (
                      <StatusBadge status="BLOCKED" />
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      {Object.entries(row.original).map(([key, value]) => (
                        <div key={key} className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{key}</p>
                          <p className="mt-1 text-sm text-slate-800">{value || "-"}</p>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      {fields.map(([field, label]) => (
                        <div key={field} className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{label}</p>
                          <p className="mt-1 text-sm text-slate-800">
                            {row.normalized[field] ?? row.validation.mapped[field] ?? "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {row.validation.ignored ? (
                      <p className="text-sm text-slate-500">Blank row ignored.</p>
                    ) : row.validation.errors.length === 0 ? (
                      <p className="text-sm text-emerald-700">No errors.</p>
                    ) : (
                      <ul className="space-y-2 text-sm text-rose-700">
                        {row.validation.errors.map((error) => (
                          <li key={error} className="rounded-xl bg-rose-50 px-3 py-2">
                            {error}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
