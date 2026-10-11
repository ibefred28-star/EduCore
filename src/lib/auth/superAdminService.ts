import { auth } from '../firebase';

export interface ProvisionAdminParams {
  schoolId: string;
  adminId: string;
  adminName?: string;
  password: string;
}

export interface RecoverUserParams {
  schoolId: string;
  username: string;
  role: string;
  displayName?: string;
  newPassword?: string;
}

export const SuperAdminService = {
  /**
   * Updates the authenticated Global Super Administrator password
   */
  async changePassword(newPassword: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, error: 'Not authenticated as Super Admin' };

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/superadmin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ newPassword })
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to update password' };
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating password.' };
    }
  },

  /**
   * Provisions a school administrator in Firebase Authentication & Firestore
   */
  async provisionSchoolAdmin(params: ProvisionAdminParams): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, error: 'Not authenticated as Super Admin' };

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/superadmin/provision-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(params)
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to provision school administrator' };
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error provisioning admin.' };
    }
  },

  /**
   * Toggles an account status between active and disabled
   */
  async toggleUserStatus(schoolId: string, username: string, status: 'active' | 'disabled'): Promise<{ success: boolean; error?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, error: 'Not authenticated as Super Admin' };

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/superadmin/toggle-user-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ schoolId, username, status })
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to update account status' };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating account status.' };
    }
  },

  /**
   * Recovers/re-synchronizes a user account with Firebase Authentication
   */
  async recoverUserAccount(params: RecoverUserParams): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, error: 'Not authenticated as Super Admin' };

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/superadmin/recover-user-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(params)
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to recover account' };
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error recovering account.' };
    }
  },

  /**
   * Fetches authoritative aggregated platform overview metrics, schools summary, and audit logs
   */
  async getPlatformOverview(): Promise<{ success: boolean; metrics?: any; schools?: any[]; recentLogs?: any[]; error?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, error: 'Not authenticated as Super Admin' };

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/superadmin/overview', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to fetch platform metrics' };
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error fetching platform metrics.' };
    }
  },

  /**
   * Fetches cross-school user directory across all registered tenants
   */
  async getPlatformUsers(): Promise<{ success: boolean; users?: any[]; error?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, error: 'Not authenticated as Super Admin' };

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/superadmin/users', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to fetch platform users' };
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error fetching platform users.' };
    }
  },

  /**
   * Updates school profile details (name, status, contact info, notes)
   */
  async updateSchool(schoolId: string, updates: { name?: string; status?: 'active' | 'suspended'; contactEmail?: string; contactPhone?: string; notes?: string }): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, error: 'Not authenticated as Super Admin' };

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/superadmin/update-school', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ schoolId, ...updates })
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to update school' };
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating school.' };
    }
  },

  /**
   * Deletes a school from global directory
   */
  async deleteSchool(schoolId: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, error: 'Not authenticated as Super Admin' };

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/superadmin/delete-school', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ schoolId })
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to delete school' };
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error deleting school.' };
    }
  },

  /**
   * Fetches recent security and administrative audit logs
   */
  async getAuditLogs(): Promise<{ success: boolean; logs?: any[]; error?: string }> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, error: 'Not authenticated as Super Admin' };

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/superadmin/audit-logs', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to fetch audit logs' };
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error fetching audit logs.' };
    }
  }
};

