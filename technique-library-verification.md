# Technique Library verification — 2026-11-25 UTC

## Applied scope
- Platform migration tool applied `drizzle/migrations/0024_technique_library_all_active_members.sql`; frozen `supabase/migrations/` untouched.
- Removed only the enrollment `EXISTS` predicate from `get_technique_library()`; admin path unchanged.
- Page wrappers now use exactly the dashboard/announcements horizontal classes: `px-4 sm:px-6 lg:px-8`. Width, vertical spacing, cards and grid styling retained.
- Subtitle, empty-state wording and page descriptions no longer imply program-specific entitlement.
- Query waits for a resolved signed-in session and uses `["technique-library", user?.id]`. Sidebar correction is comment-only.

## Caller inventory
The sole RPC is in `src/lib/technique-library.ts`, consumed by the authenticated techniques page and shared sidebar. The sidebar can mount before the authenticated guard; the added session-enabled check prevents automatic signed-out requests. Direct signed-out database calls remain denied by existing EXECUTE privileges.

## Fixture tests — separate results
**a — PASS.** `zz.test.negative@example.com`, whose permanent child remains in Tai Chi (Tai Chi & Karate), received all eight published techniques and rendered eight cards. Both Jiu Jitsu and Wrestling chips appeared. Both labels currently belong to the one Jiu Jitsu & Wrestling program; no new program or chip names were invented.

**b — PASS.** A temporary staff-created unpublished draft was absent from the parent's RPC results and rendered page; every returned parent row was published.

**c — PASS.** Staff received the same eight existing rows, with identical fields/order, plus the temporary draft displayed as “Draft — staff only.” On the same browser, staff signed out through the actual control and the parent signed in. A DOM observer saw no draft title during the transition or parent page loading. Parent keys contained the parent's ID, not the staff ID; staff keys contained the staff ID. The unsigned key had no fetched data.

**d — PASS.** Direct signed-out execution returned HTTP 401 with database permission code `42501`. Signed-out navigation to `/techniques` redirected to `/auth`, with zero automatic `get_technique_library` requests.

**e — PASS.** Staff archived only the negative fixture through Parents & Premium. A fresh RPC using its privately retained pre-archive token returned HTTP 200 with `[]`. Staff restored it through the same page; fresh parent sign-in returned the same eight published rows and both chips. Final read-back: `archived_at = NULL`, `banned_until = NULL` for parent and staff.

**Spacing — PASS.** At 390×844, left/right wrapper padding was 16px and the card left edge was 16px; dashboard and announcements were also 16px. No horizontal overflow. Desktop screenshot retained the three-column card layout. Fresh browser runtime errors: none. Preview build log: build OK.

## Cleanup and fixture integrity
- Temporary drafts removed in `finally`, including after unsuccessful test-script attempts. Final technique inventory: eight total, zero unpublished, zero temporary drafts.
- No signup, invite use, real-family tests or manual permanent-child edits.
- Permanent child restored active; points 0, attendance 0, Tai Chi enrollment, guardian rows and all other business fields match baseline. Archive marker cleared.
- Existing archive/restore processing automatically advanced the child's `updated_at` from `2026-11-24T02:08:39.626591+00:00` to `2026-11-25T03:29:52.707412+00:00`. This timestamp was not manually overwritten.
- Earlier browser attempts needed the correct staff-tab label, a fresh context for post-restore sign-in, and mobile navigation instead of a hidden sidebar link. These were test-script issues; the final complete a–e run passed. Draft cleanup ran each time; parent remained restored.

## Final function read-back
```sql
CREATE OR REPLACE FUNCTION public.get_technique_library()
 RETURNS TABLE(id uuid, program_id uuid, program_name text, label text, title text, category text, difficulty text, notes text, sort_order integer, published boolean, video_youtube_id text, video_title text, video_seconds integer, video_orientation text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tl.id, tl.program_id, pr.name, tl.label, tl.title,
         tl.category, tl.difficulty, tl.notes, tl.sort_order,
         tl.published, tl.video_youtube_id, tl.video_title, tl.video_seconds,
         tl.video_orientation
  FROM public.technique_library tl
  JOIN public.programs pr ON pr.id = tl.program_id
  WHERE
    public.has_role(auth.uid(), 'admin')
    OR (
      public.is_active_member()  -- guard
      AND tl.published = true
    )
  ORDER BY tl.category, tl.sort_order, tl.title;
$function$;
```
Signature, return columns, STABLE, SECURITY DEFINER, search_path and ordering retained. ACL unchanged: owner, authenticated and service_role EXECUTE; anon and PUBLIC denied.

All other public function definitions/ACLs matched baseline hash `b381160c6b5b28f2965679568b3989ea`. All policies, including storage, matched baseline hash `2985bd49cea8821ced6c118b9ed49c66`. No unrelated function or policy changes.

## Quick scan
Before and after: **zero new findings, one existing warning** — signed-in accounts can read every `app_settings` record. Same finding identifier before/after. No finding dismissed. No deep scan requested or run.

## Retained tests and dependencies
- `src/lib/technique-library.browser.py`: fixture-only a–e and same-browser transition suite; requires private credential/session files under `/tmp/browser/techniques` and cleans up in `finally`.
- `RUN_TECHNIQUE_LIBRARY_TESTS=1 bunx vitest run src/lib/technique-library.integration.test.ts`: three read-only live regression tests passed after cleanup.
- `git diff -- package.json bun.lock`: empty — **no dependency changes**.
- No private credentials added to source; fixture credentials and session tokens stay under `/tmp/browser`, not the repository.

Database access change is applied. **The page and account-cache changes need publishing.** No automatic publication was performed.