export function phoneBuild(info: { build: string } | null): number | null {
  if (!info || !/^\d+$/.test(info.build)) return null;
  const build = Number(info.build);
  return Number.isSafeInteger(build) ? build : null;
}

export function nativeUpdateDecision(build: number | null, minimum: unknown, busy: boolean) {
  if (build === null || typeof minimum !== 'number' || !Number.isSafeInteger(minimum) || minimum < 0 || build >= minimum) return 'allow';
  return busy ? 'wait' : 'block';
}
