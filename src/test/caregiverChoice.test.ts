import { describe, expect, it } from 'vitest';
import { chooseCaregiver, changedCaregiverId, attributionForEdit } from '@/lib/caregiverChoice';
import type { HouseholdPerson } from '@/hooks/HouseholdProvider';

const person = (id: string, active = true): HouseholdPerson => ({
  caregiver_id: id, display_name: id, is_active: active,
  user_id: id, role: 'member', email: null,
});
describe('caregiver choice', () => {
  const people = [person('me'), person('helper'), person('inactive', false)];
  it('defaults to my own caregiver', () => {
    expect(chooseCaregiver(people, null, 'me')?.caregiver_id).toBe('me');
  });
  it('uses an active remembered caregiver', () => {
    expect(chooseCaregiver(people, 'helper', 'me')?.caregiver_id).toBe('helper');
  });
  it.each(['another-household', 'inactive'])('ignores an invalid remembered id: %s', id => {
    expect(chooseCaregiver(people, id, 'me')?.caregiver_id).toBe('me');
  });
  it('does not fall back to an inactive caregiver', () => {
    expect(chooseCaregiver(people, null, 'inactive')).toBeUndefined();
  });
});

describe('editing attribution', () => {
  it('leaves attribution untouched unless deliberately changed', () => {
    expect(changedCaregiverId('original', 'original')).toBeUndefined();
    expect(attributionForEdit([], undefined, 'original')).toEqual({});
  });
  it('sets the id and name together on a deliberate choice', () => {
    expect(attributionForEdit([person('helper')], changedCaregiverId('helper', 'original'), 'original')).toEqual({ caregiver_id: 'helper', recorded_by: 'helper' });
  });
  it('allows the existing inactive person but rejects other inactive or foreign people', () => {
    expect(attributionForEdit([person('old', false)], 'old', 'old').caregiver_id).toBe('old');
    expect(() => attributionForEdit([person('old', false)], 'old', 'someone')).toThrow();
    expect(() => attributionForEdit([], 'foreign', 'old')).toThrow();
  });
});
