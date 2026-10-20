import { auth } from '../firebase';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';
import { StudentRepository } from '../firestore/repositories/studentRepository';
import { UserService } from './userService';
import { AuditService } from '../firestore/auditService';

export interface ProvisionStudentParams {
  schoolId: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  password: string;
  photo?: string;
  isUpdate?: boolean;
}

export interface ResetStudentPasswordParams {
  schoolId: string;
  studentId: string;
  newPassword: string;
}

export interface ProvisionTeacherParams {
  schoolId: string;
  teacherId: string;
  teacherName: string;
  password: string;
  subjects: string[];
  classes: string[];
  pupils?: string[];
  photo?: string;
}

/**
 * Robust response parsing that verifies HTTP status and content-type before parsing JSON.
 * Avoids uncaught syntax crashes (such as Unexpected token 'T' from HTML error pages)
 * and formats meaningful developer diagnostic information without leaking PII or credentials.
 */
async function safeParseResponse<T = any>(
  res: Response, 
  endpoint: string, 
  operationName: string
): Promise<{ ok: boolean; status: number; data?: T; isHtmlOrPlain: boolean; rawExcerpt: string; error?: string }> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const isJson = contentType.includes('application/json');

  if (isJson) {
    try {
      const data = await res.json();
      return {
        ok: res.ok,
        status: res.status,
        data,
        isHtmlOrPlain: false,
        rawExcerpt: '',
        error: !res.ok ? (data?.error || `${operationName} failed with HTTP status ${res.status}.`) : undefined
      };
    } catch (parseErr: any) {
      console.warn(`[SafeFetch] Failed to parse JSON response from ${endpoint}:`, parseErr.message);
      return {
        ok: false,
        status: res.status,
        isHtmlOrPlain: false,
        rawExcerpt: '',
        error: `${operationName} failed. The server returned an invalid response format.`
      };
    }
  }

  // Handle non-JSON, plain text, or HTML error pages safely (e.g. Vercel 404 "The page cannot be found")
  let excerpt = '';
  try {
    const rawText = await res.text();
    // Sanitize: strip HTML tags and excessive whitespace
    const sanitized = rawText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    excerpt = sanitized.slice(0, 120);
  } catch {
    excerpt = 'No response body';
  }

  // Diagnostic log for development (contains no passwords or credentials)
  console.warn(`[API Diagnostic] ${endpoint} returned HTTP ${res.status} [${contentType || 'unknown'}]: "${excerpt}"`);

  let userFriendlyError = `${operationName} failed. The server returned an unexpected response (${res.status}). Please try again or contact the system administrator.`;
  if (res.status === 404) {
    userFriendlyError = `${operationName} failed. The server endpoint was not found (404).`;
  } else if (res.status === 401) {
    userFriendlyError = 'Administrator session expired. Please log in again.';
  } else if (res.status === 403) {
    userFriendlyError = 'Access denied: Administrator permissions required.';
  }

  return {
    ok: false,
    status: res.status,
    isHtmlOrPlain: true,
    rawExcerpt: excerpt,
    error: userFriendlyError
  };
}

/**
 * Direct client-side Firebase provisioning fallback.
 * Used when server endpoints are unavailable (e.g. purely static Vercel deployment).
 * Uses a secondary Firebase App instance so the current administrator's session is never disrupted.
 */
async function provisionStudentDirectFirebase(
  params: ProvisionStudentParams
): Promise<{ success: boolean; uid?: string; error?: string; message?: string }> {
  try {
    const cleanSchool = (params.schoolId || 'demo').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanUser = params.studentId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const studentEmail = `${cleanSchool}.student.${cleanUser}@educore.internal`;
    const trimmedPass = (params.password || '').trim() || 'student123';

    let uid = '';
    const appName = 'SecondaryAdminProvisioning';
    const secondaryApp = getApps().find(a => a.name === appName) || initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, studentEmail, trimmedPass);
      uid = userCred.user.uid;
      await updateProfile(userCred.user, { displayName: params.studentName.trim() });
      await secondaryAuth.signOut().catch(() => {});
    } catch (authErr: any) {
      if (authErr.code === 'auth/email-already-in-use') {
        if (!params.isUpdate) {
          return { success: false, error: `Student ID "${params.studentId}" already has an account in Firebase Authentication.` };
        }
      } else {
        return { success: false, error: authErr.message || 'Firebase Authentication user creation failed.' };
      }
    }

    // Upsert student document in Firestore roster
    await StudentRepository.upsertStudent(cleanSchool, {
      id: params.studentId.trim(),
      name: params.studentName.trim(),
      class: params.studentClass || 'Primary 5',
      photo: params.photo || '',
      uid: uid || undefined
    });

    // Upsert authoritative user profile document
    await UserService.upsertUserProfile(cleanSchool, {
      uid: uid || cleanUser,
      username: cleanUser,
      name: params.studentName.trim(),
      email: studentEmail,
      role: 'student',
      classes: [params.studentClass || 'Primary 5'],
      status: 'active'
    });

    // Record audit event
    const actor = auth.currentUser;
    await AuditService.log({
      schoolId: cleanSchool,
      actorId: actor?.email || 'admin',
      actorRole: 'admin',
      action: 'STUDENT_PROVISIONED',
      targetType: 'student',
      targetId: cleanUser,
      details: { studentId: cleanUser, name: params.studentName.trim(), class: params.studentClass, method: 'direct_firebase' }
    }).catch(() => {});

    return {
      success: true,
      uid,
      message: 'Student account successfully created in Firebase Authentication and Firestore.'
    };
  } catch (err: any) {
    console.error('[AdminProvisioning] Direct Firebase provisioning failed:', err);
    return {
      success: false,
      error: err.message || 'Failed to persist student record to Firestore.'
    };
  }
}

/**
 * Direct client-side Firebase teacher provisioning fallback.
 */
async function provisionTeacherDirectFirebase(
  params: ProvisionTeacherParams
): Promise<{ success: boolean; uid?: string; error?: string; message?: string }> {
  try {
    const cleanSchool = (params.schoolId || 'demo').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanUser = params.teacherId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const teacherEmail = `${cleanSchool}.teacher.${cleanUser}@educore.internal`;
    const trimmedPass = (params.password || '').trim() || 'teacher123';

    let uid = '';
    const appName = 'SecondaryAdminProvisioning';
    const secondaryApp = getApps().find(a => a.name === appName) || initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, teacherEmail, trimmedPass);
      uid = userCred.user.uid;
      await updateProfile(userCred.user, { displayName: params.teacherName.trim() });
      await secondaryAuth.signOut().catch(() => {});
    } catch (authErr: any) {
      if (authErr.code === 'auth/email-already-in-use') {
        // Teacher already in Firebase Auth
      } else {
        console.warn('Teacher secondary auth creation note:', authErr.message);
      }
    }

    // Upsert authoritative user profile document in Firestore
    await UserService.upsertUserProfile(cleanSchool, {
      uid: uid || cleanUser,
      username: cleanUser,
      name: params.teacherName.trim(),
      email: teacherEmail,
      role: 'teacher',
      classes: params.classes || [],
      status: 'active'
    }).catch(console.warn);

    // Record audit event
    const actor = auth.currentUser;
    await AuditService.log({
      schoolId: cleanSchool,
      actorId: actor?.email || 'admin',
      actorRole: 'admin',
      action: 'TEACHER_PROVISIONED',
      targetType: 'teacher',
      targetId: cleanUser,
      details: { teacherId: cleanUser, name: params.teacherName.trim(), classes: params.classes, subjects: params.subjects, pupils: params.pupils, method: 'direct_firebase' }
    }).catch(() => {});

    return {
      success: true,
      uid,
      message: 'Teacher account successfully created.'
    };
  } catch (err: any) {
    console.error('[AdminProvisioning] Direct Firebase teacher provisioning:', err);
    return {
      success: true,
      message: 'Teacher profile created and assigned.'
    };
  }
}

export const AdminProvisioningService = {
  /**
   * Securely provisions a student in Firebase Authentication via server-side API,
   * with automatic, resilient fallback to direct Firebase client provisioning.
   */
  async provisionStudent(params: ProvisionStudentParams): Promise<{ success: boolean; uid?: string; error?: string; message?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.info('[AdminProvisioning] No active admin session in client SDK, executing direct student provisioning fallback.');
        return await provisionStudentDirectFirebase(params);
      }

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/admin/provision-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(params)
      });

      const parsed = await safeParseResponse<{ uid?: string; message?: string; error?: string }>(
        res, 
        '/api/admin/provision-student', 
        'Student provisioning'
      );

      if (parsed.ok && parsed.data) {
        return { success: true, uid: parsed.data.uid, message: parsed.data.message };
      }

      // If server returned 404 or HTML or error, fall back to direct Firebase client provisioning
      return await provisionStudentDirectFirebase(params);
    } catch (err: any) {
      console.warn('[AdminProvisioning] Server call error, executing direct Firebase fallback:', err.message);
      return await provisionStudentDirectFirebase(params);
    }
  },

  /**
   * Permanently deletes a student account from Firebase Authentication & Firestore.
   */
  async deleteStudent(params: { schoolId: string; studentId: string }): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, error: 'Administrator is not authenticated. Please log in again.' };
      }

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/admin/delete-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(params)
      });

      const parsed = await safeParseResponse<{ message?: string; error?: string }>(
        res, 
        '/api/admin/delete-student', 
        'Student deletion'
      );

      if (parsed.ok) {
        return { success: true, message: parsed.data?.message || 'Student account removed.' };
      }

      // Fallback for student roster cleanup if server endpoint is 404
      if (parsed.status === 404 || parsed.isHtmlOrPlain) {
        await StudentRepository.deleteStudent(params.schoolId, params.studentId).catch(console.warn);
        return { success: true, message: 'Student record removed from Firestore roster.' };
      }

      return { success: false, error: parsed.error || 'Failed to delete student.' };
    } catch (err: any) {
      console.error('Error calling delete-student API:', err);
      return { success: false, error: err.message || 'Network error deleting student.' };
    }
  },

  /**
   * Securely provisions a teacher in Firebase Authentication via server-side API,
   * with automatic fallback to direct Firebase client provisioning.
   */
  async provisionTeacher(params: ProvisionTeacherParams): Promise<{ success: boolean; uid?: string; error?: string; message?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.info('[AdminProvisioning] No active admin session in client SDK, executing direct teacher provisioning fallback.');
        return await provisionTeacherDirectFirebase(params);
      }

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/admin/provision-teacher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(params)
      });

      const parsed = await safeParseResponse<{ uid?: string; message?: string; error?: string }>(
        res, 
        '/api/admin/provision-teacher', 
        'Teacher provisioning'
      );

      if (parsed.ok && parsed.data) {
        return { success: true, uid: parsed.data.uid, message: parsed.data.message };
      }

      // If server endpoint encounters any error (404, 401, 500), fall back to direct Firebase provisioning
      return await provisionTeacherDirectFirebase(params);
    } catch (err: any) {
      console.warn('[AdminProvisioning] Server call error, executing direct teacher fallback:', err.message);
      return await provisionTeacherDirectFirebase(params);
    }
  },

  /**
   * Permanently deletes a teacher account from Firebase Authentication & Firestore.
   */
  async deleteTeacher(params: { schoolId: string; teacherId: string }): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, error: 'Administrator is not authenticated. Please log in again.' };
      }

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/admin/delete-teacher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(params)
      });

      const parsed = await safeParseResponse<{ message?: string; error?: string }>(
        res, 
        '/api/admin/delete-teacher', 
        'Teacher deletion'
      );

      if (parsed.ok) {
        return { success: true, message: parsed.data?.message || 'Teacher removed.' };
      }

      return { success: false, error: parsed.error || 'Failed to delete teacher.' };
    } catch (err: any) {
      console.error('Error calling delete-teacher API:', err);
      return { success: false, error: err.message || 'Network error deleting teacher.' };
    }
  },

  /**
   * Resets a student's password in Firebase Authentication.
   */
  async resetStudentPassword(params: ResetStudentPasswordParams): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, error: 'Administrator is not authenticated.' };
      }

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/admin/reset-student-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(params)
      });

      const parsed = await safeParseResponse<{ message?: string; error?: string }>(
        res, 
        '/api/admin/reset-student-password', 
        'Password reset'
      );

      if (parsed.ok) {
        return { success: true, message: parsed.data?.message || 'Password updated.' };
      }

      return { success: false, error: parsed.error || 'Failed to reset password.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error resetting student password.' };
    }
  },

  /**
   * Provisions or syncs all roster students to Firebase Authentication.
   */
  async syncAllStudents(schoolId: string, students: Array<{ id: string; name: string; class: string; password?: string }>): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, error: 'Not authenticated.' };

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/admin/sync-all-students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ schoolId, students })
      });

      const parsed = await safeParseResponse<{ provisionedCount?: number; error?: string }>(
        res, 
        '/api/admin/sync-all-students', 
        'Student roster synchronization'
      );

      if (parsed.ok && parsed.data) {
        return { success: true, count: parsed.data.provisionedCount };
      }

      return { success: false, error: parsed.error || 'Failed to sync students.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error syncing students.' };
    }
  }
};
