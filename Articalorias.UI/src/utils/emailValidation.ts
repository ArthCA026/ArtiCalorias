const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error string if the email is invalid, or null when valid. */
export function validateEmail(email: string): string | null {
  if (!email.trim()) return "Please enter your email address.";
  if (!EMAIL_RE.test(email.trim())) return "That doesn't look like a valid email.";
  return null;
}
