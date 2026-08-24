import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NotificationSettings {
  id: string;
  notify_new_request: boolean;
  notify_approved: boolean;
  notify_rejected: boolean;
  notify_released: boolean;
  admin_emails: string[];
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: ["notification_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as NotificationSettings | null;
    },
  });
}

export function useUpdateNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Omit<NotificationSettings, "id">>) => {
      const { data: existing } = await supabase
        .from("notification_settings")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("notification_settings")
          .update(updates)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notification_settings").insert(updates as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification_settings"] }),
  });
}

export function useNotificationLog() {
  return useQuery({
    queryKey: ["notification_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });
}

export type ReservationEmailEvent = "new_request" | "approved" | "rejected" | "released";

// Fire-and-forget: an email failure must never block the reservation flow.
export async function notifyReservationEmail(reservationId: string, event: ReservationEmailEvent) {
  try {
    await supabase.functions.invoke("send-reservation-email", {
      body: { reservation_id: reservationId, event },
    });
  } catch (e) {
    console.error("notifyReservationEmail failed", e);
  }
}
