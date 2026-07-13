export interface ImageHistoryItem {
  id: string;
  prompt: string;
  image: string;
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

  getAll() {
    return this.items;
  }

  clear() {
    this.items = [];
  }
}

export const imageHistory = new ImageHistoryStore();