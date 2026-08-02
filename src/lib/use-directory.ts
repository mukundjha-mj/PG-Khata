import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Tenants, rooms, properties and settings - the lookup tables every billing screen needs. */
export function useDirectory() {
  const query = useQuery({
    queryKey: ["directory"],
    queryFn: async () => {
      const [tenants, rooms, properties, settings] = await Promise.all([
        supabase.from("tenants").select("*").order("full_name"),
        supabase.from("rooms").select("*").order("room_number"),
        supabase.from("properties").select("*").order("name"),
        supabase.from("settings").select("*").maybeSingle(),
      ]);
      if (tenants.error) throw tenants.error;
      if (rooms.error) throw rooms.error;
      if (properties.error) throw properties.error;
      if (settings.error) throw settings.error;
      return {
        tenants: tenants.data,
        rooms: rooms.data,
        properties: properties.data,
        settings: settings.data,
      };
    },
  });

  const maps = useMemo(() => {
    const tenants = query.data?.tenants ?? [];
    const rooms = query.data?.rooms ?? [];
    const properties = query.data?.properties ?? [];
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const propertyById = new Map(properties.map((p) => [p.id, p]));
    return {
      tenantById: new Map(tenants.map((t) => [t.id, t])),
      roomById,
      propertyById,
      roomOf: (tenantId: string) => {
        const t = tenants.find((x) => x.id === tenantId);
        return t ? (roomById.get(t.room_id) ?? null) : null;
      },
    };
  }, [query.data]);

  return { ...query, ...maps };
}
