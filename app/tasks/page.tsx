import { Priority, TaskSourceType, TaskStatus } from "@prisma/client";
import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

import {
  bulkUpdateTasksAction,
  createManualTaskAction,
  deleteTaskAction,
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
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_SECTIONS = [
  { key: TaskStatus.NOT_STARTED, label: "Not Started", description: "Planned work that has not moved yet." },
  { key: TaskStatus.IN_PROGRESS, label: "In Progress", description: "Active work currently being prepared or reviewed." },
  { key: TaskStatus.WAITING_ON_CLIENT, label: "Waiting on Client", description: "Items paused pending client support, files, or answers." },
  { key: TaskStatus.BLOCKED, label: "Blocked", description: "Items stopped by an internal blocker, dependency, or exception." },
  { key: TaskStatus.COMPLETE, label: "Done", description: "Completed tasks stay visible here for operational context." },
] as const;

const SAVED_VIEWS = [
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "waiting", label: "Waiting on Client" },
  { key: "blocked", label: "Blocked" },
  { key: "due_this_week", label: "Due This Week" },
] as const;

type SearchParams = {
  view?: string;
  new?: string;
  saved?: string;
  due?: string;
  assignee?: string;
  clientId?: string;
  sourceType?: string;
  priority?: string;
  periodId?: string;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  category: string | null;
  dueDate: Date | null;
  assignee: string | null;
  sourceType: TaskSourceType;
  blockedReason: string | null;
  priority: Priority;
  periodInstance: {
    id: string;
    label: string;
    clientId: string;
    client: { id: string; name: string };
    template: { name: string };
  };
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const selectedView = params.view === "status" ? "status" : "flat";
  const showNewTaskForm = params.new === "1";
  const activeSavedView = SAVED_VIEWS.some((view) => view.key === params.saved) ? params.saved : undefined;

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
      orderBy: [{ client: { name: "asc" } }, { periodStart: "desc" }],
    }),
  ]);

  const clients = Array.from(
    new Map(periods.map((period) => [period.client.id, period.client])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const assignees = Array.from(
    new Set(tasks.map((task) => task.assignee).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b));

  const selectedClientId = params.clientId ?? "";
  const defaultPeriodId =
    params.periodId ??
    periods.find((period) => period.client.id === selectedClientId)?.id ??
    "";

  const newTaskPeriods =
    selectedClientId.length > 0
      ? periods.filter((period) => period.client.id === selectedClientId)
      : periods;

  const filteredTasks = tasks.filter((task) =>
    matchesSavedView(task, activeSavedView) &&
    matchesClient(task, params.clientId) &&
    matchesAssignee(task, params.assignee) &&
    matchesSourceType(task, params.sourceType) &&
    matchesPriority(task, params.priority) &&
    matchesDueFilter(task, params.due, activeSavedView),
  );

  const counts = new Map<TaskStatus, number>(
    STATUS_SECTIONS.map((section) => [
      section.key,
      filteredTasks.filter((task) => task.status === section.key).length,
    ]),
  );

  const currentQuery = buildQueryString({
    view: selectedView,
    saved: activeSavedView,
    due: params.due,
    assignee: params.assignee,
    clientId: params.clientId,
    sourceType: params.sourceType,
    priority: params.priority,
    periodId: params.periodId,
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Tasks"
        description="Use Tasks as the daily operating surface: filter, bulk update, focus on saved views, and manage individual tasks in their own workspace."
        action={
          <div className="flex gap-2">
            <Link
              href={`/tasks?${buildQueryString({
                view: selectedView,
                saved: activeSavedView,
                due: params.due,
                assignee: params.assignee,
                clientId: params.clientId,
                sourceType: params.sourceType,
                priority: params.priority,
                periodId: params.periodId,
                new: "1",
              })}`}
              className="rounded-xl border border-[#2563EB] bg-[#2563EB] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
            >
              New Task
            </Link>
            <Link
              href={`/tasks?${buildQueryString({ ...params, view: "flat", new: undefined })}`}
              className={`rounded-xl border px-3.5 py-2 text-sm font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition ${
                selectedView === "flat"
                  ? "border-[#2563EB] bg-[#2563EB] text-white"
                  : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F9FAFB]"
              }`}
            >
              Flat List
            </Link>
            <Link
              href={`/tasks?${buildQueryString({ ...params, view: "status", new: undefined })}`}
              className={`rounded-xl border px-3.5 py-2 text-sm font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition ${
                selectedView === "status"
                  ? "border-[#2563EB] bg-[#2563EB] text-white"
                  : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F9FAFB]"
              }`}
            >
              By Status
            </Link>
          </div>
        }
      />

      <Panel title="Focus Views" subtitle="Jump straight into the most common controller work queues." className="p-4">
        <div className="flex flex-wrap gap-2">
          {SAVED_VIEWS.map((view) => (
            <Link
              key={view.key}
              href={`/tasks?${buildQueryString({
                view: selectedView,
                saved: view.key,
                clientId: params.clientId,
                assignee: params.assignee,
                sourceType: params.sourceType,
                priority: params.priority,
              })}`}
              className={`rounded-xl border px-3.5 py-2 text-sm font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition ${
                activeSavedView === view.key
                  ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                  : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F9FAFB]"
              }`}
            >
              {view.label}
            </Link>
          ))}
          <Link
            href={`/tasks?${buildQueryString({ view: selectedView })}`}
            className="rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-sm font-semibold text-[#1F2937] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-[#F9FAFB]"
          >
            Clear Focus
          </Link>
        </div>
      </Panel>

      <Panel title="Filters" subtitle="Refine the task board by owner, client, timing, source, and priority." className="p-4">
        <form method="get" className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input type="hidden" name="view" value={selectedView} />
          <Field label="Due window">
            <Select name="due" defaultValue={params.due ?? ""}>
              <option value="">All due dates</option>
              <option value="today">Today</option>
              <option value="overdue">Overdue</option>
              <option value="this_week">Due This Week</option>
            </Select>
          </Field>
          <Field label="Assignee">
            <Select name="assignee" defaultValue={params.assignee ?? ""}>
              <option value="">All assignees</option>
              {assignees.map((assignee) => (
                <option key={assignee} value={assignee}>
                  {assignee}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Client">
            <Select name="clientId" defaultValue={params.clientId ?? ""}>
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Source">
            <Select name="sourceType" defaultValue={params.sourceType ?? ""}>
              <option value="">All sources</option>
              <option value="TEMPLATE_GENERATED">Generated</option>
              <option value="IMPORTED">Imported</option>
              <option value="CARRYFORWARD">Carryforward</option>
              <option value="MANUAL">Manual</option>
            </Select>
          </Field>
          <Field label="Priority">
            <Select name="priority" defaultValue={params.priority ?? ""}>
              <option value="">All priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>
          </Field>
          <div className="flex items-end gap-3">
            <Button type="submit">Apply</Button>
            <Link
              href={`/tasks?${buildQueryString({ view: selectedView })}`}
              className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#1F2937] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-[#F9FAFB]"
            >
              Reset
            </Link>
          </div>
        </form>
      </Panel>

      {showNewTaskForm ? (
        <Panel title="New Task" subtitle="Create a one-off manual task and default it from the current client or period context when available.">
          <form action={createManualTaskAction} className="grid gap-4 md:grid-cols-2">
            <Field label="Client period">
              <Select name="periodInstanceId" defaultValue={defaultPeriodId}>
                <option value="">Select client and period</option>
                {newTaskPeriods.map((period) => (
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
              <Input name="assignee" defaultValue={params.assignee ?? ""} placeholder="Domenica" />
            </Field>
            <Field label="Due date">
              <Input name="dueDate" type="date" />
            </Field>
            <Field label="Priority">
              <Select name="priority" defaultValue={params.priority ?? "MEDIUM"}>
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
                href={`/tasks?${currentQuery}`}
                className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#1F2937] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-[#F9FAFB]"
              >
                Cancel
              </Link>
            </div>
          </form>
        </Panel>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-5">
        {STATUS_SECTIONS.map((section) => (
          <div
            key={section.key}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#1F2937]">{section.label}</p>
              <span className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-[11px] font-semibold text-[#6B7280]">
                {counts.get(section.key) ?? 0}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[#6B7280]">{section.description}</p>
          </div>
        ))}
      </section>

      {selectedView === "flat" ? (
        <Panel title="All Tasks" subtitle={`${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"} in the current result set.`} className="p-4">
          <TaskTable tasks={filteredTasks} formId="bulk-flat" showClient />
        </Panel>
      ) : (
        <div className="space-y-6">
          {STATUS_SECTIONS.map((section) => {
            const sectionTasks = filteredTasks.filter((task) => task.status === section.key);
            const groups = groupTasksByClient(sectionTasks);

            return (
              <Panel
                key={section.key}
                title={section.label}
                subtitle={`${section.description} ${sectionTasks.length} task${sectionTasks.length === 1 ? "" : "s"} in this section.`}
                className="p-4"
              >
                {sectionTasks.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No tasks in {section.label.toLowerCase()} right now.</p>
                ) : (
                  <div className="space-y-4">
                    {groups.map((group) => (
                      <div key={group.clientId} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-2">
                          <div>
                            <p className="text-sm font-semibold text-[#1F2937]">{group.clientName}</p>
                            <p className="text-xs text-[#6B7280]">
                              {group.tasks.length} task{group.tasks.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div className="flex gap-3">
                            <Link
                              href={`/tasks?${buildQueryString({
                                view: selectedView,
                                clientId: group.clientId,
                                periodId: group.tasks[0]?.periodInstance.id,
                                new: "1",
                              })}`}
                              className="text-xs font-semibold text-[#2563EB]"
                            >
                              New Task for Client
                            </Link>
                            <Link href={`/clients/${group.clientId}`} className="text-xs font-semibold text-[#2563EB]">
                              Open Client
                            </Link>
                          </div>
                        </div>
                        <TaskTable tasks={group.tasks} formId={`bulk-${section.key}-${group.clientId}`} />
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
  formId,
  showClient = false,
}: {
  tasks: TaskRow[];
  formId: string;
  showClient?: boolean;
}) {
  return (
    <div className="space-y-4">
      <form id={formId} action={bulkUpdateTasksAction} className="grid gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 md:grid-cols-[1.2fr_1fr_1fr_auto]">
        <Field label="Bulk assignee">
          <Input name="assignee" placeholder="Reassign selected tasks" />
        </Field>
        <Field label="Bulk status">
          <Select name="status" defaultValue="">
            <option value="">No status change</option>
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="WAITING_ON_CLIENT">Waiting on Client</option>
            <option value="BLOCKED">Blocked</option>
            <option value="COMPLETE">Complete</option>
          </Select>
        </Field>
        <Field label="Bulk due date">
          <Input name="dueDate" type="date" />
        </Field>
        <div className="flex items-end">
          <Button type="submit" className="px-3 py-2">Apply to Selected</Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <table className="min-w-full text-left text-[13px]">
          <thead className="sticky top-0 bg-[#F9FAFB] text-[#6B7280]">
            <tr>
              <th className="w-12 px-3 py-2.5 font-medium">Select</th>
              <th className="w-12 px-3 py-2.5 font-medium">Done</th>
              <th className="px-3 py-2.5 font-medium">Task</th>
              {showClient ? <th className="px-3 py-2.5 font-medium">Client</th> : null}
              <th className="px-3 py-2.5 font-medium">Period</th>
              <th className="px-3 py-2.5 font-medium">Assignee</th>
              <th className="px-3 py-2.5 font-medium">Due</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Source</th>
              <th className="px-3 py-2.5 font-medium text-right">Delete</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-t border-[#E5E7EB] align-top text-[#374151]">
                <td className="px-3 py-2.5">
                  <input
                    form={formId}
                    type="checkbox"
                    name="taskIds"
                    value={task.id}
                    className="h-4 w-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]"
                  />
                </td>
                <td className="px-3 py-2.5">
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
                <td className="px-3 py-2.5">
                  <div className="min-w-52 max-w-[22rem]">
                    <Link href={`/tasks/${task.id}`} className="font-semibold text-[#1F2937]">
                      {task.title}
                    </Link>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#9CA3AF]">
                      {task.category || "General"} | {task.priority}
                    </p>
                    {task.description ? (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#6B7280]">{task.description}</p>
                    ) : null}
                    {task.blockedReason ? (
                      <p className="mt-1.5 text-xs text-[#D97706]">{task.blockedReason}</p>
                    ) : null}
                  </div>
                </td>
                {showClient ? <td className="px-3 py-2.5">{task.periodInstance.client.name}</td> : null}
                <td className="px-3 py-2.5">
                  <div>
                    <p className="font-medium text-[#1F2937]">{task.periodInstance.label}</p>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#9CA3AF]">
                      {task.periodInstance.template.name}
                    </p>
                    <Link href={`/periods/${task.periodInstance.id}`} className="mt-1.5 inline-block text-[11px] font-semibold text-[#2563EB]">
                      Open Period Settings
                    </Link>
                  </div>
                </td>
                <td className="px-3 py-2.5">{task.assignee || "Unassigned"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(task.dueDate)}</td>
                <td className="px-3 py-2.5">
                  <form action={updateTaskStatusAction} className="flex min-w-44 items-center gap-2">
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="periodId" value={task.periodInstance.id} />
                    <Select name="status" defaultValue={task.status}>
                      <option value="NOT_STARTED">Not Started</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="WAITING_ON_CLIENT">Waiting on Client</option>
                      <option value="BLOCKED">Blocked</option>
                      <option value="COMPLETE">Complete</option>
                    </Select>
                    <Button type="submit" variant="secondary" className="px-2.5 py-2 text-xs">
                      Save
                    </Button>
                  </form>
                  <div className="mt-1.5">
                    <StatusBadge status={task.status} />
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-[11px] font-semibold text-[#6B7280]">
                    {task.sourceType.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
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
    </div>
  );
}

function groupTasksByClient(tasks: TaskRow[]) {
  return Object.values(
    tasks.reduce<Record<string, { clientId: string; clientName: string; tasks: TaskRow[] }>>(
      (acc, task) => {
        const clientId = task.periodInstance.client.id;
        if (!acc[clientId]) {
          acc[clientId] = { clientId, clientName: task.periodInstance.client.name, tasks: [] };
        }
        acc[clientId].tasks.push(task);
        return acc;
      },
      {},
    ),
  );
}

function buildQueryString(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return search.toString();
}

function matchesSavedView(task: TaskRow, saved?: string) {
  if (saved === "waiting") return task.status === TaskStatus.WAITING_ON_CLIENT;
  if (saved === "blocked") return task.status === TaskStatus.BLOCKED;
  return true;
}

function matchesClient(task: TaskRow, clientId?: string) {
  return !clientId || task.periodInstance.client.id === clientId;
}

function matchesAssignee(task: TaskRow, assignee?: string) {
  return !assignee || task.assignee === assignee;
}

function matchesSourceType(task: TaskRow, sourceType?: string) {
  return !sourceType || task.sourceType === sourceType;
}

function matchesPriority(task: TaskRow, priority?: string) {
  return !priority || task.priority === priority;
}

function matchesDueFilter(task: TaskRow, due?: string, saved?: string) {
  const effectiveDue = saved === "today" ? "today" : saved === "overdue" ? "overdue" : saved === "due_this_week" ? "this_week" : due;
  if (!effectiveDue) return true;
  if (!task.dueDate) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(startOfToday.getDate() + (7 - startOfToday.getDay()));

  if (effectiveDue === "today") {
    return task.dueDate >= startOfToday && task.dueDate < endOfToday;
  }

  if (effectiveDue === "overdue") {
    return task.dueDate < startOfToday && task.status !== TaskStatus.COMPLETE;
  }

  if (effectiveDue === "this_week") {
    return task.dueDate >= startOfToday && task.dueDate < endOfWeek && task.status !== TaskStatus.COMPLETE;
  }

  return true;
}
