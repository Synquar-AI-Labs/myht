export function accountError(error: unknown): string {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message) : '';
  const messages: Record<string, string> = {
    email_not_verified: 'Confirm your email first.',
    already_in_household: 'You already belong to a family.',
    invite_unavailable: 'This invitation is no longer available.',
    name_taken: 'That name is already used. Try another name.',
    admin_required: 'Only the family admin can do that.',
    invalid_caregiver: 'That person is no longer available. Check the people list.',
    invite_already_accepted: 'That invitation has already been accepted.',
    cannot_remove_self: 'You cannot remove yourself.',
    member_not_found: 'That person is no longer in your family.',
    invalid_credentials: 'Incorrect email or password.',
    otp_expired: 'That code is not right, or it has expired. Check it, or send a new one.',
    email_not_confirmed: 'Confirm your email first.',
    invalid_email: 'That email does not look right.',
    already_member: 'That person is already in your family.',
    '23505': 'That name is already used. Try another name.',
    over_email_send_rate_limit: 'Please wait before requesting another code.',
  };
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  return messages[message] || messages[code] ||
    (message === 'Invalid login credentials' ? messages.invalid_credentials : 'Something went wrong. Please try again.');
}

export type SetupDestination = 'loading' | 'error' | 'app' | 'join' | 'setup';
export function resolveSetup(input: {
  loading?: boolean; error?: unknown; member?: boolean; invite?: boolean;
}): SetupDestination {
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  if (input.member) return 'app';
  return input.invite ? 'join' : 'setup';
}
