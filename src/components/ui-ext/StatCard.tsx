import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  tone?: "default" | "primary" | "success" | "warning";
}

const toneStyles: Record<string, string> = {
  default: "bg-surface text-text-primary",
  primary: "bg-primary-500/15 text-primary-200",
  success: "bg-emerald-500/15 text-emerald-200",
  warning: "bg-amber-500/15 text-amber-200",
};

export function StatCard({ label, value, subtext, icon, tone = "default" }: StatCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
          {subtext && <p className="mt-1 text-sm text-muted-foreground">{subtext}</p>}
        </div>
        {icon && (
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", toneStyles[tone])}>
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
