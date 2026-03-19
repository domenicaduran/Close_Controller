import { notFound } from "next/navigation";

import {
  assignTemplateToClientAction,
  createSuggestedPeriodAction,
  removeTemplateAssignmentAction,
  toggleClientArchiveAction,
  updateClientAction,
} from "@/app/actions";
import { Button, Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [client, templates] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        templateAssignments: {
          include: { template: true },
          orderBy: { createdAt: "desc" },
        },
        periodInstances: {
          include: { template: true },
          orderBy: { periodStart: "desc" },
          take: 10,
        },
      },
    }),
    prisma.workflowTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!client) notFound();

  const assignedTemplateIds = new Set(client.templateAssignments.map((assignment) => assignment.templateId));

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={client.name}
        description="Manage client profile details, assigned templates, and recent workflow periods."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Client Profile" subtitle="Edit practical operating details for this client.">
          <div className="grid gap-4">
            <form action={updateClientAction} className="grid gap-4">
              <input type="hidden" name="id" value={client.id} />
              <Field label="Client name">
                <Input name="name" defaultValue={client.name} required />
              </Field>
              <Field label="Code">
                <Input name="code" defaultValue={client.code ?? ""} />
              </Field>
              <Field label="Industry">
                <Input name="industry" defaultValue={client.industry ?? ""} />
              </Field>
              <Field label="Primary contact">
                <Input name="primaryContact" defaultValue={client.primaryContact ?? ""} />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" defaultValue={client.email ?? ""} />
              </Field>
              <div>
                <Button type="submit">Save Client</Button>
              </div>
            </form>
            <form action={toggleClientArchiveAction}>
              <input type="hidden" name="id" value={client.id} />
              <input type="hidden" name="isArchived" value={String(client.isArchived)} />
              <Button type="submit" variant="secondary">
                {client.isArchived ? "Restore Client" : "Archive Client"}
              </Button>
            </form>
          </div>
        </Panel>

        <Panel title="Template Assignment" subtitle="Attach reusable workflows to this client.">
          <form action={assignTemplateToClientAction} className="flex gap-3">
            <input type="hidden" name="clientId" value={client.id} />
            <select
              name="templateId"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              {templates
                .filter((template) => !assignedTemplateIds.has(template.id))
                .map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
            </select>
            <Button type="submit">Assign</Button>
          </form>

          <div className="mt-5 space-y-3">
            {client.templateAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div>
                  <p className="font-semibold text-slate-950">{assignment.template.name}</p>
                  <p className="text-sm text-slate-600">
                    {assignment.template.workflowType.replaceAll("_", " ")} ·{" "}
                    {assignment.template.recurrenceType.replaceAll("_", " ")}
                  </p>
                </div>
                <form action={removeTemplateAssignmentAction}>
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="templateId" value={assignment.template.id} />
                  <button
                    type="submit"
                    className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Create Period"
        subtitle="Generate a new workflow period for this client directly from the assigned template list."
      >
        <form action={createSuggestedPeriodAction} className="grid gap-4 md:grid-cols-3">
          <input type="hidden" name="clientId" value={client.id} />
          <Field label="Assigned template">
            <Select name="templateId" defaultValue="">
              <option value="">Select template</option>
              {client.templateAssignments.map((assignment) => (
                <option key={assignment.template.id} value={assignment.template.id}>
                  {assignment.template.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Basis date">
            <Input name="basisDate" type="date" required />
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Create Period
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title="Recent Periods" subtitle="Historical snapshots remain available even after rollforward.">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Template</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">End</th>
              </tr>
            </thead>
            <tbody>
              {client.periodInstances.map((period) => (
                <tr key={period.id} className="border-t border-slate-200 text-slate-700">
                  <td className="px-4 py-3 font-semibold text-slate-950">{period.label}</td>
                  <td className="px-4 py-3">{period.template.name}</td>
                  <td className="px-4 py-3">{formatDate(period.periodStart)}</td>
                  <td className="px-4 py-3">{formatDate(period.periodEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
