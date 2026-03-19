import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addEvidenceLinkAction,
  addTaskCommentAction,
  deleteTaskAction,
  rollforwardPeriodAction,
  setPeriodStatusAction,
  updateTaskDetailsAction,
  updateTaskStatusAction,
} from "@/app/actions";
import { ClientActionButton } from "@/components/client-action-button";
import {
  Button,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
  TextArea,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { buildPeriodLabel, inferNextPeriod } from "@/lib/workflow";
import { prisma } from "@/lib/prisma";

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const period = await prisma.periodInstance.findUnique({
    where: { id },
    include: {
      client: true,
      template: true,
      sourcePeriod: true,
      taskInstances: {
        include: {
          comments: { orderBy: { createdAt: "desc" } },
          evidenceLinks: true,
          carryforwardFromTask: true,
        },
        orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }],
      },
      pbcRequestItems: {
        orderBy: [{ status: "asc" }, { requestNumber: "asc" }],
      },
    },
  });

  if (!period) notFound();

  const completion = period.taskInstances.length
    ? Math.round(
        (period.taskInstances.filter((task) => task.status === "COMPLETE").length /
          period.taskInstances.length) *
          100,
      )
    : 0;

  const suggestedNextPeriod = inferNextPeriod(period.template.recurrenceType, period.periodStart);
  const suggestedLabel = buildPeriodLabel(period.template, suggestedNextPeriod.periodStart);

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={period.label}
        description={`${period.client.name} - ${period.template.name} - Snapshot preserved at generation time.`}
      />

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Period Controls" subtitle="Create the next period with explicit dates and carryforward rules.">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Current status</p>
              <div className="mt-2">
                <StatusBadge status={period.status} />
              </div>
              <p className="mt-4 text-sm text-slate-600">Completion</p>
              <p className="mt-1 text-3xl font-semibold text-slate-950">{completion}%</p>
            </div>

            <form action={setPeriodStatusAction} className="grid gap-3">
              <input type="hidden" name="id" value={period.id} />
              <Field label="Update period status">
                <Select name="status" defaultValue={period.status}>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETE">Complete</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </Field>
              <Button type="submit">Save Status</Button>
            </form>

            <form action={rollforwardPeriodAction} className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <input type="hidden" name="periodId" value={period.id} />
              <Field label="Target period label">
                <Input name="label" defaultValue={suggestedLabel} required />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Target start date">
                  <Input
                    name="periodStart"
                    type="date"
                    defaultValue={suggestedNextPeriod.periodStart.toISOString().slice(0, 10)}
                    required
                  />
                </Field>
                <Field label="Target end date">
                  <Input
                    name="periodEnd"
                    type="date"
                    defaultValue={suggestedNextPeriod.periodEnd.toISOString().slice(0, 10)}
                    required
                  />
                </Field>
              </div>
              <div className="grid gap-3 rounded-2xl bg-white p-4 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="includeIncompleteTasks" defaultChecked />
                  Include incomplete tasks
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="copyNotesFlaggedAsCarryforward" defaultChecked />
                  Copy notes flagged as carryforward
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="includeBlockedItems" defaultChecked />
                  Include blocked items
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="excludeCompletedOneTimeTasks" defaultChecked />
                  Exclude completed one-time tasks
                </label>
              </div>
              <Button type="submit">Roll Forward</Button>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p>Start: {formatDate(period.periodStart)}</p>
              <p className="mt-1">End: {formatDate(period.periodEnd)}</p>
              <p className="mt-1">Generated: {formatDateTime(period.generatedAt)}</p>
              {period.sourcePeriod ? <p className="mt-1">Rolled from: {period.sourcePeriod.label}</p> : null}
            </div>
          </div>
        </Panel>

        <Panel title="Task Board" subtitle="This period controls the generated task set. Open any task to manage its details in a dedicated task workspace.">
          <div className="space-y-4">
            {period.taskInstances.map((task) => (
              <div key={task.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={`/tasks/${task.id}`} className="text-lg font-semibold text-slate-950 hover:text-[#2563EB]">
                        {task.title}
                      </Link>
                      <StatusBadge status={task.status} />
                      <SourceBadge sourceType={task.sourceType} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {task.category || "General"} - Due {formatDate(task.dueDate)}
                    </p>
                    {task.sourceType === "CARRYFORWARD" && task.carryforwardFromTaskId ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-amber-700">
                        Carryforward from prior task {task.carryforwardFromTaskId.slice(0, 8)}
                      </p>
                    ) : null}
                    {task.sourceType === "IMPORTED" ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-sky-700">
                        Imported task instance
                      </p>
                    ) : null}
                    {task.sourceType === "TEMPLATE_GENERATED" ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-emerald-700">
                        Normal generated task from active template
                      </p>
                    ) : null}
                    <Link href={`/tasks/${task.id}`} className="mt-3 inline-block text-sm font-semibold text-[#2563EB]">
                      Open Task Workspace
                    </Link>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <form action={updateTaskStatusAction} className="flex gap-2">
                      <input type="hidden" name="id" value={task.id} />
                      <input type="hidden" name="periodId" value={period.id} />
                      <Select name="status" defaultValue={task.status} className="min-w-44">
                        <option value="NOT_STARTED">Not Started</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="BLOCKED">Blocked</option>
                        <option value="WAITING_ON_CLIENT">Waiting on Client</option>
                        <option value="COMPLETE">Complete</option>
                      </Select>
                      <Button type="submit">Update</Button>
                    </form>
                    <form action={deleteTaskAction}>
                      <input type="hidden" name="id" value={task.id} />
                      <input type="hidden" name="periodId" value={period.id} />
                      <ClientActionButton
                        actionLabel="Delete Task"
                        variant="danger"
                        confirmMessage="Delete this task? This will also remove related notes and evidence links. Carryforward and dependency references will be cleared."
                      />
                    </form>
                  </div>
                </div>

                <form action={updateTaskDetailsAction} className="mt-4 grid gap-4 md:grid-cols-2">
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="periodId" value={period.id} />
                  <Field label="Assignee">
                    <Input name="assignee" defaultValue={task.assignee ?? ""} />
                  </Field>
                  <Field label="Priority">
                    <Select name="priority" defaultValue={task.priority}>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </Select>
                  </Field>
                  <Field label="Due date">
                    <Input
                      name="dueDate"
                      type="date"
                      defaultValue={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""}
                    />
                  </Field>
                  <Field label="Reviewer signoff">
                    <Input name="reviewerSignoff" defaultValue={task.reviewerSignoff ?? ""} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Blocked reason">
                      <Input name="blockedReason" defaultValue={task.blockedReason ?? ""} />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Notes">
                      <TextArea name="notes" defaultValue={task.notes ?? ""} />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit">Save Task Details</Button>
                  </div>
                </form>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <form action={addTaskCommentAction} className="grid gap-3 rounded-2xl bg-white p-4">
                    <input type="hidden" name="taskInstanceId" value={task.id} />
                    <input type="hidden" name="periodId" value={period.id} />
                    <Field label="Add note">
                      <TextArea name="body" placeholder="Document review notes, blockers, or follow-up." />
                    </Field>
                    <Button type="submit" variant="secondary">
                      Add Note
                    </Button>
                  </form>

                  <form action={addEvidenceLinkAction} className="grid gap-3 rounded-2xl bg-white p-4">
                    <input type="hidden" name="taskInstanceId" value={task.id} />
                    <input type="hidden" name="periodId" value={period.id} />
                    <Field label="Evidence label">
                      <Input name="label" placeholder="Cash rec workbook" />
                    </Field>
                    <Field label="Evidence URL">
                      <Input name="url" placeholder="https://sharepoint/..." />
                    </Field>
                    <Button type="submit" variant="secondary">
                      Add Evidence Link
                    </Button>
                  </form>
                </div>

                {task.comments.length > 0 ? (
                  <div className="mt-4 rounded-2xl bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Notes</p>
                    <div className="mt-3 space-y-3 text-sm text-slate-600">
                      {task.comments.map((comment) => (
                        <div key={comment.id} className="rounded-xl border border-slate-200 px-3 py-3">
                          <p>{comment.body}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                            {formatDateTime(comment.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {task.evidenceLinks.length > 0 ? (
                  <div className="mt-4 rounded-2xl bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Evidence Links</p>
                    <div className="mt-3 space-y-2 text-sm">
                      {task.evidenceLinks.map((link) => (
                        <a
                          key={link.id}
                          href={link.url}
                          className="block rounded-xl border border-slate-200 px-3 py-3 text-slate-700"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className="font-semibold text-slate-950">{link.label}</span>
                          <span className="mt-1 block text-xs text-slate-500">{link.url}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {period.pbcRequestItems.length > 0 ? (
        <Panel title="Audit PBC Status" subtitle="PBC items tied to this client period.">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Request #</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Requested From</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {period.pbcRequestItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200 text-slate-700">
                    <td className="px-4 py-3">{item.requestNumber || "-"}</td>
                    <td className="px-4 py-3 font-medium text-slate-950">{item.description}</td>
                    <td className="px-4 py-3">{item.requestedFrom || "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function SourceBadge({ sourceType }: { sourceType: string }) {
  if (sourceType === "TEMPLATE_GENERATED") {
    return <span className="rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-semibold text-[#2563EB]">Generated</span>;
  }

  if (sourceType === "IMPORTED") {
    return <span className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1 text-[11px] font-semibold text-[#6B7280]">Imported</span>;
  }

  if (sourceType === "CARRYFORWARD") {
    return <span className="rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-2.5 py-1 text-[11px] font-semibold text-[#D97706]">Carryforward</span>;
  }

  return <span className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1 text-[11px] font-semibold text-[#6B7280]">{sourceType}</span>;
}
