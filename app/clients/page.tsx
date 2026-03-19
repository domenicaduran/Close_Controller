import Link from "next/link";

import { createClientAction, toggleClientArchiveAction } from "@/app/actions";
import { Button, Field, Input, PageHeader, Panel } from "@/components/ui";
import { prisma } from "@/lib/prisma";

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
        description="Create, edit, archive, and assign workflow templates to each client."
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
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
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
                  <tr key={client.id} className="border-t border-slate-200 text-slate-700">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${client.id}`} className="font-semibold text-slate-950">
                        {client.name}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {client.primaryContact || "No contact"} {client.code ? `· ${client.code}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">{client.templateAssignments.length}</td>
                    <td className="px-4 py-3">{client.periodInstances.length}</td>
                    <td className="px-4 py-3">{client.isArchived ? "Archived" : "Active"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/clients/${client.id}`}
                          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-900"
                        >
                          Open
                        </Link>
                        <form action={toggleClientArchiveAction}>
                          <input type="hidden" name="id" value={client.id} />
                          <input type="hidden" name="isArchived" value={String(client.isArchived)} />
                          <button
                            type="submit"
                            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-900"
                          >
                            {client.isArchived ? "Restore" : "Archive"}
                          </button>
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
