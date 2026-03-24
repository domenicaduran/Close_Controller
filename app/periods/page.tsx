import Link from "next/link";

import {
  createPeriodAction,
  createSuggestedPeriodAction,
  deletePeriodAction,
  togglePeriodArchiveAction,
} from "@/app/actions";
import { ClientActionButton } from "@/components/client-action-button";
import { Button, Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import {
  accessibleClientIdsForUser,
  isAdmin,
  isManagerOrAdmin,
  requireUser,
} from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PeriodsPage() {
  const currentUser = await requireUser();
  const accessibleClientIds = await accessibleClientIdsForUser(currentUser);
  const [clients, templates, periods] = await Promise.all([
    prisma.client.findMany({
      where: {
        isArchived: false,
        ...(isAdmin(currentUser) ? {} : { id: { in: accessibleClientIds } }),
      },
      orderBy: { name: "asc" },
    }),
    prisma.workflowTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.periodInstance.findMany({
      where: isAdmin(currentUser) ? undefined : { clientId: { in: accessibleClientIds } },
      include: {
        client: true,
        template: true,
        taskInstances: true,
      },
      orderBy: [{ status: "asc" }, { periodStart: "desc" }],
    }),
  ]);

  const activePeriods = periods.filter((period) => period.status !== "ARCHIVED");
  const archivedPeriods = periods.filter((period) => period.status === "ARCHIVED");

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Periods"
        description="Generate monthly, quarterly, yearly, audit, or one-off workflow instances and roll them forward cleanly."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        {isManagerOrAdmin(currentUser) ? (
        <>
        <Panel title="Generate Period" subtitle="Use explicit period labels and dates when you need precise control.">
          <form action={createPeriodAction} className="grid gap-4 md:grid-cols-2">
            <Field label="Client">
              <Select name="clientId" required>
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Template Optional">
              <Select name="templateId" defaultValue="">
                <option value="">No template / manual period</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Period label">
              <Input name="label" placeholder="March 2026" required />
            </Field>
            <Field label="Period key">
              <Input name="periodKey" placeholder="2026-03" required />
            </Field>
            <Field label="Period start">
              <Input name="periodStart" type="date" required />
            </Field>
            <Field label="Period end">
              <Input name="periodEnd" type="date" required />
            </Field>
            <div className="md:col-span-2">
              <Button type="submit">Generate Period</Button>
            </div>
          </form>
        </Panel>

        <Panel title="Quick Generate" subtitle="Create the next standard period from a basis date and template recurrence.">
          <form action={createSuggestedPeriodAction} className="grid gap-4">
            <Field label="Client">
              <Select name="clientId" required>
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Template">
              <Select name="templateId" required>
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Basis date">
              <Input name="basisDate" type="date" required />
            </Field>
            <Button type="submit">Generate Suggested Period</Button>
          </form>
        </Panel>
        </>
        ) : (
        <Panel title="Periods" subtitle="View the accounting cycles assigned to your clients. Period generation and rollforward are manager-level actions.">
          <p className="text-sm leading-6 text-slate-600">
            Use the task workspace for day-to-day execution. Contact a manager or admin if a new period needs to be generated.
          </p>
        </Panel>
        )}
      </div>

      <Panel title="Period Register" subtitle="Current working periods stay visible here. Archived periods move below into a hidden section.">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Workflow</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activePeriods.map((period) => {
                const completeCount = period.taskInstances.filter((task) => task.status === "COMPLETE").length;
                return (
                  <tr key={period.id} className="border-t border-slate-200 text-slate-700">
                    <td className="px-4 py-3">
                      <Link href={`/periods/${period.id}`} className="font-semibold text-slate-950">
                        {period.label}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{period.client.name}</td>
                    <td className="px-4 py-3">{period.template.name === "Manual Period" ? "Manual / No Template" : period.template.name}</td>
                    <td className="px-4 py-3">
                      {formatDate(period.periodStart)} - {formatDate(period.periodEnd)}
                    </td>
                    <td className="px-4 py-3">
                      {completeCount}/{period.taskInstances.length} complete
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/periods/${period.id}`}
                          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#1F2937] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#CBD5E1] hover:bg-[#F9FAFB]"
                        >
                          Open
                        </Link>
                        {isManagerOrAdmin(currentUser) ? (
                          <>
                            <form action={togglePeriodArchiveAction}>
                              <input type="hidden" name="id" value={period.id} />
                              <input type="hidden" name="currentStatus" value={period.status} />
                              <ClientActionButton actionLabel="Archive" variant="warning" />
                            </form>
                            <form action={deletePeriodAction}>
                              <input type="hidden" name="id" value={period.id} />
                              <ClientActionButton
                                actionLabel="Delete"
                                variant="danger"
                                confirmMessage="Deleting this period will also delete its tasks, notes, evidence links, and PBC items. Later rolled-forward periods will remain, but their link back to this period will be removed. Continue?"
                              />
                            </form>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {activePeriods.length === 0 ? (
                <tr className="border-t border-slate-200">
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No active periods yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <details className="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#FCFCFD]">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#1F2937]">
            Archived Periods ({archivedPeriods.length})
          </summary>
          <div className="border-t border-[#E5E7EB]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Workflow</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Progress</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedPeriods.map((period) => {
                  const completeCount = period.taskInstances.filter((task) => task.status === "COMPLETE").length;
                  return (
                    <tr key={period.id} className="border-t border-slate-200 text-slate-700">
                      <td className="px-4 py-3">
                        <Link href={`/periods/${period.id}`} className="font-semibold text-slate-950">
                          {period.label}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{period.client.name}</td>
                      <td className="px-4 py-3">
                        {period.template.name === "Manual Period" ? "Manual / No Template" : period.template.name}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(period.periodStart)} - {formatDate(period.periodEnd)}
                      </td>
                      <td className="px-4 py-3">
                        {completeCount}/{period.taskInstances.length} complete
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/periods/${period.id}`}
                            className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#1F2937] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#CBD5E1] hover:bg-[#F9FAFB]"
                          >
                            Open
                          </Link>
                          {isManagerOrAdmin(currentUser) ? (
                            <>
                              <form action={togglePeriodArchiveAction}>
                                <input type="hidden" name="id" value={period.id} />
                                <input type="hidden" name="currentStatus" value={period.status} />
                                <ClientActionButton actionLabel="Restore" variant="neutral" />
                              </form>
                              <form action={deletePeriodAction}>
                                <input type="hidden" name="id" value={period.id} />
                                <ClientActionButton
                                  actionLabel="Delete"
                                  variant="danger"
                                  confirmMessage="Deleting this period will also delete its tasks, notes, evidence links, and PBC items. Later rolled-forward periods will remain, but their link back to this period will be removed. Continue?"
                                />
                              </form>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {archivedPeriods.length === 0 ? (
                  <tr className="border-t border-slate-200">
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      No archived periods.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </details>
      </Panel>
    </div>
  );
}
