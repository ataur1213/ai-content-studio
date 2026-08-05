// =============================================================================
// Video Studio UI — API Service
// =============================================================================

import type {
  CreateJobResponse,
  JobListResponse,
  JobStatusResponse,
  CancelJobResponse,
  ApiResponse,
  VideoInput,
  VideoOutput,
  FFmpegOperation,
  JobPriority,
} from "@/app/lib/video";

// -----------------------------------------------------------------------------
// API Error Handling
// -----------------------------------------------------------------------------

class VideoApiError extends Error {
  public readonly code: string;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: string, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "VideoApiError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, VideoApiError.prototype);
  }
}

// -----------------------------------------------------------------------------
// Base Request Helper
// -----------------------------------------------------------------------------

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `/api/video${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const result: ApiResponse<T> = await response.json();

  if (!result.success) {
    if (!result.error) {
      throw new VideoApiError(
        "UNKNOWN_ERROR",
        "An unknown error occurred"
      );
    }
    throw new VideoApiError(
      result.error.code,
      result.error.message,
      result.error.details
    );
  }

  if (result.data === undefined) {
    throw new VideoApiError(
      "MISSING_DATA",
      "No data returned from API"
    );
  }

  return result.data;
}

// -----------------------------------------------------------------------------
// API Methods
// -----------------------------------------------------------------------------

export interface CreateJobOptions {
  readonly name: string;
  readonly operation: FFmpegOperation;
  readonly priority?: JobPriority;
  readonly inputs: ReadonlyArray<VideoInput>;
  readonly output: VideoOutput;
  readonly timeout?: number;
}

export interface ListJobsOptions {
  readonly page?: number;
  readonly limit?: number;
}

export async function createJob(options: CreateJobOptions): Promise<CreateJobResponse> {
  return await fetchApi<CreateJobResponse>("", {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export async function listJobs(options: ListJobsOptions = {}): Promise<JobListResponse> {
  const searchParams = new URLSearchParams();
  if (options.page !== undefined) searchParams.set("page", String(options.page));
  if (options.limit !== undefined) searchParams.set("limit", String(options.limit));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";

  return await fetchApi<JobListResponse>(query, {
    method: "GET",
  });
}

export async function getJob(jobId: string): Promise<JobStatusResponse> {
  return await fetchApi<JobStatusResponse>(`/${jobId}`, {
    method: "GET",
  });
}

export async function cancelJob(jobId: string): Promise<CancelJobResponse> {
  return await fetchApi<CancelJobResponse>(`/${jobId}`, {
    method: "DELETE",
  });
}

export async function retryJob(jobId: string): Promise<JobStatusResponse> {
  return await fetchApi<JobStatusResponse>(`/${jobId}`, {
    method: "POST",
  });
}
