import { describe, expect, it } from 'vitest';
import { getMonthOptions, countRecordedDays, formatAppointmentTime } from '@/lib/reportHelpers';

describe('report helpers', () => {
  it('offers the current month first and no future months', () => {
    const options = getMonthOptions(new Date(2026, 0, 31));
    expect(options[0].value).toBe('2026-01');
    expect(options).toHaveLength(13);
    expect(options.every(option => option.value <= '2026-01')).toBe(true);
    expect(options[12].value).toBe('2025-01');
  });

  it('counts only days with records, including saved zero-valued days', () => {
    expect(countRecordedDays([{ hasRecord: true }, { hasRecord: false }, { hasRecord: true }])).toBe(2);
    expect(countRecordedDays([{ hasRecord: false }])).toBe(0);
    expect(countRecordedDays([])).toBe(0);
  });

  it.each([
    ['15:30', '3:30 PM'], ['00:00', '12:00 AM'], ['12:00', '12:00 PM'],
    ['09:05:00', '9:05 AM'], ['23:59', '11:59 PM'], ['', ''], ['25:00', '25:00'],
  ])('formats %s as %s without timezone conversion', (input, expected) => {
    expect(formatAppointmentTime(input)).toBe(expected);
  });
});
