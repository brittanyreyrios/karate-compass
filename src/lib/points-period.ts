import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * The current Dojo Points period start, read from public.points_period_start().
 * That SQL function is the single definition (two-month Chicago calendar pairs);
 * never compute the boundary in TypeScript.
 */
export function usePointsPeriodStart() {
  return useQuery({
    queryKey: ["points-period-start"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("points_period_start");
      if (error) throw error;
      return data as string; // "YYYY-MM-DD"
    },
  });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Display-only labels derived from the server's period start (no boundary logic). */
export function pointsPeriodLabels(periodStart: string): { range: string; resets: string } {
  const m = Number(periodStart.slice(5, 7)) - 1;
  return {
    range: `${MONTHS[m]}–${MONTHS[(m + 1) % 12]}`,
    resets: `${MONTHS[(m + 2) % 12]} 1`,
  };
}
