# Attendance single-funnel correction

## Scope

No migration or database changes. Modify only the attendance client helper and the existing admin route.

## Implementation

1. Add `src/lib/attendance.ts` as the single attendance mutation funnel.
   - Accept `studentId`, a freshly read `currentAttendance`, and a signed `delta`.
   - Clamp the resulting counter at zero and calculate the actually applied change.
   - For an increase, update `students.attendance_count` and insert exactly that many `attendance_events` rows dated today with the acting admin as `created_by`.
   - For a decrease, select the requested number of that student’s newest event IDs ordered by `occurred_on DESC, created_at DESC`, lower the counter only by the number actually removable, and delete those exact rows.
   - For zero applied change, perform no writes.
   - Return the applied delta and new total so callers can invalidate and report consistently.

2. Refactor the roster check-in mutation in `src/routes/_authenticated/admin.tsx`.
   - Replace its direct counter update and event insert with the new funnel using `delta: 1`.
   - Preserve the existing `consecutive_absences: 0` reset as a separate field update; it is not part of attendance accounting.

3. Refactor `StudentEditRow` in the same route.
   - Capture `const [attendanceBaseline] = useState(student.attendance_count)` once beside the attendance input state; never re-sync it.
   - Remove `attendance_count` from the ordinary student update payload.
   - Calculate `entered - attendanceBaseline`; if nonzero, freshly read `students.attendance_count`, then pass that fresh value and the delta to the attendance funnel.
   - If unchanged, do not read or write attendance data. This ensures a roster check-in made while the form is open survives and produces no correcting row.
   - Invalidate the existing admin student cache and the dashboard attendance cache after a correction.

## Verification and requested evidence

1. Check the latest build diagnostics and run focused type/build validation supplied by the harness.
2. Grep every `students.attendance_count` write in `src/`; expect only the new funnel.
3. Use a real test student through the admin UI/database and preserve their original state after testing where practical:
   - Raise attendance by 3 via Edit Student; output the resulting counter and the complete ordered attendance event rows.
   - Lower it by 2; output the resulting counter and complete rows again, proving the two newest rows were removed.
   - Save a name/belt-only change and prove the event row count does not change.
   - Open the edit form, perform a roster check-in, then save without changing attendance; prove the increment and one event survive with no extra event.
4. Open the parent dashboard for the test student and compare its rendered current-year attendance total with the database count for current-year `attendance_events` after correction.
5. Report `git diff --stat`, the full new `attendance.ts`, the final edit-form save mutation, grep output, and the requested before/after database evidence.

## Safety note

The existing browser-side two-step counter/log behavior cannot be fully transactional without a database function, which this request explicitly excludes. The funnel centralizes behavior and throws on any failed operation without inventing negative attendance records.
