import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center">
      <div className="container py-16">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Provenance Pulse
          </div>
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            Enterprise provenance intelligence, built for real-world collections.
          </h1>
          <p className="text-lg text-muted-foreground">
            Securely manage object intake, evidence, AI extraction, and review workflows across your organization.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/auth">Sign in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">First run checklist</h2>
            <ol className="mt-4 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Create an account on /auth</li>
              <li>Complete organization setup on /setup</li>
              <li>Create your first object on /objects</li>
              <li>Upload documents to begin AI extraction</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
