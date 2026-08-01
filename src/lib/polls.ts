import { supabase } from "@/integrations/supabase/client";

export type Poll = {
  id: string;
  question: string;
  description: string | null;
  anonymous: boolean;
  respond_per: string;
  multi_select: boolean;
  closes_at: string | null;
  results_visible: string;
  published: boolean;
  created_at: string;
};

export type PollOption = {
  id: string;
  poll_id: string;
  label: string;
  sort_order: number;
};

export type PollVote = {
  id: string;
  poll_id: string;
  option_id: string;
  profile_id: string;
  student_id: string | null;
};

export type PollResult = {
  option_id: string;
  label: string;
  vote_count: number;
};

export const POLL_SELECT =
  "id, question, description, anonymous, respond_per, multi_select, closes_at, results_visible, published, created_at";

export function isPollClosed(poll: Poll): boolean {
  return !!poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now();
}

export function resultsVisibleLabel(value: string): string {
  switch (value) {
    case "always":
      return "Results always visible";
    case "after_vote":
      return "Results after voting";
    case "admins_only":
      return "Results for staff only";
    default:
      return "Results after voting closes";
  }
}

export function privacyNotice(poll: Poll): string {
  return poll.anonymous
    ? "Responses are anonymous — only totals are shown."
    : "Your response is visible to Tiger's Den staff.";
}

export async function fetchPollResults(pollId: string): Promise<PollResult[]> {
  const { data, error } = await supabase.rpc("get_poll_results", { _poll_id: pollId });
  if (error) throw error;
  return (data ?? []) as PollResult[];
}
