import type { JobId, WorkerId } from './types';

/**
 * Constructs a branded JobId from a plain string.
 *
 * This function serves as the sole entry point for creating JobId values,
 * ensuring type safety at compile time while imposing zero runtime overhead.
 * The branding prevents accidental assignment of untyped strings to fields
 * expecting a JobId.
 *
 * @param id - The raw string identifier to brand as a JobId.
 * @returns The branded JobId value.
 *
 * @example
 * ```typescript
 * const jobId = toJobId('abc-123');
 * // jobId is now of type JobId, not string
 * ```
 */
export function toJobId(id: string): JobId {
  return id as JobId;
}

/**
 * Constructs a branded WorkerId from a plain string.
 *
 * This function serves as the sole entry point for creating WorkerId values,
 * ensuring type safety at compile time while imposing zero runtime overhead.
 * The branding prevents accidental assignment of untyped strings to fields
 * expecting a WorkerId.
 *
 * @param id - The raw string identifier to brand as a WorkerId.
 * @returns The branded WorkerId value.
 *
 * @example
 * ```typescript
 * const workerId = toWorkerId('worker-001');
 * // workerId is now of type WorkerId, not string
 * ```
 */
export function toWorkerId(id: string): WorkerId {
  return id as WorkerId;
}