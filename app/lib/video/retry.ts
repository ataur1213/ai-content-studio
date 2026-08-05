import type { RetryConfig } from './types';

/**
 * Calculates the delay in milliseconds before the next retry attempt.
 *
 * Supports three backoff strategies:
 * - **fixed**: Always returns `baseDelay`
 * - **linear**: Returns `baseDelay * (attempt + 1)`, growing linearly with each attempt
 * - **exponential**: Returns `baseDelay * 2^attempt`, growing exponentially with each attempt
 *
 * The calculated delay is capped at `maxDelay` to prevent excessive wait times.
 * When `jitterFactor` is greater than 0, random jitter is applied symmetrically
 * around the calculated delay to prevent thundering herd problems in distributed systems.
 * The final delay is rounded to the nearest millisecond and guaranteed to be non-negative.
 *
 * @param config - The retry configuration containing strategy, delays, and jitter settings.
 * @param attempt - The zero-based retry attempt index (0 = first retry, 1 = second, etc.).
 * @returns The delay in milliseconds before the next retry should be attempted.
 *
 * @example
 * ```typescript
 * const config: RetryConfig = {
 *   maxRetries: 3,
 *   strategy: 'exponential',
 *   baseDelay: 1000,
 *   maxDelay: 30000,
 *   jitterFactor: 0.1,
 *   nonRetriableCategories: new Set(['validation']),
 * };
 *
 * calculateRetryDelay(config, 0); // ~1000ms (with jitter)
 * calculateRetryDelay(config, 1); // ~2000ms (with jitter)
 * calculateRetryDelay(config, 2); // ~4000ms (with jitter)
 * ```
 */
export function calculateRetryDelay(
  config: RetryConfig,
  attempt: number
): number {
  const { strategy, baseDelay, maxDelay, jitterFactor } = config;

  let delay: number;

  switch (strategy) {
    case 'fixed':
      delay = baseDelay;
      break;
    case 'linear':
      delay = baseDelay * (attempt + 1);
      break;
    case 'exponential':
      delay = baseDelay * Math.pow(2, attempt);
      break;
  }

  delay = Math.min(delay, maxDelay);

  if (jitterFactor > 0) {
    const jitterRange = delay * jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    delay = Math.max(0, delay + jitter);
  }

  return Math.round(delay);
}