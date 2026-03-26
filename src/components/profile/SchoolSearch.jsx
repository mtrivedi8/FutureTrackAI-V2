import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Loader2, School, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SchoolSearch({ zipcode, schoolName, onZipChange, onSchoolChange }) {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);
  const [zipError, setZipError] = useState(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  const lookupZip = async (zip) => {
    if (!/^\d{5}$/.test(zip)) { setSchools([]); setShowList(false); return; }
    setLoading(true);
    setZipError(null);
    try {
      const res = await base44.functions.invoke('lookupSchoolsByZip', { zipcode: zip });
      const list = res.data?.schools || [];
      setSchools(list);
      setShowList(list.length > 0);
      if (list.length === 0) setZipError('No schools found for this zip code. You can type your school name manually below.');
    } catch {
      setZipError('Could not fetch schools. Please type your school name manually.');
    }
    setLoading(false);
  };

  const handleZipInput = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
    onZipChange(val);
    onSchoolChange('');
    setShowList(false);
    clearTimeout(debounceRef.current);
    if (val.length === 5) {
      debounceRef.current = setTimeout(() => lookupZip(val), 400);
    } else {
      setSchools([]);
      setZipError(null);
    }
  };

  const handleSelect = (school) => {
    onSchoolChange(school.school_name);
    setShowList(false);
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Zip Code Input */}
      <div>
        <label className="text-sm font-medium mb-2 block">Your zip code</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
          <Input
            value={zipcode}
            onChange={handleZipInput}
            placeholder="Enter your 5-digit zip code"
            className="h-11 pl-9 pr-9"
            maxLength={5}
          />
        </div>
        {zipError && <p className="text-xs text-muted-foreground mt-1">{zipError}</p>}
      </div>

      {/* School Dropdown */}
      {showList && schools.length > 0 && (
        <div className="border border-border rounded-xl bg-card shadow-lg max-h-56 overflow-y-auto">
          {schools.map((school, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(school)}
              className={cn(
                "w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex items-center gap-3 border-b border-border last:border-0",
                schoolName === school.school_name && "bg-primary/10 text-primary font-medium"
              )}
            >
              <School className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium text-foreground">{school.school_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{school.school_type?.replace('_', ' ')} school · {school.city}, {school.state}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Manual school name input */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          School name {schools.length > 0 ? <span className="text-muted-foreground font-normal">(or pick from list above)</span> : ''}
        </label>
        <div className="relative">
          <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={schoolName}
            onChange={e => onSchoolChange(e.target.value)}
            placeholder="Type or confirm your school name"
            className="h-11 pl-9"
          />
        </div>
      </div>
    </div>
  );
}