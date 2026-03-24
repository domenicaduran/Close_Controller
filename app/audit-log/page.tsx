import { AuditEntityType } from "@prisma/client";

import { PageHeader, Panel, Select, StatusBadge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  userId?: string;
  clientId?: string;
  entityType?: string;
};

function parseMetadata(value: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const [users, clients, logs] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.auditLog.findMany({
      where: {
        ...(params.userId ? { userId: params.userId } : {}),
        ...(params.clientId ? { clientId: params.clientId } : {}),
        ...(params.entityType ? { entityType: params.entityType as AuditEntityType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Audit Log"
        description="Internal activity history for key create, update, archive, restore, delete, and workflow actions."
      />

      <Panel title="Filters" subtitle="Filter the activity stream by user, client, or entity type.">
        <form method="get" className="grid gap-4 md:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-[#374151]">
            <span>User</span>
            <Select name="userId" defaultValue={params.userId ?? ""}>
              <option value="">All users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#374151]">
            <span>Client</span>
            <Select name="clientId" defaultValue={params.clientId ?? ""}>
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#374151]">
            <span>Entity type</span>
            <Select name="entityType" defaultValue={params.entityType ?? ""}>
              <option value="">All entities</option>
              {Object.values(AuditEntityType).map((entityType) => (
                <option key={entityType} value={entityType}>
                  {entityType.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl border border-[#2563EB] bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#1D4ED8] hover:bg-[#1D4ED8]"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="Activity" subtitle={`${logs.length} most recent log entr${logs.length === 1 ? "y" : "ies"}.`}>
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-[#6B7280]">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Context</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const metadata = parseMetadata(log.metadataJson);
                return (
                  <tr key={log.id} className="border-t border-[#E5E7EB] align-top text-[#374151]">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3">{log.userNameSnapshot || "System"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={log.actionType} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1F2937]">{log.entityLabel || log.entityId}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#9CA3AF]">
                        {log.entityType.replaceAll("_", " ")}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {metadata ? (
                        <pre className="whitespace-pre-wrap rounded-xl bg-[#F9FAFB] px-3 py-2 text-xs text-[#6B7280]">
                          {JSON.stringify(metadata, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-sm text-[#6B7280]">No extra details</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 ? (
                <tr className="border-t border-[#E5E7EB]">
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#6B7280]">
                    No audit log entries match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
