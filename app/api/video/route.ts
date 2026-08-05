
import { NextRequest, NextResponse } from 'next/server';

import type {
  VideoJob,
  VideoInput,
  VideoOutput,
  FFmpegOperation,
  JobPriority,
  CreateJobResponse,
  JobListResponse,
  ApiResponse,
} from '@/app/lib/video';

import {
  toJobId,
  DEFAULT_QUEUE_CONFIG,
  DEFAULT_LOGGER_CONFIG,
  VALID_OPERATIONS,
  VALID_PRIORITIES,
  createSuccessResponse,
  createErrorResponse,
  createCreateJobResponse,
  createJobListResponse,
  createJobError,
  isQueueFull,
  Logger,
  processQueue,
  jobStore,
} from '@/app/lib/video';

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

const queueConfig = DEFAULT_QUEUE_CONFIG;

const logger = new Logger({
  ...DEFAULT_LOGGER_CONFIG,
  context: { route: '/api/video' },
});

// -----------------------------------------------------------------------------
// Request Validation
// -----------------------------------------------------------------------------

interface CreateVideoJobDto {
  readonly name: string;
  readonly operation: FFmpegOperation;
  readonly priority?: JobPriority;
  readonly inputs: ReadonlyArray<VideoInput>;
  readonly output: VideoOutput;
  readonly timeout?: number;
  readonly metadata?: Record<string, unknown>;
}

function isValidDto(payload: unknown): payload is CreateVideoJobDto {
  if (typeof payload !== 'object' || payload === null) return false;
  const dto = payload as Record<string, unknown>;

  if (typeof dto.name !== 'string' || dto.name.trim().length === 0) {
    return false;
  }

  if (typeof dto.operation !== 'string' || !VALID_OPERATIONS.has(dto.operation as FFmpegOperation)) {
    return false;
  }
  if (dto.operation === 'custom') {
    return false;
  }

  if (dto.priority !== undefined && !VALID_PRIORITIES.has(dto.priority as JobPriority)) {
    return false;
  }

  if (!Array.isArray(dto.inputs)) {
    return false;
  }
  const VALID_SOURCES = new Set(['file', 'url', 'buffer', 'stream'] as const);
  for (const rawInput of dto.inputs) {
    if (typeof rawInput !== 'object' || rawInput === null) return false;
    const input = rawInput as Record<string, unknown>;
    if (typeof input.id !== 'string' || input.id.length === 0) return false;
    if (typeof input.source !== 'string' || !VALID_SOURCES.has(input.source as 'file')) return false;
    if (typeof input.path !== 'string') return false;
  }

  if (typeof dto.output !== 'object' || dto.output === null) {
    return false;
  }
  {
    const output = dto.output as Record<string, unknown>;
    if (typeof output.path !== 'string' || output.path.trim().length === 0) {
      return false;
    }
  }

  if (dto.operation === 'transcode') {
    const firstInput = dto.inputs[0];
    if (typeof firstInput !== 'object' || firstInput === null) return false;
    const input = firstInput as Record<string, unknown>;
    if (typeof input.path !== 'string' || input.path.trim().length === 0) return false;
  }

  if (
    dto.metadata !== undefined &&
    (typeof dto.metadata !== 'object' || dto.metadata === null || Array.isArray(dto.metadata))
  ) {
    return false;
  }

  return true;
}

// -----------------------------------------------------------------------------
// Route Handlers
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<CreateJobResponse>>> {
  try {
    const payload: unknown = await request.json();

    if (!isValidDto(payload)) {
      logger.warn('Invalid job creation request received', { payload });
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid request body. Required fields: name (string), operation (valid FFmpegOperation), inputs (array of VideoInput objects), output (object with non-empty path). For operation "transcode", at least one input with a non-empty path is required.'),
        { status: 400 }
      );
    }

    const allJobs = Array.from(jobStore.values());

    if (isQueueFull(allJobs.length, queueConfig)) {
      logger.warn('Queue is full. Rejecting job creation.');
      return NextResponse.json(
        createErrorResponse('QUEUE_FULL', 'The video processing queue is currently at maximum capacity.'),
        { status: 503 }
      );
    }

    const jobId = toJobId(crypto.randomUUID());

    const now = new Date();
    const job: VideoJob = {
      id: jobId,
      name: payload.name.trim(),
      state: 'queued',
      priority: payload.priority ?? queueConfig.defaultPriority,
      operation: payload.operation,
      inputs: payload.inputs,
      output: payload.output,
      createdAt: now,
      retryCount: 0,
      maxRetries: queueConfig.retry.maxRetries,
      timeout: payload.timeout ?? queueConfig.defaultTimeout,
      metadata: payload.metadata,
    };

    jobStore.set(jobId, job);
    logger.info('Job created and queued successfully', { jobId, operation: job.operation });

    await processQueue(queueConfig);

    const finalJobState = jobStore.get(jobId) ?? job;
    
    return NextResponse.json(
      createSuccessResponse(createCreateJobResponse(finalJobState)),
      { status: 201 }
    );
  } catch (error) {
    const jobError = createJobError({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred while creating the video job.',
      category: 'system',
      originalError: error instanceof Error ? error : new Error(String(error)),
    });

    logger.error('Failed to create video job', { error: jobError });

    return NextResponse.json(
      createErrorResponse(jobError.code, jobError.message, { stack: jobError.stack }),
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<JobListResponse>>> {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10) || 20));

    const allJobs = Array.from(jobStore.values());
    
    const sortedJobs = allJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = sortedJobs.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedJobs = sortedJobs.slice(startIndex, endIndex);

    const response = createJobListResponse({
      jobs: paginatedJobs,
      page,
      limit,
      total,
      stats: {
        total,
        byState: allJobs.reduce<Partial<Record<string, number>>>((acc, job) => {
          acc[job.state] = (acc[job.state] ?? 0) + 1;
          return acc;
        }, {}),
        byPriority: allJobs.reduce<Partial<Record<string, number>>>((acc, job) => {
          acc[job.priority] = (acc[job.priority] ?? 0) + 1;
          return acc;
        }, {}),
        averageWaitTime: 0,
        averageProcessingTime: 0,
      },
    });

    return NextResponse.json(createSuccessResponse(response));
  } catch (error) {
    const jobError = createJobError({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred while fetching jobs.',
      category: 'system',
      originalError: error instanceof Error ? error : new Error(String(error)),
    });

    logger.error('Failed to fetch jobs', { error: jobError });

    return NextResponse.json(
      createErrorResponse(jobError.code, jobError.message),
      { status: 500 }
    );
  }
}
