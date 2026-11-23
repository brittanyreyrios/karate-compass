# Weekly parent dashboard usage

## Scope — wait for approval
One table, two functions, one dashboard effect, one staff text line, one privacy sentence. No new pages/dependencies or existing-policy changes. Only plan/roadmap edited; wait for approval.

## Reporting choices
- Monday–Sunday, America/Chicago; exclude the current and partial deployment weeks. Save the deployment day in the new table's comment, not an extra table/column/function. If deployed November 23–29, first measured week is November 30–December 6; first report December 7. Fully observed weeks with no visits count as zero; fixture visits do not establish the measurement start.
- Return up to eight measured weeks, newest first. “Not enough data yet” until one finishes. Four-week average means the latest **four** weekly percentages; show “—” until four exist. Zero eligible parents produces NULL, displayed as “—”, not 0%.
- Numerator: distinct non-fixture accounts opening that week. Denominator: your current eligibility count, one per account. Eligibility changes can produce percentages above 100%; do not cap them or substitute a historical denominator.
- Exclude verified permanent fixture IDs and the `zz.test.*` email namespace. Log the negative fixture for testing but exclude it from totals.
- One fire-and-forget dashboard effect; no logging call on staff pages. An admin visiting the shared dashboard is ignored by the function. Neither returned errors nor rejected requests affect families.

## Full SQL for approval
Apply with the platform migration tool into `drizzle/migrations/`, never frozen `supabase/migrations/`. Authenticated SELECT plus RLS gives parents zero rows; no direct parent writes. Caller identity is `auth.uid()`.

```sql
CREATE TABLE public.parent_activity_days (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  PRIMARY KEY (profile_id, activity_date)
);
REVOKE ALL ON TABLE public.parent_activity_days FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.parent_activity_days TO authenticated;
GRANT ALL ON TABLE public.parent_activity_days TO service_role;
ALTER TABLE public.parent_activity_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can select parent activity days"
ON public.parent_activity_days FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Deployment-day metadata avoids inventing pre-measurement zero weeks.
DO $block$
BEGIN
  EXECUTE format(
    'COMMENT ON TABLE public.parent_activity_days IS %L',
    jsonb_build_object('measurement_started_on',
      (now() AT TIME ZONE 'America/Chicago')::date)::text
  );
END;
$block$;

CREATE FUNCTION public.log_dashboard_open()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL
     OR COALESCE(public.has_role(v_user, 'admin'::public.app_role), false)
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = v_user AND p.archived_at IS NULL
     ) THEN
    RETURN;
  END IF;
  INSERT INTO public.parent_activity_days(profile_id, activity_date)
  VALUES (v_user, (now() AT TIME ZONE 'America/Chicago')::date)
  ON CONFLICT (profile_id, activity_date) DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION public.log_dashboard_open() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.log_dashboard_open() TO authenticated;

CREATE FUNCTION public.get_weekly_active_parents(_weeks int DEFAULT 8)
RETURNS TABLE(week_start date, active_parents int, eligible_parents int, pct numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_this_week date := date_trunc('week', now() AT TIME ZONE 'America/Chicago')::date;
  v_started date := (obj_description('public.parent_activity_days'::regclass, 'pg_class')::jsonb
    ->> 'measurement_started_on')::date;
  v_first_week date := date_trunc('week', v_started::timestamp)::date + 7;
BEGIN
  IF auth.uid() IS NULL
     OR NOT COALESCE(public.has_role(auth.uid(), 'admin'::public.app_role), false) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF _weeks IS NULL OR _weeks < 1 THEN
    RAISE EXCEPTION 'Weeks must be a positive integer';
  END IF;
  RETURN QUERY
  WITH non_fixture_profiles AS (
    SELECT p.* FROM public.profiles p
    WHERE lower(p.email) NOT LIKE 'zz.test.%'
      AND p.id NOT IN (
        '57a7e312-d3cb-40bf-bd89-940a516cadfd'::uuid,
        '44a1b1c7-c9cd-4192-8717-8c137e5d3c9a'::uuid,
        'd9db9608-b5d0-44f9-bbd4-b44514459708'::uuid,
        'a7d03379-1c50-4517-9267-2f2573a46d41'::uuid
      )
  ), eligible AS (
    SELECT count(*)::int AS total FROM non_fixture_profiles p
    WHERE p.archived_at IS NULL
      AND NOT public.has_role(p.id, 'admin'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.student_guardians g
        JOIN public.students s ON s.id = g.student_id
        WHERE g.profile_id = p.id AND s.active = true AND s.parent_id IS NOT NULL
      )
  ), weeks AS (
    SELECT v_this_week - (n * 7) AS starts
    FROM generate_series(1, _weeks) AS series(n)
    WHERE v_this_week - (n * 7) >= v_first_week
  ), activity AS (
    SELECT w.starts, count(DISTINCT d.profile_id)::int AS total
    FROM weeks w
    LEFT JOIN public.parent_activity_days d
      ON d.activity_date >= w.starts AND d.activity_date < w.starts + 7
      AND EXISTS (SELECT 1 FROM non_fixture_profiles p WHERE p.id = d.profile_id)
    GROUP BY w.starts
  )
  SELECT a.starts, a.total, e.total,
    round(100.0 * a.total / nullif(e.total, 0), 1)
  FROM activity a CROSS JOIN eligible e
  ORDER BY a.starts DESC;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_weekly_active_parents(int) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_weekly_active_parents(int) TO authenticated;
```

## Exact application code diff for approval
Proposed only. Existing imports reused; no new hook/component file. Privacy date unchanged; one sentence added.

```diff
--- a/src/routes/_authenticated/index.tsx
+++ b/src/routes/_authenticated/index.tsx
@@ -112,6 +112,10 @@
 
 function Dashboard() {
   const qc = useQueryClient();
+
+  useEffect(() => {
+    void supabase.rpc("log_dashboard_open").then(() => {}, () => {});
+  }, []);
 
   const profileQ = useQuery({
     queryKey: ["profile-me"],
--- a/src/routes/_authenticated/admin.tsx
+++ b/src/routes/_authenticated/admin.tsx
@@ -329,6 +329,24 @@
 ];
 
 function AdminPage() {
+  const activityQ = useQuery({
+    queryKey: ["weekly-active-parents"],
+    queryFn: async () => {
+      const { data, error } = await supabase.rpc("get_weekly_active_parents", { _weeks: 8 });
+      if (error) throw error;
+      return data ?? [];
+    },
+  });
+  const activityWeeks = activityQ.data ?? [];
+  const lastWeek = activityWeeks[0];
+  const fourWeeks = activityWeeks.slice(0, 4);
+  const fourWeekAverage = fourWeeks.length === 4 && fourWeeks.every((week) => week.pct !== null)
+    ? (fourWeeks.reduce((sum, week) => sum + Number(week.pct), 0) / 4).toFixed(1) + "%"
+    : "—";
+  const activityText = activityQ.isPending ? "Loading parent activity…"
+    : activityQ.isError ? "Parent activity unavailable"
+    : !lastWeek ? "Not enough data yet"
+    : `Parents active last week: ${lastWeek.active_parents} of ${lastWeek.eligible_parents} (${lastWeek.pct === null ? "—" : Number(lastWeek.pct).toFixed(1) + "%"}) · 4-week average: ${fourWeekAverage}`;
 
   const [tab, setTab] = useState("attendance");
   const [consentOnly, setConsentOnly] = useState(false);
@@ -348,6 +366,7 @@
           <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
             Staff <span className="text-gradient-red">Dashboard</span>
           </h1>
+          <p className="mt-2 text-sm text-muted-foreground">{activityText}</p>
         </div>
       </header>
 
--- a/src/routes/privacy-policy.tsx
+++ b/src/routes/privacy-policy.tsx
@@ -88,6 +88,7 @@
         </div>
 
         <Section n={1} title="Information We Collect">
+          <p>The Portal records the date a parent account opens the dashboard to measure usage, but this measurement does not record location, device, or pages viewed.</p>
           <p className="font-semibold text-foreground">Account holder (parent/guardian):</p>
           <Bullets
             items={[
```

## Fixture tests after approval
Add an opt-in integration test beside existing tests. Private sessions under `/tmp/browser/`; exact negative-parent/zzstaff identity guards. No signup, invite use, real-family testing, or child edits. Report separately:
- **a:** Parent opens dashboard twice in one Chicago day; staff read confirms exactly one row.
- **b:** Staff opens dashboard: no row. Staff-page visit: no logging request.
- **c:** Parent direct table SELECT: zero rows despite a's existing row.
- **d:** Parent summary RPC: admin-only refusal.
- **e:** Staff summary succeeds, fixtures excluded. Initially it correctly returns no finished measured weeks. For nonempty aggregation testing, temporarily backdate **only this new table's deployment comment** five weeks and insert historical rows for the negative fixture through privileged test tools. Expect finished weeks with zero active parents despite those rows, and denominator matching an independent eligibility aggregate. Restore the exact comment and remove fixture rows in `finally`. Never change the clock or log a real parent for a test.

Also check Chicago Monday boundaries, partial weeks, NULL percentage, four-week arithmetic, and desktop/mobile display.

## Cleanup/readback/scan
Remove fixture rows only; restore comment; preserve real rows/fixtures. Read back key/RLS/policy/grants/functions/EXECUTE and compare existing policies. Quick scan: new versus existing, no dismissals. Report `package.json`/`bun.lock`: **no dependency changes** expected; check no credentials committed. No migration/tests/scan before approval.
