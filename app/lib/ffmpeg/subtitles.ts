// =============================================================================
// AI Video Generator — FFmpeg Engine Subtitle Operations
// =============================================================================

import * as fs from 'fs';
import type {
  FFmpegContext,
  SubtitleConfig,
  SubtitleEntry,
  SubtitleStyle,
  SubtitleFormat,
  CommandConfig,
} from './types';
import {
  DEFAULT_RENDER_CONFIG,
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_EXTENSIONS,
} from './constants';
import {
  ensureDir,
  formatSrtTime,
  formatAssTime,
} from './utils';
import {
  tempSubtitlePath,
} from './paths';
import {
  assertValid,
  validateSubtitleConfig,
} from './validate';
import {
  executeFFmpeg,
} from './command';
import {
  FilterGraph,
} from './filters';

// =============================================================================
// Main Subtitle Handler
// =============================================================================

/**
 * Burn subtitles into a video.
 * Generates a temporary subtitle file (SRT or ASS) from the config entries,
 * then applies FFmpeg's subtitle filter to hard-burn them into the video.
 */
export async function burnSubtitles(
  baseVideoPath: string,
  config: SubtitleConfig,
  outputPath: string,
  ctx: FFmpegContext,
): Promise<string> {
  assertValid(config, validateSubtitleConfig, 'burnSubtitles');
  ensureDir(outputPath);

  // Step 1: Resolve or generate the subtitle file path
  let subtitleFilePath = config.outputPath || '';
  const needsTempFile = !subtitleFilePath || !fs.existsSync(subtitleFilePath);
  
  if (needsTempFile) {
    subtitleFilePath = tempSubtitlePath(ctx.tempDir, config.format);
  }

  try {
    // Step 2: Generate the subtitle file content
    if (needsTempFile) {
      const content = generateSubtitleContent(config.entries, config.style, config.format);
      fs.writeFileSync(subtitleFilePath, content, 'utf-8');
      ctx.log('debug', `Generated temporary subtitle file: ${subtitleFilePath}`, 'subtitles');
    }

    // Step 3: Execute FFmpeg burn
    const graph = new FilterGraph();
    const videoLabel = graph.input('v', 0);
    
    graph.burnSubtitles(videoLabel, subtitleFilePath, 'vout');

    const commandConfig: CommandConfig = {
      binary: ctx.ffmpegPath,
      inputs: [
        {
          path: baseVideoPath,
          index: 0,
          duration: null,
          startTime: null,
          format: null,
          streamLoop: 0,
          extraArgs: [],
        },
      ],
      filterComplex: graph.build(),
      outputs: [
        {
          path: outputPath,
          map: ['[vout]', '0:a'],
          videoCodec: DEFAULT_RENDER_CONFIG.videoCodec,
          audioCodec: 'copy',
          videoBitrate: null,
          audioBitrate: null,
          crf: 23,
          preset: 'fast',
          tune: null,
          pixelFormat: 'yuv420p',
          fps: null,
          resolution: null,
          format: null,
          movFlags: '+faststart',
          metadata: {},
          overwrite: true,
          extraArgs: [],
        },
      ],
      globalArgs: ['-hide_banner'],
      timeoutMs: 120000,
    };

    ctx.log('info', `Burning ${config.entries.length} subtitles into ${baseVideoPath}`, 'subtitles');
    await executeFFmpeg(commandConfig, ctx);
    
    return outputPath;
  } finally {
    // Cleanup temp file if we created it
    if (needsTempFile) {
      try { fs.unlinkSync(subtitleFilePath); } catch { /* ignore */ }
    }
  }
}

// =============================================================================
// Content Generation
// =============================================================================

/**
 * Generate the string content for a subtitle file based on format.
 */
export function generateSubtitleContent(
  entries: SubtitleEntry[],
  baseStyle: SubtitleStyle,
  format: SubtitleFormat,
): string {
  switch (format) {
    case 'srt':
      return generateSrt(entries);
    case 'ass':
      return generateAss(entries, baseStyle);
    case 'vtt':
      return generateVtt(entries);
    default:
      return generateSrt(entries);
  }
}

// =============================================================================
// SRT Generation
// =============================================================================

function generateSrt(entries: SubtitleEntry[]): string {
  return entries.map((entry, index) => {
    const start = formatSrtTime(entry.startTime);
    const end = formatSrtTime(entry.endTime);
    return `${index + 1}\n${start} --> ${end}\n${entry.text}\n`;
  }).join('\n');
}

// =============================================================================
// VTT Generation
// =============================================================================

function generateVtt(entries: SubtitleEntry[]): string {
  const body = entries.map((entry) => {
    const start = formatSrtTime(entry.startTime).replace(',', '.');
    const end = formatSrtTime(entry.endTime).replace(',', '.');
    return `${start} --> ${end}\n${entry.text}\n`;
  }).join('\n');
  
  return `WEBVTT\n\n${body}`;
}

// =============================================================================
// ASS Generation (Advanced Substation Alpha)
// =============================================================================

function generateAss(entries: SubtitleEntry[], baseStyle: SubtitleStyle): string {
  const style = { ...DEFAULT_SUBTITLE_STYLE, ...baseStyle };
  
  // Convert hex colors to ASS format if necessary (&H00BBGGRR)
  const primaryCol = toAssColor(style.primaryColor);
  const outlineCol = toAssColor(style.outlineColor);
  
  // Map text position to ASS alignment (numpad style: 1=bot-left, 2=bot-center, 8=top-center)
  const alignment = getPositionAlignment(style.position);

  const header = `[Script Info]
Title: AI Generated Subtitles
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontName},${style.fontSize},${primaryCol},&H000000FF,${outlineCol},&H00000000,${style.bold ? -1 : 0},${style.italic ? -1 : 0},0,0,100,100,0,0,1,${style.outlineWidth},${style.shadow},${alignment},${style.marginL},${style.marginR},${style.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = entries.map((entry) => {
    const start = formatAssTime(entry.startTime);
    const end = formatAssTime(entry.endTime);
    const text = entry.text.replace(/\n/g, '\\N'); // ASS uses \N for newlines
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  }).join('\n');

  return header + events;
}

/**
 * Convert a hex color (#FFFFFF or &H00FFFFFF) to ASS format (&H00BBGGRR).
 */
function toAssColor(color: string): string {
  if (!color) return '&H00FFFFFF';
  
  // Already in ASS format
  if (color.startsWith('&H')) {
    return color.length === 10 ? color : color.padEnd(10, '0');
  }

  // Convert #RRGGBB to &H00BBGGRR
  const cleanHex = color.replace('#', '');
  if (cleanHex.length === 6) {
    const r = cleanHex.slice(0, 2);
    const g = cleanHex.slice(2, 4);
    const b = cleanHex.slice(4, 6);
    return `&H00${b}${g}${r}`;
  }

  return '&H00FFFFFF';
}

/**
 * Map generic position to ASS alignment integer (Numpad style).
 */
function getPositionAlignment(position: 'top' | 'center' | 'bottom'): number {
  switch (position) {
    case 'top': return 8;
    case 'center': return 5;
    case 'bottom': return 2;
    default: return 2;
  }
}