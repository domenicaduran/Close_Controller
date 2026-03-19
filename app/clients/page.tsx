import Link from "next/link";

import { createClientAction, deleteClientAction, toggleClientArchiveAction } from "@/app/actions";
import { ClientActionButton } from "@/components/client-action-button";
import { Button, Field, Input, PageHeader, Panel } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    include: {
      templateAssignments: {
        include: { template: true },
      },
      periodInstances: {
        where: { status: { not: "ARCHIVED" } },
      },
    },
    orderBy: [{ isArchived: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Clients"
        description="Create, edit, archive, delete, and manage workflow relationships for each client."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <Panel title="Add Client" subtitle="Start a new recurring accounting relationship.">
          <form action={createClientAction} className="grid gap-4">
            <Field label="Client name">
              <Input name="name" placeholder="Northwind Holdings" required />
            </Field>
            <Field label="Code">
              <Input name="code" placeholder="NWH" />
            </Field>
            <Field label="Industry">
              <Input name="industry" placeholder="Manufacturing" />
            </Field>
            <Field label="Primary contact">
              <Input name="primaryContact" placeholder="Taylor Chen" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" placeholder="controller@client.com" />
            </Field>
            <Button type="submit">Create Client</Button>
          </form>
        </Panel>

        <Panel title="Client Directory" subtitle="Desktop-optimized view of active and archived clients.">
          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Templates</th>
                  <th className="px-4 py-3 font-medium">Open Periods</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-t border-[#E5E7EB] text-[#374151]">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${client.id}`} className="font-semibold text-[#1F2937]">
                        {client.name}
                      </Link>
                      <div className="text-xs text-[#6B7280]">
                        {client.primaryContact || "No contact"} {client.code ? `- ${client.code}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">{client.templateAssignments.length}</td>
                    <td className="px-4 py-3">{client.periodInstances.length}</td>
                    <td className="px-4 py-3">{client.isArchived ? "Archived" : "Active"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/clients/${client.id}`}
                          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#1F2937] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#CBD5E1] hover:bg-[#F9FAFB]"
                        >
                          Open
                        </Link>
                        <form action={toggleClientArchiveAction}>
                          <input type="hidden" name="id" value={client.id} />
                          <input type="hidden" name="isArchived" value={String(client.isArchived)} />
                          <ClientActionButton
                            actionLabel={client.isArchived ? "Restore" : "Archive"}
                            variant={client.isArchived ? "neutral" : "warning"}
                          />
                        </form>
                        <form action={deleteClientAction}>
                          <input type="hidden" name="id" value={client.id} />
                          <ClientActionButton
                            actionLabel="Delete"
                            variant="danger"
                            confirmMessage="Deleting this client will also delete all related periods, tasks, PBC items, imports, and history for this client. Continue?"
                          />
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
