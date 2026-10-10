export async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown; count?: number | null }>, pageSize = 1000): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<unknown>();
  for (let from = 0; ;) {
    const { data, error, count } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    for (const row of batch) {
      const id = (row as { id?: unknown }).id;
      if (id == null || !seen.has(id)) rows.push(row);
      if (id != null) seen.add(id);
    }
    from += batch.length;
    if (batch.length === 0 || (typeof count === 'number'
      ? from >= count
      : batch.length < pageSize)) return rows;
  }
}
