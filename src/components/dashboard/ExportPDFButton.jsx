import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

const TRACK_COLORS = [
  [124, 58, 237],   // purple
  [6, 182, 212],    // cyan
  [236, 72, 153],   // pink
];

function addWrappedText(doc, text, x, y, maxWidth, lineHeight = 6) {
  const lines = doc.splitTextToSize(String(text || ""), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function sectionHeader(doc, label, y, color = [124, 58, 237]) {
  doc.setFillColor(...color);
  doc.roundedRect(14, y, 182, 7, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(label, 18, y + 5);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  return y + 12;
}

function checkPageBreak(doc, y, margin = 20) {
  if (y > 270) {
    doc.addPage();
    return margin;
  }
  return y;
}

export default function ExportPDFButton({ profile }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const [plans, recs, updates] = await Promise.all([
        base44.entities.CareerPlan.filter({ user_email: user.email }),
        base44.entities.Recommendation.filter({ user_email: user.email }, "-created_date", 100),
        base44.entities.ProgressUpdate.filter({ user_email: user.email }, "-created_date", 50),
      ]);

      const plan = plans[0];
      const tracks = (plan?.career_tracks || []).filter(t => t && t.name);

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = 182;
      let y = 20;

      // ── Cover ──────────────────────────────────────────────────────────
      doc.setFillColor(124, 58, 237);
      doc.rect(0, 0, 210, 50, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("Academic & Career Roadmap", 14, 22);
      doc.setFontSize(13);
      doc.text(`${profile.display_name || "Student"} · Grade ${profile.current_grade || ""}`, 14, 33);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 14, 43);
      doc.setTextColor(30, 30, 30);

      y = 60;

      // ── Profile Summary ────────────────────────────────────────────────
      y = sectionHeader(doc, "Student Profile", y);
      doc.setFontSize(9);
      const profileLines = [
        [`School:`, profile.high_school_name || profile.middle_school_name || profile.school_name || "N/A"],
        [`Interests:`, (profile.interests || []).join(", ") || "N/A"],
        [`Strengths:`, (profile.strengths || []).join(", ") || "N/A"],
        [`Dream Careers:`, (profile.dream_careers || []).join(", ") || "N/A"],
        [`Goals:`, (profile.goals || []).join(", ") || "N/A"],
        [`Learning Style:`, profile.preferred_learning_style || "N/A"],
      ];
      profileLines.forEach(([label, val]) => {
        y = checkPageBreak(doc, y);
        doc.setFont("helvetica", "bold");
        doc.text(label, 14, y);
        doc.setFont("helvetica", "normal");
        y = addWrappedText(doc, val, 50, y, 145, 5.5);
        y += 1;
      });
      y += 4;

      // ── Career Tracks ──────────────────────────────────────────────────
      if (tracks.length > 0) {
        tracks.forEach((track, ti) => {
          y = checkPageBreak(doc, y, 30);
          const color = TRACK_COLORS[ti % TRACK_COLORS.length];

          // Track header
          doc.setFillColor(...color);
          doc.rect(0, y - 2, 210, 14, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.text(`Track ${ti + 1}: ${track.name}`, 14, y + 7);
          doc.setTextColor(30, 30, 30);
          y += 18;

          // Track description & college goal
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          if (track.description) {
            y = addWrappedText(doc, track.description, 14, y, W, 5.5);
            y += 2;
          }
          if (track.college_goals) {
            doc.setFont("helvetica", "bold");
            doc.text("College Goal:", 14, y);
            doc.setFont("helvetica", "normal");
            y = addWrappedText(doc, track.college_goals, 40, y, W - 26, 5.5);
            y += 3;
          }

          // Grades
          (track.grades || []).forEach((g) => {
            y = checkPageBreak(doc, y, 35);
            const gradeLabel = `Grade ${g.grade}`;

            // Grade sub-header
            doc.setFillColor(...color.map(c => Math.min(255, c + 60)));
            doc.roundedRect(14, y, W, 7, 1.5, 1.5, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.text(gradeLabel, 18, y + 5);
            doc.setTextColor(30, 30, 30);
            y += 11;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);

            if (g.focus) {
              doc.setFont("helvetica", "italic");
              y = addWrappedText(doc, g.focus, 14, y, W, 5);
              doc.setFont("helvetica", "normal");
              y += 1;
            }
            if (g.key_milestone) {
              doc.setFont("helvetica", "bold");
              doc.text("🏆 Milestone:", 14, y);
              doc.setFont("helvetica", "normal");
              y = addWrappedText(doc, g.key_milestone, 42, y, W - 28, 5);
              y += 1;
            }

            // School Courses
            const courses = (g.school_courses || []);
            if (courses.length > 0) {
              y = checkPageBreak(doc, y);
              doc.setFont("helvetica", "bold");
              doc.text("Courses:", 14, y);
              y += 5;
              doc.setFont("helvetica", "normal");

              // Group by subject
              const bySubject = {};
              courses.forEach(c => {
                const s = (typeof c === "object" && c.subject_area) ? c.subject_area : "Other";
                if (!bySubject[s]) bySubject[s] = [];
                bySubject[s].push(c);
              });
              Object.keys(bySubject).sort().forEach(subj => {
                y = checkPageBreak(doc, y);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7.5);
                doc.text(`  ${subj}:`, 14, y);
                y += 4;
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                bySubject[subj].forEach(c => {
                  y = checkPageBreak(doc, y);
                  const name = typeof c === "object" ? c.name : c;
                  const level = typeof c === "object" && c.level && c.level !== "Standard" ? ` [${c.level}]` : "";
                  const star = typeof c === "object" && c.recommended_for_track ? " ★" : "";
                  doc.text(`    • ${name}${level}${star}`, 14, y);
                  y += 4.5;
                });
              });
            }

            // Activities
            const activityMap = [
              { key: "clubs", label: "Clubs" },
              { key: "extracurriculars", label: "Extracurriculars" },
              { key: "online_courses", label: "Online Courses" },
              { key: "summer_activities", label: "Summer" },
              { key: "volunteer_opportunities", label: "Volunteer" },
              { key: "special_programs", label: "Special Programs" },
            ];
            activityMap.forEach(({ key, label }) => {
              const items = Array.isArray(g[key]) ? g[key] : [];
              if (!items.length) return;
              y = checkPageBreak(doc, y);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5);
              doc.text(`  ${label}:`, 14, y);
              doc.setFont("helvetica", "normal");
              y = addWrappedText(doc, items.join("  •  "), 38, y, W - 24, 5);
              y += 1;
            });

            y += 4;
          });

          y += 6;
        });
      }

      // ── Recommendations ────────────────────────────────────────────────
      if (recs.length > 0) {
        y = checkPageBreak(doc, y, 30);
        y = sectionHeader(doc, "Personalized Recommendations", y);

        recs.forEach((rec) => {
          y = checkPageBreak(doc, y, 30);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(`${rec.type}: ${rec.title}`, 14, y);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          if (rec.status) {
            doc.setTextColor(100, 100, 100);
            doc.text(`Status: ${rec.status}  |  Difficulty: ${rec.difficulty_level || "N/A"}  |  Duration: ${rec.estimated_duration || "N/A"}`, 14, y + 5);
            doc.setTextColor(30, 30, 30);
            y += 9;
          } else {
            y += 6;
          }
          doc.setFontSize(8.5);
          if (rec.description) {
            y = addWrappedText(doc, rec.description, 14, y, W, 5);
            y += 1;
          }
          if (rec.why_recommended) {
            doc.setFont("helvetica", "italic");
            y = addWrappedText(doc, `Why: ${rec.why_recommended}`, 14, y, W, 5);
            doc.setFont("helvetica", "normal");
            y += 1;
          }
          y += 3;
        });
      }

      // ── Progress Updates ───────────────────────────────────────────────
      if (updates.length > 0) {
        y = checkPageBreak(doc, y, 30);
        y = sectionHeader(doc, "Progress & Achievements", y, [6, 182, 212]);

        updates.forEach((u) => {
          y = checkPageBreak(doc, y, 20);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(`${u.update_type}: ${u.title}`, 14, y);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          if (u.mood) {
            doc.setTextColor(100, 100, 100);
            doc.text(`Mood: ${u.mood}`, 14, y + 5);
            doc.setTextColor(30, 30, 30);
            y += 9;
          } else {
            y += 6;
          }
          if (u.description) {
            y = addWrappedText(doc, u.description, 14, y, W, 5);
            y += 1;
          }
          if (u.skills_gained?.length) {
            y = addWrappedText(doc, `Skills gained: ${u.skills_gained.join(", ")}`, 14, y, W, 5);
            y += 1;
          }
          y += 2;
        });
      }

      // ── Footer on each page ────────────────────────────────────────────
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(`FutureTrackAI — ${profile.display_name}'s Roadmap`, 14, 290);
        doc.text(`Page ${i} of ${totalPages}`, 196, 290, { align: "right" });
        doc.setTextColor(30, 30, 30);
      }

      doc.save(`${(profile.display_name || "student").replace(/\s+/g, "_")}_academic_roadmap.pdf`);
      toast.success("PDF exported successfully!");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to export PDF. Please try again.");
    }
    setLoading(false);
  };

  return (
    <Button
      onClick={handleExport}
      disabled={loading}
      className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          Export PDF
        </>
      )}
    </Button>
  );
}