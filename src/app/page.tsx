import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const PROCESS_STEPS = [
  {
    id: "01",
    title: "Structured Object Creation",
    subtitle: "Artwork Intake",
    description:
      "Each artwork becomes a living digital record. Registrata assembles metadata, provenance timelines, and research citations into a single source of truth.",
    highlights: ["Hours, not weeks", "Single source of truth", "Audit-ready"],
  },
  {
    id: "02",
    title: "AI-Driven Research",
    subtitle: "Provenance Research",
    description:
      "AI queries 16+ data sources simultaneously, reconciles conflicts, and source-attributes every claim. Experts review and approve.",
    highlights: ["Weeks → hours", "90% labor reduction", "Defensible provenance"],
  },
  {
    id: "03",
    title: "AI-Assisted Catalogs",
    subtitle: "Catalog Production",
    description:
      "AI generates standardized, catalog-ready entries. Review workflows ensure expert authority and full traceability.",
    highlights: ["Faster cycles", "Consistent quality", "Full traceability"],
  },
  {
    id: "04",
    title: "Data-Driven Valuation",
    subtitle: "Valuation & Reserve",
    description:
      "AI models incorporate auction history, comparables, artist momentum, and liquidity for predictive support.",
    highlights: ["Data-backed reserves", "Reduced guesswork", "Market-aligned"],
  },
  {
    id: "05",
    title: "Risk Scoring & Prioritization",
    subtitle: "Authenticity & Risk",
    description:
      "AI generates confidence scores based on provenance continuity, document credibility, and market consistency.",
    highlights: ["Early risk detection", "Fewer surprises", "Stronger defensibility"],
  },
  {
    id: "06",
    title: "CRM-Driven Intelligence",
    subtitle: "Buyer Targeting",
    description:
      "Unified CRM tracks bid history, artist affinity, and collection themes. AI identifies high-probability bidders.",
    highlights: ["Higher engagement", "Faster velocity", "Automated matching"],
  },
  {
    id: "07",
    title: "Continuous Intelligence",
    subtitle: "Monitoring & Feedback",
    description:
      "Live auction feeds update valuation models, market alerts, and research context. Performance is visible to leadership.",
    highlights: ["Real-time support", "Continuous learning", "Executive visibility"],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950 via-ink-900/80 to-ink-950" />
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-primary-500/10 blur-[140px]" />
        <div className="absolute -bottom-32 left-0 h-96 w-96 rounded-full bg-primary-600/10 blur-[160px]" />

        <div className="container relative z-10 py-20">
          <div className="max-w-4xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">
              <Sparkles className="h-3.5 w-3.5" />
              Registrata AI Suite
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-white md:text-6xl">
              Provenance intelligence, rebuilt for enterprise-scale collections.
            </h1>
            <p className="text-lg text-text-secondary md:text-xl">
              Registrata unifies intake, research, catalog production, valuation, risk, CRM, and monitoring into a single
              AI-amplified operating system.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/auth">Sign in</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard">Launch workspace</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-16">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Process Map</p>
            <h2 className="text-3xl font-semibold text-white">Registrata-enabled operations</h2>
          </div>
          <Link
            href="/dashboard"
            className="hidden items-center gap-2 text-sm text-primary-300 md:flex"
          >
            Explore the workflow <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {PROCESS_STEPS.map((step) => (
            <div
              key={step.id}
              className="group relative overflow-hidden rounded-2xl border border-primary-500/20 bg-gradient-card p-6 shadow-card"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/8 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative z-10">
                <div className="text-xs uppercase tracking-[0.25em] text-text-muted">{step.subtitle}</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/15 text-primary-200">
                    {step.id}
                  </div>
                  <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                </div>
                <p className="mt-3 text-sm text-text-secondary">{step.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {step.highlights.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs text-primary-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
