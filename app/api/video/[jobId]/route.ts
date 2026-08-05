import { NextRequest, NextResponse } from 'next/server';

import type {
  JobStatusResponse,
  CancelJobResponse,
  ApiResponse,
} from '@/app/lib/video';
import type { VideoJob } from '@/app/lib/video/types';

import {
  toJobId,
  DEFAULT_LOGGER_CONFIG,
  createSuccessResponse,
  createErrorResponse,
  createJobStatusResponse,
  createCancelJobResponse,
  createJobError,
  Logger,
  jobStore,
  workerStore,
  isTerminalState,
  findWorkerByJobId,
  completeJob,
} from '@/app/lib/video';

import { VideoService } from '@/app/lib/video-service';

const logger = new Logger({
  ...DEFAULT_LOGGER_CONFIG,
  context: { route: '/api/video/[jobId]' },
});

const videoService = new VideoService();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse<ApiResponse<JobStatusResponse>>> {
  try {
    const { jobId } = await params;
    const typedJobId = toJobId(jobId);

    const job = jobStore.get(typedJobId);

    if (!job) {
      logger.warn('Job not found', { jobId: typedJobId });
      return NextResponse.json(
        createErrorResponse('JOB_NOT_FOUND', 'No job exists with the given ID.', { jobId }),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(createJobStatusResponse(job)));
  } catch (error) {
    const jobError = createJobError({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred while retrieving the job.',
      category: 'system',
      originalError: error instanceof Error ? error : new Error(String(error)),
    });

    logger.error('Failed to retrieve job', { error: jobError });

    return NextResponse.json(
      createErrorResponse(jobError.code, jobError.message),
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse<ApiResponse<CancelJobResponse>>> {
  try {
    const { jobId } = await params;
    const typedJobId = toJobId(jobId);

    const job = jobStore.get(typedJobId);

    if (!job) {
      logger.warn('Job not found', { jobId: typedJobId });
      return NextResponse.json(
        createErrorResponse('JOB_NOT_FOUND', 'No job exists with the given ID.', { jobId }),
        { status: 404 }
      );
    }

    if (isTerminalState(job.state)) {
      logger.warn('Cannot cancel terminal job', { jobId: typedJobId, state: job.state });
      return NextResponse.json(
        createErrorResponse('INVALID_JOB_STATE', 'Cannot cancel a job that has already reached a terminal state.', { jobId, state: job.state }),
        { status: 400 }
      );
    }

    const cancelledJob: VideoJob = {
      ...job,
      state: 'cancelled',
    };
    jobStore.set(job.id, cancelledJob);

    const allWorkers = Array.from(workerStore.values());
    const worker = findWorkerByJobId(allWorkers, typedJobId);
    if (worker) {
      const updatedWorker = completeJob(worker, 'failed');
      workerStore.set(worker.id, updatedWorker);
    }

    logger.info('Job cancelled successfully', { jobId: typedJobId });

    return NextResponse.json(createSuccessResponse(createCancelJobResponse(cancelledJob, 'Job cancelled successfully.')));
  } catch (error) {
    const jobError = createJobError({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred while cancelling the job.',
      category: 'system',
      originalError: error instanceof Error ? error : new Error(String(error)),
    });

    logger.error('Failed to cancel job', { error: jobError });

    return NextResponse.json(
      createErrorResponse(jobError.code, jobError.message),
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse<ApiResponse<JobStatusResponse>>> {
  try {
    const { jobId } = await params;
    const typedJobId = toJobId(jobId);

    const response = await videoService.retryJob(typedJobId);
    const status = response.success ? 200 : (response.error?.code === 'JOB_NOT_FOUND' ? 404 : 400);

    return NextResponse.json(response, { status });
  } catch (error) {
    const jobError = createJobError({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred while retrying the job.',
      category: 'system',
      originalError: error instanceof Error ? error : new Error(String(error)),
    });

    logger.error('Failed to retry job', { error: jobError });

    return NextResponse.json(
      createErrorResponse(jobError.code, jobError.message),
      { status: 500 }
    );
  }
}
