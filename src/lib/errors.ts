/**
 * Error Handling Utilities for Registrata
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Not authorized') {
    super(message, 'AUTHZ_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
  }
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
      code: 'INTERNAL_ERROR',
    };
  }

  return {
    error: 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
  };
}

/**
 * Get HTTP status code from error
 */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Format error for user display
 */
export function getUserFriendlyError(error: unknown): string {
  if (error instanceof ValidationError) {
    return error.message;
  }

  if (error instanceof AuthenticationError) {
    return 'Please sign in to continue.';
  }

  if (error instanceof AuthorizationError) {
    return 'You do not have permission to perform this action.';
  }

  if (error instanceof NotFoundError) {
    return error.message;
  }

  if (error instanceof ConflictError) {
    return error.message;
  }

  if (error instanceof RateLimitError) {
    return 'Too many requests. Please try again later.';
  }

  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Don't expose internal error details to users
    return 'An unexpected error occurred. Please try again.';
  }

  return 'Something went wrong. Please try again.';
}

/**
 * Log error with context
 */
export function logError(error: unknown, context?: Record<string, unknown>) {
  console.error('[Error]', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Wrap async handler with error handling
 */
type AsyncHandler<Args extends unknown[], Result> = (...args: Args) => Promise<Result>;

export function withErrorHandling<Args extends unknown[], Result, T extends AsyncHandler<Args, Result>>(
  handler: T
): T {
  return (async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      logError(error, { handler: handler.name });
      throw error;
    }
  }) as T;
}
