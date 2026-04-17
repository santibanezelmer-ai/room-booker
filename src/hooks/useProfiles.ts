import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Public-safe profile data used across the app (e.g. weekly schedule).
// Only exposes user_id and full_name (no email/PII).
export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name");
      if (error) throw error;
      return data;
    },
  });
}

// Public hook (no auth): teacher names for the public read-only schedule.
export function usePublicTeachers() {
  return useQuery({
    queryKey: ["public_teachers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("public_teachers")
        .select("user_id, full_name");
      if (error) throw error;
      return data as { user_id: string; full_name: string }[];
    },
  });
}

// Admin-only hook: full profile rows (RLS restricts to admins).
export function useAdminProfiles() {
  return useQuery({
    queryKey: ["profiles", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
  });
}
