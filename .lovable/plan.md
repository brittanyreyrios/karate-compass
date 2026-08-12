# Round 13 — Technique library, jiu jitsu programme, jiu jitsu leaderboard

Round 12 has landed and programmes are populated: Karate (9 classes), Jiu Jitsu & Wrestling (3 — Kid's Jiu Jitsu, Adult Jiu Jitsu & Wrestling, Adult Striking), Tai Chi (1). Entitlement can therefore be resolved off `class_schedules.program_id` as specified.

## AU — The technique library

### AU1 `technique_library`
New table, deliberately separate from `curriculum_items` so nothing here can touch `get_curriculum_for_student`:

`program_id` (FK → programs), `label` text ("Jiu Jitsu" / "Wrestling", display + filter only), `title`, `category`, `difficulty` (nullable label), `video_youtube_id`, `video_title`, `video_seconds`, `notes`, `published` (default false), `sort_order`, `belt_rank_id` (nullable FK, created and then left alone — AU4), `created_at`/`updated_at` with the existing update trigger.

Grants: `authenticated` and `service_role` only, no `anon`. RLS: admins read/write everything; families never read the table directly — see below.

### AU2 Entitlement, server-side
One function, `get_technique_library()`, in the same shape as `get_curriculum_for_all_children`: `SECURITY DEFINER`, `STABLE`, `SET search_path = public`, `REVOKE` from `anon`/`public`, `GRANT EXECUTE` to `authenticated`, `service_role`.

Logic: the parent is `auth.uid()`; it returns published items whose `program_id` matches a programme of any class one of that parent's students is enrolled in via `student_classes`. Admins additionally get drafts (flagged in a returned `published` column so the UI can mark them). No client-side filtering, and the family RLS policy on the table stays admin-only so the browser has no other path to the rows.

Because jiu jitsu and wrestling are one programme, both label groups are returned together; there is no age split; karate-only families get zero rows.

### AU3 Pages
- **Parent:** new route `/techniques`, sidebar entry "Technique Library". Grouped by category, difficulty rendered as a tag, and a Jiu Jitsu / Wrestling filter driven by `label`. Videos use the existing `VideoFacade`, so nothing loads from Google before a click. The route and the sidebar entry are hidden entirely when the function returns no entitled published items.
- **Admin:** a new tab in the admin content tabs — add, edit, publish/unpublish, and up/down reorder buttons reusing the curriculum admin's keyboard-operable pattern (real buttons, atomic `sort_order` swap).

## AV — Jiu jitsu as a beltless system

Follows the verified tai chi pattern: a `jiu_jitsu` belt system with `uses_belts = false` and one level row.

Assignment scope: active students enrolled **only** in Jiu Jitsu & Wrestling classes **and** currently `belt_rank_id IS NULL`. Checked against live data: there are currently **zero** rankless students, so the migration will assign **0** students today — the system and level exist ready for the next jiu-jitsu-only signup, and the assignment statement is written idempotently so it also covers anyone imported later. The one jiu-jitsu-only student on the roster (Kid's Jiu Jitsu) already holds a karate solid belt and is deliberately left untouched.

`uses_belts = false` already drives `LevelChip` instead of a belt graphic and suppresses the progress strip (Round 10 AK3); I will confirm both on a jiu jitsu level rather than assume.

## AW — Sixth leaderboard division

Add `jiu_jitsu` to `leaderboard_divisions` (sort order after the existing five).

`division_of` keeps its branch order exactly: null rank → NULL (first, untouched), then teen/adult class → `teen_adult`, then the belt-system branches with `jiu_jitsu` added. A dual-programme child keeps their karate belt and so stays on their karate board — one student, one board.

`get_leaderboard` is rewritten with the bounds CTE, `active = true`, the `> 0` filter, `LIMIT 10` and this line intact:

```sql
ELSE upper(left(btrim(st.last_name), 1)) || '.' END,
```

## Verification (real project, read-mostly)

Preview and production share one database, so: I read freely, create only clearly-labelled test rows and delete them after, and modify **no** existing record — no testing dates, announcements, students, enrollments, points or attendance.

- Every new/changed function executed and its output reported.
- Entitlement proved for three cases — karate-only, jiu-jitsu-only, and a child in both — by calling the function as those parents.
- A draft test item shown invisible to families and visible to admin.
- All six division keys called; truncation line quoted from the shipped SQL.
- 360px check on the new parent page and admin tab.

## What this excludes

- **A jiu-jitsu-only child's dashboard:** the level chip ("Jiu Jitsu") where the belt graphic would be, no "Road to Black Belt" strip, no belt-progress percentage, and no karate curriculum. Next-test-date, attendance, points and class schedule all behave as normal. There is no jiu jitsu grading ladder, so nothing shows progress toward a next rank.
- **A library item whose programme is deleted:** the `program_id` FK will be `ON DELETE RESTRICT`, so a programme with library items cannot be deleted until they are moved or removed — the admin gets a clear error instead of items silently becoming invisible to every family.
- Mapping techniques to jiu jitsu belts (`belt_rank_id` stays empty), per-programme point pools, an age split in the library, and any change to karate belts, curriculum or the existing five divisions.
