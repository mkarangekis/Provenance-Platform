# Provenance Pulse

Enterprise SaaS platform for provenance tracking and AI-powered document extraction, built with Next.js, Supabase, and OpenAI.

## Features

- Multi-tenant architecture with RLS isolation
- AI-powered OCR and provenance extraction
- Review workflows with bulk approvals
- Export-ready object dossiers
- Auditable uploads and team collaboration

## Navigation Map

- `/dashboard` — Organization overview, stats, and recent activity
- `/objects` — Objects list, search, filters, pagination, and creation
- `/objects/[id]` — Object workspace with documents, timeline, AI, and export
- `/review` — Pending event review queue
- `/uploads` — Organization-wide upload audit
- `/settings` — Organization, members, billing, and security

## Page Responsibilities

- Dashboard: summarizes workload, recent objects, and AI activity.
- Objects: list management with filters and creation modal.
- Object detail: provenance workflow with approvals and AI extraction.
- Review: org-wide pending event queue with bulk actions.
- Uploads: audit trail for document uploads.
- Settings: org profile, invites, billing placeholder, and security status.

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

Run these SQL files in Supabase:

1. `docs/schema.sql`
2. `docs/rls-policies.sql`
3. Create a private storage bucket `object-docs`
4. `docs/storage-policies.sql`

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
