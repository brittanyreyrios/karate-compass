# Manage Students search box — proposed diff (awaiting approval)

UI-only. No database, policy or dependency changes. Only the Manage Students
section of `src/routes/_authenticated/admin.tsx` changes, plus one export
keyword in `src/components/admin-tournament-bulk.tsx` so the exact same search
normaliser is reused instead of copied.

## How it works

- `useAdminProfiles()` is already used by the roster rows (shared React Query
  cache key `admin-profiles`), so calling it in `ManageStudentsTab` adds **no
  new database query** — it reads the same cached profiles.
- Primary guardian name = the profile whose `id` matches `student.parent_id`.
- The search term filters the already-loaded `visibleStudents` list in the
  browser, combined with (not instead of) the existing toggle filters.
- Matching reuses the tournament bulk-entry normaliser (`trim`, lowercase,
  collapse whitespace) and checks first name, last name, full name and
  guardian name with `includes` (partial match).
- Search state lives in `ManageStudentsTab`, so leaving the tab unmounts it
  and the text resets automatically.
- Input: `h-11` (44px), `text-base` (16px — no iPhone zoom), full width,
  clear (×) button, result count, "No students match" empty state.

## Diff 1 — src/components/admin-tournament-bulk.tsx (export only)

```diff
-const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
+export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
```

## Diff 2 — src/routes/_authenticated/admin.tsx (Manage Students only)

Import the shared normaliser (added to the existing admin-tournament-bulk
import line, or a new line if none exists):

```diff
+import { norm } from "@/components/admin-tournament-bulk";
```

State and guardian-name lookup, next to the existing filter state:

```diff
   const [claimFilter, setClaimFilter] = useState<"all" | "claimed" | "unclaimed">("all");
+  const [search, setSearch] = useState("");
   const allStudents = studentsQ.data ?? [];
+  // Same cache key as the roster rows — no new query, just the shared profiles.
+  const { data: profiles } = useAdminProfiles();
+  const guardianNameById = useMemo(() => {
+    const m = new Map<string, string>();
+    for (const p of profiles ?? []) m.set(p.id, p.family_name || p.email);
+    return m;
+  }, [profiles]);
```

Extend the existing filter (search ANDs with the toggles):

```diff
-  const visibleStudents = activeStudents.filter(
-    (s) =>
-      (!noRankOnly || !s.belt_rank_id) &&
-      (!noClassOnly || !byStudent.get(s.id)?.length) &&
-      (!mismatchOnly || mismatchIds.has(s.id)) &&
-      (claimFilter === "all" || (claimFilter === "unclaimed") === (s.parent_id === null)),
-  );
+  const term = norm(search);
+  const visibleStudents = activeStudents.filter(
+    (s) =>
+      (!noRankOnly || !s.belt_rank_id) &&
+      (!noClassOnly || !byStudent.get(s.id)?.length) &&
+      (!mismatchOnly || mismatchIds.has(s.id)) &&
+      (claimFilter === "all" || (claimFilter === "unclaimed") === (s.parent_id === null)) &&
+      (!term ||
+        norm(s.first_name).includes(term) ||
+        norm(s.last_name).includes(term) ||
+        norm(`${s.first_name} ${s.last_name}`).includes(term) ||
+        (s.parent_id !== null &&
+          norm(guardianNameById.get(s.parent_id) ?? "").includes(term))),
+  );
```

Search box + count, placed directly above the existing filter buttons
(`<div className="mt-4 flex flex-wrap items-center gap-3">`):

```diff
+          <div className="mt-4">
+            <div className="relative">
+              <Input
+                className="h-11 w-full pr-10 text-base"
+                placeholder="Search student or guardian name"
+                value={search}
+                onChange={(e) => setSearch(e.target.value)}
+                aria-label="Search students"
+              />
+              {search !== "" && (
+                <button
+                  type="button"
+                  aria-label="Clear search"
+                  onClick={() => setSearch("")}
+                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
+                >
+                  <X className="h-4 w-4" aria-hidden="true" />
+                </button>
+              )}
+            </div>
+            <p className="mt-1.5 text-xs text-muted-foreground">
+              {visibleStudents.length} of {activeStudents.length} students
+            </p>
+          </div>
+
           <div className="mt-4 flex flex-wrap items-center gap-3">
```

Empty-state wording when a search/filter hides everything:

```diff
             {!studentsQ.isLoading && activeStudents.length > 0 && visibleStudents.length === 0 && (
               <p className="text-sm text-muted-foreground">
-                No active students match this filter. Nothing to fix here.
+                {term ? "No students match" : "No active students match this filter. Nothing to fix here."}
               </p>
             )}
```

`X` is already imported from lucide-react in this file (used elsewhere);
if not, it is added to the existing lucide import line.

## Tests (zzstaff fixture only, no real student edits)

a. Search permanent zz.test.negative child by first name → row shown, count updates.
b. Partial last name (e.g. "mat") → same child found.
c. Guardian name → child found.
d. Search + "No belt rank set" style toggle together → both apply.
e. Clear (×) → full list and count restored; mobile-width check (full width, 44px, 16px font).

## Report will include

- Each test result separately.
- package.json / bun.lock diff: expected "no dependency changes".
- No tracked credentials.
