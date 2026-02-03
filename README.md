# Registrata

AI-amplified art intelligence platform for auction houses, galleries, and museums. Built with Next.js, Supabase, and OpenAI.

## Features

- 7-stage Registrata workflow from intake to monitoring
- AI-powered OCR, provenance extraction, and catalog generation
- Data-driven valuation and risk scoring
- CRM-driven buyer intelligence
- Multi-tenant architecture with RLS isolation

## Navigation Map

- `/dashboard` — Executive overview and live intelligence
- `/intake` — Structured object intake
- `/research` — AI research + provenance evidence
- `/catalog` — AI-assisted catalog production
- `/valuation` — Reserve guidance + comparables
- `/risk` — Risk scoring + prioritization
- `/buyers` — CRM-driven intelligence
- `/monitoring` — Market alerts + activity feed

## Page Responsibilities

- Dashboard: executive summary with intake and AI pulse.
- Intake: intake queue and artwork creation.
- Research: AI extractions and provenance events review.
- Catalog: catalog generation queue.
- Valuation: data-driven reserve guidance.
- Risk: provenance risk signals.
- Buyers: CRM buyer network and targeting.
- Monitoring: sales monitoring and audit activity.

## Quick Start

### 1. Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env.local
```

Set variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=sk-proj-your_key
```

### 4. Database Setup

Supabase migrations live in `supabase/migrations`. Run:

```bash
npm run db:push
```

### 5. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Tech Stack

- Framework: Next.js 16 (App Router)
- Language: TypeScript 5.9
- Database: Supabase (PostgreSQL)
- Storage: Supabase Storage
- Auth: Supabase Auth
- AI: OpenAI GPT-4o-mini
- Styling: Tailwind CSS + shadcn/ui
- Forms: react-hook-form + zod
- Icons: lucide-react

## Documentation

- `docs/production.md`
- `docs/cron-worker.md`
- `docs/implementation-guide.md`
- `docs/ui-enhancements.md`
