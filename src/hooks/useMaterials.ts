import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMaterials() {
  return useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (material: { name: string; description?: string; quantity_available: number }) => {
      const { error } = await supabase.from("materials").insert(material);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });
}

export function useUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string; quantity_available?: number }) => {
      const { error } = await supabase.from("materials").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });
}
