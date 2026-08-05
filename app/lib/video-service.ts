import { FFmpegStudio } from "./ffmpeg/ffmpeg";
import type { JobId, ApiResponse, JobStatusResponse, VideoJob } from "./video/types";
import {
  jobStore,
  createSuccessResponse,
  createErrorResponse,
  createJobStatusResponse,
  createJobError,
  Logger,
  isNonRetriableError,
  processQueue,
  DEFAULT_LOGGER_CONFIG,
} from "./video";

type Studio = InstanceType<typeof FFmpegStudio>;
type StudioConfig = ConstructorParameters<typeof FFmpegStudio>[0];

/**
 * Standard error thrown by the VideoService.
 * Wraps internal FFmpeg engine errors to prevent leaking implementation details.
 */
export class VideoServiceError extends Error {
  public readonly cause?: unknown;
  public readonly timestamp: number;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'VideoServiceError';
    this.cause = cause;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, VideoServiceError.prototype);
  }
}

/**
 * Application-level facade for video generation operations.
 * Delegates all processing to the underlying FFmpegStudio instance while
 * ensuring application-level error handling and initialization boundaries.
 */
export class VideoService {
  private readonly studio: FFmpegStudio;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private readonly logger: Logger;

  constructor(config?: StudioConfig) {
    this.studio = new FFmpegStudio(config);
    this.logger = new Logger({
      ...DEFAULT_LOGGER_CONFIG,
      context: { service: 'VideoService' },
    });
  }

  public async retryJob(jobId: JobId): Promise<ApiResponse<JobStatusResponse>> {
    try {
      const job = jobStore.get(jobId);

      if (!job) {
        this.logger.warn('Job not found', { jobId });
        return createErrorResponse('JOB_NOT_FOUND', 'No job exists with the given ID.', { jobId });
      }

      if (job.state !== 'failed' && job.state !== 'timeout') {
        this.logger.warn('Cannot retry job that is not failed/timeout', { jobId, state: job.state });
        return createErrorResponse('INVALID_JOB_STATE', 'Cannot retry a job that is not in failed or timeout state.', { jobId, state: job.state });
      }

      if (job.error && isNonRetriableError(job.error)) {
        this.logger.warn('Cannot retry job with non-retriable error', { jobId, category: job.error.category });
        return createErrorResponse('NON_RETRIABLE_ERROR', 'Cannot retry a job with a non-retriable error.', { jobId, category: job.error.category });
      }

      if (job.retryCount >= job.maxRetries) {
        this.logger.warn('Job has exceeded max retries', { jobId, retryCount: job.retryCount, maxRetries: job.maxRetries });
        return createErrorResponse('MAX_RETRIES_EXCEEDED', 'Job has exceeded maximum retry attempts.', { jobId, retryCount: job.retryCount, maxRetries: job.maxRetries });
      }

      job.retryCount += 1;

      const retriedJob: VideoJob = {
        ...job,
        state: 'queued',
        retryCount: job.retryCount,
        error: undefined,
        result: undefined,
        startedAt: undefined,
        completedAt: undefined,
        progress: undefined,
      };
      jobStore.set(jobId, retriedJob);

      this.logger.info('Job queued for retry', { jobId, retryCount: job.retryCount });

      await processQueue();

      const updatedJob = jobStore.get(jobId) ?? job;
      return createSuccessResponse(createJobStatusResponse(updatedJob));
    } catch (error) {
      const jobError = createJobError({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while retrying the job.',
        category: 'system',
        originalError: error instanceof Error ? error : new Error(String(error)),
      });

      this.logger.error('Failed to retry job', { error: jobError });

      return createErrorResponse(jobError.code, jobError.message);
    }
  }

  /**
   * Initializes the underlying FFmpeg engine.
   * Safe to call multiple times concurrently; concurrent calls will await the same initialization process.
   * If initialization fails, the state is reset, allowing subsequent calls to retry.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    if (this.initPromise) {
      await this.initPromise;
      if (this.isInitialized) {
        return;
      }
    }

    this.initPromise = this.performInit();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async performInit(): Promise<void> {
    try {
      await this.studio.initialize();
      this.isInitialized = true;
    } catch (error) {
      this.isInitialized = false;
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    await this.initialize();
  }

  /**
   * Provides direct access to the underlying FFmpegStudio instance for advanced operations.
   * 
   * @returns The FFmpegStudio instance.
   */
  public getEngine(): FFmpegStudio {
    return this.studio;
  }

  /**
   * Renders a single video file using the FFmpeg production engine.
   * Automatically ensures the engine is initialized before rendering.
   * 
   * @param args - Arguments matching the FFmpegStudio.render signature.
   * @returns The result of the render operation.
   * @throws {VideoServiceError} If rendering fails for any reason.
   */
  public async renderVideo(
    ...args: Parameters<Studio['render']>
  ): Promise<Awaited<ReturnType<Studio['render']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.render(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during video rendering.', error);
    }
  }

  /**
   * Composes a complex video from multiple clips, audio tracks, and overlays.
   * Automatically ensures the engine is initialized before composition.
   * 
   * @param args - Arguments matching the FFmpegStudio.compose signature.
   * @returns The result of the compose operation.
   * @throws {VideoServiceError} If composition fails for any reason.
   */
  public async composeVideo(
    ...args: Parameters<Studio['compose']>
  ): Promise<Awaited<ReturnType<Studio['compose']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.compose(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during video composition.', error);
    }
  }

  /**
   * Retrieves comprehensive metadata for a specified media file.
   * Automatically ensures the engine is initialized before probing.
   * 
   * @param args - Arguments matching the FFmpegStudio.getMediaInfo signature.
   * @returns The parsed media information.
   * @throws {VideoServiceError} If metadata retrieval fails.
   */
  public async getMediaInfo(
    ...args: Parameters<Studio['getMediaInfo']>
  ): Promise<Awaited<ReturnType<Studio['getMediaInfo']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.getMediaInfo(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred while retrieving media info.', error);
    }
  }

  /**
   * Retrieves the duration of a specified media file in seconds.
   * Automatically ensures the engine is initialized before probing.
   * 
   * @param args - Arguments matching the FFmpegStudio.getDuration signature.
   * @returns The duration in seconds.
   * @throws {VideoServiceError} If duration retrieval fails.
   */
  public async getDuration(
    ...args: Parameters<Studio['getDuration']>
  ): Promise<Awaited<ReturnType<Studio['getDuration']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.getDuration(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred while retrieving media duration.', error);
    }
  }

  /**
   * Checks if a specified media file contains a video stream.
   * Automatically ensures the engine is initialized before probing.
   * 
   * @param args - Arguments matching the FFmpegStudio.hasVideo signature.
   * @returns True if a video stream is present, false otherwise.
   * @throws {VideoServiceError} If the check fails.
   */
  public async hasVideo(
    ...args: Parameters<Studio['hasVideo']>
  ): Promise<Awaited<ReturnType<Studio['hasVideo']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.hasVideo(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred while checking for video stream.', error);
    }
  }

  /**
   * Checks if a specified media file contains an audio stream.
   * Automatically ensures the engine is initialized before probing.
   * 
   * @param args - Arguments matching the FFmpegStudio.hasAudio signature.
   * @returns True if an audio stream is present, false otherwise.
   * @throws {VideoServiceError} If the check fails.
   */
  public async hasAudio(
    ...args: Parameters<Studio['hasAudio']>
  ): Promise<Awaited<ReturnType<Studio['hasAudio']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.hasAudio(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred while checking for audio stream.', error);
    }
  }

  /**
   * Performs scene detection analysis using the FFmpeg production engine.
   * Automatically ensures the engine is initialized before analysis.
   * 
   * @param args - Arguments matching FFmpegStudio.detectScenes signature.
   * @returns The scene detection result containing cuts and segments.
   * @throws {VideoServiceError} If analysis fails for any reason.
   */
  public async detectScenes(
    ...args: Parameters<Studio['detectScenes']>
  ): Promise<Awaited<ReturnType<Studio['detectScenes']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.detectScenes(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during scene detection.', error);
    }
  }

  /**
   * Performs silence detection analysis using the FFmpeg production engine.
   * Automatically ensures the engine is initialized before analysis.
   * 
   * @param args - Arguments matching FFmpegStudio.detectSilence signature.
   * @returns The silence detection result containing silences and non-silence intervals.
   * @throws {VideoServiceError} If analysis fails for any reason.
   */
  public async detectSilence(
    ...args: Parameters<Studio['detectSilence']>
  ): Promise<Awaited<ReturnType<Studio['detectSilence']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.detectSilence(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during silence detection.', error);
    }
  }

  /**
   * Cleans up temporary files generated during the rendering process.
   * Safely no-ops if the engine was never initialized.
   * 
   * @param args - Arguments matching the FFmpegStudio.cleanup signature.
   * @throws {VideoServiceError} If cleanup fails after initialization.
   */
  public async cleanup(
    ...args: Parameters<Studio['cleanup']>
  ): Promise<Awaited<ReturnType<Studio['cleanup']>>> {
    if (!this.isInitialized) {
      return;
    }
    try {
      return await this.studio.cleanup(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during cleanup.', error);
    }
  }

  /**
   * Concatenates multiple video clips into a single video.
   * Automatically ensures the engine is initialized.
   *
   * @param args - Arguments matching FFmpegStudio.concatClips signature.
   * @returns Path to the concatenated output video.
   * @throws {VideoServiceError} If concatenation fails.
   */
  public async concatClips(
    ...args: Parameters<Studio['concatClips']>
  ): Promise<Awaited<ReturnType<Studio['concatClips']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.concatClips(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during clip concatenation.', error);
    }
  }

  /**
   * Generates thumbnails from a video at specified timestamps.
   * Automatically ensures the engine is initialized.
   *
   * @param args - Arguments matching FFmpegStudio.generateThumbnails signature.
   * @returns Array of generated thumbnail results.
   * @throws {VideoServiceError} If thumbnail generation fails.
   */
  public async generateThumbnails(
    ...args: Parameters<Studio['generateThumbnails']>
  ): Promise<Awaited<ReturnType<Studio['generateThumbnails']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.generateThumbnails(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during thumbnail generation.', error);
    }
  }

  /**
   * Adds a watermark to a video.
   * Automatically ensures the engine is initialized.
   *
   * @param args - Arguments matching FFmpegStudio.addWatermark signature.
   * @returns Path to the watermarked output video.
   * @throws {VideoServiceError} If watermark addition fails.
   */
  public async addWatermark(
    ...args: Parameters<Studio['addWatermark']>
  ): Promise<Awaited<ReturnType<Studio['addWatermark']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.addWatermark(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during watermark addition.', error);
    }
  }

  /**
   * Burns subtitles into a video.
   * Automatically ensures the engine is initialized.
   *
   * @param args - Arguments matching FFmpegStudio.burnSubtitles signature.
   * @returns Path to the subtitled output video.
   * @throws {VideoServiceError} If subtitle burning fails.
   */
  public async burnSubtitles(
    ...args: Parameters<Studio['burnSubtitles']>
  ): Promise<Awaited<ReturnType<Studio['burnSubtitles']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.burnSubtitles(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during subtitle burning.', error);
    }
  }

  /**
   * Mixes multiple audio tracks together.
   * Automatically ensures the engine is initialized.
   *
   * @param args - Arguments matching FFmpegStudio.mixAudioTracks signature.
   * @returns Path to the mixed audio output.
   * @throws {VideoServiceError} If audio mixing fails.
   */
  public async mixAudioTracks(
    ...args: Parameters<Studio['mixAudioTracks']>
  ): Promise<Awaited<ReturnType<Studio['mixAudioTracks']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.mixAudioTracks(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during audio mixing.', error);
    }
  }

  /**
   * Adds background music to a video.
   * Automatically ensures the engine is initialized.
   *
   * @param args - Arguments matching FFmpegStudio.addBackgroundMusic signature.
   * @returns Path to the output video with background music.
   * @throws {VideoServiceError} If background music addition fails.
   */
  public async addBackgroundMusic(
    ...args: Parameters<Studio['addBackgroundMusic']>
  ): Promise<Awaited<ReturnType<Studio['addBackgroundMusic']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.addBackgroundMusic(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during background music addition.', error);
    }
  }

  public async applyTransition(
    ...args: Parameters<Studio['applyTransition']>
  ): Promise<Awaited<ReturnType<Studio['applyTransition']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.applyTransition(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during transition application.', error);
    }
  }

  public async addOverlay(
    ...args: Parameters<Studio['addOverlay']>
  ): Promise<Awaited<ReturnType<Studio['addOverlay']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.addOverlay(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during overlay addition.', error);
    }
  }

  public async addAnimations(
    ...args: Parameters<Studio['addAnimations']>
  ): Promise<Awaited<ReturnType<Studio['addAnimations']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.addAnimations(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred during animation addition.', error);
    }
  }

  public async setMetadata(
    ...args: Parameters<Studio['setMetadata']>
  ): Promise<Awaited<ReturnType<Studio['setMetadata']>>> {
    try {
      await this.ensureInitialized();
      return await this.studio.setMetadata(...args);
    } catch (error) {
      throw new VideoServiceError('An error occurred while setting video metadata.', error);
    }
  }

  /**
   * Destroys the FFmpeg engine instance and releases held resources.
   * Safely no-ops if the engine was never initialized. Resets internal
   * initialization state to allow potential re-initialization if needed.
   *
   * @param args - Arguments matching the FFmpegStudio.destroy signature.
   * @throws {VideoServiceError} If destruction fails after initialization.
   */
  public async destroy(
    ...args: Parameters<Studio['destroy']>
  ): Promise<Awaited<ReturnType<Studio['destroy']>>> {
    if (!this.isInitialized) {
      return;
    }
    try {
      return await this.studio.destroy(...args);
    } finally {
      this.isInitialized = false;
      this.initPromise = null;
    }
  }
}
