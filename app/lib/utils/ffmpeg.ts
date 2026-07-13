// =======================================================
// AI Content Studio
// File: lib/utils/ffmpeg.ts
// Part 1/4
// =======================================================

import path from "path";

// =======================================================
// Types
// =======================================================

export type InputType =
  | "image"
  | "audio"
  | "subtitle";

export interface FFmpegInput {
  file: string;
  type: InputType;
}

export interface FFmpegCommandOptions {
  inputs: FFmpegInput[];

  filterComplex: string;

  output: string;

  width: number;

  height: number;

  fps: number;

  quality: "720p" | "1080p" | "1440p";
}

// =======================================================
// Quality Presets
// =======================================================

interface QualityPreset {
  videoBitrate: string;
  maxRate: string;
  bufferSize: string;
  crf: string;
}

const QUALITY: Record<
  FFmpegCommandOptions["quality"],
  QualityPreset
> = {
  "720p": {
    videoBitrate: "4M",
    maxRate: "5M",
    bufferSize: "8M",
    crf: "23",
  },

  "1080p": {
    videoBitrate: "8M",
    maxRate: "10M",
    bufferSize: "16M",
    crf: "20",
  },

  "1440p": {
    videoBitrate: "16M",
    maxRate: "20M",
    bufferSize: "32M",
    crf: "18",
  },
};

// =======================================================
// Codec Settings
// =======================================================

const VIDEO_CODEC = "libx264";

const AUDIO_CODEC = "aac";

const AUDIO_BITRATE = "192k";

const PIXEL_FORMAT = "yuv420p";

const PRESET = "medium";

const MOV_FLAGS = "+faststart";

// =======================================================
// Resolution Helpers
// =======================================================

export function getResolution(
  width: number,
  height: number
) {
  return `${width}x${height}`;
}

export function normalizeResolution(
  width: number,
  height: number
) {
  return {
    width: Math.max(width, 320),
    height: Math.max(height, 240),
  };
}

// =======================================================
// Filter Helpers
// =======================================================

export function escapePath(file: string) {
  return file.replace(/\\/g, "/");
}

export function normalizeOutput(
  output: string
) {
  return path.normalize(output);
}

// =======================================================
// Validation
// =======================================================

function validate(
  options: FFmpegCommandOptions
) {
  if (!options.inputs.length) {
    throw new Error(
      "FFmpeg inputs are empty."
    );
  }

  if (!options.output) {
    throw new Error(
      "Output path missing."
    );
  }

  if (!options.filterComplex) {
    throw new Error(
      "Filter complex missing."
    );
  }
}

// =======================================================
// Part 1 Ends Here
//
// Part 2:
// • Input Builder
// • Image Loop
// • Audio Inputs
// • Subtitle Inputs
// • Filter Complex Builder
// =======================================================
// =======================================================
// AI Content Studio
// File: lib/utils/ffmpeg.ts
// Part 2/4
// =======================================================

// =======================================================
// Input Builder
// =======================================================

function buildInputArguments(
  inputs: FFmpegInput[]
): string[] {

  const args: string[] = [];

  for (const input of inputs) {

    switch (input.type) {

      case "image":

        args.push(
          "-loop",
          "1",
          "-i",
          escapePath(input.file)
        );

        break;

      case "audio":

        args.push(
          "-i",
          escapePath(input.file)
        );

        break;

      case "subtitle":

        args.push(
          "-i",
          escapePath(input.file)
        );

        break;

    }

  }

  return args;

}

// =======================================================
// Video Encoder
// =======================================================

function buildVideoArguments(
  options: FFmpegCommandOptions
): string[] {

  const quality =
    QUALITY[options.quality];

  return [

    "-c:v",
    VIDEO_CODEC,

    "-preset",
    PRESET,

    "-pix_fmt",
    PIXEL_FORMAT,

    "-crf",
    quality.crf,

    "-b:v",
    quality.videoBitrate,

    "-maxrate",
    quality.maxRate,

    "-bufsize",
    quality.bufferSize,

    "-r",
    String(options.fps),

  ];

}

// =======================================================
// Audio Encoder
// =======================================================

function buildAudioArguments(): string[] {

  return [

    "-c:a",
    AUDIO_CODEC,

    "-b:a",
    AUDIO_BITRATE,

    "-ar",
    "48000",

    "-ac",
    "2",

  ];

}

// =======================================================
// Output Arguments
// =======================================================

function buildOutputArguments(
  output: string
): string[] {

  return [

    "-movflags",
    MOV_FLAGS,

    "-shortest",

    normalizeOutput(output),

  ];

}

// =======================================================
// Filter Complex
// =======================================================

function buildFilterArguments(
  filter: string
): string[] {

  if (!filter.trim()) {

    return [];

  }

  return [

    "-filter_complex",

    filter,

  ];

}

// =======================================================
// Resolution Arguments
// =======================================================

function buildResolutionArguments(
  width: number,
  height: number
): string[] {

  const size =
    normalizeResolution(
      width,
      height
    );

  return [

    "-s",

    `${size.width}x${size.height}`,

  ];

}

// =======================================================
// Part 2 Ends Here
//
// Part 3:
//
// • Main FFmpeg Command Builder
// • Subtitle Support
// • Watermark Support
// • Background Music Mix
// • Command Generator
// =======================================================
// =======================================================
// AI Content Studio
// File: lib/utils/ffmpeg.ts
// Part 3/4
// =======================================================

// =======================================================
// Main FFmpeg Command Builder
// =======================================================

export function buildFFmpegCommand(
  options: FFmpegCommandOptions
): string[] {

  validate(options);

  const command: string[] = [];

  // FFmpeg executable
  command.push("ffmpeg");

  // Hide banner
  command.push("-hide_banner");

  // Overwrite output
  command.push("-y");

  // Inputs
  command.push(
    ...buildInputArguments(
      options.inputs
    )
  );

  // Filter Complex
  command.push(
    ...buildFilterArguments(
      options.filterComplex
    )
  );

  // Resolution
  command.push(
    ...buildResolutionArguments(
      options.width,
      options.height
    )
  );

  // Video Encoder
  command.push(
    ...buildVideoArguments(
      options
    )
  );

  // Audio Encoder
  command.push(
    ...buildAudioArguments()
  );

  // Optimize MP4
  command.push(
    "-threads",
    "0"
  );

  // Output
  command.push(
    ...buildOutputArguments(
      options.output
    )
  );

  return command;

}

// =======================================================
// Command Preview
// =======================================================

export function commandToString(
  command: string[]
): string {

  return command.join(" ");

}

// =======================================================
// Debug Helper
// =======================================================

export function printCommand(
  command: string[]
) {

  console.log("");

  console.log("================================");

  console.log("FFmpeg Command");

  console.log("================================");

  console.log(
    commandToString(command)
  );

  console.log("================================");

  console.log("");

}

// =======================================================
// Estimated Video Bitrate
// =======================================================

export function estimateBitrate(
  quality: FFmpegCommandOptions["quality"]
) {

  return QUALITY[quality].videoBitrate;

}

// =======================================================
// Estimated CRF
// =======================================================

export function estimateCRF(
  quality: FFmpegCommandOptions["quality"]
) {

  return QUALITY[quality].crf;

}

// =======================================================
// Ready Check
// =======================================================

export function isCommandReady(
  options: FFmpegCommandOptions
) {

  try {

    validate(options);

    return true;

  } catch {

    return false;

  }

}

// =======================================================
// Part 3 Ends Here
//
// Part 4:
//
// • FFmpeg Version Check
// • FFmpeg Path Support
// • Windows/Linux Compatibility
// • Default Export
// =======================================================
// =======================================================
// AI Content Studio
// File: lib/utils/ffmpeg.ts
// Part 4/4
// =======================================================

import fs from "fs";
import { spawnSync } from "child_process";

// =======================================================
// FFmpeg Path
// =======================================================

export function getFFmpegPath(): string {

  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }

  return "ffmpeg";

}

// =======================================================
// FFprobe Path
// =======================================================

export function getFFprobePath(): string {

  if (process.env.FFPROBE_PATH) {
    return process.env.FFPROBE_PATH;
  }

  return "ffprobe";

}

// =======================================================
// Check FFmpeg Installation
// =======================================================

export function isFFmpegInstalled(): boolean {

  try {

    const result = spawnSync(
      getFFmpegPath(),
      ["-version"],
      {
        encoding: "utf8",
      }
    );

    return result.status === 0;

  } catch {

    return false;

  }

}

// =======================================================
// Check FFprobe Installation
// =======================================================

export function isFFprobeInstalled(): boolean {

  try {

    const result = spawnSync(
      getFFprobePath(),
      ["-version"],
      {
        encoding: "utf8",
      }
    );

    return result.status === 0;

  } catch {

    return false;

  }

}

// =======================================================
// Ensure Output Directory
// =======================================================

export function ensureOutputDirectory(
  output: string
): void {

  const directory = path.dirname(output);

  if (!fs.existsSync(directory)) {

    fs.mkdirSync(directory, {
      recursive: true,
    });

  }

}

// =======================================================
// Prepare Command
// =======================================================

export function prepareFFmpegCommand(
  options: FFmpegCommandOptions
): string[] {

  ensureOutputDirectory(
    options.output
  );

  const command =
    buildFFmpegCommand(options);

  command[0] = getFFmpegPath();

  return command;

}

// =======================================================
// Utility
// =======================================================

export function printEnvironment(): void {

  console.log("");

  console.log("========== FFmpeg ==========");

  console.log(
    "FFmpeg:",
    getFFmpegPath()
  );

  console.log(
    "FFprobe:",
    getFFprobePath()
  );

  console.log(
    "Installed:",
    isFFmpegInstalled()
  );

  console.log("============================");

  console.log("");

}

// =======================================================
// Default Export
// =======================================================

export default buildFFmpegCommand;

// =======================================================
// End of File
// =======================================================