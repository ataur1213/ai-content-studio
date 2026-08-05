// =============================================================================
// AI Video Generator — FFmpeg Engine Filter Graph Builder
// =============================================================================

import type {
  FilterEntry,
  Resolution,
  AnchorPosition,
  TransitionType,
  SubtitleEntry,
  SubtitleStyle,
  DynamicSubtitleEntry,
  WordTimestamp,
  PopupCaptionConfig,
  EmojiAnimationConfig,
  DynamicSubtitlesConfig,
  SmartCrop916Config,
  SmartCrop916Result,
  AutoReframe916Config,
  DynamicZoomConfig,
  DynamicZoomResult,
  CropRect,
} from './types';
import {
  ANCHOR_POSITIONS,
  ASPECT_RATIOS,
} from './constants';
import {
  escapeFilterValue,
  generateId,
} from './utils';
import {
  assertValid,
  validateSmartCrop916Config,
  validateAutoReframe916Config,
  validateDynamicZoomConfig,
} from './validate';

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

  public smartCrop916(
    input: string,
    config: SmartCrop916Config,
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    const result = generateSmartCrop916Filter(config);
    return this.addFilter([input], result.filter, out ? [out] : []);
  }

  public autoReframe916(
    input: string,
    config: AutoReframe916Config,
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    const result = generateAutoReframe916Filter(config);
    return this.addFilter([input], result.filter, out ? [out] : []);
  }

  public dynamicZoom(
    input: string,
    config: DynamicZoomConfig,
    outputLabel?: string,
  ): this {
    const out = outputLabel ? `[${outputLabel}]` : '';
    const result = generateDynamicZoomFilter(config);
    if (result.filter.length === 0) {
      return this;
    }
    return this.addFilter([input], result.filter, out ? [out] : []);
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

    let filterStr = `drawtext=text=${opts.text}:fontsize=${opts.fontsize}:fontcolor=${opts.fontcolor}:x=${opts.x}:y=${opts.y}:shadowcolor=${opts.shadowcolor}:shadowx=${opts.shadowx}:shadowy=${opts.shadowy}`;

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

function clampNumber(value: number, min: number, max: number): number {
  if (!isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function makeEvenNumber(value: number): number {
  const v = Math.max(0, Math.floor(value));
  return v % 2 === 0 ? v : v - 1;
}

function computeCropRect(
  input: Resolution,
  focusX: number,
  focusY: number,
): CropRect {
  const targetAspect = ASPECT_RATIOS['9:16'];
  const srcW = input.width;
  const srcH = input.height;

  const srcAspect = srcW / srcH;

  let cropW = srcW;
  let cropH = srcH;

  if (srcAspect > targetAspect) {
    cropH = srcH;
    cropW = Math.floor(srcH * targetAspect);
  } else if (srcAspect < targetAspect) {
    cropW = srcW;
    cropH = Math.floor(srcW / targetAspect);
  }

  cropW = makeEvenNumber(cropW);
  cropH = makeEvenNumber(cropH);

  const maxX = Math.max(0, srcW - cropW);
  const maxY = Math.max(0, srcH - cropH);

  let x = Math.round(maxX * focusX);
  let y = Math.round(maxY * focusY);

  x = Math.max(0, Math.min(maxX, x));
  y = Math.max(0, Math.min(maxY, y));

  x = makeEvenNumber(x);
  y = makeEvenNumber(y);

  return {
    width: cropW,
    height: cropH,
    x,
    y,
  };
}

export function generateSmartCrop916Filter(config: SmartCrop916Config): SmartCrop916Result {
  assertValid(config, validateSmartCrop916Config, 'smartCrop916');

  const focusX = clampNumber(config.focusX ?? 0.5, 0, 1);
  const focusY = clampNumber(config.focusY ?? 0.5, 0, 1);

  const crop = computeCropRect(config.input, focusX, focusY);
  const output: Resolution = {
    width: makeEvenNumber(config.output.width),
    height: makeEvenNumber(config.output.height),
  };

  const filter =
    `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},` +
    `scale=${output.width}:${output.height}:flags=lanczos`;

  return { crop, output, filter };
}

export function generateAutoReframe916Filter(config: AutoReframe916Config): SmartCrop916Result {
  assertValid(config, validateAutoReframe916Config, 'autoReframe916');

  const focusX = clampNumber(config.focusX ?? 0.5, 0, 1);
  const focusY = clampNumber(config.focusY ?? 0.5, 0, 1);

  const crop = computeCropRect(config.input, focusX, focusY);
  const output: Resolution = {
    width: makeEvenNumber(config.output.width),
    height: makeEvenNumber(config.output.height),
  };

  const filter =
    `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},` +
    `scale=${output.width}:${output.height}:flags=lanczos`;

  return { crop, output, filter };
}

function buildZoomDeltaExpression(config: DynamicZoomConfig): string {
  const d = config.durationSec;
  const amount = config.zoomAmount;

  switch (config.mode) {
    case 'in':
      return `${amount}*min(t/${d},1)`;
    case 'out':
      return `${amount}*max(1-t/${d},0)`;
    case 'in-out':
      return `${amount}*sin(PI*t/${d})`;
    case 'out-in':
      return `${amount}*(1-sin(PI*t/${d}))`;
    default:
      return '0';
  }
}

export function generateDynamicZoomFilter(config: DynamicZoomConfig): DynamicZoomResult {
  assertValid(config, validateDynamicZoomConfig, 'dynamicZoom');

  const amount = clampNumber(config.zoomAmount, 0, 1);
  if (amount <= 0) {
    return { filter: '', baseResolution: config.baseResolution };
  }

  const focusX = clampNumber(config.focusX ?? 0.5, 0, 1);
  const focusY = clampNumber(config.focusY ?? 0.5, 0, 1);

  const baseW = makeEvenNumber(config.baseResolution.width);
  const baseH = makeEvenNumber(config.baseResolution.height);

  const deltaExpr = buildZoomDeltaExpression({ ...config, zoomAmount: amount });
  const zoomExpr = `1+(${deltaExpr})`;

  const scale =
    `scale=w='${baseW}*(${zoomExpr})':h='${baseH}*(${zoomExpr})':flags=lanczos:eval=frame`;
  const crop =
    `crop=${baseW}:${baseH}:(iw-${baseW})*${focusX}:(ih-${baseH})*${focusY}`;

  return {
    filter: `${scale},${crop}`,
    baseResolution: { width: baseW, height: baseH },
  };
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

function toFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:');
}



function popupAnchorXYExpr(
  position: AnchorPosition,
  offsetX: number,
  offsetY: number,
): { x: string; y: string } {
  const ox = isFinite(offsetX) ? offsetX : 0;
  const oy = isFinite(offsetY) ? offsetY : 0;
  const px = (base: string) => ox !== 0 ? `(${base})+${ox}` : base;
  const py = (base: string) => oy !== 0 ? `(${base})+${oy}` : base;

  switch (position) {
    case 'topLeft':
      return { x: px('0'), y: py('0') };
    case 'topCenter':
      return { x: px('(W-text_w)/2'), y: py('0') };
    case 'topRight':
      return { x: px('W-text_w'), y: py('0') };
    case 'centerLeft':
      return { x: px('0'), y: py('(H-text_h)/2') };
    case 'center':
      return { x: px('(W-text_w)/2'), y: py('(H-text_h)/2') };
    case 'centerRight':
      return { x: px('W-text_w'), y: py('(H-text_h)/2') };
    case 'bottomLeft':
      return { x: px('0'), y: py('H-text_h') };
    case 'bottomCenter':
      return { x: px('(W-text_w)/2'), y: py('H-text_h') };
    case 'bottomRight':
    default:
      return { x: px('W-text_w'), y: py('H-text_h') };
  }
}

function buildAlphaExpr(
  startTime: number,
  endTime: number,
  fadeInSec: number,
  fadeOutSec: number,
): string {
  const start = startTime;
  const end = endTime;
  const fi = Math.max(0, fadeInSec);
  const fo = Math.max(0, fadeOutSec);
  const inEnd = start + fi;
  const outStart = end - fo;

  if (fi <= 0 && fo <= 0) {
    return '1';
  }
  if (fi > 0 && fo <= 0) {
    return `if(lt(t,${start}),0,if(lt(t,${inEnd}),(t-${start})/${fi},1))`;
  }
  if (fi <= 0 && fo > 0) {
    return `if(lt(t,${outStart}),1,if(lt(t,${end}),(${end}-t)/${fo},0))`;
  }
  return `if(lt(t,${start}),0,if(lt(t,${inEnd}),(t-${start})/${fi},if(lt(t,${outStart}),1,if(lt(t,${end}),(${end}-t)/${fo},0))))`;
}

function buildDrawtextFilterStr(opts: {
  text: string;
  fontSize: string | number;
  fontColor: string;
  x: string;
  y: string;
  outlineWidth: number;
  outlineColor: string;
  shadow: number;
  alphaExpr: string;
  startTime: number;
  endTime: number;
  fontPath?: string;
  box?: { color: string; borderW: number };
}): string {
  let filterStr =
    `drawtext=text=${escapeFilterValue(opts.text)}` +
    `:fontsize=${opts.fontSize}` +
    `:fontcolor=${opts.fontColor}` +
    `:x='${opts.x}'` +
    `:y='${opts.y}'` +
    `:shadowcolor=black@0.6` +
    `:shadowx=${Math.max(0, Math.floor(opts.shadow))}` +
    `:shadowy=${Math.max(0, Math.floor(opts.shadow))}`;

  if (opts.outlineWidth > 0) {
    filterStr += `:borderw=${opts.outlineWidth}:bordercolor=${opts.outlineColor}`;
  }

  if (opts.box) {
    filterStr += `:box=1:boxcolor=${opts.box.color}:boxborderw=${opts.box.borderW}`;
  }

  if (opts.fontPath && opts.fontPath.trim().length > 0) {
    filterStr += `:fontfile=${escapeFilterValue(toFilterPath(opts.fontPath))}`;
  }

  filterStr += `:alpha='${opts.alphaExpr}':enable='between(t,${opts.startTime},${opts.endTime})'`;
  return filterStr;
}

function isDynamicSubtitleEntry(entry: SubtitleEntry): entry is DynamicSubtitleEntry {
  return typeof (entry as DynamicSubtitleEntry).wordTimestamps !== 'undefined';
}

type WordSpan = { word: string; start: number; end: number; };

function clampSpan(span: WordSpan, minDur: number, maxDur: number): WordSpan {
  const dur = span.end - span.start;
  const clamped = Math.min(maxDur, Math.max(minDur, dur));
  if (!isFinite(clamped) || clamped <= 0) return span;
  return { ...span, end: span.start + clamped };
}

function buildWordSpansFromTimestamps(
  timestamps: ReadonlyArray<WordTimestamp>,
  baseStart: number,
  baseEnd: number,
): WordSpan[] {
  const spans: WordSpan[] = [];
  for (const wt of timestamps) {
    const s = Math.max(baseStart, wt.startTime);
    const e = Math.min(baseEnd, wt.endTime);
    if (!isFinite(s) || !isFinite(e) || e <= s) continue;
    if (typeof wt.word !== 'string' || wt.word.trim().length === 0) continue;
    spans.push({ word: wt.word, start: s, end: e });
  }
  spans.sort((a, b) => a.start - b.start);
  return spans;
}

function tokenizeWords(text: string): string[] {
  return text.split(/\s+/).map(w => w.trim()).filter(Boolean);
}

function buildWordSpansEven(
  words: ReadonlyArray<string>,
  baseStart: number,
  baseEnd: number,
): WordSpan[] {
  const total = baseEnd - baseStart;
  const n = words.length;
  if (n === 0 || !isFinite(total) || total <= 0) return [];
  const step = total / n;
  const spans: WordSpan[] = [];
  for (let i = 0; i < n; i++) {
    const start = baseStart + step * i;
    const end = i === n - 1 ? baseEnd : baseStart + step * (i + 1);
    spans.push({ word: words[i], start, end });
  }
  return spans;
}

function groupSpans(
  spans: ReadonlyArray<WordSpan>,
  strategy: DynamicSubtitlesConfig['groupingStrategy'],
  minGroupDuration: number,
  maxGroupDuration: number,
  groupSensitivity: number,
): WordSpan[][] {
  if (spans.length === 0) return [];
  if (strategy === 'none') return spans.map(s => [s]);

  const groups: WordSpan[][] = [];
  let current: WordSpan[] = [];
  const maxWordsSoft = Math.max(1, Math.round(6 - clampNumber(groupSensitivity, 0, 1) * 5));

  const flush = () => {
    if (current.length > 0) {
      groups.push(current);
      current = [];
    }
  };

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    if (current.length === 0) {
      current.push(span);
      continue;
    }

    const currentStart = current[0].start;
    const currentEnd = current[current.length - 1].end;
    const nextEnd = span.end;
    const nextDur = nextEnd - currentStart;
    const endsWithPunct = /[.!?,:;]$/.test(current[current.length - 1].word);
    const isImportant = span.word.length >= 6 || /^[A-Z0-9]{3,}$/.test(span.word);

    let shouldBreak = false;
    if (strategy === 'duration') {
      shouldBreak = nextDur > maxGroupDuration && (currentEnd - currentStart) >= minGroupDuration;
    } else if (strategy === 'semantic') {
      shouldBreak =
        (endsWithPunct && (currentEnd - currentStart) >= minGroupDuration) ||
        (current.length >= maxWordsSoft && (currentEnd - currentStart) >= minGroupDuration) ||
        (nextDur > maxGroupDuration && (currentEnd - currentStart) >= minGroupDuration);
    } else if (strategy === 'importance') {
      shouldBreak =
        (isImportant && (currentEnd - currentStart) >= minGroupDuration) ||
        (nextDur > maxGroupDuration && (currentEnd - currentStart) >= minGroupDuration);
    }

    if (shouldBreak) {
      flush();
    }
    current.push(span);
  }
  flush();

  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (g.length === 0) continue;
      const dur = g[g.length - 1].end - g[0].start;
      if (dur >= minGroupDuration) continue;
      if (i + 1 < groups.length) {
        groups[i] = [...g, ...groups[i + 1]];
        groups.splice(i + 1, 1);
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }

  const normalized: WordSpan[][] = [];
  for (const g of groups) {
    if (g.length === 0) continue;
    const start = g[0].start;
    const end = g[g.length - 1].end;
    if (end - start <= maxGroupDuration) {
      normalized.push(g);
      continue;
    }
    let chunk: WordSpan[] = [];
    for (const span of g) {
      if (chunk.length === 0) {
        chunk.push(span);
        continue;
      }
      const dur = span.end - chunk[0].start;
      if (dur > maxGroupDuration) {
        normalized.push(chunk);
        chunk = [span];
      } else {
        chunk.push(span);
      }
    }
    if (chunk.length > 0) normalized.push(chunk);
  }
  return normalized;
}

export function dynamicSubtitles(config: DynamicSubtitlesConfig): SubtitleEntry[] {
  const entry = config.subtitleEntry;
  const baseStart = entry.startTime;
  const baseEnd = entry.endTime;
  if (!config.wordSyncEnabled) {
    return [{ ...entry }];
  }

  const minWord = Math.max(0.01, config.minWordDuration);
  const maxWord = Math.max(minWord, config.maxWordDuration);
  const minGroup = Math.max(minWord, config.minGroupDuration);
  const maxGroup = Math.max(minGroup, config.maxGroupDuration);

  let spans: WordSpan[] = [];
  if (isDynamicSubtitleEntry(entry) && Array.isArray(entry.wordTimestamps) && entry.wordTimestamps.length > 0) {
    spans = buildWordSpansFromTimestamps(entry.wordTimestamps, baseStart, baseEnd);
  }
  if (spans.length === 0) {
    const words = tokenizeWords(entry.text);
    spans = buildWordSpansEven(words, baseStart, baseEnd);
  }

  spans = spans.map(s => clampSpan(s, minWord, maxWord));
  spans.sort((a, b) => a.start - b.start);

  for (let i = 1; i < spans.length; i++) {
    const prev = spans[i - 1];
    const cur = spans[i];
    if (cur.start < prev.end) {
      spans[i] = { ...cur, start: prev.end, end: Math.max(prev.end + minWord, cur.end) };
    }
  }
  if (spans.length > 0) {
    spans[0] = { ...spans[0], start: Math.max(baseStart, spans[0].start) };
    spans[spans.length - 1] = { ...spans[spans.length - 1], end: Math.min(baseEnd, spans[spans.length - 1].end) };
  }

  const groups = groupSpans(
    spans,
    config.groupingStrategy,
    minGroup,
    maxGroup,
    config.groupSensitivity,
  );

  const out: SubtitleEntry[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (g.length === 0) continue;
    const startTime = g[0].start;
    const endTime = g[g.length - 1].end;
    if (!isFinite(startTime) || !isFinite(endTime) || endTime <= startTime) continue;
    const text = g.map(w => w.word).join(' ');
    out.push({
      id: `${entry.id}_dyn_${i}_${generateId()}`,
      startTime,
      endTime,
      text,
    });
  }

  if (out.length === 0) {
    return [{ ...entry }];
  }
  return out;
}

export function popupCaption(
  graph: FilterGraph,
  input: string,
  config: PopupCaptionConfig,
  style: SubtitleStyle,
  fontPath?: string,
  outputId?: string,
): string {
  const start = config.subtitleEntry.startTime;
  const maxEnd = config.subtitleEntry.endTime;
  const entryAnim = Math.max(0, config.animationDuration);
  const hold = Math.max(0, config.holdDuration);
  const exitAnim = Math.max(0, config.animationDuration);
  const end = Math.min(maxEnd, start + entryAnim + hold + exitAnim);

  const fadeInSec = config.animationType === 'fadeIn' ? entryAnim : Math.min(0.25, entryAnim);
  const fadeOutSec = config.exitAnimation === 'fadeOut' ? exitAnim : Math.min(0.25, exitAnim);
  const alphaExpr = buildAlphaExpr(start, end, fadeInSec, fadeOutSec);

  const baseSize = Math.max(8, Math.floor(style.fontSize));
  let sizeExpr: string | number = baseSize;
  let yExpr: string;

  const { x, y } = popupAnchorXYExpr(
    config.position,
    config.offsetX ?? 0,
    config.offsetY ?? 0,
  );
  const xExpr = x;
  yExpr = y;

  if (config.animationType === 'scaleIn' || config.exitAnimation === 'scaleOut') {
    const inScale = 0.85;
    const outScale = 0.85;
    const inExpr = entryAnim > 0 ? `(${inScale}+(${1 - inScale})*min(1,(t-${start})/${entryAnim}))` : '1';
    const outExpr = exitAnim > 0 ? `(${outScale}+(${1 - outScale})*min(1,(${end}-t)/${exitAnim}))` : '1';
    const combined = `if(lt(t,${start + entryAnim}),${inExpr},if(lt(t,${end - exitAnim}),1,${outExpr}))`;
    sizeExpr = `${baseSize}*(${combined})`;
  }

  if (config.animationType === 'slideUp' || config.exitAnimation === 'slideDown') {
    const delta = 24;
    const inExpr = entryAnim > 0 ? `${delta}*(1-min(1,(t-${start})/${entryAnim}))` : '0';
    const outExpr = exitAnim > 0 ? `${delta}*(1-min(1,(${end}-t)/${exitAnim}))` : '0';
    const offsetExpr = `if(lt(t,${start + entryAnim}),${inExpr},if(lt(t,${end - exitAnim}),0,${outExpr}))`;
    yExpr = `(${yExpr})+(${offsetExpr})`;
  }

  if (config.animationType === 'bounce') {
    const amp = 18;
    const freq = entryAnim > 0 ? `2*PI*(t-${start})/${Math.max(0.05, entryAnim)}` : '0';
    const bounceExpr = `if(lt(t,${start + entryAnim}),${amp}*sin(${freq})*exp(-3*(t-${start})/${Math.max(0.05, entryAnim)}),0)`;
    yExpr = `(${yExpr})-(${bounceExpr})`;
  }

  const outLabel = outputId ? `[${outputId}]` : graph.createLabel('pop');
  const bgColor = config.backgroundColor && config.backgroundColor.trim().length > 0
    ? config.backgroundColor
    : 'black@0.55';
  const filterStr = buildDrawtextFilterStr({
    text: config.subtitleEntry.text,
    fontSize: sizeExpr,
    fontColor: style.primaryColor,
    x: xExpr,
    y: yExpr,
    outlineWidth: Math.max(0, Math.floor(style.outlineWidth)),
    outlineColor: style.outlineColor,
    shadow: Math.max(0, Math.floor(style.shadow)),
    alphaExpr,
    startTime: start,
    endTime: end,
    fontPath,
    box: { color: bgColor, borderW: 12 },
  });

  graph.addFilter([input], filterStr, [outLabel]);
  return outLabel;
}

function emojiBaseXYExpr(style: SubtitleStyle): { x: string; y: string } {
  const x = '(W-w)/2';
  const marginV = Math.max(0, Math.floor(style.marginV));
  const lift = Math.max(0, Math.floor(style.fontSize * 2.2));
  switch (style.position) {
    case 'top':
      return { x, y: `${marginV + lift}` };
    case 'center':
      return { x, y: `(H-h)/2+${lift}` };
    case 'bottom':
    default:
      return { x, y: `H-h-${marginV + lift}` };
  }
}

export function emojiAnimation(
  graph: FilterGraph,
  baseVideo: string,
  emojiInput: string,
  config: EmojiAnimationConfig,
  style: SubtitleStyle,
  outputId?: string,
): string {
  const start = config.subtitleEntry.startTime;
  const end = config.subtitleEntry.endTime;
  const dur = Math.max(0.05, config.animationDuration);
  const loopDelay = Math.max(0, config.loopDelay);
  const loops = Math.max(1, Math.floor(config.loopCount));
  const scale = Math.max(0.01, config.scale);
  const opacity = clampNumber(config.opacity, 0, 1);

  let emojiLabel = emojiInput;
  const rgbaLabel = graph.createLabel('emo_rgba');
  graph.addFilter([emojiLabel], 'format=rgba', [rgbaLabel]);
  emojiLabel = rgbaLabel;

  if (opacity < 1) {
    const alphaLabel = graph.createLabel('emo_alpha');
    graph.addFilter([emojiLabel], `colorchannelmixer=aa=${opacity}`, [alphaLabel]);
    emojiLabel = alphaLabel;
  }

  if (config.animationType === 'pulse') {
    const amp = 0.08;
    const scaleExpr = `${scale}*(1+${amp}*sin(2*PI*(t-${start})/${dur}))`;
    const pulseLabel = graph.createLabel('emo_pulse');
    graph.addFilter([emojiLabel], `scale=w='iw*(${scaleExpr})':h='ih*(${scaleExpr})':eval=frame`, [pulseLabel]);
    emojiLabel = pulseLabel;
  } else if (scale !== 1) {
    const scaledLabel = graph.createLabel('emo_s');
    graph.addFilter([emojiLabel], `scale=w='iw*${scale}':h='ih*${scale}':eval=frame`, [scaledLabel]);
    emojiLabel = scaledLabel;
  }

  if (config.animationType === 'spin') {
    const rotLabel = graph.createLabel('emo_rot');
    const angleExpr = `2*PI*(t-${start})/${dur}`;
    graph.addFilter([emojiLabel], `rotate='${angleExpr}':c=none:ow=rotw(iw):oh=roth(ih)`, [rotLabel]);
    emojiLabel = rotLabel;
  }

  const { x: baseX, y: baseY } = emojiBaseXYExpr(style);
  const amplitude = 22;
  const sinExpr = `sin(2*PI*(t-${start})/${dur})`;
  const xExpr = baseX;
  let yExpr = baseY;

  if (config.animationType === 'float') {
    yExpr = `(${baseY})+${amplitude}*${sinExpr}`;
  } else if (config.animationType === 'bounce') {
    const absSin = `abs(${sinExpr})`;
    yExpr = `(${baseY})-${amplitude}*${absSin}`;
  }

  let currentVideo = baseVideo;
  for (let i = 0; i < loops; i++) {
    const loopStart = start + i * (dur + loopDelay);
    const loopEnd = Math.min(loopStart + dur, end);
    if (loopEnd <= loopStart) break;
    const out = (outputId && i === loops - 1) ? `[${outputId}]` : graph.createLabel('emo_ov');
    const filterStr =
      `overlay=x='${xExpr}':y='${yExpr}':enable='between(t,${loopStart},${loopEnd})':format=auto`;
    graph.addFilter([currentVideo, emojiLabel], filterStr, [out]);
    currentVideo = out;
  }

  return currentVideo;
}
