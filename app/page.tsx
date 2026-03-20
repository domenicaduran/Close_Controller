import Link from "next/link";

import { MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const today = new Date();
  const currentUser = await requireUser();

  const [
    myOpenTasks,
    overdueTasks,
    dueTodayTasks,
    blockedTasks,
    clients,
    periods,
    pbcSummary,
    workflowCounts,
  ] = await Promise.all([
    prisma.taskInstance.count({
      where: {
        assigneeUserId: currentUser.id,
        status: { not: "COMPLETE" },
      },
    }),
    prisma.taskInstance.findMany({
      where: {
        dueDate: { lt: today },
        status: { not: "COMPLETE" },
      },
      include: {
        periodInstance: { include: { client: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.taskInstance.findMany({
      where: {
        dueDate: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
        },
        status: { not: "COMPLETE" },
      },
      include: {
        periodInstance: { include: { client: true } },
      },
      orderBy: { sortOrder: "asc" },
      take: 8,
    }),
    prisma.taskInstance.findMany({
      where: { status: "BLOCKED" },
      include: { periodInstance: { include: { client: true } } },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.client.findMany({
      where: { isArchived: false },
      include: {
        periodInstances: {
          where: { status: { not: "ARCHIVED" } },
          orderBy: { periodStart: "desc" },
          take: 3,
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.periodInstance.findMany({
      include: {
        client: true,
        template: true,
        taskInstances: true,
      },
      orderBy: { periodStart: "desc" },
      take: 10,
    }),
    prisma.pBCRequestItem.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.workflowTemplate.groupBy({
      by: ["workflowType"],
      _count: { workflowType: true },
    }),
  ]);

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Dashboard"
        description="Monitor close work, audit support, and recurring controller operations across all active clients."
      />

      <section className="grid gap-4 xl:grid-cols-6">
        <MetricCard
          label="Active Clients"
          value={String(clients.length)}
          detail="Current client relationships in the active workspace."
        />
        <MetricCard
          label="Open Periods"
          value={String(periods.length)}
          detail="Workflow periods that are still active or in progress."
        />
        <MetricCard
          label="My Tasks"
          value={String(myOpenTasks)}
          detail="Open tasks currently assigned to you."
        />
        <MetricCard
          label="Today"
          value={String(dueTodayTasks.length)}
          detail="Tasks due today across active period instances."
        />
        <MetricCard
          label="Overdue"
          value={String(overdueTasks.length)}
          detail="Open work that has passed its expected due date."
        />
        <MetricCard
          label="Blocked"
          value={String(blockedTasks.length)}
          detail="Items waiting on dependencies, evidence, or decisions."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Panel
          title="By Period"
          subtitle="Recent workflow instances with quick access to progress and status."
        >
          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Workflow</th>
                  <th className="px-4 py-3 font-medium">Progress</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => {
                  const completeCount = period.taskInstances.filter((task) => task.status === "COMPLETE").length;

                  return (
                    <tr key={period.id} className="border-t border-[#E5E7EB] text-[#374151]">
                      <td className="px-4 py-3">
                        <Link href={`/periods/${period.id}`} className="font-semibold text-[#1F2937]">
                          {period.label}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{period.client.name}</td>
                      <td className="px-4 py-3">{period.template.name}</td>
                      <td className="px-4 py-3">
                        {completeCount}/{period.taskInstances.length} complete
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={period.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="By Workflow Type"
          subtitle="Reusable process coverage across recurring accounting work."
        >
          <div className="space-y-3">
            {workflowCounts.map((item) => (
              <div
                key={item.workflowType}
                className="flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-4"
              >
                <div>
                  <p className="font-semibold text-[#1F2937]">{item.workflowType.replaceAll("_", " ")}</p>
                  <p className="text-sm text-[#6B7280]">Reusable workflow templates</p>
                </div>
                <p className="text-2xl font-semibold tracking-[-0.02em] text-[#1F2937]">
                  {item._count.workflowType}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Panel title="Today" subtitle="Immediate work ready for execution.">
          <TaskList tasks={dueTodayTasks} emptyLabel="No tasks due today." />
        </Panel>
        <Panel title="Overdue" subtitle="Items that need attention before the next cycle advances.">
          <TaskList tasks={overdueTasks} emptyLabel="No overdue tasks." />
        </Panel>
        <Panel title="Blocked Items" subtitle="Exceptions requiring follow-up or escalation.">
          <TaskList tasks={blockedTasks} emptyLabel="No blocked items." />
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="By Client" subtitle="Recent open work grouped by active client relationships.">
          <div className="grid gap-4 md:grid-cols-2">
            {clients.map((client) => (
              <div
                key={client.id}
                className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/clients/${client.id}`} className="text-lg font-semibold text-[#1F2937]">
                      {client.name}
                    </Link>
                    <p className="text-sm text-[#6B7280]">{client.industry || "Accounting client"}</p>
                  </div>
                  <span className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-[11px] font-semibold text-[#6B7280]">
                    {client.periodInstances.length} open periods
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {client.periodInstances.map((period) => (
                    <Link
                      key={period.id}
                      href={`/periods/${period.id}`}
                      className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#374151]"
                    >
                      <span>{period.label}</span>
                      <StatusBadge status={period.status} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Audit PBC Status" subtitle="Request inventory across audit periods and imported lists.">
          <div className="space-y-3">
            {pbcSummary.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-4"
              >
                <StatusBadge status={item.status} />
                <span className="text-lg font-semibold text-[#1F2937]">{item._count.status}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function TaskList({
  tasks,
  emptyLabel,
}: {
  tasks: Array<{
    id: string;
    title: string;
    dueDate: Date | null;
    status: string;
    periodInstance: {
      id: string;
      label: string;
      client: { name: string };
    };
  }>;
  emptyLabel: string;
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-[#6B7280]">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div key={task.id} className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[#1F2937]">{task.title}</p>
              <p className="mt-1 text-sm text-[#6B7280]">
                {task.periodInstance.client.name} -{" "}
                <Link href={`/tasks/${task.id}`} className="font-medium text-[#1F2937]">
                  {task.periodInstance.label}
                </Link>
              </p>
            </div>
            <StatusBadge status={task.status} />
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
            Due {formatDate(task.dueDate)}
          </p>
        </div>
      ))}
    </div>
  );
}
