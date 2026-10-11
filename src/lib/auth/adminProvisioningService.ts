import { auth } from '../firebase';

export interface ProvisionStudentParams {
  schoolId: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  password: string;
  photo?: string;
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
  photo?: string;
}

export const AdminProvisioningService = {
  /**
   * Securely provisions a student in Firebase Authentication via server-side API.
   * Returns result and error messages.
   */
  async provisionStudent(params: ProvisionStudentParams): Promise<{ success: boolean; uid?: string; error?: string; message?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, error: 'Administrator is not authenticated. Please log in again.' };
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

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to provision student in Firebase Auth.' };
      }

      return { success: true, uid: data.uid, message: data.message };
    } catch (err: any) {
      console.error('Error calling provision-student API:', err);
      return { success: false, error: err.message || 'Network error provisioning student.' };
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

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to delete student from Firebase.' };
      }

      return { success: true, message: data.message };
    } catch (err: any) {
      console.error('Error calling delete-student API:', err);
      return { success: false, error: err.message || 'Network error deleting student.' };
    }
  },

  /**
   * Securely provisions a teacher in Firebase Authentication via server-side API.
   */
  async provisionTeacher(params: ProvisionTeacherParams): Promise<{ success: boolean; uid?: string; error?: string; message?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, error: 'Administrator is not authenticated. Please log in again.' };
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

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to provision teacher in Firebase Auth.' };
      }

      return { success: true, uid: data.uid, message: data.message };
    } catch (err: any) {
      console.error('Error calling provision-teacher API:', err);
      return { success: false, error: err.message || 'Network error provisioning teacher.' };
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

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to delete teacher from Firebase.' };
      }

      return { success: true, message: data.message };
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

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to reset password.' };
      }

      return { success: true, message: data.message };
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

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to sync students.' };
      }

      return { success: true, count: data.provisionedCount };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error syncing students.' };
    }
  }
};
