import { Badge } from "@/components/ui/badge";
import {
  CATEGORY_BADGE_COLORS,
  SOURCE_BADGE_COLORS,
  URGENCY_BADGE_COLORS,
} from "@/lib/constants";

// Each badge keeps its own color per value so rows are easy to scan.
// The shadcn Badge handles the shape, size and focus styles.
const badgeClass = "capitalize text-white";

export function UrgencyBadge({ urgency }: { urgency: string }) {
  return (
    <Badge
      className={`${badgeClass} ${URGENCY_BADGE_COLORS[urgency] ?? URGENCY_BADGE_COLORS.low}`}
    >
      {urgency}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge
      className={`${badgeClass} ${CATEGORY_BADGE_COLORS[category] ?? CATEGORY_BADGE_COLORS.other}`}
    >
      {category}
    </Badge>
  );
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <Badge
      className={`${badgeClass} ${SOURCE_BADGE_COLORS[source] ?? SOURCE_BADGE_COLORS.webhook}`}
    >
      {source}
    </Badge>
  );
}
