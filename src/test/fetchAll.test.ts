import { describe, expect, it } from 'vitest';
import { fetchAllRows } from '@/lib/fetchAll';

describe('fetchAllRows', () => {
  it('returns a single short page without a count', async () => {
    const calls: number[] = [];
    const result = await fetchAllRows(async from => {
      calls.push(from);
      return { data: [{ id: 'one' }], error: null };
    }, 3);
    expect(result).toEqual([{ id: 'one' }]);
    expect(calls).toEqual([0]);
  });

  it('stops at the count for an exact multiple of the page size', async () => {
    const rows = Array.from({ length: 6 }, (_, id) => ({ id }));
    const calls: number[] = [];
    const result = await fetchAllRows(async (from, to) => {
      calls.push(from);
      return { data: rows.slice(from, to + 1), error: null, count: rows.length };
    }, 3);
    expect(result).toEqual(rows);
    expect(calls).toEqual([0, 3]);
  });

  it('fetches all rows when the server cap is below the requested page size', async () => {
    const rows = Array.from({ length: 1000 }, (_, id) => ({ id }));
    const calls: number[] = [];
    const result = await fetchAllRows(async (from, to) => {
      calls.push(from);
      return { data: rows.slice(from, Math.min(to + 1, from + 400)), error: null, count: rows.length };
    });
    expect(result).toEqual(rows);
    expect(calls).toEqual([0, 400, 800]);
  });

  it('rejects on a later page error instead of returning partial results', async () => {
    const error = new Error('Page failed');
    await expect(fetchAllRows(async from => from === 0
      ? { data: [{ id: 1 }, { id: 2 }], error: null }
      : { data: null, error }, 2)).rejects.toBe(error);
  });

  it('deduplicates ids without counting unique rows as the page offset', async () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 2 }, { id: 3 }];
    const calls: number[] = [];
    const result = await fetchAllRows(async (from, to) => {
      calls.push(from);
      return { data: rows.slice(from, to + 1), error: null, count: rows.length };
    }, 2);
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(calls).toEqual([0, 2]);
  });
});
