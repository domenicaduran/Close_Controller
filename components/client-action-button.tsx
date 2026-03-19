"use client";

type ClientActionButtonProps = {
  actionLabel: string;
  confirmMessage?: string;
  variant?: "neutral" | "warning" | "danger";
};

const variantClasses: Record<NonNullable<ClientActionButtonProps["variant"]>, string> = {
  neutral:
    "border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#CBD5E1] hover:bg-[#F9FAFB]",
  warning:
    "border-[#FED7AA] bg-[#FFF7ED] text-[#D97706] hover:border-[#FDBA74] hover:bg-[#FFEDD5]",
  danger:
    "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] hover:border-[#FCA5A5] hover:bg-[#FEE2E2]",
};

export function ClientActionButton({
  actionLabel,
  confirmMessage,
  variant = "neutral",
}: ClientActionButtonProps) {
  return (
    <button
      type="submit"
      className={`rounded-xl border px-3 py-2 text-xs font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition ${variantClasses[variant]}`}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {actionLabel}
    </button>
  );
}
