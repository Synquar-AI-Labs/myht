import { describe, expect, it } from 'vitest';
import { caregiverColor } from '@/lib/caregiverColor';
import { domainKeys } from '@/lib/domainKeys';

describe('caregiver colours', () => {
  it('is deterministic and uses a valid colour', () => {
    expect(caregiverColor('caregiver-1')).toBe(caregiverColor('caregiver-1'));
    expect(caregiverColor('caregiver-1')).toMatch(/^#[0-9A-F]{6}$/);
  });
  it('does not change when other people are added or reordered', () => {
    const before = ['person-a', 'person-b'].map(caregiverColor);
    const after = ['new-person', 'person-b', 'person-a'].map(caregiverColor);
    expect(before[0]).toBe(after[2]);
    expect(before[1]).toBe(after[1]);
  });
  it('handles missing attribution without inventing a person', () => {
    expect(caregiverColor(null)).toBe('#888');
    expect(caregiverColor(undefined)).toBe('#888');
  });
});
describe('remaining domain cache keys', () => {
  it.each(Object.entries(domainKeys))('%s is household-scoped', (_name, key) => {
    expect(key('family-a').slice(0, 2)).toEqual(['household', 'family-a']);
    expect(key('family-a')).not.toEqual(key('family-b'));
  });
});
