/** Returns an error string if the password is invalid, or null when valid. */
export function validatePassword(pw: string): string | null {
  if (!pw) return "Please enter a password.";
  if (pw.length < 8) return "Must be at least 8 characters.";
  return null;
}

/** Returns an error string if confirmation is invalid, or null when valid. */
export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return "Please re-enter your password.";
  if (password !== confirm) return "Passwords don't match.";
  return null;
}
