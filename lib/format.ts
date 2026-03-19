import { format, isSameDay } from "date-fns";

export function formatDate(value?: Date | string | null) {
  if (!value) return "No date";
  const date = value instanceof Date ? value : new Date(value);
  return format(date, "MMM d, yyyy");
}

export function formatDateTime(value?: Date | string | null) {
  if (!value) return "Not set";
  const date = value instanceof Date ? value : new Date(value);
  return format(date, "MMM d, yyyy h:mm a");
}

export function statusTone(status: string) {
  switch (status) {
    case "COMPLETE":
    case "CLEARED":
      return "border-[#A7F3D0] text-[#059669] bg-[#ECFDF5]";
    case "BLOCKED":
      return "border-[#FED7AA] text-[#D97706] bg-[#FFF7ED]";
    case "OVERDUE":
      return "border-[#FECACA] text-[#DC2626] bg-[#FEF2F2]";
    case "IN_PROGRESS":
    case "UNDER_REVIEW":
      return "border-[#DBEAFE] text-[#2563EB] bg-[#EFF6FF]";
    case "REQUESTED":
    case "RECEIVED":
      return "border-[#E9D5FF] text-[#7C3AED] bg-[#F5F3FF]";
    default:
      return "border-[#E5E7EB] text-[#9CA3AF] bg-[#F9FAFB]";
  }
}

export function isToday(value?: Date | string | null) {
  if (!value) return false;
  return isSameDay(value instanceof Date ? value : new Date(value), new Date());
}
