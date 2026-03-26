import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Loader2, School, MapPin, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SchoolSearch({ grade, zipcode, middleSchoolName, highSchoolName, onZipChange, onMiddleSchoolChange, onHighSchoolChange }) {
  const [middleSchools, setMiddleSchools] = useState([]);
  const [highSchools, setHighSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMiddleList, setShowMiddleList] = useState(false);
  const [showHighList, setShowHighList] = useState(false);
  const [zipError, setZipError] = useState(null);
  const debounceRef = useRef(null);

  const lookupZip = async (zip) => {
    if (!/^\d{5}$/.test(zip)) { 
      setMiddleSchools([]);
      setHighSchools([]);
      setShowMiddleList(false);
      setShowHighList(false);
      return;
    }
    setLoading(true);
    setZipError(null);
    try {
      const res = await base44.functions.invoke('lookupSchoolsByZip', { zipcode: zip });
      const list = res.data?.schools || [];
      const middle = list.filter(s => s.school_type === 'middle' || s.school_type === 'middle_high');
      const high = list.filter(s => s.school_type === 'high' || s.school_type === 'middle_high');
      setMiddleSchools(middle);
      setHighSchools(high);
      setShowMiddleList(middle.length > 0);
      setShowHighList(high.length > 0);
      if (middle.length === 0 && high.length === 0) {
        setZipError('No schools found. You can type school names manually below.');
      }
    } catch {
      setZipError('Could not fetch schools. Please type school names manually.');
    }
    setLoading(false);
  };

  const handleZipInput = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
    onZipChange(val);
    onMiddleSchoolChange('');
    onHighSchoolChange('');
    setShowMiddleList(false);
    setShowHighList(false);
    clearTimeout(debounceRef.current);
    if (val.length === 5) {
      debounceRef.current = setTimeout(() => lookupZip(val), 400);
    } else {
      setMiddleSchools([]);
      setHighSchools([]);
      setZipError(null);
    }
  };

  const handleMiddleSelect = (school) => {
    onMiddleSchoolChange(school.school_name);
    setShowMiddleList(false);
  };

  const handleHighSelect = (school) => {
    onHighSchoolChange(school.school_name);
    setShowHighList(false);
  };

  // Determine which schools to show based on grade
  const showMiddle = grade && (grade === 7 || grade === 8);
  const showHigh = grade; // Always show high school once grade is selected

  return (
    <div className="space-y-4">
      {/* Zip Code Input */}
      {grade && (
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
      )}

      {/* Middle School - show if grade 7-8 */}
      {showMiddle && (
        <div>
          <label className="text-sm font-medium mb-2 block">Your middle school</label>
          <div className="relative">
            <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-20" />
            {middleSchools.length > 0 && <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />}
            <Input
              value={middleSchoolName}
              onChange={e => {
                onMiddleSchoolChange(e.target.value);
                if (e.target.value.length > 0) setShowMiddleList(true);
              }}
              onFocus={() => middleSchools.length > 0 && setShowMiddleList(true)}
              placeholder="Type or select your school"
              className="h-11 pl-9 pr-9"
              autoComplete="off"
            />
            {showMiddleList && middleSchools.length > 0 && (
              <div className="absolute top-12 left-0 right-0 border border-border rounded-xl bg-card shadow-lg max-h-48 overflow-y-auto z-30">
                {middleSchools.map((school, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleMiddleSelect(school)}
                    className={cn(
                      "w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex items-center gap-3 border-b border-border last:border-0",
                      middleSchoolName === school.school_name && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <School className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">{school.school_name}</p>
                      <p className="text-xs text-muted-foreground">{school.city}, {school.state}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* High School - show if grade 9-12 */}
      {showHigh && (
        <div>
          <label className="text-sm font-medium mb-2 block">Your high school</label>
          <div className="relative">
            <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-20" />
            {highSchools.length > 0 && <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />}
            <Input
              value={highSchoolName}
              onChange={e => {
                onHighSchoolChange(e.target.value);
                if (e.target.value.length > 0) setShowHighList(true);
              }}
              onFocus={() => highSchools.length > 0 && setShowHighList(true)}
              placeholder="Type or select your school"
              className="h-11 pl-9 pr-9"
              autoComplete="off"
            />
            {showHighList && highSchools.length > 0 && (
              <div className="absolute top-12 left-0 right-0 border border-border rounded-xl bg-card shadow-lg max-h-48 overflow-y-auto z-30">
                {highSchools.map((school, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleHighSelect(school)}
                    className={cn(
                      "w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex items-center gap-3 border-b border-border last:border-0",
                      highSchoolName === school.school_name && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <School className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">{school.school_name}</p>
                      <p className="text-xs text-muted-foreground">{school.city}, {school.state}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hint for user if grade not selected yet */}
      {!grade && (
        <p className="text-sm text-muted-foreground text-center py-4">
          👆 Select your current grade above to find schools
        </p>
      )}
    </div>
  );
}