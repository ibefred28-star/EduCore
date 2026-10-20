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
export function isStudentInTeacherClasses(
  studentClass: string | undefined | null, 
  teacherClasses: string[] | undefined | null,
  teacherPupils?: string[] | undefined | null,
  studentId?: string | undefined | null
): boolean {
  // If specific pupil is directly assigned to the teacher, permit access
  if (teacherPupils && teacherPupils.length > 0 && studentId) {
    const sIdNorm = studentId.trim().toLowerCase();
    if (teacherPupils.some(p => (p || '').trim().toLowerCase() === sIdNorm)) {
      return true;
    }
  }

  // If teacher has no assigned classes or restriction list is empty, teacher has access to all classes
  if (!teacherClasses || !teacherClasses.length) return true;

  // If teacherClasses includes 'All', 'All Classes', or 'General', access is permitted to all
  if (teacherClasses.some(tc => {
    const norm = normalizeClassName(tc || '');
    return !norm || norm === 'all' || norm.startsWith('all') || norm === 'general';
  })) {
    return true;
  }

  // If student class is not specified, permit if teacher has no restrictive classes
  if (!studentClass) return false;
  
  const normStudent = normalizeClassName(studentClass);
  if (!normStudent) return false;

  const expandAbbr = (s: string) => 
    s.replace(/^pri(\d)/, 'primary$1')
     .replace(/^p(\d)/, 'primary$1')
     .replace(/^basic(\d)/, 'primary$1')
     .replace(/^grade(\d)/, 'primary$1')
     .replace(/^g(\d)/, 'primary$1')
     .replace(/^jss(\d)/, 'jss$1')
     .replace(/^js(\d)/, 'jss$1')
     .replace(/^ss(\d)/, 'ss$1');

  const expStudent = expandAbbr(normStudent);

  return teacherClasses.some(tc => {
    if (!tc) return false;
    const normTeacher = normalizeClassName(tc);
    if (!normTeacher) return false;
    if (normTeacher === 'all' || normTeacher.startsWith('all') || normTeacher === 'general') return true;

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

    // 3. Reverse match: student has "Primary 5" and teacher has "Primary 5A"
    if (expTeacher.startsWith(expStudent)) {
      const remainder = expTeacher.slice(expStudent.length);
      if (!/^\d/.test(remainder)) {
        return true;
      }
    }

    return false;
  });
}
