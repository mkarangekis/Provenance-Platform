import Link from "next/link";
import { Card } from "@/components/ui/card";

interface EvidenceBlockProps {
  snippet: string;
  sourceLabel?: string;
  sourceHref?: string;
}

export function EvidenceBlock({ snippet, sourceLabel, sourceHref }: EvidenceBlockProps) {
  return (
    <Card className="border border-dashed border-border bg-muted/40">
      <div className="p-4 space-y-3">
        <p className="text-sm text-foreground">{snippet}</p>
        {(sourceLabel || sourceHref) && (
          <div className="text-xs text-muted-foreground">
            Source:{" "}
            {sourceHref ? (
              <Link href={sourceHref} className="font-medium text-brand-700 hover:underline">
                {sourceLabel || "View document"}
              </Link>
            ) : (
              <span className="font-medium">{sourceLabel}</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
