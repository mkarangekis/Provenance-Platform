import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse-soft rounded-md bg-muted", className)} />;
}

export { Skeleton };
