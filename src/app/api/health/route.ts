import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Health Check Endpoint
 *
 * Verifies:
 * - Supabase connectivity
 * - OpenAI API key presence
 * - Environment configuration
 *
 * Returns 200 OK if all checks pass, 503 Service Unavailable otherwise
 */
export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    checks: {
      supabase: { status: 'unknown' as 'pass' | 'fail' | 'unknown', message: '' },
      openai: { status: 'unknown' as 'pass' | 'fail' | 'unknown', message: '' },
      environment: { status: 'unknown' as 'pass' | 'fail' | 'unknown', message: '' },
    },
  };

  // Check environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
  ];

  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    checks.checks.environment.status = 'fail';
    checks.checks.environment.message = `Missing environment variables: ${missingEnvVars.join(', ')}`;
    checks.status = 'unhealthy';
  } else {
    checks.checks.environment.status = 'pass';
    checks.checks.environment.message = 'All required environment variables present';
  }

  // Check Supabase connectivity
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Simple query to test database connectivity
    const { error } = await supabase.from('orgs').select('count').limit(1);

    if (error) {
      checks.checks.supabase.status = 'fail';
      checks.checks.supabase.message = `Database error: ${error.message}`;
      checks.status = 'unhealthy';
    } else {
      checks.checks.supabase.status = 'pass';
      checks.checks.supabase.message = 'Database connection successful';
    }
  } catch (error) {
    checks.checks.supabase.status = 'fail';
    checks.checks.supabase.message = `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    checks.status = 'unhealthy';
  }

  // Check OpenAI API key presence (we don't make an actual API call to avoid costs)
  if (process.env.OPENAI_API_KEY) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey.startsWith('sk-') && apiKey.length > 20) {
      checks.checks.openai.status = 'pass';
      checks.checks.openai.message = 'OpenAI API key configured (format validated)';
    } else {
      checks.checks.openai.status = 'fail';
      checks.checks.openai.message = 'OpenAI API key format invalid';
      checks.status = 'degraded';
    }
  } else {
    checks.checks.openai.status = 'fail';
    checks.checks.openai.message = 'OpenAI API key not configured';
    checks.status = 'degraded';
  }

  // Determine overall status
  const httpStatus = checks.status === 'healthy' ? 200 : 503;

  return NextResponse.json(checks, { status: httpStatus });
}
