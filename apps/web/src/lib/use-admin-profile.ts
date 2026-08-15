import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdminProfile = {
  name: string;
  email: string;
  phone: string | null;
};

/** The signed-in owner's account details, editable on the Settings page. */
export function useAdminProfile() {
  return useQuery({
    queryKey: ["admin-profile"],
    queryFn: async (): Promise<AdminProfile | null> => {
      const { data, error } = await supabase
        .from("admins")
        .select("name, email, phone")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
