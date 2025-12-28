/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');

const filePath = './src/app/api/ai/process/route.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// Replace the corrupted section
const oldBad = `    // 5.5) Insert suggested events into provenance_events (pending review)
    const events = Array.isArray(parsed?.suggested_events) ? parsed.suggested_events : [];

    const toInsert = events
      .filter((e: any) => (typeof e?.confidence === ''number'' ? e.confidence : 0) >= 0.55)
      .slice(0, 25) // safety cap
      .map((e: any) => ({
        org_id: job.org_id,
        object_id: job.object_id,
        event_date: e.event_date || null,
        event_type: e.event_type || ''other'',
        description: e.description || '''',
        parties: Array.isArray(e.parties) ? e.parties.join('', '') : null,
        location: e.location || null,
        status: ''pending'',
        confidence: typeof e.confidence === ''number'' ? e.confidence : null,
        source_extraction_id: jobId,
        evidence: e.evidence || null,
      }));

    // Only insert if we have rows and provenance_events supports these fields
    if (toInsert.length) {
      // If your provenance_events schema doesn''t have some of these cols (evidence/parties/location),
      // tell me and I''ll align it exactly. This will error clearly.
      const { error: peErr } = await admin.from(''provenance_events'').insert(toInsert);
      if (peErr) {
        // Don''t fail the whole job if event insert failsstore error on extraction.
        await admin
          .from(''ai_extractions'')
          .update({ error: \\Event insert failed: \\ })
          .eq(''id'', jobId);
      }
    }`;

const newGood = `    // 5.5) Insert suggested events into provenance_events (pending review)
    const events = Array.isArray(parsed?.suggested_events) ? parsed.suggested_events : [];

    const toInsert = events
      .filter((e: any) => (typeof e?.confidence === "number" ? e.confidence : 0) >= 0.55)
      .slice(0, 25) // safety cap
      .map((e: any) => ({
        org_id: job.org_id,
        object_id: job.object_id,
        event_date: e.event_date || null,
        event_type: e.event_type || "other",
        description: e.description || "",
        parties: Array.isArray(e.parties) ? e.parties.join(", ") : null,
        location: e.location || null,
        status: "pending",
        confidence: typeof e.confidence === "number" ? e.confidence : null,
        source_extraction_id: jobId,
        evidence: e.evidence || null,
      }));

    // Only insert if we have rows and provenance_events supports these fields
    if (toInsert.length) {
      // If your provenance_events schema doesn't have some of these cols (evidence/parties/location),
      // tell me and I'll align it exactly. This will error clearly.
      const { error: peErr } = await admin.from("provenance_events").insert(toInsert);
      if (peErr) {
        // Don't fail the whole job if event insert fails—store error on extraction.
        await admin
          .from("ai_extractions")
          .update({ error: \`Event insert failed: \${peErr.message}\` })
          .eq("id", jobId);
      }
    }`;

if (content.includes(oldBad)) {
  content = content.replace(oldBad, newGood);
  fs.writeFileSync(filePath, content);
  console.log('✓ File fixed successfully');
} else {
  console.error('✗ Could not find the corrupted section to fix');
  process.exit(1);
}
