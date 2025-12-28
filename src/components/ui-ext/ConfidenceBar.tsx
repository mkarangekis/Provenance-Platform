import { cn } from "@/lib/utils";

interface ConfidenceBarProps {
  value: number;
}

export function ConfidenceBar({ value }: ConfidenceBarProps) {
  const percent = Math.min(100, Math.max(0, Math.round(value * 100)));
  const tone =
    percent >= 80 ? "bg-emerald-500" : percent >= 60 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Confidence</span>
        <span className="font-medium text-foreground">{percent}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div className={cn("h-2 rounded-full transition-all", tone)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
