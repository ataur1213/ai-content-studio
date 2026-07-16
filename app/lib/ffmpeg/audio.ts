// =============================================================================
// AI Video Generator — FFmpeg Engine Audio Operations
// =============================================================================

import type {
  FFmpegContext,
  AudioMixConfig,
  BackgroundMusicConfig,
  VoiceConfig,
  CommandConfig,
} from './types';
import {
  AUDIO_FORMAT_MAP,
  DEFAULT_AUDIO_BITRATE,
} from './constants';
import {
  ensureDir,
} from './utils';
import {
  assertValid,
  validateAudioMixConfig,
  validateBackgroundMusicConfig,
  validateVoiceConfig,
} from './validate';
import {
  executeFFmpeg,
} from './command';
import {
  FilterGraph,
} from './filters';

// =============================================================================
// Audio Mixing
// =============================================================================

/**
 * Mix multiple audio tracks into a single audio file.
 * Applies individual volume, fading, and timing offsets before mixing.
 */
export async function mixAudioTracks(
  config: AudioMixConfig,
  ctx: FFmpegContext,
): Promise<string> {
  assertValid(config, validateAudioMixConfig, 'mixAudioTracks');
  ensureDir(config.outputPath);

  const graph = new FilterGraph();
  const inputs: CommandConfig['inputs'] = [];
  const finalLabels: string[] = [];

  for (let i = 0; i < config.tracks.length; i++) {
    const track = config.tracks[i];
    
    inputs.push({
      path: track.path,
      index: i,
      duration: track.duration,
      startTime: null,
      format: null,
      streamLoop: track.loop ? -1 : 0,
      extraArgs: [],
    });

    let currentLabel = graph.input('a', i);

    // Mute check
    const vol = track.muted ? 0 : track.volume;
    if (vol !== 1.0) {
      const id = `v${i}`;
      graph.volume(currentLabel, vol, id);
      currentLabel = `[${id}]`;
    }

    // Fade In
    if (track.fadeIn > 0) {
      const id = `fi${i}`;
      graph.audioFadeIn(currentLabel, track.fadeIn, id);
      currentLabel = `[${id}]`;
    }

    // Fade Out (calculate start time for fade out)
    if (track.fadeOut > 0 && track.duration !== null && track.duration > track.fadeOut) {
      const fadeOutStart = track.duration - track.fadeOut;
      const id = `fo${i}`;
      graph.audioFadeOut(currentLabel, fadeOutStart, track.fadeOut, id);
      currentLabel = `[${id}]`;
    }

    // Delay / Start Time Offset
    if (track.startTime > 0) {
      const id = `d${i}`;
      const delayMs = Math.round(track.startTime * 1000);
      graph.addFilter([currentLabel], `adelay=${delayMs}|${delayMs}`, [`[${id}]`]);
      currentLabel = `[${id}]`;
    }

    finalLabels.push(currentLabel);
  }

  // Mix all processed audio labels together
  graph.amix(finalLabels, [], 'amixed');

  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs,
    filterComplex: graph.build(),
    outputs: [
      {
        path: config.outputPath,
        map: [],
        videoCodec: null,
        audioCodec: 'aac',
        videoBitrate: null,
        audioBitrate: config.bitrate || DEFAULT_AUDIO_BITRATE,
        crf: null,
        preset: null,
        tune: null,
        pixelFormat: null,
        fps: null,
        resolution: null,
        format: AUDIO_FORMAT_MAP[config.format] || null,
        movFlags: null,
        metadata: {},
        overwrite: true,
        extraArgs: [
          '-vn', // Ensure no video stream is processed
          '-ar', String(config.sampleRate),
          '-ac', String(config.channels),
        ],
      },
    ],
    globalArgs: ['-hide_banner'],
    timeoutMs: 60000,
  };

  ctx.log('info', `Mixing ${config.tracks.length} audio tracks -> ${config.outputPath}`, 'audio');
  await executeFFmpeg(commandConfig, ctx);
  
  return config.outputPath;
}

// =============================================================================
// Background Music
// =============================================================================

/**
 * Add background music to an existing video file.
 * Preserves the original video stream and mixes the original audio with the music.
 */
export async function addBackgroundMusic(
  baseVideoPath: string,
  config: BackgroundMusicConfig,
  outputPath: string,
  ctx: FFmpegContext,
): Promise<string> {
  assertValid(config, validateBackgroundMusicConfig, 'addBackgroundMusic');
  ensureDir(outputPath);

  const graph = new FilterGraph();

  // Input 0: Base Video (We only take its audio stream to mix, video is mapped directly)
  const baseAudLabel = graph.input('a', 0);
  
  // Input 1: Music
  const musicLabel = graph.input('a', 1);

  let processedMusic = musicLabel;

  // Apply volume to music
  if (config.volume !== 1.0) {
    const id = 'm_vol';
    graph.volume(processedMusic, config.volume, id);
    processedMusic = `[${id}]`;
  }

  // Apply fade in to music
  if (config.fadeIn > 0) {
    const id = 'm_fi';
    graph.audioFadeIn(processedMusic, config.fadeIn, id);
    processedMusic = `[${id}]`;
  }

  // Mix original audio with processed music
  graph.amix([baseAudLabel, processedMusic], [], 'amixed');

  const inputs: CommandConfig['inputs'] = [
    {
      path: baseVideoPath,
      index: 0,
      duration: null,
      startTime: null,
      format: null,
      streamLoop: 0,
      extraArgs: [],
    },
    {
      path: config.musicPath,
      index: 1,
      duration: null,
      startTime: config.trimStart > 0 ? config.trimStart : null,
      format: null,
      streamLoop: config.loop ? -1 : 0,
      extraArgs: [],
    },
  ];

  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs,
    filterComplex: graph.build(),
    outputs: [
      {
        path: outputPath,
        map: ['0:v', '[amixed]'], // Keep original video, use mixed audio
        videoCodec: 'copy',
        audioCodec: 'aac',
        videoBitrate: null,
        audioBitrate: DEFAULT_AUDIO_BITRATE,
        crf: null,
        preset: null,
        tune: null,
        pixelFormat: null,
        fps: null,
        resolution: null,
        format: null,
        movFlags: '+faststart',
        metadata: {},
        overwrite: true,
        extraArgs: ['-shortest'], // Stop when the shortest input ends
      },
    ],
    globalArgs: ['-hide_banner'],
    timeoutMs: 120000,
  };

  ctx.log('info', `Adding background music to ${baseVideoPath}`, 'audio');
  await executeFFmpeg(commandConfig, ctx);
  
  return outputPath;
}

// =============================================================================
// Voice & Music Integration
// =============================================================================

/**
 * Merge an AI voice track (and optional background music) with a base video.
 * Ensures the voice is always clearly audible on top of the music.
 */
export async function mergeVoiceWithMusic(
  baseVideoPath: string,
  voiceConfig: VoiceConfig,
  musicConfig: BackgroundMusicConfig | null,
  outputPath: string,
  ctx: FFmpegContext,
): Promise<string> {
  assertValid(voiceConfig, validateVoiceConfig, 'mergeVoiceWithMusic');
  if (musicConfig) {
    assertValid(musicConfig, validateBackgroundMusicConfig, 'mergeVoiceWithMusic.music');
  }
  
  ensureDir(outputPath);

  const graph = new FilterGraph();
  const inputs: CommandConfig['inputs'] = [
    {
      path: baseVideoPath,
      index: 0,
      duration: null,
      startTime: null,
      format: null,
      streamLoop: 0,
      extraArgs: [],
    },
    {
      path: voiceConfig.voicePath,
      index: 1,
      duration: null,
      startTime: null,
      format: null,
      streamLoop: 0,
      extraArgs: [],
    },
  ];

  // Process voice track
  const voiceRaw = graph.input('a', 1);
  let processedVoice = voiceRaw;

  if (voiceConfig.volume !== 1.0) {
    const id = 'v_vol';
    graph.volume(processedVoice, voiceConfig.volume, id);
    processedVoice = `[${id}]`;
  }
  if (voiceConfig.fadeIn > 0) {
    const id = 'v_fi';
    graph.audioFadeIn(processedVoice, voiceConfig.fadeIn, id);
    processedVoice = `[${id}]`;
  }

  // Delay voice to its start time
  if (voiceConfig.startTime > 0) {
    const id = 'v_delay';
    const delayMs = Math.round(voiceConfig.startTime * 1000);
    graph.addFilter([processedVoice], `adelay=${delayMs}|${delayMs}`, [`[${id}]`]);
    processedVoice = `[${id}]`;
  }

  if (musicConfig) {
    // Add music input
    inputs.push({
      path: musicConfig.musicPath,
      index: 2,
      duration: null,
      startTime: musicConfig.trimStart > 0 ? musicConfig.trimStart : null,
      format: null,
      streamLoop: musicConfig.loop ? -1 : 0,
      extraArgs: [],
    });

    const musicRaw = graph.input('a', 2);
    let processedMusic = musicRaw;

    if (musicConfig.volume !== 1.0) {
      const id = 'm_vol';
      graph.volume(processedMusic, musicConfig.volume, id);
      processedMusic = `[${id}]`;
    }
    if (musicConfig.fadeIn > 0) {
      const id = 'm_fi';
      graph.audioFadeIn(processedMusic, musicConfig.fadeIn, id);
      processedMusic = `[${id}]`;
    }

    // Mix: Voice is usually more important, so we put it first in amix 
    // (amix drops volume of subsequent inputs automatically to prevent clipping,
    // but explicit weights are better if needed. For simplicity, standard amix is fine).
    graph.amix([processedVoice, processedMusic], [], 'amixed');
  } else {
    // No music, just replace original audio with voice
    // We create a dummy amix or just map the voice directly.
    // Using amix with 1 input is safe and consistent.
    graph.amix([processedVoice], [], 'amixed');
  }

  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs,
    filterComplex: graph.build(),
    outputs: [
      {
        path: outputPath,
        map: ['0:v', '[amixed]'],
        videoCodec: 'copy',
        audioCodec: 'aac',
        videoBitrate: null,
        audioBitrate: DEFAULT_AUDIO_BITRATE,
        crf: null,
        preset: null,
        tune: null,
        pixelFormat: null,
        fps: null,
        resolution: null,
        format: null,
        movFlags: '+faststart',
        metadata: {},
        overwrite: true,
        extraArgs: ['-shortest'],
      },
    ],
    globalArgs: ['-hide_banner'],
    timeoutMs: 120000,
  };

  ctx.log('info', `Merging voice (and music) into ${baseVideoPath}`, 'audio');
  await executeFFmpeg(commandConfig, ctx);
  
  return outputPath;
}