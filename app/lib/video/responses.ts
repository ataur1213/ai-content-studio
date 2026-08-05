import type {
  ApiResponse,
  ApiError,
  CreateJobResponse,
  JobStatusResponse,
  JobListResponse,
  CancelJobResponse,
  Pagination,
  VideoJob,
  QueueStats,
} from './types';

/**
 * Options for constructing an ApiError instance.
 */
export interface CreateApiErrorOptions {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Options for constructing a Pagination instance.
 * Requires the raw total count; derived fields (totalPages, hasNextPage, hasPreviousPage)
 * are computed automatically.
 */
export interface CreatePaginationOptions {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
}

/**
 * Options for constructing a JobListResponse instance.
 * Pagination is derived from the provided options; stats are passed through.
 */
export interface CreateJobListResponseOptions extends CreatePaginationOptions {
  readonly jobs: ReadonlyArray<VideoJob>;
  readonly stats: QueueStats;
}

/**
 * Creates a successful ApiResponse wrapping the provided data.
 *
 * @param data - The response payload.
 * @returns An ApiResponse with success set to true and the current timestamp.
 *
 * @example
 * ```typescript
 * const response = createSuccessResponse({ job: myJob });
 * ```
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date(),
  };
}

/**
 * Creates a failed ApiResponse wrapping the provided error details.
 *
 * @param code - A machine-readable error code (e.g., 'JOB_NOT_FOUND').
 * @param message - A human-readable error message.
 * @param details - Optional additional structured error context.
 * @returns An ApiResponse with success set to false and the current timestamp.
 *
 * @example
 * ```typescript
 * const response = createErrorResponse('JOB_NOT_FOUND', 'No job exists with the given ID.', { jobId: 'abc' });
 * ```
 */
export function createErrorResponse<T = never>(
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>
): ApiResponse<T> {
  return {
    success: false,
    error: createApiError({ code, message, details }),
    timestamp: new Date(),
  };
}

/**
 * Creates an ApiError instance.
 *
 * @param options - The error construction options.
 * @returns A readonly ApiError instance.
 */
export function createApiError(options: Readonly<CreateApiErrorOptions>): ApiError {
  return {
    code: options.code,
    message: options.message,
    details: options.details,
  };
}

/**
 * Creates a Pagination instance with automatically computed derived fields.
 *
 * Derived field logic:
 * - **totalPages**: `Math.ceil(total / limit)`, minimum 0 for empty result sets
 * - **hasNextPage**: `page < totalPages`
 * - **hasPreviousPage**: `page > 1`
 *
 * Pages are 1-indexed. A page value of 0 or less is treated as page 1
 * for the purposes of computing hasPreviousPage, though the raw value
 * is preserved in the output for debugging purposes.
 *
 * @param options - The pagination construction options.
 * @returns A fully-formed Pagination instance.
 *
 * @example
 * ```typescript
 * const pagination = createPagination({ page: 2, limit: 10, total: 25 });
 * // { page: 2, limit: 10, total: 25, totalPages: 3, hasNextPage: true, hasPreviousPage: true }
 * ```
 */
export function createPagination(options: Readonly<CreatePaginationOptions>): Pagination {
  const { page, limit, total } = options;

  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Creates a CreateJobResponse wrapping a newly created job.
 *
 * @param job - The VideoJob that was created and enqueued.
 * @returns A CreateJobResponse instance with the current timestamp embedded in the job.
 */
export function createCreateJobResponse(job: Readonly<VideoJob>): CreateJobResponse {
  return {
    job,
  };
}

/**
 * Creates a JobStatusResponse for job status queries.
 *
 * @param job - The current state of the queried VideoJob.
 * @returns A JobStatusResponse instance.
 */
export function createJobStatusResponse(job: Readonly<VideoJob>): JobStatusResponse {
  return {
    job,
  };
}

/**
 * Creates a JobListResponse for paginated job listing queries.
 *
 * Automatically constructs the Pagination object from the provided
 * page, limit, and total count.
 *
 * @param options - The job list construction options including jobs, pagination params, and queue stats.
 * @returns A JobListResponse instance.
 *
 * @example
 * ```typescript
 * const response = createJobListResponse({
 *   jobs: [job1, job2],
 *   page: 1,
 *   limit: 10,
 *   total: 2,
 *   stats: queueStats,
 * });
 * ```
 */
export function createJobListResponse(options: Readonly<CreateJobListResponseOptions>): JobListResponse {
  const { jobs, stats, ...paginationOptions } = options;

  return {
    jobs,
    pagination: createPagination(paginationOptions),
    stats,
  };
}

/**
 * Creates a CancelJobResponse for job cancellation results.
 *
 * @param job - The VideoJob after cancellation state transition.
 * @param message - A human-readable confirmation message.
 * @returns A CancelJobResponse instance.
 *
 * @example
 * ```typescript
 * const response = createCancelJobResponse(cancelledJob, 'Job was successfully cancelled.');
 * ```
 */
export function createCancelJobResponse(
  job: Readonly<VideoJob>,
  message: string
): CancelJobResponse {
  return {
    job,
    message,
  };
}