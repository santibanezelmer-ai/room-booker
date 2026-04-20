import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useReservations(dateRange?: { from: string; to: string }) {
  const { role, user } = useAuth();

  return useQuery({
    queryKey: ["reservations", role, user?.id, dateRange],
    queryFn: async () => {
      let query = supabase.from("reservations").select("*");

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

// Public hook: only approved reservations, no auth required.
export function usePublicReservations(dateRange?: { from: string; to: string }) {
  return useQuery({
    queryKey: ["public_reservations", dateRange],
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select("id, reservation_date, block_start, block_end, course_name, observation, status, teacher_id, cancellation_reason");

      if (dateRange) {
        query = query.gte("reservation_date", dateRange.from).lte("reservation_date", dateRange.to);
      }

      const { data, error } = await query.order("reservation_date", { ascending: true });
      if (error) throw error;
      return data;
    },
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
      class_objective: string;
      observation?: string;
      recurrence_group_id?: string | null;
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

export function useCreateRecurringReservations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      dates: string[];
      block_start: number;
      block_end: number;
      course_name: string;
      class_objective: string;
      observation?: string;
    }) => {
      const groupId = crypto.randomUUID();
      const rows = payload.dates.map((d) => ({
        teacher_id: user!.id,
        reservation_date: d,
        block_start: payload.block_start,
        block_end: payload.block_end,
        course_name: payload.course_name,
        class_objective: payload.class_objective,
        observation: payload.observation || null,
        recurrence_group_id: groupId,
      }));
      const { data, error } = await supabase.from("reservations").insert(rows).select();
      if (error) throw error;
      return { groupId, data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
  });
}

export function useUpdateReservationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      admin_notes,
    }: {
      id: string;
      status: string;
      admin_notes?: string;
    }) => {
      const { error } = await supabase
        .from("reservations")
        .update({ status, admin_notes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["public_reservations"] });
    },
  });
}

// Approve all reservations in a recurrence group at once (admin)
export function useApproveRecurrenceGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase
        .from("reservations")
        .update({ status: "approved" })
        .eq("recurrence_group_id", groupId)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["public_reservations"] });
    },
  });
}

// Admin: release an approved reservation (mark as cancelled_by_admin with reason)
export function useReleaseReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("reservations")
        .update({
          status: "cancelled_by_admin",
          cancellation_reason: reason,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["public_reservations"] });
    },
  });
}

// Teacher: edit own pending reservation
export function useUpdateOwnReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        reservation_date: string;
        block_start: number;
        block_end: number;
        course_name: string;
        class_objective: string;
        observation: string | null;
      }>;
    }) => {
      const { error } = await supabase.from("reservations").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
  });
}

// Teacher: cancel (delete) own pending reservation
export function useDeleteOwnReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reservations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
  });
}
