export function accountError(error: unknown): string {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message) : '';
  const messages: Record<string, string> = {
    email_not_verified: 'Confirm your email first.',
    already_in_household: 'You already belong to a family.',
    invite_unavailable: 'This invitation is no longer available.',
    name_taken: 'That name is already used. Try another name.',
    admin_required: 'Only the family admin can do that.',
    invalid_credentials: 'Incorrect email or password.',
    otp_expired: 'That code has expired. Request another one.',
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
