# Parent dashboard header layout: stack on mobile, keep side-by-side at sm+

No data change, no query change, no database change. One file: `src/routes/_authenticated/index.tsx`.

## The change

Lines ~290 header:

- On mobile, change the heading/select container from `grid grid-cols-[minmax(0,1fr)_auto]` to a single-column stack. The heading `<div>` gets `w-full` so the family name occupies the full mobile width; the select wrapper is moved to a new row beneath it. Both rows remain within the same `<header>`.
- At `sm:` and above, keep the existing `flex flex-wrap justify-between` layout exactly as it is today.
- Remove `truncate` from the `<h1>` and add `break-words`. Long family names wrap onto a second line instead of clipping; a very long single word wraps without overflowing.
- On mobile, the `<SelectTrigger>` uses `w-full` rather than `w-[200px]`. At `sm:` it keeps the existing `w-[200px]`.
- Leave the eyebrow text "Welcome back", the red gradient span on the family name, the wording "The {family} Family Dashboard", the hidden-on-mobile "Viewing" label, and the full Select content untouched.

## Verification I will paste back

`git diff --stat` (index.tsx only); the final header JSX; a signed-in parent with multiple students on a narrow phone viewport showing the full family name plus "Family Dashboard" fully visible and the dropdown on its own line; the desktop layout at sm+ visually unchanged; and a test with a family name of at least 20 characters wrapping cleanly instead of clipping or overflowing.
