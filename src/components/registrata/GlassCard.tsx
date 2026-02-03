import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary-500/15 bg-gradient-card p-6 shadow-card backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}
