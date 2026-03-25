import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, School } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SchoolSearch({ value, onChange }) {
  const [location, setLocation] = useState("");
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);
  const [searched, setSearched] = useState(false);

  const searchSchools = async () => {
    if (!location.trim()) return;
    setLoading(true);
    setShowList(false);
    setSearched(false);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `List all middle schools and high schools (grades 6-12) in ${location.trim()}, USA.
Include public schools, private schools, charter schools, and magnet schools.
Return only school names as an array. Include at least 15-30 schools if available.`,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          schools: { type: "array", items: { type: "string" } }
        }
      }
    });

    setSchools(result.schools || []);
    setShowList(true);
    setSearched(true);
    setLoading(false);
  };

  const filtered = schools.filter(s =>
    !value || s.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Location search row */}
      <div className="flex gap-2">
        <Input
          value={location}
          onChange={e => setLocation(e.target.value)}
          onKeyDown={e => e.key === "Enter" && searchSchools()}
          placeholder="Enter your city & state (e.g. Austin, TX)"
          className="h-11"
        />
        <Button
          type="button"
          variant="outline"
          onClick={searchSchools}
          disabled={loading || !location.trim()}
          className="shrink-0 gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </Button>
      </div>

      {/* Manual school name input */}
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setShowList(schools.length > 0); }}
        placeholder="Type or select your school name..."
        className="h-11"
      />

      {/* School dropdown */}
      {showList && filtered.length > 0 && (
        <div className="border border-border rounded-xl bg-card shadow-lg max-h-56 overflow-y-auto z-10 relative">
          {filtered.map((school, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onChange(school); setShowList(false); }}
              className={cn(
                "w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2",
                value === school && "bg-primary/10 text-primary font-medium"
              )}
            >
              <School className="w-4 h-4 text-muted-foreground shrink-0" />
              {school}
            </button>
          ))}
        </div>
      )}

      {searched && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground px-1">No schools found. Type your school name manually above.</p>
      )}
    </div>
  );
}