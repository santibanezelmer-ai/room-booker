import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Public-safe profile data used across the app (e.g. weekly schedule).
// Excludes email and other PII so non-admin users can't enumerate it.
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

// Admin-only hook: fetches full profile rows. RLS restricts this to admins,
// so non-admins will get an empty result.
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
