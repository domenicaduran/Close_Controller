import Link from "next/link";

import { PageHeader, Panel, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const selectedView = view === "client" ? "client" : "flat";

  const openTasks = await prisma.taskInstance.findMany({
    where: {
      status: { not: "COMPLETE" },
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
    ],
  });

  const tasksByClient = Object.values(
    openTasks.reduce<Record<string, { clientName: string; tasks: typeof openTasks }>>((acc, task) => {
      const key = task.periodInstance.clientId;
      if (!acc[key]) {
        acc[key] = {
          clientName: task.periodInstance.client.name,
          tasks: [],
        };
      }
      acc[key].tasks.push(task);
      return acc;
    }, {}),
  );

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Tasks"
        description="Review all open tasks across active clients as a flat operational list or grouped by client."
        action={
          <div className="flex gap-2">
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
            <Link
              href="/tasks?view=client"
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition ${
                selectedView === "client"
                  ? "border-[#2563EB] bg-[#2563EB] text-white"
                  : "border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F9FAFB]"
              }`}
            >
              Group by Client
            </Link>
          </div>
        }
      />

      {selectedView === "flat" ? (
        <Panel title="Open Task List" subtitle="All incomplete work across active clients.">
          <TaskTable tasks={openTasks} />
        </Panel>
      ) : (
        <div className="space-y-6">
          {tasksByClient.map((group) => (
            <Panel
              key={group.clientName}
              title={group.clientName}
              subtitle={`${group.tasks.length} open task${group.tasks.length === 1 ? "" : "s"} in progress.`}
            >
              <TaskTable tasks={group.tasks} />
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskTable({
  tasks,
}: {
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    category: string | null;
    dueDate: Date | null;
    assignee: string | null;
    sourceType: string;
    periodInstance: {
      id: string;
      label: string;
      client: { name: string };
      template: { name: string };
    };
  }>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#F9FAFB] text-[#6B7280]">
          <tr>
            <th className="px-4 py-3 font-medium">Task</th>
            <th className="px-4 py-3 font-medium">Client</th>
            <th className="px-4 py-3 font-medium">Period</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Assignee</th>
            <th className="px-4 py-3 font-medium">Due</th>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-t border-[#E5E7EB] text-[#374151]">
              <td className="px-4 py-3">
                <Link href={`/periods/${task.periodInstance.id}`} className="font-semibold text-[#1F2937]">
                  {task.title}
                </Link>
              </td>
              <td className="px-4 py-3">{task.periodInstance.client.name}</td>
              <td className="px-4 py-3">{task.periodInstance.label}</td>
              <td className="px-4 py-3">{task.category || "General"}</td>
              <td className="px-4 py-3">{task.assignee || "Unassigned"}</td>
              <td className="px-4 py-3">{formatDate(task.dueDate)}</td>
              <td className="px-4 py-3">{task.sourceType.replaceAll("_", " ")}</td>
              <td className="px-4 py-3">
                <StatusBadge status={task.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
