// US school years typically start in August - a student who says "grade 9"
// in the 2026-2027 school year should automatically show as grade 10 once
// the 2027-2028 school year begins, without manually updating anything.

export function currentSchoolYear() {
  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

function schoolYearStart(gradeYear) {
  const startYear = parseInt(String(gradeYear).split('-')[0], 10);
  return Number.isNaN(startYear) ? null : startYear;
}

/**
 * Given a profile's { current_grade, grade_year }, returns the grade/year it
 * should have *now*, plus whether that differs from what's stored (meaning
 * the profile should be updated).
 */
export function progressGrade(profile) {
  const nowYear = currentSchoolYear();
  const anchorStart = schoolYearStart(profile?.grade_year);

  if (anchorStart === null) {
    // No anchor yet (older profile) - anchor to now without changing the grade.
    return { grade: profile?.current_grade ?? null, gradeYear: nowYear, changed: profile?.grade_year !== nowYear };
  }

  const currentStart = schoolYearStart(nowYear);
  const yearsElapsed = currentStart - anchorStart;
  if (yearsElapsed <= 0) {
    return { grade: profile.current_grade, gradeYear: profile.grade_year, changed: false };
  }

  const newGrade = Math.min((profile.current_grade || 9) + yearsElapsed, 12);
  return { grade: newGrade, gradeYear: nowYear, changed: true };
}
