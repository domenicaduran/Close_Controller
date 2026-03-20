import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addEvidenceLinkAction,
  addTaskCommentAction,
  deleteTaskAction,
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
  buttonStyles,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [task, users] = await Promise.all([
    prisma.taskInstance.findUnique({
      where: { id },
      include: {
        periodInstance: {
          include: {
            client: true,
            template: true,
          },
        },
        comments: {
          include: { authorUser: true },
          orderBy: { createdAt: "desc" },
        },
        evidenceLinks: true,
        carryforwardFromTask: true,
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!task) notFound();

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={task.title}
        description={`${task.periodInstance.client.name} · ${task.periodInstance.label} · ${task.periodInstance.template.name}`}
        action={
          <div className="flex gap-2">
            <Link
              href={`/periods/${task.periodInstance.id}`}
              className={buttonStyles("secondary")}
            >
              Open Period
            </Link>
            <Link
              href="/tasks"
              className={buttonStyles("secondary")}
            >
              Back to Tasks
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <Panel title="Task Summary" subtitle="Use this page to manage just this task without working inside the full period checklist.">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={task.status} />
                <SourceBadge sourceType={task.sourceType} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-[#6B7280]">
                <p>Client: <span className="font-medium text-[#1F2937]">{task.periodInstance.client.name}</span></p>
                <p>Period: <span className="font-medium text-[#1F2937]">{task.periodInstance.label}</span></p>
                <p>Workflow: <span className="font-medium text-[#1F2937]">{task.periodInstance.template.name}</span></p>
                <p>Due: <span className="font-medium text-[#1F2937]">{formatDate(task.dueDate)}</span></p>
                <p>Priority: <span className="font-medium text-[#1F2937]">{task.priority}</span></p>
                <p>Source: <span className="font-medium text-[#1F2937]">{task.sourceType.replaceAll("_", " ")}</span></p>
              </div>
              {task.sourceType === "CARRYFORWARD" && task.carryforwardFromTaskId ? (
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#D97706]">
                  Carryforward from prior task {task.carryforwardFromTaskId.slice(0, 8)}
                </p>
              ) : null}
              {task.description ? (
                <p className="mt-4 text-sm leading-6 text-[#6B7280]">{task.description}</p>
              ) : null}
            </div>

            <form action={updateTaskStatusAction} className="grid gap-3">
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="periodId" value={task.periodInstance.id} />
              <Field label="Task status">
                <Select name="status" defaultValue={task.status}>
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="WAITING_ON_CLIENT">Waiting on Client</option>
                  <option value="COMPLETE">Complete</option>
                </Select>
              </Field>
              <Button type="submit">Save Status</Button>
            </form>

            <form action={deleteTaskAction}>
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="periodId" value={task.periodInstance.id} />
              <ClientActionButton
                actionLabel="Delete Task"
                variant="danger"
                confirmMessage="Delete this task? This will also remove related notes and evidence links. Carryforward and dependency references will be cleared."
              />
            </form>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Task Details" subtitle="Maintain assignee, timing, blockers, notes, and reviewer information for this task only.">
            <form action={updateTaskDetailsAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="periodId" value={task.periodInstance.id} />
              <Field label="Assigned teammate">
                <Select name="assigneeUserId" defaultValue={task.assigneeUserId ?? ""}>
                  <option value="">No linked teammate</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Owner label">
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
          </Panel>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Task Notes" subtitle="Capture follow-up, reviewer comments, and client communication.">
              <form action={addTaskCommentAction} className="grid gap-3">
                <input type="hidden" name="taskInstanceId" value={task.id} />
                <input type="hidden" name="periodId" value={task.periodInstance.id} />
                <Field label="Add note">
                  <TextArea name="body" placeholder="Document review notes, blockers, or follow-up." />
                </Field>
                <Button type="submit" variant="secondary">
                  Add Note
                </Button>
              </form>

              {task.comments.length > 0 ? (
                <div className="mt-4 space-y-3 text-sm text-[#6B7280]">
                  {task.comments.map((comment) => (
                    <div key={comment.id} className="rounded-xl border border-[#E5E7EB] px-3 py-3">
                      <p>{comment.body}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">
                        {(comment.authorUser?.name ?? "Team note")} · {formatDateTime(comment.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </Panel>

            <Panel title="Evidence Links" subtitle="Track supporting files, folders, and review workpapers.">
              <form action={addEvidenceLinkAction} className="grid gap-3">
                <input type="hidden" name="taskInstanceId" value={task.id} />
                <input type="hidden" name="periodId" value={task.periodInstance.id} />
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

              {task.evidenceLinks.length > 0 ? (
                <div className="mt-4 space-y-2 text-sm">
                  {task.evidenceLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      className="block rounded-xl border border-[#E5E7EB] px-3 py-3 text-[#374151]"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="font-semibold text-[#1F2937]">{link.label}</span>
                      <span className="mt-1 block text-xs text-[#6B7280]">{link.url}</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </Panel>
          </div>
        </div>
      </div>
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
