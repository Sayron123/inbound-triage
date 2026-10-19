export const CATEGORY_OPTIONS = [
  "billing",
  "technical",
  "sales",
  "support",
  "other",
] as const;

export const SOURCE_OPTIONS = ["webhook", "gmail"] as const;

export const SOURCE_BADGE_COLORS: Record<string, string> = {
  webhook: "bg-[#4B5563]",
  gmail: "bg-[#B91C1C]",
};

export const CATEGORY_BADGE_COLORS: Record<string, string> = {
  billing: "bg-[#2563EB]",
  technical: "bg-[#7C3AED]",
  sales: "bg-[#059669]",
  support: "bg-[#0891B2]",
  other: "bg-[#6B7280]",
};
