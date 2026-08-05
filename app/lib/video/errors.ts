import type { ErrorSeverity, ErrorCategory, JobError } from './types';
import { NON_RETRIABLE_CATEGORIES } from './constants';

/**
 * Options for creating a JobError.
 * All fields from JobError are present, but severity, timestamp, and stack
 * have sensible defaults derived from the provided values.
 */
export interface CreateJobErrorOptions {
  readonly code: string;
  readonly message: string;
  readonly category: ErrorCategory;
  readonly severity?: ErrorSeverity;
  readonly originalError?: Error;
  readonly timestamp?: Date;
  readonly stack?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Maps error categories to default severity levels when not explicitly provided.
 *
 * - validation: low — expected failure mode, user-correctable
 * - input: medium — data issue, may be transient or permanent
 * - processing: high — core pipeline failure, likely requires investigation
 * - output: high — write failure, potential data loss
 * - system: high — infrastructure failure, affects reliability
 * - timeout: medium — may succeed on retry with different conditions
 * - unknown: medium — unclassified, defaults to cautious severity
 */
const CATEGORY_SEVERITY_MAP: Readonly<Partial<Record<ErrorCategory, ErrorSeverity>>> = {
  validation: 'low',
  input: 'medium',
  processing: 'high',
  output: 'high',
  system: 'high',
  timeout: 'medium',
  unknown: 'medium',
} as const;

/**
 * Creates a fully-formed JobError instance with intelligent defaults.
 *
 * Automatic resolutions:
 * - **severity**: Derived from `category` via `CATEGORY_SEVERITY_MAP` if omitted
 * - **timestamp**: Set to `new Date()` if omitted
 * - **stack**: Extracted from `originalError.stack` if omitted and originalError is an Error instance
 *
 * @param options - The error creation options. `code`, `message`, and `category` are required.
 * @returns A complete JobError instance ready for assignment to a VideoJob.
 *
 * @example
 * ```typescript
 * const error = createJobError({
 *   code: 'INPUT_FILE_NOT_FOUND',
 *   message: 'The specified input file does not exist.',
 *   category: 'input',
 *   originalError: fsError,
 *   context: { path: '/videos/missing.mp4' },
 * });
 * ```
 */
export function createJobError(options: Readonly<CreateJobErrorOptions>): JobError {
  const {
    code,
    message,
    category,
    severity,
    originalError,
    timestamp,
    stack,
    context,
  } = options;

  const resolvedSeverity: ErrorSeverity = severity ?? resolveErrorSeverity(category);
  const resolvedTimestamp: Date = timestamp ?? new Date();
  const resolvedStack: string | undefined = stack ?? extractStack(originalError);

  return {
    code,
    message,
    category,
    severity: resolvedSeverity,
    originalError,
    timestamp: resolvedTimestamp,
    stack: resolvedStack,
    context,
  };
}

/**
 * Determines whether an error category is marked as non-retriable.
 *
 * Non-retriable categories represent failure modes where retrying
 * with the same input will always produce the same error.
 * For example, validation errors cannot be resolved by retry.
 *
 * @param category - The error category to evaluate.
 * @returns True if errors in this category should bypass retry logic.
 */
export function isNonRetriableCategory(category: ErrorCategory): boolean {
  return NON_RETRIABLE_CATEGORIES.has(category);
}

/**
 * Determines whether a JobError instance should bypass retry logic.
 *
 * Delegates to `isNonRetriableCategory` using the error's category field.
 * This is the preferred entry point when working with JobError instances
 * rather than raw category strings.
 *
 * @param error - The JobError to evaluate.
 * @returns True if this error should not trigger automatic retries.
 *
 * @example
 * ```typescript
 * if (job.error && isNonRetriableError(job.error)) {
 *   // Skip retry, move directly to failed state
 * }
 * ```
 */
export function isNonRetriableError(error: Readonly<JobError>): boolean {
  return isNonRetriableCategory(error.category);
}

/**
 * Resolves the default severity level for a given error category.
 *
 * Uses the `CATEGORY_SEVERITY_MAP` with 'medium' as the safe fallback
 * for any category not explicitly mapped.
 *
 * @param category - The error category.
 * @returns The resolved severity level.
 */
export function resolveErrorSeverity(category: ErrorCategory): ErrorSeverity {
  return CATEGORY_SEVERITY_MAP[category] ?? 'medium';
}

/**
 * Extracts the stack trace from an unknown error value.
 *
 * Handles three cases:
 * 1. Error instance — returns its `.stack` property
 * 2. Object with a `stack` string property — returns that property
 * 3. All other values — returns undefined
 *
 * @param error - The error value to extract from.
 * @returns The stack trace string, or undefined if not available.
 */
function extractStack(error?: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.stack === 'string') {
      return obj.stack;
    }
  }

  return undefined;
}