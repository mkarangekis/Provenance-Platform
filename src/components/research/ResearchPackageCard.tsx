import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ResearchPackage = Record<string, unknown> | null;

type Props = {
  packageData: ResearchPackage;
  onSave: () => void;
  onAddToCollection: () => void;
  onExport: (mode: "internal" | "public", format: "json" | "html") => void;
  busy?: boolean;
};

function asPretty(value: unknown): string {
  if (value == null) return "Not available.";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function ResearchPackageCard({
  packageData,
  onSave,
  onAddToCollection,
  onExport,
  busy,
}: Props) {
  const sections: Array<{ id: string; title: string; value: unknown }> = [
    { id: "object_summary", title: "Object Summary", value: packageData?.object_summary },
    { id: "catalog_entry", title: "Catalog Entry", value: packageData?.catalog_entry },
    { id: "provenance", title: "Provenance", value: packageData?.provenance },
    { id: "literature_exhibitions", title: "Literature / Exhibitions", value: packageData?.literature_exhibitions },
    { id: "auction_history_comparables", title: "Auction History / Comparables", value: packageData?.auction_history_comparables },
    { id: "valuation", title: "Valuation", value: packageData?.valuation },
    { id: "risk", title: "Risk", value: packageData?.risk },
    { id: "sources", title: "Sources", value: packageData?.sources },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Research Package</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onSave} disabled={busy}>
              Save/Update Object
            </Button>
            <Button size="sm" variant="outline" onClick={onAddToCollection} disabled={busy}>
              Add to Collection
            </Button>
            <Button size="sm" variant="outline" onClick={() => onExport("internal", "json")}>
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sections.map((section) => (
          <details key={section.id} className="rounded-lg border border-border p-3" open={section.id === "object_summary"}>
            <summary className="cursor-pointer text-sm font-medium">{section.title}</summary>
            <pre className="mt-2 max-h-56 overflow-auto text-xs text-muted-foreground">{asPretty(section.value)}</pre>
          </details>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onExport("internal", "html")}>
            Internal HTML
          </Button>
          <Button size="sm" variant="outline" onClick={() => onExport("public", "json")}>
            Public JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => onExport("public", "html")}>
            Public HTML
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
