# Round 14 — BA folded in (highest priority), alongside AX / AY / AZ

AX, AY and AZ are already built and verified. BA joins the same round and ships as
part of it. Nothing already delivered gets re-opened.

## BA — the signup QR must encode one configured address, never the admin's browser address

### BA1 — the setting

`app_settings` is already a key/value table with the right shape and the right
access rules: any signed-in user can read, only admins can write, via the
existing policy. A new key needs **no new column, no new table and no new
policy** — so BA1 adds no schema.

- `PUBLIC_SITE_URL_KEY = "public_site_url"` added next to `GOOGLE_REVIEW_URL_KEY`
  in `src/lib/app-settings.ts`. Read and written through the existing
  `useAppSetting` / `useSetAppSetting` hooks.
- Validation reuses the existing `isUsableUrl` — no second validator.

**No row is inserted.** The key ships absent, so the field renders empty and the
QR refuses to draw until a human sets it.

Because there is no schema change and no new database function, BA has nothing to
migrate and nothing to execute. I will say that plainly in the report rather than
inventing a migration to look thorough. AX's function stays the one executed
result for this round.

### BA2 — admin field

A second card in the School Settings tab, beside the Google review link:

- Label: "Public address of this portal"
- Helper text, in plain English: this is the address parents type or scan; it is
  not detected automatically and must be updated after publishing.
- Same empty-is-allowed / `isUsableUrl`-or-refuse-to-save behaviour as the review
  link, same "Currently live:" echo when set.
- Placeholder only (`https://…`). No default, no seed, no `window.location.origin`.

### BA3 — QR and copy-link source

`InviteQrTab` builds the signup URL from the configured value:

```
<public_site_url, trailing slash trimmed>/auth?invite=<code>
```

`window.location.origin` is removed from that construction entirely. The copy
button copies exactly the string the QR encodes — one source, so the two can
never disagree.

### BA4 — refuse to draw a wrong QR

When `public_site_url` is unset or fails `isUsableUrl`, no QR is rendered and no
copyable link is offered. In its place, exactly:

> Set the portal's public address in Settings before generating a QR code. A printed QR cannot be corrected afterwards.

The existing "Create an invite code first, then select it here." stays for the
separate case of a valid address but no invite code selected.

### BA5 — the address is readable without scanning

The full signup URL is printed above the QR as selectable text, wrapping rather
than truncating — no ellipsis, no tooltip, no `title`-only.

### BA6 — visible mismatch, never a block

When the configured address is set and its origin differs from
`window.location.origin`, a neutral note under the QR:

> This QR points at {configured URL}. You are currently viewing {current origin}.

Rendered as normal muted text, not a warning colour. It never disables the QR or
the copy button — generating a production QR from a preview session is the
correct workflow, and this only makes the difference visible.

## Left alone deliberately

`auth.tsx` (lines 132, 168) and `settings.tsx` (line 100) keep building
`emailRedirectTo` / `redirectTo` from `window.location.origin`. A user really is
on the site they are using, and Supabase's Redirect URL allow-list is the
backstop. Untouched this round.

## Verification

- Read `app_settings` before and after to confirm `public_site_url` is absent /
  blank and that the existing `google_review_url` row is not modified.
- Drive the admin Signup QR tab in a real browser with the setting unset,
  screenshot the refusal, and paste the rendered string.
- Set the value on a clearly labelled temporary basis to capture the mismatch
  note as it renders, then delete that row so the setting ships absent. No
  existing record is touched.

## Report back

One line each on AX, AY, AZ and BA; confirmation that `public_site_url` ships
blank; the exact unset-state string; the exact BA6 note; and what BA excludes.
