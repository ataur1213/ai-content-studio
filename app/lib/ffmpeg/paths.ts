// =============================================================================
// AI Video Generator — FFmpeg Engine Path Management
// =============================================================================
// Resolves FFmpeg/FFprobe binary paths from static packages or system PATH,
// manages temporary directory lifecycle, and generates output paths.
// Depends on types.ts, constants.ts, utils.ts (Layer 0-1).
// =============================================================================

import * as path from 'path';
import * as os from 'os';
import type {
  FilePath,
  StudioConfig,
  VideoFormat,
  AudioFormat,
  ImageFormat,
  SubtitleFormat,
} from './types';
import {
  TEMP_FILE_PREFIX,
  TEMP_VIDEO_EXT,
  TEMP_AUDIO_EXT,
  TEMP_IMAGE_EXT,
  TEMP_SUBTITLE_EXT,
  VIDEO_FORMAT_MAP,
  AUDIO_FORMAT_MAP,
  SUBTITLE_EXTENSIONS,
  DEFAULT_STUDIO_CONFIG,
} from './constants';
import {
  ensureDir,
  ensureDirAsync,
  removeDir,
  removeDirAsync,
  removeFiles,
  removeFilesAsync,
  listFiles,
  createTempPath,
  fileExists,
  joinPath,
  resolvePath,
  getFilename,
  getDirName,
} from './utils';

// =============================================================================
// Binary Resolution
// =============================================================================

/**
 * Attempt to resolve the ffmpeg-static package.
 * This package provides a pre-built FFmpeg binary for the current platform.
 */
function resolveFfmpegStatic(): FilePath | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegPath = require('ffmpeg-static') as string | undefined;
    if (typeof ffmpegPath === 'string' && ffmpegPath.length > 0) {
      return resolvePath(ffmpegPath);
    }
  } catch {
    // Package not installed
  }
  return null;
}

/**
 * Attempt to resolve the ffprobe-static package.
 * This package provides a pre-built FFprobe binary for the current platform.
 */
function resolveFfprobeStatic(): FilePath | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffprobePath = require('ffprobe-static') as { path: string } | string | undefined;
    if (typeof ffprobePath === 'string') {
      return resolvePath(ffprobePath);
    }
    if (ffprobePath && typeof ffprobePath === 'object' && typeof ffprobePath.path === 'string') {
      return resolvePath(ffprobePath.path);
    }
  } catch {
    // Package not installed
  }
  return null;
}

/**
 * Resolve the FFmpeg binary path.
 * Priority:
 *   1. Explicit path from config
 *   2. ffmpeg-static npm package
 *   3. Fallback to 'ffmpeg' (relies on system PATH)
 */
export function resolveFfmpegPath(config?: Partial<StudioConfig>): FilePath {
  const explicitPath = config?.ffmpegPath ?? DEFAULT_STUDIO_CONFIG.ffmpegPath;
  if (explicitPath && explicitPath !== 'ffmpeg') {
    const absolute = resolvePath(explicitPath);
    if (fileExists(absolute)) {
      return absolute;
    }
  }

  const staticPath = resolveFfmpegStatic();
  if (staticPath && fileExists(staticPath)) {
    return staticPath;
  }

  return 'ffmpeg';
}

/**
 * Resolve the FFprobe binary path.
 * Priority:
 *   1. Explicit path from config
 *   2. ffprobe-static npm package
 *   3. Fallback to 'ffprobe' (relies on system PATH)
 */
export function resolveFfprobePath(config?: Partial<StudioConfig>): FilePath {
  const explicitPath = config?.ffprobePath ?? DEFAULT_STUDIO_CONFIG.ffprobePath;
  if (explicitPath && explicitPath !== 'ffprobe') {
    const absolute = resolvePath(explicitPath);
    if (fileExists(absolute)) {
      return absolute;
    }
  }

  const staticPath = resolveFfprobeStatic();
  if (staticPath && fileExists(staticPath)) {
    return staticPath;
  }

  return 'ffprobe';
}

/**
 * Resolve both FFmpeg and FFprobe paths at once.
 * Returns an object with both resolved paths.
 */
export function resolveBinaryPaths(config?: Partial<StudioConfig>): {
  ffmpegPath: FilePath;
  ffprobePath: FilePath;
} {
  return {
    ffmpegPath: resolveFfmpegPath(config),
    ffprobePath: resolveFfprobePath(config),
  };
}

// =============================================================================
// Temp Directory Management
// =============================================================================

/**
 * Get the default temp directory path.
 * Uses the config's tempDir if provided, otherwise creates a scoped
 * directory inside the OS temp folder.
 */
export function getDefaultTempDir(config?: Partial<StudioConfig>): FilePath {
  const explicitDir = config?.tempDir ?? DEFAULT_STUDIO_CONFIG.tempDir;
  if (explicitDir && explicitDir !== './temp') {
    return resolvePath(explicitDir);
  }
  // Create a scoped temp dir inside OS temp to avoid conflicts
  return joinPath(os.tmpdir(), `${TEMP_FILE_PREFIX}studio`);
}

/**
 * Initialize the temp directory (ensure it exists).
 * Returns the absolute path to the temp directory.
 */
export function initTempDir(config?: Partial<StudioConfig>): FilePath {
  const tempDir = getDefaultTempDir(config);
  ensureDir(tempDir);
  return tempDir;
}

/**
 * Initialize the temp directory asynchronously.
 * Returns the absolute path to the temp directory.
 */
export async function initTempDirAsync(config?: Partial<StudioConfig>): Promise<FilePath> {
  const tempDir = getDefaultTempDir(config);
  await ensureDirAsync(tempDir);
  return tempDir;
}

/**
 * Clean up all engine-generated files from the temp directory.
 * Only removes files matching the TEMP_FILE_PREFIX pattern.
 */
export function cleanTempDir(tempDir: FilePath): void {
  if (!fileExists(tempDir)) return;
  const files = listFiles(tempDir);
  const engineFiles = files.filter(f => {
    const name = path.basename(f);
    return name.startsWith(TEMP_FILE_PREFIX);
  });
  removeFiles(engineFiles);
}

/**
 * Clean up all engine-generated files from the temp directory asynchronously.
 */
export async function cleanTempDirAsync(tempDir: FilePath): Promise<void> {
  if (!fileExists(tempDir)) return;
  const files = listFiles(tempDir);
  const engineFiles = files.filter(f => {
    const name = path.basename(f);
    return name.startsWith(TEMP_FILE_PREFIX);
  });
  await removeFilesAsync(engineFiles);
}

/**
 * Completely remove the temp directory and all its contents.
 * Use with caution — this deletes everything in the temp dir.
 */
export function destroyTempDir(tempDir: FilePath): void {
  removeDir(tempDir);
}

/**
 * Completely remove the temp directory asynchronously.
 */
export async function destroyTempDirAsync(tempDir: FilePath): Promise<void> {
  await removeDirAsync(tempDir);
}

// =============================================================================
// Output Path Generation
// =============================================================================

/**
 * Generate an output file path with proper extension.
 * If outputPath already has the correct extension, it is returned as-is.
 * Otherwise, the extension is replaced or appended.
 */
export function resolveOutputPath(
  outputPath: FilePath,
  format: VideoFormat | AudioFormat | ImageFormat,
): FilePath {
  const dir = getDirName(outputPath);
  const base = getFilename(outputPath);
  let ext: string;

  if (format in VIDEO_FORMAT_MAP) {
    ext = `.${(format as VideoFormat)}`;
  } else if (format in AUDIO_FORMAT_MAP) {
    ext = `.${(format as AudioFormat)}`;
  } else {
    ext = `.${format}`;
  }

  // If the base name already ends with the target extension, return as-is
  if (outputPath.toLowerCase().endsWith(ext)) {
    return resolvePath(outputPath);
  }

  // Strip any existing extension from the base name and append the correct one
  const cleanBase = path.basename(base, path.extname(base));
  return resolvePath(joinPath(dir === '.' ? './' : dir, `${cleanBase}${ext}`));
}

/**
 * Generate a unique output path to avoid overwriting existing files.
 * Appends a numeric suffix if the target path already exists.
 */
export function generateUniqueOutputPath(
  outputPath: FilePath,
  format: VideoFormat | AudioFormat | ImageFormat,
): FilePath {
  const resolved = resolveOutputPath(outputPath, format);
  if (!fileExists(resolved)) {
    return resolved;
  }

  const dir = getDirName(resolved);
  const base = getFilename(resolved);
  const ext = path.extname(resolved);
  let counter = 1;

  while (true) {
    const candidate = joinPath(dir === '.' ? './' : dir, `${base}_${counter}${ext}`);
    if (!fileExists(candidate)) {
      return candidate;
    }
    counter++;
  }
}

// =============================================================================
// Temp File Path Generators (Context-Aware)
// =============================================================================

/** Generate a temp video path in the given temp directory. */
export function tempVideoPath(tempDir: FilePath): FilePath {
  return createTempPath(tempDir, TEMP_VIDEO_EXT, `${TEMP_FILE_PREFIX}vid`);
}

/** Generate a temp audio path in the given temp directory. */
export function tempAudioPath(tempDir: FilePath): FilePath {
  return createTempPath(tempDir, TEMP_AUDIO_EXT, `${TEMP_FILE_PREFIX}aud`);
}

/** Generate a temp image path in the given temp directory. */
export function tempImagePath(tempDir: FilePath, format: string = 'png'): FilePath {
  const ext = format.startsWith('.') ? format : `.${format}`;
  return createTempPath(tempDir, ext, `${TEMP_FILE_PREFIX}img`);
}

/** Generate a temp subtitle path in the given temp directory. */
export function tempSubtitlePath(
  tempDir: FilePath,
  format: SubtitleFormat = 'ass',
): FilePath {
  const ext = SUBTITLE_EXTENSIONS[format] || TEMP_SUBTITLE_EXT;
  return createTempPath(tempDir, ext, `${TEMP_FILE_PREFIX}sub`);
}

/** Generate a temp two-pass log path in the given temp directory. */
export function tempLogPath(tempDir: FilePath): FilePath {
  return createTempPath(tempDir, '.log', `${TEMP_FILE_PREFIX}log`);
}

/** Generate a temp path for an intermediate compose step. */
export function tempComposeStepPath(tempDir: FilePath, stepIndex: number): FilePath {
  const id = `${TEMP_FILE_PREFIX}step_${String(stepIndex).padStart(4, '0')}`;
  return joinPath(tempDir, `${id}${TEMP_VIDEO_EXT}`);
}

// =============================================================================
// Path Validation
// =============================================================================

/**
 * Validate that a file path exists and is accessible.
 * Returns an error message if invalid, or null if valid.
 */
export function validateFilePath(filePath: FilePath, label: string = 'File'): string | null {
  if (!filePath || typeof filePath !== 'string' || filePath.trim().length === 0) {
    return `${label} path is empty`;
  }
  const resolved = resolvePath(filePath);
  if (!fileExists(resolved)) {
    return `${label} not found: ${resolved}`;
  }
  return null;
}

/**
 * Validate that a directory path exists and is a directory.
 * Returns an error message if invalid, or null if valid.
 */
export function validateDirPath(dirPath: FilePath, label: string = 'Directory'): string | null {
  if (!dirPath || typeof dirPath !== 'string' || dirPath.trim().length === 0) {
    return `${label} path is empty`;
  }
  const resolved = resolvePath(dirPath);
  try {
    const stat = require('fs').statSync(resolved);
    if (!stat.isDirectory()) {
      return `${label} is not a directory: ${resolved}`;
    }
  } catch {
    return `${label} not found: ${resolved}`;
  }
  return null;
}

/**
 * Validate that an output path's parent directory exists or can be created.
 * Returns the resolved output path if valid, or throws.
 */
export function ensureOutputPath(outputPath: FilePath): FilePath {
  const resolved = resolvePath(outputPath);
  const dir = getDirName(resolved);
  ensureDir(dir);
  return resolved;
}

/**
 * Validate that an output path's parent directory exists or can be created (async).
 * Returns the resolved output path if valid, or throws.
 */
export async function ensureOutputPathAsync(outputPath: FilePath): Promise<FilePath> {
  const resolved = resolvePath(outputPath);
  const dir = getDirName(resolved);
  await ensureDirAsync(dir);
  return resolved;
}