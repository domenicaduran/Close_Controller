import { ReactNode } from "react";

import { statusTone } from "@/lib/format";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-2xl border border-[#E5E7EB] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#6B7280]">Operations</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[#1F2937]">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6B7280]">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_20px_rgba(16,24,40,0.04)] ${className}`}
    >
      <div className="mb-4">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#1F2937]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-[#6B7280]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">{label}</p>
      <p className="mt-2 text-[30px] font-semibold tracking-[-0.03em] text-[#1F2937]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">{detail}</p>
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] ${tone}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status.replaceAll("_", " ")}</Badge>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#374151]">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#1F2937] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:ring-2 focus:ring-[rgba(37,99,235,0.12)] ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#1F2937] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:ring-2 focus:ring-[rgba(37,99,235,0.12)] ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#1F2937] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[rgba(37,99,235,0.12)] ${props.className ?? ""}`}
    />
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  const variants = {
    primary: "border border-[#2563EB] bg-[#2563EB] text-white hover:border-[#1D4ED8] hover:bg-[#1D4ED8]",
    secondary: "border border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F9FAFB]",
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
