// =============================================================================
// AI Video Generator — FFmpeg Engine Filter Graph Builder
// =============================================================================

import type {
  FilterEntry,
  Resolution,
  AnchorPosition,
  TransitionType,
} from './types';
import {
  ANCHOR_POSITIONS,
} from './constants';
import {
  escapeFilterValue,
  generateId,
} from './utils';

// =============================================================================
// Filter Graph Builder
// =============================================================================

export class FilterGraph {
  private entries: FilterEntry[] = [];
  private inputCount: number = 0;

  constructor() {
    this.entries = [];
    this.inputCount = 0;
  }

  public input(streamType: 'v' | 'a', inputIndex: number): string {
    this.inputCount++;
    return `[${inputIndex}:${streamType}]`;
  }

  public addFilter(
    inputs: string[],
    filterStr: string,
    outputs: string[] = [],
  ): this {
    this.entries.push({ inputs, filter: filterStr, outputs });
    return this;
  }

  public createLabel(prefix: string = 'tmp'): string {
    return `[${prefix}_${generateId()}]`;
  }

  // ===========================================================================
  // Video Filters
  // ===========================================================================

  public scale(
    input: string,
    resolution: Resolution,
    outputLabel?: string,
  ): this {
    const w = resolution.width % 2 === 0 ? resolution.width : resolution.width - 1;
    const h = resolution.height % 2 === 0 ? resolution.height : resolution.height - 1;
    const out = outputLabel ? `[${outputLabel}]` : '';
    return this.addFilter([input], `scale=${w}:${h}:force_original_aspect_ratio=decrease`, out ? [out] : []);
  }

  public scaleAndPad(
    input: string,
    resolution: Resolution,
    backgroundColor: string = 'black',
    outputLabel?: string,
  ): this {
    const w = resolution.width % 2 === 0 ? resolution.width : resolution.width - 1;
    const h = resolution.height % 2 === 0 ? resolution.height : resolution.height - 1;
    const out = outputLabel ? `[${outputLabel}]` : '';
    const filterStr = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${backgroundColor}`;
    return this.addFilter([input], filterStr, out ? [out] : []);
  }

  public crop(
    input: string,
    width: number,
    height: number,
    x: number = 0,
    y: number = 0,
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    return this.addFilter([input], `crop=${width}:${height}:${x}:${y}`, out ? [out] : []);
  }

  public fps(
    input: string,
    fps: number,
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    return this.addFilter([input], `fps=${fps}`, out ? [out] : []);
  }

  public format(
    input: string,
    pixelFormat: string = 'yuv420p',
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    return this.addFilter([input], `format=${pixelFormat}`, out ? [out] : []);
  }

  // ===========================================================================
  // Time & Fade Filters
  // ===========================================================================

  public fadeIn(
    input: string,
    duration: number = 1,
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    return this.addFilter([input], `fade=t=in:st=0:d=${duration}`, out ? [out] : []);
  }

  public fadeOut(
    input: string,
    startTime: number,
    duration: number = 1,
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    return this.addFilter([input], `fade=t=out:st=${startTime}:d=${duration}`, out ? [out] : []);
  }

  // ===========================================================================
  // Overlay & Watermark Filters
  // ===========================================================================

  public overlay(
    baseInput: string,
    overlayInput: string,
    position: AnchorPosition = 'topLeft',
    x: number | null = null,
    y: number | null = null,
    eofAction: string = 'repeat',
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    const pos = ANCHOR_POSITIONS[position];
    const xStr = x !== null ? String(x) : pos.x;
    const yStr = y !== null ? String(y) : pos.y;
    const filterStr = `overlay=${xStr}:${yStr}:eof_action=${eofAction}:format=auto`;
    return this.addFilter([baseInput, overlayInput], filterStr, out ? [out] : []);
  }

  public enableOverlay(
    baseInput: string,
    overlayInput: string,
    startTime: number,
    duration: number,
    position: AnchorPosition = 'topLeft',
    x: number | null = null,
    y: number | null = null,
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    const pos = ANCHOR_POSITIONS[position];
    const xStr = x !== null ? String(x) : pos.x;
    const yStr = y !== null ? String(y) : pos.y;
    const endTime = startTime + duration;
    const filterStr = `overlay=${xStr}:${yStr}:enable='between(t,${startTime},${endTime})':format=auto`;
    return this.addFilter([baseInput, overlayInput], filterStr, out ? [out] : []);
  }

  public drawText(
    input: string,
    text: string,
    options: {
      x?: string | number;
      y?: string | number;
      fontSize?: number;
      fontColor?: string;
      fontFamily?: string;
      shadowColor?: string;
      shadowX?: number;
      shadowY?: number;
      outlineColor?: string;
      outlineWidth?: number;
      alpha?: number;
      startTime?: number;
      duration?: number;
    } = {},
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    const opts = {
      text: escapeFilterValue(text),
      fontsize: options.fontSize || 24,
      fontcolor: options.fontColor || 'white',
      x: options.x ?? '(W-w)/2',
      y: options.y ?? '(H-h)/2',
      shadowcolor: options.shadowColor || 'black@0.5',
      shadowx: options.shadowX ?? 2,
      shadowy: options.shadowY ?? 2,
      borderw: options.outlineWidth || 0,
      bordercolor: options.outlineColor || 'black',
      alpha: options.alpha ?? 1.0,
    };

    let filterStr = `drawtext=${opts.text}:fontsize=${opts.fontsize}:fontcolor=${opts.fontcolor}:x=${opts.x}:y=${opts.y}:shadowcolor=${opts.shadowcolor}:shadowx=${opts.shadowx}:shadowy=${opts.shadowy}`;

    if (opts.borderw > 0) {
      filterStr += `:borderw=${opts.borderw}:bordercolor=${opts.bordercolor}`;
    }
    if (opts.alpha < 1.0) {
      filterStr += `:alpha=${opts.alpha}`;
    }
    if (options.fontFamily) {
      filterStr += `:fontfile=${options.fontFamily}`;
    }
    if (options.startTime !== undefined && options.duration !== undefined) {
      const endTime = options.startTime + options.duration;
      filterStr += `:enable='between(t,${options.startTime},${endTime})'`;
    }

    return this.addFilter([input], filterStr, out ? [out] : []);
  }

  // ===========================================================================
  // Transition Filters
  // ===========================================================================

  public xfade(
    inputA: string,
    inputB: string,
    transition: TransitionType,
    offset: number,
    duration: number,
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    const filterStr = `xfade=transition=${transition}:duration=${duration}:offset=${offset}`;
    return this.addFilter([inputA, inputB], filterStr, out ? [out] : []);
  }

  // ===========================================================================
  // Audio Filters
  // ===========================================================================

  public volume(
    input: string,
    vol: number,
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    return this.addFilter([input], `volume=${vol}`, out ? [out] : []);
  }

  public audioFadeIn(
    input: string,
    duration: number = 1,
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    return this.addFilter([input], `afade=t=in:st=0:d=${duration}`, out ? [out] : []);
  }

  public audioFadeOut(
    input: string,
    startTime: number,
    duration: number = 1,
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    return this.addFilter([input], `afade=t=out:st=${startTime}:d=${duration}`, out ? [out] : []);
  }

  public amix(
    inputs: string[],
    durations: number[] = [],
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    let filterStr = `amix=inputs=${inputs.length}:duration=longest:dropout_transition=3`;
    if (durations.length > 0) {
      const weights = durations.map(d => d > 0 ? (1 / d).toFixed(4) : '1').join(' ');
      filterStr += `:weights=${weights}`;
    }
    return this.addFilter(inputs, filterStr, out ? [out] : []);
  }

  public concatVideo(
    inputs: string[],
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    const n = inputs.length;
    const filterStr = `concat=n=${n}:v=1:a=0:unsafe=1`;
    return this.addFilter(inputs, filterStr, out ? [out] : []);
  }

  public concatAudio(
    inputs: string[],
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    const n = inputs.length;
    const filterStr = `concat=n=${n}:v=0:a=1:unsafe=1`;
    return this.addFilter(inputs, filterStr, out ? [out] : []);
  }

  // ===========================================================================
  // Subtitle Filters
  // ===========================================================================

  public burnSubtitles(
    input: string,
    subtitlePath: string,
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    const escapedPath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
    const filterStr = `subtitles=${escapeFilterValue(escapedPath)}`;
    return this.addFilter([input], filterStr, out ? [out] : []);
  }

  // ===========================================================================
  // Build & Reset
  // ===========================================================================

  public build(): string {
    if (this.entries.length === 0) {
      return '';
    }

    return this.entries.map(entry => {
      const inStr = entry.inputs.join('');
      const outStr = entry.outputs.join('');
      return `${inStr}${entry.filter}${outStr}`;
    }).join(';');
  }

  public reset(): this {
    this.entries = [];
    this.inputCount = 0;
    return this;
  }

  public getEntries(): FilterEntry[] {
    return [...this.entries];
  }
}

// =============================================================================
// Standalone Filter String Generators
// =============================================================================

export function generateKenBurnsFilter(
  width: number,
  height: number,
  totalFrames: number,
  direction: string,
  zoom: number,
): string {
  const safeFrames = Math.max(1, totalFrames);
  const safeZoom = Math.max(1.0, zoom);
  const z = safeZoom;
  const tf = safeFrames;
  const w = width;
  const h = height;

  if (tf <= 1) {
    return `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${tf}:s=${w}x${h}:fps=30`;
  }

  const expr = getKenBurnsExpression(direction, z, tf, w, h);
  return expr;
}

function getKenBurnsExpression(
  direction: string,
  z: number,
  tf: number,
  w: number,
  h: number,
): string {
  const base = (xDynamic: string, yDynamic: string) => 
    `zoompan=z='${z}':x='${xDynamic}':y='${yDynamic}':d=${tf}:s=${w}x${h}:fps=30`;

  switch (direction) {
    case 'zoomIn':
      return `zoompan=z='min(${z}+in*${(z - 1) / (tf - 1)},${z})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${tf}:s=${w}x${h}:fps=30`;
    case 'zoomOut':
      return `zoompan=z='if(eq(on,1),${z},max(${z}-in*${(z - 1) / (tf - 1)},1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${tf}:s=${w}x${h}:fps=30`;
    case 'panLeft':
      return base(`iw-(iw/zoom)-(in/${tf - 1}*(iw-iw/zoom))`, 'ih/2-(ih/zoom/2)');
    case 'panRight':
      return base(`in/${tf - 1}*(iw-iw/zoom)`, 'ih/2-(ih/zoom/2)');
    case 'panUp':
      return base('iw/2-(iw/zoom/2)', `ih-(ih/zoom)-(in/${tf - 1}*(ih-ih/zoom))`);
    case 'panDown':
      return base('iw/2-(iw/zoom/2)', `in/${tf - 1}*(ih-ih/zoom)`);
    case 'diagonalTL':
      return base(`iw-(iw/zoom)-(in/${tf - 1}*(iw-iw/zoom))`, `ih-(ih/zoom)-(in/${tf - 1}*(ih-ih/zoom))`);
    case 'diagonalTR':
      return base(`in/${tf - 1}*(iw-iw/zoom)`, `ih-(ih/zoom)-(in/${tf - 1}*(ih-ih/zoom))`);
    case 'diagonalBL':
      return base(`iw-(iw/zoom)-(in/${tf - 1}*(iw-iw/zoom))`, `in/${tf - 1}*(ih-ih/zoom)`);
    case 'diagonalBR':
      return base(`in/${tf - 1}*(iw-iw/zoom)`, `in/${tf - 1}*(ih-ih/zoom)`);
    default:
      return base('iw/2-(iw/zoom/2)', 'ih/2-(ih/zoom/2)');
  }
}

export function generateHwUploadFilter(hwAccel: string): string {
  if (hwAccel === 'cuda') return 'hwupload_cuda';
  if (hwAccel === 'qsv') return 'hwupload=extra_hw_frames=64';
  if (hwAccel === 'vaapi') return 'hwupload';
  if (hwAccel === 'd3d11va') return 'hwupload=extra_hw_frames=64';
  return '';
}

export function generateHwScaleFilter(
  hwAccel: string,
  width: number,
  height: number,
): string {
  const w = width % 2 === 0 ? width : width - 1;
  const h = height % 2 === 0 ? height : height - 1;
  
  if (hwAccel === 'cuda') return `scale_cuda=${w}:${h}`;
  if (hwAccel === 'qsv') return `scale_qsv=${w}:${h}`;
  if (hwAccel === 'vaapi') return `scale_vaapi=${w}:${h}`;
  if (hwAccel === 'd3d11va') return `scale_d3d11=${w}:${h}`;
  return `scale=${w}:${h}`;
}

export function generateHwDownloadFilter(hwAccel: string): string {
  if (hwAccel === 'cuda') return 'hwdownload,format=nv12';
  if (hwAccel === 'qsv') return 'hwdownload,format=nv12';
  if (hwAccel === 'vaapi') return 'hwdownload,format=nv12';
  if (hwAccel === 'd3d11va') return 'hwdownload,format=nv12';
  return '';
}