import { useState } from "react";
import { BookOpen, Users, Laptop, Sun, Trophy, Heart, GraduationCap, Star, ExternalLink, Info, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const gradeLabels = {
  7: "7th Grade", 8: "8th Grade", 9: "9th Grade",
  10: "10th Grade", 11: "11th Grade", 12: "12th Grade"
};

const levelColors = {
  "AP": "bg-purple-100 text-purple-700 border-purple-200",
  "Honors": "bg-blue-100 text-blue-700 border-blue-200",
  "IB": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Dual Enrollment": "bg-green-100 text-green-700 border-green-200",
  "Standard": "bg-slate-100 text-slate-600 border-slate-200",
};

function CourseCard({ course, schoolName, catalogUrl }) {
  const isObj = typeof course === "object" && course !== null;
  const name = isObj ? course.name : course;
  const credits = isObj ? course.credits : null;
  const level = isObj ? course.level : null;
  const subject = isObj ? course.subject_area : null;
  const req = isObj ? course.required_or_elective : null;
  const recommended = isObj ? course.recommended_for_track : false;
  const prereqs = isObj ? course.prerequisites : null;

  const href = catalogUrl || `https://www.google.com/search?q=${encodeURIComponent(name + (schoolName ? " " + schoolName + " course catalog" : " course catalog"))}`;

  return (
    <div className={cn(
      "rounded-xl border p-3 text-sm transition-all",
      recommended ? "border-primary/40 bg-primary/5" : "border-border bg-card"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {recommended && <Star className="w-3 h-3 text-primary fill-primary shrink-0" />}
            <a href={href} target="_blank" rel="noopener noreferrer"
              className="font-semibold text-foreground hover:text-primary hover:underline transition-colors text-sm leading-tight">
              {name}
            </a>
            {level && level !== "Standard" && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", levelColors[level] || "bg-muted text-muted-foreground border-border")}>
                {level}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {subject && <span className="text-[11px] text-muted-foreground">{subject}</span>}
            {req && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                req.toLowerCase().includes("required") ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"
              )}>
                {req}
              </span>
            )}
            {credits && (
              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
                {credits} cr
              </span>
            )}
          </div>
          {prereqs && prereqs !== "None" && prereqs !== "N/A" && (
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Info className="w-3 h-3 shrink-0" /> Prereq: {prereqs}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const sections = [
  { key: "clubs", label: "School Clubs", icon: Users, color: "bg-secondary/10 text-secondary", tagColor: "bg-secondary/10 text-secondary" },
  { key: "extracurriculars", label: "Extracurriculars", icon: Trophy, color: "bg-accent/10 text-accent", tagColor: "bg-accent/10 text-accent" },
  { key: "volunteer_opportunities", label: "Volunteer", icon: Heart, color: "bg-red-500/10 text-red-500", tagColor: "bg-red-500/10 text-red-600" },
  { key: "online_courses", label: "Online Courses", icon: Laptop, color: "bg-blue-500/10 text-blue-500", tagColor: "bg-blue-500/10 text-blue-600" },
  { key: "summer_activities", label: "Summer Activities", icon: Sun, color: "bg-orange-500/10 text-orange-500", tagColor: "bg-orange-500/10 text-orange-600" },
];

export default function GradePlanCard({ grade, gradeData, schoolName, schoolInfo }) {
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);

  if (!gradeData) return null;

  const courses = Array.isArray(gradeData.school_courses) ? gradeData.school_courses : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">{gradeLabels[grade]}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{gradeData.focus}</p>
            {gradeData.credit_summary && (
              <p className="text-xs text-primary font-medium mt-1">📊 {gradeData.credit_summary}</p>
            )}
          </div>
          {gradeData.key_milestone && (
            <div className="bg-white/60 dark:bg-card/60 rounded-xl p-3 max-w-xs">
              <p className="text-xs font-medium text-primary mb-1">🏆 Key Milestone</p>
              <p className="text-sm text-foreground">{gradeData.key_milestone}</p>
            </div>
          )}
        </div>
      </div>

      {/* Source Info */}
      {schoolInfo && (schoolInfo.catalog_url || schoolInfo.school_website) && (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">📚 Data Sources:</span>
          {schoolInfo.school_website && (
            <a href={schoolInfo.school_website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="w-3 h-3" /> School Website
            </a>
          )}
          {schoolInfo.catalog_url && (
            <a href={schoolInfo.catalog_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="w-3 h-3" /> Course Catalog
            </a>
          )}
          {schoolInfo.courses_found > 0 && (
            <span className="text-muted-foreground">{schoolInfo.courses_found} courses found in catalog</span>
          )}
        </div>
      )}

      {/* Graduation Requirements */}
      {schoolInfo?.graduation_requirements && schoolInfo.graduation_requirements.total_credits && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" /> Graduation Requirements
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[
              { label: "Total Credits", val: schoolInfo.graduation_requirements.total_credits },
              { label: "English", val: schoolInfo.graduation_requirements.english_credits },
              { label: "Math", val: schoolInfo.graduation_requirements.math_credits },
              { label: "Science", val: schoolInfo.graduation_requirements.science_credits },
              { label: "Social Studies", val: schoolInfo.graduation_requirements.social_studies_credits },
              { label: "PE / Health", val: schoolInfo.graduation_requirements.pe_health_credits },
              { label: "Electives", val: schoolInfo.graduation_requirements.elective_credits },
            ].filter(r => r.val != null).map(r => {
              const display = typeof r.val === 'object' ? JSON.stringify(r.val) : r.val;
              return (
                <div key={r.label} className="bg-muted/50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className="text-sm font-bold text-foreground">{display} cr</p>
                </div>
                );
                })}
                </div>
                )}
                </div>
                )}

      {/* Enrollment Process — Collapsible */}
      {schoolInfo?.enrollment_process && Object.values(schoolInfo.enrollment_process).some(Boolean) && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            onClick={() => setEnrollmentOpen(o => !o)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
          >
            <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> Course Enrollment Process
            </h3>
            {enrollmentOpen
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {enrollmentOpen && (
            <div className="px-4 pb-4 space-y-2">
              {[
                { label: "How to Register", val: schoolInfo.enrollment_process.how_to_register },
                { label: "Timeline", val: schoolInfo.enrollment_process.registration_timeline },
                { label: "Counselor / Advisor", val: schoolInfo.enrollment_process.advisor_counselor_info },
                { label: "AP / Honors Enrollment", val: schoolInfo.enrollment_process.ap_honors_enrollment },
                { label: "Level Change Process", val: schoolInfo.enrollment_process.level_change_process },
                { label: "Registration Portal", val: schoolInfo.enrollment_process.registration_portal },
                { label: "Notes", val: schoolInfo.enrollment_process.notes },
              ].filter(r => r.val).map(r => {
                const display = typeof r.val === 'object' ? JSON.stringify(r.val) : r.val;
                return (
                  <div key={r.label} className="flex gap-2 text-xs">
                    <span className="font-semibold text-foreground min-w-[130px] shrink-0">{r.label}:</span>
                    <span className="text-muted-foreground">{display}</span>
                  </div>
                );
                })}
                </div>
          )}
        </div>
      )}

      {/* School Courses */}
      {courses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="font-heading font-semibold text-sm text-foreground">School Courses</h3>
            <span className="text-xs text-muted-foreground ml-1">📚 From real course catalog</span>
            {courses.some(c => c.recommended_for_track) && (
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1 ml-auto">
                <Star className="w-3 h-3 fill-primary" /> = Recommended for this track
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {courses.map((course, i) => (
              <CourseCard key={i} course={course} schoolName={schoolName} catalogUrl={schoolInfo?.catalog_url} />
            ))}
          </div>
        </div>
      )}

      {/* Special Programs */}
      {Array.isArray(gradeData.special_programs) && gradeData.special_programs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/10 text-purple-600">
              <GraduationCap className="w-4 h-4" />
            </div>
            <h3 className="font-heading font-semibold text-sm">Special Programs</h3>
            <span className="text-[10px] text-muted-foreground">⭐ AP / Honors / IB</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {gradeData.special_programs.map((p, i) => (
              <a key={i}
                href={`https://www.google.com/search?q=${encodeURIComponent(p + (schoolName ? " " + schoolName : ""))}`}
                target="_blank" rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-700 hover:opacity-70 transition-opacity">
                {p}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Other sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map(({ key, label, icon: Icon, color, tagColor }) => {
          const items = Array.isArray(gradeData[key]) ? gradeData[key] : [];
          if (!items.length) return null;
          return (
            <div key={key} className="rounded-2xl bg-card border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="font-heading font-semibold text-sm text-foreground">{label}</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item, i) => (
                  <a key={i}
                    href={`https://www.google.com/search?q=${encodeURIComponent(item + (schoolName ? " " + schoolName : ""))}`}
                    target="_blank" rel="noopener noreferrer"
                    className={cn("px-2.5 py-1 rounded-lg text-xs font-medium hover:opacity-70 transition-opacity cursor-pointer", tagColor)}>
                    {item}
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}