/**
 * Min-heap that keeps at most `capacity` items with the highest scores.
 * Lowest score is at root; when size exceeds capacity, the minimum is evicted.
 * O(1) for peek, O(log k) for push/pop where k = min(size, capacity).
 */

export class MinHeap<T> {
  private heap: T[] = [];

  constructor(
    private readonly capacity: number,
    private readonly getScore: (item: T) => number,
  ) {}

  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
    while (this.heap.length > this.capacity) {
      this.pop();
    }
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();
    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return min;
  }

  peek(): T | undefined {
    return this.heap[0];
  }

  size(): number {
    return this.heap.length;
  }

  /** Extract all items and return sorted by score descending (highest first). */
  toSortedArray(): T[] {
    const out: T[] = [];
    while (this.heap.length > 0) {
      out.push(this.pop()!);
    }
    return out.sort((a, b) => this.getScore(b) - this.getScore(a));
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.getScore(this.heap[i]!) >= this.getScore(this.heap[parent]!)) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent]!, this.heap[i]!];
      i = parent;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.getScore(this.heap[left]!) < this.getScore(this.heap[smallest]!)) {
        smallest = left;
      }
      if (right < n && this.getScore(this.heap[right]!) < this.getScore(this.heap[smallest]!)) {
        smallest = right;
      }
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest]!, this.heap[i]!];
      i = smallest;
    }
  }
}
