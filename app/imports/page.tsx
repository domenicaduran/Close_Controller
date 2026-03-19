import Link from "next/link";

import { uploadImportAction } from "@/app/actions";
import { Button, Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function ImportsPage() {
  const batches = await prisma.importBatch.findMany({
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Imports"
        description="Upload CSV or XLSX close schedules, PBC lists, or one-off task lists and preview the mapped results before commit."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Upload Import File" subtitle="The parser reads the first sheet and prepares a mapping preview.">
          <form action={uploadImportAction} className="grid gap-4">
            <Field label="Import type">
              <Select name="importType" defaultValue="TASK_BATCH">
                <option value="TASK_BATCH">Create one-time task batch</option>
                <option value="TEMPLATE">Create reusable template</option>
                <option value="PBC_ITEMS">Create audit PBC items</option>
              </Select>
            </Field>
            <Field label="CSV or XLSX file">
              <Input name="file" type="file" accept=".csv,.xlsx,.xls" required />
            </Field>
            <Button type="submit">Upload and Preview</Button>
          </form>
        </Panel>

        <Panel title="Import History" subtitle="Recent preview, validation, and commit activity.">
          <div className="space-y-3">
            {batches.map((batch) => (
              <Link
                key={batch.id}
                href={`/imports/${batch.id}`}
                className="block rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#CBD5E1] hover:bg-[#FCFCFD]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#1F2937]">{batch.fileName}</p>
                    <p className="mt-1 text-sm text-[#6B7280]">
                      {batch.importType.replaceAll("_", " ")} - {batch.status}
                    </p>
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">
                    {formatDateTime(batch.createdAt)}
                  </p>
                </div>
                <p className="mt-3 text-sm text-[#6B7280]">
                  Target client: {batch.client?.name ?? "Not assigned yet"}
                </p>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
