import { Badge } from "@/components/ui/badge";

type Status =
  | "pending"
  | "approved"
  | "rejected"
  | "queued"
  | "processing"
  | "done"
  | "failed"
  | "intake"
  | "review"
  | "complete"
  | "archived";

export type StatusPillStatus = Status | (string & {});

const statusMap: Record<Status, { label: string; variant: "default" | "primary" | "success" | "warning" | "danger" }> = {
  pending: { label: "Pending", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  queued: { label: "Queued", variant: "default" },
  processing: { label: "Processing", variant: "warning" },
  done: { label: "Done", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  intake: { label: "Intake", variant: "default" },
  review: { label: "In Review", variant: "primary" },
  complete: { label: "Complete", variant: "success" },
  archived: { label: "Archived", variant: "default" },
};

export function StatusPill({ status }: { status: StatusPillStatus }) {
  const entry = statusMap[status as Status] || { label: status, variant: "default" };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
