-- ============================================================================
-- PROVENANCE PULSE - STORAGE BUCKET POLICIES
-- ============================================================================
-- Supabase Storage RLS policies for object-docs bucket
--
-- IMPORTANT: Create the bucket first, then apply these policies
--
-- ============================================================================

-- ============================================================================
-- BUCKET CREATION
-- ============================================================================
--
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create new bucket: "object-docs"
-- 3. Set bucket to PRIVATE (not public)
-- 4. Then run the policies below in the SQL Editor
--
-- Or run this SQL to create the bucket:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('object-docs', 'object-docs', false)
-- ON CONFLICT (id) DO NOTHING;
--
-- ============================================================================

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Allow users to SELECT (download) documents in their org's folders
CREATE POLICY "Users can download org documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'object-docs'
    AND (
      -- Path should start with: objects/{object_id}/
      -- We need to verify the object belongs to user's org
      EXISTS (
        SELECT 1 FROM objects
        WHERE objects.id::text = split_part(storage.objects.name, '/', 2)
        AND objects.org_id = current_org_id()
      )
    )
  );

-- Allow members to INSERT (upload) documents to their org's object folders
CREATE POLICY "Members can upload org documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'object-docs'
    AND has_min_role('member')
    AND (
      -- Enforce folder structure: objects/{object_id}/{filename}
      -- Verify object belongs to user's org
      EXISTS (
        SELECT 1 FROM objects
        WHERE objects.id::text = split_part(storage.objects.name, '/', 2)
        AND objects.org_id = current_org_id()
      )
    )
  );

-- Allow members to UPDATE documents in their org's folders
CREATE POLICY "Members can update org documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'object-docs'
    AND has_min_role('member')
    AND (
      EXISTS (
        SELECT 1 FROM objects
        WHERE objects.id::text = split_part(storage.objects.name, '/', 2)
        AND objects.org_id = current_org_id()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'object-docs'
    AND has_min_role('member')
    AND (
      EXISTS (
        SELECT 1 FROM objects
        WHERE objects.id::text = split_part(storage.objects.name, '/', 2)
        AND objects.org_id = current_org_id()
      )
    )
  );

-- Allow admins to DELETE documents in their org's folders
CREATE POLICY "Admins can delete org documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'object-docs'
    AND has_min_role('admin')
    AND (
      EXISTS (
        SELECT 1 FROM objects
        WHERE objects.id::text = split_part(storage.objects.name, '/', 2)
        AND objects.org_id = current_org_id()
      )
    )
  );

-- ============================================================================
-- FOLDER STRUCTURE ENFORCEMENT
-- ============================================================================
--
-- Recommended folder structure:
-- objects/{object_id}/{timestamp}-{sanitized_filename}.{ext}
--
-- Example:
-- objects/123e4567-e89b-12d3-a456-426614174000/1703001234567-receipt.pdf
--
-- This structure:
-- 1. Groups documents by object for easy organization
-- 2. Prevents filename collisions with timestamp prefix
-- 3. Allows RLS to verify object ownership via split_part()
-- 4. Makes it easy to delete all docs for an object
--
-- ============================================================================

-- ============================================================================
-- TESTING STORAGE POLICIES
-- ============================================================================
--
-- 1. Sign in as test user
-- 2. Create an object in their org
-- 3. Upload a document to: objects/{object_id}/test.pdf
-- 4. Verify upload succeeds
-- 5. Sign in as different user (different org)
-- 6. Try to download the document
-- 7. Verify download is denied (403 Forbidden)
--
-- ============================================================================

-- ============================================================================
-- SIGNED URLS
-- ============================================================================
--
-- For downloading private documents, generate signed URLs:
--
-- const { data } = await supabase.storage
--   .from('object-docs')
--   .createSignedUrl('objects/123/file.pdf', 600) // 10 min expiry
--
-- RLS policies still apply to signed URL generation
-- Only users with SELECT access can create signed URLs
--
-- ============================================================================

-- ============================================================================
-- FILE SIZE LIMITS
-- ============================================================================
--
-- Configure file size limits in Supabase Dashboard > Storage Settings
--
-- Recommended limits:
-- - Max file size: 50 MB (configurable up to 5 GB on Pro plan)
-- - Allowed MIME types: application/pdf, image/png, image/jpeg, image/webp, text/plain, text/csv, application/json
--
-- Enforce in application code before upload:
--
-- if (file.size > 50 * 1024 * 1024) {
--   throw new Error('File too large (max 50MB)')
-- }
--
-- ============================================================================

-- ============================================================================
-- MIGRATION FROM OLD STRUCTURE
-- ============================================================================
--
-- If you have existing documents using a different structure,
-- you may need to migrate them:
--
-- Old structure: {org_id}/{object_id}/{uuid}.{ext}
-- New structure: objects/{object_id}/{timestamp}-{filename}.{ext}
--
-- Migration script (run in Node.js with Supabase admin client):
--
-- const { data: docs } = await supabase.from('object_docs').select('*')
-- for (const doc of docs) {
--   const oldPath = doc.storage_path
--   const newPath = oldPath.replace(/^([^\/]+)\//, 'objects/')
--   await supabase.storage.from('object-docs').move(oldPath, newPath)
--   await supabase.from('object_docs').update({ storage_path: newPath }).eq('id', doc.id)
-- }
--
-- ============================================================================

-- ============================================================================
-- CLEANUP ORPHANED FILES
-- ============================================================================
--
-- Periodically clean up files that have no corresponding object_docs record:
--
-- 1. List all files in bucket
-- 2. Query object_docs table
-- 3. Delete files not referenced in database
--
-- This can be done via cron job or manual cleanup script
--
-- ============================================================================
