import { describe, expect, it } from 'vitest';
import { accountError, resolveSetup } from '@/lib/accountSetup';

describe('account error messages', () => {
  it.each([
    ['email_not_verified', 'Confirm your email first.'],
    ['already_in_household', 'You already belong to a family.'],
    ['invite_unavailable', 'This invitation is no longer available.'],
    ['name_taken', 'That name is already used. Try another name.'],
    ['admin_required', 'Only the family admin can do that.'],
  ])('maps %s', (message, expected) => expect(accountError({ message })).toBe(expected));
  it('does not expose arbitrary server details', () => {
    expect(accountError({ message: 'secret internal detail' })).toBe('Something went wrong. Please try again.');
  });
});
describe('setup resolution', () => {
  it('members go to the app before invitation handling', () => expect(resolveSetup({ member: true, invite: true })).toBe('app'));
  it('an invitation opens join', () => expect(resolveSetup({ invite: true })).toBe('join'));
  it('no membership or invitation opens setup', () => expect(resolveSetup({})).toBe('setup'));
  it('failed lookup never opens onboarding', () => expect(resolveSetup({ error: new Error('offline') })).toBe('error'));
  it('pending lookup never opens onboarding', () => expect(resolveSetup({ loading: true })).toBe('loading'));
});
