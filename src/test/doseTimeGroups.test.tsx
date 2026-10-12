import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DoseTimeGroups } from '@/components/today/DoseTimeGroups';
import type { Medicine } from '@/hooks/useMedicines';
import type { GivenItem } from '@/components/today/todaySchedule';
import { URGENCY } from '@/lib/medicineUrgency';

const now = new Date('2026-10-11T12:00:00');
const medicine = { id: 'a', name: 'Synthetic medicine', potency: '', amount: '1 tablet' } as Medicine;

describe('dose group controls', () => {
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
    expect(time).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(time);
    expect(time).toHaveAttribute('aria-expanded', 'true');
    expect(time.querySelector('svg')).toHaveClass('rotate-180');
    expect(screen.getByText('Synthetic caregiver', { exact: false })).toBeVisible();
    expect(screen.queryByText('Record', { exact: true })).not.toBeInTheDocument();
  });
});
