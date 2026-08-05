// =============================================================================
// AI Video Generator — FFmpeg Engine Core Renderer
// =============================================================================

import type {
  FFmpegContext,
  RenderConfig,
  RenderResult,
  CommandConfig,
  RenderProgressCallback,
} from './types';
import {
  VIDEO_FORMAT_MAP,
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_AUDIO_BITRATE,
} from './constants';
import {
  ensureDir,
  getDirName,
  fileSize,
  removeFileAsync,
} from './utils';
import {
  tempLogPath,
} from './paths';
import {
  assertValid,
  validateRenderConfig,
} from './validate';
import {
  executeFFmpeg,
} from './command';
import {
  probeDuration,
} from './probe';

interface RenderExecOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: RenderProgressCallback;
  progressIntervalMs?: number;
}

// =============================================================================
// Main Render Entry Point
// =============================================================================

export async function render(
  inputPath: string,
  config: RenderConfig,
  ctx: FFmpegContext,
  onProgress?: RenderProgressCallback,
): Promise<RenderResult> {
  const startTime = Date.now();
  assertValid(config, validateRenderConfig, 'render');
  ensureDir(getDirName(config.outputPath));

  const execOptions: RenderExecOptions = {
    onProgress,
    progressIntervalMs: 500,
  };

  try {
    if (config.twoPass && config.crf === null && config.videoBitrate !== null) {
      return await renderTwoPass(inputPath, config, ctx, execOptions, startTime);
    } else {
      if (config.twoPass && config.crf !== null) {
        ctx.log('warn', 'Two-pass encoding ignored when CRF is set. Falling back to single-pass CRF.', 'render');
      }
      return await renderSinglePass(inputPath, config, ctx, execOptions, startTime);
    }
  } catch (err) {
    const errRecord: Record<string, unknown> = (typeof err === 'object' && err !== null) ? err as unknown as Record<string, unknown> : {};
    const extractedMessage: string =
      err instanceof Error ? err.message :
      typeof errRecord.message === 'string' ? errRecord.message :
      String(err);

    const stderrText: string =
      err instanceof Error ? typeof (err as unknown as Record<string, unknown>).stderr === 'string' ? (err as unknown as Record<string, unknown>).stderr as string : err.stack ?? '' :
      typeof errRecord.stderr === 'string' ? errRecord.stderr :
      '';

    const inheritedCode: string | null =
      typeof errRecord.code === 'string' ? errRecord.code : null;

    const inheritedExit: number | null =
      typeof errRecord.exitCode === 'number' ? errRecord.exitCode : null;

    const inheritedCommand: string[] =
      Array.isArray(errRecord.command) ? errRecord.command as string[] : [];

    const inheritedTimestamp: number | null =
      typeof errRecord.timestamp === 'number' ? errRecord.timestamp : null;

    const errorObj: Error = err instanceof Error ? err : new Error(extractedMessage);

    const result: RenderResult = {
      success: false,
      outputPath: config.outputPath,
      duration: 0,
      fileSize: 0,
      resolution: config.resolution,
      format: config.format,
      videoCodec: config.videoCodec,
      audioCodec: config.audioCodec,
      error: {
        code: inheritedCode ?? 'RENDER_FAILED',
        message: extractedMessage,
        stderr: stderrText || errorObj.stack || '',
        exitCode: inheritedExit,
        command: inheritedCommand,
        timestamp: inheritedTimestamp ?? Date.now(),
      },
      tempFiles: [],
      renderTimeMs: Date.now() - startTime,
    };

    ctx.log('error', `Render failed: ${extractedMessage}`, 'render');
    return result;
  }
}

// =============================================================================
// Single Pass Rendering
// =============================================================================

async function renderSinglePass(
  inputPath: string,
  config: RenderConfig,
  ctx: FFmpegContext,
  options: RenderExecOptions,
  startTime: number,
): Promise<RenderResult> {
  const outputConfig = buildOutputConfig(config);
  
  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs: [buildInputConfig(inputPath, config)],
    filterComplex: null,
    outputs: [outputConfig],
    globalArgs: buildGlobalArgs(config),
    timeoutMs: options.timeoutMs || DEFAULT_COMMAND_TIMEOUT_MS,
  };

  ctx.log('info', `Starting single-pass render -> ${config.outputPath}`, 'render');
  await executeFFmpeg(commandConfig, ctx, options);

  return buildResult(config, startTime, ctx);
}

// =============================================================================
// Two Pass Rendering
// =============================================================================

async function renderTwoPass(
  inputPath: string,
  config: RenderConfig,
  ctx: FFmpegContext,
  options: RenderExecOptions,
  startTime: number,
): Promise<RenderResult> {
  const logPath = tempLogPath(ctx.tempDir);
  const baseInput = buildInputConfig(inputPath, config);
  const globalArgs = buildGlobalArgs(config);

  try {
    ctx.log('info', 'Starting two-pass render [Pass 1/2: Analysis]', 'render');
    
    const pass1Command: CommandConfig = {
      binary: ctx.ffmpegPath,
      inputs: [baseInput],
      filterComplex: null,
      outputs: [
        {
          path: '-',
          map: [],
          videoCodec: null,
          audioCodec: null,
          videoBitrate: null,
          audioBitrate: null,
          crf: null,
          preset: null,
          tune: null,
          pixelFormat: null,
          fps: null,
          resolution: null,
          format: 'null',
          movFlags: null,
          metadata: {},
          overwrite: true,
          extraArgs: [
            '-pass', '1',
            '-passlogfile', logPath,
            '-an',
          ],
        },
      ],
      globalArgs,
      timeoutMs: options.timeoutMs || DEFAULT_COMMAND_TIMEOUT_MS,
    };

    await executeFFmpeg(pass1Command, ctx, options);

    ctx.log('info', 'Starting two-pass render [Pass 2/2: Encoding]', 'render');
    
    const pass2Output = buildOutputConfig(config);
    const newExtraArgs = ['-pass', '2', '-passlogfile', logPath].concat(pass2Output.extraArgs);
    pass2Output.extraArgs = newExtraArgs;

    const pass2Command: CommandConfig = {
      binary: ctx.ffmpegPath,
      inputs: [baseInput],
      filterComplex: null,
      outputs: [pass2Output],
      globalArgs,
      timeoutMs: options.timeoutMs || DEFAULT_COMMAND_TIMEOUT_MS,
    };

    await executeFFmpeg(pass2Command, ctx, options);

    return buildResult(config, startTime, ctx);
  } finally {
    await removeFileAsync(logPath);
  }
}

// =============================================================================
// Config Builders
// =============================================================================

function buildInputConfig(inputPath: string, config: RenderConfig): CommandConfig['inputs'][0] {
  return {
    path: inputPath,
    index: 0,
    duration: config.duration,
    startTime: config.startTime,
    format: null,
    streamLoop: 0,
    extraArgs: [],
  };
}

function buildOutputConfig(config: RenderConfig): CommandConfig['outputs'][0] {
  const extra: string[] = [];
  
  if (config.crf !== null) {
    extra.push('-crf', String(config.crf));
  } else if (config.videoBitrate !== null) {
    extra.push('-b:v', String(config.videoBitrate));
  }
  extra.push('-s', `${config.resolution.width}x${config.resolution.height}`);

  return {
    path: config.outputPath,
    map: [],
    videoCodec: config.videoCodec,
    audioCodec: config.audioCodec,
    videoBitrate: null,
    audioBitrate: config.audioBitrate || DEFAULT_AUDIO_BITRATE,
    crf: null,
    preset: config.preset || null,
    tune: config.tune || null,
    pixelFormat: config.pixelFormat,
    fps: config.fps,
    resolution: null,
    format: VIDEO_FORMAT_MAP[config.format] || null,
    movFlags: config.format === 'mp4' ? '+faststart' : null,
    metadata: config.metadata || {},
    overwrite: config.overwrite,
    extraArgs: extra,
  };
}

function buildGlobalArgs(config: RenderConfig): string[] {
  const args: string[] = ['-hide_banner'];
  if ('hardwareAccel' in config) {
    const hw = config.hardwareAccel;
    if (typeof hw === 'string' && hw !== 'none') {
      args.push('-hwaccel', hw);
    }
  }
  return args;
}

// =============================================================================
// Result Builder
// =============================================================================

async function buildResult(
  config: RenderConfig,
  startTime: number,
  ctx: FFmpegContext,
): Promise<RenderResult> {
  let duration = 0;
  try {
    duration = await probeDuration(config.outputPath, ctx);
  } catch {
    // Ignore probe errors on final file
  }

  return {
    success: true,
    outputPath: config.outputPath,
    duration: duration,
    fileSize: fileSize(config.outputPath),
    resolution: config.resolution,
    format: config.format,
    videoCodec: config.videoCodec,
    audioCodec: config.audioCodec,
    error: null,
    tempFiles: [],
    renderTimeMs: Date.now() - startTime,
  };
}
