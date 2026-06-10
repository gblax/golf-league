// Maps raw Supabase / Postgres / network errors to copy that's safe to show
// users. The raw error always goes to the console so debugging info isn't lost.
export function friendlyError(error, fallback = 'Something went wrong. Please try again.') {
  console.error(error);

  const msg = (error?.message || '').toLowerCase();
  const code = error?.code;
  const status = error?.status;

  if (msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('network')) {
    return 'Network error — check your connection and try again.';
  }
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (msg.includes('invalid login credentials')) {
    return 'Invalid email or password.';
  }
  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Please confirm your email first — check your inbox.';
  }
  if (msg.includes('password should be at least')) {
    return 'Password must be at least 6 characters.';
  }
  if (msg.includes('new password should be different')) {
    return 'New password must be different from your current one.';
  }
  if (code === '42501' || msg.includes('row-level security')) {
    return "You don't have permission to do that.";
  }
  return fallback;
}
