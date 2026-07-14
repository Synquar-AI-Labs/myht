import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { HealthRecord } from '@/types/health';

// MedicineTracker pulls in supabase/react-query; the busy boundary under
// test lives entirely in DailyRecordTab.
vi.mock('@/components/MedicineTracker', () => ({ MedicineTracker: () => null }));

import { DailyRecordTab } from '@/components/DailyRecordTab';

const record = {
  id: 'r1',
  date: '2026-07-12',
  feed_bags: 3,
  flush_count: 1,
  flush_ml: 0,
  bile_bags: 0,
  urine_count: 0,
  weight: 61.5,
  bp_systolic: 118,
  bp_diastolic: 76,
  food_taken: false,
  food_description: '',
  stool_passed: false,
  stool_count: 0,
  vomiting: false,
  vomit_count: 0,
  constipation: false,
  recorded_by: 'Fahad',
  misc_notes: '',
  created_at: '2026-07-12T10:00:00Z',
  updated_at: '2026-07-12T10:00:00Z',
} as unknown as HealthRecord;

function renderEditor(overrides: Partial<Parameters<typeof DailyRecordTab>[0]> = {}) {
  const props = {
    records: [record],
    addRecord: vi.fn(async () => true),
    deleteRecord: vi.fn(async () => true),
    getLatestRecord: () => record,
    getRecordByDate: (d: string) => (d === record.date ? record : null),
    initialDate: record.date,
    dayOnly: true,
    ...overrides,
  };
  render(<DailyRecordTab {...props} />);
  return props;
}

describe('DailyRecordTab save-busy boundary', () => {
  it('locks competing controls AND form fields during an in-flight save; failure keeps values', async () => {
    let resolveSave!: (ok: boolean) => void;
    const addRecord = vi.fn(() => new Promise<boolean>(res => { resolveSave = res; }));
    const deleteRecord = vi.fn(async () => true);
    const onBusyChange = vi.fn();

    // dayOnly OFF so Past Entries renders real Delete buttons to race with.
    renderEditor({ addRecord, deleteRecord, onBusyChange, dayOnly: false });

    // Load the existing record into the form (fills recordedBy = Fahad).
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    fireEvent.click(screen.getByRole('button', { name: /update record/i }));

    expect(addRecord).toHaveBeenCalledTimes(1);
    expect(addRecord).toHaveBeenCalledWith(expect.objectContaining({ date: record.date }));
    expect(onBusyChange).toHaveBeenLastCalledWith(true);

    // While saving: Save, Copy Previous and the date arrows are disabled…
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /copy previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /previous day/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next day/i })).toBeDisabled();

    // …the form fields themselves are frozen (fieldset), so the visible
    // values cannot diverge from the payload being saved…
    expect(screen.getByDisplayValue('3')).toBeDisabled(); // feed bags

    // …and real, rendered Delete buttons exist but cannot race the save.
    const deleteButtons = screen.getAllByRole('button', { name: /delete record/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
    deleteButtons.forEach(btn => {
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
    });
    expect(deleteRecord).not.toHaveBeenCalled();

    // The save fails (e.g. hospital Wi-Fi): controls unlock, values survive.
    resolveSave(false);
    await waitFor(() => expect(screen.getByRole('button', { name: /update record/i })).toBeEnabled());
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    const feedInput = screen.getByDisplayValue('3');
    expect(feedInput).toBeEnabled();
  });

  it('resets the form only after a confirmed successful save', async () => {
    let resolveSave!: (ok: boolean) => void;
    const addRecord = vi.fn(() => new Promise<boolean>(res => { resolveSave = res; }));

    renderEditor({ addRecord });

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    fireEvent.click(screen.getByRole('button', { name: /update record/i }));
    resolveSave(true);

    // Back to a fresh entry form for the same day.
    await waitFor(() => expect(screen.getByRole('button', { name: /save entry/i })).toBeEnabled());
  });

  it('day-only mode renders no date-navigation arrows; standalone mode does', () => {
    renderEditor();
    expect(screen.getByText('Sunday, Jul 12, 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /previous day/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /next day/i })).toBeNull();
  });

  it('standalone mode has named, working arrows', () => {
    renderEditor({ dayOnly: false });
    expect(screen.getByRole('button', { name: /previous day/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /previous day/i }));
    expect(screen.getByText('Saturday, Jul 11, 2026')).toBeInTheDocument();
  });
});
