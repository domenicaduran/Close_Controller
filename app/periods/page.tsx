import Link from "next/link";

import { createPeriodAction, createSuggestedPeriodAction } from "@/app/actions";
import { Button, Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PeriodsPage() {
  const [clients, templates, periods] = await Promise.all([
    prisma.client.findMany({
      where: { isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.workflowTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.periodInstance.findMany({
      include: {
        client: true,
        template: true,
        taskInstances: true,
      },
      orderBy: { periodStart: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Periods"
        description="Generate monthly, quarterly, yearly, audit, or one-off workflow instances and roll them forward cleanly."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
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
      </div>

      <Panel title="Period Register" subtitle="All generated instances with template snapshots and completion metrics.">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Workflow</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => {
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
