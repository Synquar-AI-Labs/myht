export function createInvalidationBatcher(invalidate: (key: string[]) => void) {
  const pending = new Map<string, string[]>();
  let quietTimer: ReturnType<typeof setTimeout> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    clearTimeout(quietTimer);
    clearTimeout(maxTimer);
    quietTimer = undefined;
    maxTimer = undefined;
    pending.clear();
  };
  const flush = () => {
    const keys = [...pending.values()];
    cancel();
    keys.forEach(key => invalidate(key));
  };
  return {
    queue(key: string[]) {
      pending.set(JSON.stringify(key), key);
      clearTimeout(quietTimer);
      quietTimer = setTimeout(flush, 400);
      if (maxTimer === undefined) maxTimer = setTimeout(flush, 2000);
    },
    cancel,
  };
}
