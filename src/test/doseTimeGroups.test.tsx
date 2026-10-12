import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DoseTimeGroups } from '@/components/today/DoseTimeGroups';
import type { Medicine } from '@/hooks/useMedicines';
import type { GivenItem } from '@/components/today/todaySchedule';
import { URGENCY } from '@/lib/medicineUrgency';

const now = new Date('2026-10-11T12:00:00');
const medicine = { id: 'a', name: 'Synthetic medicine', potency: '', amount: '1 tablet' } as Medicine;

describe('dose group controls', () => {
  it('shows a numbered chip with its full accessible name', () => {
    render(<DoseTimeGroups upcoming={[{ at: now, medicine, state: 'due' }, { at: now, medicine: { ...medicine, id: 'b' }, state: 'due' }]} now={now} />);
    expect(screen.getByLabelText('2 medicines')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /2 medicines/ })).toBeInTheDocument();
  });
  it('shows skipped words but no given chip when nothing was given', () => {
    render(<DoseTimeGroups given={[]} skipped={[{ at: now, medicine, skip: { id: 'skip', medicine_id: medicine.id, for_date: '2026-10-11', for_minute: 720, reason: 'Not needed', recorded_by: 'Synthetic caregiver', created_at: '' } }]} now={now} />);
    expect(screen.getByText('1 skipped')).toBeVisible();
    expect(screen.queryByLabelText('0 given')).not.toBeInTheDocument();
  });
  it('keeps MISSED neutral and steady, unlike pulsing pink LATE', () => {
    render(<DoseTimeGroups upcoming={[{ at: now, medicine, state: 'missed' }]} now={now} />);
    const row = screen.getByRole('button', { name: /MISSED/ });
    expect(row).toHaveStyle({ backgroundColor: '#f3f0ec', color: '#7f1d1d' });
    expect(screen.getByLabelText('1 medicine')).toHaveStyle({ backgroundColor: '#ffffff' });
    expect(row).not.toHaveClass('medicine-pulse-fast', 'medicine-pulse-slow');
    expect(URGENCY.missed.tint).not.toBe(URGENCY.late.tint);
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(row).toHaveStyle({ backgroundColor: '#f3f0ec' });
  });
  it.each(['soon', 'due', 'late'] as const)('keeps %s tinted and pulsing even when closed', state => {
    render(<DoseTimeGroups upcoming={[{ at: now, medicine, state }]} now={now} />);
    const row = screen.getByRole('button', { name: new RegExp(URGENCY[state].label) });
    expect(row).toHaveClass(URGENCY[state].motion);
    expect(row).toHaveStyle({ backgroundColor: URGENCY[state].tint });
    expect(row).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(row).toHaveClass(URGENCY[state].motion);
    expect(screen.getByText(URGENCY[state].label)).toBeVisible();
  });
  it('turns the chevron with expanded state and records from the whole medicine row', () => {
    const item = { at: now, medicine, state: 'due' as const };
    const record = vi.fn();
    render(<DoseTimeGroups upcoming={[item]} now={now} onUpcoming={record} />);
    const time = screen.getByRole('button', { name: /12:00 PM.*1 medicine/ });
    expect(time).toHaveAttribute('aria-expanded', 'true');
    expect(time.querySelector('svg')).toHaveClass('rotate-180');
    expect(screen.getByText('Record', { exact: true })).toBeVisible();
    fireEvent.click(time);
    expect(time).toHaveAttribute('aria-expanded', 'false');
    expect(time.querySelector('svg')).not.toHaveClass('rotate-180');
    expect(screen.queryByText('Record', { exact: true })).not.toBeInTheDocument();
    fireEvent.click(time);
    fireEvent.click(screen.getByRole('button', { name: /Synthetic medicine.*Record/ }));
    expect(record).toHaveBeenCalledWith(item);
  });
  it('keeps Given closed initially and shows no Record cue after opening', () => {
    const item = { at: now, medicine, log: { id: 'log', recorded_by: 'Synthetic caregiver' } } as GivenItem;
    render(<DoseTimeGroups given={[item]} now={now} />);
    const time = screen.getByRole('button', { name: /12:00 PM.*1 given/ });
    expect(screen.getByLabelText('1 given')).toHaveStyle({ backgroundColor: '#f3f0ec' });
    expect(time).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(time);
    expect(time).toHaveAttribute('aria-expanded', 'true');
    expect(time.querySelector('svg')).toHaveClass('rotate-180');
    expect(screen.getByText('Synthetic caregiver', { exact: false })).toBeVisible();
    expect(screen.queryByText('Record', { exact: true })).not.toBeInTheDocument();
  });
});
