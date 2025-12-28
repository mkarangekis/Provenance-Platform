# Background AI Worker - Cron Job Setup

## Overview

The background AI worker processes queued document extraction jobs asynchronously. Instead of making users wait for AI processing to complete, documents are queued and processed in the background by a cron job.

## How It Works

1. User uploads a document → Creates an `ai_extractions` record with `status='queued'`
2. Cron job calls `/api/ai/process-next` every N minutes
3. Worker picks up the oldest queued job
4. Processes the job (OCR + AI extraction)
5. Inserts provenance events idempotently
6. Marks job as `done` or `failed`
7. Repeats

## Features

### Idempotency

Events are deduplicated using `event_hash` (SHA-256 of normalized event data). If the same event is extracted multiple times, only one record is created.

**Unique constraint:**
```sql
CREATE UNIQUE INDEX idx_provenance_events_dedup
  ON provenance_events(object_id, event_hash, source_extraction_id)
  WHERE event_hash IS NOT NULL AND source_extraction_id IS NOT NULL;
```

### Retry Logic

Jobs that fail are automatically retried with exponential backoff:

- Attempt 1: Immediate
- Attempt 2: 10 minutes later
- Attempt 3: 20 minutes later
- After 3 failures: Marked as `failed`

**Database fields:**
- `attempts` - Number of processing attempts
- `last_attempt_at` - Timestamp of last attempt
- `next_attempt_at` - When to retry (null = ready now)

### Error Handling

Errors are captured and stored in the `error` field of `ai_extractions`. This allows admins to review and debug failures.

## Vercel Cron Setup

### Option 1: Vercel Cron (Recommended for Production)

Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/ai/process-next",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This runs the worker every 5 minutes.

**Cron Schedule Examples:**
- `*/5 * * * *` - Every 5 minutes
- `*/10 * * * *` - Every 10 minutes
- `*/30 * * * *` - Every 30 minutes
- `0 * * * *` - Every hour

**Important:**
- Vercel Cron is available on Pro plans and above
- Hobby plans: Use external cron services (see Option 2)

### Option 2: External Cron Service (Free Alternative)

Use a free cron service like:
- [cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)
- GitHub Actions

**GitHub Actions Example:**

Create `.github/workflows/cron-worker.yml`:

```yaml
name: AI Worker Cron

on:
  schedule:
    - cron: '*/5 * * * *' # Every 5 minutes
  workflow_dispatch: # Allow manual trigger

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Call worker endpoint
        run: |
          curl -X POST https://your-app.vercel.app/api/ai/process-next \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

**Add authentication** to prevent abuse:

In `src/app/api/ai/process-next/route.ts`, add:

```typescript
export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('Authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ... rest of worker code
}
```

Set `CRON_SECRET` in Vercel environment variables.

## Manual Testing

### Test the worker endpoint

```bash
# Using curl
curl -X POST http://localhost:3000/api/ai/process-next

# Or visit in browser (GET also works for testing)
http://localhost:3000/api/ai/process-next
```

### Expected responses

**Success (job processed):**
```json
{
  "ok": true,
  "processed": true,
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "eventsCreated": 3
}
```

**No jobs queued:**
```json
{
  "ok": true,
  "processed": false,
  "message": "No queued jobs to process"
}
```

**Error:**
```json
{
  "ok": false,
  "processed": false,
  "message": "Error details here"
}
```

## Monitoring

### Check job status

```sql
SELECT
  id,
  status,
  attempts,
  error,
  created_at,
  last_attempt_at,
  next_attempt_at
FROM ai_extractions
WHERE status IN ('queued', 'processing', 'failed')
ORDER BY created_at DESC;
```

### View processing stats

```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(attempts) as avg_attempts
FROM ai_extractions
GROUP BY status;
```

### Find stuck jobs

Jobs stuck in "processing" for > 10 minutes:

```sql
SELECT *
FROM ai_extractions
WHERE status = 'processing'
  AND last_attempt_at < NOW() - INTERVAL '10 minutes';
```

To reset stuck jobs:

```sql
UPDATE ai_extractions
SET status = 'queued', next_attempt_at = NOW()
WHERE status = 'processing'
  AND last_attempt_at < NOW() - INTERVAL '10 minutes';
```

## Scaling Considerations

### High Volume

For high document volume, consider:

1. **Multiple workers:** Run multiple instances of the worker in parallel
   - Each picks up a different job (use row locking or unique status)
   - Prevent race conditions with `SELECT FOR UPDATE SKIP LOCKED`

2. **Prioritization:** Add a `priority` field to `ai_extractions`
   - Process high-priority jobs first

3. **Dedicated queue service:**
   - Use AWS SQS, Google Cloud Tasks, or Upstash Queue
   - More reliable than polling database

### Cost Optimization

**OpenAI API costs:**
- Monitor token usage in OpenAI dashboard
- Set monthly spending limits
- Consider using GPT-4o-mini for extractions (cheaper)
- Batch similar documents

**Vercel function costs:**
- Workers on Vercel have execution time limits
- Hobby: 10s, Pro: 60s, Enterprise: 900s
- For long processing, consider separate worker service

## Troubleshooting

### Worker not processing jobs

1. Check cron is configured and running
2. Verify `CRON_SECRET` matches (if using auth)
3. Check Vercel function logs
4. Ensure OpenAI API key is valid
5. Check job `next_attempt_at` is not in the future

### Events not appearing

1. Check event confidence threshold (currently 0.55)
2. Review `extracted_json` in `ai_extractions` to see what was extracted
3. Check for duplicate events (idempotency may be preventing duplicates)
4. Verify RLS policies allow event insertion

### Jobs failing repeatedly

1. Check `error` field in `ai_extractions`
2. Common issues:
   - OpenAI rate limit hit
   - Invalid document format
   - Storage path incorrect
   - Insufficient OpenAI credits

## Health Check Integration

The `/api/health` endpoint checks OpenAI key presence. Monitor this endpoint to ensure worker can run:

```bash
curl https://your-app.vercel.app/api/health
```

Should return:
```json
{
  "status": "healthy",
  "checks": {
    "openai": { "status": "pass" },
    ...
  }
}
```

## Future Enhancements

- [ ] Real-time progress updates via WebSocket
- [ ] Admin dashboard for job monitoring
- [ ] Bulk job creation for multiple documents
- [ ] Priority queue implementation
- [ ] Dead letter queue for permanently failed jobs
- [ ] Metrics and analytics (avg processing time, success rate)
