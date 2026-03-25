import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, School } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SchoolSearch({ value, onChange }) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowList(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchSchools = async (q) => {
    if (!q || q.length < 3) { setResults([]); setShowList(false); return; }
    setLoading(true);
    setSearched(false);

    try {
      // Urban Institute Education Data API — NCES Common Core of Data
      const res = await fetch(
        `https://educationdata.urban.org/api/v1/schools/ccd/directory/?search=${encodeURIComponent(q)}&year=2021&level_of_schooling=2,3&per_page=30`
      );
      const data = await res.json();
      const schools = (data.results || []).map(s => ({
        name: s.school_name,
        city: s.city_location,
        state: s.state_code,
      }));
      setResults(schools);
      setShowList(schools.length > 0);
      setSearched(true);
    } catch (e) {
      setResults([]);
      setSearched(true);
    }

    setLoading(false);
  };

  const handleInput = (e) => {
    const q = e.target.value;
    setQuery(q);
    onChange(q); // allow manual entry
    setShowList(false);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchSchools(q), 500);
  };

  const handleSelect = (school) => {
    const fullName = school.name;
    setQuery(fullName);
    onChange(fullName);
    setShowList(false);
    setResults([]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
        <Input
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setShowList(true)}
          placeholder="Type your school name to search..."
          className="h-11 pl-9 pr-9"
        />
      </div>

      {showList && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 border border-border rounded-xl bg-card shadow-xl max-h-60 overflow-y-auto z-50">
          {results.map((school, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(school)}
              className={cn(
                "w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-3",
                query === school.name && "bg-primary/10 text-primary font-medium"
              )}
            >
              <School className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium text-foreground">{school.name}</p>
                <p className="text-xs text-muted-foreground">{school.city}, {school.state}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {searched && results.length === 0 && query.length >= 3 && !loading && (
        <p className="text-xs text-muted-foreground mt-1 px-1">No schools found — your typed name will be used.</p>
      )}
    </div>
  );
}