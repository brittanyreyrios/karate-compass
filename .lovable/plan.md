# Round 3 — plan

Build order: **N → O → K → J → L → M**. N first as requested; O is tiny and shares the admin-tab files with J.

## N. Granting admin access (first)

**Migration**
- `GRANT INSERT, DELETE ON public.user_roles TO authenticated`.
- Policies on `user_roles`: INSERT and DELETE `TO authenticated` with `public.has_role(auth.uid(), 'admin')` only. No self-service grant path. Existing SELECT policies untouched.
- `BEFORE DELETE` trigger `guard_admin_role_delete()`:
  - raises `You cannot remove your own admin access` when `OLD.user_id = auth.uid()` and `OLD.role = 'admin'`;
  - raises `At least one admin must remain` when the row is the last `admin`.
- New table `public.role_change_events` (`target_user_id`, `role app_role`, `action text` in `granted|revoked`, `changed_by uuid`, `changed_at`), GRANT SELECT to `authenticated` + ALL to `service_role`, RLS on, admin-read-only policy, no client insert/update/delete policies (same shape as `photo_consent_events`).
- `AFTER INSERT OR DELETE` trigger on `user_roles` writing the audit row (SECURITY DEFINER) so SQL-editor changes are captured too; `changed_by = auth.uid()` (NULL when there is no session — left blank, never invented).

**UI — Admin → Parents & Premium**
- Each account row shows its current role (Admin / Parent).
- "Make admin" / "Remove admin" per row, admin-only, behind an AlertDialog naming the person: *"Give Sarah Nguyen full admin access? They will be able to see and edit every family's information."* Revoke dialog is destructive-styled.
- Your own row's control is disabled with a tooltip explaining why.
- Below the tab, "Recent role changes" — last 10 `role_change_events` joined to profiles for names, with the action, date, and who made it. DB error messages from the guard trigger surface verbatim in a toast.
- No account is seeded or promoted.

## O. "Large Dojo" → "Big Dojo"
- New migration: `UPDATE public.class_schedules SET location = 'Big Dojo' WHERE location = 'Large Dojo';`
- Repo grep result: `Large Dojo` appears **only** in the two historical seed migrations (`20260709030700`, `20260801191823`), which cannot be edited in place. No app code, placeholder, comment, or type union carries it. `Small Dojo` / `V12` untouched.
- Class Schedules admin tab: `location` becomes an inline save-on-blur text input (same pattern as Belt Systems), writing only on actual change.

## K. Mobile nav stays open
- `app-sidebar.tsx`: pull `setOpenMobile` and `isMobile` from `useSidebar()`; every `<Link>` inside a `SidebarMenuButton` (main nav + admin item) gets `onClick={() => setOpenMobile(false)}`. Desktop sidebar state is untouched, since `setOpenMobile` only affects the mobile sheet.

## J. Admin console at 390px
- **J1 tabs:** wrap the tab region in a normal-flow container with its own stacking context; remove whatever wrapping/absolute/negative-margin rule causes the overlap. Below `sm`: a full-width `<Select>` with a real `<label>` "Section" driving the same tab value. At `sm`+: `overflow-x-auto flex-nowrap` strip with scroll-snap, no wrapping.
- **J2 student cards:** vertical stack on mobile — name row (wraps, no truncate), then belt + class chips on a wrapping row, then the points stepper full-width, then Edit. `−`/`+` at `min-h-11 min-w-11` (44px). Promote to the current horizontal layout at `sm`+.
- **J3 unlinked audit:** name + belt + class, email on its own full-width wrapping row (`break-all`), then "Retry link" and "Remove" as two full-width buttons. "Remove" destructive variant behind an AlertDialog confirming the parked row deletion.
- **J4 sweep:** walk every admin tab at 390px in a headless browser, screenshot each, and fix every overlap/clip/truncation found. I will report the actual list of what was found and fixed — not a blanket "all fine".

## L. Skeletons
- New `src/components/skeletons.tsx` with layout-matched skeleton blocks reusing `ui/skeleton`, each region `aria-busy="true"` with an `sr-only` "Loading …" label.
- Applied to: parent dashboard (student cards, "Next up" strip, class schedule card), `/curriculum`, `/gallery` tile grid, `/leaderboard` (podium + list), `/calendar`, `/polls`, admin Master Attendance and All Students lists.
- Dimensions matched to the real rows so nothing shifts on load.
- `prefers-reduced-motion`: add a `motion-reduce:animate-none` rule (plus a global CSS media query guard) so no shimmer runs.
- No skeletons on instant, non-networked UI.

## M. Mobile month calendar
- Horizontal, keyboard-operable month selector (`Jul · Aug · Sep …`), current month highlighted, `overflow-x-auto` with scroll-snap, arrow-key/tab operable, `aria-current`.
- Month grid below: 7 columns, min cell touch target, up to two event chips per day — colour-coded by `event_type` **and** always text-labelled — plus `+N more`.
- Tapping a day opens the existing day detail panel beneath the grid; today marked with a ring + "Today" text, not colour alone.
- Chips truncate; cells never shrink below the touch minimum at 320px.
- Existing agenda list kept as a Month / Agenda toggle.
- Closures and events only — recurring classes stay off the calendar.

## Verification
Typecheck plus a headless pass at 390px and 320px over `/admin` (every tab), `/`, `/calendar`, `/leaderboard`, `/gallery`, `/curriculum`, `/polls`, with screenshots. Anything I cannot verify or resolve is reported blank rather than filled in.
