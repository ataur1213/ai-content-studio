
// =============================================================================
// Video Studio UI — History Utilities
// =============================================================================

import type { HistoryItem } from "../types";

const STORAGE_KEY = "video-studio-history";

// -----------------------------------------------------------------------------
// History Item Serialization
// -----------------------------------------------------------------------------

function serializeHistoryItem(item: HistoryItem): Record<string, unknown> {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
  };
}

function deserializeHistoryItem(data: unknown): HistoryItem | null {
  if (typeof data !== "object" || data === null) return null;

  const { id, jobId, title, thumbnailUrl, status, createdAt, durationSeconds, aspectRatio } = data as Record<string, unknown>;

  if (
    typeof id !== "string" ||
    typeof jobId !== "string" ||
    typeof title !== "string" ||
    typeof status !== "string" ||
    typeof createdAt !== "string" ||
    typeof aspectRatio !== "string"
  ) {
    return null;
  }

  try {
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) return null;

    return {
      id,
      jobId,
      title,
      thumbnailUrl: typeof thumbnailUrl === "string" ? thumbnailUrl : undefined,
      status: status as HistoryItem["status"],
      createdAt: date,
      durationSeconds: typeof durationSeconds === "number" ? durationSeconds : undefined,
      aspectRatio: aspectRatio as HistoryItem["aspectRatio"],
    };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// History Utilities
// -----------------------------------------------------------------------------

export function saveVideoHistory(items: readonly HistoryItem[]): void {
  try {
    const serialized = items.map(serializeHistoryItem);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // Ignore storage errors
  }
}

export function loadVideoHistory(): HistoryItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(deserializeHistoryItem)
      .filter((item): item is HistoryItem => item !== null);
  } catch {
    return [];
  }
}

export function removeVideoHistory(itemId: string): void {
  const history = loadVideoHistory();
  const filtered = history.filter((item) => item.id !== itemId);
  saveVideoHistory(filtered);
}

export function clearVideoHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
