import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduleBlock {
  id: string;
  block_number: number;
  start_time: string;
  end_time: string;
  available_days: number[];
}

export function useScheduleBlocks() {
  return useQuery({
    queryKey: ["schedule_blocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_blocks")
        .select("*")
        .order("block_number", { ascending: true });
      if (error) throw error;
      return data as ScheduleBlock[];
    },
  });
}
