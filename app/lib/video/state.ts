import type { VideoJob, WorkerInfo } from './types';

const JOB_STORE_KEY = Symbol.for('ai-content-studio.jobStore');
const WORKER_STORE_KEY = Symbol.for('ai-content-studio.workerStore');

function getOrCreateStore<K, V>(key: symbol): Map<K, V> {
  const globalAny = globalThis as unknown as Record<symbol, unknown>;
  if (!(key in globalAny)) {
    globalAny[key] = new Map<K, V>();
  }
  return globalAny[key] as Map<K, V>;
}

export const jobStore = getOrCreateStore<string, VideoJob>(JOB_STORE_KEY);
export const workerStore = getOrCreateStore<string, WorkerInfo>(WORKER_STORE_KEY);
