import { TaskStatus } from "@prisma/client";
import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

import { createManualTaskAction, deleteTaskAction, updateTaskStatusAction } from "@/app/actions";
import { ClientActionButton } from "@/components/client-action-button";
import { Button, Field, Input, PageHeader, Panel, Select, StatusBadge, TextArea } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_SECTIONS = [
  {
    key: TaskStatus.NOT_STARTED,
    label: "Not Started",
    description: "Planned work that has not moved yet.",
  },
  {
    key: TaskStatus.IN_PROGRESS,
    label: "In Progress",
    description: "Active work currently being prepared or reviewed.",
  },
  {
    key: TaskStatus.WAITING_ON_CLIENT,
    label: "Waiting on Client",
    description: "Items paused pending client support, files, or answers.",
  },
  {
    key: TaskStatus.BLOCKED,
    label: "Blocked",
    description: "Items stopped by an internal blocker, dependency, or exception.",
  },
  {
    key: TaskStatus.COMPLETE,
    label: "Done",
    description: "Completed tasks stay visible here for operational context.",
  },
] as const;

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  category: string | null;
  dueDate: Date | null;
  assignee: string | null;
  sourceType: string;
  blockedReason: string | null;
  priority: string;
  periodInstance: {
    id: string;
    label: string;
    client: { id: string; name: string };
    template: { name: string };
  };
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; new?: string }>;
}) {
  const { view, new: newTask } = await searchParams;
  const selectedView = view === "flat" ? "flat" : "status";
  const showNewTaskForm = newTask === "1";

  const [tasks, periods] = await Promise.all([
    prisma.taskInstance.findMany({
      where: {
        periodInstance: {
          client: {
            isArchived: false,
          },
        },
      },
      include: {
        periodInstance: {
          include: {
            client: true,
            template: true,
          },
        },
      },
      orderBy: [
        { periodInstance: { client: { name: "asc" } } },
        { dueDate: "asc" },
        { sortOrder: "asc" },
        { updatedAt: "desc" },
      ],
    }),
    prisma.periodInstance.findMany({
      where: {
        status: { not: "ARCHIVED" },
        client: { isArchived: false },
      },
      include: {
        client: true,
        template: true,
      },
      orderBy: [
        { client: { name: "asc" } },
        { periodStart: "desc" },
      ],
    }),
  ]);

  const counts = new Map<TaskStatus, number>(
    STATUS_SECTIONS.map((section) => [
      section.key,
      tasks.filter((task) => task.status === section.key).length,
    ]),
  );

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Tasks"
        description="Manage work directly from this page. Use the checkmark circle to move a task into Done, or update its status in place and let it fall into the right section automatically."
        action={
          <div className="flex gap-2">
            <Link
              href={`/tasks?view=${selectedView}&new=1`}
              className="rounded-xl border border-[#2563EB] bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
            >
              New Task
            </Link>
            <Link
              href="/tasks"
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition ${
                selectedView === "status"
                  ? "border-[#2563EB] bg-[#2563EB] text-white"
                  : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F9FAFB]"
              }`}
            >
              By Status
            </Link>
            <Link
              href="/tasks?view=flat"
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition ${
                selectedView === "flat"
                  ? "border-[#2563EB] bg-[#2563EB] text-white"
                  : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F9FAFB]"
              }`}
            >
              Flat List
            </Link>
          </div>
        }
      />

      {showNewTaskForm ? (
        <Panel
          title="New Task"
          subtitle="Create a one-off manual task and tie it to the right client period."
        >
          <form action={createManualTaskAction} className="grid gap-4 md:grid-cols-2">
            <Field label="Client period">
              <Select name="periodInstanceId" defaultValue="">
                <option value="">Select client and period</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.client.name} - {period.label} - {period.template.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Task title">
              <Input name="title" placeholder="Prepare board reporting package" required />
            </Field>
            <Field label="Category">
              <Input name="category" placeholder="Reporting" />
            </Field>
            <Field label="Assignee">
              <Input name="assignee" placeholder="Domenica" />
            </Field>
            <Field label="Due date">
              <Input name="dueDate" type="date" />
            </Field>
            <Field label="Priority">
              <Select name="priority" defaultValue="MEDIUM">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue="NOT_STARTED">
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_ON_CLIENT">Waiting on Client</option>
                <option value="BLOCKED">Blocked</option>
                <option value="COMPLETE">Complete</option>
              </Select>
            </Field>
            <Field label="Blocked reason">
              <Input name="blockedReason" placeholder="Optional blocker detail" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Description">
                <TextArea name="description" placeholder="Context, expected output, or review objective." />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Notes">
                <TextArea name="notes" placeholder="Any setup notes or handoff detail for this task." />
              </Field>
            </div>
            <div className="flex gap-3 md:col-span-2">
              <Button type="submit">Create Task</Button>
              <Link
                href={`/tasks?view=${selectedView}`}
                className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#1F2937] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-[#F9FAFB]"
              >
                Cancel
              </Link>
            </div>
          </form>
        </Panel>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-5">
        {STATUS_SECTIONS.map((section) => (
          <div
            key={section.key}
            className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#1F2937]">{section.label}</p>
              <span className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-[11px] font-semibold text-[#6B7280]">
                {counts.get(section.key) ?? 0}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#6B7280]">{section.description}</p>
          </div>
        ))}
      </section>

      {selectedView === "flat" ? (
        <Panel
          title="All Tasks"
          subtitle="A single operational table across all statuses and active clients."
        >
          <TaskTable tasks={tasks} showClient />
        </Panel>
      ) : (
        <div className="space-y-6">
          {STATUS_SECTIONS.map((section) => {
            const sectionTasks = tasks.filter((task) => task.status === section.key);
            const groups = groupTasksByClient(sectionTasks);

            return (
              <Panel
                key={section.key}
                title={section.label}
                subtitle={`${section.description} ${sectionTasks.length} task${sectionTasks.length === 1 ? "" : "s"} in this section.`}
              >
                {sectionTasks.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No tasks in {section.label.toLowerCase()} right now.</p>
                ) : (
                  <div className="space-y-5">
                    {groups.map((group) => (
                      <div key={group.clientId} className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-[#1F2937]">{group.clientName}</p>
                            <p className="text-sm text-[#6B7280]">
                              {group.tasks.length} task{group.tasks.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          <Link
                            href={`/clients/${group.clientId}`}
                            className="text-sm font-semibold text-[#2563EB]"
                          >
                            Open Client
                          </Link>
                        </div>
                        <TaskTable tasks={group.tasks} />
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskTable({
  tasks,
  showClient = false,
}: {
  tasks: TaskRow[];
  showClient?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB]">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-[#F9FAFB] text-[#6B7280]">
          <tr>
            <th className="w-14 px-4 py-3 font-medium">Done</th>
            <th className="px-4 py-3 font-medium">Task</th>
            {showClient ? <th className="px-4 py-3 font-medium">Client</th> : null}
            <th className="px-4 py-3 font-medium">Period</th>
            <th className="px-4 py-3 font-medium">Assignee</th>
            <th className="px-4 py-3 font-medium">Due</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium text-right">Delete</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-t border-[#E5E7EB] align-top text-[#374151]">
              <td className="px-4 py-3">
                {task.status === TaskStatus.COMPLETE ? (
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                ) : (
                  <form action={updateTaskStatusAction}>
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="periodId" value={task.periodInstance.id} />
                    <input type="hidden" name="status" value="COMPLETE" />
                    <button
                      type="submit"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D1D5DB] bg-white text-[#9CA3AF] transition hover:border-[#059669] hover:bg-[#ECFDF5] hover:text-[#059669]"
                      aria-label={`Mark ${task.title} complete`}
                      title="Mark complete"
                    >
                      <Circle className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="min-w-56">
                  <Link href={`/tasks/${task.id}`} className="font-semibold text-[#1F2937]">
                    {task.title}
                  </Link>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#9CA3AF]">
                    {task.category || "General"} | {task.priority}
                  </p>
                  {task.description ? (
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">{task.description}</p>
                  ) : null}
                  {task.blockedReason ? (
                    <p className="mt-2 text-sm text-[#D97706]">{task.blockedReason}</p>
                  ) : null}
                </div>
              </td>
              {showClient ? <td className="px-4 py-3">{task.periodInstance.client.name}</td> : null}
              <td className="px-4 py-3">
                <div>
                  <p className="font-medium text-[#1F2937]">{task.periodInstance.label}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#9CA3AF]">
                    {task.periodInstance.template.name}
                  </p>
                  <Link href={`/periods/${task.periodInstance.id}`} className="mt-2 inline-block text-xs font-semibold text-[#2563EB]">
                    Open Period Settings
                  </Link>
                </div>
              </td>
              <td className="px-4 py-3">{task.assignee || "Unassigned"}</td>
              <td className="px-4 py-3">{formatDate(task.dueDate)}</td>
              <td className="px-4 py-3">
                <form action={updateTaskStatusAction} className="flex min-w-48 items-center gap-2">
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="periodId" value={task.periodInstance.id} />
                  <Select name="status" defaultValue={task.status}>
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="WAITING_ON_CLIENT">Waiting on Client</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="COMPLETE">Complete</option>
                  </Select>
                  <Button type="submit" variant="secondary" className="px-3 py-2">
                    Save
                  </Button>
                </form>
                <div className="mt-2">
                  <StatusBadge status={task.status} />
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-[11px] font-semibold text-[#6B7280]">
                  {task.sourceType.replaceAll("_", " ")}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <form action={deleteTaskAction} className="inline-flex">
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="periodId" value={task.periodInstance.id} />
                  <ClientActionButton
                    actionLabel="Delete"
                    variant="danger"
                    confirmMessage="Delete this task? This will also remove related notes and evidence links. Carryforward and dependency references will be cleared."
                  />
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function groupTasksByClient(tasks: TaskRow[]) {
  return Object.values(
    tasks.reduce<Record<string, { clientId: string; clientName: string; tasks: TaskRow[] }>>(
      (acc, task) => {
        const clientId = task.periodInstance.client.id;
        if (!acc[clientId]) {
          acc[clientId] = {
            clientId,
            clientName: task.periodInstance.client.name,
            tasks: [],
          };
        }
        acc[clientId].tasks.push(task);
        return acc;
      },
      {},
    ),
  );
}
