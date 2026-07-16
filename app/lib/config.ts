// src/lib/config.ts

import path from 'path';
import fs from 'fs';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

type NodeEnv = 'development' | 'production' | 'test';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  openRouterApiKey: string;
  geminiApiKey: string;
  replicateApiToken: string;
  falKey: string;
  runwayApiKey: string;
  tempDir: string;
  outputDir: string;
  ffmpegPath: string;
  ffprobePath: string;
}

function validateNodeEnv(env: string | undefined): NodeEnv {
  if (!env || (env !== 'development' && env !== 'production' && env !== 'test')) {
    throw new Error('NODE_ENV must be one of: development, production, test');
  }
  return env;
}

function validatePort(portStr: string | undefined): number {
  const port = parseInt(portStr ?? '3000', 10);
  if (isNaN(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be a valid number between 0 and 65535');
  }
  return port;
}

function getRequiredEnvVar(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function ensureDirectoryExists(dirPath: string): string {
  const absolutePath = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath);
  try {
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
    }
    return absolutePath;
  } catch (error) {
    throw new Error(`Failed to create directory ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function loadConfig(): AppConfig {
  const nodeEnv = validateNodeEnv(process.env.NODE_ENV);
  const port = validatePort(process.env.PORT);

  const openRouterApiKey = getRequiredEnvVar('OPENROUTER_API_KEY');
  const geminiApiKey = getRequiredEnvVar('GEMINI_API_KEY');
  const replicateApiToken = getRequiredEnvVar('REPLICATE_API_TOKEN');
  const falKey = getRequiredEnvVar('FAL_KEY');
  const runwayApiKey = getRequiredEnvVar('RUNWAY_API_KEY');

  const tempDir = ensureDirectoryExists(process.env.TEMP_DIR ?? path.join(process.cwd(), 'tmp'));
  const outputDir = ensureDirectoryExists(process.env.OUTPUT_DIR ?? path.join(process.cwd(), 'outputs'));

  if (!ffmpegStatic) {
    throw new Error('Failed to load ffmpeg-static binary path');
  }
  const ffmpegPath = ffmpegStatic as string;

  const ffprobeStaticModule = ffprobeStatic as unknown as { path: string };
  if (!ffprobeStaticModule.path) {
    throw new Error('Failed to load ffprobe-static binary path');
  }
  const ffprobePath = ffprobeStaticModule.path;

  if (!fs.existsSync(ffmpegPath)) {
    throw new Error(`FFmpeg binary not found at path: ${ffmpegPath}`);
  }
  if (!fs.existsSync(ffprobePath)) {
    throw new Error(`FFprobe binary not found at path: ${ffprobePath}`);
  }

  return {
    nodeEnv,
    port,
    openRouterApiKey,
    geminiApiKey,
    replicateApiToken,
    falKey,
    runwayApiKey,
    tempDir,
    outputDir,
    ffmpegPath,
    ffprobePath,
  };
}

export const config = loadConfig();