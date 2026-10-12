import { Role } from '../../types';

/**
 * Custom claims encoded into Firebase Auth ID tokens for server-authoritative RBAC
 */
export interface EduCoreCustomClaims {
  schoolId: string;
  role: Role | 'superadmin';
  userId: string;
  classes?: string[];
}

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  schoolId: string;
  role: Role | 'superadmin';
  userId: string;
  displayName: string;
  classes?: string[];
  class?: string;
}

/**
 * Synthesizes an internal Firebase Auth email address from tenant credentials.
 * Enables students/teachers/admins to authenticate with simple ID/password
 * without exposing raw email constraints to the user interface.
 */
export function formatInternalAuthEmail(schoolId: string, role: string, userId: string): string {
  const cleanSchool = schoolId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const cleanRole = role.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const cleanUser = userId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return `${cleanSchool}.${cleanRole}.${cleanUser}@educore.internal`;
}
