"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui";

export function FormSubmitButton({
  idleLabel,
  pendingLabel,
  className,
  variant = "primary",
}: {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} className={className} disabled={pending}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
