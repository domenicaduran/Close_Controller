import Link from "next/link";
import { UserRole } from "@prisma/client";

import { createUserAction, deleteUserAction, toggleUserArchiveAction, updateUserAction } from "@/app/actions";
import { ClientActionButton } from "@/components/client-action-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Button, Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  await requireAdmin();

  const [users, clients] = await Promise.all([
    prisma.user.findMany({
      include: {
        clientAccess: {
          include: { client: true },
          orderBy: { client: { name: "asc" } },
        },
        assignedTasks: {
          where: { status: { not: "COMPLETE" } },
          select: { id: true },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.client.findMany({
      where: { isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true },
    }),
  ]);

  const activeUsers = users.filter((user) => user.isActive);
  const archivedUsers = users.filter((user) => !user.isActive);

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Team"
        description="Manage internal teammates, their account status, and the clients they collaborate on."
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Add Team Member" subtitle="Create an internal user account for task ownership and collaboration.">
          <form action={createUserAction} className="grid gap-4">
            <Field label="Full name">
              <Input name="name" placeholder="Jordan Lee" required />
            </Field>
            <Field label="Work email">
              <Input name="email" type="email" placeholder="jordan@firm.com" required />
            </Field>
            <Field label="Title">
              <Input name="title" placeholder="Senior Accountant" />
            </Field>
            <Field label="Role">
              <Select name="role" defaultValue={UserRole.STAFF}>
                <option value={UserRole.ADMIN}>Admin</option>
                <option value={UserRole.MANAGER}>Manager</option>
                <option value={UserRole.STAFF}>Staff</option>
              </Select>
            </Field>
            <Field label="Temporary password">
              <Input name="password" type="password" placeholder="At least 8 characters" required />
            </Field>
            <Button type="submit">Create Team Member</Button>
          </form>
        </Panel>

        <Panel
          title="Team Directory"
          subtitle={`${activeUsers.length} active teammate${activeUsers.length === 1 ? "" : "s"} across ${clients.length} active client${clients.length === 1 ? "" : "s"}.`}
        >
          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-[#6B7280]">
                <tr>
                  <th className="px-4 py-3 font-medium">Team Member</th>
                  <th className="px-4 py-3 font-medium">Clients</th>
                  <th className="px-4 py-3 font-medium">Open Tasks</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers.map((user) => (
                  <tr key={user.id} className="border-t border-[#E5E7EB] text-[#374151]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#1F2937]">{user.name}</div>
                      <div className="text-xs text-[#6B7280]">
                        {user.role} {user.title ? `- ${user.title}` : ""} - {user.email}
                      </div>
                      {user.clientAccess.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {user.clientAccess.slice(0, 3).map((access) => (
                            <span
                              key={access.id}
                              className="rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6B7280]"
                            >
                              {access.client.name}
                              {access.roleLabel ? ` - ${access.roleLabel}` : ""}
                            </span>
                          ))}
                          {user.clientAccess.length > 3 ? (
                            <span className="rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6B7280]">
                              +{user.clientAccess.length - 3} more
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{user.clientAccess.length}</td>
                    <td className="px-4 py-3">{user.assignedTasks.length}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/tasks?saved=mine&assigneeUserId=${user.id}`}
                          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#1F2937] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#CBD5E1] hover:bg-[#F9FAFB]"
                        >
                          View Tasks
                        </Link>
                        <form action={toggleUserArchiveAction}>
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="isActive" value={String(user.isActive)} />
                          <ClientActionButton actionLabel="Archive" variant="warning" />
                        </form>
                        <form action={deleteUserAction}>
                          <input type="hidden" name="id" value={user.id} />
                          <ClientActionButton
                            actionLabel="Delete"
                            variant="danger"
                            confirmMessage="Delete this team member? Their linked task assignments will be cleared, and session/client access records will be removed."
                          />
                        </form>
                      </div>
                      <details className="mt-3 rounded-xl border border-[#E5E7EB] bg-[#FCFCFD]">
                        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-[#1F2937]">
                          Edit details
                        </summary>
                        <form action={updateUserAction} className="grid gap-3 border-t border-[#E5E7EB] p-3 md:grid-cols-2">
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="isActive" value={String(user.isActive)} />
                          <Field label="Name">
                            <Input name="name" defaultValue={user.name} required />
                          </Field>
                          <Field label="Email">
                            <Input name="email" type="email" defaultValue={user.email} required />
                          </Field>
                          <Field label="Title">
                            <Input name="title" defaultValue={user.title ?? ""} />
                          </Field>
                          <Field label="Role">
                            <Select name="role" defaultValue={user.role}>
                              <option value={UserRole.ADMIN}>Admin</option>
                              <option value={UserRole.MANAGER}>Manager</option>
                              <option value={UserRole.STAFF}>Staff</option>
                            </Select>
                          </Field>
                          <Field label="Reset password">
                            <Input name="password" type="password" placeholder="Leave blank to keep current password" />
                          </Field>
                          <div className="md:col-span-2">
                            <FormSubmitButton idleLabel="Save Team Member" pendingLabel="Saving..." />
                          </div>
                        </form>
                      </details>
                    </td>
                  </tr>
                ))}
                {activeUsers.length === 0 ? (
                  <tr className="border-t border-[#E5E7EB]">
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#6B7280]">
                      No active team members yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <details className="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#FCFCFD]">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#1F2937]">
              Archived Team Members ({archivedUsers.length})
            </summary>
            <div className="border-t border-[#E5E7EB]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#F9FAFB] text-[#6B7280]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Team Member</th>
                    <th className="px-4 py-3 font-medium">Clients</th>
                    <th className="px-4 py-3 font-medium">Open Tasks</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedUsers.map((user) => (
                    <tr key={user.id} className="border-t border-[#E5E7EB] text-[#374151]">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1F2937]">{user.name}</div>
                        <div className="text-xs text-[#6B7280]">
                          {user.role} {user.title ? `- ${user.title}` : ""} - {user.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">{user.clientAccess.length}</td>
                      <td className="px-4 py-3">{user.assignedTasks.length}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <form action={toggleUserArchiveAction}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="isActive" value={String(user.isActive)} />
                            <ClientActionButton actionLabel="Restore" variant="neutral" />
                          </form>
                          <form action={deleteUserAction}>
                            <input type="hidden" name="id" value={user.id} />
                            <ClientActionButton
                              actionLabel="Delete"
                              variant="danger"
                              confirmMessage="Delete this team member? Their linked task assignments will be cleared, and session/client access records will be removed."
                            />
                          </form>
                        </div>
                        <details className="mt-3 rounded-xl border border-[#E5E7EB] bg-white">
                          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-[#1F2937]">
                            Edit details
                          </summary>
                          <form action={updateUserAction} className="grid gap-3 border-t border-[#E5E7EB] p-3 md:grid-cols-2">
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="isActive" value={String(user.isActive)} />
                            <Field label="Name">
                              <Input name="name" defaultValue={user.name} required />
                            </Field>
                            <Field label="Email">
                              <Input name="email" type="email" defaultValue={user.email} required />
                            </Field>
                            <Field label="Title">
                              <Input name="title" defaultValue={user.title ?? ""} />
                            </Field>
                            <Field label="Role">
                              <Select name="role" defaultValue={user.role}>
                                <option value={UserRole.ADMIN}>Admin</option>
                                <option value={UserRole.MANAGER}>Manager</option>
                                <option value={UserRole.STAFF}>Staff</option>
                              </Select>
                            </Field>
                            <Field label="Reset password">
                              <Input name="password" type="password" placeholder="Leave blank to keep current password" />
                            </Field>
                            <div className="md:col-span-2">
                              <FormSubmitButton idleLabel="Save Team Member" pendingLabel="Saving..." />
                            </div>
                          </form>
                        </details>
                      </td>
                    </tr>
                  ))}
                  {archivedUsers.length === 0 ? (
                    <tr className="border-t border-[#E5E7EB]">
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#6B7280]">
                        No archived team members.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </details>
        </Panel>
      </div>
    </div>
  );
}
