/**
 * Round 53 — the server's password policy is stricter than anything the browser
 * can check: besides length and character classes it rejects passwords found in
 * known breach corpora (HIBP, verified empirically against the live service). A
 * parent whose checklist was all green was told only "we couldn't create your
 * account", which named nothing actionable.
 *
 * This reads the structured reasons the auth client attaches to a weak-password
 * error (`AuthWeakPasswordError.reasons`) and falls back to matching the message
 * text, so it keeps working if the setting drifts again. The raw backend string
 * is never shown to a parent — Round 33 removed that on purpose — but it is
 * always console.error'd so it stays diagnosable.
 */
const WEAK_PASSWORD_SENTENCES: Record<string, string> = {
  pwned:
    "That password has appeared in a known data breach, so it can't be used here. Please choose a different one — something unique to this account.",
  length: "That password is too short. Please use at least 8 characters.",
  characters:
    "That password is missing a required character type. Please include an uppercase letter, a lowercase letter, a number and a symbol.",
};

const WEAK_PASSWORD_GENERIC =
  "That password doesn't meet our security requirements. Please try a different one.";

export function weakPasswordMessage(error: unknown, message: string): string | null {
  const raw = (error as { reasons?: unknown } | null)?.reasons;
  const reasons = Array.isArray(raw) ? raw.filter((r): r is string => typeof r === "string") : [];

  if (reasons.length) {
    // Breach is the one a parent cannot see coming, so it leads.
    const ordered = ["pwned", "length", "characters"].filter((r) => reasons.includes(r));
    const sentences = ordered.map((r) => WEAK_PASSWORD_SENTENCES[r]!);
    return sentences.length ? sentences.join(" ") : WEAK_PASSWORD_GENERIC;
  }

  const code = (error as { code?: unknown } | null)?.code;
  const looksWeak =
    code === "weak_password" ||
    (/password/i.test(message) && /should|weak|breach|pwned|leaked|at least/i.test(message));
  if (!looksWeak) return null;

  if (/known to be weak|pwned|breach|leaked/i.test(message)) return WEAK_PASSWORD_SENTENCES['pwned']!;
  if (/at least \d+ characters/i.test(message)) return WEAK_PASSWORD_SENTENCES['length']!;
  if (/one character of each|contain at least/i.test(message))
    return WEAK_PASSWORD_SENTENCES['characters']!;
  return WEAK_PASSWORD_GENERIC;
}

/**
 * Round 54b — observed live: signInWithPassword on an unconfirmed account returns
 * { code: "email_not_confirmed", status: 400, message: "Email not confirmed" }.
 * Structured code first; message text only as a fallback if the string drifts.
 */
export function isEmailNotConfirmed(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "email_not_confirmed") return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /email not confirmed/i.test(message);
}

// Shared by every caller, so it names only what is true on every page. The
// "resend it below" pointer lives next to the button in auth.tsx.
export const EMAIL_NOT_CONFIRMED_MESSAGE =
  "Your email address hasn't been confirmed yet. Check your inbox — including spam and Promotions — for a confirmation link from Tiger's Den.";

export function authErrorMessage(error: unknown, fallback: string): string {
  console.error("Auth error", error);
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/too many requests|rate limit|for security purposes/i.test(message)) {
    return "Too many attempts just now. Please wait a moment and try again.";
  }
  if (isEmailNotConfirmed(error)) return EMAIL_NOT_CONFIRMED_MESSAGE;
  const weak = weakPasswordMessage(error, message);
  if (weak) return weak;
  if (/email address.*invalid|invalid email|unable to validate email/i.test(message)) {
    return "That email address doesn't look right. Please check it and try again.";
  }
  return fallback;
}
