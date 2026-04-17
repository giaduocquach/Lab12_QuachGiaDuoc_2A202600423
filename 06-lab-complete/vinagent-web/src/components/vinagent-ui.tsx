import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type ConfidenceLevel = "high" | "medium" | "low";

export function ConflictBadge({ hasConflict }: { hasConflict: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 leading-normal",
        hasConflict
          ? "border-danger/30 text-danger"
          : "border-success/30 text-success",
      )}
    >
      <span
        className={cn(
          "inline-block size-1.5 rounded-full",
          hasConflict ? "bg-danger" : "bg-success",
        )}
      />
      {hasConflict ? "Có xung đột" : "Không xung đột"}
    </Badge>
  );
}

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const labels = {
    high: "Độ tin cậy cao",
    medium: "Cần xác nhận",
    low: "Độ tin cậy thấp",
  };
  const classes = {
    high: "border-trust-high/30 text-trust-high",
    medium: "border-trust-mid/30 text-trust-mid",
    low: "border-trust-low/30 text-trust-low",
  };

  return (
    <Badge variant="outline" className={cn("leading-normal", classes[level])}>
      {labels[level]}
    </Badge>
  );
}
