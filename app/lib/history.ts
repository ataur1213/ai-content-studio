export interface ImageHistoryItem {
  id: string;
  prompt: string;
  image: string;
  createdAt: string;
}

export interface VoiceHistoryItem {
  id: string;
  text: string;
  audioUrl: string;
  provider: string;
  createdAt: string;
}

export interface VideoHistoryItem {
  id: string;
  jobId: string;
  prompt?: string;
  status: string;
  outputUrl?: string;
  createdAt: string;
}

class ImageHistoryStore {
  private items: ImageHistoryItem[] = [];

  add(item: ImageHistoryItem) {
    this.items.unshift(item);
    if (this.items.length > 20) {
      this.items.pop();
    }
  }

  getAll(): ImageHistoryItem[] {
    return this.items;
  }

  clear() {
    this.items = [];
  }
}

class VoiceHistoryStore {
  private items: VoiceHistoryItem[] = [];

  add(item: VoiceHistoryItem) {
    this.items.unshift(item);
    if (this.items.length > 20) {
      this.items.pop();
    }
  }

  getAll(): VoiceHistoryItem[] {
    return this.items;
  }

  clear() {
    this.items = [];
  }
}

class VideoHistoryStore {
  private items: VideoHistoryItem[] = [];

  add(item: VideoHistoryItem) {
    this.items.unshift(item);
    if (this.items.length > 20) {
      this.items.pop();
    }
  }

  getAll(): VideoHistoryItem[] {
    return this.items;
  }

  update(jobId: string, updates: Partial<VideoHistoryItem>) {
    const index = this.items.findIndex(item => item.jobId === jobId);
    if (index !== -1) {
      this.items[index] = { ...this.items[index], ...updates };
    }
  }

  clear() {
    this.items = [];
  }
}

export const imageHistory = new ImageHistoryStore();
export const voiceHistory = new VoiceHistoryStore();
export const videoHistory = new VideoHistoryStore();
