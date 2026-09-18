/**
 * Utility functions for robust class comparison and normalization.
 */

export function normalizeClassName(className: string): string {
  if (!className) return '';
  return className.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks whether a student's class matches any of the teacher's assigned classes.
 * Handles:
 * - Exact matches (case-insensitive, trimmed)
 * - Trailing/leading whitespace and formatting variations ("Primary 5" vs "primary 5" vs "Primary 5 ")
 * - Arm/section extensions ("Primary 5A", "Primary 5 B", "Primary 5-A", "Primary 5 Gold" match "Primary 5")
 * - Common shorthand prefixes ("P5", "Pri 5", "Basic 5" matching "Primary 5")
 */
export function isStudentInTeacherClasses(studentClass: string | undefined | null, teacherClasses: string[] | undefined | null): boolean {
  if (!studentClass || !teacherClasses || !teacherClasses.length) return false;
  
  const normStudent = normalizeClassName(studentClass);
  if (!normStudent) return false;

  const expandAbbr = (s: string) => 
    s.replace(/^pri(\d)/, 'primary$1')
     .replace(/^p(\d)/, 'primary$1')
     .replace(/^basic(\d)/, 'primary$1')
     .replace(/^jss(\d)/, 'jss$1')
     .replace(/^js(\d)/, 'jss$1')
     .replace(/^ss(\d)/, 'ss$1');

  const expStudent = expandAbbr(normStudent);

  return teacherClasses.some(tc => {
    if (!tc) return false;
    const normTeacher = normalizeClassName(tc);
    if (!normTeacher) return false;
    const expTeacher = expandAbbr(normTeacher);

    // 1. Direct normalized match
    if (expStudent === expTeacher) return true;

    // 2. Section/Arm match (e.g. Teacher has "Primary 5", Student has "Primary 5A" or "Primary 5 Gold")
    if (expStudent.startsWith(expTeacher)) {
      const remainder = expStudent.slice(expTeacher.length);
      // Remainder must not start with another digit (e.g. "primary1" shouldn't match "primary10")
      if (!/^\d/.test(remainder)) {
        return true;
      }
    }

    return false;
  });
}
