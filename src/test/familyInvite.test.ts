import { expect, it } from 'vitest';
import { familyInviteMessage } from '@/lib/familyInvite';

it('shares the account email and app origin without an invitation secret', () => {
  expect(familyInviteMessage('member@example.test', 'https://health.example.test'))
    .toBe('Join our family on Health Tracker. Create an account with member@example.test at https://health.example.test');
});
