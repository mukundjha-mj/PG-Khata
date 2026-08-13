import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePropertyScope } from "@/lib/property-scope";
import { Button } from "@/components/ui/button";

/**
 * Row of property buttons that scopes the whole app. Renders nothing for a
 * single-property owner - there is nothing to switch between.
 */
export function PropertyScopeSwitcher() {
  const { selectedPropertyId, setSelectedPropertyId } = usePropertyScope();
  const { data: properties } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  if (!properties || properties.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant={selectedPropertyId === null ? "default" : "outline"}
        onClick={() => setSelectedPropertyId(null)}
      >
        All
      </Button>
      {properties.map((p) => (
        <Button
          key={p.id}
          size="sm"
          variant={selectedPropertyId === p.id ? "default" : "outline"}
          onClick={() => setSelectedPropertyId(p.id)}
        >
          {p.name}
        </Button>
      ))}
    </div>
  );
}
