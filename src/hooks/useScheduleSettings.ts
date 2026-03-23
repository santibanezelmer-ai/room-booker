import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduleSettings {
  id: string;
  start_time: string;
  end_time: string;
  block_duration_minutes: number;
  allow_double_blocks: boolean;
}

export interface TimeBlock {
  number: number;
  startTime: string;
  endTime: string;
}

export function useScheduleSettings() {
  return useQuery({
    queryKey: ["schedule_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data as ScheduleSettings;
    },
  });
}

export function generateBlocks(settings: ScheduleSettings): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  const [startH, startM] = settings.start_time.split(":").map(Number);
  const [endH, endM] = settings.end_time.split(":").map(Number);
  const duration = settings.block_duration_minutes;

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  let blockNum = 1;

  while (currentMinutes + duration <= endMinutes) {
    const sh = Math.floor(currentMinutes / 60);
    const sm = currentMinutes % 60;
    const eh = Math.floor((currentMinutes + duration) / 60);
    const em = (currentMinutes + duration) % 60;
    blocks.push({
      number: blockNum,
      startTime: `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`,
      endTime: `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`,
    });
    blockNum++;
    currentMinutes += duration;
  }
  return blocks;
}
