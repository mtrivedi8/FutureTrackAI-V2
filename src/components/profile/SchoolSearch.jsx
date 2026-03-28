import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Loader2, School, MapPin, ChevronDown, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SchoolSearch({ grade, zipcode, middleSchoolName, highSchoolName, onZipChange, onMiddleSchoolChange, onHighSchoolChange }) {
  const [middleSchools, setMiddleSchools] = useState([]);
  const [highSchools, setHighSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMiddleList, setShowMiddleList] = useState(false);
  const [showHighList, setShowHighList] = useState(false);
  const [zipError, setZipError] = useState(null);
  const [debugSteps, setDebugSteps] = useState([]);
  const [debugMode, setDebugMode] = useState(false);
  const [docStatus, setDocStatus] = useState(null); // null | 'checking' | 'found' | 'harvesting' | 'harvested' | 'not_found'
  const debounceRef = useRef(null);

  // Load debug mode setting on mount
  useEffect(() => {
    const loadDebugMode = async () => {
      const settings = await base44.entities.AppSettings.filter({ key: 'debug_mode' });
      setDebugMode(settings[0]?.value === 'true');
    };
    loadDebugMode().catch(() => setDebugMode(false));
  }, []);

  const addDebugStep = (step) => {
    console.log(step);
    setDebugSteps(prev => [...prev.slice(-4), step]);
  };

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
    setDebugSteps([]);
    try {
      addDebugStep(`⏳ Step 1: Calling lookupSchoolsByZip(${zip})...`);
      const res = await base44.functions.invoke('lookupSchoolsByZip', { zipcode: zip });
      
      addDebugStep(`✅ Step 2: Response status ${res.status}`);
      const list = res.data?.schools || [];
      addDebugStep(`📊 Step 3: Got ${list.length} schools (source: ${res.data?.source || '?'})`);
      
      const middle = list.filter(s => s.school_type === 'middle' || s.school_type === 'middle_high');
      const high = list.filter(s => s.school_type === 'high' || s.school_type === 'middle_high');
      addDebugStep(`🏫 Step 4: Filtered: ${middle.length} middle + ${high.length} high`);
      
      setMiddleSchools(middle);
      setHighSchools(high);
      setShowMiddleList(middle.length > 0);
      setShowHighList(high.length > 0);
      
      if (middle.length === 0 && high.length === 0) {
        addDebugStep(`❌ No results. Try typing school name.`);
        setZipError('No schools found. Try typing the school name manually.');
      } else {
        addDebugStep(`✅ Ready! Select a school below.`);
      }
    } catch (err) {
      addDebugStep(`❌ ERROR: ${err.message}`);
      setZipError(`Error: ${err.message}. Try typing manually.`);
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
    setDebugSteps([]);
    clearTimeout(debounceRef.current);
    if (val.length === 5) {
      debounceRef.current = setTimeout(() => lookupZip(val), 400);
    } else {
      setMiddleSchools([]);
      setHighSchools([]);
      setZipError(null);
    }
  };

  const checkAndHarvestDocs = async (schoolName, zip, city) => {
    setDocStatus('checking');
    try {
      const cached = await base44.entities.SchoolDocumentCache.filter({ school_name: schoolName, zipcode: zip });
      const cache = cached[0];
      const hasData = cache && cache.document_urls && Object.keys(cache.document_urls).length > 0;
      const stillFresh = hasData && cache.expires_at && new Date(cache.expires_at) > new Date();

      if (stillFresh) {
        setDocStatus('found');
        return;
      }

      // Not cached — trigger background harvest (fire-and-forget)
      setDocStatus('harvesting');
      base44.functions.invoke('harvestSchoolDocuments', { school_name: schoolName, zipcode: zip, city })
        .then(() => setDocStatus('harvested'))
        .catch(() => setDocStatus('not_found'));
    } catch {
      setDocStatus('not_found');
    }
  };

  const handleMiddleSelect = (school) => {
    onMiddleSchoolChange(school.school_name);
    setShowMiddleList(false);
    setDocStatus(null);
    checkAndHarvestDocs(school.school_name, zipcode, school.city);
  };

  const handleHighSelect = (school) => {
    onHighSchoolChange(school.school_name);
    setShowHighList(false);
    setDocStatus(null);
    checkAndHarvestDocs(school.school_name, zipcode, school.city);
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
          {zipError && <p className="text-xs text-destructive mt-1 font-medium">{zipError}</p>}
          {debugMode && debugSteps.length > 0 && (
            <div className="mt-2 text-xs bg-muted/60 rounded-lg p-2.5 space-y-0.5 max-h-48 overflow-y-auto border border-border">
              {debugSteps.map((step, i) => (
                <div key={i} className="text-muted-foreground font-mono leading-snug">{step}</div>
              ))}
            </div>
          )}
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

      {/* Curriculum doc status indicator */}
      {debugMode && docStatus && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
          docStatus === 'found' ? 'bg-green-50 border-green-200 text-green-700' :
          docStatus === 'harvested' ? 'bg-green-50 border-green-200 text-green-700' :
          docStatus === 'harvesting' ? 'bg-blue-50 border-blue-200 text-blue-700' :
          docStatus === 'checking' ? 'bg-muted border-border text-muted-foreground' :
          'bg-orange-50 border-orange-200 text-orange-700'
        }`}>
          {(docStatus === 'checking' || docStatus === 'harvesting') && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
          {(docStatus === 'found' || docStatus === 'harvested') && <CheckCircle2 className="w-3 h-3 shrink-0" />}
          {docStatus === 'not_found' && <AlertCircle className="w-3 h-3 shrink-0" />}
          <span>
            {docStatus === 'checking' && 'Checking for curriculum documents...'}
            {docStatus === 'found' && 'Curriculum documents found in cache ✓'}
            {docStatus === 'harvesting' && 'Fetching curriculum documents in background...'}
            {docStatus === 'harvested' && 'Curriculum documents fetched and cached ✓'}
            {docStatus === 'not_found' && 'No curriculum documents found for this school'}
          </span>
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