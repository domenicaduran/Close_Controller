import Link from "next/link";

import { createTemplateAction } from "@/app/actions";
import { Button, Field, Input, PageHeader, Panel, Select, TextArea } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export default async function TemplatesPage() {
  const templates = await prisma.workflowTemplate.findMany({
    include: {
      tasks: true,
      clientAssignments: true,
    },
    orderBy: [{ workflowType: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Templates"
        description="Build reusable recurring accounting workflows and assign them across clients."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <Panel title="Create Template" subtitle="Start with a workflow type and then add checklist tasks.">
          <form action={createTemplateAction} className="grid gap-4">
            <Field label="Template name">
              <Input name="name" placeholder="Standard Month-End Close" required />
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
            <Field label="Description">
              <TextArea
                name="description"
                placeholder="Used for recurring close work with preserved history and clear due rules."
              />
            </Field>
            <Button type="submit">Create Template</Button>
          </form>
        </Panel>

        <Panel title="Template Library" subtitle="Reusable process definitions for controller operations.">
          <div className="grid gap-4">
            {templates.map((template) => (
              <Link
                key={template.id}
                href={`/templates/${template.id}`}
                className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#CBD5E1] hover:bg-[#FCFCFD]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1F2937]">{template.name}</h3>
                    <p className="mt-1 text-sm text-[#6B7280]">
                      {template.workflowType.replaceAll("_", " ")} -{" "}
                      {template.recurrenceType.replaceAll("_", " ")}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-[11px] font-semibold text-[#6B7280]">
                    {template.tasks.length} tasks
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#6B7280]">
                  {template.description || "No description yet."}
                </p>
                <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">
                  Assigned to {template.clientAssignments.length} clients
                </p>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
