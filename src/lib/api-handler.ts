/**
 * API Route Handler Utilities
 */

import { NextResponse } from 'next/server';
import { formatErrorResponse, getErrorStatusCode, logError } from './errors';

/**
 * Wrap API route handler with error handling
 */
export function apiHandler<T = unknown>(handler: (req: Request) => Promise<T>) {
  return async (req: Request) => {
    try {
      const result = await handler(req);
      return NextResponse.json(result);
    } catch (error) {
      logError(error, {
        method: req.method,
        url: req.url,
      });

      return NextResponse.json(
        formatErrorResponse(error),
        { status: getErrorStatusCode(error) }
      );
    }
  };
}

/**
 * Validate required fields in request body
 */
export function validateRequired<T extends Record<string, unknown>>(
  data: unknown,
  fields: (keyof T)[]
): asserts data is T {
  const obj = (data ?? {}) as Record<string, unknown>;
  const missing = fields.filter((field) => obj[field as string] === undefined || obj[field as string] === null);

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Parse and validate JSON request body
 */
export async function parseJsonBody<T = unknown>(req: Request): Promise<T> {
  try {
    return await req.json();
  } catch {
    throw new Error('Invalid JSON in request body');
  }
}

/**
 * Get query parameter from URL
 */
export function getQueryParam(req: Request, param: string): string | null {
  const url = new URL(req.url);
  return url.searchParams.get(param);
}

/**
 * Get required query parameter from URL
 */
export function getRequiredQueryParam(req: Request, param: string): string {
  const value = getQueryParam(req, param);
  if (!value) {
    throw new Error(`Missing required query parameter: ${param}`);
  }
  return value;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

/**
 * Validate file type
 */
export function validateFileType(filename: string, allowedTypes: string[]): boolean {
  const ext = getFileExtension(filename);
  return allowedTypes.includes(ext);
}

/**
 * Generate storage path for document
 */
export function generateStoragePath(objectId: string, filename: string): string {
  const timestamp = Date.now();
  const safeName = sanitizeFilename(filename);
  return `objects/${objectId}/${timestamp}-${safeName}`;
}
