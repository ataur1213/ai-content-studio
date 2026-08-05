
// =============================================================================
// Video Studio UI — Mappers Service
// =============================================================================

import type {
  VideoJob,
  CreateJobResponse,
  JobListResponse,
  JobStatusResponse,
  VideoInput,
  VideoOutput,
  FFmpegOperation,
  JobPriority,
} from "@/app/lib/video";
import type {
  VideoGenerationForm,
  HistoryItem,
  VideoPreview,
} from "../types";

// -----------------------------------------------------------------------------
// Default Mappings
// -----------------------------------------------------------------------------

const DEFAULT_PRIORITY: JobPriority = "normal";
const DEFAULT_OPERATION: FFmpegOperation = "transcode";

// -----------------------------------------------------------------------------
// UI → API Mappers
// -----------------------------------------------------------------------------

export function mapFormToCreateJobOptions(
  form: VideoGenerationForm,
  jobName?: string
): {
  name: string;
  operation: FFmpegOperation;
  priority?: JobPriority;
  inputs: ReadonlyArray<VideoInput>;
  output: VideoOutput;
  timeout?: number;
} {
  const name = jobName || form.prompt.slice(0, 50) || "Untitled Video";

  const inputs: VideoInput[] = form.imageInput
    ? [
        {
          id: form.imageInput.id,
          source: "file",
          path: "",
        },
      ]
    : [];

  const output: VideoOutput = {
    path: "",
    format: "mp4",
    videoCodec: "h264",
    audioCodec: form.includeAudio ? "aac" : "none",
  };

  return {
    name,
    operation: DEFAULT_OPERATION,
    priority: DEFAULT_PRIORITY,
    inputs,
    output,
  };
}

// -----------------------------------------------------------------------------
// API → UI Mappers
// -----------------------------------------------------------------------------

export function mapVideoJobToHistoryItem(job: VideoJob): HistoryItem {
  return {
    id: job.id as unknown as string,
    jobId: job.id as unknown as string,
    title: job.name,
    status: job.state,
    createdAt: job.createdAt,
    aspectRatio: "16:9",
    thumbnailUrl: job.result?.thumbnails?.[0],
    durationSeconds: job.result?.processingDuration,
  };
}

export function mapJobListResponseToHistoryItems(
  response: JobListResponse
): ReadonlyArray<HistoryItem> {
  return response.jobs.map(mapVideoJobToHistoryItem);
}

export function mapVideoJobToVideoPreview(
  job: VideoJob
): VideoPreview | undefined {
  if (!job.result?.outputPaths.length) return undefined;

  return {
    url: job.result.outputPaths[0],
    thumbnailUrl: job.result.thumbnails?.[0] || "",
    durationSeconds: job.result.processingDuration || 0,
    width: 1280,
    height: 720,
  };
}

export function mapJobStatusResponseToJob(
  response: JobStatusResponse
): VideoJob {
  return response.job;
}

export function mapCreateJobResponseToJob(
  response: CreateJobResponse
): VideoJob {
  return response.job;
}
