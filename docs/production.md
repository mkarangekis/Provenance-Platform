# Production Deployment Checklist

## Pre-Deployment Requirements

### Environment Variables

Ensure all required environment variables are configured in your Vercel project:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=sk-proj-your_key

# Production URLs (Auto-configured by Vercel)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Database Setup

1. **Run Database Migrations**
   - Execute `docs/schema.sql` in Supabase SQL Editor
   - Verify all tables created: orgs, profiles, objects, object_docs, ai_extractions, provenance_events, org_members, invites, audit_log

2. **Enable RLS Policies**
   - Execute `docs/rls-policies.sql` in Supabase SQL Editor
   - Test policies with different org contexts
   - Verify row-level isolation between organizations

3. **Configure Storage Bucket**
   - Create `object-docs` bucket (if not exists)
   - Set bucket to **private**
   - Apply storage policies from `docs/storage-policies.sql`
   - Verify folder structure enforcement: `{org_id}/{object_id}/{uuid}.{ext}`

### Security Checklist

- [ ] Service role key is NOT in client-side code
- [ ] All API routes validate user authentication
- [ ] All API routes verify org membership before operations
- [ ] RLS policies enforce org_id scoping on all tables
- [ ] Storage policies prevent cross-org access
- [ ] CORS configured for production domain only
- [ ] Rate limiting enabled on API routes (via Vercel)
- [ ] Sensitive errors not exposed to client

### Authentication Configuration

1. **Supabase Auth Settings**
   - Add production URL to allowed redirect URLs
   - Configure email templates (invite, password reset)
   - Set JWT expiry appropriately (default: 1 hour)
   - Enable email confirmations (optional)

2. **Production Auth URLs**
   ```
   Site URL: https://your-app.vercel.app
   Redirect URLs:
   - https://your-app.vercel.app/auth/callback
   - https://your-app.vercel.app/dashboard
   ```

### AI Processing Setup

1. **OpenAI Configuration**
   - Verify API key has sufficient credits
   - Set usage limits/alerts in OpenAI dashboard
   - Monitor token consumption

2. **Background Worker**
   - Deploy Vercel Cron job for `/api/ai/process-next`
   - Configure cron schedule (see `docs/cron-worker.md`)
   - Test worker manually before enabling cron
   - Set up error alerts (Vercel Monitoring or external)

### Build Verification

```bash
# Local build test
npm run build

# Check for:
- No TypeScript errors
- No ESLint errors
- All API routes compile
- Environment variables loaded correctly
```

### Post-Deployment Tests

1. **Authentication Flow**
   - [ ] Sign up new user
   - [ ] Sign in existing user
   - [ ] Sign out
   - [ ] Password reset (if enabled)

2. **Organization Setup**
   - [ ] Create organization
   - [ ] Verify org_id assignment
   - [ ] Check profile creation

3. **Object Management**
   - [ ] Create object
   - [ ] Upload document
   - [ ] View object detail page

4. **AI Processing**
   - [ ] Queue AI extraction
   - [ ] Process extraction (manual trigger)
   - [ ] Verify events created
   - [ ] Check event approval workflow

5. **Multi-Tenancy**
   - [ ] Create second org with different user
   - [ ] Verify data isolation (no cross-org access)
   - [ ] Test RLS policies enforce boundaries

6. **Health Check**
   - [ ] Visit `/health` endpoint
   - [ ] Verify Supabase connectivity
   - [ ] Verify OpenAI key present

### Monitoring & Alerts

1. **Vercel Monitoring**
   - Enable function logs
   - Set up error alerts
   - Monitor function execution times
   - Track API route performance

2. **Supabase Monitoring**
   - Check database usage
   - Monitor storage consumption
   - Review auth metrics
   - Set up database alerts

3. **OpenAI Monitoring**
   - Track API usage
   - Set spending limits
   - Monitor rate limits

### Performance Optimization

- [ ] Enable Vercel Analytics
- [ ] Configure edge caching for static assets
- [ ] Optimize image delivery (if applicable)
- [ ] Database indexes on frequently queried columns
- [ ] Connection pooling configured (Supabase default)

### Backup & Recovery

1. **Database Backups**
   - Verify Supabase automatic backups enabled
   - Test point-in-time recovery (if on Pro plan)
   - Export schema regularly

2. **Storage Backups**
   - Document storage bucket structure
   - Plan for disaster recovery
   - Consider S3 replication (advanced)

### Compliance & Legal

- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] GDPR compliance verified (if EU users)
- [ ] Data retention policy documented
- [ ] User data export capability

### Rollback Plan

1. **Vercel Deployments**
   - Previous deployments available in Vercel dashboard
   - Instant rollback via Vercel UI
   - Document rollback procedure

2. **Database Changes**
   - Keep migration rollback scripts
   - Test rollback locally before applying
   - Never drop columns in production without backup

### Go-Live Checklist

- [ ] All environment variables configured
- [ ] Database schema deployed
- [ ] RLS policies enabled
- [ ] Storage policies configured
- [ ] Auth redirect URLs updated
- [ ] Build passes locally
- [ ] Build passes on Vercel
- [ ] Health check returns 200
- [ ] Manual test of core flows
- [ ] Monitoring configured
- [ ] Error alerts configured
- [ ] Team notified of deployment

## Support & Troubleshooting

### Common Issues

**Issue: "Failed to fetch" errors**
- Check CORS configuration
- Verify API routes deployed
- Check Vercel function logs

**Issue: RLS policy denies access**
- Verify user has org_id in profiles table
- Check RLS policy logic
- Test with service role key (bypasses RLS)

**Issue: Storage upload fails**
- Verify bucket exists and is private
- Check storage policies
- Verify file size limits

**Issue: AI processing fails**
- Check OpenAI API key validity
- Verify sufficient credits
- Check function timeout (max 60s on Vercel Hobby)

### Getting Help

- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- OpenAI Docs: https://platform.openai.com/docs
- Project Issues: [GitHub repo if applicable]

## Maintenance

### Regular Tasks

- Weekly: Review error logs
- Monthly: Check database size and performance
- Monthly: Review OpenAI usage and costs
- Quarterly: Security audit
- Quarterly: Dependency updates

### Version Updates

```bash
# Update dependencies
npm update

# Check for breaking changes
npm outdated

# Test thoroughly before deploying
npm run build
npm run dev
```
