export interface RandomSource {
  next(): number;
}

export class MathRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}

export class SeededRandomSource implements RandomSource {
  private seed: number;

  constructor(seed: string) {
    this.seed = hashSeed(seed);
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 0xffffffff;
  }
}

export function createRandomSource(seed?: string): RandomSource {
  return seed ? new SeededRandomSource(seed) : new MathRandomSource();
}

export function pickWeighted<T extends { weight: number }>(
  items: T[],
  random: RandomSource,
): { item: T; roll: number } {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);

  if (total <= 0) {
    throw new Error("Weighted random requires at least one positive weight");
  }

  const roll = random.next() * total;
  let cursor = 0;

  for (const item of items) {
    cursor += Math.max(0, item.weight);
    if (roll <= cursor) {
      return { item, roll };
    }
  }

  return { item: items[items.length - 1], roll };
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
