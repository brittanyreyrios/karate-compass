ALTER TABLE public.class_schedules
  ADD COLUMN IF NOT EXISTS test_announcement_id uuid
    REFERENCES public.announcements(id) ON DELETE SET NULL;

-- CORRECTION to 20260801234754 §3: that file's MANUAL RESTORE STEP block states
-- `public : true` for the album-covers bucket. That is WRONG and superseded by
-- 20260801234844. The bucket is PRIVATE (public: false); covers are served to
-- signed-in users via short-lived signed URLs. See AGENTS.md.
DO $$ BEGIN END $$;