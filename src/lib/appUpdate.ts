export type BuildVersion = { commit: string; builtAt: string };
export function isBuildVersion(value: unknown): value is BuildVersion {
  return !!value && typeof value === 'object' && 'commit' in value && 'builtAt' in value
    && typeof value.commit === 'string' && !!value.commit && typeof value.builtAt === 'string' && !!value.builtAt;
}
export function updateDecision(current: BuildVersion, incoming: unknown, busy: boolean): 'ignore' | 'reload' | 'wait' {
  if (!isBuildVersion(incoming)) return 'ignore';
  if (incoming.commit === current.commit && incoming.builtAt === current.builtAt) return 'ignore';
  return busy ? 'wait' : 'reload';
}
