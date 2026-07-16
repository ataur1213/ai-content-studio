// =============================================================================
// AI Video Generator — FFmpeg Engine Main Public API
// =============================================================================

import type {
  StudioConfig,
  FFmpegContext,
  MediaInfo,
  ImageToVideoConfig,
  KenBurnsConfig,
  SlideshowConfig,
  AudioMixConfig,
  BackgroundMusicConfig,
  VoiceConfig,
  TransitionConfig,
  OverlayConfig,
  AnimationConfig,
  WatermarkOperation,
  IntroConfig,
  OutroConfig,
  SubtitleConfig,
  ThumbnailConfig,
  ThumbnailResult,
  RenderConfig,
  RenderResult,
  ComposeConfig,
  ComposeResult,
  VideoMetadata,
  RenderProgressCallback,
} from './types';
import {
  DEFAULT_STUDIO_CONFIG,
} from './constants';
import {
  createLogFunction,
} from './utils';
import {
  resolveBinaryPaths,
  initTempDir,
  cleanTempDir,
  destroyTempDir,
} from './paths';
import {
  validateStudioConfig,
} from './validate';
import {
  probeMedia,
  probeDuration,
  probeHasVideo,
  probeHasAudio,
  isValidVideoFile,
  isValidAudioFile,
} from './probe';
import {
  imageToVideo,
  kenBurnsEffect,
  createSlideshow,
} from './images';
import {
  mixAudioTracks,
  addBackgroundMusic,
  mergeVoiceWithMusic,
} from './audio';
import {
  applyTransition,
  concatClips,
} from './transitions';
import {
  addOverlay,
  addAnimations,
} from './overlays';
import {
  addWatermark,
} from './watermark';
import {
  createIntro,
} from './intro';
import {
  createOutro,
} from './outro';
import {
  burnSubtitles,
} from './subtitles';
import {
  generateThumbnails,
} from './thumbnail';
import {
  setVideoMetadata,
} from './seo';
import {
  render,
} from './render';
import {
  composeVideo,
} from './compose';

// =============================================================================
// Main Engine Class
// =============================================================================

export class FFmpegStudio {
  private ctx: FFmpegContext | null = null;
  private config: Required<StudioConfig>;

  constructor(config?: Partial<StudioConfig>) {
  this.config = {
    ...DEFAULT_STUDIO_CONFIG,
    ...config,
    logCallback:
      config?.logCallback ??
      DEFAULT_STUDIO_CONFIG.logCallback ??
      (() => {}),
  } as Required<StudioConfig>;
}

  // =========================================================================
  // Initialization & Lifecycle
  // =========================================================================

  public async initialize(): Promise<void> {
    const validation = validateStudioConfig(this.config);
    if (!validation.valid) {
      throw new Error(`Invalid StudioConfig: ${validation.errors.map(e => `[${e.field}] ${e.message}`).join(', ')}`);
    }

    const paths = resolveBinaryPaths(this.config);
    const tempDir = initTempDir(this.config);

    this.ctx = {
      ffmpegPath: paths.ffmpegPath,
      ffprobePath: paths.ffprobePath,
      tempDir,
      log: createLogFunction(this.config.logLevel, 'studio'),
      hardwareAccel: this.config.hardwareAccel,
      retryAttempts: this.config.retryAttempts,
      retryDelayMs: this.config.retryDelayMs,
    };

    this.ctx.log('info', `FFmpeg Studio initialized. Temp dir: ${tempDir}`, 'studio');
  }

  private ensureReady(): FFmpegContext {
    if (!this.ctx) {
      throw new Error('FFmpeg Studio is not initialized. Call await studio.initialize() first.');
    }
    return this.ctx;
  }

  // =========================================================================
  // Probe / Info Methods
  // =========================================================================

  public async getMediaInfo(filePath: string): Promise<MediaInfo> {
    return probeMedia(filePath, this.ensureReady());
  }

  public async getDuration(filePath: string): Promise<number> {
    return probeDuration(filePath, this.ensureReady());
  }

  public async hasVideo(filePath: string): Promise<boolean> {
    return probeHasVideo(filePath, this.ensureReady());
  }

  public async hasAudio(filePath: string): Promise<boolean> {
    return probeHasAudio(filePath, this.ensureReady());
  }

  public async isValidVideo(filePath: string): Promise<boolean> {
    return isValidVideoFile(filePath, this.ensureReady());
  }

  public async isValidAudio(filePath: string): Promise<boolean> {
    return isValidAudioFile(filePath, this.ensureReady());
  }

  // =========================================================================
  // Image Operations
  // =========================================================================

  public async imageToVideo(config: ImageToVideoConfig): Promise<string> {
    return imageToVideo(config, this.ensureReady());
  }

  public async kenBurnsEffect(config: KenBurnsConfig): Promise<string> {
    return kenBurnsEffect(config, this.ensureReady());
  }

  public async createSlideshow(config: SlideshowConfig): Promise<string> {
    return createSlideshow(config, this.ensureReady());
  }

  // =========================================================================
  // Audio Operations
  // =========================================================================

  public async mixAudioTracks(config: AudioMixConfig): Promise<string> {
    return mixAudioTracks(config, this.ensureReady());
  }

  public async addBackgroundMusic(
    baseVideoPath: string,
    config: BackgroundMusicConfig,
    outputPath: string,
  ): Promise<string> {
    return addBackgroundMusic(baseVideoPath, config, outputPath, this.ensureReady());
  }

  public async mergeVoiceWithMusic(
    baseVideoPath: string,
    voiceConfig: VoiceConfig,
    musicConfig: BackgroundMusicConfig | null,
    outputPath: string,
  ): Promise<string> {
    return mergeVoiceWithMusic(baseVideoPath, voiceConfig, musicConfig, outputPath, this.ensureReady());
  }

  // =========================================================================
  // Transition Operations
  // =========================================================================

  public async applyTransition(config: TransitionConfig): Promise<string> {
    return applyTransition(config, this.ensureReady());
  }

  public async concatClips(
    inputPaths: string[],
    outputPath: string,
  ): Promise<string> {
    return concatClips(inputPaths, outputPath, this.ensureReady());
  }

  // =========================================================================
  // Overlay & Animation Operations
  // =========================================================================

  public async addOverlay(config: OverlayConfig): Promise<string> {
    return addOverlay(config, this.ensureReady());
  }

  public async addAnimations(
    baseVideoPath: string,
    animations: AnimationConfig[],
    outputPath: string,
  ): Promise<string> {
    return addAnimations(baseVideoPath, animations, outputPath, this.ensureReady());
  }

  // =========================================================================
  // Watermark Operations
  // =========================================================================

  public async addWatermark(config: WatermarkOperation): Promise<string> {
    return addWatermark(config, this.ensureReady());
  }

  // =========================================================================
  // Intro / Outro Operations
  // =========================================================================

  public async createIntro(config: IntroConfig): Promise<string> {
    return createIntro(config, this.ensureReady());
  }

  public async createOutro(config: OutroConfig): Promise<string> {
    return createOutro(config, this.ensureReady());
  }

  // =========================================================================
  // Subtitle Operations
  // =========================================================================

  public async burnSubtitles(
    baseVideoPath: string,
    config: SubtitleConfig,
    outputPath: string,
  ): Promise<string> {
    return burnSubtitles(baseVideoPath, config, outputPath, this.ensureReady());
  }

  // =========================================================================
  // Thumbnail Operations
  // =========================================================================

  public async generateThumbnails(config: ThumbnailConfig): Promise<ThumbnailResult[]> {
    return generateThumbnails(config, this.ensureReady());
  }

  // =========================================================================
  // SEO / Metadata Operations
  // =========================================================================

  public async setMetadata(
    inputPath: string,
    metadata: VideoMetadata,
    outputPath: string,
  ): Promise<string> {
    return setVideoMetadata(inputPath, metadata, outputPath, this.ensureReady());
  }

  // =========================================================================
  // Core Render & Compose
  // =========================================================================

  public async render(
    inputPath: string,
    config: RenderConfig,
    onProgress?: RenderProgressCallback,
  ): Promise<RenderResult> {
    return render(inputPath, config, this.ensureReady(), onProgress);
  }

  public async compose(
    config: ComposeConfig,
  ): Promise<ComposeResult> {
    return composeVideo(config, this.ensureReady());
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  public async cleanup(): Promise<void> {
    if (!this.ctx) return;
    this.ctx.log('info', 'Running manual cleanup', 'studio');
    cleanTempDir(this.ctx.tempDir);
  }

  public async destroy(): Promise<void> {
    if (!this.ctx) return;
    this.ctx.log('info', 'Destroying temp directory', 'studio');
    destroyTempDir(this.ctx.tempDir);
    this.ctx = null;
  }
}