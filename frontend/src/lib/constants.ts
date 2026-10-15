export const CATEGORY_OPTIONS = [
  "billing",
  "technical",
  "sales",
  "support",
  "other",
] as const;

export const CATEGORY_BADGE_COLORS: Record<string, string> = {
  billing: "bg-[#2563EB]",
  technical: "bg-[#7C3AED]",
  sales: "bg-[#059669]",
  support: "bg-[#0891B2]",
  other: "bg-[#6B7280]",
};
