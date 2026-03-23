export function generateSeedOrder(size: number): number[] {
  if (size === 1) return [1];
  const half = size / 2;
  const prev = generateSeedOrder(half);
  const result: number[] = [];
  for (let p of prev) {
    result.push(p);
    result.push(size + 1 - p);
  }
  return result;
}