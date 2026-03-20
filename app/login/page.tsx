import { bootstrapUserAction, loginAction } from "@/app/actions";
import { Button, Field, Input, Panel } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export default async function LoginPage() {
  const userCount = await prisma.user.count();
  const firstRun = userCount === 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-[560px] items-center px-6 py-12">
      <Panel
        title={firstRun ? "Set Up Close Controller" : "Sign In"}
        subtitle={
          firstRun
            ? "Create the first internal team account. This user can then add the rest of the team."
            : "Use your internal team credentials to access client work, tasks, and workflow periods."
        }
        className="w-full p-6"
      >
        <form action={firstRun ? bootstrapUserAction : loginAction} className="grid gap-4">
          {firstRun ? (
            <>
              <Field label="Full name">
                <Input name="name" placeholder="Domenica Duran" required />
              </Field>
              <Field label="Work email">
                <Input name="email" type="email" placeholder="you@firm.com" required />
              </Field>
              <Field label="Title">
                <Input name="title" placeholder="Controller" />
              </Field>
            </>
          ) : (
            <Field label="Work email">
              <Input name="email" type="email" placeholder="you@firm.com" required />
            </Field>
          )}
          <Field label="Password">
            <Input name="password" type="password" placeholder="At least 8 characters" required />
          </Field>
          <Button type="submit">{firstRun ? "Create Team Admin" : "Sign In"}</Button>
        </form>
      </Panel>
    </div>
  );
}
