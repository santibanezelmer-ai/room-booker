import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useReservations(dateRange?: { from: string; to: string }) {
  const { role, user } = useAuth();
  
  return useQuery({
    queryKey: ["reservations", role, user?.id, dateRange],
    queryFn: async () => {
      let query = supabase.from("reservations").select("*, profiles(full_name, email)");
      
      if (dateRange) {
        query = query.gte("reservation_date", dateRange.from).lte("reservation_date", dateRange.to);
      }
      
      const { data, error } = await query.order("reservation_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (reservation: {
      reservation_date: string;
      block_start: number;
      block_end: number;
      course_name: string;
      observation?: string;
    }) => {
      const { data, error } = await supabase
        .from("reservations")
        .insert({ ...reservation, teacher_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
  });
}

export function useUpdateReservationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status: string; admin_notes?: string }) => {
      const { error } = await supabase
        .from("reservations")
        .update({ status, admin_notes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
  });
}
