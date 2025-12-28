import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import crypto from 'crypto';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function extFromPath(p: string) {
  const i = p.lastIndexOf('.');
  return i >= 0 ? p.slice(i + 1).toLowerCase() : '';
}

async function fileToText(buf: ArrayBuffer, filename: string): Promise<string> {
  const ext = extFromPath(filename);

  // Plain text
  if (['txt', 'csv', 'json'].includes(ext)) {
    return new TextDecoder('utf-8').decode(new Uint8Array(buf));
  }

  const buffer = Buffer.from(new Uint8Array(buf));

  // PDF OCR
  if (ext === 'pdf') {
    const file = await openai.files.create({
      purpose: 'user_data',
      file: new File([buffer], filename, { type: 'application/pdf' }),
    });

    const resp = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_file', file_id: file.id },
            {
              type: 'input_text',
              text:
                'Extract ALL readable text from this PDF. ' +
                'Return plain text only. Preserve line breaks.',
            },
          ],
        },
      ],
    });

    return resp.output_text || '';
  }

  // Image OCR
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    const base64 = buffer.toString('base64');
    const mime =
      ext === 'png'
        ? 'image/png'
        : ext === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'OCR this image. Extract ALL visible text verbatim.' },
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${base64}` },
            },
          ],
        },
      ],
    });

    return completion.choices[0]?.message?.content || '';
  }

  return `UNSUPPORTED_FILE_TYPE: ${filename}`;
}

/**
 * Generate deterministic hash for event deduplication
 */
function generateEventHash(event: {
  event_date?: string | null;
  event_type: string;
  description: string;
  parties?: string | null;
  location?: string | null;
}): string {
  const normalized = {
    event_date: event.event_date || '',
    event_type: event.event_type || '',
    description: (event.description || '').trim().toLowerCase(),
    parties: (event.parties || '').trim().toLowerCase(),
    location: (event.location || '').trim().toLowerCase(),
  };

  const hashInput = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Background Worker: Process Next Queued AI Job
 *
 * This endpoint is designed to be called by a cron job or serverless function.
 * It finds the oldest queued job, processes it, and returns.
 *
 * Features:
 * - Idempotent event insertion (via event_hash)
 * - Retry logic with exponential backoff
 * - Detailed error logging
 */
export async function POST(_req: Request) {
  const admin = getAdmin();
  void _req;

  try {
    // 1) Find oldest queued job that's ready to process
    const now = new Date().toISOString();
    const { data: jobs, error: fetchErr } = await admin
      .from('ai_extractions')
      .select('*')
      .eq('status', 'queued')
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchErr) {
      return NextResponse.json(
        { ok: false, processed: false, message: fetchErr.message },
        { status: 500 }
      );
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: false,
        message: 'No queued jobs to process',
      });
    }

    const job = jobs[0];
    const jobId = job.id;

    // 2) Mark job as processing
    await admin
      .from('ai_extractions')
      .update({
        status: 'processing',
        error: null,
        attempts: (job.attempts || 0) + 1,
        last_attempt_at: now,
      })
      .eq('id', jobId);

    // 3) Load object
    const { data: obj, error: objErr } = await admin
      .from('objects')
      .select('*')
      .eq('id', job.object_id)
      .single();

    if (objErr || !obj) {
      throw new Error(`Object not found: ${job.object_id}`);
    }

    // 4) Load document and extract text
    let extractedText = '';
    let docMeta = null;

    if (job.doc_id) {
      const { data: doc, error: docErr } = await admin
        .from('object_docs')
        .select('*')
        .eq('id', job.doc_id)
        .single();

      if (docErr || !doc) {
        throw new Error(`Document not found: ${job.doc_id}`);
      }

      docMeta = doc;

      const { data: blob, error: dlErr } = await admin.storage
        .from('object-docs')
        .download(doc.storage_path);

      if (dlErr || !blob) {
        throw new Error(`Failed to download file: ${doc.storage_path}`);
      }

      extractedText = await fileToText(await blob.arrayBuffer(), doc.storage_path);
    } else {
      extractedText = `Manual extraction for ${obj.title}`;
    }

    // 5) AI Provenance Extraction
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a provenance analysis assistant. Analyze documents for provenance events. Return JSON ONLY.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            object: obj,
            document: docMeta,
            extracted_text: extractedText.slice(0, 120000),
            instructions:
              'Extract provenance events from the text. For each event, provide: event_date (YYYY-MM-DD or null), event_type (sale, exhibition, ownership change, creation, restoration, authentication, etc.), description, parties (comma-separated names), location, evidence (quote from text), confidence (0-1). Return as: { "suggested_events": [ {...}, {...} ] }',
          }),
        },
      ],
    });

    type SuggestedEvent = {
      event_date?: string;
      event_type?: string;
      description?: string;
      parties?: string[] | string;
      location?: string;
      confidence?: number;
      evidence?: string;
    };
    type ParsedExtraction = { suggested_events?: SuggestedEvent[] };

    let parsed: ParsedExtraction = {};
    try {
      const json = JSON.parse(completion.choices[0].message.content || '{}');
      if (json && typeof json === 'object') {
        parsed = json as ParsedExtraction;
      }
    } catch {
      parsed = {};
    }

    // 6) Insert provenance events with idempotency
    const events = Array.isArray(parsed.suggested_events) ? parsed.suggested_events : [];

    const inserts = events
      .filter((e) => typeof e.confidence === 'number' && e.confidence >= 0.55)
      .map((e) => {
        const eventData = {
          event_date: e.event_date || null,
          event_type: e.event_type || 'other',
          description: e.description || '',
          parties: Array.isArray(e.parties)
            ? e.parties.join(', ')
            : typeof e.parties === 'string'
            ? e.parties
            : null,
          location: e.location || null,
        };

        return {
          org_id: job.org_id,
          object_id: job.object_id,
          ...eventData,
          status: 'pending' as const,
          confidence: typeof e.confidence === 'number' ? e.confidence : null,
          source_extraction_id: jobId,
          evidence: e.evidence || null,
          event_hash: generateEventHash(eventData),
        };
      });

    if (inserts.length > 0) {
      // Insert with ON CONFLICT DO NOTHING via upsert with ignoreDuplicates
      // Supabase doesn't have ignoreDuplicates, so we'll try insert and catch duplicates
      const { error: insertErr } = await admin
        .from('provenance_events')
        .insert(inserts);

      // Ignore duplicate key violations (23505)
      if (insertErr && !insertErr.message.includes('duplicate') && !insertErr.code?.includes('23505')) {
        throw insertErr;
      }
    }

    // 7) Mark job as done
    await admin
      .from('ai_extractions')
      .update({
        status: 'done',
        extracted_text: extractedText,
        extracted_json: parsed,
        error: null,
        next_attempt_at: null,
      })
      .eq('id', jobId);

    return NextResponse.json({
      ok: true,
      processed: true,
      jobId,
      eventsCreated: inserts.length,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log error
    console.error('[AI Worker Error]', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // If we have a job ID, mark it as failed or retry
    try {
      const { data: jobs } = await admin
        .from('ai_extractions')
        .select('id, attempts')
        .eq('status', 'processing')
        .limit(1);

      if (jobs && jobs.length > 0) {
        const job = jobs[0];
        const maxAttempts = 3;
        const attempts = job.attempts || 1;

        if (attempts >= maxAttempts) {
          // Mark as failed
          await admin
            .from('ai_extractions')
            .update({
              status: 'failed',
              error: errorMessage,
              next_attempt_at: null,
            })
            .eq('id', job.id);
        } else {
          // Schedule retry with exponential backoff
          const backoffMinutes = Math.pow(2, attempts) * 5; // 10, 20, 40 minutes
          const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

          await admin
            .from('ai_extractions')
            .update({
              status: 'queued',
              error: errorMessage,
              next_attempt_at: nextAttempt,
            })
            .eq('id', job.id);
        }
      }
    } catch (updateErr) {
      console.error('[Failed to update job status]', updateErr);
    }

    return NextResponse.json(
      {
        ok: false,
        processed: false,
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for manual testing
 * In production, only POST should be used by cron
 */
export async function GET() {
  return POST(new Request('http://localhost:3000/api/ai/process-next', { method: 'POST' }));
}
