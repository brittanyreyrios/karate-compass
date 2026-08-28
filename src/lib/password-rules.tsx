import { Check, Circle } from "lucide-react";

/**
 * The one and only definition of what makes an acceptable NEW password.
 * Used by the sign-up form (src/routes/auth.tsx) and the reset-password page
 * so the two can never drift apart.
 *
 * Sign-IN never consults this: existing families keep whatever password their
 * account already has.
 *
 * The special-character set is an explicit allow-list — deliberately NOT
 * "anything that isn't a letter or digit", because that would let a space (or a
 * trailing space) satisfy the rule and produce an un-retypable password. It
 * mirrors the set the auth service itself accepts.
 */
export const SPECIAL_CHARACTERS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

const SPECIAL_SET = new Set(SPECIAL_CHARACTERS.split(""));

export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { id: "upper", label: "At least one uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { id: "lower", label: "At least one lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { id: "number", label: "At least one number", test: (pw) => /[0-9]/.test(pw) },
  {
    id: "special",
    label: "At least one special character",
    // Whitespace can never satisfy this: it is not in SPECIAL_SET.
    test: (pw) => pw.split("").some((ch) => SPECIAL_SET.has(ch)),
  },
];

export type PasswordCheck = {
  results: { rule: PasswordRule; ok: boolean }[];
  allPassed: boolean;
};

export function checkPassword(password: string): PasswordCheck {
  const results = PASSWORD_RULES.map((rule) => ({ rule, ok: rule.test(password) }));
  return { results, allPassed: results.every((r) => r.ok) };
}

/** A single message covering every unmet rule, for the submit-time guard. */
export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Your password needs 8+ characters with an uppercase letter, a lowercase letter, a number and a special character.";

/**
 * Live checklist rendered beneath a new-password field. Always visible, so a
 * parent sees the rules before typing. Never colour-only: each row pairs its
 * colour with an icon and screen-reader-only "Met"/"Not met" text, and the list
 * is aria-live="polite" so changes are announced as they type.
 */
export function PasswordChecklist({ password, id }: { password: string; id: string }) {
  const { results } = checkPassword(password);
  return (
    <ul
      id={id}
      aria-live="polite"
      className="mt-2 space-y-1 rounded-xl border border-border bg-background p-3"
    >
      {results.map(({ rule, ok }) => (
        <li
          key={rule.id}
          className={`flex items-center gap-2 text-xs ${ok ? "text-emerald-300" : "text-muted-foreground"}`}
        >
          {ok ? (
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{rule.label}</span>
          <span className="sr-only">{ok ? "— met" : "— not met"}</span>
        </li>
      ))}
    </ul>
  );
}
