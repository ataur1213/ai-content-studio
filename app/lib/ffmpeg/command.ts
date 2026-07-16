// =============================================================================
// AI Video Generator — FFmpeg Engine Command Builder & Executor
// =============================================================================
// Translates CommandConfig into CLI arguments, spawns the FFmpeg process,
// manages stdout/stderr streams, progress tracking, and process lifecycle.
// Depends on types.ts, constants.ts, utils.ts, progress.ts, filters.ts (Layer 4).
// =============================================================================

import { spawn, ChildProcess } from 'child_process';
import type {
  CommandConfig,
  InputConfig,
  OutputConfig,
  FFmpegError,
  FFmpegContext,
  RenderProgressCallback,
  RenderProgress,
} from './types';
import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  MAX_STDERR_BUFFER,
  MOV_FASTSTART_FLAGS,
} from './constants';
import {
  withRetry,
} from './utils';
import {
  createProgressTracker,
  updateTracker,
  finalizeTracker,
  extractErrorMessage,
  createThrottledCallback,
} from './progress';

// =============================================================================
// Command Execution Options
// =============================================================================

export interface ExecuteOptions {
  /** AbortSignal to cancel the process externally. */
  signal?: AbortSignal;
  /** Override the default timeout in milliseconds. */
  timeoutMs?: number;
  /** Progress callback. */
  onProgress?: RenderProgressCallback;
  /** Throttle interval for progress callbacks in ms. */
  progressIntervalMs?: number;
}

// =============================================================================
// Argument Builder
// =============================================================================

/**
 * Convert a CommandConfig object into an array of FFmpeg CLI arguments.
 */
export function buildCommandArgs(config: CommandConfig): string[] {
  const args: string[] = [];

  // Global arguments
  args.push(...config.globalArgs);
  
  // Overwrite output without asking (can be overridden in globalArgs)
  if (!config.globalArgs.includes('-y') && !config.globalArgs.includes('-n')) {
    const hasOverwrite = config.outputs.some(o => o.overwrite);
    if (hasOverwrite) {
      args.push('-y');
    }
  }

  // Hide banner to keep stderr clean for progress parsing
  if (!args.includes('-hide_banner')) {
    args.push('-hide_banner');
  }
  if (!args.includes('-loglevel') && !args.includes('-v')) {
    args.push('-loglevel', 'warning');
  }

  // Inputs
  for (const input of config.inputs) {
    if (input.startTime !== null) {
      args.push('-ss', String(input.startTime));
    }
    if (input.duration !== null) {
      args.push('-t', String(input.duration));
    }
    if (input.streamLoop > 0) {
      args.push('-stream_loop', String(input.streamLoop));
    }
    if (input.format !== null) {
      args.push('-f', input.format);
    }
    args.push('-i', input.path);
    if (input.extraArgs.length > 0) {
      args.push(...input.extraArgs);
    }
  }

  // Filter Complex
  if (config.filterComplex !== null && config.filterComplex.trim().length > 0) {
    args.push('-filter_complex', config.filterComplex);
  }

  // Outputs
  for (const output of config.outputs) {
    // Maps
    for (const map of output.map) {
      args.push('-map', map);
    }

    // Video Codec & Settings
    if (output.videoCodec !== null) {
      args.push('-c:v', output.videoCodec);
    }

    // Audio Codec & Settings
    if (output.audioCodec !== null) {
      args.push('-c:a', output.audioCodec);
    }

    // Bitrates
    if (output.videoBitrate !== null) {
      args.push('-b:v', output.videoBitrate);
    }
    if (output.audioBitrate !== null) {
      args.push('-b:a', output.audioBitrate);
    }

    // CRF
    if (output.crf !== null) {
      args.push('-crf', String(output.crf));
    }

    // Preset & Tune (x264/x265)
    if (output.preset !== null && output.preset.trim().length > 0) {
      args.push('-preset', output.preset);
    }
    if (output.tune !== null && output.tune.trim().length > 0) {
      args.push('-tune', output.tune);
    }

    // Pixel Format
    if (output.pixelFormat !== null && output.pixelFormat.trim().length > 0) {
      args.push('-pix_fmt', output.pixelFormat);
    }

    // FPS
    if (output.fps !== null) {
      args.push('-r', String(output.fps));
    }

    // Resolution (Scale)
    if (output.resolution !== null) {
      args.push('-s', `${output.resolution.width}x${output.resolution.height}`);
    }

    // Format
    if (output.format !== null && output.format.trim().length > 0) {
      args.push('-f', output.format);
    }

    // MOV Fast Start
    if (output.movFlags !== null) {
      args.push('-movflags', output.movFlags);
    }

    // Metadata
    for (const [key, value] of Object.entries(output.metadata)) {
      if (value && typeof value === 'string') {
        args.push('-metadata', `${key}=${value}`);
      }
    }

    // Extra Args
    if (output.extraArgs.length > 0) {
      args.push(...output.extraArgs);
    }

    // Output filepath MUST be the last argument for this output
    args.push(output.path);
  }

  return args;
}

// =============================================================================
// Process Execution
// =============================================================================

/**
 * Execute an FFmpeg command defined by a CommandConfig.
 * Handles spawning, progress tracking, error collection, and cleanup.
 */
export async function executeFFmpeg(
  config: CommandConfig,
  ctx: FFmpegContext,
  options: ExecuteOptions = {},
): Promise<void> {
  const {
    signal,
    timeoutMs = config.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
    onProgress,
    progressIntervalMs = 500,
  } = options;

  // Calculate expected duration for progress tracking if possible
  const expectedDuration = config.inputs.reduce((max, inp) => {
    if (inp.duration !== null) {
      const end = (inp.startTime ?? 0) + inp.duration;
      return end > max ? end : max;
    }
    return max;
  }, 0);

  const tracker = createProgressTracker(expectedDuration);
  const throttledProgress = onProgress 
    ? createThrottledCallback(onProgress, progressIntervalMs) 
    : undefined;

  const executeOnce = (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(createError('Execution aborted before start', 'ABORTED', [], config));
        return;
      }

      const args = buildCommandArgs(config);
      ctx.log('debug', `Exec: ${config.binary} ${args.join(' ')} `, 'command');

      let child: ChildProcess;
      try {
        child = spawn(config.binary, args, {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        reject(createError(`Failed to spawn process: ${errMsg}`, 'SPAWN_ERROR', [], config));
        return;
      }

      const stderrChunks: Buffer[] = [];
      let totalStderrSize = 0;
      let killed = false;

      // Abort signal handler
      const onAbort = () => {
        killed = true;
        ctx.log('warn', 'Process killed via AbortSignal', 'command');
        child.kill('SIGKILL');
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      // Timeout handler
      const timer = setTimeout(() => {
        killed = true;
        ctx.log('error', `Process timed out after ${timeoutMs}ms`, 'command');
        child.kill('SIGKILL');
      }, timeoutMs);

      // Stderr handler (FFmpeg progress + errors)
      child.stderr?.on('data', (chunk: Buffer) => {
        const str = chunk.toString('utf-8');
        
        // Track progress
        const progressUpdate = updateTracker(tracker, str, 'rendering');
        if (progressUpdate && throttledProgress) {
          throttledProgress(progressUpdate);
        }

        // Buffer stderr for error extraction (prevent OOM)
        if (totalStderrSize < MAX_STDERR_BUFFER) {
          stderrChunks.push(chunk);
          totalStderrSize += chunk.length;
        }
      });

      // Stdout handler (usually empty for FFmpeg, but capture just in case)
      child.stdout?.on('data', (chunk: Buffer) => {
        ctx.log('debug', chunk.toString('utf-8'), 'command.stdout');
      });

      // Error handler (e.g., binary not found)
      child.on('error', (err) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(createError(`Process error: ${err.message}`, 'PROCESS_ERROR', [], config));
      });

      // Close handler
      child.on('close', (code) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);

        const stderrStr = Buffer.concat(stderrChunks).toString('utf-8');
        const finalProgress = finalizeTracker(tracker, code === 0 && !killed);
        
        if (throttledProgress) {
          throttledProgress(finalProgress);
        }

        if (killed) {
          const reason = signal?.aborted ? 'Aborted by user' : 'Timed out';
          reject(createError(`Process ${reason.toLowerCase()}`, 'KILLED', stderrStr.split('\n'), config, code));
        } else if (code !== 0 && code !== null) {
          const errorMsg = extractErrorMessage(stderrStr.split('\n')) || `FFmpeg exited with code ${code}`;
          reject(createError(errorMsg, 'EXIT_ERROR', stderrStr.split('\n'), config, code));
        } else {
          ctx.log('info', 'FFmpeg process completed successfully', 'command');
          resolve();
        }
      });
    });
  };

  // Execute with retry logic (retry on transient failures, not on user abort)
  return withRetry(
    executeOnce,
    ctx.retryAttempts,
    ctx.retryDelayMs,
    'executeFFmpeg',
    ctx.log,
  );
}

// =============================================================================
// Error Construction
// =============================================================================

/**
 * Construct a standardized FFmpegError object.
 */
function createError(
  message: string,
  code: string,
  stderrLines: string[],
  config: CommandConfig,
  exitCode: number | null = null,
): FFmpegError {
  return {
    code,
    message,
    stderr: stderrLines.join('\n').slice(0, MAX_STDERR_BUFFER),
    exitCode,
    command: [config.binary, ...buildCommandArgs(config)],
    timestamp: Date.now(),
  };
}

// =============================================================================
// Utility Wrappers
// =============================================================================

/**
 * Execute a raw command string (for advanced use cases where CommandConfig is overkill).
 * Splits the string safely respecting quotes.
 */
export async function executeRaw(
  commandString: string,
  ctx: FFmpegContext,
  timeoutMs: number = DEFAULT_COMMAND_TIMEOUT_MS,
): Promise<string> {
  const args = parseCommandLine(commandString);
  if (args.length === 0) {
    throw new Error('Empty command string');
  }

  const binary = args[0];
  const restArgs = args.slice(1);

  return new Promise<string>((resolve, reject) => {
    const child = spawn(binary, restArgs, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Raw command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && code !== null) {
        const stderr = Buffer.concat(stderrChunks).toString('utf-8');
        reject(new Error(`Command failed (${code}): ${stderr.slice(0, 500)}`));
      } else {
        resolve(Buffer.concat(stdoutChunks).toString('utf-8'));
      }
    });
  });
}

/**
 * Simple command line parser that handles quotes.
 */
function parseCommandLine(cmd: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i];
    
    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"' || char === "'") {
        inQuote = true;
        quoteChar = char;
      } else if (char === ' ' || char === '\t') {
        if (current.length > 0) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}