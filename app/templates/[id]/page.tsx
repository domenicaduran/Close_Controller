import { notFound } from "next/navigation";

import { createTemplateTaskAction, updateTemplateAction } from "@/app/actions";
import { Button, Field, Input, PageHeader, Panel, Select, TextArea } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await prisma.workflowTemplate.findUnique({
    where: { id },
    include: {
      tasks: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!template) notFound();

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={template.name}
        description="Edit the template definition and maintain the reusable checklist task set."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <Panel title="Template Settings" subtitle="High-level controls used during period generation.">
          <form action={updateTemplateAction} className="grid gap-4">
            <input type="hidden" name="id" value={template.id} />
            <Field label="Template name">
              <Input name="name" defaultValue={template.name} required />
            </Field>
            <Field label="Workflow type">
              <Select name="workflowType" defaultValue={template.workflowType}>
                <option value="MONTH_END">Month-End Close</option>
                <option value="QUARTER_END">Quarter-End Close</option>
                <option value="YEAR_END">Year-End Close</option>
                <option value="AUDIT_PBC">Audit PBC</option>
                <option value="TAX">Monthly Tax</option>
                <option value="ONE_OFF">One-Off Project</option>
              </Select>
            </Field>
            <Field label="Recurrence">
              <Select name="recurrenceType" defaultValue={template.recurrenceType}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
                <option value="ONE_TIME">One-Time</option>
              </Select>
            </Field>
            <Field label="Description">
              <TextArea name="description" defaultValue={template.description ?? ""} />
            </Field>
            <Button type="submit">Save Template</Button>
          </form>
        </Panel>

        <Panel title="Add Template Task" subtitle="Define defaults, due rules, dependencies, and carryforward behavior.">
          <form action={createTemplateTaskAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="templateId" value={template.id} />
            <div className="md:col-span-2">
              <Field label="Task title">
                <Input name="title" placeholder="Reconcile cash accounts" required />
              </Field>
            </div>
            <Field label="Category">
              <Input name="category" placeholder="Cash" />
            </Field>
            <Field label="Default owner">
              <Input name="defaultOwner" placeholder="Domenica" />
            </Field>
            <Field label="Recurrence">
              <Select name="recurrenceType" defaultValue={template.recurrenceType}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
                <option value="ONE_TIME">One-Time</option>
              </Select>
            </Field>
            <Field label="Priority">
              <Select name="defaultPriority" defaultValue="MEDIUM">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </Field>
            <Field label="Due rule">
              <Select name="dueDateRuleType" defaultValue="NONE">
                <option value="NONE">None</option>
                <option value="DAY_OF_MONTH">Day of month</option>
                <option value="BUSINESS_DAY_OFFSET_FROM_PERIOD_END">Business day offset from period end</option>
                <option value="FIXED_CALENDAR_DATE">Fixed calendar date</option>
                <option value="OFFSET_FROM_PERIOD_START">Offset from period start</option>
              </Select>
            </Field>
            <Field label="Day of month">
              <Input name="dueDayOfMonth" type="number" placeholder="5" />
            </Field>
            <Field label="Business day offset">
              <Input name="businessDayOffset" type="number" placeholder="-2" />
            </Field>
            <Field label="Fixed month">
              <Input name="fixedMonth" type="number" placeholder="3" />
            </Field>
            <Field label="Fixed day">
              <Input name="fixedDay" type="number" placeholder="15" />
            </Field>
            <Field label="Offset from period start">
              <Input name="offsetFromPeriodStart" type="number" placeholder="3" />
            </Field>
            <Field label="Depends on">
              <Select name="dependencyTemplateTaskId" defaultValue="">
                <option value="">No dependency</option>
                {template.tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sort order">
              <Input name="sortOrder" type="number" defaultValue="0" />
            </Field>
            <Field label="Carryforward behavior">
              <Select name="carryforwardBehavior" defaultValue="SURFACE_IF_INCOMPLETE">
                <option value="NONE">None</option>
                <option value="SURFACE_IF_INCOMPLETE">Surface if incomplete</option>
                <option value="ALWAYS_CREATE">Always create</option>
                <option value="COPY_NOTES">Copy notes when carried forward</option>
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Description">
                <TextArea name="description" placeholder="What good completion looks like and any accounting context." />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="evidenceRequired" />
              Evidence required
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="reviewerRequired" />
              Reviewer signoff required
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" name="copyNotesForward" />
              Copy notes to carryforward tasks
            </label>
            <div className="md:col-span-2">
              <Button type="submit">Add Template Task</Button>
            </div>
          </form>
        </Panel>
      </div>

      <Panel title="Template Tasks" subtitle="Active checklist tasks are snapshotted into period instances at generation time.">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Due Rule</th>
                <th className="px-4 py-3 font-medium">Carryforward</th>
              </tr>
            </thead>
            <tbody>
              {template.tasks.map((task) => (
                <tr key={task.id} className="border-t border-slate-200 text-slate-700">
                  <td className="px-4 py-3">{task.sortOrder}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-950">{task.title}</p>
                    <p className="text-xs text-slate-500">{task.defaultOwner || "Unassigned"}</p>
                  </td>
                  <td className="px-4 py-3">{task.category || "General"}</td>
                  <td className="px-4 py-3">{task.dueDateRuleType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{task.carryforwardBehavior.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
