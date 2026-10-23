import { expect, it } from 'vitest';
import { ageOn, ageLabel, alertLine, alertValue, cardReadiness, fallRiskValue, phoneHref, type CareAlert, type CareProfile } from '@/lib/careProfile';
import { emergencyCardRows } from '@/lib/emergencyCard';

const profile = (values: Partial<CareProfile> = {}): CareProfile => ({ id: 'profile', household_id: 'family', date_of_birth: null, fall_risk: null, fall_risk_note: '', emergency_notes: '', none_known: [], updated_at: '', ...values });
const alert = (kind: string, text: string): CareAlert => ({ id: text, household_id: 'family', kind, text, note: '', sort: 0, created_at: '' });
it('shows completed years on a birthday and handles 29 February', () => {
  expect(ageOn('1960-10-22', new Date(2026, 9, 21))).toBe(65);
  expect(ageOn('1960-10-22', new Date(2026, 9, 22))).toBe(66);
  expect(ageOn('2000-02-29', new Date(2025, 1, 28))).toBe(24);
  expect(ageOn('2000-02-29', new Date(2025, 2, 1))).toBe(25);
  expect(ageOn('2000-02-29', new Date(2024, 1, 29))).toBe(24);
  expect(ageOn('2026-02-30')).toBeNull(); expect(ageOn('2999-01-01')).toBeNull();
  expect(ageLabel(null)).toContain('Not recorded');
});
it('keeps every safety kind visible on its own line, combining two allergies', () => {
  const alerts = [alert('allergy', 'Peanuts'), alert('allergy', 'Latex'), alert('contagious', 'Sample infection'), alert('diet', 'Low sodium')];
  const summary = alertLine(profile({ fall_risk: true, fall_risk_note: 'Two people to stand' }), alerts);
  expect(summary.lines).toEqual(['Allergic to Peanuts, Latex', 'Fall risk: Two people to stand', 'Contagious: Sample infection']);
  expect(summary.full).toContain('Fall risk: Two people to stand');
  expect(summary.full).toContain('Contagious: Sample infection');
  expect(summary.full).not.toContain('Low sodium');
  expect(alertLine(null, []).lines).toEqual([]);
});
it('never renders unknown alerts or fall risk as none or no', () => {
  expect(alertValue('allergy', null, [])).toBe('Not recorded');
  expect(alertValue('allergy', profile({ none_known: ['allergy'] }), [])).toBe('None known');
  expect(alertValue('allergy', profile({ none_known: ['allergy'] }), [alert('allergy', 'Latex')])).toBe('Latex');
  expect(fallRiskValue(null)).toBe('Not recorded');
  expect(fallRiskValue(profile({ fall_risk: false }))).toBe('No');
});
it('gates a complete emergency card on all four successful reads', () => {
  const ready = Array.from({ length: 4 }, () => ({ loading: false, error: false }));
  expect(cardReadiness(ready)).toBe('ready');
  for (let i = 0; i < 4; i++) {
    expect(cardReadiness(ready.map((p, n) => ({ ...p, loading: n === i })))).toBe('loading');
    expect(cardReadiness(ready.map((p, n) => ({ ...p, error: n === i })))).toBe('failed');
  }
  const model = emergencyCardRows(null, [], [], []);
  expect(model.facts.every(([, value]) => value === 'Not recorded')).toBe(true);
  expect(model.notes).toBe('Not recorded');
});
it('makes only fixed-scheme phone links, preserving the visible number separately', () => {
  expect(phoneHref('+1 (555) 010-1234', 'tel')).toBe('tel:+15550101234');
  expect(phoneHref('+1 (555) 010-1234', 'sms')).toBe('sms:+15550101234');
  expect(phoneHref('not recorded', 'tel')).toBeUndefined();
  expect(phoneHref('555-010-1234 ext 9', 'tel')).toBeUndefined();
});
