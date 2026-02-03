import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "primary" | "success" | "warning" | "info";
}

const toneStyles: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  primary: "text-primary-200 border-primary-500/30 bg-primary-500/10",
  success: "text-emerald-200 border-emerald-400/30 bg-emerald-500/10",
  warning: "text-amber-200 border-amber-400/30 bg-amber-500/10",
  info: "text-blue-200 border-blue-400/30 bg-blue-500/10",
};

export function MetricCard({ label, value, helper, tone = "primary" }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-border-muted bg-surface px-5 py-4 shadow-card">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.24em] text-text-muted">{label}</div>
        <div className={cn("rounded-full border px-3 py-1 text-[11px] uppercase", toneStyles[tone])}>
          Live
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      {helper && <p className="mt-1 text-sm text-text-secondary">{helper}</p>}
    </div>
  );
}
