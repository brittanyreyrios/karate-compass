# Technique Library: spacing and published access

## Approval boundary
Proposal only; no app, database, fixture or dependency changes applied. After approval, use the platform migration tool into `drizzle/migrations/`. Frozen `supabase/migrations/` stays untouched; do not manually edit the migration journal.

## Confirmed baseline
- Dashboard (`index.tsx:411`) and announcements (`announcements.tsx:141`) both use exactly `px-4 sm:px-6 lg:px-8`. Add only these horizontal classes to the library normal/error wrappers. Keep max-width, vertical spacing, grids, cards and every other style unchanged. Video cards are inside the wrapper.
- Negative fixture: active, unarchived; permanent child enrolled in Tai Chi (Tai Chi & Karate), points zero. Staff fixture: no students.
- Eight published techniques: three Jiu Jitsu labels, five Wrestling labels, all in the program Jiu Jitsu & Wrestling. No existing drafts; b/c require one temporary staff-created draft, removed afterward.
- EXECUTE: anon denied; authenticated/service_role allowed; no PUBLIC grant. Preserve all grants. `is_active_member()` already requires an unarchived profile for non-admins.

## All callers and signed-out caveat
- Sole direct RPC: `src/lib/technique-library.ts:61`, inside `useTechniqueLibrary()`.
- Consumer: `src/routes/_authenticated/techniques.tsx:40`, protected by the authenticated layout's `getUser()` beforeLoad and `ssr: false`.
- Consumer: `src/components/app-sidebar.tsx:63`, mounted from `src/routes/__root.tsx:162` outside that guard. Auth/legal/reset pages omit the sidebar, but the shared shell can mount before the protected guard completes.

**I cannot confirm that every current caller waits for sign-in:** the hook has no enabled guard. The diff adds a small existing-session check so neither consumer automatically calls the RPC while signed out or resolving its initial session. Existing database EXECUTE denial remains the security boundary. Generated types/comments are not callers; no other runtime callers exist in `src/`.

## Technical details: full SQL
Only remove the enrollment EXISTS predicate. Preserve signature, return columns, ordering, STABLE, SECURITY DEFINER, search_path, admin path and privileges. No policy or other function changes.

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

## Technical details: full application diff
Subtitle, empty-state wording and this page's description metadata no longer imply enrollment restrictions. Existing filter chips already derive from all returned technique labels: parents will see every published label/program, including both existing Jiu Jitsu/Wrestling labels. Do not rename those labels or replace the existing filter design. Staff draft behavior stays unchanged. Sidebar edit is comment-only; navigation becomes available automatically when SQL returns techniques.

```diff
--- a/src/routes/_authenticated/techniques.tsx
+++ b/src/routes/_authenticated/techniques.tsx
@@ -24,3 +24,3 @@
         content:
-          "Jiu jitsu and wrestling technique videos for Tiger's Den families training in the grappling programme.",
+          "Published technique videos grouped by position for all active Tiger's Den families.",
       },
@@ -29,3 +29,3 @@
         property: "og:description",
-        content: "Jiu jitsu and wrestling technique videos for Tiger's Den grappling families.",
+        content: "Published technique videos grouped by position for all active Tiger's Den families.",
       },
@@ -63,3 +63,3 @@
     return (
-      <div className="mx-auto w-full max-w-5xl">
+      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
         <QueryErrorState
@@ -73,3 +73,3 @@
   return (
-    <div className="mx-auto w-full min-w-0 max-w-5xl">
+    <div className="mx-auto w-full min-w-0 max-w-5xl px-4 sm:px-6 lg:px-8">
       <header>
@@ -79,4 +79,3 @@
         <p className="mt-1 text-sm text-muted-foreground">
-          Jiu jitsu and wrestling techniques, grouped by position. Nothing loads from YouTube until
-          you press play.
+          Techniques grouped by position. Nothing loads from YouTube until you press play.
         </p>
@@ -88,3 +87,3 @@
         <p className="mt-8 text-sm text-muted-foreground">
-          There are no techniques in your family's programme yet.
+          There are no published techniques yet.
         </p>
--- a/src/lib/technique-library.ts
+++ b/src/lib/technique-library.ts
@@ -1,3 +1,3 @@
 /**
- * Round 13 AU — the jiu jitsu / wrestling technique library.
+ * The shared technique library.
  *
@@ -5,5 +5,4 @@
  * entitlement boundary. Everything here lives in `technique_library` and reaches
- * the browser only through `get_technique_library()`, which resolves the parent
- * from auth.uid() and decides entitlement in SQL — a family never receives an
- * item it is not entitled to, and drafts only ever reach admins.
+ * the browser only through `get_technique_library()`. Active members receive
+ * all published techniques regardless of enrollment; drafts only reach admins.
  */
@@ -11,2 +10,3 @@
 import { supabase } from "@/integrations/supabase/client";
+import { useSession } from "@/hooks/use-auth";
 
@@ -16,3 +16,3 @@
   program_name: string;
-  /** "Jiu Jitsu" or "Wrestling" — display and filtering only. */
+  /** Technique label — display and filtering only. */
   label: string;
@@ -57,4 +57,6 @@
 export function useTechniqueLibrary() {
+  const { user, loading } = useSession();
   return useQuery({
     queryKey: ["technique-library"],
+    enabled: !loading && Boolean(user),
     queryFn: async () => {
--- a/src/components/app-sidebar.tsx
+++ b/src/components/app-sidebar.tsx
@@ -58,5 +58,4 @@
   /**
-   * AU2 — the Technique Library tab only exists for families the server says are
-   * entitled to something. A karate-only family never sees an empty shell; the
-   * entitlement decision is made in SQL, not here.
+   * Show the Technique Library tab when the server returns techniques. Active
+   * members can see all published techniques; staff can also see drafts.
    */
```

## Tests after approval — report a–e separately
Use only `zz.test.negative@example.com` and `leaguecity.tigersden+zzstaff@gmail.com`. No signup, invite use, real families, permanent child edits or existing technique edits. First capture all public function definitions/settings/ACLs, all policies including storage, technique inventory, fixture profile/ban states, permanent child/guardian/enrollment rows and a quick-scan baseline.

**a. Active Tai Chi parent:** actual sign-in and library visit; RPC/UI contain every published ID (currently eight), all published filter labels (currently Jiu Jitsu and Wrestling), independent of enrollment. Check mobile insets including video cards against dashboard/announcements; desktop styling unchanged.

**b. Unpublished hidden:** staff creates one temporary draft. Parent RPC/UI omit its exact ID/title; all returned rows published.

**c. Staff unchanged:** existing IDs/fields/order match staff baseline; temporary draft included and shown as staff-only.

**d. Signed out:** deliberately call the function; permission denied, not just an empty list. Also verify signed-out navigation triggers no automatic library RPC.

**e. Archive/restore:** retain a pre-archive fixture token privately; archive negative parent through the staff page; a fresh direct RPC with that token returns zero rows. Restore through staff page, confirm unbanned and sign in again, repeat (a). Existing archive behavior temporarily deactivates the child; restore it through the same existing flow. Compare child business fields, guardians, enrollments, attendance and zero points with baseline. Report any automatic updated_at change separately; never manually restore timestamps or edit child data.

Cleanup in `finally`, even on failure: restore/unban negative fixture through supported staff action; delete only the temporary draft. Confirm no temporary records and fixture remains restored/unbanned.

## Read-back, scan and dependency report
Read back the complete function and existing privileges. Compare every other public function and all policies with baseline: no differences. Run quick security scan; report new versus existing findings without dismissing anything. Show `git diff -- package.json bun.lock`: **no dependency changes**. Check staged files for private credentials. Report each test and cleanup honestly, including any limitation. Page change needs publishing; do not publish automatically.
