import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notifyReservationEmail } from "@/hooks/useNotificationSettings";


// Private notes (observation / admin_notes) live in reservation_notes and are only
// readable by the owning teacher or an admin.
function flattenNotes(rows: any[]): any[] {
  return (rows || []).map((r: any) => {
    const notes = Array.isArray(r.reservation_notes) ? r.reservation_notes[0] : r.reservation_notes;
    const { reservation_notes, ...rest } = r;
    return {
      ...rest,
      observation: notes?.observation ?? null,
      admin_notes: notes?.admin_notes ?? null,
    };
  });
}

async function upsertNotes(reservationId: string, patch: { observation?: string | null; admin_notes?: string | null }) {
  const { error } = await supabase
    .from("reservation_notes")
    .upsert({ reservation_id: reservationId, ...patch }, { onConflict: "reservation_id" });
  if (error) throw error;
}

export function useReservations(dateRange?: { from: string; to: string }) {
  const { role, user } = useAuth();

  return useQuery({
    queryKey: ["reservations", role, user?.id, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select("*, reservation_notes(observation, admin_notes)");

      if (dateRange) {
        query = query.gte("reservation_date", dateRange.from).lte("reservation_date", dateRange.to);
      }

      const { data, error } = await query.order("reservation_date", { ascending: true });
      if (error) throw error;
      return flattenNotes(data as any[]);
    },
    enabled: !!user,
  });
}

// Public hook: only approved reservations, no auth required.
// Uses public_reservations view which exposes teacher_name (not teacher_id).
export function usePublicReservations(dateRange?: { from: string; to: string }) {
  return useQuery({
    queryKey: ["public_reservations", dateRange],
    queryFn: async () => {
      let query = (supabase as any)
        .from("public_reservations")
        .select("id, reservation_date, block_start, block_end, course_name, class_objective, status, cancellation_reason, teacher_name");

      if (dateRange) {
        query = query.gte("reservation_date", dateRange.from).lte("reservation_date", dateRange.to);
      }

      const { data, error } = await query.order("reservation_date", { ascending: true });
      if (error) throw error;
      return data as any[];
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
      const { observation, ...rest } = reservation;
      const { data, error } = await supabase
        .from("reservations")
        .insert({ ...rest, teacher_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      if (observation) await upsertNotes(data.id, { observation });
      void notifyReservationEmail(data.id, "new_request");
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
        recurrence_group_id: groupId,
      }));
      const { data, error } = await supabase.from("reservations").insert(rows).select();
      if (error) throw error;
      if (payload.observation && data?.length) {
        const { error: notesError } = await supabase
          .from("reservation_notes")
          .upsert(
            data.map((r: any) => ({ reservation_id: r.id, observation: payload.observation })),
            { onConflict: "reservation_id" }
          );
        if (notesError) throw notesError;
      }
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
      admin_notes?: string | null;
    }) => {
      const { error } = await supabase
        .from("reservations")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      if (admin_notes !== undefined) {
        await upsertNotes(id, { admin_notes: admin_notes || null });
      }
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
      const { observation, ...rest } = updates;
      if (Object.keys(rest).length > 0) {
        const { error } = await supabase.from("reservations").update(rest).eq("id", id);
        if (error) throw error;
      }
      if (observation !== undefined) {
        await upsertNotes(id, { observation: observation || null });
      }
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

// Teacher: edit only the class_objective of own reservation (pending or approved).
// Useful for recurring reservations where each occurrence may have a different objective.
export function useUpdateReservationObjective() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, objective }: { id: string; objective: string }) => {
      const trimmed = (objective ?? "").trim();
      if (!trimmed) throw new Error("Objective cannot be empty");
      if (trimmed.length > 500) throw new Error("Objective too long (max 500)");
      const { error } = await supabase
        .from("reservations")
        .update({ class_objective: trimmed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["public_reservations"] });
    },
  });
}
