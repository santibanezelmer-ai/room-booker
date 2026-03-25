import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEstablishmentSettings() {
  return useQuery({
    queryKey: ["establishment_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("establishment_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateEstablishmentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { logo_url?: string; name?: string }) => {
      const { data: existing } = await supabase
        .from("establishment_settings")
        .select("id")
        .limit(1)
        .maybeSingle();
      
      if (existing) {
        const { error } = await supabase
          .from("establishment_settings")
          .update(updates)
          .eq("id", existing.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["establishment_settings"] }),
  });
}
